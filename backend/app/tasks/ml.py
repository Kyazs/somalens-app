"""
ML Task for body measurement extraction.

Loads CNN + RF/SVR models and provides inference functions wrapped in Celery task.
"""

import os
import pickle
import json
import numpy as np
from typing import Dict, Any, Optional
from PIL import Image
import io
import requests

from app.celery_worker import celery_app
from app.database import engine
from sqlmodel import Session
from app.models.measurement import Measurement
from app.services.somatotype import calculate_heath_carter, classify_somatotype

# Path to model files
# ../ml_models relative to app/tasks/ml.py
MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "ml_models")


class MLService:
    """Machine Learning service for body measurement prediction."""

    def __init__(self):
        self.cnn_model = None
        self.rf_models: Dict[str, Any] = {}
        self.rf_scaler_x = None
        self.rf_scaler_y = None
        self.rf_metadata: Dict[str, Any] = {}
        self.svr_models: Dict[str, Any] = {}
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
            print(f"Loaded CNN model from {cnn_path}")
        except Exception as e:
            print(f"Warning: Could not load CNN model: {e}")
            self.cnn_model = None

        # 2. Load RF models and scalers
        try:
            with open(os.path.join(MODELS_DIR, "rf_v2.2n_scaler_X.pkl"), "rb") as f:
                self.rf_scaler_x = pickle.load(f)
            with open(os.path.join(MODELS_DIR, "rf_v2.2n_scaler_y.pkl"), "rb") as f:
                self.rf_scaler_y = pickle.load(f)
            with open(os.path.join(MODELS_DIR, "rf_v2.2n_metadata.json"), "r") as f:
                self.rf_metadata = json.load(f)

            for target in self.rf_metadata.get("target_measurements", []):
                rf_path = os.path.join(MODELS_DIR, f"rf_v2.2n_{target}.pkl")
                with open(rf_path, "rb") as f:
                    self.rf_models[target] = pickle.load(f)
            print(f"Loaded {len(self.rf_models)} RF models")
        except Exception as e:
            print(f"Warning: Could not load RF models: {e}")

        # 3. Load SVR models for skinfolds
        svr_targets = ["Triceps_Skinfold", "Subscapular_Skinfold", "Supraspinale_Skinfold"]
        for target in svr_targets:
            svr_path = os.path.join(MODELS_DIR, f"svr_proxy_{target}.pkl")
            try:
                with open(svr_path, "rb") as f:
                    self.svr_models[target] = pickle.load(f)
            except FileNotFoundError:
                print(f"Warning: SVR model not found: {svr_path}")
        print(f"Loaded {len(self.svr_models)} SVR models")

        self.is_loaded = True

    def preprocess_image(self, image_bytes: bytes) -> np.ndarray:
        img = Image.open(io.BytesIO(image_bytes))
        img = img.convert("L")
        img = img.resize((224, 224), Image.Resampling.LANCZOS)
        arr = np.array(img, dtype=np.float32) / 255.0
        arr = np.expand_dims(arr, axis=-1)
        return arr

    def extract_proxy_measurements(
        self, front_image: bytes, side_image: bytes, age: int = 25, height_hint: float = 170.0, weight_hint: float = 70.0
    ) -> Dict[str, float]:
        """
        Extract proxy measurements from front and side images using CNN.
        
        Args:
            front_image: Front pose image bytes
            side_image: Side pose image bytes
            
        Returns:
            Dictionary with 9 proxy measurements
        """
        if self.cnn_model is None:
            # Return mock data if CNN not loaded
            return {
                "Stature": 170.0,
                "Weight": 70.0,
                "Chest_Circumference": 95.0,
                "Hip_Circumference": 95.0,
                "Waist_Circumference": 80.0,
                "Thigh_Circumference": 55.0,
                "Ankle_Circumference": 22.0,
                "Shoulder_Breadth": 45.0,
                "Knee_Height": 50.0,
            }

        # Preprocess images
        front_arr = self.preprocess_image(front_image)
        side_arr = self.preprocess_image(side_image)

        numca_input = np.array([[age, height_hint, weight_hint]], dtype=np.float32)
        front_input = np.expand_dims(front_arr, axis=0)
        side_input = np.expand_dims(side_arr, axis=0)

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

    def predict_skinfolds_svr(
        self, height_cm: float, weight_kg: float, age: int
    ) -> Dict[str, float]:
        """
        Predict skinfolds using SVR models.
        
        SVR input features: [Stature_mm, Weight_kg, Age, BMI, Ponderal_Index]
        
        Args:
            height_cm: Height in centimeters
            weight_kg: Weight in kilograms
            age: Age in years
            
        Returns:
            Dictionary with Triceps, Subscapular, Supraspinale skinfolds in mm
        """
        height_cm = abs(height_cm) if height_cm else 170.0
        weight_kg = abs(weight_kg) if weight_kg else 70.0
        
        bmi = weight_kg / ((height_cm / 100) ** 2)
        ponderal_index = height_cm / (weight_kg ** (1 / 3))

        x_base = np.array(
            [[height_cm * 10, weight_kg, age, bmi, ponderal_index]]  # Stature in mm
        )

        result = {}
        for target in ["Triceps_Skinfold", "Subscapular_Skinfold", "Supraspinale_Skinfold"]:
            if target in self.svr_models:
                pred = self.svr_models[target].predict(x_base)
                # Apply expm1 (inverse of log1p used during training)
                result[target] = float(np.expm1(pred[0]))
            else:
                # Fallback mock values
                result[target] = 12.0

        return result

    def predict_heath_carter_inputs_rf(
        self,
        proxy_measurements: Dict[str, float],
        age: int,
        gender: str,
    ) -> Dict[str, float]:
        """
        Predict Heath-Carter input measurements using RF models.
        
        Args:
            proxy_measurements: CNN output measurements
            age: Age in years
            gender: 'male' or 'female'
            
        Returns:
            Dictionary with all 8 Heath-Carter input measurements
        """
        if not self.rf_models or not self.rf_scaler_x or not self.rf_scaler_y:
            # Return mock data
            return {
                "Triceps_Skinfold": 12.0,
                "Subscapular_Skinfold": 15.0,
                "Supraspinale_Skinfold": 12.0,
                "Calf_Skinfold": 10.0,
                "Humerus_Breadth": 7.0,
                "Femur_Breadth": 9.5,
                "Arm_Circumference_Flexed": 32.0,
                "Calf_Circumference": 36.0,
            }

        # Build feature vector for RF
        bmi = proxy_measurements.get("Weight", 70) / (
            (proxy_measurements.get("Stature", 170) / 100) ** 2
        )
        gender_male = 1 if gender.lower() == "male" else 0

        # RF expects these features in specific order (from metadata)
        feature_order = self.rf_metadata.get(
            "proxy_measurements",
            [
                "Stature",
                "Weight",
                "Chest_Circumference",
                "Hip_Circumference",
                "Waist_Circumference",
                "Thigh_Circumference",
                "Ankle_Circumference",
                "Shoulder_Breadth",
                "Knee_Height",
                "Arm_Circumference_Flexed",
                "Calf_Circumference",
                "BMI",
                "Age",
                "Gender_Male",
            ],
        )

        features = []
        for feat in feature_order:
            if feat == "BMI":
                features.append(bmi)
            elif feat == "Age":
                features.append(age)
            elif feat == "Gender_Male":
                features.append(gender_male)
            elif feat == "Stature":
                features.append(proxy_measurements.get(feat, 170) * 10)  # Convert to mm
            else:
                features.append(proxy_measurements.get(feat, 0))

        x_input = np.array([features], dtype=np.float64)
        x_input = np.real(x_input)
        x_scaled = self.rf_scaler_x.transform(x_input)

        # Predict each target
        predictions = []
        for target in self.rf_metadata.get("target_measurements", []):
            if target in self.rf_models:
                pred = self.rf_models[target].predict(x_scaled)
                predictions.append(pred[0])
            else:
                predictions.append(0)

        # Inverse scale predictions
        preds_array = np.array([predictions], dtype=np.float64)
        preds_array = np.real(preds_array)
        preds_unscaled = self.rf_scaler_y.inverse_transform(preds_array)

        result = {}
        for i, target in enumerate(self.rf_metadata.get("target_measurements", [])):
            val = preds_unscaled[0][i]
            if hasattr(val, 'real'):
                val = val.real
            result[target] = float(val)

        return result


