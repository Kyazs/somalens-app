#!/usr/bin/env bash
#
# Downloads all ML model files required by SomaLens backend.
# Run this ONCE before your first Docker build.
#
# Usage:
#   cd backend
#   bash scripts/download_models.sh
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
CACHE_DIR="$BACKEND_DIR/ml_model_cache"

# Subdirectories
ZOEDEPTH_DIR="$CACHE_DIR/zoedepth/hub/checkpoints"
HUB_DIR="$CACHE_DIR/zoedepth/hub"
MEDIAPIPE_DIR="$CACHE_DIR/mediapipe"
TORCH_DIR="$CACHE_DIR/torch"

echo "============================================"
echo " SomaLens ML Model Downloader"
echo "============================================"
echo "Cache directory: $CACHE_DIR"
echo ""

# --- Helper: download with retry + resume ---
download_file() {
    local url="$1"
    local dest="$2"
    local desc="$3"

    if [ -f "$dest" ]; then
        local size
        size=$(du -h "$dest" | cut -f1)
        echo "[SKIP] $desc already exists ($size)"
        return
    fi

    mkdir -p "$(dirname "$dest")"
    echo "[DOWNLOADING] $desc ..."
    echo "  URL: $url"
    echo "  Destination: $dest"

    curl -L -C - --retry 5 --retry-delay 10 --retry-max-time 600 \
         -o "$dest" "$url"

    local size
    size=$(du -h "$dest" | cut -f1)
    echo "[DONE] $desc ($size)"
}

# --- Helper: download zip, extract, rename ---
download_and_extract_zip() {
    local url="$1"
    local target_dir="$2"
    local pattern="$3"
    local final_name="$4"
    local desc="$5"

    local final_path="$target_dir/$final_name"
    if [ -d "$final_path" ]; then
        echo "[SKIP] $desc already exists at $final_path"
        return
    fi

    mkdir -p "$target_dir"
    local tmp_zip="/tmp/${final_name}.zip"
    local tmp_extract="/tmp/${final_name}-extract"

    echo "[DOWNLOADING] $desc ..."
    curl -L --retry 3 --retry-delay 5 -o "$tmp_zip" "$url"

    echo "  Extracting..."
    rm -rf "$tmp_extract"
    mkdir -p "$tmp_extract"
    unzip -q "$tmp_zip" -d "$tmp_extract"

    # Find and move the extracted subdirectory
    local subdir
    subdir=$(find "$tmp_extract" -maxdepth 1 -type d -name "$pattern" | head -1)
    if [ -n "$subdir" ]; then
        mv "$subdir" "$final_path"
    else
        echo "  ERROR: Could not find subdirectory matching '$pattern'"
        ls "$tmp_extract"
    fi

    # Cleanup
    rm -f "$tmp_zip"
    rm -rf "$tmp_extract"

    echo "[DONE] $desc"
}

# =============================================
# 1. ZoeDepth Weights (~1.34 GB)
# =============================================
download_file \
    "https://github.com/isl-org/ZoeDepth/releases/download/v1.0/ZoeD_M12_N.pt" \
    "$ZOEDEPTH_DIR/ZoeD_M12_N.pt" \
    "ZoeDepth weights (ZoeD_M12_N.pt, ~1.34 GB)"

# =============================================
# 2. MiDaS Repository
# =============================================
download_and_extract_zip \
    "https://github.com/intel-isl/MiDaS/zipball/master" \
    "$HUB_DIR" \
    "intel-isl-MiDaS-*" \
    "intel-isl_MiDaS_master" \
    "MiDaS repository"

# =============================================
# 3. ZoeDepth Repository
# =============================================
download_and_extract_zip \
    "https://github.com/isl-org/ZoeDepth/zipball/main" \
    "$HUB_DIR" \
    "isl-org-ZoeDepth-*" \
    "isl-org_ZoeDepth_main" \
    "ZoeDepth repository"

# =============================================
# 4. MediaPipe Pose Landmarker Heavy
# =============================================
download_file \
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task" \
    "$MEDIAPIPE_DIR/pose_landmarker_heavy.task" \
    "MediaPipe Pose Landmarker Heavy (~30 MB)"

# =============================================
# 5. DeepLabV3 ResNet101 (for prod build)
# =============================================
download_file \
    "https://download.pytorch.org/models/deeplabv3_resnet101_coco-586e9e4e.pth" \
    "$TORCH_DIR/hub/checkpoints/deeplabv3_resnet101_coco-586e9e4e.pth" \
    "DeepLabV3 ResNet101 weights (~233 MB)"

# =============================================
# Summary
# =============================================
echo ""
echo "============================================"
echo " Download Summary"
echo "============================================"
TOTAL_FILES=$(find "$CACHE_DIR" -type f | wc -l)
TOTAL_SIZE=$(du -sh "$CACHE_DIR" | cut -f1)
echo "Total files: $TOTAL_FILES"
echo "Total size:  $TOTAL_SIZE"
echo ""
echo "You can now build Docker images. Models will be volume-mounted (dev) or COPY'd (prod)."
