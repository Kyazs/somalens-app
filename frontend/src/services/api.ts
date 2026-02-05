import axios from 'axios';
import type { AxiosInstance } from 'axios';
import type { MeasurementSession } from '../types/pose';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export interface UserResponse {
  id: string;
  email: string;
  created_at: string;
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
  chest_circumference: number | null;
  waist_circumference: number | null;
  hip_circumference: number | null;
  arm_circumference: number | null;
  thigh_circumference: number | null;
  calf_circumference: number | null;
  skinfold_triceps: number | null;
  skinfold_subscapular: number | null;
  skinfold_supraspinale: number | null;
  skinfold_calf: number | null;
  created_at: string;
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

        const response = await axios.post(`${API_URL}/auth/refresh`, {
          refresh_token: refreshToken
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

export const api = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const response = await axiosInstance.post<LoginResponse>('/auth/login', {
      email,
      password,
    });
    return response.data;
  },

  register: async (email: string, password: string): Promise<UserResponse> => {
    const response = await axiosInstance.post<UserResponse>('/auth/register', {
      email,
      password,
    });
    return response.data;
  },

  getMe: async (): Promise<UserResponse> => {
    const response = await axiosInstance.get<UserResponse>('/auth/me');
    return response.data;
  },

  analyze: async (
    frontImage: Blob, 
    sideImage: Blob, 
    age: number, 
    gender: 'male' | 'female',
    heightCm: number,
    weightKg: number
  ): Promise<AnalysisResponse> => {
    const formData = new FormData();
    formData.append('front_image', frontImage, 'front.jpg');
    formData.append('side_image', sideImage, 'side.jpg');
    formData.append('age', age.toString());
    formData.append('gender', gender);
    formData.append('user_height_cm', heightCm.toString());
    formData.append('user_weight_kg', weightKg.toString());

    const response = await axiosInstance.post<AnalysisResponse>('/measurements/analyze', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  getHistory: async (): Promise<MeasurementSession[]> => {
      const response = await axiosInstance.get<MeasurementSession[]>('/measurements/history');
      return response.data;
  },
  
  saveMeasurement: async (sessionData: any): Promise<MeasurementSession> => {
      const response = await axiosInstance.post<MeasurementSession>('/measurements/save', sessionData);
      return response.data;
  },

  getMeasurement: async (id: number): Promise<MeasurementResponse> => {
      const response = await axiosInstance.get<MeasurementResponse>(`/history/${id}`);
      return response.data;
  },

  pollMeasurementUntilComplete: async (
    id: number, 
    onProgress?: (status: string) => void,
    maxAttempts: number = 60,
    intervalMs: number = 2000
  ): Promise<MeasurementResponse> => {
    const progressMessages = [
      'Uploading images...',
      'Processing images...',
      'Extracting body measurements...',
      'Calculating somatotype...',
      'Analyzing body composition...',
      'Finalizing results...'
    ];

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const measurement = await api.getMeasurement(id);
      
      if (measurement.somatotype_class !== null) {
        onProgress?.('Complete!');
        return measurement;
      }
      
      const msgIndex = Math.min(attempt, progressMessages.length - 1);
      onProgress?.(progressMessages[msgIndex]);
      
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    
    throw new Error('Processing timeout. Please try again.');
  }
};
