# 🧠 Attend-AI

> **AI-powered face recognition attendance system** built with FaceNet, FAISS, FastAPI, React, and CUDA GPU acceleration. Award-winning glassmorphism interface with real-time analytics.

---

## 📌 What This Project Does

A student walks in front of a camera → their face is **detected, extracted, matched** against a database of known faces → attendance is **automatically marked** in MongoDB. All in **under 1 second**, powered by your GPU.

---

## ⚡ Quick Start (How to Run)

### Prerequisites

| Requirement | Version |
|-------------|---------|
| Python | 3.10+ |
| Node.js | 18+ |
| NVIDIA GPU | CUDA-capable with drivers installed |
| MongoDB Atlas | Free tier works fine |

### Step 1 — Clone & Setup Python Environment

```bash
# Clone the repository
git clone https://github.com/your-username/attendance_ai.git
cd attendance_ai

# Create a virtual environment
python -m venv .cuda

# Activate it
.cuda\Scripts\activate          # Windows (PowerShell)
# source .cuda/bin/activate     # Linux / Mac
```

### Step 2 — Install Python Dependencies

```bash
# Install requirements
pip install -r requirements.txt

# Install PyTorch with CUDA support (if not already)
# Visit https://pytorch.org/get-started/locally/ for the correct command
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu128
```

### Step 3 — Configure Environment Variables

Create a `.env` file inside the `attendance_ai/` folder:

```env
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/?retryWrites=true&w=majority
DB_NAME=attendance_ai
SIMILARITY_THRESHOLD=0.65
```

> Replace `<username>` and `<password>` with your MongoDB Atlas credentials.

### Step 4 — Start the Backend

```bash
cd attendance_ai
python -m uvicorn backend.app:app --host 0.0.0.0 --port 8000
```

> ⚠️ **Important**: You **must** run this from inside the `attendance_ai/` directory, not the parent folder. Otherwise you'll get `ModuleNotFoundError: No module named 'backend'`.

You should see:
```
═══════════════════════════════════════
  ATTEND-AI — Starting up...
═══════════════════════════════════════
  [FaceEngine] Device: cuda (NVIDIA GeForce RTX ...)
  [FaceEngine] Ready for recognition
```

### Step 5 — Start the Frontend (new terminal)

```bash
cd attendance_ai/frontend
npm install      # first time only
npm run dev
```

### Step 6 — Open the App

| URL | What |
|-----|------|
| **http://localhost:5173** | Dashboard (Frontend) |
| **http://localhost:8000/docs** | API Documentation (Swagger) |

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

---

## 🎨 Design System

The UI is built with an **Awwwards-grade** glassmorphism design:

- **Teal/Emerald** primary palette (`#0d9488`)
- **Glassmorphism** sidebar and headers with `backdrop-filter: blur(24px)`
- **Mesh gradient** background with organic depth
- **Spring-physics** micro-animations on cards, buttons, and icons
- **Plus Jakarta Sans** font (weight 300–900)
- **Responsive**: 3-tier breakpoints (1024px tablet → 768px mobile → 480px small)

### Supported Branches

CSE · ECE · ME · EEE · CIVIL · ISE · AIML · CSD · CSDS

---

## 📁 Project Structure

```
attendance_ai/
│
├── backend/                     # FastAPI server
│   ├── __init__.py
│   ├── app.py                  # Entry point, lifespan, CORS
│   ├── config.py               # Settings from .env
│   ├── database.py             # Async MongoDB (Motor) + certifi SSL
│   ├── face_engine.py          # CUDA face engine + registration + deletion
│   ├── models.py               # Pydantic schemas
│   ├── seed.py                 # Seed students from metadata.csv
│   └── routes/
│       ├── __init__.py
│       ├── students.py         # Student CRUD + DELETE + face registration
│       └── attendance.py       # Mark attendance + reports + CSV export
│
├── frontend/                    # React dashboard (Vite)
│   ├── index.html              # Entry HTML + meta tags + OG
│   ├── package.json            # Node dependencies
│   ├── vite.config.js          # Proxy to backend :8000
│   └── src/
│       ├── App.jsx             # Layout + sidebar + routing
│       ├── main.jsx            # React entry point
│       ├── index.css           # Awwwards-grade design system
│       ├── services/api.js     # API client wrapper
│       ├── components/
│       │   └── DatePicker.jsx  # Custom glassmorphism date picker
│       └── pages/
│           ├── Dashboard.jsx       # Live stats + activity feed
│           ├── CameraPage.jsx      # CCTV auto-scan + recognition
│           ├── RegisterPage.jsx    # Face registration with burst capture
│           ├── StudentsPage.jsx    # Student directory + delete
│           ├── AttendancePage.jsx  # Logs + custom date picker + CSV
│           └── AnalyticsPage.jsx   # Power BI-style charts + KPIs
│
├── processed_dataset/           # Face images per student
├── student_index.faiss         # FAISS index (face embeddings)
├── labels.pkl                  # Maps embedding index → roll_no
├── requirements.txt            # Python dependencies
├── .env                        # MongoDB URI + config (gitignored)
├── .gitignore                  # Git ignore rules
└── README.md                   # This file
```

---

## ❓ FAQ

### "If I register as the first student, will it work?"

**Yes.** You start with an empty FAISS index (0 vectors). After registration, ~10-12 embeddings are added. Next time the camera sees you → FAISS finds the nearest match → attendance marked.

### "What is the similarity threshold (0.65)?"

- `1.0` = identical (same image)
- `0.8–0.99` = very confident match (same person, different photo)
- `0.65–0.8` = likely match
- `< 0.65` = different person (rejected)

The threshold is configurable in `.env` (`SIMILARITY_THRESHOLD`).

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Health check (GPU status) |
| GET | `/students` | List students (search, filter, paginate) |
| GET | `/students/{roll_no}` | Get single student |
| DELETE | `/students/{roll_no}` | Delete student + FAISS + photos |
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
| `certifi` | latest | SSL certificate bundle |
| `react` | 19.x | UI framework |
| `recharts` | 2.x | Charts and analytics |
| `react-webcam` | 7.x | Camera integration |
| `lucide-react` | latest | Icon library |

---

## 👤 Author

**Vishwanath B**

---
