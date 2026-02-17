"""
    Docstring for tests.zoedepth.height_from_zoedepth
    Height Estimation using ZoeDepth Metric Depth

    This module uses ZoeDepth's metric depth estimation (model_zoe_n for indoor)
    to predict human height from front-view photos.

    Key advantages over segmentation-based approach:
    - No known distance required - depth is predicted directly from the image
    - Metric output in meters (0.001m to 10m for indoor scenes)
    - Better generalization across different camera setups

    Usage:
        python height_from_zoedepth.py path/to/image.jpg
        python height_from_zoedepth.py path/to/image.jpg --fov 75.5
        python height_from_zoedepth.py path/to/image.jpg --save-depth ./output

    Author: Somalens Project
    Date: February 2026
"""

import os
import math
from pathlib import Path
from typing import Optional, Dict, Tuple, List, Any
from dataclasses import dataclass, field
import urllib.request

import cv2
import numpy as np
import torch
from PIL import Image

# Path configuration for somalens-app backend
# services/ is 2 levels deep from backend root: backend/app/services/
BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
MODEL_CACHE_DIR = BACKEND_ROOT / "app" / "ml_models"

# Subdirectories for organized caching
ZOEDEPTH_CACHE_DIR = MODEL_CACHE_DIR / "zoedepth"
MEDIAPIPE_CACHE_DIR = MODEL_CACHE_DIR / "mediapipe"

# MediaPipe for pose landmarks (still needed for head/feet detection)
import mediapipe as mp

# Aliases using the standard mediapipe public API
_BaseOptions = mp.tasks.BaseOptions
_PoseLandmarker = mp.tasks.vision.PoseLandmarker
_PoseLandmarkerOptions = mp.tasks.vision.PoseLandmarkerOptions
_Image = mp.Image
_ImageFormat = mp.ImageFormat
_RunningMode = mp.tasks.vision.RunningMode

# MediaPipe model URL
POSE_LANDMARKER_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task"

# ============================================================================
# Camera Calibration Profiles
# ============================================================================
# Calibrated effective FOV values for ZoeDepth auto-depth estimation.
# These are NOT the raw EXIF FOV values — they are "effective" FOVs optimized
# against ground truth to compensate for ZoeDepth's systematic depth bias.
#
# Camera: Nothing Phone 3a (Model A059P)
#   Ultra-wide (0.6x): EXIF 35mm equiv = 15mm, raw HFOV ≈ 100.4°, sensor 3280×2464
#   Main (1.0x):        EXIF 35mm equiv = 24mm, raw HFOV ≈ 73.7°,  sensor 4096×3072
#
# Calibrated via grid search over 30-subject dataset (MAE minimization):
CAMERA_PROFILES = {
    'ultra_wide': {
        'fov_degrees': 100.4,       # Calibrated effective FOV for ZoeDepth (pad_input=False)
        'landscape_width': 3280,
        'landscape_height': 2464,
    },
    'main': {
        'fov_degrees': 65,       # Calibrated effective FOV for ZoeDepth (pad_input=False)
        'landscape_width': 4096,
        'landscape_height': 3072,
    },
}

# Default fallback FOV when image dimensions don't match any known profile
DEFAULT_FALLBACK_FOV = 65


@dataclass
class HeightEstimationResult:
    """Result of height estimation with confidence and warnings."""
    height_cm: float
    confidence: float  # 0.0-1.0
    warnings: List[str] = field(default_factory=list)
    details: Dict[str, Any] = field(default_factory=dict)
    
    @property
    def is_reliable(self) -> bool:
        """True if confidence > 0.7 and no critical warnings."""
        critical = ['no_person_detected', 'pose_failed', 'head_clipped', 'feet_clipped', 'depth_failed']
        return self.confidence > 0.7 and not any(w in self.warnings for w in critical)


