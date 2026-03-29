import axios from 'axios';
import type { AxiosInstance } from 'axios';
import type { MeasurementSession, ConfidenceData } from '../types/pose';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export interface UserResponse {
  id: number;
  email: string;
  name: string;
  age: number | null;
  gender: string | null;
  is_active: boolean;
}

export interface UserUpdate {
  name?: string;
  age?: number | null;
  gender?: string | null;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface AnalysisResponse {
  id?: number;
  proxy_measurements: Record<string, number>;
  heath_carter_inputs: Record<string, number>;
  somatotype: {
    endomorphy: number;
    mesomorphy: number;
    ectomorphy: number;
    classification: string;
    hwr: number;
  };
  front_image_url?: string | null;
  side_image_url?: string | null;
  confidence_data?: ConfidenceData | null;
}

export interface MeasurementResponse {
  id: number;
  user_id: number;
  front_image_url: string;
  side_image_url: string;
  age: number;
  gender: string;
  height: number | null;
  weight: number | null;
  somatotype_class: string | null;
  somatotype_endo: number | null;
  somatotype_meso: number | null;
  somatotype_ecto: number | null;
  body_fat_percentage: number | null;
  circumferences: Record<string, number> | null;
  confidence_data?: ConfidenceData | null;
  created_at: string;
}

export interface MacroBreakdown {
  protein_g: number;
  carbs_g: number;
  fats_g: number;
  protein_pct: number;
  carbs_pct: number;
  fats_pct: number;
}

export interface MealRecommendations {
  breakfast: string[];
  lunch: string[];
  dinner: string[];
  snacks: string[];
}

export interface FoodItem {
  name: string;
  category: string;
  calories_kcal: number;
  protein_g: number;
  carbohydrates_g: number;
  fat_g: number;
  fiber_g: number;
  sugars_g: number;
  sodium_mg: number;
  portion_recommendation: string;
  meal_timing: string;
  flagged?: boolean;
  warnings?: string[];
}

export interface MealRecommendationsWithNutrients {
  breakfast: FoodItem[];
  lunch: FoodItem[];
  dinner: FoodItem[];
  snacks: FoodItem[];
}

export interface ExerciseInfo {
  exerciseId: string;
  name: string;
  gifUrl: string;
  targetMuscles: string[];
  bodyParts: string[];
  equipments: string[];
  instructions: string[];
  flagged?: boolean;
  warnings?: string[];
}

export interface RecommendationResponse {
  template_id?: string;
  ter?: number;
  macros?: MacroBreakdown;
  meals?: MealRecommendationsWithNutrients;
  fitness_strategy?: string;
  diet_principles?: string;
  exercises?: ExerciseInfo[];
  exercises_ppl?: {
    push: ExerciseInfo[];
    pull: ExerciseInfo[];
    legs: ExerciseInfo[];
  };
  exercise_type?: string;
  somatotype_description?: string;
  message?: string;
  suggestion?: string;
  medical_conditions?: string[];
  exercise_warnings?: string[];
  medical_notes?: string[];
}

const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If error is 401 and we haven't tried refreshing yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) {
            throw new Error('No refresh token');
        }

        const response = await axios.post(`${API_URL}/auth/refresh`, {}, {
          headers: {
            'Authorization': `Bearer ${refreshToken}`
          }
        });
        
        const { access_token, refresh_token: new_refresh_token } = response.data;
        
        localStorage.setItem('access_token', access_token);
        localStorage.setItem('refresh_token', new_refresh_token);
        
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        // If refresh fails, logout
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

function extractErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error) && error.response?.data?.detail) {
    return error.response.data.detail;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

export const api = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    try {
      const response = await axiosInstance.post<LoginResponse>('/auth/login', {
        email,
        password,
      });
      return response.data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Failed to sign in. Please try again.'));
    }
  },

register: async (email: string, password: string, name: string): Promise<UserResponse> => {
    try {
      const response = await axiosInstance.post<UserResponse>('/users/', {
        email,
        password,
        name,
      });
      return response.data;
    } catch (error) {
      throw new Error(extractErrorMessage(error, 'Failed to create account. Please try again.'));
    }
  },

