"""
Student routes — GET /students, POST /register, POST /register-with-face, DELETE /students/{roll_no}
"""

import re
from fastapi import APIRouter, HTTPException, Query, UploadFile, File, Form
from fastapi.concurrency import run_in_threadpool
from typing import Optional
from app.core.database import get_db
from app.services.registrar import register_faces, delete_student as engine_delete
from app.models.schemas import StudentCreate, StudentOut

router = APIRouter(tags=["Students"])

# Roll numbers double as folder names under processed_dataset/
_ROLL_NO_RE = re.compile(r"^[A-Z0-9_-]{1,32}$")


def _validate_roll_no(roll_no: str) -> str:
    roll_no = roll_no.strip().upper()
    if not _ROLL_NO_RE.match(roll_no):
        raise HTTPException(status_code=422, detail="Roll number may only contain letters, digits, '-' and '_' (max 32)")
    return roll_no


@router.get("/students", response_model=list[StudentOut])
async def list_students(
    branch: Optional[str] = Query(None, description="Filter by branch (CSE, ECE, ME, EEE, CIVIL, ISE)"),
    search: Optional[str] = Query(None, description="Search by name or roll number"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
):
    """List all students with optional branch filter and search."""
    db = get_db()
    query = {}

    if branch:
        query["branch"] = branch.upper()

    if search:
        pattern = re.escape(search)
        query["$or"] = [
            {"name": {"$regex": pattern, "$options": "i"}},
            {"roll_no": {"$regex": pattern, "$options": "i"}},
        ]

    cursor = db.students.find(query, {"_id": 0}).skip(skip).limit(limit).sort("roll_no", 1)
    students = await cursor.to_list(length=limit)
    return students


@router.get("/students/{roll_no}", response_model=StudentOut)
async def get_student(roll_no: str):
    """Get a single student by roll number."""
    db = get_db()
    student = await db.students.find_one({"roll_no": roll_no.upper()}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail=f"Student {roll_no} not found")
    return student


@router.post("/register", response_model=StudentOut, status_code=201)
async def register_student(student: StudentCreate):
    """Register a new student."""
    db = get_db()

    roll_no = _validate_roll_no(student.roll_no)

    # Check if already exists
    existing = await db.students.find_one({"roll_no": roll_no})
    if existing:
        raise HTTPException(status_code=409, detail=f"Student {roll_no} already exists")

    doc = {
        "roll_no": roll_no,
        "name": student.name.strip(),
        "branch": student.branch.upper(),
    }
    await db.students.insert_one(doc)
    return StudentOut(**doc)


@router.post("/register-with-face", status_code=201)
async def register_with_face(
    roll_no: str = Form(...),
    name: str = Form(...),
    branch: str = Form(...),
    files: list[UploadFile] = File(..., description="Multiple face images from burst capture"),
):
    """
    Register a new student with live face capture.
    Receives student info + burst-captured images, processes on GPU,
    updates FAISS index live, and registers in MongoDB.
    """
    db = get_db()
    roll_no = _validate_roll_no(roll_no)
    name = name.strip()
    branch = branch.strip().upper()
    if not name or not branch:
        raise HTTPException(status_code=422, detail="Name and branch are required")

    # Check if already exists
    existing = await db.students.find_one({"roll_no": roll_no})
    if existing:
        raise HTTPException(status_code=409, detail=f"Student {roll_no} already registered")

    # Read all image bytes
    image_bytes_list = []
    for f in files:
        data = await f.read()
        if data:
            image_bytes_list.append(data)

    if not image_bytes_list:
        raise HTTPException(status_code=400, detail="No images received")

    # Process faces on GPU and update FAISS index
    result = await run_in_threadpool(register_faces, roll_no, image_bytes_list)

    if not result["success"]:
        raise HTTPException(status_code=422, detail=result["error"])

    # Save student to MongoDB
    doc = {"roll_no": roll_no, "name": name, "branch": branch}
    await db.students.insert_one(doc)

    return {
        "success": True,
        "roll_no": roll_no,
        "name": name,
        "branch": branch,
        "embeddings_added": result["embeddings_added"],
        "total_images": result["total_images"],
        "images_saved": result["images_saved"],
        "message": f"Registered {name} ({roll_no}) with {result['embeddings_added']} face embeddings",
    }


@router.delete("/students/{roll_no}")
async def delete_student(roll_no: str):
    """
    Delete a student completely:
    - Remove from MongoDB (students + attendance records)
    - Remove from FAISS index (embeddings)
    - Delete their photo folder from processed_dataset/
    """
    db = get_db()
    roll_no = roll_no.upper()

    # Check if student exists in DB
    student = await db.students.find_one({"roll_no": roll_no})
    if not student:
        raise HTTPException(status_code=404, detail=f"Student {roll_no} not found")

    # Delete from FAISS index + photos
    face_result = await run_in_threadpool(engine_delete, roll_no)

    # Delete from MongoDB
    await db.students.delete_one({"roll_no": roll_no})
    att_result = await db.attendance.delete_many({"roll_no": roll_no})

    return {
        "success": True,
        "roll_no": roll_no,
        "name": student.get("name", ""),
        "embeddings_removed": face_result.get("embeddings_removed", 0),
        "photos_deleted": face_result.get("photos_deleted", 0),
        "attendance_records_deleted": att_result.deleted_count,
        "message": f"Deleted {student.get('name', roll_no)} — {face_result.get('embeddings_removed', 0)} embeddings, {face_result.get('photos_deleted', 0)} photos removed",
    }
