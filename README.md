# SomaLens

SomaLens is an AI-powered somatotype analysis application. It utilizes computer vision (MediaPipe) to analyze body landmarks from user-uploaded images and classifies them into somatotypes (Endomorph, Mesomorph, Ectomorph).

## Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS 4, Zustand
- **Backend**: FastAPI (Python 3.10+), SQLModel, Celery
- **AI/ML**: MediaPipe, ZoeDepth, TensorFlow
- **Infrastructure**: Docker, Redis, PostgreSQL (Prod) / SQLite (Dev)

---

## 🚀 Quick Start (Full Stack with Docker)

The easiest way to run the **entire application** (Frontend + Backend + DB + Workers) is using Docker Compose from this directory. This creates a production-like environment with all services.

### 1. Setup Environment

```bash
cp .env.example .env
# Edit .env with secure values for production (see DEPLOYMENT.md)
```

### 2. Download ML Models (one-time)

ML models (~1.6GB) must be downloaded **once** before building. They are too large for Git and are excluded via `.gitignore`.

```bash
# Linux/macOS:
cd backend && bash scripts/download_models.sh && cd ..

# Windows (PowerShell):
cd backend; .\scripts\download_models.ps1; cd ..
```

### 3. Run with Docker

```bash
docker compose up --build
```

_(Note: Use `docker compose` with a space, not `docker-compose` if you are on a newer system)_

### 4. Run Database Migrations (first time only)

```bash
docker compose exec api alembic upgrade head
```

### 5. Access App

| Service          | URL                                                          |
| ---------------- | ------------------------------------------------------------ |
| Frontend         | [http://localhost:3000](http://localhost:3000)               |
| Backend API Docs | [http://localhost:8000/docs](http://localhost:8000/docs)     |
| Health Check     | [http://localhost:8000/health](http://localhost:8000/health) |

---

## 🛠️ Developer Guide (Local Development with Hot-Reload)

Use this method if you want to develop code with **hot-reloading** (instant changes without rebuilding).

### Prerequisites

- Node.js 20+
- Python 3.10+
- Docker (for Redis dependency)

> **Ubuntu/Debian users**: You may need to install the venv package:
>
> ```bash
> sudo apt install python3.12-venv  # or python3.10-venv depending on your version
> ```

### Step 1: Start Infrastructure (Redis)

The backend needs Redis for Celery background tasks.

```bash
docker run -d -p 6379:6379 --name somalens-redis redis:alpine
```

### Step 2: Start Backend (Terminal 1)

```bash
cd backend
cp .env.example .env  # Uses SQLite by default

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
# Linux/macOS:
source venv/bin/activate
# Windows (Command Prompt):
# venv\Scripts\activate.bat
# Windows (PowerShell):
# venv\Scripts\Activate.ps1

# Install dependencies (includes PyTorch CPU for ML)
pip install --extra-index-url https://download.pytorch.org/whl/cpu -e .

# (Optional) Pre-download ML models for faster first request
# Models auto-download on first use, but you can pre-cache them:
# Linux/macOS: bash scripts/download_models.sh
# Windows:     .\scripts\download_models.ps1

# Run dev server
uvicorn app.main:app --reload
```

_Backend runs at: `http://localhost:8000`_

### Step 3: Start Celery Worker (Terminal 2)

```bash
cd backend

# Activate virtual environment (use appropriate command for your OS - see Step 2)
source venv/bin/activate

celery -A app.celery_worker worker --loglevel=info
```

### Step 4: Start Frontend (Terminal 3)

```bash
cd frontend
npm install
npm run dev
```

_Frontend runs at: `http://localhost:5173` (API calls go to `http://localhost:8000` via CORS)_

---

## 🐳 Backend-Only Development (Docker)

For backend developers who don't need the frontend, the `backend/` directory has its own docker-compose setup with hot-reload:

```bash
cd backend
cp .env.example .env
bash scripts/download_models.sh  # One-time ML model download
make dev        # Starts API + Celery + Redis with hot-reload
make migrate    # Run migrations
```

This uses SQLite (no PostgreSQL) and is optimized for rapid backend iteration. See `backend/README.md` for details.

---

## Deployment

For production deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md).
