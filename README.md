# SomaLens

SomaLens is an AI-powered somatotype analysis application. It utilizes computer vision (MediaPipe) to analyze body landmarks from user-uploaded images and classifies them into somatotypes (Endomorph, Mesomorph, Ectomorph).

## Tech Stack
- **Frontend**: React 19, Vite, Tailwind CSS 4, Zustand
- **Backend**: FastAPI (Python 3.10+), SQLModel, Celery
- **AI/ML**: MediaPipe, TensorFlow
- **Infrastructure**: Docker, Redis, PostgreSQL (Prod) / SQLite (Dev)

---

## 🚀 Quick Start (Full Stack with Docker)

The easiest way to run the **entire application** (Frontend + Backend + DB + Workers) is using Docker Compose from this directory. This creates a production-like environment with all services.

### 1. Setup Environment
```bash
cp .env.example .env
# Edit .env with secure values for production (see DEPLOYMENT.md)
```

### 2. Run with Docker
```bash
docker compose up --build
```
*(Note: Use `docker compose` with a space, not `docker-compose` if you are on a newer system)*

### 3. Run Database Migrations (first time only)
```bash
docker compose exec api alembic upgrade head
```

### 4. Access App
| Service | URL |
|---------|-----|
| Frontend | [http://localhost:3000](http://localhost:3000) |
| Backend API Docs | [http://localhost:8000/docs](http://localhost:8000/docs) |
| Health Check | [http://localhost:8000/health](http://localhost:8000/health) |

---

## 🛠️ Developer Guide (Local Development with Hot-Reload)

Use this method if you want to develop code with **hot-reloading** (instant changes without rebuilding).

### Prerequisites
- Node.js 20+
- Python 3.10+
- Docker (for Redis dependency)

> **Ubuntu/Debian users**: You may need to install the venv package:
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

# Run dev server
uvicorn app.main:app --reload
```
*Backend runs at: `http://localhost:8000`*

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
*Frontend runs at: `http://localhost:5173` (API calls go to `http://localhost:8000` via CORS)*

---

## 🐳 Backend-Only Development (Docker)

For backend developers who don't need the frontend, the `backend/` directory has its own docker-compose setup with hot-reload:

```bash
cd backend
cp .env.example .env
make dev        # Starts API + Celery + Redis with hot-reload
make migrate    # Run migrations
```

This uses SQLite (no PostgreSQL) and is optimized for rapid backend iteration. See `backend/README.md` for details.

---

## Deployment

For production deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md).
