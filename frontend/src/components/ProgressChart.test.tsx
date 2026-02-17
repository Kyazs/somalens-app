import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProgressChart from './ProgressChart';
import type { MeasurementSession } from '../types/pose';

describe('ProgressChart', () => {
  const mockSessions: MeasurementSession[] = [
    {
      id: 1,
      user_id: 1,
      name: 'Test User',
      front_image_url: null,
      side_image_url: null,
      height: 175,
      weight: 70,
      gender: 'male',
      age: 25,
      somatotype_endo: 3.5,
      somatotype_meso: 4.5,
      somatotype_ecto: 2.5,
      somatotype_class: 'Mesomorph-Endomorph',
      body_fat_percentage: 15,
      circumferences: {
        Triceps_Skinfold: 10,
        Subscapular_Skinfold: 12,
        Supraspinale_Skinfold: 8,
        Calf_Skinfold: 6,
        Humerus_Breadth: 7.0,
        Femur_Breadth: 9.5,
        Arm_Circumference_Flexed: 35,
        Calf_Circumference: 38
      },
      created_at: '2025-01-01T10:00:00Z'
    }
  ];

  it('renders without crashing', () => {
    window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };

    render(<ProgressChart sessions={mockSessions} />);
    expect(screen.getByText('Weight')).toBeDefined();
    expect(screen.getByText('Endomorphy')).toBeDefined();
  });

  it('renders empty state when no sessions', () => {
    render(<ProgressChart sessions={[]} />);
    expect(screen.getByText(/No measurement history available/i)).toBeDefined();
  });
});
