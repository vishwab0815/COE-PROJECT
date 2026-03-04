"""
Student Registration & Deletion — FAISS index and photo management.

Depends on the `FaceEngine` singleton from `face_engine.py` for model access.
"""

import os
import io
import shutil
import pickle
import numpy as np
import torch
import faiss
from PIL import Image
from torchvision import transforms

from app.services.face_engine import engine, IMAGE_SIZE, BASE_DIR, FAISS_INDEX_PATH, LABELS_PATH

# Hoisted preprocessing pipeline
_preprocess = transforms.Compose([
    transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize([0.5, 0.5, 0.5], [0.5, 0.5, 0.5])
])


def register_faces(roll_no: str, image_bytes_list: list[bytes]) -> dict:
    """
    Register a new student by processing multiple face images.
    Extracts embeddings, adds to FAISS index live, and persists to disk.
    """
    if not engine._initialized:
        return {"success": False, "error": "Engine not initialized"}

    student_dir = os.path.join(BASE_DIR, "processed_dataset", roll_no)
    os.makedirs(student_dir, exist_ok=True)

    new_embeddings = []
    images_saved = 0

    for i, img_bytes in enumerate(image_bytes_list):
        try:
            img = Image.open(io.BytesIO(img_bytes)).convert("RGB")

            save_path = os.path.join(student_dir, f"reg_{i}_orig.jpg")
            img.save(save_path, quality=95)
            images_saved += 1

            # Detect face with YOLO
            results = engine.yolo(img, conf=0.5, verbose=False)
            if len(results) == 0 or len(results[0].boxes) == 0:
                continue

            # Take best face
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

            # Generate embedding (FP16)
            face_tensor = face_tensor.unsqueeze(0).to(engine.device).half()
            with torch.no_grad():
                embedding = engine.resnet(face_tensor).float().cpu().numpy()

            norm = np.linalg.norm(embedding, axis=1, keepdims=True)
            if norm[0][0] == 0:
                continue
            embedding = (embedding / norm).astype(np.float32)
            new_embeddings.append(embedding[0])

        except Exception as e:
            print(f"  [Registrar] Registration frame {i} failed: {e}")
            continue

    if not new_embeddings:
        return {
            "success": False,
            "embeddings_added": 0,
            "total_images": len(image_bytes_list),
            "images_saved": images_saved,
            "error": "No faces detected in any of the captured images",
        }

    embeddings_matrix = np.array(new_embeddings, dtype=np.float32)
    engine.index.add(embeddings_matrix)

    for _ in new_embeddings:
        engine.labels.append(roll_no)

    faiss.write_index(engine.index, FAISS_INDEX_PATH)
    with open(LABELS_PATH, "wb") as f:
        pickle.dump(engine.labels, f)

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

    indices_to_keep = [i for i, label in enumerate(engine.labels) if label != roll_no]
    removed_count = len(engine.labels) - len(indices_to_keep)

    if removed_count == 0 and not os.path.exists(os.path.join(BASE_DIR, "processed_dataset", roll_no)):
        return {"success": False, "error": f"No embeddings or photos found for {roll_no}"}

    if indices_to_keep and engine.index.ntotal > 0:
        all_embeddings = np.array([engine.index.reconstruct(i) for i in indices_to_keep], dtype=np.float32)
        new_labels = [engine.labels[i] for i in indices_to_keep]
        new_index = faiss.IndexFlatIP(512)
        new_index.add(all_embeddings)
        engine.index = new_index
        engine.labels = new_labels
    else:
        engine.index = faiss.IndexFlatIP(512)
        engine.labels = []

    faiss.write_index(engine.index, FAISS_INDEX_PATH)
    with open(LABELS_PATH, "wb") as f:
        pickle.dump(engine.labels, f)

    student_dir = os.path.join(BASE_DIR, "processed_dataset", roll_no)
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
