"""
Streaming routes — Video feed and stream control.
"""

import asyncio
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from app.services.stream_manager import streamer

router = APIRouter(tags=["Streaming"])


async def _generate_mjpeg():
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
    return StreamingResponse(_generate_mjpeg(), media_type="multipart/x-mixed-replace; boundary=frame")


@router.post("/stream/pause")
async def pause_stream():
    """Temporarily halts the background CCTV Stream to release hardware camera."""
    streamer.pause()
    return {"message": "Background stream paused. Camera released."}


@router.post("/stream/resume")
async def resume_stream():
    """Resumes the background CCTV Stream hardware camera."""
    streamer.resume()
    return {"message": "Background stream resumed."}