class ZoeDepthHeightEstimator:
    """
    Estimates human height using ZoeDepth metric depth estimation.
    
    Unlike the segmentation-based approach, this does NOT require a known
    distance to the subject. ZoeDepth predicts absolute depth in meters.
    
    Height Formula:
        real_height_m = (pixel_height * depth_at_subject) / focal_length_pixels
    
    Where:
        - pixel_height: Height in pixels (feet_y - head_top_y)
        - depth_at_subject: Predicted depth in meters from ZoeDepth
        - focal_length_pixels: Derived from FOV and image width
    """
    
    # MediaPipe pose landmark indices for feet
    LEFT_HEEL = 29
    RIGHT_HEEL = 30
    LEFT_FOOT_INDEX = 31
    RIGHT_FOOT_INDEX = 32
    
    # Landmark indices for depth sampling
    LEFT_SHOULDER = 11
    RIGHT_SHOULDER = 12
    LEFT_HIP = 23
    RIGHT_HIP = 24
    NOSE = 0
    
    def __init__(
        self,
        fov_degrees: Optional[float] = None,  # None = auto-detect from image resolution
        image_width: int = 3072,               # Reference image width (only used when fov_degrees is set)
        device: Optional[str] = None,          # 'cuda', 'cpu', or None for auto
        use_flip_aug: bool = True,             # Use horizontal flip augmentation
        model_type: str = 'indoor',            # 'indoor' (ZoeD_N), 'outdoor' (ZoeD_K), or 'general' (ZoeD_NK)
    ):
        """
        Initialize the ZoeDepth-based height estimator.
        
        Args:
            fov_degrees: Horizontal Field of View in degrees.
                         None (default) = auto-detect camera type from image
                         resolution and use calibrated FOV per camera profile.
            image_width: Reference image width for focal length calculation
                         (only relevant when fov_degrees is explicitly set)
            device: 'cuda', 'cpu', or None for auto-detect
            use_flip_aug: Enable horizontal flip augmentation for better accuracy
            model_type: 'indoor' (ZoeD_N), 'outdoor' (ZoeD_K), or 'general' (ZoeD_NK)
        """
        self.fov_degrees = fov_degrees  # None = auto-detect per image
        self.image_width = image_width
        self.use_flip_aug = use_flip_aug
        
        # Validate and map model type
        valid_models = {
            'indoor': 'ZoeD_N',
            'outdoor': 'ZoeD_K',
            'general': 'ZoeD_NK'
        }
        if model_type not in valid_models:
            raise ValueError(f"Invalid model_type '{model_type}'. Choose from: {list(valid_models.keys())}")
        
        self.model_type = model_type
        self.model_name = valid_models[model_type]
        
        # Set max depth based on model type
        if model_type == 'indoor':
            self.max_depth = 10.0
        else:
            self.max_depth = 80.0  # Outdoor models (KITTI) go up to 80m
        
        # Calculate focal length in pixels (only when FOV is explicitly set)
        if fov_degrees is not None:
            self.focal_length_px = image_width / (2 * math.tan(math.radians(fov_degrees / 2)))
        else:
            self.focal_length_px = None  # Will be computed per-image in estimate_height_detailed
        
        # Device selection
        if device is None:
            self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        else:
            self.device = device
        
        # Lazy-loaded models
        self._zoedepth_model = None
        self._pose_landmarker: Optional[_PoseLandmarker] = None
        self._pose_model_path: Optional[str] = None
    
    @staticmethod
    def detect_camera_profile(width: int, height: int) -> Tuple[str, float]:
        """
        Detect camera type from image dimensions and return calibrated FOV.
        
        Uses max(width, height) to handle portrait orientation.
        
        Args:
            width: Image width in pixels
            height: Image height in pixels
            
        Returns:
            Tuple of (camera_name, calibrated_fov_degrees)
        """
        max_dim = max(width, height)
        min_dim = min(width, height)
        
        # Match against known camera profiles
        for name, profile in CAMERA_PROFILES.items():
            if max_dim == profile['landscape_width'] and min_dim == profile['landscape_height']:
                return name, profile['fov_degrees']
        
        # No match — return fallback
        return 'unknown', DEFAULT_FALLBACK_FOV
    
    def _ensure_mediapipe_model(self) -> str:
        """Download MediaPipe model if not cached."""
        MEDIAPIPE_CACHE_DIR.mkdir(parents=True, exist_ok=True)
        
        # Check both filename variants (download script vs old Docker curl naming)
        filenames = [
            "pose_landmarker_heavy.task",
            "pose_landmarker_pose_landmarker_heavy.task",
        ]
        
        for filename in filenames:
            filepath = MEDIAPIPE_CACHE_DIR / filename
            if filepath.exists():
                return str(filepath)
        
        # Not found — download to the standard name
        filepath = MEDIAPIPE_CACHE_DIR / filenames[0]
        print(f"Downloading MediaPipe PoseLandmarker model...")
        urllib.request.urlretrieve(POSE_LANDMARKER_MODEL_URL, filepath)
        print(f"Downloaded to: {filepath}")
        
        return str(filepath)
    
    def _load_zoedepth(self):
        """Load ZoeDepth model (lazy loading) with compatibility fix for newer timm."""
        if self._zoedepth_model is not None:
            return
        
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info(f"Loading ZoeDepth model ({self.model_name} for {self.model_type})...")
        logger.info(f"Device: {self.device}")
        
        # Set ZoeDepth-specific hub cache directory WITHOUT affecting global TORCH_HOME
        # (global TORCH_HOME override breaks DeepLabV3 which expects /app/data/torch)
        ZOEDEPTH_CACHE_DIR.mkdir(parents=True, exist_ok=True)
        zoedepth_hub_dir = str(ZOEDEPTH_CACHE_DIR / "hub")
        
        # Save and set hub directory
        old_hub_dir = torch.hub.get_dir()
        torch.hub.set_dir(zoedepth_hub_dir)
        
        # Log what's available in the cache for debugging
        checkpoints_dir = ZOEDEPTH_CACHE_DIR / "hub" / "checkpoints"
        if checkpoints_dir.exists():
            cached_files = list(checkpoints_dir.glob("*.pt"))
            logger.info(f"ZoeDepth checkpoints dir has {len(cached_files)} .pt files: {[f.name for f in cached_files]}")
        else:
            logger.warning(f"ZoeDepth checkpoints dir does not exist: {checkpoints_dir}")
        
        try:
            # Warm up MiDaS dependency (may print warnings, that's OK)
            try:
                torch.hub.help("intel-isl/MiDaS", "DPT_BEiT_L_384", trust_repo=True)
            except Exception:
                pass  # May fail if already cached
            
            try:
                # Try normal loading first
                self._zoedepth_model = torch.hub.load(
                    "isl-org/ZoeDepth", 
                    self.model_name, 
                    pretrained=True,
                    trust_repo=True
                )
            except RuntimeError as e:
                if "Unexpected key" in str(e) or "Missing key" in str(e):
                    logger.warning("Detected timm version mismatch. Applying compatibility fix...")
                    
                    # Load model structure without pretrained weights
                    self._zoedepth_model = torch.hub.load(
                        "isl-org/ZoeDepth", 
                        self.model_name, 
                        pretrained=False,
                        trust_repo=True
                    )
                    
                    # Map model name to weights filename/URL
                    weights_map = {
                        'ZoeD_N': ("ZoeD_M12_N.pt", "https://github.com/isl-org/ZoeDepth/releases/download/v1.0/ZoeD_M12_N.pt"),
                        'ZoeD_K': ("ZoeD_M12_K.pt", "https://github.com/isl-org/ZoeDepth/releases/download/v1.0/ZoeD_M12_K.pt"),
                        'ZoeD_NK': ("ZoeD_M12_NK.pt", "https://github.com/isl-org/ZoeDepth/releases/download/v1.0/ZoeD_M12_NK.pt")
                    }
                    
                    filename, url = weights_map.get(self.model_name, (None, None))
                    if not filename:
                        raise ValueError(f"Unknown weights for model: {self.model_name}")
                    
                    # Download and load weights manually with strict=False
                    weights_path = ZOEDEPTH_CACHE_DIR / "hub" / "checkpoints" / filename
                    
                    if not weights_path.exists():
                        logger.info(f"Downloading weights to {weights_path}...")
                        weights_path.parent.mkdir(parents=True, exist_ok=True)
                        torch.hub.download_url_to_file(url, str(weights_path))
                    
                    # Load state dict with strict=False to ignore mismatched keys
                    state_dict = torch.load(str(weights_path), map_location='cpu', weights_only=False)
                    if 'model' in state_dict:
                        state_dict = state_dict['model']
                    
                    # Load with strict=False (ignores unexpected/missing keys)
                    missing, unexpected = self._zoedepth_model.load_state_dict(state_dict, strict=False)
                    
                    if unexpected:
                        logger.info(f"  Ignored {len(unexpected)} unexpected keys (timm version difference)")
                    if missing:
                        logger.warning(f"  Warning: {len(missing)} missing keys")
                else:
                    raise e
            
            self._zoedepth_model = self._zoedepth_model.to(self.device).eval()
            
            # Monkey-patch for newer timm versions where Block.drop_path was
            # split into drop_path1/drop_path2. ZoeDepth/MiDaS code expects
            # the old single drop_path attribute.
            patched_count = 0
            for module in self._zoedepth_model.modules():
                if hasattr(module, 'drop_path1') and not hasattr(module, 'drop_path'):
                    module.drop_path = module.drop_path1
                    patched_count += 1
            if patched_count:
                logger.info(f"  Patched {patched_count} Block modules with drop_path compatibility shim")
            
            logger.info(f"ZoeDepth model ({self.model_name}) loaded successfully!")
        finally:
            # Always restore the original hub directory so DeepLabV3 and other
            # models can find their cached weights at the expected TORCH_HOME location
            torch.hub.set_dir(old_hub_dir)
    
    def _load_pose(self):
        """Load MediaPipe PoseLandmarker (lazy loading)."""
        if self._pose_landmarker is not None:
            return
        
        if self._pose_model_path is None:
            self._pose_model_path = self._ensure_mediapipe_model()
        
        base_options = _BaseOptions(model_asset_path=self._pose_model_path)
        options = _PoseLandmarkerOptions(
            base_options=base_options,
            running_mode=_RunningMode.IMAGE,
            num_poses=1,
            min_pose_detection_confidence=0.5,
            min_pose_presence_confidence=0.5,
            min_tracking_confidence=0.5,
            output_segmentation_masks=True
        )
        self._pose_landmarker = _PoseLandmarker.create_from_options(options)
    
    def _image_to_mp_image(self, image: np.ndarray) -> _Image:
        """Convert OpenCV BGR image to MediaPipe Image."""
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        return _Image(image_format=_ImageFormat.SRGB, data=image_rgb)
    
    def get_depth_map(self, image: np.ndarray) -> np.ndarray:
        """
        Get metric depth map using ZoeDepth.
        
        Args:
            image: BGR image (OpenCV format)
            
        Returns:
            Depth map in meters (H x W numpy array)
        """
        self._load_zoedepth()
        
        # Convert BGR to RGB PIL Image
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        pil_image = Image.fromarray(image_rgb)
        
        # Inference with ZoeDepth
        with torch.no_grad():
            depth = self._zoedepth_model.infer_pil(
                pil_image,
                output_type="numpy",
                pad_input=False,
                with_flip_aug=self.use_flip_aug
            )
        
        return depth  # Values are in METERS
    
    def get_head_top_from_segmentation(
        self, 
        pose_results, 
        image_shape: Tuple[int, int]
    ) -> Optional[float]:
        """Get head top Y coordinate from segmentation mask."""
        h, w = image_shape
        
        if pose_results.segmentation_masks and len(pose_results.segmentation_masks) > 0:
            mask = pose_results.segmentation_masks[0].numpy_view()
            
            if len(mask.shape) == 3:
                mask = mask.squeeze()
            
            mask_binary = mask > 0.5
            person_pixels = np.where(mask_binary)
            
            if len(person_pixels[0]) > 0:
                return float(person_pixels[0].min())
        
        return None
    
    def get_feet_from_pose(self, landmarks, image_height: int) -> Optional[float]:
        """Get feet Y coordinate from pose landmarks."""
        if landmarks is None:
            return None
        
        h = image_height
        
        left_heel_y = landmarks[self.LEFT_HEEL].y * h
        right_heel_y = landmarks[self.RIGHT_HEEL].y * h
        left_foot_y = landmarks[self.LEFT_FOOT_INDEX].y * h
        right_foot_y = landmarks[self.RIGHT_FOOT_INDEX].y * h
        
        return max(left_heel_y, right_heel_y, left_foot_y, right_foot_y)
    
    def get_depth_at_body(
        self, 
        depth_map: np.ndarray, 
        landmarks, 
        image_shape: Tuple[int, int],
        method: str = 'torso_median'
    ) -> float:
        """
        Sample depth at the subject's body.
        
        Args:
            depth_map: Depth map in meters
            landmarks: Pose landmarks
            image_shape: (height, width) of original image
            method: 'torso_median', 'center', or 'nose'
            
        Returns:
            Depth value in meters
        """
        h, w = image_shape
        depth_h, depth_w = depth_map.shape[:2]
        
        # Scale factor if depth map resolution differs
        scale_y = depth_h / h
        scale_x = depth_w / w
        
        if method == 'torso_median':
            # Sample depth at torso region
            mid_shoulder_x = (landmarks[self.LEFT_SHOULDER].x + landmarks[self.RIGHT_SHOULDER].x) / 2 * w
            mid_shoulder_y = (landmarks[self.LEFT_SHOULDER].y + landmarks[self.RIGHT_SHOULDER].y) / 2 * h
            mid_hip_x = (landmarks[self.LEFT_HIP].x + landmarks[self.RIGHT_HIP].x) / 2 * w
            mid_hip_y = (landmarks[self.LEFT_HIP].y + landmarks[self.RIGHT_HIP].y) / 2 * h
            
            center_x = int((mid_shoulder_x + mid_hip_x) / 2 * scale_x)
            center_y = int((mid_shoulder_y + mid_hip_y) / 2 * scale_y)
            
            # Sample in a region for robustness
            margin = 20
            y1 = max(0, center_y - margin)
            y2 = min(depth_h, center_y + margin)
            x1 = max(0, center_x - margin)
            x2 = min(depth_w, center_x + margin)
            
            region = depth_map[y1:y2, x1:x2]
            valid = region[(region > 0.1) & (region < self.max_depth)]
            
            if len(valid) > 0:
                return float(np.median(valid))
        
        elif method == 'nose':
            nose_x = int(landmarks[self.NOSE].x * w * scale_x)
            nose_y = int(landmarks[self.NOSE].y * h * scale_y)
            nose_x = min(max(0, nose_x), depth_w - 1)
            nose_y = min(max(0, nose_y), depth_h - 1)
            return float(depth_map[nose_y, nose_x])
        
        elif method == 'center':
            center_x = depth_w // 2
            center_y = depth_h // 2
            return float(depth_map[center_y, center_x])
        
        # Fallback
        valid = depth_map[(depth_map > 0.1) & (depth_map < self.max_depth)]
        if len(valid) > 0:
            return float(np.median(valid))
        return 1.5  # Default fallback
    
    def _check_boundaries(
        self, 
        head_top_y: float, 
        feet_y: float, 
        image_height: int
    ) -> List[str]:
        """Check if head/feet are near image edges."""
        warnings = []
        margin = 0.02 * image_height
        
        if head_top_y < margin:
            warnings.append('head_clipped')
        if feet_y > image_height - margin:
            warnings.append('feet_clipped')
            
        return warnings
    
    def _check_sanity_bounds(self, height_cm: float) -> List[str]:
        """Check if height is within human range."""
        warnings = []
        if height_cm < 50:
            warnings.append('height_below_minimum')
        elif height_cm > 250:
            warnings.append('height_above_maximum')
        return warnings
    
    def _check_depth_sanity(self, depth_m: float) -> List[str]:
        """Check if depth is within reasonable indoor range."""
        warnings = []
        if depth_m < 0.5:
            warnings.append('depth_too_close')
        elif depth_m > 8.0:
            warnings.append('depth_too_far')
        return warnings
    
    def estimate_height(self, image_path: str) -> float:
        """
        Estimate height from a front-view photo.
        
        Args:
            image_path: Path to the image file
            
        Returns:
            Estimated height in centimeters
        """
        result = self.estimate_height_detailed(image_path)
        return result.height_cm
    
    def estimate_height_detailed(self, image_path: str) -> HeightEstimationResult:
        """
        Estimate height with detailed measurements and diagnostics.
        
        Args:
            image_path: Path to the image file
            
        Returns:
            HeightEstimationResult with height_cm, confidence, warnings, details
        """
        warnings = []
        details = {}
        
        # Load image
        image = cv2.imread(image_path)
        if image is None:
            return HeightEstimationResult(
                height_cm=0.0,
                confidence=0.0,
                warnings=['image_load_failed'],
                details={'error': f'Could not load image: {image_path}'}
            )
        
        h, w = image.shape[:2]
        details['image_size'] = (w, h)
        
        # === 1. Get Depth Map from ZoeDepth ===
        try:
            depth_map = self.get_depth_map(image)
            details['depth_map_shape'] = depth_map.shape
            details['depth_range'] = (float(depth_map.min()), float(depth_map.max()))
        except Exception as e:
            return HeightEstimationResult(
                height_cm=0.0,
                confidence=0.0,
                warnings=['depth_failed'],
                details={'error': f'ZoeDepth failed: {str(e)}'}
            )
        
        # === 2. Get Pose Landmarks ===
        self._load_pose()
        mp_image = self._image_to_mp_image(image)
        pose_results = self._pose_landmarker.detect(mp_image)
        
        if not pose_results.pose_landmarks or len(pose_results.pose_landmarks) == 0:
            return HeightEstimationResult(
                height_cm=0.0,
                confidence=0.0,
                warnings=['pose_failed'],
                details=details
            )
        
        landmarks = pose_results.pose_landmarks[0]
        
        # === 3. Get Head Top from Segmentation ===
        head_top_y = self.get_head_top_from_segmentation(pose_results, (h, w))
        
        if head_top_y is None:
            return HeightEstimationResult(
                height_cm=0.0,
                confidence=0.0,
                warnings=['no_person_detected'],
                details=details
            )
        
        details['head_top_y'] = head_top_y
        
        # === 4. Get Feet from Pose Landmarks ===
        feet_y = self.get_feet_from_pose(landmarks, h)
        
        if feet_y is None:
            return HeightEstimationResult(
                height_cm=0.0,
                confidence=0.0,
                warnings=['feet_detection_failed'],
                details=details
            )
        
        details['feet_y'] = feet_y
        
        # Check boundaries
        warnings.extend(self._check_boundaries(head_top_y, feet_y, h))
        
        # === 5. Calculate Pixel Height ===
        pixel_height = feet_y - head_top_y
        details['pixel_height'] = pixel_height
        
        if pixel_height <= 0:
            return HeightEstimationResult(
                height_cm=0.0,
                confidence=0.0,
                warnings=['invalid_pixel_height'],
                details=details
            )
        
        # === 6. Get Depth at Subject ===
        body_depth_m = self.get_depth_at_body(
            depth_map, landmarks, (h, w), method='torso_median'
        )
        details['body_depth_m'] = body_depth_m
        
        # Check depth sanity
        warnings.extend(self._check_depth_sanity(body_depth_m))
        
        # === 7. Calculate Focal Length ===
        if self.fov_degrees is not None:
            # Explicit FOV mode: scale focal length from reference width
            scale = w / self.image_width
            focal_length = self.focal_length_px * scale  # type: ignore[operator]
            used_fov = self.fov_degrees
            camera_name = 'manual'
        else:
            # Auto-detect camera from image dimensions
            camera_name, used_fov = self.detect_camera_profile(w, h)
            # Compute focal length using image width (max dimension for portrait)
            # For portrait images, the "horizontal" dimension is the shorter one
            # but the FOV was calibrated assuming landscape width = max(w, h)
            ref_width = max(w, h)
            focal_length = ref_width / (2 * math.tan(math.radians(used_fov / 2)))
        
        details['focal_length_px'] = focal_length
        details['fov_degrees'] = used_fov
        details['camera_profile'] = camera_name
        is_portrait = h > w
        details['is_portrait'] = is_portrait
        
        # === 8. Calculate Real Height ===
        # Pinhole camera model: H_real = (H_pixel * Depth) / Focal_Length
        real_height_m = (pixel_height * body_depth_m) / focal_length
        height_cm = real_height_m * 100
        details['height_cm'] = height_cm
        
        # Sanity check
        warnings.extend(self._check_sanity_bounds(height_cm))
        
        # === 9. Calculate Confidence ===
        confidence = 1.0 - len(warnings) * 0.1
        confidence = max(0.0, min(1.0, confidence))
        
        return HeightEstimationResult(
            height_cm=height_cm,
            confidence=confidence,
            warnings=warnings,
            details=details
        )
    
    def save_depth_visualization(
        self,
        image_path: str,
        output_dir: str,
        filename_prefix: Optional[str] = None
    ) -> Dict[str, str]:
        """Save depth map visualization."""
        import matplotlib.pyplot as plt
        
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError(f"Could not load image: {image_path}")
        
        depth_map = self.get_depth_map(image)
        
        os.makedirs(output_dir, exist_ok=True)
        
        if filename_prefix is None:
            filename_prefix = Path(image_path).stem
        
        saved = {}
        
        # Save raw depth as 16-bit PNG
        depth_16bit = (depth_map * 256).astype(np.uint16)
        raw_path = os.path.join(output_dir, f"{filename_prefix}_depth_raw.png")
        cv2.imwrite(raw_path, depth_16bit)
        saved['raw'] = raw_path
        
        # Save colorized depth
        plt.figure(figsize=(10, 8))
        plt.imshow(depth_map, cmap='plasma')
        plt.colorbar(label='Depth (meters)')
        plt.title(f'ZoeDepth Estimation - {filename_prefix}')
        plt.axis('off')
        color_path = os.path.join(output_dir, f"{filename_prefix}_depth_color.png")
        plt.savefig(color_path, bbox_inches='tight', dpi=150)
        plt.close()
        saved['colorized'] = color_path
        
        return saved
    
    def close(self):
        """Release resources."""
        if self._pose_landmarker is not None:
            self._pose_landmarker.close()
            self._pose_landmarker = None
        self._zoedepth_model = None
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
        return False


