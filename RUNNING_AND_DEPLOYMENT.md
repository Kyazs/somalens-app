# Comprehensive Guide to Running and Deploying SomaLens

This guide provides detailed instructions for setting up, running, and deploying the SomaLens application, covering both the React frontend and the FastAPI backend.

## 📂 Project Structure

The project follows a monorepo-style structure:

- **`/` (Root)**: Contains orchestration files (`docker-compose.yml`) and project-wide documentation.
- **`/frontend`**: The React application (Vite + Tailwind + Zustand).
- **`/backend`**: The FastAPI backend service.
  - Contains its own `Makefile` and `docker/` configuration for isolated development.

---

## 🛠 Prerequisites

Ensure you have the following installed:

- **Docker & Docker Compose** (Essential for the full stack experience)
- **Node.js 20+** (For local frontend development)
- **Python 3.10+** (For local backend development)
- **Make** (For running backend utility commands)

---

## ⚙️ Configuration

The application relies on environment variables for configuration.

### Backend Environment Variables
Create a `.env` file in `backend/` (or set these in `docker-compose.yml`):

| Variable | Description | Default / Example |
|----------|-------------|-------------------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql+asyncpg://postgres:postgres@db:5432/somalens` |
| `REDIS_URL` | Redis connection string | `redis://redis:6379/0` |
| `SECRET_KEY` | Key for session/token encryption | *Change this in production!* |
| `POSTGRES_USER` | Database user | `postgres` |
| `POSTGRES_PASSWORD`| Database password | `postgres` |
| `POSTGRES_DB` | Database name | `somalens` |
| `DEBUG` | Enable debug mode | `true` |

---

## 🐳 Local Development (Docker) - Recommended

This is the easiest way to run the full stack (Frontend + Backend + DB + Redis).

### ⚠️ CRITICAL SETUP STEP
The root `docker-compose.yml` is configured to point to the `./backend` directory. Ensure your backend folder is named `backend`.

```yaml
  api:
    build:
      context: ./backend
      dockerfile: Dockerfile
    # ... rest of configuration
```

### Running the Application

1. **Build and Start**:
   ```bash
   docker-compose up --build
   ```

2. **Access Services**:
   - **Frontend**: [http://localhost:3000](http://localhost:3000)
   - **Backend API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
   - **Database**: Port `5432`
   - **Redis**: Port `6379`

3. **Stop Services**:
   ```bash
   docker-compose down
   ```

---

## 💻 Local Development (Manual)

If you prefer running services directly on your machine:

### Frontend
1. Navigate to the directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
   The app will run at `http://localhost:5173` (Vite default) or `3000` depending on config.

### Backend
1. Navigate to the directory:
   ```bash
   cd backend
   ```
2. **Option A: Using Make (Recommended)**
   The backend includes a `Makefile` for convenience.
   ```bash
   make dev   # Starts backend services using its internal Docker setup
   ```

3. **Option B: Manual Python Setup**
   ```bash
   # Create virtual environment
   python -m venv venv
   source venv/bin/activate

   # Install dependencies
   pip install -r requirements.txt  # Or use pyproject.toml if applicable

   # Run Migrations
   alembic upgrade head

   # Start Server
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

---

## 🚀 Deployment

### 1. Preparation
- **Security**: Ensure `DEBUG=false` and `SECRET_KEY` is a strong, random string.
- **Environment**: Create a production `.env` file on your server.

### 2. Building for Production
Use the `docker-compose.yml` (with the path fix applied) to build optimized images.

```bash
docker-compose -f docker-compose.yml build
```

### 3. Database Migrations
After starting the containers, run migrations to ensure the schema is up to date.

```bash
# Using the root docker-compose setup
docker-compose exec api alembic upgrade head

# OR if using the backend Makefile
cd backend && make migrate
```

### 4. Nginx / Reverse Proxy
In a production environment, place Nginx in front of the services to handle SSL termination and routing. The `frontend` container currently serves the React app via Nginx (as per standard Docker patterns), but an external Nginx is recommended for the host.

---

## 🔧 Troubleshooting

### Common Issues

**1. "build path ... either does not exist, is not accessible, or is not a valid URL"**
- **Cause**: The `docker-compose.yml` still points to `./backend`.
- **Fix**: Update the build context to `./backend` if needed.

**2. Database Connection Failed**
- **Cause**: The `api` container starts before the `db` container is ready.
- **Fix**: The `depends_on: condition: service_healthy` in `docker-compose.yml` usually handles this. If it fails, check the `db` logs: `docker-compose logs db`.

**3. Port Conflicts**
- **Cause**: Ports 3000, 8000, or 5432 are already in use.
- **Fix**: Stop other services or modify the `ports` mapping in `docker-compose.yml` (e.g., `"3001:80"`).
