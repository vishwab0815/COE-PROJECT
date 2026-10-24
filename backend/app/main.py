"""
=============================================================================
  Attendance AI — FastAPI Backend
  --------------------------------
  Uvicorn entry point with lifespan management.

  Production (serves the built React app from frontend/dist on the same port):
    python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1

  Development (React served by Vite on :5173, proxying /api here):
    python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

  NOTE: always run a single worker — the camera, YOLO tracker state and the
  FAISS index live in-process and cannot be shared across workers.
=============================================================================
"""

import sys
import os

# Cap BLAS/OpenMP threads BEFORE numpy/faiss/torch load. On a 24-thread CPU OpenBLAS
# otherwise reserves ~3.7 GB of commit for per-thread buffers; our CPU math (tiny
# normalizations, FAISS on a few thousand vectors) gains nothing from more threads.
for _var in ("OPENBLAS_NUM_THREADS", "OMP_NUM_THREADS", "MKL_NUM_THREADS"):
    os.environ.setdefault(_var, "2")

from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, APIRouter, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

# Fix Windows console encoding
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from app.core.config import settings
from app.core.database import connect_db, close_db
from app.core.security import require_admin
from app.services.face_engine import engine
from app.seed import seed_students
from app.api.routes import auth, students, attendance, streaming, reports, settings as settings_routes
from app.services.stream_manager import streamer


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle."""
    print("\n" + "=" * 60)
    print("  ATTEND-AI — Starting up...")
    print("=" * 60)

    # 1. Initialize face recognition engine (loads models on GPU)
    engine.initialize()

    # 2. Connect to MongoDB
    await connect_db()

    # 3. Seed students from metadata.csv
    await seed_students()

    # 4. Start background video capture & AI logic
    streamer.start()

    if settings.ADMIN_PIN == "1234":
        print("  [Auth] WARNING: ADMIN_PIN is the default '1234' — set it in .env for production")

    print("=" * 60)
    print("  Server ready! Docs at http://localhost:8000/docs")
    print("=" * 60 + "\n")

    yield  # ← App runs here

    # Shutdown
    streamer.stop()
    await close_db()
    print("  Server shut down cleanly.")


# ─── Create FastAPI app ──────────────────────────────────────────────────────
app = FastAPI(
    title="Attendance AI",
    description="Face recognition-based attendance system powered by FaceNet + FAISS + CUDA",
    version="1.0.0",
    lifespan=lifespan,
)

# ─── CORS (only needed when the frontend is served from another origin) ──────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Register routes under /api ──────────────────────────────────────────────
api = APIRouter(prefix="/api")


@api.get("/", tags=["Health"])
@api.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "Attendance AI",
        "face_engine": "ready" if engine._initialized else "not loaded",
        "gpu": "cuda" if engine.device and engine.device.type == "cuda" else "cpu",
        "enrolled_vectors": engine.index.ntotal if engine.index is not None else 0,
    }


# Public: login + kiosk endpoints (live feed, stream control, recognition, toasts)
api.include_router(auth.router)
api.include_router(attendance.router)
api.include_router(streaming.router)

# Admin-only: student management, reports, shift settings
admin = [Depends(require_admin)]
api.include_router(students.router, dependencies=admin)
api.include_router(reports.router, dependencies=admin)
api.include_router(settings_routes.router, dependencies=admin)

app.include_router(api)


# ─── Serve the built React app (production) ──────────────────────────────────
FRONTEND_DIST = settings.path(settings.FRONTEND_DIST)

if os.path.isdir(FRONTEND_DIST):
    _assets = os.path.join(FRONTEND_DIST, "assets")
    if os.path.isdir(_assets):
        app.mount("/assets", StaticFiles(directory=_assets), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa(full_path: str):
        """Serve static files from dist/, falling back to index.html for client-side routes."""
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not Found")
        candidate = os.path.realpath(os.path.join(FRONTEND_DIST, full_path))
        if full_path and candidate.startswith(os.path.realpath(FRONTEND_DIST)) and os.path.isfile(candidate):
            return FileResponse(candidate)
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"), headers={"Cache-Control": "no-cache"})
