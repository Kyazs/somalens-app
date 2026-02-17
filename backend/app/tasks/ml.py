"""
ML Task for body measurement extraction.

Orchestrates the full pipeline:
1. Image -> Segmentation -> Normalization
2. CNN Extraction
3. Ultra V3 Prediction (SVR+RF+Calibration)
4. Measurement Averaging
5. Heath-Carter Calculation
6. Body Fat Estimation (Durnin-Womersley + CUN-BAE)
"""

import os
import io
import logging
import traceback
import numpy as np
import pandas as pd
from typing import Dict, Any, Tuple, Optional
from PIL import Image

logger = logging.getLogger(__name__)

from app.celery_worker import celery_app
from app.database import engine
from sqlmodel import Session
from app.models.measurement import Measurement
from app.services.somatotype import calculate_heath_carter, classify_somatotype
from app.services.body_fat import estimate_body_fat

from app.utils.segmentation import DeepLabV3Segmenter
from app.utils.scale_normalization import normalize_silhouette_scale
from app.services.ultra_v3_predictor import UltraV3Predictor

# Path to model files
MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "ml_models")


class MLService:
    """Machine Learning service for body measurement prediction."""

    def __init__(self):
        self.cnn_model = None
        self.segmenter: Optional[DeepLabV3Segmenter] = None
        self.ultra_v3_predictor: Optional[UltraV3Predictor] = None
        self.is_loaded = False

    def load_models(self) -> None:
        """Load all ML models at startup."""
        if self.is_loaded:
            return

        # 1. Load CNN model (TensorFlow/Keras)
        try:
            import tensorflow as tf
            cnn_path = os.path.join(
                MODELS_DIR, "measurementExtractor_stdScal_img224_inp2_out9_ep151.keras"
            )
            self.cnn_model = tf.keras.models.load_model(cnn_path)
            logger.info(f"Loaded CNN model from {cnn_path}")
        except Exception as e:
            logger.warning(f"Could not load CNN model: {e}")
            self.cnn_model = None
            
        self.is_loaded = True

    def process_image_pipeline(self, image_bytes: bytes) -> Tuple[np.ndarray, np.ndarray]:
        """
        Process raw image through segmentation + normalization pipeline.
        
        Returns:
            Tuple of:
                - Raw silhouette (448, 448, 1) uint8, values 0 or 255
                - Normalized silhouette (224, 224, 1) float32, values 0-1
        """
        if self.segmenter is None:
            self.segmenter = DeepLabV3Segmenter()
        
        # Load image
        img = Image.open(io.BytesIO(image_bytes))
        img_array = np.array(img.convert('RGB'))
        
        # Step 1: Extract silhouette using DeepLabV3
        silhouette = self.segmenter.extract_silhouette(img_array)  # (448, 448, 1)
        
        # Step 2: Normalize scale to 85% coverage, resize to 224x224
        normalized = normalize_silhouette_scale(silhouette)  # (224, 224, 1)
        
        # Return both raw (for saving) and normalized (for CNN)
        return silhouette, normalized.astype(np.float32) / 255.0

    def extract_proxy_measurements(
        self, 
        front_silhouette: np.ndarray,
        side_silhouette: np.ndarray,
        gender: str,
        stature: float
    ) -> Dict[str, float]:
        """
        Extract proxy measurements from front and side silhouettes using CNN.
        
        Args:
            front_silhouette: (224, 224, 1) normalized silhouette
            side_silhouette: (224, 224, 1) normalized silhouette
            gender: 'male' or 'female'
            stature: Height in cm
            
        Returns:
            Dictionary with 9 proxy measurements
        """
        if self.cnn_model is None:
            # Return mock data if CNN not loaded
            return {
                "Stature": stature,
                "Weight": 70.0,
                "Chest_Circumference": 95.0,
                "Hip_Circumference": 95.0,
                "Waist_Circumference": 80.0,
                "Thigh_Circumference": 55.0,
                "Ankle_Circumference": 22.0,
                "Shoulder_Breadth": 45.0,
                "Knee_Height": 50.0,
            }

        # Gender one-hot: female=[1,0], male=[0,1]
        gender_female = 1.0 if gender.lower() == 'female' else 0.0
        gender_male = 1.0 if gender.lower() == 'male' else 0.0
        stature_scaled = stature / 200.0
        
        numca_input = np.array([[gender_female, gender_male, stature_scaled]], dtype=np.float32)
        
        # Silhouettes are already (224, 224, 1)
        front_input = np.expand_dims(front_silhouette, axis=0)
        side_input = np.expand_dims(side_silhouette, axis=0)

        predictions = self.cnn_model.predict([numca_input, front_input, side_input], verbose=0)
        predictions = np.real(predictions).astype(np.float64)

        # Map to measurement names (9 outputs)
        measurement_names = [
            "Stature",
            "Weight",
            "Chest_Circumference",
            "Hip_Circumference",
            "Waist_Circumference",
            "Thigh_Circumference",
            "Ankle_Circumference",
            "Shoulder_Breadth",
            "Knee_Height",
        ]

        result = {}
        for i, name in enumerate(measurement_names):
            val = predictions[0][i]
            if hasattr(val, 'real'):
                val = val.real
            
            # Clamp to minimum positive value to avoid complex number errors in downstream calcs
            if val <= 0.1:
                val = 0.1
                
            result[name] = float(val)

        return result

    def combine_measurements(self, cnn_measurements: Dict, ultra_v3_result: pd.DataFrame) -> Dict:
        """
        Average overlapping measurements from CNN and Ultra V3.
        
        Arm_Circumference_Flexed and Calf_Circumference are available from both sources.
        """
        result = {}
        
        # From Ultra V3 (calibrated skinfolds)
        result['Triceps_Skinfold'] = float(ultra_v3_result['Triceps_Skinfold'].iloc[0])
        result['Subscapular_Skinfold'] = float(ultra_v3_result['Subscapular_Skinfold'].iloc[0])
        result['Supraspinale_Skinfold'] = float(ultra_v3_result['Supraspinale_Skinfold'].iloc[0])
        result['Calf_Skinfold'] = float(ultra_v3_result['Calf_Skinfold'].iloc[0])
        result['Humerus_Breadth'] = float(ultra_v3_result['Humerus_Breadth'].iloc[0])
        result['Femur_Breadth'] = float(ultra_v3_result['Femur_Breadth'].iloc[0])
        
        # Average girths from CNN + Ultra V3
        cnn_arm = cnn_measurements.get('Arm_Circumference_Flexed', 0) or 0
        ultra_arm = float(ultra_v3_result['Arm_Circumference_Flexed'].iloc[0])
        result['Arm_Circumference_Flexed'] = (cnn_arm + ultra_arm) / 2 if cnn_arm > 0 else ultra_arm
        
        cnn_calf = cnn_measurements.get('Calf_Circumference', 0) or 0
        ultra_calf = float(ultra_v3_result['Calf_Circumference'].iloc[0])
        result['Calf_Circumference'] = (cnn_calf + ultra_calf) / 2 if cnn_calf > 0 else ultra_calf
        
        return result


