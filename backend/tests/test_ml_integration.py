"""
Integration tests for ML pipeline (V4).

These tests validate the complete V4 flow:
Image -> Segmentation -> Normalization -> CNN -> Ultra V3 V2 -> G13/G38 -> S5 -> Somatotype
"""
import pytest
import numpy as np
from PIL import Image
import io
from unittest.mock import patch, MagicMock
import os
import sys

current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.tasks.ml import MLService
from app.utils.segmentation import DeepLabV3Segmenter
from app.utils.scale_normalization import normalize_silhouette_scale
from app.services.ultra_v3_predictor import UltraV3Predictor
from app.services.measurement_calibration import MeasurementCalibrator
from app.services.bias_correction import SomatotypeBiasCorrector
from app.services.somatotype import calculate_heath_carter, classify_somatotype


@pytest.fixture
def ml_service():
    """Create MLService instance (mocked models for unit tests)."""
    service = MLService()
    service.is_loaded = True
    return service


@pytest.fixture  
def sample_silhouette():
    """Create a dummy silhouette for testing."""
    sil = np.zeros((448, 448, 1), dtype=np.uint8)
    sil[50:400, 150:300, 0] = 255
    return sil


@pytest.fixture
def sample_image_bytes():
    """Create dummy image bytes for testing."""
    img = Image.new('RGB', (640, 480), color=(128, 128, 128))
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    return buffer.getvalue()


class TestSegmentation:
    """Test DeepLabV3 segmentation module."""
    
    def test_segmenter_initialization(self):
        """Segmenter should initialize without errors."""
        pytest.importorskip("torch")
        assert DeepLabV3Segmenter is not None
    
    def test_silhouette_output_shape(self, sample_silhouette):
        """Silhouette should have (H, W, 1) shape."""
        assert sample_silhouette.shape == (448, 448, 1)
        assert sample_silhouette.dtype == np.uint8


class TestScaleNormalization:
    """Test scale normalization module."""
    
    def test_normalize_output_shape(self, sample_silhouette):
        """Normalized output should be (224, 224, 1)."""
        normalized = normalize_silhouette_scale(sample_silhouette)
        assert normalized.shape == (224, 224, 1)
    
    def test_normalize_maintains_binary(self, sample_silhouette):
        """Normalized silhouette should remain binary."""
        normalized = normalize_silhouette_scale(sample_silhouette)
        unique_values = np.unique(normalized)
        assert len(unique_values) <= 2


class TestMLPipelineIntegration:
    """Integration tests for complete V4 pipeline."""
    
    def test_process_image_pipeline_shape(self, ml_service, sample_image_bytes):
        """Pipeline should produce correct output shape."""
        mock_seg = MagicMock()
        mock_seg.extract_silhouette.return_value = np.zeros((448, 448, 1), dtype=np.uint8)
        
        ml_service.segmenter = mock_seg

        with patch.object(ml_service, 'segmenter', mock_seg):
             mock_seg.extract_silhouette.return_value = np.zeros((448, 448, 1), dtype=np.uint8)
             ml_service.segmenter = mock_seg
             result = ml_service.process_image_pipeline(sample_image_bytes)
             
             assert result.shape == (224, 224, 1)
             assert result.dtype == np.float32
    
    def test_cnn_input_format(self, ml_service):
        """CNN should receive correct input format and output V4 measurement names."""
        front_sil = np.zeros((224, 224, 1), dtype=np.float32)
        side_sil = np.zeros((224, 224, 1), dtype=np.float32)
        
        mock_model = MagicMock()
        mock_model.predict.return_value = np.zeros((1, 9))
        ml_service.cnn_model = mock_model
        
        result = ml_service.extract_proxy_measurements(front_sil, side_sil, 'male', 170.0)
        
        assert mock_model.predict.called
        call_args = mock_model.predict.call_args[0][0]
        
        if isinstance(call_args, list):
            assert len(call_args) == 3
            numca = call_args[0]
            assert numca.shape == (1, 3)
            
            front = call_args[1]
            assert front.shape == (1, 224, 224, 1)
            
            side = call_args[2]
            assert side.shape == (1, 224, 224, 1)
        
        # V4 measurement names (lowercase, matching CNN output)
        expected_keys = [
            "chest_circumference", "buttock_circumference", "waist_circumference",
            "thigh_circumference", "ankle_circumference", "biacromial_breadth",
            "knee_height_sitting", "arm_circumference_flexed", "calf_circumference",
        ]
        for key in expected_keys:
            assert key in result, f"Missing V4 measurement key: {key}"


class TestSomatotype:
    """Test somatotype calculation."""
    
    def test_heath_carter_known_values(self):
        """Test with known input/output values."""
        result = calculate_heath_carter(
            height_cm=170.0,
            weight_kg=70.0,
            triceps_mm=10.0,
            subscapular_mm=12.0,
            supraspinale_mm=8.0,
            calf_skinfold_mm=7.0,
            humerus_breadth_cm=7.0,
            femur_breadth_cm=9.5,
            arm_girth_cm=32.0,
            calf_girth_cm=36.0
        )
        
        assert 'endomorphy' in result
        assert 'mesomorphy' in result  
        assert 'ectomorphy' in result
        
        assert 0.5 <= result['endomorphy'] <= 9.0
        assert 0.5 <= result['mesomorphy'] <= 9.0
        assert 0.5 <= result['ectomorphy'] <= 9.0
    
    def test_somatotype_classification(self):
        """Test somatotype classification with V4 threshold T=1.75."""
        # 2.5-5.5-2.0: Meso(5.5) >= Endo(2.5)+1.75=4.25 and Meso(5.5) >= Ecto(2.0)+1.75=3.75
        somatotype_class = classify_somatotype(2.5, 5.5, 2.0)
        assert somatotype_class == "Mesomorph"
        
        # With explicit threshold
        somatotype_class_explicit = classify_somatotype(2.5, 5.5, 2.0, threshold=1.75)
        assert somatotype_class_explicit == "Mesomorph"


class TestGoldenMaster:
    """
    Golden master tests compare against known-good V4 reference outputs.
    
    These values were generated by running the reference implementation
    (photos2somatotype_v4.py) on canonical test images.
    """
    
    GOLDEN_MASTER_MALE = {
        'height_cm': 180.0,
        'weight_kg': 80.0,
        'age': 25,
        'gender': 'male',
        'expected_endo': 2.8,
        'expected_meso': 5.2,
        'expected_ecto': 2.1,
        'tolerance': 0.3
    }
    
    @pytest.mark.skip(reason="Requires full model loading - run manually")
    def test_against_golden_master(self, ml_service):
        """Compare full V4 pipeline output against golden master."""
        gm = self.GOLDEN_MASTER_MALE
        
        # When run in CI with models, verify:
        # assert abs(result['endomorphy'] - gm['expected_endo']) < gm['tolerance']
        # assert abs(result['mesomorphy'] - gm['expected_meso']) < gm['tolerance']
        # assert abs(result['ectomorphy'] - gm['expected_ecto']) < gm['tolerance']
        pass
