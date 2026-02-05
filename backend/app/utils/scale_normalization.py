"""
Scale Normalization for Silhouette Preprocessing
=================================================

This module provides scale normalization for silhouettes to eliminate the domain gap
between Blender-rendered training data and real smartphone photos.

Key Function:
- normalize_silhouette_scale(): Normalizes body to fill 85% of frame height

Constants:
- TARGET_VERTICAL_COVERAGE = 0.85 (matching Blender training data)
- IMG_SIZE = 224 (CNN input size)

Usage:
    from app.utils.scale_normalization import normalize_silhouette_scale
    
    # Normalize a silhouette (body=white=1, background=black=0)
    normalized = normalize_silhouette_scale(silhouette)
     # Output: (224, 224, 1), body fills 85% of frame height, centered
"""

import numpy as np
import cv2 as cv


# Target vertical coverage (from training data analysis)
# Training silhouettes have bodies filling ~85% of frame height
TARGET_VERTICAL_COVERAGE = 0.85

# CNN input size (must match model architecture)
IMG_SIZE = 224


def normalize_silhouette_scale(silhouette, target_coverage=TARGET_VERTICAL_COVERAGE):
    """
    Normalize silhouette so body occupies target % of frame height.
    
    This is the KEY FIX: makes test silhouettes match training format.
    Eliminates domain gap caused by different camera FOVs and distances.
    
    Args:
        silhouette: Binary silhouette array (H, W) or (H, W, 1), values 0-1
                   where body pixels are > 0.5 and background pixels are < 0.5
        target_coverage: Target fraction of frame height for body (default 0.85)
    
    Returns:
        Normalized silhouette (224, 224, 1) with:
        - Body vertically centered
        - Body height = 85% of frame height
        - Aspect ratio preserved
        - Binary values (0.0 or 1.0)
    
    Example:
        >>> import numpy as np
        >>> sil = np.zeros((224, 224), dtype=np.float32)
        >>> sil[50:180, 80:144] = 1.0  # Body region
        >>> result = normalize_silhouette_scale(sil)
        >>> result.shape
        (224, 224, 1)
    """
    # Handle channel dimension
    if silhouette.ndim == 3:
        sil = silhouette.squeeze()
    else:
        sil = silhouette.copy()
    
    h, w = sil.shape
    
    # Find bounding box of body pixels
    rows = np.any(sil > 0.5, axis=1)
    cols = np.any(sil > 0.5, axis=0)
    
    # Handle edge case: no body pixels detected
    if not rows.any() or not cols.any():
        return np.zeros((IMG_SIZE, IMG_SIZE, 1), dtype=np.float32)
    
    # Calculate bounding box
    top = np.argmax(rows)
    bottom = h - np.argmax(rows[::-1])
    left = np.argmax(cols)
    right = w - np.argmax(cols[::-1])
    
    current_height = bottom - top
    current_width = right - left
    
    # Handle edge case: empty bounding box
    if current_height <= 0 or current_width <= 0:
        return np.zeros((IMG_SIZE, IMG_SIZE, 1), dtype=np.float32)
    
    # Calculate target dimensions (isotropic scaling to preserve aspect ratio)
    target_height = int(IMG_SIZE * target_coverage)
    scale = target_height / current_height
    
    new_height = int(current_height * scale)
    new_width = int(current_width * scale)
    
    # Crop to bounding box
    body_crop = sil[top:bottom, left:right]
    
    # Resize body to target scale (using linear interpolation)
    body_resized = cv.resize(body_crop.astype(np.float32), (new_width, new_height), 
                              interpolation=cv.INTER_LINEAR)
    
    # Create output canvas
    result = np.zeros((IMG_SIZE, IMG_SIZE), dtype=np.float32)
    
    # Center the body in the frame
    y_offset = (IMG_SIZE - new_height) // 2
    x_offset = (IMG_SIZE - new_width) // 2
    
    # Handle cases where resized body is larger than frame
    src_y_start, src_y_end = 0, new_height
    src_x_start, src_x_end = 0, new_width
    dst_y_start, dst_y_end = y_offset, y_offset + new_height
    dst_x_start, dst_x_end = x_offset, x_offset + new_width
    
    if y_offset < 0:
        src_y_start = -y_offset
        dst_y_start = 0
    if y_offset + new_height > IMG_SIZE:
        src_y_end = new_height - (y_offset + new_height - IMG_SIZE)
        dst_y_end = IMG_SIZE
    
    if x_offset < 0:
        src_x_start = -x_offset
        dst_x_start = 0
    if x_offset + new_width > IMG_SIZE:
        src_x_end = new_width - (x_offset + new_width - IMG_SIZE)
        dst_x_end = IMG_SIZE
    
    # Place body in center
    result[dst_y_start:dst_y_end, dst_x_start:dst_x_end] = \
        body_resized[src_y_start:src_y_end, src_x_start:src_x_end]
    
    # Binarize to clean up interpolation artifacts
    result = (result > 0.5).astype(np.float32)
    
    return result.reshape(IMG_SIZE, IMG_SIZE, 1)
