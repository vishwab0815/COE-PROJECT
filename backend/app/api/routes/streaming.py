"""
Streaming routes — Video feed and stream control.
"""

import asyncio
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from app.services.stream_manager import streamer

router = APIRouter(tags=["Streaming"])


async def _generate_mjpeg():
    """
    Generator for streaming live MJPEG over HTTP.
    The capture thread encodes each frame once for all viewers; we just forward
    every new frame exactly once (no duplicate sends, no per-client encoding).
    """
    streamer.add_viewer()
    last_seq = -1
    try:
        while True:
            seq, frame_bytes = streamer.latest_jpeg()
            if frame_bytes and seq != last_seq:
                last_seq = seq
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
            await asyncio.sleep(0.01)
    finally:
        streamer.remove_viewer()  # client disconnected → stop encoding when nobody watches


@router.get("/video-feed")
async def video_feed():
    """SSE endpoint for Real-Time YOLO Tracking Video Feed."""
    return StreamingResponse(_generate_mjpeg(), media_type="multipart/x-mixed-replace; boundary=frame")


# Sync handlers: FastAPI runs them in the threadpool, so camera open/release
# (resume sleeps ~1s) never blocks the event loop.
@router.post("/stream/pause")
def pause_stream():
    """Temporarily halts the background CCTV Stream to release hardware camera."""
    streamer.pause()
    return {"message": "Background stream paused. Camera released."}


@router.post("/stream/resume")
def resume_stream():
    """Resumes the background CCTV Stream hardware camera."""
    streamer.resume()
    return {"message": "Background stream resumed."}
