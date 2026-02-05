import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CapturePage } from './CapturePage';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../hooks/usePoseLandmarker', () => ({
  usePoseLandmarker: () => ({
    isLoading: false,
    error: null,
    isReady: true,
    detectPose: vi.fn(),
  }),
}));

vi.mock('../hooks/usePoseValidation', () => ({
  usePoseValidation: () => ({
    validateFrontPose: vi.fn().mockReturnValue({ isValid: true, errors: [], warnings: [] }),
    validateSidePose: vi.fn(),
    detectPoseType: vi.fn().mockReturnValue('front'),
  }),
}));

vi.mock('../hooks/useImageCapture', () => ({
  useImageCapture: () => ({
    captureFrame: vi.fn(),
    createPreview: vi.fn(),
  }),
}));

vi.mock('../stores/captureStore', () => ({
  useCaptureStore: () => ({
    step: 'front',
    userData: {
        name: '',
        age: '',
        height: '',
        weight: '',
        gender: 'male'
    },
    setUserData: vi.fn(),
    setFrontImage: vi.fn(),
    setSideImage: vi.fn(),
    goToSideCapture: vi.fn(),
    goToPreview: vi.fn(),
    reset: vi.fn(),
  }),
}));

describe('CapturePage', () => {
  beforeEach(() => {
    Object.defineProperty(window.navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [],
        }),
      },
      writable: true,
    });
  });

  it('renders setup form initially', () => {
    render(
      <MemoryRouter>
        <CapturePage />
      </MemoryRouter>
    );
    expect(screen.getByText('Profile Setup')).toBeTruthy();
  });
});
