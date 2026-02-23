# 🎯 Attendance AI

> **AI-powered face recognition attendance system** built with FaceNet, FAISS, FastAPI, React, and CUDA GPU acceleration.

---

## 📌 What This Project Does

A student walks in front of a camera → their face is **detected, extracted, matched** against a database of known faces → attendance is **automatically marked** in MongoDB. All in **under 1 second**, powered by your GPU.

---

## 🧠 Key Technologies & How They Work

### 1. MTCNN (Multi-task Cascaded Convolutional Network)
**Purpose**: Detects and aligns faces in an image.

```
Raw Image → MTCNN → Cropped, aligned 160×160 face
```

- Uses 3 stages (P-Net, R-Net, O-Net) to progressively refine face detection
- Handles multiple faces, different angles, and varying lighting
- Outputs a **160×160 pixel aligned face** ready for embedding

### 2. FaceNet (InceptionResnetV1)
**Purpose**: Converts a face image into a **512-dimensional embedding vector**.

```
160×160 Face → InceptionResnetV1 → [0.023, -0.145, 0.089, ..., 0.056]  (512 numbers)
```

- Pretrained on **VGGFace2** dataset (3.3 million images, 9,131 identities)
- The key insight: **similar faces produce similar vectors**
- Two photos of the same person → vectors close together (high cosine similarity)
- Two different people → vectors far apart (low similarity)

### 3. L2 Normalization
**Purpose**: Normalize the 512D embedding to unit length.

```
embedding = embedding / ||embedding||
```

- After normalization, cosine similarity = inner product (dot product)
- Makes comparison faster and more numerically stable
- Similarity score ranges from 0 (different) to 1 (identical)

### 4. FAISS (Facebook AI Similarity Search)
**Purpose**: Ultra-fast nearest neighbor search across thousands of embeddings.

```
Query embedding → FAISS IndexFlatIP → Best match + similarity score
```

- We use `IndexFlatIP` (Inner Product) since embeddings are L2-normalized
- Searching 30,000+ vectors takes **< 1ms** (brute-force scan, exact results)
- Supports **incremental additions** — new students added without rebuilding
- Index is stored on disk (`student_index.faiss`) and loaded into RAM at startup

### 5. CUDA / GPU Acceleration
**Purpose**: Run MTCNN and FaceNet on the NVIDIA GPU for 10-50x speed.

- MTCNN face detection: runs on GPU
- InceptionResnetV1 inference: runs on GPU
- FAISS search: runs on CPU (still < 1ms, GPU not needed)
- Total recognition time per frame: **~100-200ms on GPU** vs ~2-5s on CPU

### 6. MongoDB Atlas (Cloud Database)
**Purpose**: Store student records and attendance logs.

- **Students collection**: roll_no, name, branch
- **Attendance collection**: roll_no, name, branch, date, time, status
- Indexes on `roll_no` (unique) and `(roll_no, date)` for fast lookups
- Duplicate prevention: same student can only be marked once per day

### 7. Motor (Async MongoDB Driver)
**Purpose**: Non-blocking database operations inside FastAPI.

- Uses `asyncio` so the server doesn't block while waiting for DB responses
- Multiple attendance requests can be processed concurrently

---

## 📐 Architecture

```
┌───────────────────────────────────────────────────┐
│               React Dashboard (Vite)              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ Camera   │ │ Students │ │Analytics │          │
│  │ (Webcam) │ │ (CRUD)   │ │ (Charts) │          │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘          │
│       │             │            │     Port 5173  │
└───────┼─────────────┼────────────┼────────────────┘
        │  HTTP/JSON  │            │
┌───────┼─────────────┼────────────┼────────────────┐
│       ▼             ▼            ▼     Port 8000  │
│               FastAPI Backend                     │
│  ┌──────────────────────────────────────────────┐ │
│  │ Face Engine (Singleton on GPU)               │ │
│  │  ┌────────┐   ┌──────────┐   ┌───────┐      │ │
│  │  │ MTCNN  │──▶│ FaceNet  │──▶│ FAISS │      │ │
│  │  │ (Detect)│  │(Embed512)│  │(Search)│      │ │
│  │  └────────┘   └──────────┘   └───────┘      │ │
│  └──────────────────────────────────────────────┘ │
│                      │                            │
│  ┌──────────────────────────────────────────────┐ │
│  │  MongoDB Atlas (Cloud)                       │ │
│  │  • students collection                       │ │
│  │  • attendance collection                     │ │
│  └──────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────┘
```

