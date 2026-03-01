"""
Face Recognition Engine — CUDA-accelerated singleton.

Loads MTCNN + InceptionResnetV1 + FAISS index on GPU at startup,
exposes `recognize()` for single-face and `recognize_multi()` for
batch multi-face recognition (60-70 faces per frame).
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
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
FAISS_INDEX_PATH = os.path.join(BASE_DIR, "student_index.faiss")
LABELS_PATH = os.path.join(BASE_DIR, "labels.pkl")

IMAGE_SIZE = 160


class FaceEngine:
    """Singleton face recognition engine with GPU support."""

    def __init__(self):
        self.device = None
        self.mtcnn_single = None   # keep_all=False (registration)
        self.mtcnn_multi = None    # keep_all=True (multi-face detection)
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

        # ── YOLOv8 — Multi face (for batch recognition) ──
        from ultralytics import YOLO
        # Using custom yolov8n-face (detects only faces, high precision). 
        self.yolo = YOLO("yolov8n-face.pt")
        self.yolo.to(self.device)
        print("  [FaceEngine] MTCNN (single) + YOLOv8 (multi) loaded")

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
        print("  [FaceEngine] Ready for recognition (single + multi-face)")

    # ═══════════════════════════════════════════════════════
    #  SINGLE-FACE RECOGNITION (backward compatible)
    # ═══════════════════════════════════════════════════════

    def recognize(self, image_bytes: bytes) -> tuple:
        """
        Recognize a single face from raw image bytes.

        Returns:
            (roll_no: str | None, similarity: float | None, error: str | None)
        """
        if not self._initialized:
            return None, None, "Engine not initialized"

        try:
            img = Image.open(io.BytesIO(image_bytes)).convert("RGB")

            # Detect face with YOLO
            results = self.yolo(img, conf=0.5, verbose=False)
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
            
            from torchvision import transforms
            preprocess = transforms.Compose([
                transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
                transforms.ToTensor(),
                transforms.Normalize([0.5, 0.5, 0.5], [0.5, 0.5, 0.5])
            ])
            face_tensor = preprocess(crop)

            # Generate embedding on GPU (FP16)
            face_tensor = face_tensor.unsqueeze(0).to(self.device).half()
            with torch.no_grad():
                embedding = self.resnet(face_tensor).float().cpu().numpy()

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

    # ═══════════════════════════════════════════════════════
    #  MULTI-FACE RECOGNITION (batch GPU pipeline)
    # ═══════════════════════════════════════════════════════

    def recognize_multi(self, image_bytes: bytes) -> dict:
        """
        Recognize ALL faces in an image using batch GPU processing with YOLO.

        Pipeline:
            1. YOLO detects all persons (class 0)
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
        if not self._initialized:
            return {"faces_detected": 0, "faces_recognized": 0, "results": [], "error": "Engine not initialized"}

        try:
            img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            img_np = np.array(img)

            # ── Step 1: Detect with YOLO-Face ──
            # Run inference. conf=0.5
            results = self.yolo(img, conf=0.5, verbose=False)
            
            if len(results) == 0 or len(results[0].boxes) == 0:
                return {"faces_detected": 0, "faces_recognized": 0, "results": [], "error": None}

            boxes = results[0].boxes.xyxy.cpu().numpy() # [N, 4] bounding boxes
            
            faces_detected = len(boxes)
            if faces_detected == 0:
                return {"faces_detected": 0, "faces_recognized": 0, "results": [], "error": None}

            # ── Step 2: Crop & Resize (160x160) ──
            from torchvision import transforms
            # Resnet expects tensors in [-1, 1], similar to MTCNN output
            preprocess = transforms.Compose([
                transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
                transforms.ToTensor(),
                # InceptionResnetV1 expects input normalized around 0 with std 1
                transforms.Normalize([0.5, 0.5, 0.5], [0.5, 0.5, 0.5])
            ])

            valid_face_tensors = []
            
            for box in boxes:
                x1, y1, x2, y2 = map(int, box)
                # Ensure bounds
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
                face_tensor = preprocess(crop)
                valid_face_tensors.append(face_tensor)

            if len(valid_face_tensors) == 0:
                 return {"faces_detected": faces_detected, "faces_recognized": 0, "results": [], "error": None}

            # ── Step 3: Batch tensor (N, 3, 160, 160) FP16 ──
            batch_tensor = torch.stack(valid_face_tensors).to(self.device).half()

            # ── Step 4: Single GPU forward pass ──
            with torch.no_grad():
                embeddings = self.resnet(batch_tensor).float().cpu().numpy()  # (N, 512)

            # ── Step 5: L2 normalize entire batch ──
            norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
            valid_mask = norms.flatten() > 0
            embeddings = embeddings[valid_mask]
            norms = norms[valid_mask]
            embeddings = (embeddings / norms).astype(np.float32)

            if len(embeddings) == 0:
                return {"faces_detected": faces_detected, "faces_recognized": 0, "results": [], "error": None}

            # ── Step 6: Batch FAISS search ──
            distances, indices = self.index.search(embeddings, k=1)

            # ── Step 7: Per-frame dedup ──
            best_matches = {}  # roll_no -> similarity
            for i in range(len(embeddings)):
                similarity = float(distances[i][0])
                matched_idx = int(indices[i][0])

                if matched_idx < 0 or matched_idx >= len(self.labels):
                    continue

                roll_no = self.labels[matched_idx]

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

    # ═══════════════════════════════════════════════════════
    #  REGISTRATION (unchanged — uses single-face MTCNN)
    # ═══════════════════════════════════════════════════════

    def register_faces(self, roll_no: str, image_bytes_list: list[bytes]) -> dict:
        """
        Register a new student by processing multiple face images.
        Extracts embeddings, adds to FAISS index live, and persists to disk.
        """
        if not self._initialized:
            return {"success": False, "error": "Engine not initialized"}

        import os

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
                results = self.yolo(img, conf=0.5, verbose=False)
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

                from torchvision import transforms
                preprocess = transforms.Compose([
                    transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
                    transforms.ToTensor(),
                    transforms.Normalize([0.5, 0.5, 0.5], [0.5, 0.5, 0.5])
                ])
                face_tensor = preprocess(crop)

                # Generate embedding (FP16)
                face_tensor = face_tensor.unsqueeze(0).to(self.device).half()
                with torch.no_grad():
                    embedding = self.resnet(face_tensor).float().cpu().numpy()

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

        embeddings_matrix = np.array(new_embeddings, dtype=np.float32)
        self.index.add(embeddings_matrix)

        for _ in new_embeddings:
            self.labels.append(roll_no)

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

    # ═══════════════════════════════════════════════════════
    #  DELETION (unchanged)
    # ═══════════════════════════════════════════════════════

    def delete_student(self, roll_no: str) -> dict:
        """Delete a student from FAISS index, labels, and their photo folder."""
        if not self._initialized:
            return {"success": False, "error": "Engine not initialized"}

        import shutil

        roll_no = roll_no.upper()

        indices_to_keep = [i for i, label in enumerate(self.labels) if label != roll_no]
        removed_count = len(self.labels) - len(indices_to_keep)

        if removed_count == 0 and not os.path.exists(os.path.join(BASE_DIR, "processed_dataset", roll_no)):
            return {"success": False, "error": f"No embeddings or photos found for {roll_no}"}

        if indices_to_keep and self.index.ntotal > 0:
            all_embeddings = np.array([self.index.reconstruct(i) for i in indices_to_keep], dtype=np.float32)
            new_labels = [self.labels[i] for i in indices_to_keep]
            new_index = faiss.IndexFlatIP(512)
            new_index.add(all_embeddings)
            self.index = new_index
            self.labels = new_labels
        else:
            self.index = faiss.IndexFlatIP(512)
            self.labels = []

        faiss.write_index(self.index, FAISS_INDEX_PATH)
        with open(LABELS_PATH, "wb") as f:
            pickle.dump(self.labels, f)

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
