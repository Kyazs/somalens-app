import { useCallback } from 'react';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import type {
  PoseType,
  ValidationResult,
  DistanceEstimate,
} from '../types/pose';
import { POSE_LANDMARKS } from '../types/pose';

export interface UsePoseValidationResult {
  detectPoseType: (landmarks: NormalizedLandmark[]) => PoseType;
  validateFrontPose: (landmarks: NormalizedLandmark[]) => ValidationResult;
  validateSidePose: (landmarks: NormalizedLandmark[]) => ValidationResult;
  checkBodyFullyVisible: (landmarks: NormalizedLandmark[]) => boolean;
  checkCentered: (landmarks: NormalizedLandmark[]) => boolean;
  estimateDistance: (landmarks: NormalizedLandmark[]) => DistanceEstimate;
}

export function usePoseValidation(): UsePoseValidationResult {
  const detectPoseType = useCallback((landmarks: NormalizedLandmark[]): PoseType => {
    if (!landmarks || landmarks.length === 0) return 'unknown';

    const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
    const rightShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];

    if (!leftShoulder || !rightShoulder) return 'unknown';

    const depthDiff = Math.abs(leftShoulder.z - rightShoulder.z);

    if (depthDiff < 0.1) {
      return 'front';
    } else if (depthDiff > 0.15) {
      return 'side';
    }

    return 'unknown';
  }, []);

  const checkBodyFullyVisible = useCallback((landmarks: NormalizedLandmark[]): boolean => {
    if (!landmarks || landmarks.length === 0) return false;

    const criticalLandmarks = [
      POSE_LANDMARKS.NOSE,
      POSE_LANDMARKS.LEFT_SHOULDER,
      POSE_LANDMARKS.RIGHT_SHOULDER,
      POSE_LANDMARKS.LEFT_HIP,
      POSE_LANDMARKS.RIGHT_HIP,
      POSE_LANDMARKS.LEFT_ANKLE,
      POSE_LANDMARKS.RIGHT_ANKLE,
    ];

    return criticalLandmarks.every((index) => {
      const landmark = landmarks[index];
      return landmark && landmark.visibility && landmark.visibility > 0.65;
    });
  }, []);

  const checkCentered = useCallback((landmarks: NormalizedLandmark[]): boolean => {
    if (!landmarks || landmarks.length === 0) return false;

    const nose = landmarks[POSE_LANDMARKS.NOSE];
    if (!nose) return false;

    return nose.x >= 0.3 && nose.x <= 0.7;
  }, []);

  const estimateDistance = useCallback((landmarks: NormalizedLandmark[]): DistanceEstimate => {
    if (!landmarks || landmarks.length === 0) return 'too_far'; // Default safe fallback

    const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
    const rightShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
    const leftHip = landmarks[POSE_LANDMARKS.LEFT_HIP];
    const rightHip = landmarks[POSE_LANDMARKS.RIGHT_HIP];

    if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) return 'too_far';

    // Calculate average shoulder y and average hip y
    const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
    const hipY = (leftHip.y + rightHip.y) / 2;

    // Calculate vertical distance (height of torso in frame)
    const torsoHeight = Math.abs(hipY - shoulderY);

    if (torsoHeight > 0.4) {
      return 'too_close';
    } else if (torsoHeight < 0.2) {
      return 'too_far';
    }

    return 'ok';
  }, []);

  const validateFrontPose = useCallback(
    (landmarks: NormalizedLandmark[]): ValidationResult => {
      const errors: string[] = [];
      const warnings: string[] = [];

      if (!checkBodyFullyVisible(landmarks)) {
        errors.push('Body not fully visible');
      }

      if (!checkCentered(landmarks)) {
        warnings.push('Move to center of frame');
      }

      const distance = estimateDistance(landmarks);
      if (distance === 'too_close') {
        errors.push('Too close to camera');
      } else if (distance === 'too_far') {
        warnings.push('Move closer to camera');
      }

      // Check if arms are relaxed (wrists below elbows, elbows below shoulders roughly)
      // This is a basic check, can be refined
      // For now, let's just check if feet are apart
      const leftAnkle = landmarks[POSE_LANDMARKS.LEFT_ANKLE];
      const rightAnkle = landmarks[POSE_LANDMARKS.RIGHT_ANKLE];

      if (leftAnkle && rightAnkle) {
        const feetDistance = Math.abs(leftAnkle.x - rightAnkle.x);
        if (feetDistance < 0.05) {
          warnings.push('Stand with feet shoulder-width apart');
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
      };
    },
    [checkBodyFullyVisible, checkCentered, estimateDistance]
  );

  const validateSidePose = useCallback(
    (landmarks: NormalizedLandmark[]): ValidationResult => {
      const errors: string[] = [];
      const warnings: string[] = [];

      // For side poses, use relaxed visibility — only require key landmarks
      // Far-side limbs are naturally occluded when turned sideways
      const sideVisibleLandmarks = [
        POSE_LANDMARKS.NOSE,
        POSE_LANDMARKS.LEFT_SHOULDER,
        POSE_LANDMARKS.RIGHT_SHOULDER,
        POSE_LANDMARKS.LEFT_HIP,
        POSE_LANDMARKS.RIGHT_HIP,
      ];

      const sideBodyVisible = sideVisibleLandmarks.every((index) => {
        const landmark = landmarks[index];
        return landmark && landmark.visibility && landmark.visibility > 0.5;
      });

      if (!sideBodyVisible) {
        errors.push('Body not fully visible');
      }

      if (!checkCentered(landmarks)) {
        warnings.push('Move to center of frame');
      }

      const distance = estimateDistance(landmarks);
      if (distance === 'too_close') {
        errors.push('Too close to camera');
      } else if (distance === 'too_far') {
        warnings.push('Move closer to camera');
      }

      // CRITICAL: Check profile angle — shoulders must show significant depth difference
      const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
      const rightShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];

      if (leftShoulder && rightShoulder) {
        const depthDiff = Math.abs(leftShoulder.z - rightShoulder.z);
        if (depthDiff <= 0.15) {
           errors.push('Turn 90 degrees to the side');
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
      };
    },
    [checkCentered, estimateDistance]
  );

  return {
    detectPoseType,
    validateFrontPose,
    validateSidePose,
    checkBodyFullyVisible,
    checkCentered,
    estimateDistance,
  };
}

export default usePoseValidation;
