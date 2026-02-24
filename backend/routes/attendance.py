"""
Attendance routes — POST /mark-attendance, GET /attendance-report
"""

import io
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from typing import Optional
from ..database import get_db
from ..face_engine import engine
from ..config import settings
from ..models import RecognitionResult, MultiRecognitionResult, AttendanceRecord

router = APIRouter(tags=["Attendance"])

# IST timezone
IST = timezone(timedelta(hours=5, minutes=30))


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

    if existing:
        return RecognitionResult(
            success=True,
            roll_no=roll_no,
            name=student["name"],
            branch=student["branch"],
            similarity=round(similarity, 4),
            status="Already Marked",
            message=f"Attendance already marked for {student['name']} ({roll_no}) at {existing['time']}",
        )

    # Log attendance
    attendance_doc = {
        "roll_no": roll_no,
        "name": student["name"],
        "branch": student["branch"],
        "date": today_date,
        "time": current_time,
        "status": "Present",
    }
    await db.attendance.insert_one(attendance_doc)

    return RecognitionResult(
        success=True,
        roll_no=roll_no,
        name=student["name"],
        branch=student["branch"],
        similarity=round(similarity, 4),
        status="Present",
        message=f"Attendance marked for {student['name']} ({roll_no})",
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
    now = datetime.now(IST)
    today_date = now.strftime("%Y-%m-%d")
    current_time = now.strftime("%H:%M:%S")

    individual_results = []

    for match in multi_result["results"]:
        roll_no = match["roll_no"]
        similarity = match["similarity"]

        # Check threshold
        if similarity < settings.SIMILARITY_THRESHOLD:
            continue

        # Lookup student
        student = await db.students.find_one({"roll_no": roll_no}, {"_id": 0})
        if not student:
            continue

        # Check if already marked today
        existing = await db.attendance.find_one({"roll_no": roll_no, "date": today_date})

        if existing:
            individual_results.append(RecognitionResult(
                success=True,
                roll_no=roll_no,
                name=student["name"],
                branch=student["branch"],
                similarity=round(similarity, 4),
                status="Already Marked",
                message=f"Already marked at {existing['time']}",
            ))
            continue

        # Mark attendance
        await db.attendance.insert_one({
            "roll_no": roll_no,
            "name": student["name"],
            "branch": student["branch"],
            "date": today_date,
            "time": current_time,
            "status": "Present",
        })

        individual_results.append(RecognitionResult(
            success=True,
            roll_no=roll_no,
            name=student["name"],
            branch=student["branch"],
            similarity=round(similarity, 4),
            status="Present",
            message=f"Attendance marked for {student['name']}",
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
        .sort([("date", -1), ("time", -1)])
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

    cursor = db.attendance.find(query, {"_id": 0}).sort([("date", -1), ("time", -1)])
    records = await cursor.to_list(length=10000)

    # Build CSV
    lines = ["Roll No,Name,Branch,Date,Time,Status"]
    for r in records:
        lines.append(f"{r['roll_no']},{r['name']},{r['branch']},{r['date']},{r['time']},{r['status']}")

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
