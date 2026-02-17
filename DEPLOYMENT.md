# Deployment Guide

This guide describes how to deploy SomaLens to a production environment.

## Architecture

The application consists of five main services orchestrated by Docker Compose:

1. **Frontend**: Nginx container serving the built React SPA with API proxying.
2. **Backend (API)**: Python container running FastAPI with Uvicorn (4 workers).
3. **Celery Worker**: Python container running Celery for background image processing tasks.
4. **Database**: PostgreSQL 15 container.
5. **Redis**: Redis 7 container for caching and task queue.

## Prerequisites

- Docker Engine 20.10+ and Docker Compose v2
- Minimum 6GB RAM (ML models require ~3GB at peak)
- ~2GB free disk space for ML model cache
- Ports 3000 (frontend) and 8000 (API) available

## Deployment Steps

### 1. Clone and Configure

```bash
git clone <repository-url>
cd SomaLens/app

# Create environment file from template
cp .env.example .env
```

### 2. Configure Production Environment

Edit `.env` with secure production values:

```bash
# Generate secure keys
openssl rand -hex 32  # For JWT_SECRET_KEY
openssl rand -hex 16  # For POSTGRES_PASSWORD
```

**Required changes in `.env`:**

- `POSTGRES_PASSWORD`: Strong random password
- `JWT_SECRET_KEY`: Generated secure key (32+ chars)
- `DEBUG`: Ensure set to `false`

> **Note**: The `CORS_ORIGINS` variable in `.env.example` is not currently enforced - CORS allows all origins (`*`). For production, consider implementing CORS origin restrictions in the backend code.

### 2. Download ML Models

ML model weights (~1.6GB) must be downloaded **once** before building. They are too large for Git.

```bash
cd backend

# Linux/macOS:
bash scripts/download_models.sh

# Windows (PowerShell):
# .\scripts\download_models.ps1

cd ..
```

This downloads ZoeDepth, MediaPipe, and DeepLabV3 weights to `backend/ml_model_cache/`. The production Dockerfile COPY's these into the image.

### 3. Build and Deploy

```bash
# Build and start all services (detached mode)
docker compose up --build -d

# View logs to monitor startup
docker compose logs -f
```

> **Note**: First build takes 5-10 minutes to install Python/Node dependencies. ML models are pre-downloaded so no large network fetches occur during the build.

### 4. Run Database Migrations

```bash
docker compose exec api alembic upgrade head
```

### 5. Verify Deployment

| Service    | Check                               | Expected                   |
| ---------- | ----------------------------------- | -------------------------- |
| Frontend   | http://\<host\>:3000                | SomaLens UI loads          |
| API Docs   | http://\<host\>:8000/docs           | Swagger UI accessible      |
| API Health | http://\<host\>:8000/health         | Returns 200 OK             |
| Worker     | `docker compose logs celery_worker` | "celery@... ready" message |

## Service Management

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f api
docker compose logs -f celery_worker
```

### Restart Services

```bash
# Restart single service
docker compose restart api

# Restart all
docker compose restart
```

### Stop/Start

```bash
docker compose stop
docker compose start
```

## Database Operations

### Backup

```bash
docker compose exec db pg_dump -U postgres somalens > backup_$(date +%F).sql
```

### Restore

```bash
cat backup.sql | docker compose exec -T db psql -U postgres somalens
```

## Updating the Application

```bash
# Pull latest changes
git pull

# Re-download ML models if changed (safe to re-run, skips existing files)
cd backend && bash scripts/download_models.sh && cd ..

# Rebuild and restart (zero-downtime not guaranteed)
docker compose up --build -d

# Apply any new migrations
docker compose exec api alembic upgrade head
```

## Production Recommendations

1. **Reverse Proxy**: Place Nginx/Traefik in front for HTTPS termination
2. **Secrets Management**: Use Docker secrets or external vault for credentials
3. **Monitoring**: Add Prometheus/Grafana for metrics
4. **Backups**: Schedule automated PostgreSQL backups
5. **Resource Limits**: Configure Docker resource constraints for stability
