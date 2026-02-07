# FastAPI Backend

FastAPI backend with SQLModel, Celery, and JWT authentication for robust, scalable API development.

> **Note**: This directory contains only the backend. For full-stack deployment (frontend + backend + PostgreSQL), use the `docker-compose.yml` in the parent directory. See [`../README.md`](../README.md).

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

## ML Pipeline Architecture

SomaLens uses a multi-stage ML pipeline for somatotype estimation:

### Pipeline Flow
```
Input Image → DeepLabV3 Segmentation → Scale Normalization → CNN Extraction → Ultra V3 Prediction → Heath-Carter Somatotype
```

### Components

1. **DeepLabV3 Segmentation** (`app/utils/segmentation.py`)
   - Extracts person silhouette from input photos
   - Uses pretrained DeepLabV3-ResNet101 model
   - Outputs binary mask (person vs background)

2. **Scale Normalization** (`app/utils/scale_normalization.py`)
   - Normalizes body size to 85% of frame height
   - Resizes to 224x224 for CNN input
   - Ensures consistent scale across inputs

3. **CNN Proxy Measurement Extraction** (`app/tasks/ml.py`)
   - Multi-input CNN with gender and stature
   - Outputs anthropometric proxy measurements
   - Input format: [gender_onehot, stature/200]

4. **Ultra V3 Predictor** (`app/services/ultra_v3_predictor.py`)
   - SVR models for skinfold predictions
   - RF models for breadths and girths
   - Filipino calibration coefficients applied

5. **Heath-Carter Somatotype** (`app/services/somatotype.py`)
   - Calculates endomorphy, mesomorphy, ectomorphy
   - Classifies somatotype (e.g., "Mesomorph-Endomorph")

## Dependencies

### PyTorch (New)
The ML pipeline requires PyTorch for DeepLabV3 segmentation:
- `torch>=2.2.0` (CPU version)
- `torchvision>=0.17.0`

The Dockerfile automatically downloads DeepLabV3 weights during build.

### Other ML Dependencies
- TensorFlow 2.16.1 (CNN model)
- scikit-learn (SVR/RF models)
- NumPy, Pillow (image processing)

## API Changes

### Required Demographic Fields

The `/api/v1/measurements` endpoint now requires additional demographic data:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `height` | float | **Yes** | Height in cm |
| `weight` | float | **Yes** | Weight in kg |
| `age` | int | **Yes** | Age in years |
| `gender` | string | **Yes** | "male" or "female" |
| `waist_circumference` | float | Recommended | Waist in cm (improves accuracy) |

These fields are used for:
- CNN input encoding (gender, stature)
- Ultra V3 calibration (height, weight, age)
- Fat factor modulation (waist-to-height ratio)

## Prerequisites

- Python 3.10 or higher
- Docker
- Docker Compose
- Make

## Quick Start (Backend-Only Development)

This Docker setup runs **backend only** with SQLite (no frontend, no PostgreSQL). Ideal for rapid backend iteration.

```bash
cd backend
cp .env.example .env
make dev        # Starts API + Celery + Redis with hot-reload
make migrate    # Apply database migrations
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

## Troubleshooting

### Common Issues

**PyTorch not found**
```
ModuleNotFoundError: No module named 'torch'
```
Solution: Ensure you're using the Docker image or install PyTorch manually:
```bash
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
```

**DeepLabV3 model not loading**
```
Error loading segmentation model
```
Solution: The model should be baked into Docker. If running locally:
```python
import torch
torch.hub.load('pytorch/vision:v0.10.0', 'deeplabv3_resnet101', pretrained=True)
```

**Missing demographic data**
```
ValueError: Missing required field: height
```
Solution: Ensure all required fields are provided in the API request.

**Segmentation returns empty mask**
Solution: Check image quality - person should be clearly visible and upright.
