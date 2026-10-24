import cv2
import os
import time
import asyncio
import numpy as np
import threading

from app.services.face_engine import engine, TRACKER_CFG
from app.services.recognizer import _preprocess
from app.core.database import get_db
from datetime import datetime
from app.core.config import settings
from app.core.constants import IST
import torch
from PIL import Image

# JPEG encode params (quality 80 for streaming — saves ~40% encode time vs default 95)
_JPEG_PARAMS = [int(cv2.IMWRITE_JPEG_QUALITY), 80]

# Drop on-screen boxes if inference hasn't refreshed them in this long (e.g. GPU busy registering)
_OVERLAY_TTL = 1.0


class StreamManager:
    """
    Manages background capturing from RTSP/Webcam, running ByteTrack,
    generating embeddings, and maintaining the similarity buffer.

    Two threads:
      • capture  — reads every camera frame, draws the latest detections on it and
                   JPEG-encodes it once (only while someone is watching). Video stays at
                   full camera FPS no matter how long inference takes.
      • inference — always works on the newest frame (stale frames are skipped, never
                   queued), so overlay latency stays at one inference step.

    Performance notes:
      1. FaceNet runs through CUDA graphs (engine.embed) — ~6x faster than eager.
      2. ByteTrack instead of BoT-SORT (no per-frame optical flow).
      3. Skip FaceNet for already-marked tracks (GPU time saved).
      4. One shared JPEG per frame for all viewers, instead of one encode per client per tick.
    """
    def __init__(self, src=0):
        self.src = src
        self.cap = None
        self.is_running = False
        self.paused = True
        self.thread = None            # capture thread
        self.infer_thread = None
        self.current_frame = None     # latest annotated frame (BGR)
        self._frame_lock = threading.Lock()

        # Capture → inference hand-off (newest frame only)
        self._raw_frame = None
        self._raw_seq = 0
        self._new_frame = threading.Event()

        # Inference → capture: what to draw, when it was produced, how long it took
        self._overlay = ([], 0.0, 0)

        # Shared JPEG for MJPEG clients
        self._jpeg = (0, b"")
        self._viewers = 0
        self._viewer_lock = threading.Lock()

        # ByteTrack Similarity Buffer
        # track_id -> {"similarities": [], "last_seen": float, "marked_roll": str | None,
        #              "current_roll": str | None, "verified_at": float}
        self.track_buffer = {}
        self.BUFFER_TIMEOUT = 15.0
        self.REQUIRED_HITS = 3        # consecutive confident frames (~0.1 s at 30 fps) before marking
        self.REVERIFY_SEC = 1.0       # re-check confirmed tracks this often (catches track-ID swaps)
        self.REVERIFY_SLACK = 0.10    # re-check bar = threshold - slack, so a confirmed label doesn't flicker

        # Cooldown map: roll_no -> timestamp (when was it marked today)
        self.last_scan_time = {}

        # Asyncio loop instance for delegating Motor DB saves natively
        self.main_loop = None

    def _open_capture(self):
        """Open the camera (DirectShow on Windows for webcams) with a minimal buffer."""
        if os.name == 'nt' and isinstance(self.src, int):
            cap = cv2.VideoCapture(self.src, cv2.CAP_DSHOW)
        else:
            cap = cv2.VideoCapture(self.src)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # Minimal buffer to reduce latency
        return cap

    def start(self):
        if self.is_running:
            return

        try:
            self.main_loop = asyncio.get_running_loop()
        except RuntimeError:
            pass

        if not self.paused:
            self.cap = self._open_capture()

        self.is_running = True
        self.thread = threading.Thread(target=self._update, daemon=True, name="stream-capture")
        self.infer_thread = threading.Thread(target=self._infer_loop, daemon=True, name="stream-infer")
        self.thread.start()
        self.infer_thread.start()
        print(f"  [StreamManager] Started capturing from {self.src}")

    def stop(self):
        self.is_running = False
        self._new_frame.set()  # wake inference thread so it can exit
        for t in (self.thread, self.infer_thread):
            if t:
                t.join(timeout=5)
        if self.cap:
            self.cap.release()
        print("  [StreamManager] Stopped capture.")

    def pause(self):
        self.paused = True
        if self.cap:
            self.cap.release()
            self.cap = None
        self._overlay = ([], 0.0, 0)
        print("  [StreamManager] Stream Paused, Hardware Released.")

    def resume(self):
        if not self.paused:
            return
        # Give the OS a moment to fully clear the lock from Chrome/React
        time.sleep(1.0)

        self.cap = self._open_capture()
        self.paused = False
        print("  [StreamManager] Stream Resumed.")

    # ── Viewers (MJPEG clients) ──────────────────────────────────────────────

    def add_viewer(self):
        with self._viewer_lock:
            self._viewers += 1

    def remove_viewer(self):
        with self._viewer_lock:
            self._viewers = max(0, self._viewers - 1)

    # ── Capture thread ───────────────────────────────────────────────────────

    def _update(self):
        """Background thread: read frames, hand newest to inference, render + encode."""
        while self.is_running:
            try:
                cap = self.cap  # local ref: pause() may release/clear self.cap concurrently
                if self.paused or cap is None:
                    time.sleep(0.5)
                    continue

                ret, frame = cap.read()
                if not ret:
                    if self.paused:
                        continue
                    # Device might be locked or lost. Try to re-acquire.
                    print("  [StreamManager] Frame read failed. Re-connecting camera...")
                    cap.release()
                    time.sleep(1.0)
                    if not self.paused:
                        self.cap = self._open_capture()
                    continue

                # Hand the clean frame to inference (cap.read() allocates a new array each call)
                self._raw_frame = frame
                self._raw_seq += 1
                self._new_frame.set()

                # Render latest detections onto a copy for display
                display = frame.copy()
                overlay, produced_at, latency_ms = self._overlay
                if time.time() - produced_at < _OVERLAY_TTL:
                    self._render(display, overlay)
                cv2.putText(display, f"Latency: {latency_ms}ms", (10, 30),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

                with self._frame_lock:
                    self.current_frame = display
                if self._viewers > 0:
                    ok, jpeg = cv2.imencode('.jpg', display, _JPEG_PARAMS)
                    if ok:
                        self._jpeg = (self._raw_seq, jpeg.tobytes())
            except Exception as e:
                import traceback
                print(f"  [StreamManager] Thread Exception: {e}")
                traceback.print_exc()
                time.sleep(0.5)

    # ── Inference thread ─────────────────────────────────────────────────────

    def _infer_loop(self):
        """Background thread: run the ML pipeline on the newest frame, publish the overlay."""
        last_seq = 0
        while self.is_running:
            if not self._new_frame.wait(timeout=0.5):
                continue
            self._new_frame.clear()
            seq, frame = self._raw_seq, self._raw_frame
            if self.paused or frame is None or seq == last_seq:
                continue
            last_seq = seq
            try:
                t0 = time.time()
                with engine.lock:
                    overlay = self._process_frame(frame)
                self._overlay = (overlay, time.time(), int((time.time() - t0) * 1000))
            except Exception as e:
                import traceback
                print(f"  [StreamManager] Inference Exception: {e}")
                traceback.print_exc()
                time.sleep(0.5)

    @staticmethod
    def _render(frame, overlay):
        for kind, data, color, text in overlay:
            if kind == "box":
                x1, y1, x2, y2 = data
                cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                cv2.putText(frame, text, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
            else:  # landmark point
                cv2.circle(frame, data, 2, color, -1)

    @staticmethod
    def _box(box, text, sim, color):
        return ("box", tuple(map(int, box)), color, f"{text} {sim:.2f}")

    def _process_frame(self, frame: np.ndarray) -> list:
        """Run ByteTrack + FaceNet + FAISS + Buffer Logic. Returns overlay items to draw."""
        overlay = []
        if not engine._initialized:
            return overlay

        # 1. YOLO-Face + ByteTrack
        results = engine.yolo.track(frame, persist=True, conf=0.5, verbose=False, tracker=TRACKER_CFG)
        if len(results) == 0 or len(results[0].boxes) == 0 or results[0].boxes.id is None:
            return overlay

        boxes = results[0].boxes.xyxy.cpu().numpy()
        track_ids = results[0].boxes.id.int().cpu().numpy()

        # Facial landmarks if the custom YOLO-Face model provides them (eyes, nose, mouth corners)
        if hasattr(results[0], 'keypoints') and results[0].keypoints is not None:
            for kps in results[0].keypoints.xy.cpu().numpy():
                for kp in kps:
                    x, y = int(kp[0]), int(kp[1])
                    if x > 0 and y > 0:
                        overlay.append(("point", (x, y), (0, 255, 0), None))

        # ── OPTIMIZATION: Identify already-marked tracks BEFORE doing FaceNet ──
        now_ts = time.time()

        # Purge stale tracks
        stale = [k for k, v in self.track_buffer.items() if now_ts - v["last_seen"] > self.BUFFER_TIMEOUT]
        for k in stale:
            del self.track_buffer[k]

        # Separate tracks into: needs_embedding vs already_resolved.
        # Confirmed tracks are re-checked every REVERIFY_SEC: ByteTrack can hand a track ID
        # to a different person (someone steps into the same spot), and without this the
        # newcomer would silently inherit the previous person's name.
        tracks_needing_embedding = []  # (box_idx, track_id)

        for box_idx, (box, t_id) in enumerate(zip(boxes, track_ids)):
            tb = self.track_buffer.get(t_id)
            if tb and tb["marked_roll"] and now_ts - tb["verified_at"] < self.REVERIFY_SEC:
                # Recently confirmed — just draw green box, skip expensive embedding
                overlay.append(self._box(box, tb["marked_roll"], tb["similarities"][-1] if tb["similarities"] else 0.0, (0, 255, 0)))
                tb["last_seen"] = now_ts
            else:
                tracks_needing_embedding.append((box_idx, t_id))

        if not tracks_needing_embedding:
            return overlay  # All tracks already resolved — zero GPU work needed!

        # 2. Extract crops ONLY for unresolved / due-for-recheck tracks
        valid_crops = []
        valid_tracks = []
        valid_box_indices = []

        h_img, w_img = frame.shape[:2]
        img_pil = None  # converted lazily, once, only if some face is big enough

        for box_idx, t_id in tracks_needing_embedding:
            x1, y1, x2, y2 = map(int, boxes[box_idx])

            w = x2 - x1
            h = y2 - y1
            if w < 40 or h < 40:  # Ignore tiny faces
                continue

            if img_pil is None:
                img_pil = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))

            # 10% Padding
            padx, pady = int(w * 0.1), int(h * 0.1)
            crop = img_pil.crop((max(0, x1 - padx), max(0, y1 - pady), min(w_img, x2 + padx), min(h_img, y2 + pady)))
            valid_crops.append(_preprocess(crop))
            valid_tracks.append(t_id)
            valid_box_indices.append(box_idx)

        if not valid_crops:
            return overlay

        # 3. Batch Tensor -> embeddings (FP16, CUDA graph)
        embeddings = engine.embed(torch.stack(valid_crops))

        norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
        valid_mask = norms.flatten() > 0
        embeddings = embeddings[valid_mask]
        valid_tracks = [t for i, t in enumerate(valid_tracks) if valid_mask[i]]
        valid_box_indices = [b for i, b in enumerate(valid_box_indices) if valid_mask[i]]

        if len(embeddings) == 0:
            return overlay

        embeddings = (embeddings / norms[valid_mask]).astype(np.float32)

        # 4. Batch FAISS (nothing to match against until a student is enrolled)
        matches = engine.match(embeddings)
        if matches is None:
            for box_idx in valid_box_indices:
                overlay.append(self._box(boxes[box_idx], "Unknown", 0.0, (0, 0, 255)))
            return overlay

        # 5. Process tracking buffer for unresolved tracks
        threshold = settings.SIMILARITY_THRESHOLD
        for (roll_no, sim, ambiguous), t_id, box_idx in zip(matches, valid_tracks, valid_box_indices):
            box = boxes[box_idx]
            if roll_no is None:
                continue

            # Initialise track buffer
            if t_id not in self.track_buffer:
                self.track_buffer[t_id] = {"similarities": [], "last_seen": now_ts, "marked_roll": None,
                                           "current_roll": roll_no, "verified_at": 0.0}

            tb = self.track_buffer[t_id]
            tb["last_seen"] = now_ts

            # Re-verification of an already-confirmed track (slightly looser bar → no flicker)
            if tb["marked_roll"]:
                if roll_no == tb["marked_roll"] and not ambiguous and sim >= threshold - self.REVERIFY_SLACK:
                    tb["verified_at"] = now_ts
                    tb["similarities"] = [sim]
                    overlay.append(self._box(box, roll_no, sim, (0, 255, 0)))
                    continue
                # Different person now holds this track → drop the old name, start over
                tb.update(marked_roll=None, similarities=[], current_roll=None)

            # A face that could be either of two students is never counted as a hit
            if ambiguous:
                tb["similarities"] = []
                overlay.append(self._box(box, "Unsure", sim, (0, 165, 255)))
                continue

            # If track changed identity wildly, reset (e.g. occlusion swap)
            if tb["current_roll"] != roll_no:
                tb["current_roll"] = roll_no
                tb["similarities"] = []

            tb["similarities"].append(sim)
            if len(tb["similarities"]) > self.REQUIRED_HITS:
                tb["similarities"].pop(0)

            if len(tb["similarities"]) < self.REQUIRED_HITS:
                overlay.append(self._box(box, "Analyzing...", sim, (0, 255, 255)))
                continue

            # Every hit in the window must clear the bar (one lucky frame can't carry the average)
            avg_sim = sum(tb["similarities"]) / len(tb["similarities"])
            if min(tb["similarities"]) >= threshold:
                # MARK ATTENDANCE!
                tb["marked_roll"] = roll_no
                tb["verified_at"] = now_ts
                overlay.append(self._box(box, roll_no, avg_sim, (0, 255, 0)))
                # Dispatch async log task non-blockingly
                if self.main_loop:
                    asyncio.run_coroutine_threadsafe(self._log_attendance(roll_no), self.main_loop)
            else:
                overlay.append(self._box(box, "Unknown", avg_sim, (0, 0, 255)))

        return overlay

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
            # Minimum Cooldown Check (2 hours) to prevent bounce effect
            login_time_str = existing.get("login_time")
            if login_time_str:
                login_time_obj = datetime.strptime(today_date + " " + login_time_str, "%Y-%m-%d %H:%M:%S").replace(tzinfo=IST)
                if (now - login_time_obj).total_seconds() < 2 * 3600:
                    return # Cooldown active, ignore this scan entirely

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
        """Latest annotated frame as JPEG (shared cache while viewers are connected)."""
        seq, jpeg = self._jpeg
        if jpeg and seq == self._raw_seq:
            return jpeg
        with self._frame_lock:
            frame = self.current_frame
        if frame is None:
            return b""
        ret, jpeg = cv2.imencode('.jpg', frame, _JPEG_PARAMS)
        return jpeg.tobytes() if ret else b""

    def latest_jpeg(self) -> tuple[int, bytes]:
        """(frame sequence, JPEG bytes) — lets MJPEG clients send each frame exactly once."""
        return self._jpeg


streamer = StreamManager(src=settings.camera_source)
