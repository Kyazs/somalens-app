# Implementation Plan: ZoeDepth Integration into `somalens-app`

This plan details how to integrate the ZoeDepth-based height estimation feature from the research codebase (`somalens-paper`) into the production application (`somalens-app`).

## 1. File Transfer & Placement

You need to transfer the core logic file and adapt it to the new project structure.

| Source File (Scientific Repo)            | Destination (App Repo)                      | Description                                                         |
| :--------------------------------------- | :------------------------------------------ | :------------------------------------------------------------------ |
| `tests/zoedepth/height_from_zoedepth.py` | `backend/app/services/height_estimation.py` | Contains the `ZoeDepthHeightEstimator` class and calibration logic. |

> **Note**: Rename the file to `height_estimation.py` to follow Python module naming conventions in the `services` directory.

## 2. Requirements & Dependencies

Add the following packages to your `backend/pyproject.toml` or `backend/requirements.txt`.

### Core Dependencies

```toml
torch>=2.0.0
torchvision>=0.15.0
timm>=0.9.0         # Required for ZoeDepth backbone
opencv-python-headless # For server environments (avoids GUI dependencies)
mediapipe           # For pose landmarks (head/feet detection)
numpy
Pillow
```

### System Requirements

- **CUDA Support**: If deploying to a server with GPU, ensure the `torch` version matches the CUDA version (e.g., `torch --index-url https://download.pytorch.org/whl/cu118`).
- **Models Directory**: Ensure `backend/app/ml_models/` exists and is writable, or configure a separate cache directory.

## 3. Code Modifications

You must modify `backend/app/services/height_estimation.py` to fit the `somalens-app` structure.

### A. Update Paths

Change the path definitions at the top of the file to point to the correct model directory in `somalens-app`.

**Original (`height_from_zoedepth.py`):**

```python
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent
# ...
MODEL_CACHE_DIR = PROJECT_ROOT / "data" / "models"
ZOEDEPTH_CACHE_DIR = MODEL_CACHE_DIR / "zoedepth"
MEDIAPIPE_CACHE_DIR = MODEL_CACHE_DIR / "mediapipe"
```

**Modified (`backend/app/services/height_estimation.py`):**

```python
from pathlib import Path
import sys

# Adjust to backend root (assuming services/ is 2 levels deep from backend root)
BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
# Point to existing ml_models/ directory
MODEL_CACHE_DIR = BACKEND_ROOT / "app" / "ml_models"

# Subdirectories for organized caching
ZOEDEPTH_CACHE_DIR = MODEL_CACHE_DIR / "zoedepth"
MEDIAPIPE_CACHE_DIR = MODEL_CACHE_DIR / "mediapipe"
```

### B. Standardize Imports

Remove the `sys.path.insert` hack since `somalens-app` likely runs as a proper package.

**Remove:**

```python
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(PROJECT_ROOT / "src"))
```

### C. Calibration (Camera Profiles)

The calibration logic is embedded in the `CAMERA_PROFILES` dictionary within the class file. **Keep this intact.**

To ensure accuracy, you must:

1.  **Keep the `CAMERA_PROFILES` dictionary.** This contains the specific `fov_degrees` values calibrated for the Nothing Phone 3a (or typical smartphones).
2.  **Add new profiles** if you expect images from different devices with known specs.
3.  **Fallback**: The logic already handles unknown cameras using `detect_camera_profile` (based on resolution) or `DEFAULT_FALLBACK_FOV`.

**Key Code to Preserve:**

```python
CAMERA_PROFILES = {
    'ultra_wide': {
        'fov_degrees': 78.4,       # Calibrated
        'landscape_width': 3280,
        'landscape_height': 2464,
    },
    'main': {
        'fov_degrees': 76.0,       # Calibrated
        'landscape_width': 4096,
        'landscape_height': 3072,
    },
}
```

## 4. API Integration Strategy

Create a new API endpoint in `backend/app/api/v1/endpoints/measurement.py` (or similar) to use the service.

### Example Usage in FastAPI Route

```python
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services.height_estimation import ZoeDepthHeightEstimator
import shutil
import os
from pathlib import Path

router = APIRouter()

# Initialize estimator globally or per-request (dependency injection recommended)
# Note: Initializing is heavy, so ideally do this once at startup if VRAM allows.

@router.post("/estimate-height")
async def estimate_height(file: UploadFile = File(...)):
    temp_file = Path(f"temp_{file.filename}")
    try:
        # 1. Save upload to temp file
        with open(temp_file, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # 2. Run Estimation
        # Use context manager to ensure resources (models) are released or managed
        # Use 'indoor' model (ZoeD_N) as it is lighter and faster
        with ZoeDepthHeightEstimator(model_type='indoor') as estimator:
            result = estimator.estimate_height_detailed(str(temp_file))

        if not result.is_reliable:
            return {
                "status": "warning",
                "height_cm": result.height_cm,
                "confidence": result.confidence,
                "warnings": result.warnings
            }

        return {
            "status": "success",
            "height_cm": result.height_cm,
            "confidence": result.confidence,
            "details": result.details
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        # Cleanup
        if temp_file.exists():
            os.remove(temp_file)
```

## 5. Docker Configuration

Update `backend/Dockerfile.prod` (and dev) to include system dependencies for OpenCV and builds.

```dockerfile
# Add system dependencies for OpenCV and PyTorch
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
```

## 6. Verification Steps

After implementing in `somalens-app`:

1.  **Unit Test**: Create a test in `backend/tests/` that runs `estimate_height` on a sample image (e.g., from `tests/fixtures`).
2.  **Calibration Check**: Verify that passing an image close to 3280x2464 triggers the 'ultra_wide' profile (78.4° FOV).
