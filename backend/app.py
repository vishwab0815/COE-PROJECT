"""
=============================================================================
  Attendance AI — FastAPI Backend
  --------------------------------
  Uvicorn entry point with lifespan management.
  
  Run:
    python -m uvicorn backend.app:app --host 0.0.0.0 --port 8000 --reload
=============================================================================
"""

import sys
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Fix Windows console encoding
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from .database import connect_db, close_db
from .face_engine import engine
from .seed import seed_students
from .routes import students, attendance


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle."""
    print("\n" + "=" * 60)
    print("  ATTENDANCE AI — Starting up...")
    print("=" * 60)

    # 1. Initialize face recognition engine (loads models on GPU)
    engine.initialize()

    # 2. Connect to MongoDB
    await connect_db()

    # 3. Seed students from metadata.csv
    await seed_students()

    print("=" * 60)
    print("  Server ready! Docs at http://localhost:8000/docs")
    print("=" * 60 + "\n")

    yield  # ← App runs here

    # Shutdown
    await close_db()
    print("  Server shut down cleanly.")


# ─── Create FastAPI app ──────────────────────────────────────────────────────
app = FastAPI(
    title="Attendance AI",
    description="Face recognition-based attendance system powered by FaceNet + FAISS + CUDA",
    version="1.0.0",
    lifespan=lifespan,
)

# ─── CORS (allow React frontend) ─────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Register routes ─────────────────────────────────────────────────────────
app.include_router(students.router)
app.include_router(attendance.router)


@app.get("/", tags=["Health"])
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "Attendance AI",
        "face_engine": "ready" if engine._initialized else "not loaded",
        "gpu": "cuda" if engine.device and engine.device.type == "cuda" else "cpu",
    }
