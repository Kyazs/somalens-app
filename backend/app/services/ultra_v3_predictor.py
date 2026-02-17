"""
Ultra V3 Predictor V2 - Enhanced SVR with CNN Features
=======================================================

Improvements over V1 (ultra_v3_predictor.py):
1. Uses SVR V2 models trained with CNN body shape features
2. All 4 skinfolds predicted by SVR (Calf moved from RF)
3. Filipino-specific calibration from LOOCV
4. Better feature extraction with CNN circumferences

Algorithm: Hybrid Stacking (SVR V2 + RF v2.2n) with Filipino Calibration.

METHODOLOGICAL NOTES (Phase 27/28):
------------------------------------
- The Filipino calibration in svr_skinfold_v2_1_calibration.json was derived
  from ALL 30 Filipino test subjects. For production deployment, this is
  acceptable (use all available data for best predictions).
  
- For EVALUATION, this creates data leakage. Phase 27/28 fix this by
  deriving calibration INSIDE each LOOCV fold (N-1 subjects only).
  
- The calibration file has pred_coef=0.0 for all skinfolds, meaning the
  SVR predictions are effectively replaced by Height+Weight linear regression.
  This is because the linear features (H, W) dominate for the Filipino cohort
  at this sample size.

- Somatotype-level bias correction (Bayesian Ridge) is NOT included in this
  predictor. It is applied after Heath-Carter calculation in the research
  pipeline (see tests/researchV3/phase28_comprehensive_improvements.py).
  
- Phase 28 validated accuracy: 80.0% with Bayesian Ridge + T=2.0 (honest LOOCV).
  
- The Deurenberg body fat formula used here was tested against Asian-specific
  alternatives (Gallagher 2000, Deurenberg 1998 Asian). Phase 28 found NO
  impact on final somatotype accuracy - all formulas give 76.7%.
"""

import os
import pickle
import json
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler

MODEL_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'ml_models')