getMe: async (): Promise<UserResponse> => {
    const response = await axiosInstance.get<UserResponse>('/users/me');
    return response.data;
  },

  updateProfile: async (data: UserUpdate): Promise<UserResponse> => {
    const response = await axiosInstance.patch<UserResponse>('/users/me', data);
    return response.data;
  },

  analyze: async (
    frontImage: Blob, 
    sideImage: Blob, 
    age: number, 
    gender: 'male' | 'female',
    heightCm: number | undefined,
    weightKg: number,
    name?: string,
    medicalConditions?: string[]
  ): Promise<AnalysisResponse> => {
    const formData = new FormData();
    formData.append('front_image', frontImage, 'front.jpg');
    formData.append('side_image', sideImage, 'side.jpg');
    formData.append('age', age.toString());
    formData.append('gender', gender);
    if (heightCm !== undefined && heightCm > 0) {
      formData.append('height', heightCm.toString());
    }
    formData.append('weight', weightKg.toString());
    if (name) formData.append('name', name);
    if (medicalConditions && medicalConditions.length > 0) {
      formData.append('medical_conditions', medicalConditions.join(','));
    }

    const response = await axiosInstance.post<AnalysisResponse>('/measurements/analyze', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  getHistory: async (): Promise<MeasurementSession[]> => {
      const response = await axiosInstance.get<MeasurementSession[]>('/history/');
      return response.data;
  },

  getMeasurement: async (id: number): Promise<MeasurementResponse> => {
      const response = await axiosInstance.get<MeasurementResponse>(`/history/${id}`);
      return response.data;
  },

  pollMeasurementUntilComplete: async (
    id: number, 
    onProgress?: (status: string) => void,
    maxAttempts: number = 360,
    intervalMs: number = 5000
  ): Promise<MeasurementResponse> => {
    const progressMessages = [
      'Uploading images...',
      'Processing images...',
      'Loading AI models...',
      'Extracting body measurements...',
      'Calculating somatotype...',
      'Analyzing body composition...',
      'Finalizing results...',
      'Still processing, this can take 2-5 minutes on first run...',
      'Models are loading, please be patient...',
    ];

    let consecutiveErrors = 0;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const measurement = await api.getMeasurement(id);
        consecutiveErrors = 0;  // Reset on success
        
        if (measurement.somatotype_class !== null) {
          onProgress?.('Complete!');
          return measurement;
        }
      } catch (err) {
        consecutiveErrors++;
        console.warn(`Poll attempt ${attempt} failed (${consecutiveErrors} consecutive):`, err);
        
        // Give up after 3 consecutive failures
        if (consecutiveErrors >= 3) {
          throw new Error('Server temporarily unavailable. Your analysis is still processing — please check your history in a moment.');
        }
      }
      
      const msgIndex = Math.min(attempt, progressMessages.length - 1);
      onProgress?.(progressMessages[msgIndex]);
      
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    
    throw new Error('Processing timeout. Please try again.');
  },

  getRecommendation: async (
    measurementId: number,
    goal: string,
    activityLevel: string,
    exerciseComplexity: string,
    exerciseType: string,
    medicalConditions: string[] = []
  ): Promise<RecommendationResponse> => {
    const params = new URLSearchParams({
      goal,
      activity_level: activityLevel,
      exercise_complexity: exerciseComplexity,
      exercise_type: exerciseType,
    });
    if (medicalConditions.length > 0) {
      params.set('medical_conditions', medicalConditions.join(','));
    }
    const response = await axiosInstance.get<RecommendationResponse>(
      `/recommendations/${measurementId}?${params.toString()}`
    );
    return response.data;
  },

  deleteAccount: async (): Promise<void> => {
    await axiosInstance.delete('/users/me');
  },

  deleteMeasurement: async (id: number): Promise<void> => {
    await axiosInstance.delete(`/history/${id}`);
  }
};
