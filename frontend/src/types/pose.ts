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

/**
 * Backend Measurement model - matches what the API returns
 */
export interface MeasurementSession {
  id: number;
  user_id: number;
  name: string | null;
  front_image_url: string | null;
  side_image_url: string | null;
  height: number | null;
  weight: number | null;
  gender: string | null;
  age: number | null;
  somatotype_endo: number | null;
  somatotype_meso: number | null;
  somatotype_ecto: number | null;
  somatotype_class: string | null;
  body_fat_percentage: number | null;
  circumferences: Record<string, number> | null;
  medical_conditions?: string[] | null;
  confidence_data?: ConfidenceData | null;
  created_at: string;
}

export interface ConfidenceData {
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  n_flagged: number;
  flagged_measurements: string[];
  boundary_sensitive: boolean;
  uncertainty_band: { endo: number; meso: number; ecto: number };
  per_measurement: ConfidenceMeasurement[];
  conformal_intervals: Record<string, ConformalInterval>;
  explanation: string;
  near_border_classes: string[];
  tau: number;
  alpha: number;
}

export interface ConfidenceMeasurement {
  measurement: string;
  value: number;
  mae: number;
  conformal_q90: number;
  ci_lower: number;
  ci_upper: number;
  impact_endo: number;
  impact_meso: number;
  impact_ecto: number;
  max_impact: number;
  flagged: boolean;
}

export interface ConformalInterval {
  value: number;
  lower: number;
  upper: number;
  half_width: number;
  unit: string;
}

/**
 * Heath-Carter measurement keys stored in circumferences
 */
export const SKINFOLD_KEYS = [
  'Triceps_Skinfold',
  'Subscapular_Skinfold',
  'Supraspinale_Skinfold',
  'Calf_Skinfold',
] as const;

export const BREADTH_KEYS = [
  'Humerus_Breadth',
  'Femur_Breadth',
] as const;

export const GIRTH_KEYS = [
  'Arm_Circumference_Flexed',
  'Calf_Circumference',
] as const;

export const ADDITIONAL_GIRTH_KEYS = [
  'Chest_Circumference',
  'Waist_Circumference',
  'Hip_Circumference',
  'Thigh_Circumference',
] as const;

export type SkinfoldKey = typeof SKINFOLD_KEYS[number];
export type BreadthKey = typeof BREADTH_KEYS[number];
export type GirthKey = typeof GIRTH_KEYS[number];
export type AdditionalGirthKey = typeof ADDITIONAL_GIRTH_KEYS[number];
