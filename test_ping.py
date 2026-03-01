import asyncio
import httpx
import sys

async def test_buffer():
    print("Testing multi-face endpoint hit buffer...")
    # Read a sample image (the yolo face or any file, just to get bytes)
    # We will just post a test image 3 times. If face not detected it will still tell us the server is up.
    try:
        with open("yolov8n-face.pt", "rb") as f:
            file_bytes = f.read(1024) # just dummy bytes to see if endpoint rejects bad image or processes
            
        async with httpx.AsyncClient() as client:
            files = {'file': ('test.jpg', file_bytes, 'image/jpeg')}
            res = await client.post("http://localhost:8000/mark-attendance-multi", files=files)
            print("Response:", res.status_code, res.json())
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    asyncio.run(test_buffer())
