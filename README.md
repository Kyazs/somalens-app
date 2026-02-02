# SomaLens

SomaLens is an AI-powered somatotype analysis application. It utilizes computer vision (MediaPipe) to analyze body landmarks from user-uploaded images and classifies them into somatotypes (Endomorph, Mesomorph, Ectomorph).

## Tech Stack
- **Frontend**: React 19, Vite, Tailwind CSS 4, Zustand
- **Backend**: FastAPI (Python 3.10+), SQLModel, Celery
- **AI/ML**: MediaPipe, TensorFlow
- **Infrastructure**: Docker, Redis, PostgreSQL (Prod) / SQLite (Dev)

---

## 🚀 Quick Start (Recommended)

The easiest way to run the **entire application** (Frontend + Backend + DB + Workers) is using Docker. This creates a production-like environment.

### 1. Setup Environment
Copy the example environment file. The default settings work out-of-the-box for Docker.
```bash
cp .env.example .env
```

### 2. Run with Docker
```bash
docker compose up --build
```
*(Note: Use `docker compose` with a space, not `docker-compose` if you are on a newer system)*

### 3. Access App
- **Frontend**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 🛠️ Developer Guide (Local Coding)

Use this method if you want to modify code and see changes instantly (**Hot-Reloading**).

### Prerequisites
- Node.js 20+
- Python 3.10+
- Docker (for running dependencies like Redis)

### Step 1: Start Infrastructure (Redis)
The backend needs Redis for background tasks.
```bash
# Run Redis in the background
docker run -d -p 6379:6379 --name somalens-redis redis:alpine
```

### Step 2: Start Backend (Terminal 1)
```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -e .

# Run Dev Server (Uses SQLite by default)
# Ensure REDIS_URL points to localhost in your environment or defaults
export REDIS_URL=redis://localhost:6379/0 
uvicorn app.main:app --reload
```
*Backend runs at: `http://localhost:8000`*

### Step 3: Start Frontend (Terminal 2)
```bash
cd frontend

# Install dependencies
npm install

# Run Dev Server
npm run dev
```
*Frontend runs at: `http://localhost:5173`*

---

## Deployment

For production deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md).
