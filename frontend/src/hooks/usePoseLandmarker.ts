/**
 * Hook to initialize and manage MediaPipe Pose Landmarker
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  PoseLandmarker,
  FilesetResolver,
  type PoseLandmarkerResult,
} from '@mediapipe/tasks-vision';

type PoseInputElement = HTMLVideoElement | HTMLCanvasElement;

interface UsePoseLandmarkerResult {
  landmarker: PoseLandmarker | null;
  isLoading: boolean;
  error: string | null;
  isReady: boolean;
  detectPose: (input: PoseInputElement, timestamp: number) => PoseLandmarkerResult | null;
}

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';

export function usePoseLandmarker(): UsePoseLandmarkerResult {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function initializeLandmarker() {
      try {
        setIsLoading(true);
        setError(null);

        // Load MediaPipe Vision WASM
        const vision = await FilesetResolver.forVisionTasks(WASM_URL);

        // Create PoseLandmarker
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
        });

        if (isMounted) {
          landmarkerRef.current = landmarker;
          setIsReady(true);
          setIsLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          const message = err instanceof Error ? err.message : 'Failed to initialize MediaPipe';
          setError(message);
          setIsLoading(false);
        }
      }
    }

    initializeLandmarker();

    return () => {
      isMounted = false;
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
        landmarkerRef.current = null;
      }
    };
  }, []);

  const detectPose = useCallback(
    (input: PoseInputElement, timestamp: number): PoseLandmarkerResult | null => {
      if (!landmarkerRef.current || !isReady) {
        return null;
      }

      try {
        return landmarkerRef.current.detectForVideo(input as HTMLVideoElement, timestamp);
      } catch (err) {
        console.error('Pose detection error:', err);
        return null;
      }
    },
    [isReady]
  );

  return {
    landmarker: landmarkerRef.current,
    isLoading,
    error,
    isReady,
    detectPose,
  };
}

export default usePoseLandmarker;
