"""
Face Recognition Engine — CUDA-accelerated singleton.

This module holds the core engine class that loads all ML models onto GPU
at startup. The actual recognition, registration, and deletion logic lives
in separate modules:
    - recognizer.py  → recognize(), recognize_multi()
    - registrar.py   → register_faces(), delete_student()
"""

import os
import pickle
import threading
import urllib.request
import numpy as np
import faiss
import torch
from facenet_pytorch import InceptionResnetV1

from app.core.config import settings, ROOT_DIR

# Base directory (project root)
BASE_DIR = ROOT_DIR
FAISS_INDEX_PATH = settings.path(settings.FAISS_INDEX_PATH)
LABELS_PATH = settings.path(settings.LABELS_PATH)
DATASET_DIR = settings.path(settings.DATASET_DIR)
YOLO_MODEL_PATH = settings.path(settings.YOLO_MODEL_PATH)

IMAGE_SIZE = 160
EMBEDDING_DIM = 512

# ByteTrack: same IDs as the Ultralytics default (BoT-SORT) but skips its per-frame
# optical-flow motion compensation — ~6 ms/frame cheaper.
TRACKER_CFG = "bytetrack.yaml"

# FaceNet batch sizes run as CUDA graphs (inputs are zero-padded up to the bucket).
# InceptionResnetV1 is launch-bound (~16 ms eager at any batch size); graph replay is ~2.6 ms.
# Small buckets are captured at startup; 16/32 (~0.25 GB host + 180 MB GPU) only on first use.
GRAPH_BUCKETS = (1, 2, 4, 8, 16, 32)
EAGER_CAPTURE_MAX = 8

# Matching: a face is only "confidently" a student if no other student scores within
# MATCH_MARGIN of them (guards look-alikes as the class grows).
MATCH_MARGIN = 0.08
MATCH_SEARCH_K = 64


def _download(url: str, dest: str):
    """Download a file atomically (write to .part, then rename)."""
    print(f"  [FaceEngine] Downloading {os.path.basename(dest)} from {url}")
    tmp = dest + ".part"
    urllib.request.urlretrieve(url, tmp)
    os.replace(tmp, dest)