class UltraV3Predictor:
    """
    Hybrid Ultra V3 Predictor V2 - Enhanced with CNN Features.
    
    Key Changes from V1:
    - SVR now uses 11 features (base + CNN circumferences)
    - Calf Skinfold moved from RF to SVR
    - New Filipino calibration coefficients
    
    KNOWN ISSUE (Phase 27): The calibration file has pred_coef=0.0
    for all skinfolds, meaning SVR predictions are replaced by H+W
    linear regression. This is intentional for the current Filipino
    calibration but means the SVR models contribute nothing to
    skinfold predictions. For honest evaluation, see Phase 27/28.
    """
    
    # Feature names expected by SVR V2.1 models
    SVR_FEATURES = [
        'Stature', 'Weight', 'Age', 'BMI', 'Ponderal_Index',
        'Chest_Circumference', 'Hip_Circumference', 'Waist_Circumference',
        'Thigh_Circumference', 'Waist_Hip_Ratio', 'Waist_Height_Ratio',
        # New in V2.1
        'Body_Fat_Pct', 'Fat_Mass', 'Lean_Mass', 'FFMI'
    ]
    
    # Skinfold targets (all 4 now use SVR)
    SKINFOLD_TARGETS = [
        'Triceps_Skinfold',
        'Subscapular_Skinfold', 
        'Supraspinale_Skinfold',
        'Calf_Skinfold'
    ]
    
    def __init__(self):
        # SVR Models (all 4 skinfolds)
        self.svr_models = {}
        self.svr_calibration = {}
        
        # RF Models (Girths/Breadths only - no Calf Skinfold)
        self.rf_models = {}
        self.rf_meta = {}
        self.rf_scaler_X = None
        self.rf_scaler_y = None
        
        self.is_loaded = False
        
    def load_models(self):
        """
        Loads all required models from MODEL_DIR.
        Uses SVR V2 models with CNN features.
        """
        if self.is_loaded:
            return

        model_dir = MODEL_DIR
        
        # --- 1. Load SVR V2.1 Models (all 4 skinfolds) ---
        try:
            # Load metadata
            with open(os.path.join(model_dir, 'svr_skinfold_v2_1_metadata.json'), 'r') as f:
                svr_meta = json.load(f)
            
            # Load calibration coefficients
            with open(os.path.join(model_dir, 'svr_skinfold_v2_1_calibration.json'), 'r') as f:
                self.svr_calibration = json.load(f)
            
            # Load models
            for target in self.SKINFOLD_TARGETS:
                filename = f'svr_skinfold_v2_1_{target}.pkl'
                with open(os.path.join(model_dir, filename), 'rb') as f:
                    self.svr_models[target] = pickle.load(f)
                    
        except FileNotFoundError as e:
            raise FileNotFoundError(
                f"Missing SVR V2.1 model file: {e.filename}. "
                f"Run 'python src/training_scripts/train_svr_skinfolds_v2_1.py' to generate models."
            ) from e

        # --- 2. Load RF v2.2n Models (girths/breadths only) ---
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

        self.is_loaded = True

    def _prepare_svr_features(self, df_input):
        """
        Prepare feature matrix for SVR V2.1 models.
        
        Features: [Stature, Weight, Age, BMI, Ponderal_Index,
                   Chest_Circ, Hip_Circ, Waist_Circ, Thigh_Circ,
                   Waist_Hip_Ratio, Waist_Height_Ratio,
                   Body_Fat_Pct, Fat_Mass, Lean_Mass, FFMI]
        """
        height_cm = df_input['height_cm'].values
        height_mm = height_cm * 10
        height_m = height_cm / 100.0
        weight_kg = df_input['weight_kg'].values
        age = df_input['age'].values
        bmi = weight_kg / (height_m ** 2)
        ponderal = height_cm / (weight_kg ** (1/3))
        
        # Gender encoding (1=Male, 0=Female)
        # Handle 'gender' column which might be string or numeric
        if 'gender' in df_input.columns:
            # Check if string
            if df_input['gender'].dtype == object:
                gender_male = (df_input['gender'].str.lower() == 'male').astype(int).values
            else:
                # Assume already encoded or check values
                gender_male = df_input['gender'].values
        else:
            # Default to male if missing (safe fallback for this cohort)
            gender_male = np.ones(len(df_input))
        
        # CNN circumference features (in mm from CNN output)
        def get_col(df, names, default=None):
            """Get column value, trying multiple names."""
            for name in names:
                if name in df.columns:
                    vals = df[name].values
                    return vals
            return np.full(len(df), default if default else 0)
        
        chest = get_col(df_input, ['chest_circumference', 'Chest_Circumference'])
        hip = get_col(df_input, ['hip_circumference', 'Hip_Circumference'])
        waist = get_col(df_input, ['waist_circumference', 'Waist_Circumference'])
        thigh = get_col(df_input, ['thigh_circumference', 'Thigh_Circumference'])
        
        # Compute ratios
        # Handle potential division by zero
        whr = np.divide(waist, hip, out=np.zeros_like(waist, dtype=float), where=hip!=0)
        wht = np.divide(waist, height_mm, out=np.zeros_like(waist, dtype=float), where=height_mm!=0)
        
        # --- Body Composition Features (Deurenberg Formula) ---
        # BF% = 1.20 * BMI + 0.23 * Age - 10.8 * Sex - 5.4
        # Sex: 1=Male, 0=Female
        bf_pct = 1.20 * bmi + 0.23 * age - 10.8 * gender_male - 5.4
        bf_pct = np.clip(bf_pct, 5, 60)
        
        fat_mass = weight_kg * (bf_pct / 100)
        lean_mass = weight_kg * (1 - bf_pct / 100)
        ffmi = lean_mass / (height_m ** 2)
        
        X = np.column_stack([
            height_mm,      # Stature (mm)
            weight_kg,      # Weight (kg)
            age,            # Age (years)
            bmi,            # BMI
            ponderal,       # Ponderal Index
            chest,          # Chest Circumference (mm)
            hip,            # Hip Circumference (mm)
            waist,          # Waist Circumference (mm)
            thigh,          # Thigh Circumference (mm)
            whr,            # Waist-Hip Ratio
            wht,            # Waist-Height Ratio
            bf_pct,         # Body Fat %
            fat_mass,       # Fat Mass (kg)
            lean_mass,      # Lean Mass (kg)
            ffmi            # FFMI
        ])
        
        return X

    def predict(self, df_input):
        """
        Predict body measurements using Hybrid Ultra V3 V2.
        
        Args:
            df_input: DataFrame with columns:
                      ['height_cm', 'weight_kg', 'age', 'gender', 
                       'chest_circumference', 'hip_circumference', 
                       'waist_circumference', 'thigh_circumference', ...]
                       
        Returns:
            DataFrame with predicted measurements (calibrated).
        """
        if not self.is_loaded:
            self.load_models()
            
        # --- 1. SVR PREDICTION (All 4 Skinfolds) ---
        X_svr = self._prepare_svr_features(df_input)
        
        skinfold_preds = {}
        for target in self.SKINFOLD_TARGETS:
            # Predict (log-transformed)
            pred_log = self.svr_models[target].predict(X_svr)
            # Inverse transform
            pred = np.expm1(pred_log)
            skinfold_preds[target] = pred
            
        # --- 2. RF PREDICTION (Girths/Breadths) ---
        rf_input_data = []
        for _, row in df_input.iterrows():
            d = {}
            d['Stature'] = row['height_cm'] * 10
            d['Weight'] = row['weight_kg']
            d['Age'] = row['age']
            d['BMI'] = row['weight_kg'] / ((row['height_cm']/100)**2)
            d['Gender_Male'] = 1 if str(row['gender']).lower() == 'male' else 0
            
            # Map input columns to RF feature names
            mapping = {
                'chest_circumference': 'Chest_Circumference',
                'hip_circumference': 'Hip_Circumference',
                'buttock_circumference': 'Hip_Circumference',
                'waist_circumference': 'Waist_Circumference',
                'thigh_circumference': 'Thigh_Circumference',
                'ankle_circumference': 'Ankle_Circumference',
                'shoulder_breadth': 'Shoulder_Breadth',
                'biacromial_breadth': 'Shoulder_Breadth',
                'knee_height': 'Knee_Height',
                'knee_height_sitting': 'Knee_Height',
                'arm_circumference_flexed': 'Arm_Circumference_Flexed',
                'calf_circumference': 'Calf_Circumference'
            }
            
            for csv_col, model_col in mapping.items():
                if csv_col in row:
                    val = row[csv_col]
                    # Convert mm to cm for RF (RF expects cm)
                    if val > 200:  # Likely mm
                        d[model_col] = val / 10.0
                    else:
                        d[model_col] = val
                        
            rf_input_data.append(d)
            
        df_rf_input = pd.DataFrame(rf_input_data)
        
        # Handle missing columns
        for col in self.rf_meta['proxy_measurements']:
            if col not in df_rf_input.columns:
                df_rf_input[col] = 0.0
        
        df_rf_input = df_rf_input[self.rf_meta['proxy_measurements']]
        X_rf = self.rf_scaler_X.transform(df_rf_input)
        
        # Only predict non-skinfold targets
        rf_targets_needed = [t for t in self.rf_meta['target_measurements'] 
                            if t != 'Calf_Skinfold']
        
        rf_preds_scaled = []
        for t in self.rf_meta['target_measurements']:
            rf_preds_scaled.append(self.rf_models[t].predict(X_rf))
        
        rf_preds = self.rf_scaler_y.inverse_transform(np.array(rf_preds_scaled).T)
        df_rf_preds = pd.DataFrame(rf_preds, columns=self.rf_meta['target_measurements'])
        
        # --- 3. ASSEMBLY ---
        results = pd.DataFrame({
            'Triceps_Skinfold': skinfold_preds['Triceps_Skinfold'],
            'Subscapular_Skinfold': skinfold_preds['Subscapular_Skinfold'],
            'Supraspinale_Skinfold': skinfold_preds['Supraspinale_Skinfold'],
            'Calf_Skinfold': skinfold_preds['Calf_Skinfold'],  # Now from SVR
            'Humerus_Breadth': df_rf_preds['Humerus_Breadth'],
            'Femur_Breadth': df_rf_preds['Femur_Breadth'],
            'Arm_Circumference_Flexed': df_rf_preds['Arm_Circumference_Flexed'],
            'Calf_Circumference': df_rf_preds['Calf_Circumference']
        }, index=df_input.index)
        
        # --- 4. CALIBRATION ---
        raw_results = results.copy()  # Save raw predictions before calibration
        results = self.apply_filipino_calibration(results, df_input)
        
        # Store raw for access by predict_with_raw()
        self._last_raw_results = raw_results
        
        return results
    
    def predict_with_raw(self, df_input):
        """
        Predict body measurements and return BOTH calibrated and raw predictions.
        
        Raw predictions (before Filipino calibration) are needed for G13/G38
        calibration models, which were trained on raw SVR/RF outputs in Phase 42.
        
        Args:
            df_input: DataFrame with input features (same as predict())
            
        Returns:
            tuple: (calibrated_df, raw_df)
                - calibrated_df: DataFrame with Filipino-calibrated predictions
                - raw_df: DataFrame with raw SVR/RF predictions (pre-calibration)
        """
        calibrated = self.predict(df_input)
        raw = self._last_raw_results.copy()
        return calibrated, raw

    def apply_filipino_calibration(self, predictions, df_input):
        """
        Applies Filipino-specific calibration coefficients.
        Uses new V2 calibration from LOOCV on 30 Filipino subjects.
        
        NOTE (Phase 27/28): This calibration was derived from ALL 30 test
        subjects (transductive). For production use this is acceptable.
        For evaluation, Phase 27/28 derive calibration inside LOOCV folds.
        
        The calibration file has pred_coef=0.0 for all skinfolds,
        effectively replacing SVR predictions with Height+Weight
        linear regression:
            calibrated = 0.0 * SVR_pred + height_coef * H + weight_coef * W + intercept
        """
        results = predictions.copy()
        height_cm = df_input['height_cm'].values
        weight_kg = df_input['weight_kg'].values
        
        # Apply calibration to each skinfold
        cal_map = {
            'Triceps_Skinfold': 'Triceps',
            'Subscapular_Skinfold': 'Subscapular',
            'Supraspinale_Skinfold': 'Supraspinale',
            'Calf_Skinfold': 'Calf'
        }
        
        for col, cal_key in cal_map.items():
            if cal_key in self.svr_calibration:
                cal = self.svr_calibration[cal_key]
                results[col] = (
                    cal['pred_coef'] * results[col] +
                    cal['height_coef'] * height_cm +
                    cal['weight_coef'] * weight_kg +
                    cal['intercept']
                )
        
        # Girth Offsets (from original V3)
        results['Arm_Circumference_Flexed'] = results['Arm_Circumference_Flexed'] + 0.50
        results['Calf_Circumference'] = results['Calf_Circumference'] - 1.38
        
        return results


# For backward compatibility, also expose as V2 alias
UltraV3PredictorV2 = UltraV3Predictor