# Global instance
ml_service = MLService()


def _find_uploads_dir(measurement: Measurement) -> str:
    """Find the uploads directory that contains the measurement's images."""
    front_filename = measurement.front_image_url.split("/static/")[-1] if measurement.front_image_url else None
    
    uploads_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
    backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    backend_uploads = os.path.join(backend_dir, "uploads")
    
    possible_dirs = [
        backend_uploads,
        uploads_dir,
        "/app/uploads",
        os.path.join(os.getcwd(), "uploads"),
    ]
    
    for dir_path in possible_dirs:
        if front_filename and os.path.exists(os.path.join(dir_path, front_filename)):
            return dir_path
        if os.path.isdir(dir_path):
            return dir_path
    
    raise ValueError(f"Could not find uploads directory. Tried: {possible_dirs}")


def read_images_from_filesystem(measurement: Measurement) -> Tuple[bytes, bytes]:
    """Helper to read image bytes from filesystem."""
    if not measurement.front_image_url or not measurement.side_image_url:
        raise ValueError(f"Measurement {measurement.id} missing image URLs")
        
    try:
        front_filename = measurement.front_image_url.split("/static/")[-1]
        side_filename = measurement.side_image_url.split("/static/")[-1]
        
        upload_path = _find_uploads_dir(measurement)
        
        front_path = os.path.join(upload_path, front_filename)
        side_path = os.path.join(upload_path, side_filename)
        
        with open(front_path, "rb") as f:
            front_bytes = f.read()
        with open(side_path, "rb") as f:
            side_bytes = f.read()
            
        return front_bytes, side_bytes
    except Exception as e:
        raise ValueError(f"Error reading images for {measurement.id}: {e}")


