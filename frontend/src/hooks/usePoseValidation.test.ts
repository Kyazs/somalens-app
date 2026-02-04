import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePoseValidation } from './usePoseValidation';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { POSE_LANDMARKS } from '../types/pose';

// Helper to create mock landmarks
const createMockLandmarks = (overrides: Partial<Record<number, NormalizedLandmark>> = {}): NormalizedLandmark[] => {
  const landmarks: NormalizedLandmark[] = Array(33).fill({ x: 0, y: 0, z: 0, visibility: 0.9 });
  
  Object.entries(overrides).forEach(([index, landmark]) => {
    landmarks[Number(index)] = { ...landmarks[Number(index)], ...landmark };
  });
  
  return landmarks;
};

describe('usePoseValidation', () => {
  const { result } = renderHook(() => usePoseValidation());
  const { 
    detectPoseType, 
    checkBodyFullyVisible, 
    checkCentered, 
    estimateDistance,
    validateFrontPose
  } = result.current;

  describe('detectPoseType', () => {
    it('should detect front pose when shoulders have similar depth', () => {
      const landmarks = createMockLandmarks({
        [POSE_LANDMARKS.LEFT_SHOULDER]: { x: 0.4, y: 0.2, z: 0.1, visibility: 0.9 },
        [POSE_LANDMARKS.RIGHT_SHOULDER]: { x: 0.6, y: 0.2, z: 0.12, visibility: 0.9 }, // Diff 0.02 < 0.1
      });
      expect(detectPoseType(landmarks)).toBe('front');
    });

    it('should detect side pose when shoulders have different depth', () => {
      const landmarks = createMockLandmarks({
        [POSE_LANDMARKS.LEFT_SHOULDER]: { x: 0.5, y: 0.2, z: 0.1, visibility: 0.9 },
        [POSE_LANDMARKS.RIGHT_SHOULDER]: { x: 0.5, y: 0.2, z: 0.3, visibility: 0.9 }, // Diff 0.2 > 0.15
      });
      expect(detectPoseType(landmarks)).toBe('side');
    });

    it('should return unknown for ambiguous poses', () => {
      const landmarks = createMockLandmarks({
        [POSE_LANDMARKS.LEFT_SHOULDER]: { x: 0.5, y: 0.2, z: 0.1, visibility: 0.9 },
        [POSE_LANDMARKS.RIGHT_SHOULDER]: { x: 0.5, y: 0.2, z: 0.22, visibility: 0.9 }, // Diff 0.12 (between 0.1 and 0.15)
      });
      expect(detectPoseType(landmarks)).toBe('unknown');
    });
  });

  describe('checkBodyFullyVisible', () => {
    it('should return true when all critical landmarks are visible', () => {
      const landmarks = createMockLandmarks();
      expect(checkBodyFullyVisible(landmarks)).toBe(true);
    });

    it('should return false when a critical landmark is not visible', () => {
      const landmarks = createMockLandmarks({
        [POSE_LANDMARKS.LEFT_ANKLE]: { x: 0, y: 0, z: 0, visibility: 0.5 }, // < 0.65
      });
      expect(checkBodyFullyVisible(landmarks)).toBe(false);
    });
  });

  describe('checkCentered', () => {
    it('should return true when nose is centered', () => {
      const landmarks = createMockLandmarks({
        [POSE_LANDMARKS.NOSE]: { x: 0.5, y: 0.2, z: 0, visibility: 0.9 },
      });
      expect(checkCentered(landmarks)).toBe(true);
    });

    it('should return false when nose is too far left', () => {
      const landmarks = createMockLandmarks({
        [POSE_LANDMARKS.NOSE]: { x: 0.2, y: 0.2, z: 0, visibility: 0.9 },
      });
      expect(checkCentered(landmarks)).toBe(false);
    });

    it('should return false when nose is too far right', () => {
      const landmarks = createMockLandmarks({
        [POSE_LANDMARKS.NOSE]: { x: 0.8, y: 0.2, z: 0, visibility: 0.9 },
      });
      expect(checkCentered(landmarks)).toBe(false);
    });
  });

  describe('estimateDistance', () => {
    it('should return too_close when torso is too large', () => {
      const landmarks = createMockLandmarks({
        [POSE_LANDMARKS.LEFT_SHOULDER]: { x: 0.4, y: 0.1, z: 0, visibility: 0.9 },
        [POSE_LANDMARKS.RIGHT_SHOULDER]: { x: 0.6, y: 0.1, z: 0, visibility: 0.9 },
        [POSE_LANDMARKS.LEFT_HIP]: { x: 0.4, y: 0.6, z: 0, visibility: 0.9 },
        [POSE_LANDMARKS.RIGHT_HIP]: { x: 0.6, y: 0.6, z: 0, visibility: 0.9 },
        // Height = 0.5 > 0.4
      });
      expect(estimateDistance(landmarks)).toBe('too_close');
    });

    it('should return too_far when torso is too small', () => {
      const landmarks = createMockLandmarks({
        [POSE_LANDMARKS.LEFT_SHOULDER]: { x: 0.4, y: 0.4, z: 0, visibility: 0.9 },
        [POSE_LANDMARKS.RIGHT_SHOULDER]: { x: 0.6, y: 0.4, z: 0, visibility: 0.9 },
        [POSE_LANDMARKS.LEFT_HIP]: { x: 0.4, y: 0.5, z: 0, visibility: 0.9 },
        [POSE_LANDMARKS.RIGHT_HIP]: { x: 0.6, y: 0.5, z: 0, visibility: 0.9 },
        // Height = 0.1 < 0.2
      });
      expect(estimateDistance(landmarks)).toBe('too_far');
    });

    it('should return ok when torso is optimal', () => {
      const landmarks = createMockLandmarks({
        [POSE_LANDMARKS.LEFT_SHOULDER]: { x: 0.4, y: 0.3, z: 0, visibility: 0.9 },
        [POSE_LANDMARKS.RIGHT_SHOULDER]: { x: 0.6, y: 0.3, z: 0, visibility: 0.9 },
        [POSE_LANDMARKS.LEFT_HIP]: { x: 0.4, y: 0.6, z: 0, visibility: 0.9 },
        [POSE_LANDMARKS.RIGHT_HIP]: { x: 0.6, y: 0.6, z: 0, visibility: 0.9 },
        // Height = 0.3 (between 0.2 and 0.4)
      });
      expect(estimateDistance(landmarks)).toBe('ok');
    });
  });

  describe('validateFrontPose', () => {
    it('should return valid for perfect front pose', () => {
      const landmarks = createMockLandmarks({
        [POSE_LANDMARKS.NOSE]: { x: 0.5, y: 0.2, z: 0, visibility: 0.9 },
        [POSE_LANDMARKS.LEFT_SHOULDER]: { x: 0.4, y: 0.3, z: 0.1, visibility: 0.9 },
        [POSE_LANDMARKS.RIGHT_SHOULDER]: { x: 0.6, y: 0.3, z: 0.1, visibility: 0.9 },
        [POSE_LANDMARKS.LEFT_HIP]: { x: 0.4, y: 0.6, z: 0.1, visibility: 0.9 },
        [POSE_LANDMARKS.RIGHT_HIP]: { x: 0.6, y: 0.6, z: 0.1, visibility: 0.9 },
        [POSE_LANDMARKS.LEFT_ANKLE]: { x: 0.4, y: 0.9, z: 0.1, visibility: 0.9 },
        [POSE_LANDMARKS.RIGHT_ANKLE]: { x: 0.6, y: 0.9, z: 0.1, visibility: 0.9 },
      });
      const result = validateFrontPose(landmarks);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
