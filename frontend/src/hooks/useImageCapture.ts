import { useCallback } from 'react';

interface UseImageCaptureResult {
  captureFrame: (video: HTMLVideoElement) => Promise<Blob>;
  createPreview: (blob: Blob) => string;
  revokePreview: (url: string) => void;
}

export function useImageCapture(): UseImageCaptureResult {
  const captureFrame = useCallback(async (video: HTMLVideoElement): Promise<Blob> => {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    // Draw the current video frame to the canvas
    // We flip horizontally if the video is mirrored (user facing camera usually is)
    // But for analysis we might want the raw image. 
    // Let's assume we capture exactly what is on the video element.
    // If the video element is styled with transform: scaleX(-1), the capture will NOT be flipped by default drawImage.
    // We should probably capture it "as is" (unmirrored) for analysis, 
    // but the preview might need to be mirrored if the user expects a mirror.
    // However, for medical/posture analysis, a non-mirrored image (true view) is usually better.
    // Let's stick to standard drawImage.
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob from canvas'));
          }
        },
        'image/jpeg',
        0.9
      );
    });
  }, []);

  const createPreview = useCallback((blob: Blob): string => {
    return URL.createObjectURL(blob);
  }, []);

  const revokePreview = useCallback((url: string) => {
    URL.revokeObjectURL(url);
  }, []);

  return {
    captureFrame,
    createPreview,
    revokePreview,
  };
}

export default useImageCapture;
