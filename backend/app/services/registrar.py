"""
Student Registration & Deletion — FAISS index and photo management.

Depends on the `FaceEngine` singleton from `face_engine.py` for model access.
"""

import os
import io
import shutil
import numpy as np
import torch
import faiss
from PIL import Image

from app.services.face_engine import engine, DATASET_DIR, EMBEDDING_DIM
from app.services.recognizer import _padded_crop, _preprocess


def register_faces(roll_no: str, image_bytes_list: list[bytes]) -> dict:
    """
    Register a new student by processing multiple face images.
    Extracts embeddings, adds to FAISS index live, and persists to disk.
    """
    if not engine._initialized:
        return {"success": False, "error": "Engine not initialized"}

    student_dir = os.path.join(DATASET_DIR, roll_no)
    os.makedirs(student_dir, exist_ok=True)

    # Decode + save originals (raw bytes: no lossy re-encode, no CPU spent on JPEG)
    images = []
    images_saved = 0
    for i, img_bytes in enumerate(image_bytes_list):
        try:
            images.append(Image.open(io.BytesIO(img_bytes)).convert("RGB"))
            with open(os.path.join(student_dir, f"reg_{i}_orig.jpg"), "wb") as f:
                f.write(img_bytes)
            images_saved += 1
        except Exception as e:
            print(f"  [Registrar] Registration frame {i} failed: {e}")

    new_embeddings = []
    if images:
        with engine.lock:
            # One batched YOLO call for the whole burst, then one FaceNet pass for all crops
            results = engine.yolo(images, conf=0.5, verbose=False)
            crops = [
                _preprocess(_padded_crop(img, res.boxes.xyxy[0].cpu().numpy()))  # best face, 10% padding
                for img, res in zip(images, results) if len(res.boxes) > 0
            ]
            if crops:
                embeddings = engine.embed(torch.stack(crops))

        if crops:
            norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
            valid = norms.flatten() > 0
            new_embeddings = list((embeddings[valid] / norms[valid]).astype(np.float32))

    if not new_embeddings:
        return {
            "success": False,
            "embeddings_added": 0,
            "total_images": len(image_bytes_list),
            "images_saved": images_saved,
            "error": "No faces detected in any of the captured images",
        }

    embeddings_matrix = np.array(new_embeddings, dtype=np.float32)
    with engine.lock:
        engine.index.add(embeddings_matrix)
        engine.labels.extend([roll_no] * len(new_embeddings))
        engine.save_index()

    print(f"  [Registrar] Registered {roll_no}: {len(new_embeddings)} embeddings added (index total: {engine.index.ntotal})")

    return {
        "success": True,
        "embeddings_added": len(new_embeddings),
        "total_images": len(image_bytes_list),
        "images_saved": images_saved,
        "error": None,
    }


def delete_student(roll_no: str) -> dict:
    """Delete a student from FAISS index, labels, and their photo folder."""
    if not engine._initialized:
        return {"success": False, "error": "Engine not initialized"}

    roll_no = roll_no.upper()
    student_dir = os.path.join(DATASET_DIR, roll_no)

    with engine.lock:
        indices_to_keep = [i for i, label in enumerate(engine.labels) if label != roll_no]
        removed_count = len(engine.labels) - len(indices_to_keep)

        if removed_count == 0 and not os.path.exists(student_dir):
            return {"success": False, "error": f"No embeddings or photos found for {roll_no}"}

        new_index = faiss.IndexFlatIP(EMBEDDING_DIM)
        if indices_to_keep and engine.index.ntotal > 0:
            all_embeddings = np.array([engine.index.reconstruct(i) for i in indices_to_keep], dtype=np.float32)
            new_index.add(all_embeddings)
        engine.labels = [engine.labels[i] for i in indices_to_keep]
        engine.index = new_index
        engine.save_index()

    photos_deleted = 0
    if os.path.exists(student_dir):
        photos_deleted = len([f for f in os.listdir(student_dir) if os.path.isfile(os.path.join(student_dir, f))])
        shutil.rmtree(student_dir)

    print(f"  [Registrar] Deleted {roll_no}: {removed_count} embeddings removed, {photos_deleted} photos deleted (index total: {engine.index.ntotal})")

    return {
        "success": True,
        "embeddings_removed": removed_count,
        "photos_deleted": photos_deleted,
        "index_total": engine.index.ntotal,
    }