@celery_app.task(name="process_measurement")
def process_measurement(measurement_id: int):
    """
    Celery task to process measurement with full ML pipeline:
    1. Read images
    2. Segmentation + Normalization
    3. CNN Feature Extraction
    4. Ultra V3 Prediction
    5. Measurement Combination
    6. Heath-Carter Calculation
    """
    ml_service.load_models()
    
    with Session(engine) as session:
        measurement = session.get(Measurement, measurement_id)
        if not measurement:
            raise ValueError(f"Measurement {measurement_id} not found")
        
        # Read images
        try:
            front_bytes, side_bytes = read_images_from_filesystem(measurement)
        except Exception as e:
            return f"Failed: {str(e)}"
        
        # Get demographics
        gender = measurement.gender or 'male'
        weight_kg = measurement.weight or 70.0
        age = measurement.age or 25
        
        # HEIGHT PREDICTION: If height was not provided, estimate using ZoeDepth
        logger.info(f"[Measurement {measurement_id}] Height from measurement record: {measurement.height}")
        if measurement.height is None or measurement.height <= 0:
            logger.info(f"[Measurement {measurement_id}] No height provided — running ZoeDepth estimation...")
            try:
                import tempfile
                from app.services.height_estimation import ZoeDepthHeightEstimator
                
                # Save front image to a temp file for ZoeDepth (expects file path)
                with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp:
                    tmp.write(front_bytes)
                    tmp_path = tmp.name
                
                logger.info(f"[Measurement {measurement_id}] Loading ZoeDepthHeightEstimator (model_type='indoor')...")
                with ZoeDepthHeightEstimator(model_type='indoor') as estimator:
                    height_result = estimator.estimate_height_detailed(tmp_path)
                
                # Clean up temp file
                os.remove(tmp_path)
                
                logger.info(f"[Measurement {measurement_id}] ZoeDepth raw result: "
                            f"height={height_result.height_cm:.1f}cm, "
                            f"confidence={height_result.confidence:.2f}, "
                            f"reliable={height_result.is_reliable}, "
                            f"warnings={height_result.warnings}, "
                            f"details={height_result.details}")
                
                if height_result.is_reliable and 100 <= height_result.height_cm <= 250:
                    height_cm = height_result.height_cm
                    logger.info(f"[Measurement {measurement_id}] ZoeDepth predicted height: {height_cm:.1f} cm (confidence: {height_result.confidence:.2f})")
                else:
                    height_cm = 170.0  # Safe fallback
                    logger.warning(f"[Measurement {measurement_id}] ZoeDepth prediction unreliable "
                                   f"(confidence: {height_result.confidence:.2f}, "
                                   f"warnings: {height_result.warnings}). Using fallback: {height_cm} cm")
                
                # Persist the predicted height to the measurement record
                measurement.height = round(height_cm, 1)
                session.add(measurement)
                session.commit()
                session.refresh(measurement)
                
            except Exception as e:
                logger.error(f"[Measurement {measurement_id}] ZoeDepth height estimation FAILED: {e}\n"
                             f"{traceback.format_exc()}")
                logger.warning(f"[Measurement {measurement_id}] Using fallback height: 170.0 cm")
                measurement.height = 170.0
                session.add(measurement)
                session.commit()
                session.refresh(measurement)
        
        height_cm = measurement.height or 170.0
        
        # PIPELINE STEP 1: Image -> Silhouette -> Normalization
        try:
            front_raw_sil, front_sil = ml_service.process_image_pipeline(front_bytes)
            side_raw_sil, side_sil = ml_service.process_image_pipeline(side_bytes)
        except Exception as e:
            return f"Segmentation pipeline failed: {str(e)}"
        
        # Save silhouettes to disk and replace original images
        try:
            uploads_dir = _find_uploads_dir(measurement)
            
            # Save silhouette PNGs
            front_sil_filename = f"sil_front_{measurement_id}.png"
            side_sil_filename = f"sil_side_{measurement_id}.png"
            
            front_sil_img = Image.fromarray(front_raw_sil.squeeze(), mode='L')
            side_sil_img = Image.fromarray(side_raw_sil.squeeze(), mode='L')
            
            front_sil_img.save(os.path.join(uploads_dir, front_sil_filename))
            side_sil_img.save(os.path.join(uploads_dir, side_sil_filename))
            
            # Delete original uploaded images
            for url in [measurement.front_image_url, measurement.side_image_url]:
                if url:
                    orig_filename = url.split("/static/")[-1]
                    orig_path = os.path.join(uploads_dir, orig_filename)
                    if os.path.exists(orig_path):
                        os.remove(orig_path)
                        logger.info(f"[Measurement {measurement_id}] Deleted original image: {orig_filename}")
            
            # Update DB URLs to point to silhouettes
            measurement.front_image_url = f"/static/{front_sil_filename}"
            measurement.side_image_url = f"/static/{side_sil_filename}"
            session.add(measurement)
            session.commit()
            session.refresh(measurement)
            
            logger.info(f"[Measurement {measurement_id}] Saved silhouettes and updated image URLs")
        except Exception as e:
            logger.warning(f"[Measurement {measurement_id}] Failed to save silhouettes: {e}")
        
        # PIPELINE STEP 2: CNN extraction
        # This returns a dictionary of proxy measurements
        cnn_measurements = ml_service.extract_proxy_measurements(
            front_sil, side_sil, gender=gender, stature=height_cm
        )
        
        # PIPELINE STEP 3: Ultra V3 prediction (SVR + RF + calibration)
        if ml_service.ultra_v3_predictor is None:
            ml_service.ultra_v3_predictor = UltraV3Predictor()
        
        # Build input DataFrame for Ultra V3
        ultra_input = pd.DataFrame([{
            'height_cm': height_cm,
            'weight_kg': weight_kg,
            'age': age,
            'gender': gender,
            'waist_circumference': cnn_measurements.get('Waist_Circumference', 80),
            'chest_circumference': cnn_measurements.get('Chest_Circumference', 95),
            'hip_circumference': cnn_measurements.get('Hip_Circumference', 95),
        }])
        
        try:
            ultra_v3_result = ml_service.ultra_v3_predictor.predict(ultra_input)
        except Exception as e:
            return f"UltraV3 prediction failed: {str(e)}"
        
        # PIPELINE STEP 4: Combine measurements (averaging overlaps)
        final_measurements = ml_service.combine_measurements(cnn_measurements, ultra_v3_result)
        
        # PIPELINE STEP 5: Calculate Heath-Carter Somatotype
        somato = calculate_heath_carter(
            height_cm=height_cm,
            weight_kg=weight_kg,
            triceps_mm=final_measurements['Triceps_Skinfold'],
            subscapular_mm=final_measurements['Subscapular_Skinfold'],
            supraspinale_mm=final_measurements['Supraspinale_Skinfold'],
            calf_skinfold_mm=final_measurements['Calf_Skinfold'],
            humerus_breadth_cm=final_measurements['Humerus_Breadth'],
            femur_breadth_cm=final_measurements['Femur_Breadth'],
            arm_girth_cm=final_measurements['Arm_Circumference_Flexed'],
            calf_girth_cm=final_measurements['Calf_Circumference']
        )
        
        # PIPELINE STEP 6: Estimate Body Fat Percentage
        body_fat_result = estimate_body_fat(
            triceps_mm=final_measurements['Triceps_Skinfold'],
            subscapular_mm=final_measurements['Subscapular_Skinfold'],
            supraspinale_mm=final_measurements['Supraspinale_Skinfold'],
            height_cm=height_cm,
            weight_kg=weight_kg,
            age=age,
            gender=gender,
        )
        
        # Update DB
        measurement.somatotype_endo = somato['endomorphy']
        measurement.somatotype_meso = somato['mesomorphy']
        measurement.somatotype_ecto = somato['ectomorphy']
        
        measurement.somatotype_class = classify_somatotype(
            measurement.somatotype_endo,
            measurement.somatotype_meso,
            measurement.somatotype_ecto
        )
        
        # Set body fat percentage on the model field
        measurement.body_fat_percentage = body_fat_result['body_fat_percentage']
        
        # Save all intermediate data
        if not measurement.circumferences:
            measurement.circumferences = {}
            
        measurement.circumferences.update(cnn_measurements)
        measurement.circumferences.update(final_measurements)
        measurement.circumferences.update(somato)
        
        # Store body fat estimates in circumferences dict for frontend access
        measurement.circumferences['Body_Fat_Percentage'] = body_fat_result['body_fat_percentage']
        measurement.circumferences['Body_Fat_DW'] = body_fat_result['body_fat_dw']
        measurement.circumferences['Body_Fat_CUN_BAE'] = body_fat_result['body_fat_cun_bae']
        
        session.add(measurement)
        session.commit()
        session.refresh(measurement)
        
        return f"Successfully processed measurement {measurement_id}. Class: {measurement.somatotype_class}, Body Fat: {measurement.body_fat_percentage}%"
