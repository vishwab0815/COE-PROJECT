"""
Face Recognition Engine — CUDA-accelerated singleton.

Loads MTCNN + InceptionResnetV1 + FAISS index on GPU at startup,
exposes a `recognize(image_bytes)` method for real-time attendance.
"""

import os
import io
import pickle
import numpy as np
import faiss
import torch
from PIL import Image
from facenet_pytorch import MTCNN, InceptionResnetV1

# Base directory (attendance_ai/)
BASE_DIR = os.path.dirname(os.path.dirname(__file__))
FAISS_INDEX_PATH = os.path.join(BASE_DIR, "student_index.faiss")
LABELS_PATH = os.path.join(BASE_DIR, "labels.pkl")

IMAGE_SIZE = 160


class FaceEngine:
    """Singleton face recognition engine with GPU support."""

    def __init__(self):
        self.device = None
        self.mtcnn = None
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

        # ── MTCNN (face detection + alignment) ──
        self.mtcnn = MTCNN(
            image_size=IMAGE_SIZE,
            margin=20,
            min_face_size=20,
            thresholds=[0.6, 0.7, 0.7],
            factor=0.709,
            post_process=True,
            device=self.device,
            keep_all=False,
        )
        print("  [FaceEngine] MTCNN loaded")

        # ── InceptionResnetV1 (embedding model) ──
        self.resnet = InceptionResnetV1(pretrained="vggface2").eval().to(self.device)
        print("  [FaceEngine] InceptionResnetV1 loaded (vggface2)")

        # ── FAISS index ──
        self.index = faiss.read_index(FAISS_INDEX_PATH)
        print(f"  [FaceEngine] FAISS index loaded: {self.index.ntotal} vectors")

        # ── Labels ──
        with open(LABELS_PATH, "rb") as f:
            self.labels = pickle.load(f)
        print(f"  [FaceEngine] Labels loaded: {len(set(self.labels))} unique students")

        self._initialized = True
        print("  [FaceEngine] Ready for recognition")

    def recognize(self, image_bytes: bytes) -> tuple:
        """
        Recognize a face from raw image bytes.

        Returns:
            (roll_no: str | None, similarity: float | None, error: str | None)
        """
        if not self._initialized:
            return None, None, "Engine not initialized"

        try:
            # Load image
            img = Image.open(io.BytesIO(image_bytes)).convert("RGB")

            # Detect & align face
            face = self.mtcnn(img)
            if face is None:
                return None, None, "No face detected in the image"

            # Generate embedding on GPU
            face_tensor = face.unsqueeze(0).to(self.device)
            with torch.no_grad():
                embedding = self.resnet(face_tensor).cpu().numpy()

            # L2 normalize
            norm = np.linalg.norm(embedding, axis=1, keepdims=True)
            if norm[0][0] == 0:
                return None, None, "Invalid embedding (zero norm)"
            embedding = (embedding / norm).astype(np.float32)

            # FAISS search
            distances, indices = self.index.search(embedding, k=1)
            similarity = float(distances[0][0])
            matched_idx = int(indices[0][0])
            roll_no = self.labels[matched_idx]

            return roll_no, similarity, None

        except Exception as e:
            return None, None, f"Recognition error: {str(e)}"

    def register_faces(self, roll_no: str, image_bytes_list: list[bytes]) -> dict:
        """
        Register a new student by processing multiple face images.
        Extracts embeddings, adds to FAISS index live, and persists to disk.

        Returns:
            {"success": bool, "embeddings_added": int, "total_images": int,
             "images_saved": int, "error": str | None}
        """
        if not self._initialized:
            return {"success": False, "error": "Engine not initialized"}

        import os

        # Create dataset directory for this student
        student_dir = os.path.join(BASE_DIR, "processed_dataset", roll_no)
        os.makedirs(student_dir, exist_ok=True)

        new_embeddings = []
        images_saved = 0

        for i, img_bytes in enumerate(image_bytes_list):
            try:
                img = Image.open(io.BytesIO(img_bytes)).convert("RGB")

                # Save the raw image
                save_path = os.path.join(student_dir, f"reg_{i}_orig.jpg")
                img.save(save_path, quality=95)
                images_saved += 1

                # Detect & align face
                face = self.mtcnn(img)
                if face is None:
                    continue

                # Generate embedding on GPU
                face_tensor = face.unsqueeze(0).to(self.device)
                with torch.no_grad():
                    embedding = self.resnet(face_tensor).cpu().numpy()

                # L2 normalize
                norm = np.linalg.norm(embedding, axis=1, keepdims=True)
                if norm[0][0] == 0:
                    continue
                embedding = (embedding / norm).astype(np.float32)
                new_embeddings.append(embedding[0])

            except Exception as e:
                print(f"  [FaceEngine] Registration frame {i} failed: {e}")
                continue

        if not new_embeddings:
            return {
                "success": False,
                "embeddings_added": 0,
                "total_images": len(image_bytes_list),
                "images_saved": images_saved,
                "error": "No faces detected in any of the captured images",
            }

        # Stack into matrix and add to FAISS index
        embeddings_matrix = np.array(new_embeddings, dtype=np.float32)
        self.index.add(embeddings_matrix)

        # Extend labels
        for _ in new_embeddings:
            self.labels.append(roll_no)

        # Persist FAISS index and labels to disk
        faiss.write_index(self.index, FAISS_INDEX_PATH)
        with open(LABELS_PATH, "wb") as f:
            pickle.dump(self.labels, f)

        print(f"  [FaceEngine] Registered {roll_no}: {len(new_embeddings)} embeddings added (index total: {self.index.ntotal})")

        return {
            "success": True,
            "embeddings_added": len(new_embeddings),
            "total_images": len(image_bytes_list),
            "images_saved": images_saved,
            "error": None,
        }

    def delete_student(self, roll_no: str) -> dict:
        """
        Delete a student from FAISS index, labels, and their photo folder.
        Rebuilds the FAISS index without the target student's embeddings.
        """
        if not self._initialized:
            return {"success": False, "error": "Engine not initialized"}

        import shutil

        roll_no = roll_no.upper()

        # Count embeddings to remove
        indices_to_keep = [i for i, label in enumerate(self.labels) if label != roll_no]
        removed_count = len(self.labels) - len(indices_to_keep)

        if removed_count == 0 and not os.path.exists(os.path.join(BASE_DIR, "processed_dataset", roll_no)):
            return {"success": False, "error": f"No embeddings or photos found for {roll_no}"}

        # Rebuild FAISS index without deleted student
        if indices_to_keep and self.index.ntotal > 0:
            # Extract remaining embeddings
            all_embeddings = np.array([self.index.reconstruct(i) for i in indices_to_keep], dtype=np.float32)
            new_labels = [self.labels[i] for i in indices_to_keep]

            # Rebuild index
            new_index = faiss.IndexFlatIP(512)
            new_index.add(all_embeddings)
            self.index = new_index
            self.labels = new_labels
        else:
            # No embeddings left — create empty index
            self.index = faiss.IndexFlatIP(512)
            self.labels = []

        # Persist
        faiss.write_index(self.index, FAISS_INDEX_PATH)
        with open(LABELS_PATH, "wb") as f:
            pickle.dump(self.labels, f)

        # Delete photo folder
        student_dir = os.path.join(BASE_DIR, "processed_dataset", roll_no)
        photos_deleted = 0
        if os.path.exists(student_dir):
            photos_deleted = len([f for f in os.listdir(student_dir) if os.path.isfile(os.path.join(student_dir, f))])
            shutil.rmtree(student_dir)

        print(f"  [FaceEngine] Deleted {roll_no}: {removed_count} embeddings removed, {photos_deleted} photos deleted (index total: {self.index.ntotal})")

        return {
            "success": True,
            "embeddings_removed": removed_count,
            "photos_deleted": photos_deleted,
            "index_total": self.index.ntotal,
        }


# Global singleton instance
engine = FaceEngine()