# ============================================================================
# CLI INTERFACE
# ============================================================================

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Estimate human height using ZoeDepth metric depth.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python height_from_zoedepth.py photo.jpg
  python height_from_zoedepth.py photo.jpg --fov 75.5
  python height_from_zoedepth.py photo.jpg --save-depth ./output
        """
    )
    parser.add_argument("image_path", help="Path to the image file")
    parser.add_argument("--fov", type=float, default=None,
                        help="Horizontal FOV in degrees (default: auto-detect from image)")
    parser.add_argument("--width", type=int, default=3072,
                        help="Reference image width (default: 3072, only used with --fov)")
    parser.add_argument("--device", type=str, default=None,
                        help="Device: 'cuda' or 'cpu' (default: auto)")
    parser.add_argument("--no-flip-aug", action="store_true",
                        help="Disable horizontal flip augmentation")
    parser.add_argument("--save-depth", type=str, metavar="DIR",
                        help="Save depth visualization to directory")
    parser.add_argument("--model", type=str, default="indoor", choices=["indoor", "outdoor", "general"],
                        help="Model type: indoor (ZoeD_N), outdoor (ZoeD_K), or general (ZoeD_NK)")
    
    args = parser.parse_args()
    
    if not os.path.exists(args.image_path):
        print(f"Error: Image not found: {args.image_path}")
        sys.exit(1)
    
    print("=" * 60)
    print(f"ZoeDepth Height Estimator ({args.model.capitalize()})")
    print("=" * 60)
    print(f"Image: {args.image_path}")
    print(f"FOV: {args.fov or 'auto-detect'}")
    print(f"Device: {args.device or 'auto'}")
    print(f"Model Type: {args.model}")
    print()
    
    try:
        estimator = ZoeDepthHeightEstimator(
            fov_degrees=args.fov,
            image_width=args.width,
            device=args.device,
            use_flip_aug=not args.no_flip_aug,
            model_type=args.model
        )
        
        with estimator:
            result = estimator.estimate_height_detailed(args.image_path)
            
            print(f"Estimated Height: {result.height_cm:.1f} cm")
            print(f"Confidence: {result.confidence:.2f}")
            print(f"Reliable: {result.is_reliable}")
            
            if result.warnings:
                print(f"Warnings: {', '.join(result.warnings)}")
            
            print("\nDetails:")
            for key, value in result.details.items():
                if isinstance(value, float):
                    print(f"  {key}: {value:.3f}")
                else:
                    print(f"  {key}: {value}")
            
            if args.save_depth:
                print(f"\nSaving depth visualization...")
                paths = estimator.save_depth_visualization(
                    args.image_path,
                    args.save_depth
                )
                for name, path in paths.items():
                    print(f"  {name}: {path}")
    
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)