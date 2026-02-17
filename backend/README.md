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

## ML Pipeline Architecture (V4)

SomaLens uses a 9-step ML pipeline for somatotype estimation, based on Research V3 findings (Phases 37-53b).

### Pipeline Flow
```
Input Image → DeepLabV3 Segmentation → Scale Normalization → CNN Extraction (z-score inverse)
  → Ultra V3 V2 Prediction (SVR V2.1 + RF v2.2n)
  → G13 Skinfold Calibration → G38 Girth Calibration
  → Heath-Carter Somatotype → S5_g0.25 Bias Correction → Classification (T=1.75)
  → Body Fat Estimation
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
   - Outputs 9 anthropometric proxy measurements (z-scores → cm via inverse transform)
   - Input format: [gender_onehot, stature/200]
   - Measurements: chest, buttock, waist, thigh, ankle circumferences; biacromial breadth; knee height; arm circumference flexed; calf circumference

4. **Ultra V3 V2 Predictor** (`app/services/ultra_v3_predictor.py`)
   - SVR V2.1 models for all 4 skinfold predictions (Triceps, Subscapular, Supraspinale, Calf)
   - RF v2.2n models for breadths (Humerus, Femur) and girths (Arm, Calf)
   - 15 SVR features including Deurenberg body fat composition
   - Filipino calibration coefficients applied
   - Returns both calibrated and raw predictions (for downstream G13/G38)

5. **G13 Skinfold Calibration** (`app/services/measurement_calibration.py`)
   - BayesianRidge per-skinfold calibration using raw SVR predictions + CNN features
   - Corrects CAESAR→Filipino domain gap with conservative regularization (alpha=1e-2)

6. **G38 Girth/Breadth Calibration** (`app/services/measurement_calibration.py`)
   - BayesianRidge per-girth calibration using raw RF predictions + CNN features
   - Humerus breadth uses simple offset; others use multivariate regression

7. **Heath-Carter Somatotype** (`app/services/somatotype.py`)
   - Calculates endomorphy, mesomorphy, ectomorphy from calibrated measurements
   - Classification threshold: T=1.75 (Research V3 Phase 42)
   - Uses `>=` comparisons for dominance checks

8. **S5_g0.25 Bias Correction** (`app/services/bias_correction.py`)
   - BayesianRidge multivariate correction for Endomorphy and Mesomorphy
   - Gap Restore (gamma=0.25) for variance preservation
   - Ectomorphy kept as-is (HWR-derived, already accurate)
   - Validated accuracy: 76.7% @ T=1.75 | 80.0% @ T=2.0

9. **Body Fat Estimation** (`app/services/body_fat.py`)
   - Durnin-Womersley + CUN-BAE dual estimation

### Model Files (`app/ml_models/`)

| Model | Files | Purpose |
|-------|-------|---------|
| CNN Extractor | `measurementExtractor_*.keras`, `scalerStd_extractor.pkl` | Proxy measurement extraction |
| SVR V2.1 | `svr_skinfold_v2_1_*.pkl`, `*_metadata.json`, `*_calibration.json` | Skinfold prediction (4 targets) |
| RF v2.2n | `rf_v2.2n_*.pkl`, `*_metadata.json`, `*_scaler_*.pkl` | Girth/breadth prediction |
| G13 Calibration | `g13_*.pkl` | Skinfold domain adaptation (4 models) |
| G38 Calibration | `g38_*.pkl`, `g38_humerus_offset.json` | Girth domain adaptation (3 models + offset) |
| S5 Correction | `s5_endo_correction.pkl`, `s5_meso_correction.pkl`, `s5_gap_params.json` | Somatotype bias correction |

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
