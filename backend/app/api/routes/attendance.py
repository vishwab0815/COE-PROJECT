"""
Attendance routes — POST /mark-attendance, GET /attendance-report
"""

import io
import time
import asyncio
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from typing import Optional
from app.core.database import get_db
from app.services.face_engine import engine
from app.core.config import settings
from app.services.stream_manager import streamer
from app.models.models import RecognitionResult, MultiRecognitionResult, AttendanceRecord, ShiftConfig

# --- Global Tracking Buffer ---
track_buffer = {}
BUFFER_TIMEOUT = 15.0 # seconds before purging
REQUIRED_HITS = 2
# ------------------------------

# Live notifications for the frontend toaster
recent_marks = []

router = APIRouter(tags=["Attendance"])

# IST timezone
IST = timezone(timedelta(hours=5, minutes=30))

async def generate_video_stream():
    """Generator for streaming live MJPEG over HTTP."""
    while True:
        frame_bytes = streamer.get_frame_jpeg()
        if frame_bytes:
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        await asyncio.sleep(0.03)  # ~30fps

@router.get("/video-feed")
async def video_feed():
    """SSE endpoint for Real-Time YOLO Tracking Video Feed."""
    return StreamingResponse(generate_video_stream(), media_type="multipart/x-mixed-replace; boundary=frame")


@router.get("/shift-config", response_model=ShiftConfig)
async def get_shift_config():
    """Get the current dynamic shift login/logout boundaries."""
    db = get_db()
    config = await db.settings.find_one({"_id": "global_config"})
    if config:
        return ShiftConfig(login_time=config.get("login_time", "09:30:00"), logout_time=config.get("logout_time", "16:30:00"))
    return ShiftConfig(login_time=getattr(settings, "LOGIN_TIME", "09:30:00"), logout_time=getattr(settings, "LOGOUT_TIME", "16:30:00"))


@router.post("/shift-config")
async def update_shift_config(config: ShiftConfig):
    """Update global shift settings instantly without rebooting server."""
    db = get_db()
    await db.settings.update_one(
        {"_id": "global_config"},
        {"$set": {"login_time": config.login_time, "logout_time": config.logout_time}},
        upsert=True
    )
    return {"message": "Shift configuration updated successfully!"}


