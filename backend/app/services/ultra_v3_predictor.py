"""
Ultra V3 Predictor Module
=========================
Implementation of the Hybrid Ultra V3 algorithm for body measurement prediction.
Extracts the core inference logic from implement_svr_ultra_v3.py.

Algorithm: Hybrid Stacking (SVR + RF v2.2n) with Filipino Calibration.
"""

import os
import pickle
import json
import numpy as np
import pandas as pd
from app.config import settings

# Define model directory - fallback to 'app/ml_models' relative to execution root or absolute path
MODEL_DIR = getattr(settings, 'MODEL_FILES_DIR', os.path.join(os.path.dirname(os.path.dirname(__file__)), 'ml_models'))

class UltraV3Predictor:
    """
    Hybrid Ultra V3 Predictor.
    
    Combines SVR models for skinfolds (Triceps, Subscapular, Supraspinale)
    with Random Forest v2.2n models for other measurements.
    Applies BMI-based modulation and Filipino-specific calibration.
    """
    
    def __init__(self):
        # SVR Models (Skinfolds - Triceps, Subscapular, Supraspinale)
        self.svr_tri = None
        self.svr_sub = None
        self.svr_sup = None
        
        # RF Models (Girths/Breadths/Calf Skinfold)
        self.rf_models = {}
        self.rf_meta = {}
        self.rf_scaler_X = None
        self.rf_scaler_y = None
        
        self.is_loaded = False
        
    def load_models(self):
        """
        Loads all required models from MODEL_DIR.
        Fails fast if models are missing.
        """
        if self.is_loaded:
            return

        model_dir = MODEL_DIR
        
        # --- 1. Load RF v2.2n Models & Scalers ---
        try:
            with open(os.path.join(model_dir, 'rf_v2.2n_scaler_X.pkl'), 'rb') as f:
                self.rf_scaler_X = pickle.load(f)
            with open(os.path.join(model_dir, 'rf_v2.2n_scaler_y.pkl'), 'rb') as f:
                self.rf_scaler_y = pickle.load(f)
            with open(os.path.join(model_dir, 'rf_v2.2n_metadata.json'), 'r') as f:
                self.rf_meta = json.load(f)
                
            for t in self.rf_meta['target_measurements']:
                with open(os.path.join(model_dir, f'rf_v2.2n_{t}.pkl'), 'rb') as f:
                    self.rf_models[t] = pickle.load(f)
        except FileNotFoundError as e:
            raise FileNotFoundError(
                f"Missing RF v2.2n model file: {e.filename}. "
                f"Ensure {model_dir} contains rf_v2.2n_*.pkl files."
            ) from e

        # --- 2. Load SVR Models (for Triceps, Subscapular, Supraspinale skinfolds) ---
        # SVR models predict directly from base demographics (no intermediate proxies)
        svr_files = {
            'svr_tri': 'svr_proxy_Triceps_Skinfold.pkl',
            'svr_sub': 'svr_proxy_Subscapular_Skinfold.pkl',
            'svr_sup': 'svr_proxy_Supraspinale_Skinfold.pkl'
        }
        
        try:
            with open(os.path.join(model_dir, svr_files['svr_tri']), 'rb') as f:
                self.svr_tri = pickle.load(f)
            with open(os.path.join(model_dir, svr_files['svr_sub']), 'rb') as f:
                self.svr_sub = pickle.load(f)
            with open(os.path.join(model_dir, svr_files['svr_sup']), 'rb') as f:
                self.svr_sup = pickle.load(f)
                    
        except FileNotFoundError as e:
            raise FileNotFoundError(
                f"Missing SVR model file: {e.filename}. "
                f"Ensure {model_dir} contains svr_proxy_*.pkl files."
            ) from e

        self.is_loaded = True

    def predict(self, df_input):
        """
        Predict body measurements using Hybrid Ultra V3.
        
        Args:
            df_input: DataFrame with columns:
                      ['height_cm', 'weight_kg', 'age', 'gender', ... cnn_girths]
                      
        Returns:
            DataFrame with predicted measurements (calibrated).
        """
        if not self.is_loaded:
            self.load_models()
            
        # --- 1. SVR PREDICTION (Triceps, Sub, Supra) ---
        # SVR models predict directly from base demographics: [Stature_mm, Weight, Age, BMI, Ponderal_Index]
        # Ensure input data types are correct
        height_values = df_input['height_cm'].values.astype(float)
        weight_values = df_input['weight_kg'].values.astype(float)
        age_values = df_input['age'].values.astype(float)
        
        X_base_test = np.column_stack([
             height_values * 10, # Stature in mm
             weight_values,
             age_values,
             weight_values / ((height_values/100) ** 2), # BMI
             (height_values) / (weight_values ** (1/3))  # Ponderal Index
        ])
        
        # All three SVR models predict from the same base features
        p_tri = np.expm1(self.svr_tri.predict(X_base_test))
        p_sub = np.expm1(self.svr_sub.predict(X_base_test))
        p_sup = np.expm1(self.svr_sup.predict(X_base_test))
        
        # --- MODULATION: Use Waist Circumference to modulate Skinfolds ---
        h_cm = height_values
        correction_tri = -126.15212262268905 + 0.9188172 * h_cm + -0.00113514 * (h_cm**2)
        
        bmi_current = weight_values / ((h_cm/100)**2)
        anchor = 0.48 + 0.008 * (bmi_current - 22.0)
        anchor = np.clip(anchor, 0.40, 0.70)
        
        # Check for Waist Circumference
        waist_col = None
        possible_cols = ['waist_circumference', 'Waist_Circumference']
        for c in possible_cols:
            if c in df_input.columns:
                waist_col = c
                break
                
        if waist_col is not None:
            # Heuristic: if waist < 200, it's likely CM. If > 200, MM.
            w_raw = df_input[waist_col].values.astype(float)
            w_mm = np.where(w_raw < 200, w_raw * 10, w_raw) # Auto-convert cm to mm
            
            # Handle NaNs in waist if any
            w_mm = np.nan_to_num(w_mm, nan=h_cm * anchor * 10) 
            
            whtr = (w_mm / 10.0) / h_cm
            fat_factor = whtr / anchor
            fat_factor = np.clip(fat_factor, 0.7, 1.4)
            
            p_tri_final = (p_tri + correction_tri) * fat_factor
            p_sub_final = p_sub * fat_factor
            p_sup_final = p_sup * fat_factor
        else:
            # Fallback if no waist circumference provided
            p_tri_final = p_tri + correction_tri
            p_sub_final = p_sub
            p_sup_final = p_sup
            
        # --- 2. RF PREDICTION (Calf, Girths) ---
        rf_input_data = []
        for _, row in df_input.iterrows():
            d = {}
            d['Stature'] = float(row['height_cm']) * 10
            d['Weight'] = float(row['weight_kg'])
            d['Age'] = float(row['age'])
            d['BMI'] = float(row['weight_kg']) / ((float(row['height_cm'])/100)**2)
            d['Gender_Male'] = 1 if str(row['gender']).lower() == 'male' else 0
            
            # Map input columns to RF feature names
            mapping = {
                'chest_circumference': 'Chest_Circumference',
                'hip_circumference': 'Hip_Circumference',
                'buttock_circumference': 'Hip_Circumference', # Alternate name
                'waist_circumference': 'Waist_Circumference',
                'thigh_circumference': 'Thigh_Circumference',
                'ankle_circumference': 'Ankle_Circumference',
                'shoulder_breadth': 'Shoulder_Breadth',
                'biacromial_breadth': 'Shoulder_Breadth', # Alternate name
                'knee_height': 'Knee_Height',
                'knee_height_sitting': 'Knee_Height', # Alternate name
                'arm_circumference_flexed': 'Arm_Circumference_Flexed',
                'calf_circumference': 'Calf_Circumference'
            }
            
            for csv_col, model_col in mapping.items():
                if csv_col in row and pd.notna(row[csv_col]):
                    val = float(row[csv_col])
                    # Check unit: RF expects cm.
                    if val > 200: # MM likely (heuristic for girths)
                        d[model_col] = val / 10.0
                    else:
                        d[model_col] = val
                        
            rf_input_data.append(d)
            
        df_rf_input = pd.DataFrame(rf_input_data)
        
        # Handle missing columns if any
        for col in self.rf_meta['proxy_measurements']:
            if col not in df_rf_input.columns:
                df_rf_input[col] = 0.0 
        
        df_rf_input = df_rf_input[self.rf_meta['proxy_measurements']]
        X_rf = self.rf_scaler_X.transform(df_rf_input)
        
        rf_preds_scaled = []
        for t in self.rf_meta['target_measurements']:
            rf_preds_scaled.append(self.rf_models[t].predict(X_rf))
        
        rf_preds = self.rf_scaler_y.inverse_transform(np.array(rf_preds_scaled).T)
        df_rf_preds = pd.DataFrame(rf_preds, columns=self.rf_meta['target_measurements'])
        
        # --- 3. ASSEMBLY ---
        results = pd.DataFrame({
            'Triceps_Skinfold': p_tri_final,
            'Subscapular_Skinfold': p_sub_final,
            'Supraspinale_Skinfold': p_sup_final,
            'Calf_Skinfold': df_rf_preds['Calf_Skinfold'],
            'Humerus_Breadth': df_rf_preds['Humerus_Breadth'],
            'Femur_Breadth': df_rf_preds['Femur_Breadth'],
            'Arm_Circumference_Flexed': df_rf_preds['Arm_Circumference_Flexed'],
            'Calf_Circumference': df_rf_preds['Calf_Circumference']
        }, index=df_input.index)
        
        # --- 4. CALIBRATION ---
        results = self.apply_filipino_calibration(results, df_input)
        
        return results

    def apply_filipino_calibration(self, predictions, df_input):
        """
        Applies Filipino-specific calibration coefficients.
        Derived from 30-subject test set (Domain Adaptation).
        """
        results = predictions.copy()
        height_cm = df_input['height_cm'].values.astype(float)
        weight_kg = df_input['weight_kg'].values.astype(float)
        
        # Triceps: 0.3899*raw - 0.3165*height + 0.3469*weight + 38.50
        results['Triceps_Skinfold'] = (
            0.3899 * results['Triceps_Skinfold'] +
            (-0.3165) * height_cm +
            0.3469 * weight_kg +
            38.50
        )
        
        # Subscapular: 0.4903*raw - 0.1195*height + 0.2393*weight + 11.98
        results['Subscapular_Skinfold'] = (
            0.4903 * results['Subscapular_Skinfold'] +
            (-0.1195) * height_cm +
            0.2393 * weight_kg +
            11.98
        )
        
        # Supraspinale: 0.4594*raw - 0.2193*height + 0.3679*weight + 19.99
        results['Supraspinale_Skinfold'] = (
            0.4594 * results['Supraspinale_Skinfold'] +
            (-0.2193) * height_cm +
            0.3679 * weight_kg +
            19.99
        )
        
        # Calf: 0.0856*raw - 0.2643*height + 0.4203*weight + 31.34
        results['Calf_Skinfold'] = (
            0.0856 * results['Calf_Skinfold'] +
            (-0.2643) * height_cm +
            0.4203 * weight_kg +
            31.34
        )
        
        # Arm_girth: raw + 0.50
        results['Arm_Circumference_Flexed'] = results['Arm_Circumference_Flexed'] + 0.50
        
        # Calf_girth: raw - 1.38
        results['Calf_Circumference'] = results['Calf_Circumference'] - 1.38
        
        return results
