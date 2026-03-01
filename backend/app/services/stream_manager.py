import cv2
import os
import time
import asyncio
import numpy as np
import threading
from typing import Iterator
from fastapi.responses import StreamingResponse

from app.services.face_engine import engine
from app.core.database import get_db
from datetime import datetime, timezone, timedelta
from app.core.config import settings
import torch

IST = timezone(timedelta(hours=5, minutes=30))

class StreamManager:
    """
    Manages background capturing from RTSP/Webcam, running ByteTrack,
    generating embeddings, and maintaining the similarity buffer.
    """
    def __init__(self, src=0):
        self.src = src
        self.cap = None
        self.is_running = False
        self.paused = False
        self.thread = None
        self.current_frame = None
        
        # ByteTrack Similarity Buffer
        # track_id -> {"similarities": [], "last_seen": float, "marked_roll": str | None}
        self.track_buffer = {}
        self.BUFFER_TIMEOUT = 15.0
        self.REQUIRED_HITS = 2
        
        # Cooldown map: roll_no -> timestamp (when was it marked today)
        self.last_scan_time = {}
        
        # Asyncio loop instance for delegating Motor DB saves natively
        self.main_loop = None

    def start(self):
        if self.is_running:
            return
            
        try:
            self.main_loop = asyncio.get_running_loop()
        except RuntimeError:
            pass
        
        if os.name == 'nt':
            self.cap = cv2.VideoCapture(self.src, cv2.CAP_DSHOW)
        else:
            self.cap = cv2.VideoCapture(self.src)
            
        self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 2)
        
        self.is_running = True
        self.thread = threading.Thread(target=self._update, daemon=True)
        self.thread.start()
        print(f"  [StreamManager] Started capturing from {self.src}")

    def stop(self):
        self.is_running = False
        if self.thread:
            self.thread.join()
        if self.cap:
            self.cap.release()
        print("  [StreamManager] Stopped capture.")

    def pause(self):
        self.paused = True
        if self.cap:
            self.cap.release()
            self.cap = None
        print("  [StreamManager] Stream Paused, Hardware Released.")

    def resume(self):
        if not self.paused:
            return
        # Give the OS a moment to fully clear the lock from Chrome/React
        time.sleep(1.0)
        
        if os.name == 'nt':
            self.cap = cv2.VideoCapture(self.src, cv2.CAP_DSHOW)
        else:
            self.cap = cv2.VideoCapture(self.src)
            
        self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 2)
        self.paused = False
        print("  [StreamManager] Stream Resumed.")

    def _update(self):
        """Background thread reading frames and running ML."""
        frame_idx = 0
        while self.is_running:
            try:
                if self.paused or self.cap is None:
                    time.sleep(0.5)
                    continue
                    
                ret, frame = self.cap.read()
                if not ret:
                    # Device might be locked or lost. Try to re-acquire.
                    print("  [StreamManager] Frame read failed. Re-connecting camera...")
                    self.cap.release()
                    time.sleep(1.0)
                    if os.name == 'nt':
                        self.cap = cv2.VideoCapture(self.src, cv2.CAP_DSHOW)
                    else:
                        self.cap = cv2.VideoCapture(self.src)
                    self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 2)
                    continue
                    
                frame_idx += 1
                
                # Process every single frame purely on the GPU to ensure ByteTrack doesn't lose IoU continuity.
                t0 = time.time()
                self._process_frame(frame)
                t1 = time.time()
                
                # Draw stats
                latency_ms = int((t1 - t0) * 1000)
                cv2.putText(frame, f"Latency: {latency_ms}ms", (10, 30), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
                
                self.current_frame = frame
            except Exception as e:
                import traceback
                print(f"  [StreamManager] Thread Exception: {e}")
                traceback.print_exc()
                time.sleep(0.5)

    def _process_frame(self, frame: np.ndarray):
        """Run ByteTrack + FaceNet + FAISS + Buffer Logic."""
        if not engine._initialized:
            return
            
        # 1. YOLO-Face + ByteTrack
        results = engine.yolo.track(frame, persist=True, conf=0.5, verbose=False)
        if len(results) == 0 or len(results[0].boxes) == 0 or results[0].boxes.id is None:
            return
            
        boxes = results[0].boxes.xyxy.cpu().numpy()
        track_ids = results[0].boxes.id.int().cpu().numpy()
        
        # Extract facial landmarks if the custom YOLO-Face model provides them
        keypoints = None
        if hasattr(results[0], 'keypoints') and results[0].keypoints is not None:
            keypoints = results[0].keypoints.xy.cpu().numpy()
            
            # Draw the 5 facial landmarks (eyes, nose, mouth corners)
            for kps in keypoints:
                for kp in kps:
                    x, y = int(kp[0]), int(kp[1])
                    if x > 0 and y > 0:
                        cv2.circle(frame, (x, y), 2, (0, 255, 0), -1)
        
        valid_crops = []
        valid_tracks = []
        
        img = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        h_img, w_img, _ = img.shape
        
        from torchvision import transforms
        from PIL import Image
        preprocess = transforms.Compose([
            transforms.Resize((160, 160)),
            transforms.ToTensor(),
            transforms.Normalize([0.5, 0.5, 0.5], [0.5, 0.5, 0.5])
        ])
        
        img_pil = Image.fromarray(img)
        
        # 2. Extract crops
        for box, t_id in zip(boxes, track_ids):
            x1, y1, x2, y2 = map(int, box)
            
            w = x2 - x1
            h = y2 - y1
            if w < 40 or h < 40: # Ignore tiny faces
                continue
                
            # 10% Padding
            padx, pady = int(w * 0.1), int(h * 0.1)
            x1 = max(0, x1 - padx)
            y1 = max(0, y1 - pady)
            x2 = min(w_img, x2 + padx)
            y2 = min(h_img, y2 + pady)
            
            crop = img_pil.crop((x1, y1, x2, y2))
            valid_crops.append(preprocess(crop))
            valid_tracks.append(t_id)
            
        if not valid_crops:
            return
            
        # 3. Batch Tensor -> embeddings (FP16)
        batch_tensor = torch.stack(valid_crops).to(engine.device).half()
        with torch.no_grad():
            embeddings = engine.resnet(batch_tensor).float().cpu().numpy()
            
        norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
        valid_mask = norms.flatten() > 0
        embeddings = embeddings[valid_mask]
        valid_tracks = [t for i, t in enumerate(valid_tracks) if valid_mask[i]]
        
        if len(embeddings) == 0:
            return
            
        embeddings = (embeddings / norms[valid_mask]).astype(np.float32)
        
        # 4. Batch FAISS
        distances, indices = engine.index.search(embeddings, k=1)
        
        # 5. Process tracking buffer
        now_ts = time.time()
        
        # Purge stale tracks
        stale = [k for k, v in self.track_buffer.items() if now_ts - v["last_seen"] > self.BUFFER_TIMEOUT]
        for k in stale:
            del self.track_buffer[k]
            
        for i in range(len(embeddings)):
            sim = float(distances[i][0])
            idx = int(indices[i][0])
            t_id = valid_tracks[i]
            
            if idx < 0 or idx >= len(engine.labels):
                continue
            roll_no = engine.labels[idx]
            
            # Initialise track buffer
            if t_id not in self.track_buffer:
                self.track_buffer[t_id] = {"similarities": [], "last_seen": now_ts, "marked_roll": None, "current_roll": roll_no}
                
            tb = self.track_buffer[t_id]
            tb["last_seen"] = now_ts
            
            # If track changed identity wildly, reset (e.g. occlusion swap)
            if tb["current_roll"] != roll_no:
                tb["current_roll"] = roll_no
                tb["similarities"] = []
                
            tb["similarities"].append(sim)
            if len(tb["similarities"]) > self.REQUIRED_HITS:
                tb["similarities"].pop(0)
                
            # If already marked this track ID, draw green and skip
            if tb["marked_roll"]:
                self._draw_box(frame, boxes[i], tb["marked_roll"], sim, (0, 255, 0))
                continue
                
            if len(tb["similarities"]) < self.REQUIRED_HITS:
                self._draw_box(frame, boxes[i], "Analyzing...", sim, (0, 255, 255))
                continue
                
            # Check avg similarity
            avg_sim = sum(tb["similarities"]) / len(tb["similarities"])
            if avg_sim >= settings.SIMILARITY_THRESHOLD:
                # MARK ATTENDANCE!
                tb["marked_roll"] = roll_no
                self._draw_box(frame, boxes[i], roll_no, avg_sim, (0, 255, 0))
                # Dispatch async log task non-blockingly to maintain continuous video feed tracking grid
                if self.main_loop:
                    asyncio.run_coroutine_threadsafe(self._log_attendance(roll_no), self.main_loop)
            else:
                self._draw_box(frame, boxes[i], "Unknown", avg_sim, (0, 0, 255))

    def _draw_box(self, frame, box, text, sim, color):
        x1, y1, x2, y2 = map(int, box)
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
        cv2.putText(frame, f"{text} {sim:.2f}", (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

    async def _log_attendance(self, roll_no: str):
        """Writes to MongoDB tracking IN/OUT and Shift scheduling."""
        now = datetime.now(IST)
        now_ts = now.timestamp()
        today_date = now.strftime("%Y-%m-%d")
        
        # 5-minute cooldown to prevent database spam and ghost triggers
        if roll_no in self.last_scan_time and (now_ts - self.last_scan_time[roll_no]) < 300:
            return
            
        self.last_scan_time[roll_no] = now_ts
        
        db = get_db()
        student = await db.students.find_one({"roll_no": roll_no})
        if not student:
            return
            
        existing = await db.attendance.find_one({"roll_no": roll_no, "date": today_date})
        
        # Fetch dynamic settings
        config_doc = await db.settings.find_one({"_id": "global_config"})
        sys_login = config_doc["login_time"] if config_doc and "login_time" in config_doc else getattr(settings, "LOGIN_TIME", "09:30:00")
        sys_logout = config_doc["logout_time"] if config_doc and "logout_time" in config_doc else getattr(settings, "LOGOUT_TIME", "16:30:00")
        
        time_str = now.strftime("%H:%M:%S")
        
        if not existing:
            # Login Event
            login_thresh = datetime.strptime(today_date + " " + sys_login, "%Y-%m-%d %H:%M:%S").replace(tzinfo=IST)
            status = "On Time" if now <= login_thresh else "Late"
            
            await db.attendance.insert_one({
                "roll_no": roll_no,
                "name": student["name"],
                "branch": student["branch"],
                "date": today_date,
                "login_time": time_str,
                "login_status": status,
                "logout_time": None,
                "logout_status": None
            })
            msg = f"{student['name']} Logged In ({status})"
            print(f"  [StreamManager] LOGIN: {msg}")
        else:
            # Logout Event
            logout_thresh = datetime.strptime(today_date + " " + sys_logout, "%Y-%m-%d %H:%M:%S").replace(tzinfo=IST)
            status = "Logged Out" if now >= logout_thresh else "Early Logout"
            
            await db.attendance.update_one(
                {"_id": existing["_id"]},
                {"$set": {"logout_time": time_str, "logout_status": status}}
            )
            msg = f"{student['name']} {status}"
            print(f"  [StreamManager] LOGOUT: {msg}")
        
        # Add to global recent memory for frontend notification polling
        from app.api.routes.attendance import recent_marks
        recent_marks.append({
            "roll_no": roll_no, 
            "name": student["name"], 
            "message": msg,
            "timestamp": time.time()
        })
        if len(recent_marks) > 20:
            recent_marks.pop(0)

    def get_frame_jpeg(self) -> bytes:
        if self.current_frame is None:
            return b""
        ret, jpeg = cv2.imencode('.jpg', self.current_frame)
        if not ret:
            return b""
        return jpeg.tobytes()

streamer = StreamManager(src=0)
