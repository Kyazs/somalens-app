/**
 * Pose-related type definitions for MediaPipe integration
 */

import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

export type PoseType = 'front' | 'side' | 'unknown';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface PoseLandmarks {
  landmarks: NormalizedLandmark[];
  worldLandmarks: NormalizedLandmark[];
}

export interface PoseLandmarkerState {
  isLoading: boolean;
  error: string | null;
  isReady: boolean;
}

export type DistanceEstimate = 'too_close' | 'ok' | 'too_far';

// MediaPipe Pose Landmark indices
export const POSE_LANDMARKS = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
} as const;

export interface BodyMeasurement {
  id: string;
  session_id: string;
  measurement_type: string;
  value: number;
  unit: string;
  confidence?: number;
  created_at: string;
}

export interface SomatotypeResult {
  id: string;
  session_id: string;
  endomorphy: number;
  mesomorphy: number;
  ectomorphy: number;
  classification: string;
  created_at: string;
}

export interface MeasurementSession {
  id: string;
  user_id: string;
  status: string;
  front_image_path?: string;
  side_image_path?: string;
  created_at: string;
  body_measurements: BodyMeasurement[];
  somatotype_result?: SomatotypeResult;
}
