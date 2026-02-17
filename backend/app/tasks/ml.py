"""
ML Task for body measurement extraction (V4 Pipeline).

Orchestrates the full V4 pipeline:
1. Image -> Segmentation -> Normalization
2. CNN Extraction with z-score inverse transform
3. Ultra V3 V2 Prediction (SVR V2.1 + RF v2.2n)
4. G13 Skinfold Calibration (BayesianRidge)
5. G38 Girth/Breadth Calibration (BayesianRidge)
6. Heath-Carter Somatotype Calculation
7. S5_g0.25 Bias Correction
8. Classification with T=1.75
9. Body Fat Estimation (Durnin-Womersley + CUN-BAE)
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
from app.services.measurement_calibration import MeasurementCalibrator
from app.services.bias_correction import SomatotypeBiasCorrector, OPERATING_THRESHOLD

# Path to model files
MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "ml_models")

# Population mean/std for CNN output inverse transform (z-score -> cm)
# Computed from ANSUR TOTAL dataset (10050 samples, male + female)
# The CNN was trained with manual z-scoring: y = (measurement - mean) / std
# so inverse transform is: measurement_cm = z * std + mean
CNN_OUTPUT_MEANS = np.array([
    99.140537,   # chest_circumference (cm)
    100.196866,  # buttock_circumference (cm)
    85.981602,   # waist_circumference (cm)
    60.845264,   # thigh_circumference (cm)
    22.002975,   # ankle_circumference (cm)
    39.076905,   # biacromial_breadth (cm)
    53.799095,   # knee_height_sitting (cm)
    32.722766,   # arm_circumference_flexed (cm)
    37.723652,   # calf_circumference (cm)
], dtype=np.float64)

CNN_OUTPUT_STDS = np.array([
    9.988770,    # chest_circumference
    7.437390,    # buttock_circumference
    12.474717,   # waist_circumference
    5.658358,    # thigh_circumference
    1.672453,    # ankle_circumference
    2.999154,    # biacromial_breadth
    3.445491,    # knee_height_sitting
    4.334270,    # arm_circumference_flexed
    3.133144,    # calf_circumference
], dtype=np.float64)


class MLService:
    """Machine Learning service for body measurement prediction (V4 Pipeline)."""

    def __init__(self):
        self.cnn_model = None
        self.segmenter: Optional[DeepLabV3Segmenter] = None
        self.ultra_v3_predictor: Optional[UltraV3Predictor] = None
        self.measurement_calibrator: Optional[MeasurementCalibrator] = None
        self.bias_corrector: Optional[SomatotypeBiasCorrector] = None
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
        
        img = Image.open(io.BytesIO(image_bytes))
        img_array = np.array(img.convert('RGB'))
        
        silhouette = self.segmenter.extract_silhouette(img_array)
        normalized = normalize_silhouette_scale(silhouette)
        
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
        Applies z-score inverse transform to get measurements in cm.
        """
        measurement_names = [
            "chest_circumference", "buttock_circumference", "waist_circumference",
            "thigh_circumference", "ankle_circumference", "biacromial_breadth",
            "knee_height_sitting", "arm_circumference_flexed", "calf_circumference",
        ]

        if self.cnn_model is None:
            return {
                "chest_circumference": 95.0,
                "buttock_circumference": 95.0,
                "waist_circumference": 80.0,
                "thigh_circumference": 55.0,
                "ankle_circumference": 22.0,
                "biacromial_breadth": 39.0,
                "knee_height_sitting": 54.0,
                "arm_circumference_flexed": 32.0,
                "calf_circumference": 37.0,
            }

        gender_female = 1.0 if gender.lower() == 'female' else 0.0
        gender_male = 1.0 if gender.lower() == 'male' else 0.0
        stature_scaled = stature / 200.0
        
        numca_input = np.array([[gender_female, gender_male, stature_scaled]], dtype=np.float32)
        
        front_input = np.expand_dims(front_silhouette, axis=0)
        side_input = np.expand_dims(side_silhouette, axis=0)

        predictions = self.cnn_model.predict([numca_input, front_input, side_input], verbose=0)
        predicted_values = np.real(predictions[0]).astype(np.float64)

        # Inverse z-score transform: measurement_cm = z * std + mean
        predicted_values_cm = predicted_values * CNN_OUTPUT_STDS + CNN_OUTPUT_MEANS

        print(f"CNN Extraction Complete (z-score -> cm inverse transform applied):")
        result = {}
        for i, name in enumerate(measurement_names):
            val = float(predicted_values_cm[i])
            if val <= 0.1:
                val = 0.1
            result[name] = val
            print(f"   {name}: z={float(predicted_values[i]):.4f} -> {val:.2f} cm")

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
    Celery task to process measurement with full V4 ML pipeline:
    Step 1: Image -> Segmentation -> Normalization
    Step 2: CNN Extraction with z-score inverse transform
    Step 3: Ultra V3 V2 Prediction (SVR V2.1 + RF v2.2n)
    Step 4: G13 Skinfold Calibration
    Step 5: G38 Girth/Breadth Calibration
    Step 6: Heath-Carter Somatotype Calculation
    Step 7: S5_g0.25 Bias Correction
    Step 8: Classification with T=1.75
    Step 9: Body Fat Estimation
    """
    ml_service.load_models()
    
    with Session(engine) as session:
        measurement = session.get(Measurement, measurement_id)
        if not measurement:
            raise ValueError(f"Measurement {measurement_id} not found")
        
        try:
            front_bytes, side_bytes = read_images_from_filesystem(measurement)
        except Exception as e:
            return f"Failed: {str(e)}"
        
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
                session.add(measurement)https://github.com/Kyazs/somalens-app/pull/15/conflict?name=backend%252Fapp%252Ftasks%252Fml.py&ancestor_oid=311ff522d37f1014721bf69acfd509538b81b732&base_oid=82823fc7adc103aa304b6c0cb58ebbcb92b01d09&head_oid=a1dfec5e736debcd9f9559125718438f743b7bca
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
        
        # STEP 3: Ultra V3 V2 prediction using predict_with_raw()
        if ml_service.ultra_v3_predictor is None:
            ml_service.ultra_v3_predictor = UltraV3Predictor()
        
        # Build input DataFrame with V4 CNN measurement mapping
        ultra_input_data = {
            'height_cm': height_cm,
            'weight_kg': weight_kg,
            'age': age,
            'gender': gender,
            'waist_circumference': cnn_measurements.get('waist_circumference', 80),
            'chest_circumference': cnn_measurements.get('chest_circumference', 95),
            'thigh_circumference': cnn_measurements.get('thigh_circumference', 55),
            'ankle_circumference': cnn_measurements.get('ankle_circumference', 22),
            'calf_circumference': cnn_measurements.get('calf_circumference', 37),
            'arm_circumference_flexed': cnn_measurements.get('arm_circumference_flexed', 32),
        }
        
        # Map CNN names to Ultra V3 expected names
        if 'buttock_circumference' in cnn_measurements:
            ultra_input_data['hip_circumference'] = cnn_measurements['buttock_circumference']
        if 'biacromial_breadth' in cnn_measurements:
            ultra_input_data['shoulder_breadth'] = cnn_measurements['biacromial_breadth']
        if 'knee_height_sitting' in cnn_measurements:
            ultra_input_data['knee_height'] = cnn_measurements['knee_height_sitting']
        
        ultra_input = pd.DataFrame([ultra_input_data])
        
        try:
            # Get BOTH calibrated and raw (pre-Filipino-calibration) predictions
            ultra_v3_calibrated, ultra_v3_raw = ml_service.ultra_v3_predictor.predict_with_raw(ultra_input)
        except Exception as e:
            return f"UltraV3 prediction failed: {str(e)}"
        
        print(f"Ultra V3 Predictions (calibrated | raw):")
        for col in ultra_v3_calibrated.columns:
            cal_val = ultra_v3_calibrated[col].iloc[0]
            raw_val = ultra_v3_raw[col].iloc[0]
            print(f"   {col}: {cal_val:.2f} (raw: {raw_val:.2f})")
        
        # STEP 4: G13 Skinfold Calibration (using raw/uncalibrated predictions)
        if ml_service.measurement_calibrator is None:
            ml_service.measurement_calibrator = MeasurementCalibrator()
            ml_service.measurement_calibrator.load_models()
        
        # CNN features for G13 (already in cm after inverse transform)
        g13_cnn_features = {
            'ankle_cm': cnn_measurements.get('ankle_circumference', 0),
            'shoulder_cm': cnn_measurements.get('biacromial_breadth', 0),
            'arm_cm': cnn_measurements.get('arm_circumference_flexed', 0),
            'calf_cm': cnn_measurements.get('calf_circumference', 0),
            'waist_cm': cnn_measurements.get('waist_circumference', 0),
            'hip_cm': cnn_measurements.get('buttock_circumference', 0),
        }
        
        # Use UNCALIBRATED predictions for G13 (trained on raw SVR/RF outputs)
        raw_svr_preds = {
            'Triceps_Skinfold': float(ultra_v3_raw['Triceps_Skinfold'].iloc[0]),
            'Subscapular_Skinfold': float(ultra_v3_raw['Subscapular_Skinfold'].iloc[0]),
            'Supraspinale_Skinfold': float(ultra_v3_raw['Supraspinale_Skinfold'].iloc[0]),
            'Calf_Skinfold': float(ultra_v3_raw['Calf_Skinfold'].iloc[0]),
        }
        rf_preds_for_g13 = {
            'Supraspinale_Skinfold': float(ultra_v3_raw['Supraspinale_Skinfold'].iloc[0]),
        }
        
        cal_skinfolds = ml_service.measurement_calibrator.calibrate_skinfolds(
            raw_svr_preds, rf_preds_for_g13, height_cm, weight_kg, g13_cnn_features
        )
        
        print(f"G13 Calibrated Skinfolds (mm):")
        for target, value in cal_skinfolds.items():
            print(f"   {target}: {raw_svr_preds.get(target, 0):.1f} -> {value:.1f}")
        
        # STEP 5: G38 Girth/Breadth Calibration (using raw/uncalibrated predictions)
        g38_cnn_features = {
            'calf_cm': cnn_measurements.get('calf_circumference', 0),
            'ankle_cm': cnn_measurements.get('ankle_circumference', 0),
            'thigh_cm': cnn_measurements.get('thigh_circumference', 0),
            'knee_h_cm': cnn_measurements.get('knee_height_sitting', 0),
        }
        
        raw_rf_preds = {
            'Arm_Circumference_Flexed': float(ultra_v3_raw['Arm_Circumference_Flexed'].iloc[0]),
            'Calf_Circumference': float(ultra_v3_raw['Calf_Circumference'].iloc[0]),
            'Humerus_Breadth': float(ultra_v3_raw['Humerus_Breadth'].iloc[0]),
            'Femur_Breadth': float(ultra_v3_raw['Femur_Breadth'].iloc[0]),
        }
        
        cal_girths = ml_service.measurement_calibrator.calibrate_girths(
            raw_rf_preds, height_cm, weight_kg, g38_cnn_features
        )
        
        print(f"G38 Calibrated Girths/Breadths (cm):")
        for target, value in cal_girths.items():
            print(f"   {target}: {raw_rf_preds.get(target, 0):.2f} -> {value:.2f}")
        
        # STEP 6: Heath-Carter Somatotype Calculation (using G13/G38 calibrated measurements)
        somato = calculate_heath_carter(
            height_cm=height_cm,
            weight_kg=weight_kg,
            triceps_mm=cal_skinfolds['Triceps_Skinfold'],
            subscapular_mm=cal_skinfolds['Subscapular_Skinfold'],
            supraspinale_mm=cal_skinfolds['Supraspinale_Skinfold'],
            calf_skinfold_mm=cal_skinfolds['Calf_Skinfold'],
            humerus_breadth_cm=cal_girths['Humerus_Breadth'],
            femur_breadth_cm=cal_girths['Femur_Breadth'],
            arm_girth_cm=cal_girths['Arm_Circumference_Flexed'],
            calf_girth_cm=cal_girths['Calf_Circumference']
        )
        
        raw_endo = somato['endomorphy']
        raw_meso = somato['mesomorphy']
        raw_ecto = somato['ectomorphy']
        print(f"Raw Somatotype (before S5): {raw_endo}-{raw_meso}-{raw_ecto}")
        
        # STEP 7: S5_g0.25 Bias Correction
        if ml_service.bias_corrector is None:
            ml_service.bias_corrector = SomatotypeBiasCorrector()
            ml_service.bias_corrector.load_models()
        
        final_endo, final_meso, final_ecto = ml_service.bias_corrector.correct(
            raw_endo, raw_meso, raw_ecto
        )
        print(f"Corrected Somatotype (S5_g0.25): {final_endo}-{final_meso}-{final_ecto}")
        
        # STEP 8: Classification with T=1.75
        somatotype_class = classify_somatotype(
            final_endo, final_meso, final_ecto, threshold=OPERATING_THRESHOLD
        )
        print(f"Classification (T={OPERATING_THRESHOLD}): {somatotype_class}")
        
        # STEP 9: Body Fat Estimation
        body_fat_result = estimate_body_fat(
            triceps_mm=cal_skinfolds['Triceps_Skinfold'],
            subscapular_mm=cal_skinfolds['Subscapular_Skinfold'],
            supraspinale_mm=cal_skinfolds['Supraspinale_Skinfold'],
            height_cm=height_cm,
            weight_kg=weight_kg,
            age=age,
            gender=gender,
        )
        
        # Update DB
        measurement.somatotype_endo = final_endo
        measurement.somatotype_meso = final_meso
        measurement.somatotype_ecto = final_ecto
        measurement.somatotype_class = somatotype_class
        measurement.body_fat_percentage = body_fat_result['body_fat_percentage']
        
        # Save all intermediate data
        if not measurement.circumferences:
            measurement.circumferences = {}
            
        measurement.circumferences.update(cnn_measurements)
        measurement.circumferences.update(cal_skinfolds)
        measurement.circumferences.update(cal_girths)
        measurement.circumferences.update(somato)
        
        measurement.circumferences['Body_Fat_Percentage'] = body_fat_result['body_fat_percentage']
        measurement.circumferences['Body_Fat_DW'] = body_fat_result['body_fat_dw']
        measurement.circumferences['Body_Fat_CUN_BAE'] = body_fat_result['body_fat_cun_bae']
        
        session.add(measurement)
        session.commit()
        session.refresh(measurement)
        
        return f"Successfully processed measurement {measurement_id}. Class: {measurement.somatotype_class}, Body Fat: {measurement.body_fat_percentage}%"
