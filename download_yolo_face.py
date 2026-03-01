import urllib.request
import os

url = "https://github.com/lindevs/yolov8-face/releases/download/v0.0.0/yolov8s-face-lindevs.pt"
filename = "yolov8s-face.pt"

print(f"Downloading {filename} from {url}...")
urllib.request.urlretrieve(url, filename)
print(f"Successfully downloaded {filename} ({os.path.getsize(filename)/(1024*1024):.2f} MB)")