---

## 🔄 Data Processing Pipeline

### Initial Setup (one-time, ~12 min for 423 students)

```
Step 1: Raw images (LFW dataset)
         │
Step 2: MTCNN detects face → crops to 160×160
         │
Step 3: InceptionResnetV1 generates 512D embedding (on GPU)
         │
Step 4: L2 normalize each embedding
         │
Step 5: All embeddings → FAISS IndexFlatIP
         │
         ▼
   student_index.faiss (29,852 vectors)
   labels.pkl (maps vector index → roll_no)
```

**Why 12 minutes?** We processed ~48,000 images (423 students × ~114 images each including augmentations). Each image requires MTCNN detection + FaceNet inference = ~15ms per image on GPU.

### Live Recognition (real-time, < 200ms)

```
Camera frame
    │
    ▼
MTCNN → detect face → crop 160×160
    │
    ▼
FaceNet → 512D embedding
    │
    ▼
L2 normalize
    │
    ▼
FAISS search → nearest neighbor → roll_no + similarity
    │
    ▼
If similarity ≥ 0.65 → Mark attendance in MongoDB
```

### Live Registration (new student, ~5 seconds)

```
3-sec countdown → burst capture 15 frames (300ms apart)
    │
    ▼
For each frame:
  MTCNN → FaceNet → 512D embedding → normalize
    │
    ▼
~10-12 valid embeddings (some frames may fail detection)
    │
    ▼
FAISS index.add() → embeddings added to live index
    │
    ▼
labels.pkl updated → student immediately recognizable
    │
    ▼
MongoDB → student record created
```

---

## ❓ FAQ

### "If I had NO data and registered my face as the first student, would it work?"

**Yes, absolutely.** Here's what would happen:

1. You start with an **empty FAISS index** (0 vectors)
2. You register yourself via the camera → 15 frames captured → ~10-12 embeddings extracted
3. Those embeddings are **added to the FAISS index** → index now has 10-12 vectors, all labeled with your roll number
4. Next time the camera sees you → FAISS finds the nearest match → your embeddings → similarity ≈ 0.95+ → attendance marked

The only requirement: an empty FAISS index must exist first. The system can grow from 0 to any number of students entirely through the registration feature.

### "Why does initial training take 12 minutes but registration takes 5 seconds?"

| | Initial Training | Live Registration |
|---|---|---|
| **Images** | ~48,000 (6 per student × 423 students × augmentations) | 15 frames |
| **Purpose** | Build the full index from scratch | Add to existing index |
| **FAISS operation** | Create new `IndexFlatIP` | `index.add()` (append) |
| **Time** | ~12 min | ~3-5 sec |

### "What is the similarity threshold (0.65)?"

- `1.0` = identical (same image)
- `0.8–0.99` = very confident match (same person, different photo)
- `0.65–0.8` = likely match
- `< 0.65` = different person (rejected)

The threshold is configurable in `.env` (`SIMILARITY_THRESHOLD`).

---

## 📁 Project Structure

