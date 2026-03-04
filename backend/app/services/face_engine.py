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
import numpy as np
import faiss
import torch
from facenet_pytorch import InceptionResnetV1

# Base directory (attendance_ai/)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
FAISS_INDEX_PATH = os.path.join(BASE_DIR, "student_index.faiss")
LABELS_PATH = os.path.join(BASE_DIR, "labels.pkl")

IMAGE_SIZE = 160


class FaceEngine:
    """Singleton face recognition engine with GPU support."""

    def __init__(self):
        self.device = None
        self.yolo = None
        self.resnet = None
        self.index = None
        self.labels = None
        self._initialized = False

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

        # ── YOLOv8 — Face detection ──
        from ultralytics import YOLO
        yolo_path = os.path.join(BASE_DIR, "yolov8n-face.pt")
        self.yolo = YOLO(yolo_path)
        self.yolo.to(self.device)
        print("  [FaceEngine] YOLOv8-Face loaded")

        # ── InceptionResnetV1 (embedding model) ──
        self.resnet = InceptionResnetV1(pretrained="vggface2").eval().half().to(self.device)
        print("  [FaceEngine] InceptionResnetV1 loaded (vggface2, FP16)")

        # ── FAISS index ──
        self.index = faiss.read_index(FAISS_INDEX_PATH)
        print(f"  [FaceEngine] FAISS index loaded: {self.index.ntotal} vectors")

        # ── Labels ──
        with open(LABELS_PATH, "rb") as f:
            self.labels = pickle.load(f)
        print(f"  [FaceEngine] Labels loaded: {len(set(self.labels))} unique students")

        self._initialized = True
        print("  [FaceEngine] Ready for recognition")


# Global singleton instance
engine = FaceEngine()
