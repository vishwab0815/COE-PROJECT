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

        # Detect face with YOLO
        results = engine.yolo(img, conf=0.5, verbose=False)
        if len(results) == 0 or len(results[0].boxes) == 0:
            return None, None, "No face detected in the image"

        # Take the largest/first face
        box = results[0].boxes.xyxy[0].cpu().numpy()
        x1, y1, x2, y2 = map(int, box)

        # Add tight padding (10%)
        w, h = x2 - x1, y2 - y1
        padx, pady = int(w * 0.1), int(h * 0.1)
        x1 = max(0, x1 - padx)
        y1 = max(0, y1 - pady)
        x2 = min(img.width, x2 + padx)
        y2 = min(img.height, y2 + pady)

        crop = img.crop((x1, y1, x2, y2))
        face_tensor = _preprocess(crop)

        # Generate embedding on GPU (FP16)
        face_tensor = face_tensor.unsqueeze(0).to(engine.device).half()
        with torch.no_grad():
            embedding = engine.resnet(face_tensor).float().cpu().numpy()

        # L2 normalize
        norm = np.linalg.norm(embedding, axis=1, keepdims=True)
        if norm[0][0] == 0:
            return None, None, "Invalid embedding (zero norm)"
        embedding = (embedding / norm).astype(np.float32)

        # FAISS search
        distances, indices = engine.index.search(embedding, k=1)
        similarity = float(distances[0][0])
        matched_idx = int(indices[0][0])
        roll_no = engine.labels[matched_idx]

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

        # Step 1: Detect with YOLO-Face
        results = engine.yolo(img, conf=0.5, verbose=False)

        if len(results) == 0 or len(results[0].boxes) == 0:
            return {"faces_detected": 0, "faces_recognized": 0, "results": [], "error": None}

        boxes = results[0].boxes.xyxy.cpu().numpy()  # [N, 4]
        faces_detected = len(boxes)

        if faces_detected == 0:
            return {"faces_detected": 0, "faces_recognized": 0, "results": [], "error": None}

        # Step 2: Crop & Resize (160x160)
        valid_face_tensors = []

        for box in boxes:
            x1, y1, x2, y2 = map(int, box)
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(img.width, x2), min(img.height, y2)

            # Add tight padding (10%)
            w, h = x2 - x1, y2 - y1
            padx, pady = int(w * 0.1), int(h * 0.1)
            x1 = max(0, x1 - padx)
            y1 = max(0, y1 - pady)
            x2 = min(img.width, x2 + padx)
            y2 = min(img.height, y2 + pady)

            crop = img.crop((x1, y1, x2, y2))
            valid_face_tensors.append(_preprocess(crop))

        if len(valid_face_tensors) == 0:
            return {"faces_detected": faces_detected, "faces_recognized": 0, "results": [], "error": None}

        # Step 3: Batch tensor (N, 3, 160, 160) FP16
        batch_tensor = torch.stack(valid_face_tensors).to(engine.device).half()

        # Step 4: Single GPU forward pass
        with torch.no_grad():
            embeddings = engine.resnet(batch_tensor).float().cpu().numpy()  # (N, 512)

        # Step 5: L2 normalize entire batch
        norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
        valid_mask = norms.flatten() > 0
        embeddings = embeddings[valid_mask]
        norms = norms[valid_mask]
        embeddings = (embeddings / norms).astype(np.float32)

        if len(embeddings) == 0:
            return {"faces_detected": faces_detected, "faces_recognized": 0, "results": [], "error": None}

        # Step 6: Batch FAISS search
        distances, indices = engine.index.search(embeddings, k=1)

        # Step 7: Per-frame dedup
        best_matches = {}  # roll_no -> similarity
        for i in range(len(embeddings)):
            similarity = float(distances[i][0])
            matched_idx = int(indices[i][0])

            if matched_idx < 0 or matched_idx >= len(engine.labels):
                continue

            roll_no = engine.labels[matched_idx]

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
