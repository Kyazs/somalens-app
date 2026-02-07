import { useCallback } from 'react';

interface UseImageCaptureResult {
  captureFrame: (video: HTMLVideoElement, rotation?: number) => Promise<Blob>;
  createPreview: (blob: Blob) => string;
  revokePreview: (url: string) => void;
}

export function useImageCapture(): UseImageCaptureResult {
  const captureFrame = useCallback(async (video: HTMLVideoElement, rotation: number = 0): Promise<Blob> => {
    const canvas = document.createElement('canvas');
    const isRotated90or270 = rotation === 90 || rotation === 270;
    
    canvas.width = isRotated90or270 ? video.videoHeight : video.videoWidth;
    canvas.height = isRotated90or270 ? video.videoWidth : video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    if (rotation !== 0) {
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      if (rotation === 90 || rotation === 270) {
        ctx.drawImage(video, -video.videoWidth / 2, -video.videoHeight / 2);
      } else {
        ctx.drawImage(video, -canvas.width / 2, -canvas.height / 2);
      }
    } else {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }

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
