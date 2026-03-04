"""
Attendance marking routes — POST /mark-attendance, /mark-attendance-multi, /recent-marked.
"""

import time
from datetime import datetime
from fastapi import APIRouter, HTTPException, UploadFile, File
from app.core.database import get_db
from app.core.config import settings
from app.core.constants import IST
from app.services.recognizer import recognize, recognize_multi
from app.models.schemas import RecognitionResult, MultiRecognitionResult

# --- Global Tracking Buffer (for multi-face marking) ---
track_buffer = {}
BUFFER_TIMEOUT = 15.0  # seconds before purging
REQUIRED_HITS = 2

# Live notifications for the frontend toaster
recent_marks = []

router = APIRouter(tags=["Attendance"])


@router.post("/mark-attendance", response_model=RecognitionResult)
async def mark_attendance(file: UploadFile = File(..., description="Image file with a face")):
    """
    Upload an image to mark attendance.
    Pipeline: Image -> YOLO -> FaceNet -> FAISS search -> MongoDB log
    """
    # Validate file type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image (JPEG, PNG, etc.)")

    # Read image bytes
    image_bytes = await file.read()
    if len(image_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty file uploaded")

    # Run face recognition (GPU-accelerated)
    roll_no, similarity, error = recognize(image_bytes)

    # Handle no face detected
    if error:
        return RecognitionResult(
            success=False,
            status="No Face Detected" if "No face" in error else "Error",
            message=error,
        )

    # Check similarity threshold
    if similarity < settings.SIMILARITY_THRESHOLD:
        return RecognitionResult(
            success=False,
            roll_no=roll_no,
            similarity=round(similarity, 4),
            status="No Match",
            message=f"Best match {roll_no} with similarity {similarity:.4f} is below threshold {settings.SIMILARITY_THRESHOLD}",
        )

    # Lookup student info from DB
    db = get_db()
    student = await db.students.find_one({"roll_no": roll_no}, {"_id": 0})

    if not student:
        return RecognitionResult(
            success=False,
            roll_no=roll_no,
            similarity=round(similarity, 4),
            status="Error",
            message=f"Student {roll_no} found in FAISS but not in database",
        )

    # Get current date/time in IST
    now = datetime.now(IST)
    today_date = now.strftime("%Y-%m-%d")
    current_time = now.strftime("%H:%M:%S")

    # Check if already marked today
    existing = await db.attendance.find_one({
        "roll_no": roll_no,
        "date": today_date,
    })

    # Fetch dynamic settings
    config_doc = await db.settings.find_one({"_id": "global_config"})
    sys_login = config_doc["login_time"] if config_doc and "login_time" in config_doc else getattr(settings, "LOGIN_TIME", "09:30:00")
    sys_logout = config_doc["logout_time"] if config_doc and "logout_time" in config_doc else getattr(settings, "LOGOUT_TIME", "16:30:00")

    if existing:
        # Minimum Cooldown Check (2 hours) to prevent bounce effect
        login_time_str = existing.get("login_time")
        if login_time_str:
            login_time_obj = datetime.strptime(today_date + " " + login_time_str, "%Y-%m-%d %H:%M:%S").replace(tzinfo=IST)
            if (now - login_time_obj).total_seconds() < 2 * 3600:
                return RecognitionResult(
                    success=True,
                    roll_no=roll_no,
                    name=student["name"],
                    branch=student["branch"],
                    similarity=round(similarity, 4),
                    status="Already Marked",
                    message=f"{student['name']} already checked in (Cooldown Active)",
                )

        # LOGOUT
        logout_thresh = datetime.strptime(today_date + " " + sys_logout, "%Y-%m-%d %H:%M:%S").replace(tzinfo=IST)
        status = "Logged Out" if now >= logout_thresh else "Early Logout"
        
        await db.attendance.update_one(
            {"_id": existing["_id"]},
            {"$set": {"logout_time": current_time, "logout_status": status}}
        )
        return RecognitionResult(
            success=True,
            roll_no=roll_no,
            name=student["name"],
            branch=student["branch"],
            similarity=round(similarity, 4),
            status=status,
            message=f"Attendance updated for {student['name']} ({status})",
        )

    # LOGIN
    login_thresh = datetime.strptime(today_date + " " + sys_login, "%Y-%m-%d %H:%M:%S").replace(tzinfo=IST)
    status = "On Time" if now <= login_thresh else "Late"

    attendance_doc = {
        "roll_no": roll_no,
        "name": student["name"],
        "branch": student["branch"],
        "date": today_date,
        "login_time": current_time,
        "login_status": status,
        "logout_time": None,
        "logout_status": None,
    }
    await db.attendance.insert_one(attendance_doc)

    return RecognitionResult(
        success=True,
        roll_no=roll_no,
        name=student["name"],
        branch=student["branch"],
        similarity=round(similarity, 4),
        status=status,
        message=f"Attendance marked for {student['name']} ({status})",
    )


@router.post("/mark-attendance-multi", response_model=MultiRecognitionResult)
async def mark_attendance_multi(file: UploadFile = File(..., description="Image file with one or more faces")):
    """
    Upload an image to mark attendance for ALL detected faces.
    Pipeline: Image -> YOLO -> Batch FaceNet -> Batch FAISS -> MongoDB per student
    """
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image (JPEG, PNG, etc.)")

    image_bytes = await file.read()
    if len(image_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty file uploaded")

    # Run multi-face recognition (GPU batch pipeline)
    multi_result = recognize_multi(image_bytes)

    if multi_result["error"]:
        return MultiRecognitionResult(
            success=False, faces_detected=0, faces_recognized=0,
            results=[], message=multi_result["error"],
        )

    if multi_result["faces_detected"] == 0:
        return MultiRecognitionResult(
            success=False, faces_detected=0, faces_recognized=0,
            results=[], message="No faces detected in the image",
        )

    # Process each recognized face
    db = get_db()

    # Fetch dynamic settings
    config_doc = await db.settings.find_one({"_id": "global_config"})
    sys_login = config_doc["login_time"] if config_doc and "login_time" in config_doc else getattr(settings, "LOGIN_TIME", "09:30:00")
    sys_logout = config_doc["logout_time"] if config_doc and "logout_time" in config_doc else getattr(settings, "LOGOUT_TIME", "16:30:00")

    now = datetime.now(IST)
    today_date = now.strftime("%Y-%m-%d")
    current_time = now.strftime("%H:%M:%S")

    individual_results = []

    # Clean up old tracks
    now_ts = time.time()
    expired = [k for k, v in track_buffer.items() if now_ts - v["last_seen"] > BUFFER_TIMEOUT]
    for k in expired:
        del track_buffer[k]

    for match in multi_result["results"]:
        roll_no = match["roll_no"]
        similarity = match["similarity"]

        # 1. Update similarity buffer
        if roll_no not in track_buffer:
            track_buffer[roll_no] = {"similarities": [], "last_seen": now_ts}

        track_buffer[roll_no]["similarities"].append(similarity)
        track_buffer[roll_no]["last_seen"] = now_ts

        # Keep only the latest `REQUIRED_HITS` frames
        if len(track_buffer[roll_no]["similarities"]) > REQUIRED_HITS:
            track_buffer[roll_no]["similarities"].pop(0)

        # 2. Check if we have enough hits
        if len(track_buffer[roll_no]["similarities"]) < REQUIRED_HITS:
            continue

        # 3. Check if average similarity meets threshold
        avg_sim = sum(track_buffer[roll_no]["similarities"]) / len(track_buffer[roll_no]["similarities"])
        if avg_sim < settings.SIMILARITY_THRESHOLD:
            continue

        # Lookup student
        student = await db.students.find_one({"roll_no": roll_no}, {"_id": 0})
        if not student:
            continue

        # Check if already marked today
        existing = await db.attendance.find_one({"roll_no": roll_no, "date": today_date})

        if existing:
            # Minimum Cooldown Check (2 hours)
            login_time_str = existing.get("login_time")
            if login_time_str:
                login_time_obj = datetime.strptime(today_date + " " + login_time_str, "%Y-%m-%d %H:%M:%S").replace(tzinfo=IST)
                if (now - login_time_obj).total_seconds() < 2 * 3600:
                    individual_results.append(RecognitionResult(
                        success=True, roll_no=roll_no, name=student["name"],
                        branch=student["branch"], similarity=round(similarity, 4),
                        status="Already Marked",
                        message=f"{student['name']} already checked in (Cooldown Active)",
                    ))
                    continue

            # LOGOUT
            logout_thresh = datetime.strptime(today_date + " " + sys_logout, "%Y-%m-%d %H:%M:%S").replace(tzinfo=IST)
            status = "Logged Out" if now >= logout_thresh else "Early Logout"

            await db.attendance.update_one(
                {"_id": existing["_id"]},
                {"$set": {"logout_time": current_time, "logout_status": status}}
            )

            individual_results.append(RecognitionResult(
                success=True, roll_no=roll_no, name=student["name"],
                branch=student["branch"], similarity=round(similarity, 4),
                status=status,
                message=f"{student['name']} {status} at {current_time}",
            ))
            continue

        # LOGIN
        login_thresh = datetime.strptime(today_date + " " + sys_login, "%Y-%m-%d %H:%M:%S").replace(tzinfo=IST)
        status = "On Time" if now <= login_thresh else "Late"

        await db.attendance.insert_one({
            "roll_no": roll_no, "name": student["name"], "branch": student["branch"],
            "date": today_date, "login_time": current_time, "login_status": status,
            "logout_time": None, "logout_status": None,
        })

        individual_results.append(RecognitionResult(
            success=True, roll_no=roll_no, name=student["name"],
            branch=student["branch"], similarity=round(similarity, 4),
            status=status,
            message=f"{student['name']} Logged In ({status})",
        ))

    newly_marked = sum(1 for r in individual_results if r.status == "Present")
    already_marked = sum(1 for r in individual_results if r.status == "Already Marked")

    return MultiRecognitionResult(
        success=True,
        faces_detected=multi_result["faces_detected"],
        faces_recognized=len(individual_results),
        results=individual_results,
        message=f"{newly_marked} marked, {already_marked} already marked, {multi_result['faces_detected']} faces detected",
    )


@router.get("/recent-marked")
async def get_recent_marked():
    """Endpoint for the frontend to poll for live toast notifications."""
    return {"recent": recent_marks[-10:]}