class FaceEngine:
    """Singleton face recognition engine with GPU support."""

    def __init__(self):
        self.device = None
        self.yolo = None
        self.resnet = None
        self.index = None
        self.labels = None
        self._initialized = False
        # Guards model inference and index/labels mutation across the
        # stream thread and request threadpool (YOLO tracker state and the
        # CUDA graphs' static buffers are not thread-safe).
        self.lock = threading.RLock()
        self._graphs = {}  # batch size -> (graph, static_input, static_output)

    def initialize(self):
        """Load all models and data onto GPU."""
        if self._initialized:
            return

        # ── Device ──
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        gpu_info = ""
        if self.device.type == "cuda":
            gpu_info = f" ({torch.cuda.get_device_name(0)})"
        print(f"  [FaceEngine] Device: {self.device}{gpu_info}")

        # ── YOLOv8 — Face detection (pretrained, downloaded once) ──
        from ultralytics import YOLO
        if not os.path.exists(YOLO_MODEL_PATH):
            _download(settings.YOLO_MODEL_URL, YOLO_MODEL_PATH)
        self.yolo = YOLO(YOLO_MODEL_PATH)
        self.yolo.to(self.device)
        print("  [FaceEngine] YOLOv8-Face loaded")

        # ── InceptionResnetV1 (embedding model) — FP16 only on CUDA ──
        self.resnet = InceptionResnetV1(pretrained="vggface2").eval().to(self.device)
        if self.device.type == "cuda":
            self.resnet = self.resnet.half()
        print(f"  [FaceEngine] InceptionResnetV1 loaded (vggface2, {'FP16' if self.device.type == 'cuda' else 'FP32'})")

        if self.device.type == "cuda":
            for bs in GRAPH_BUCKETS:
                if bs <= EAGER_CAPTURE_MAX:
                    self._capture_graph(bs)
            print(f"  [FaceEngine] CUDA graphs captured for batch sizes {tuple(self._graphs)}")

        # Warm-up: first YOLO call loads kernels / fuses layers (~1 s) — do it before serving
        self.yolo(np.zeros((480, 640, 3), dtype=np.uint8), verbose=False)

        # ── FAISS index + labels (start empty if no students enrolled yet) ──
        if os.path.exists(FAISS_INDEX_PATH) and os.path.exists(LABELS_PATH):
            self.index = faiss.read_index(FAISS_INDEX_PATH)
            with open(LABELS_PATH, "rb") as f:
                self.labels = pickle.load(f)
        else:
            print("  [FaceEngine] No FAISS index found — starting with an empty index")
            self.index = faiss.IndexFlatIP(EMBEDDING_DIM)
            self.labels = []
            self.save_index()
        print(f"  [FaceEngine] FAISS index loaded: {self.index.ntotal} vectors")
        print(f"  [FaceEngine] Labels loaded: {len(set(self.labels))} unique students")

        self._initialized = True
        print("  [FaceEngine] Ready for recognition")

    def _capture_graph(self, bs: int):
        """Record the CUDA graph for one batch bucket (own memory pool). Caller holds engine.lock."""
        side = torch.cuda.Stream()
        with torch.inference_mode():
            static_in = torch.zeros(bs, 3, IMAGE_SIZE, IMAGE_SIZE, device=self.device, dtype=torch.half)
            side.wait_stream(torch.cuda.current_stream())
            with torch.cuda.stream(side):  # warm up on a side stream, as the CUDA graph docs require
                for _ in range(3):
                    self.resnet(static_in)
            torch.cuda.current_stream().wait_stream(side)
            graph = torch.cuda.CUDAGraph()
            with torch.cuda.graph(graph):
                static_out = self.resnet(static_in)
        torch.cuda.synchronize()
        self._graphs[bs] = (graph, static_in, static_out)
        return self._graphs[bs]

    def embed(self, faces: torch.Tensor) -> np.ndarray:
        """
        FaceNet embeddings for a (N, 3, 160, 160) batch → (N, 512) float32, NOT normalized.
        Uses CUDA graph replay on GPU; caller must hold engine.lock.
        """
        if not self._graphs:
            with torch.inference_mode():
                return self.resnet(self.to_model_dtype(faces)).float().cpu().numpy()

        out = []
        max_bs = GRAPH_BUCKETS[-1]
        with torch.inference_mode():
            for start in range(0, len(faces), max_bs):
                chunk = faces[start:start + max_bs]
                n = len(chunk)
                bs = next(b for b in GRAPH_BUCKETS if b >= n)
                graph, static_in, static_out = self._graphs.get(bs) or self._capture_graph(bs)
                static_in[:n].copy_(chunk, non_blocking=True)
                if n < bs:
                    static_in[n:].zero_()  # eval-mode BatchNorm → padded rows don't affect real ones
                graph.replay()
                out.append(static_out[:n].float().cpu().numpy())
        return np.concatenate(out) if len(out) > 1 else out[0]

    def to_model_dtype(self, tensor: torch.Tensor) -> torch.Tensor:
        """Move a batch to the engine device in the embedding model's precision."""
        tensor = tensor.to(self.device)
        return tensor.half() if self.device.type == "cuda" else tensor

    def match(self, embeddings: np.ndarray):
        """
        Identify each (L2-normalized) embedding against the enrolled students.

        Returns None when nobody is enrolled, else one (roll_no, similarity, ambiguous)
        per row: the best-scoring student (best of their stored embeddings) and whether a
        *different* student scores within MATCH_MARGIN — i.e. the face could be either,
        so callers must not treat it as a confident identification.
        """
        if self.index.ntotal == 0:
            return None
        # Each student has ~15 embeddings, so look deep enough to see the runner-up student
        distances, indices = self.index.search(embeddings, k=min(MATCH_SEARCH_K, self.index.ntotal))

        matches = []
        for dists, idxs in zip(distances, indices):
            best = {}  # roll_no -> best similarity (FAISS results are sorted, first hit wins)
            for d, i in zip(dists, idxs):
                if 0 <= i < len(self.labels):
                    best.setdefault(self.labels[i], float(d))
            if not best:
                matches.append((None, 0.0, False))
                continue
            ranked = sorted(best.values(), reverse=True)
            roll_no = max(best, key=best.get)
            ambiguous = len(ranked) > 1 and ranked[1] > ranked[0] - MATCH_MARGIN
            matches.append((roll_no, ranked[0], ambiguous))
        return matches

    def save_index(self):
        """Persist the FAISS index and labels atomically."""
        faiss.write_index(self.index, FAISS_INDEX_PATH + ".tmp")
        os.replace(FAISS_INDEX_PATH + ".tmp", FAISS_INDEX_PATH)
        with open(LABELS_PATH + ".tmp", "wb") as f:
            pickle.dump(self.labels, f)
        os.replace(LABELS_PATH + ".tmp", LABELS_PATH)


# Global singleton instance
engine = FaceEngine()
