import { create } from 'zustand';

interface CaptureState {
  step: 'front' | 'side' | 'preview';
  frontImage: Blob | null;
  sideImage: Blob | null;
  frontPreview: string | null;
  sidePreview: string | null;
  userData: {
    name: string;
    age: string;
    height: string;
    weight: string;
    gender: 'male' | 'female';
    heightMode: 'input' | 'predicted';
    goal: 'weight_loss' | 'weight_gain' | 'maintenance';
    activityLevel: 'sedentary' | 'light' | 'moderate' | 'heavy';
    exerciseComplexity: 'beginner' | 'intermediate' | 'hard';
    exerciseType: 'bodyweight' | 'gym';
  };
  setFrontImage: (blob: Blob, preview: string) => void;
  setSideImage: (blob: Blob, preview: string) => void;
  setUserData: (data: Partial<CaptureState['userData']>) => void;
  reset: () => void;
  goToSideCapture: () => void;
  goToPreview: () => void;
  setStep: (step: 'front' | 'side' | 'preview') => void;
}

export const useCaptureStore = create<CaptureState>((set) => ({
  step: 'front',
  frontImage: null,
  sideImage: null,
  frontPreview: null,
  sidePreview: null,
  userData: {
    name: '',
    age: '',
    height: '',
    weight: '',
    gender: 'male',
    heightMode: 'input',
    goal: 'maintenance',
    activityLevel: 'moderate',
    exerciseComplexity: 'beginner',
    exerciseType: 'gym'
  },
  setFrontImage: (blob, preview) => set({ frontImage: blob, frontPreview: preview }),
  setSideImage: (blob, preview) => set({ sideImage: blob, sidePreview: preview }),
  setUserData: (data) => set((state) => ({ userData: { ...state.userData, ...data } })),
  reset: () => set({
    step: 'front',
    frontImage: null,
    sideImage: null,
    frontPreview: null,
    sidePreview: null,
    userData: {
      name: '',
      age: '',
      height: '',
      weight: '',
      gender: 'male',
      heightMode: 'input',
      goal: 'maintenance',
      activityLevel: 'moderate',
      exerciseComplexity: 'beginner',
      exerciseType: 'gym'
    }
  }),
  goToSideCapture: () => set({ step: 'side' }),
  goToPreview: () => set({ step: 'preview' }),
  setStep: (step) => set({ step }),
}));
