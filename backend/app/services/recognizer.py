"""
Face Recognition — Single and multi-face recognition using YOLO + FaceNet + FAISS.

Depends on the `FaceEngine` singleton from `face_engine.py` for model access.
"""

import io
import numpy as np
import torch
from PIL import Image
from torchvision import transforms

from app.services.face_engine import engine, IMAGE_SIZE

# Hoisted preprocessing pipeline (reused across all calls)
_preprocess = transforms.Compose([
    transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize([0.5, 0.5, 0.5], [0.5, 0.5, 0.5])
])


def _padded_crop(img: Image.Image, box) -> Image.Image:
    """Crop a detection box with 10% padding, clamped to the image bounds."""
    x1, y1, x2, y2 = map(int, box)
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(img.width, x2), min(img.height, y2)

    w, h = x2 - x1, y2 - y1
    padx, pady = int(w * 0.1), int(h * 0.1)
    return img.crop((
        max(0, x1 - padx),
        max(0, y1 - pady),
        min(img.width, x2 + padx),
        min(img.height, y2 + pady),
    ))


def recognize(image_bytes: bytes) -> tuple:
    """
    Recognize a single face from raw image bytes.

    Returns:
        (roll_no: str | None, similarity: float | None, error: str | None)
    """
    if not engine._initialized:
        return None, None, "Engine not initialized"

    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")

        with engine.lock:
            # Detect face with YOLO
            results = engine.yolo(img, conf=0.5, verbose=False)
            if len(results) == 0 or len(results[0].boxes) == 0:
                return None, None, "No face detected in the image"

            # Take the largest/first face
            box = results[0].boxes.xyxy[0].cpu().numpy()
            face_tensor = _preprocess(_padded_crop(img, box))

            # Generate embedding on GPU (FP16, CUDA graph)
            embedding = engine.embed(face_tensor.unsqueeze(0))

            # L2 normalize
            norm = np.linalg.norm(embedding, axis=1, keepdims=True)
            if norm[0][0] == 0:
                return None, None, "Invalid embedding (zero norm)"
            embedding = (embedding / norm).astype(np.float32)

            # FAISS search (per-student best score + look-alike check)
            matches = engine.match(embedding)
            if matches is None:
                return None, None, "No students enrolled yet"
            roll_no, similarity, ambiguous = matches[0]
            if ambiguous:
                return None, None, f"Ambiguous match (closest: {roll_no}, {similarity:.2f}) — look straight at the camera"

        return roll_no, similarity, None

    except Exception as e:
        return None, None, f"Recognition error: {str(e)}"


def recognize_multi(image_bytes: bytes) -> dict:
    """
    Recognize ALL faces in an image using batch GPU processing with YOLO.

    Pipeline:
        1. YOLO detects all faces
        2. Crop ROIs from image & resize to 160x160
        3. torch.stack → batch tensor (N, 3, 160, 160)
        4. Single GPU forward pass → (N, 512) embeddings
        5. L2 normalize entire batch
        6. Batch FAISS search → N results in one call
        7. Per-frame dedup (same person matched multiple times → keep best)

    Returns:
        {
            "faces_detected": int,
            "faces_recognized": int,
            "results": [{"roll_no": str, "similarity": float}, ...],
            "error": str | None
        }
    """
    if not engine._initialized:
        return {"faces_detected": 0, "faces_recognized": 0, "results": [], "error": "Engine not initialized"}

    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")

        with engine.lock:
            # Step 1: Detect with YOLO-Face
            results = engine.yolo(img, conf=0.5, verbose=False)

            if len(results) == 0 or len(results[0].boxes) == 0:
                return {"faces_detected": 0, "faces_recognized": 0, "results": [], "error": None}

            boxes = results[0].boxes.xyxy.cpu().numpy()  # [N, 4]
            faces_detected = len(boxes)

            # Step 2: Crop & Resize (160x160)
            valid_face_tensors = [_preprocess(_padded_crop(img, box)) for box in boxes]

            # Step 3+4: Batch tensor (N, 3, 160, 160) → single GPU pass (FP16, CUDA graph)
            embeddings = engine.embed(torch.stack(valid_face_tensors))  # (N, 512)

            # Step 5: L2 normalize entire batch
            norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
            valid_mask = norms.flatten() > 0
            embeddings = (embeddings[valid_mask] / norms[valid_mask]).astype(np.float32)

            if len(embeddings) == 0:
                return {"faces_detected": faces_detected, "faces_recognized": 0, "results": [], "error": None}

            # Step 6: Batch FAISS search (per-student best score + look-alike check)
            matches = engine.match(embeddings)
            if matches is None:
                return {"faces_detected": faces_detected, "faces_recognized": 0, "results": [], "error": None}

            # Step 7: Per-frame dedup — ambiguous faces are skipped rather than guessed
            best_matches = {}  # roll_no -> similarity
            for roll_no, similarity, ambiguous in matches:
                if roll_no is None or ambiguous:
                    continue
                if roll_no not in best_matches or similarity > best_matches[roll_no]:
                    best_matches[roll_no] = similarity

        results = [
            {"roll_no": roll_no, "similarity": round(sim, 4)}
            for roll_no, sim in best_matches.items()
        ]

        results.sort(key=lambda x: x["similarity"], reverse=True)

        return {
            "faces_detected": faces_detected,
            "faces_recognized": len(results),
            "results": results,
            "error": None,
        }

    except Exception as e:
        return {"faces_detected": 0, "faces_recognized": 0, "results": [], "error": f"Multi-recognition error: {str(e)}"}
