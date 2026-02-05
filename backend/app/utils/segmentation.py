import torch
import numpy as np
from torchvision import transforms
from torchvision.models.segmentation import deeplabv3_resnet101, DeepLabV3_ResNet101_Weights
from PIL import Image

class DeepLabV3Segmenter:
    """
    Singleton segmenter using DeepLabV3 for person extraction.
    
    Usage:
        segmenter = DeepLabV3Segmenter()
        mask = segmenter.extract_silhouette(rgb_image)  # np.ndarray (H, W, 3)
        # mask is np.ndarray (H, W, 1) with values 0 or 255
    """
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(DeepLabV3Segmenter, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
            
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        
        # Load model using torchvision
        # Use DEFAULT weights which maps to the best available weights
        self.segmentation_model = deeplabv3_resnet101(weights=DeepLabV3_ResNet101_Weights.DEFAULT)
        self.segmentation_model.to(self.device)
        self.segmentation_model.eval()
        
        self._initialized = True

    def extract_silhouette(self, image: np.ndarray) -> np.ndarray:
        """
        Extract silhouette from image using DeepLabV3.
        
        Args:
            image: Input image as numpy array (H, W, 3)
            
        Returns:
            Binary mask as numpy array (H, W, 1) where person=255, background=0
        """
        # Convert numpy array to PIL Image for transforms
        # Verify if input is numpy and convert
        if isinstance(image, np.ndarray):
            img = Image.fromarray(image)
        else:
            img = image

        # Prepare image for segmentation
        preprocess = transforms.Compose([
            transforms.Resize((448, 448)),  # IMG_RESIZE = 448
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406], 
                std=[0.229, 0.224, 0.225]
            ),
        ])
        
        input_tensor = preprocess(img)
        input_batch = input_tensor.unsqueeze(0).to(self.device)
        
        # Run segmentation
        with torch.no_grad():
            output = self.segmentation_model(input_batch)["out"][0]
        
        # Get person mask (class 15 in COCO)
        output_predictions = output.argmax(0).byte().cpu().numpy()
        person_mask = (output_predictions == 15).astype(np.uint8) * 255
        
        # Return as (H, W, 1)
        return person_mask.reshape(person_mask.shape[0], person_mask.shape[1], 1)