# Global instance
ml_service = MLService()


@celery_app.task(name="process_measurement")
def process_measurement(measurement_id: int):
    """
    Celery task to process measurement:
    1. Fetch measurement and images
    2. Run ML inference
    3. Calculate Somatotype
    4. Update DB
    """
    # Ensure models are loaded
    ml_service.load_models()

    with Session(engine) as session:
        measurement = session.get(Measurement, measurement_id)
        if not measurement:
            return f"Measurement {measurement_id} not found"

        # Read images from filesystem (shared volume) instead of HTTP
        # Extract filename from URL: http://host/static/{filename} -> {filename}
        try:
            front_filename = measurement.front_image_url.split("/static/")[-1]
            side_filename = measurement.side_image_url.split("/static/")[-1]
            
            uploads_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
            
            # Fallback: Try multiple possible paths for uploads directory
            possible_dirs = [
                uploads_dir,  # app/uploads (relative to app/)
                "/app/uploads",  # Docker absolute path
                os.path.join(os.getcwd(), "uploads"),  # Current working dir
            ]
            
            upload_path = None
            for dir_path in possible_dirs:
                if os.path.exists(os.path.join(dir_path, front_filename)):
                    upload_path = dir_path
                    break
            
            if not upload_path:
                return f"Error: Could not find uploads directory containing {front_filename}. Tried: {possible_dirs}"
            
            front_path = os.path.join(upload_path, front_filename)
            side_path = os.path.join(upload_path, side_filename)
            
            with open(front_path, "rb") as f:
                front_bytes = f.read()
            with open(side_path, "rb") as f:
                side_bytes = f.read()
        except Exception as e:
            return f"Error reading images for {measurement_id}: {e}"

        # 1. Extract Proxy Measurements (CNN)
        age = measurement.age if measurement.age else 25
        # Use user-provided height/weight as hints if available, otherwise defaults
        height_hint = measurement.height if measurement.height else 170.0
        weight_hint = measurement.weight if measurement.weight else 70.0

        proxy = ml_service.extract_proxy_measurements(
            front_bytes, 
            side_bytes,
            age=age,
            height_hint=height_hint,
            weight_hint=weight_hint
        )
        
        # Update basic info
        # We prefer the user-provided height/weight over the CNN estimate for accuracy
        # But we store the CNN estimates in circumferences later
        if not measurement.weight:
            measurement.weight = proxy.get("Weight")
        if not measurement.height:
            measurement.height = proxy.get("Stature")
        
        height_cm: float = measurement.height if measurement.height is not None else 170.0
        weight_kg: float = measurement.weight if measurement.weight is not None else 70.0

        # 2. Predict Skinfolds (SVR)
        skinfolds = ml_service.predict_skinfolds_svr(
            height_cm=height_cm,
            weight_kg=weight_kg,
            age=age
        )

        # 3. Predict RF inputs (RF)
        # Default gender to male if missing
        gender = measurement.gender if measurement.gender else "male"
        rf_inputs = ml_service.predict_heath_carter_inputs_rf(
            proxy_measurements=proxy,
            age=age,
            gender=gender
        )

        # 4. Calculate Somatotype
        # Combine inputs, preferring SVR for skinfolds
        triceps = skinfolds.get("Triceps_Skinfold", rf_inputs.get("Triceps_Skinfold", 0))
        subscapular = skinfolds.get("Subscapular_Skinfold", rf_inputs.get("Subscapular_Skinfold", 0))
        supraspinale = skinfolds.get("Supraspinale_Skinfold", rf_inputs.get("Supraspinale_Skinfold", 0))
        
        calf_skinfold = rf_inputs.get("Calf_Skinfold", 0)
        humerus = rf_inputs.get("Humerus_Breadth", 0)
        femur = rf_inputs.get("Femur_Breadth", 0)
        arm_girth = rf_inputs.get("Arm_Circumference_Flexed", 0)
        calf_girth = rf_inputs.get("Calf_Circumference", 0)

        somato = calculate_heath_carter(
            height_cm=height_cm,
            weight_kg=weight_kg,
            triceps_mm=triceps,
            subscapular_mm=subscapular,
            supraspinale_mm=supraspinale,
            calf_skinfold_mm=calf_skinfold,
            humerus_breadth_cm=humerus,
            femur_breadth_cm=femur,
            arm_girth_cm=arm_girth,
            calf_girth_cm=calf_girth
        )

        # Update measurement
        measurement.somatotype_endo = somato["endomorphy"]
        measurement.somatotype_meso = somato["mesomorphy"]
        measurement.somatotype_ecto = somato["ectomorphy"]
        
        measurement.somatotype_class = classify_somatotype(
            measurement.somatotype_endo,
            measurement.somatotype_meso,
            measurement.somatotype_ecto
        )
        
        # Determine body fat if possible or use a proxy
        # (Not explicitly in requirements but useful)
        
        # Save all intermediate data
        if not measurement.circumferences:
            measurement.circumferences = {}
            
        measurement.circumferences.update(proxy)
        measurement.circumferences.update(skinfolds)
        measurement.circumferences.update(rf_inputs)
        measurement.circumferences.update(somato)
        
        session.add(measurement)
        session.commit()
        session.refresh(measurement)

        return f"Successfully processed measurement {measurement_id}. Class: {measurement.somatotype_class}"
