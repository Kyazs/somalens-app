import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProgressChart from './ProgressChart';
import type { MeasurementSession } from '../types/pose';

describe('ProgressChart', () => {
  const mockSessions: MeasurementSession[] = [
    {
      id: '1',
      user_id: 'user1',
      status: 'completed',
      created_at: '2025-01-01T10:00:00Z',
      body_measurements: [
        {
            id: 'm1',
            session_id: '1',
            measurement_type: 'Weight',
            value: 70,
            unit: 'kg',
            created_at: '2025-01-01T10:00:00Z'
        }
      ],
      somatotype_result: {
        id: 's1',
        session_id: '1',
        endomorphy: 3.5,
        mesomorphy: 4.5,
        ectomorphy: 2.5,
        classification: 'Mesomorph-Endomorph',
        created_at: '2025-01-01T10:00:00Z'
      }
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
