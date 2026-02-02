# Deployment Guide

This guide describes how to deploy SomaLens to a production environment.

## Architecture

The application consists of five main services orchestrated by Docker Compose:

1. **Frontend**: Nginx container serving the built React SPA.
2. **Backend (API)**: Python container running FastAPI with Uvicorn (Production build).
3. **Celery Worker**: Python container running Celery for background image processing tasks.
4. **Database**: PostgreSQL container.
5. **Redis**: Redis container for caching and task queue.

## Deployment Steps

### 1. Prepare the Server
- Ensure **Docker** and **Docker Compose** are installed on the target machine.
- Ensure ports **80** (or 3000) and **8000** are available.
- For a real production setup, you should put a reverse proxy (Nginx/Traefik) in front to handle HTTPS and route traffic to the container ports.

### 2. Environment Configuration
The application relies on environment variables for configuration.
Update `docker-compose.yml` or create a `.env` file with secure values:

- `POSTGRES_PASSWORD`: Set a strong password.
- `SECRET_KEY`: Generate a random string (`openssl rand -hex 32`).
- `DATABASE_URL`: `postgresql+asyncpg://postgres:<PASSWORD>@db:5432/somalens`
- `REDIS_URL`: `redis://redis:6379/0`
- `DEBUG`: Set to `false` in production.

### 3. Build and Run
Deploy the stack using the root Docker Compose file. This uses the production Dockerfiles (`backend/docker/Dockerfile.prod`).

```bash
docker-compose up --build -d
```

### 4. Database Migrations
After the containers are running, apply the database schema changes:

```bash
docker-compose exec api alembic upgrade head
```

### 5. Verify Deployment
- **Frontend**: Check if the UI loads at your server's IP/domain (default port 3000).
- **API**: Check health at `http://<host>:8000/docs` or `http://<host>:8000/health` (if implemented).
- **Worker**: Check logs to ensure Celery connected to Redis:
  ```bash
  docker-compose logs -f celery_worker
  ```

## Maintenance

- **View Logs**:
  ```bash
  docker-compose logs -f
  # Specific service
  docker-compose logs -f api
  ```

- **Backup Database**:
  ```bash
  docker-compose exec db pg_dump -U postgres somalens > backup_$(date +%F).sql
  ```

- **Update Application**:
  ```bash
  git pull
  docker-compose up --build -d
  # Apply any new migrations
  docker-compose exec api alembic upgrade head
  ```