```
attendance_ai/
│
├── backend/                    # FastAPI server
│   ├── __init__.py            # Package marker (empty, required)
│   ├── app.py                 # Entry point, lifespan, CORS
│   ├── config.py              # Settings from .env
│   ├── database.py            # Async MongoDB (Motor)
│   ├── face_engine.py         # CUDA face recognition + registration
│   ├── models.py              # Pydantic schemas
│   ├── seed.py                # Seed students from metadata.csv
│   └── routes/
│       ├── __init__.py        # Package marker (empty, required)
│       ├── students.py        # Student CRUD + face registration
│       └── attendance.py      # Mark attendance + reports + CSV
│
├── frontend/                   # React dashboard (Vite)
│   ├── index.html             # Entry HTML (Plus Jakarta Sans font)
│   ├── package.json           # Node dependencies
│   ├── vite.config.js         # Proxy to backend
│   └── src/
│       ├── App.jsx            # Layout + sidebar + routing
│       ├── main.jsx           # React entry point
│       ├── index.css          # Design system (light vibrant theme)
│       ├── services/api.js    # API client wrapper
│       └── pages/
│           ├── Dashboard.jsx      # Live stats + activity feed
│           ├── CameraPage.jsx     # CCTV auto-scan + recognition modal
│           ├── RegisterPage.jsx   # Face registration with burst capture
│           ├── StudentsPage.jsx   # Searchable student directory
│           ├── AttendancePage.jsx  # Attendance logs + CSV export
│           └── AnalyticsPage.jsx  # Charts + branch breakdown
│
├── processed_dataset/          # Face images per student (created by registration)
├── student_index.faiss        # FAISS index (face embeddings)
├── labels.pkl                 # Maps embedding index → roll_no
├── requirements.txt           # Python dependencies
├── .env                       # MongoDB URI + config (gitignored)
├── .gitignore                 # Git ignore rules
└── README.md                  # This file
```

---

## 🚀 How to Run

### Prerequisites
- Python 3.10+ with CUDA-enabled PyTorch
- Node.js 18+
- NVIDIA GPU with CUDA drivers
- MongoDB Atlas account (free tier works)

### 1. Setup Environment
```bash
# Create virtual environment
python -m venv .cuda
.cuda\Scripts\activate          # Windows
# source .cuda/bin/activate     # Linux/Mac

# Install dependencies
cd attendance_ai
pip install -r requirements.txt

# For CUDA PyTorch (if not already installed):
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu128
```

### 2. Configure
```bash
# Create .env file in attendance_ai/
MONGO_URI=mongodb+srv://your_username:your_password@cluster.mongodb.net/?retryWrites=true&w=majority
DB_NAME=attendance_ai
SIMILARITY_THRESHOLD=0.65
```

### 3. Start Backend
```bash
cd attendance_ai
python -m uvicorn backend.app:app --host 0.0.0.0 --port 8000
```
> ⚠️ **Important**: You must `cd attendance_ai` first! Running from the parent directory causes `ModuleNotFoundError: No module named 'backend'`

### 4. Start Frontend (new terminal)
```bash
cd attendance_ai/frontend
npm install      # first time only
npm run dev
```

### 5. Open
- **Dashboard**: http://localhost:5173
- **API Docs**: http://localhost:8000/docs

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Health check (GPU status) |
| GET | `/students` | List students (search, filter, paginate) |
| GET | `/students/{roll_no}` | Get single student |
| POST | `/register` | Register student (JSON) |
| POST | `/register-with-face` | Register with camera (multipart) |
| POST | `/mark-attendance` | Upload image → recognize → log |
| GET | `/attendance-report` | Query attendance records |
| GET | `/attendance-report/csv` | Export as CSV |
| GET | `/attendance-stats` | Branch-wise statistics |

---

## 📊 Performance

| Metric | Value |
|--------|-------|
| Face detection + recognition | < 200ms per frame (GPU) |
| FAISS search (30K vectors) | < 1ms |
| Concurrent requests | Supported (async FastAPI) |
| GPU memory usage | ~1.5 GB |
| Index size on disk | ~60 MB (30K × 512D) |

---

## 🛠 Key Packages

| Package | Version | Purpose |
|---------|---------|---------|
| `torch` | 2.11+ (CUDA) | GPU-accelerated deep learning |
| `facenet-pytorch` | 2.6.0 | MTCNN + InceptionResnetV1 |
| `faiss-cpu` | 1.13.2 | Vector similarity search |
| `fastapi` | 0.131.0 | Async REST API |
| `motor` | 3.7.1 | Async MongoDB driver |
| `react` | 19.x | UI framework |
| `recharts` | 2.x | Charts and analytics |
| `react-webcam` | 7.x | Camera integration |