@router.post("/mark-attendance", response_model=RecognitionResult)
async def mark_attendance(file: UploadFile = File(..., description="Image file with a face")):
    """
    Upload an image to mark attendance.
    Pipeline: Image -> MTCNN -> FaceNet -> FAISS search -> MongoDB log
    """
    # Validate file type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image (JPEG, PNG, etc.)")

    # Read image bytes
    image_bytes = await file.read()
    if len(image_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty file uploaded")

    # Run face recognition (GPU-accelerated)
    roll_no, similarity, error = engine.recognize(image_bytes)

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
    Pipeline: Image -> MTCNN (keep_all) -> Batch FaceNet -> Batch FAISS -> MongoDB per student
    Handles 60-70 faces per frame using GPU batch processing.
    """
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image (JPEG, PNG, etc.)")

    image_bytes = await file.read()
    if len(image_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty file uploaded")

    # Run multi-face recognition (GPU batch pipeline)
    multi_result = engine.recognize_multi(image_bytes)

    if multi_result["error"]:
        return MultiRecognitionResult(
            success=False,
            faces_detected=0,
            faces_recognized=0,
            results=[],
            message=multi_result["error"],
        )

    if multi_result["faces_detected"] == 0:
        return MultiRecognitionResult(
            success=False,
            faces_detected=0,
            faces_recognized=0,
            results=[],
            message="No faces detected in the image",
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
            continue # Need more frames to confirm identity

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
            # LOGOUT
            logout_thresh = datetime.strptime(today_date + " " + sys_logout, "%Y-%m-%d %H:%M:%S").replace(tzinfo=IST)
            status = "Logged Out" if now >= logout_thresh else "Early Logout"
            
            await db.attendance.update_one(
                {"_id": existing["_id"]},
                {"$set": {"logout_time": current_time, "logout_status": status}}
            )
            
            individual_results.append(RecognitionResult(
                success=True,
                roll_no=roll_no,
                name=student["name"],
                branch=student["branch"],
                similarity=round(similarity, 4),
                status=status,
                message=f"{student['name']} {status} at {current_time}",
            ))
            continue

        # LOGIN
        login_thresh = datetime.strptime(today_date + " " + sys_login, "%Y-%m-%d %H:%M:%S").replace(tzinfo=IST)
        status = "On Time" if now <= login_thresh else "Late"
        
        await db.attendance.insert_one({
            "roll_no": roll_no,
            "name": student["name"],
            "branch": student["branch"],
            "date": today_date,
            "login_time": current_time,
            "login_status": status,
            "logout_time": None,
            "logout_status": None,
        })

        individual_results.append(RecognitionResult(
            success=True,
            roll_no=roll_no,
            name=student["name"],
            branch=student["branch"],
            similarity=round(similarity, 4),
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


@router.post("/stream/pause")
async def pause_stream():
    """Temporarily halts the background CCTV Stream to release hardware camera."""
    from app.services.stream_manager import streamer
    streamer.pause()
    return {"message": "Background stream paused. Camera released."}

@router.post("/stream/resume")
async def resume_stream():
    """Resumes the background CCTV Stream hardware camera."""
    from app.services.stream_manager import streamer
    streamer.resume()
    return {"message": "Background stream resumed."}


@router.get("/attendance-report", response_model=list[AttendanceRecord])
async def get_attendance_report(
    date: Optional[str] = Query(None, description="Filter by date (YYYY-MM-DD)"),
    roll_no: Optional[str] = Query(None, description="Filter by roll number"),
    branch: Optional[str] = Query(None, description="Filter by branch"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
):
    """Get attendance records with optional filters."""
    db = get_db()
    query = {}

    if date:
        query["date"] = date
    if roll_no:
        query["roll_no"] = roll_no.upper()
    if branch:
        query["branch"] = branch.upper()

    cursor = (
        db.attendance.find(query, {"_id": 0})
        .sort([("date", -1), ("login_time", -1)])
        .skip(skip)
        .limit(limit)
    )
    records = await cursor.to_list(length=limit)
    return records


@router.get("/attendance-report/csv")
async def export_attendance_csv(
    date: Optional[str] = Query(None, description="Filter by date (YYYY-MM-DD)"),
    branch: Optional[str] = Query(None, description="Filter by branch"),
):
    """Export attendance report as CSV file."""
    db = get_db()
    query = {}

    if date:
        query["date"] = date
    if branch:
        query["branch"] = branch.upper()

    cursor = db.attendance.find(query, {"_id": 0}).sort([("date", -1), ("login_time", -1)])
    records = await cursor.to_list(length=10000)

    # Build CSV
    lines = ["Roll No,Name,Branch,Date,Login Time,Login Status,Logout Time,Logout Status"]
    for r in records:
        lines.append(f"{r['roll_no']},{r['name']},{r['branch']},{r['date']},{r.get('login_time', '')},{r.get('login_status', '')},{r.get('logout_time', '')},{r.get('logout_status', '')}")

    csv_content = "\n".join(lines)
    filename = f"attendance_report_{date or 'all'}.csv"

    return StreamingResponse(
        io.StringIO(csv_content),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/attendance-stats")
async def get_attendance_stats(
    date: Optional[str] = Query(None, description="Date for stats (YYYY-MM-DD), defaults to today"),
    branch: Optional[str] = Query(None, description="Filter by branch"),
):
    """Get attendance statistics — total present, percentage, branch-wise breakdown."""
    db = get_db()

    if not date:
        date = datetime.now(IST).strftime("%Y-%m-%d")

    # Total students
    student_query = {}
    if branch:
        student_query["branch"] = branch.upper()
    total_students = await db.students.count_documents(student_query)

    # Present today
    attendance_query = {"date": date}
    if branch:
        attendance_query["branch"] = branch.upper()
    present_count = await db.attendance.count_documents(attendance_query)

    # Branch-wise breakdown
    pipeline = [
        {"$match": {"date": date}},
        {"$group": {"_id": "$branch", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]
    branch_stats = {}
    async for doc in db.attendance.aggregate(pipeline):
        branch_stats[doc["_id"]] = doc["count"]

    # Per-branch totals
    branch_totals_pipeline = [
        {"$group": {"_id": "$branch", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]
    branch_totals = {}
    async for doc in db.students.aggregate(branch_totals_pipeline):
        branch_totals[doc["_id"]] = doc["count"]

    # Compute percentages
    branch_breakdown = {}
    for b in branch_totals:
        present = branch_stats.get(b, 0)
        total = branch_totals[b]
        branch_breakdown[b] = {
            "present": present,
            "total": total,
            "percentage": round(present / total * 100, 1) if total > 0 else 0,
        }

    return {
        "date": date,
        "total_students": total_students,
        "present": present_count,
        "absent": total_students - present_count,
        "percentage": round(present_count / total_students * 100, 1) if total_students > 0 else 0,
        "branch_breakdown": branch_breakdown,
    }

@router.get("/recent-marked")
async def get_recent_marked():
    """Endpoint for the frontend to poll for live toast notifications."""
    # Return the last 10 marks
    return {"recent": recent_marks[-10:]}
