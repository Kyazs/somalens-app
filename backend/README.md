# FastAPI Backend

FastAPI backend with SQLModel, Celery, and JWT authentication for robust, scalable API development.

## Features

- **FastAPI** - Modern, fast web framework for building APIs with Python 3.10+
- **SQLModel ORM** - SQL databases in Python with type hints and data validation
- **JWT Authentication** - Secure token-based authentication with role-based access control
- **Celery Task Queue** - Asynchronous task processing and background job handling
- **Docker Containerization** - Production-ready containerized deployment
- **Alembic Migrations** - Version control for database schema changes

## Tech Stack

- **Python 3.10+** - Core language
- **FastAPI** - Web framework
- **SQLModel** - ORM and data validation
- **Alembic** - Database migrations
- **Celery** - Task queue
- **Redis** - Message broker and cache
- **JWT** - Authentication
- **SQLite** - Development database

## Prerequisites

- Python 3.10 or higher
- Docker
- Docker Compose
- Make

## Quick Start

```bash
git clone https://github.com/your-username/ultimate-backend-destroyer-of-worlds.git
cd ultimate-backend-destroyer-of-worlds
cp .env.example .env
make dev
make migrate
# Access API docs at http://localhost:8000/docs
```

## Makefile Commands

| Command | Description |
|---------|-------------|
| `make dev` | Start development environment with Docker Compose |
| `make prod` | Start production environment in detached mode |
| `make migrate` | Run pending database migrations with Alembic |
| `make migrate-create` | Create a new auto-generated database migration |
| `make shell` | Open a bash shell inside the API container |
| `make logs` | Stream logs from the API service |
| `make celery-logs` | Stream logs from the Celery worker service |
| `make redis-cli` | Access Redis CLI for cache inspection |
| `make stop` | Stop all running containers |
| `make clean` | Remove containers and persistent data volumes |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `JWT_SECRET_KEY` | Secret key for JWT token signing (change in production) |
| `JWT_ALGORITHM` | Algorithm for JWT encoding (default: HS256) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Access token expiration time in minutes |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Refresh token expiration time in days |
| `DATABASE_URL` | SQLite database connection URL |
| `REDIS_URL` | Redis connection URL for task queue |
| `DEBUG` | Debug mode (set to false in production) |

## Project Structure

```
.
├── app/                    # Application source code
├── alembic/                # Database migrations
├── docker/                 # Docker configuration files
├── data/                   # Data directory (generated at runtime)
├── pyproject.toml          # Project metadata and dependencies
├── Makefile                # Build and development commands
└── .env.example            # Environment variables template
```

## Getting Started

1. **Clone the repository** and install dependencies
2. **Configure environment** by copying `.env.example` to `.env`
3. **Start services** with `make dev`
4. **Run migrations** with `make migrate`
5. **Access documentation** at `http://localhost:8000/docs`

For more information, check the API documentation at `/docs` once the server is running.
