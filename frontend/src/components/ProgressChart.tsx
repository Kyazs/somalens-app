import React, { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import type { MeasurementSession } from '../types/pose';

interface ProgressChartProps {
  sessions: MeasurementSession[];
}

interface ChartDataPoint {
  date: string;
  timestamp: number;
  endomorphy?: number;
  mesomorphy?: number;
  ectomorphy?: number;
  weight?: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    name: string;
    color: string;
    dataKey?: string;
  }>;
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 border border-slate-700 p-4 rounded-lg shadow-xl backdrop-blur-sm bg-opacity-90">
        <p className="text-slate-300 mb-2 font-medium">{label}</p>
        <div className="space-y-1">
          {payload.map((entry) => (
            <div key={entry.name} className="flex items-center gap-2 text-sm">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-slate-400 capitalize">{entry.name}:</span>
              <span className="text-white font-mono font-bold">
                {entry.value?.toFixed(1)}
                {entry.name === 'weight' ? 'kg' : ''}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

const ProgressChart: React.FC<ProgressChartProps> = ({ sessions }) => {
  const [visibleMetrics, setVisibleMetrics] = useState({
    endomorphy: true,
    mesomorphy: true,
    ectomorphy: true,
    weight: true
  });

  const data = useMemo(() => {
    return sessions
      .map(session => {
        const date = new Date(session.created_at);
        
        return {
          date: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date),
          timestamp: date.getTime(),
          endomorphy: session.somatotype_endo ?? undefined,
          mesomorphy: session.somatotype_meso ?? undefined,
          ectomorphy: session.somatotype_ecto ?? undefined,
          weight: session.weight ?? undefined
        } as ChartDataPoint;
      })
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [sessions]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
        <p className="text-slate-500 dark:text-slate-400">No measurement history available yet.</p>
      </div>
    );
  }

  const toggleMetric = (metric: keyof typeof visibleMetrics) => {
    setVisibleMetrics(prev => ({ ...prev, [metric]: !prev[metric] }));
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap gap-2 justify-end mb-4">
        <button
          onClick={() => toggleMetric('endomorphy')}
          className={`px-3 py-1 text-xs rounded-full border transition-all ${
            visibleMetrics.endomorphy 
              ? 'bg-rose-500 text-white border-rose-500' 
              : 'text-slate-500 border-slate-300 dark:border-slate-700 hover:border-rose-500 hover:text-rose-500'
          }`}
        >
          Endomorphy
        </button>
        <button
          onClick={() => toggleMetric('mesomorphy')}
          className={`px-3 py-1 text-xs rounded-full border transition-all ${
            visibleMetrics.mesomorphy 
              ? 'bg-emerald-500 text-white border-emerald-500' 
              : 'text-slate-500 border-slate-300 dark:border-slate-700 hover:border-emerald-500 hover:text-emerald-500'
          }`}
        >
          Mesomorphy
        </button>
        <button
          onClick={() => toggleMetric('ectomorphy')}
          className={`px-3 py-1 text-xs rounded-full border transition-all ${
            visibleMetrics.ectomorphy 
              ? 'bg-indigo-500 text-white border-indigo-500' 
              : 'text-slate-500 border-slate-300 dark:border-slate-700 hover:border-indigo-500 hover:text-indigo-500'
          }`}
        >
          Ectomorphy
        </button>
        <button
          onClick={() => toggleMetric('weight')}
          className={`px-3 py-1 text-xs rounded-full border transition-all ${
            visibleMetrics.weight 
              ? 'bg-amber-500 text-white border-amber-500' 
              : 'text-slate-500 border-slate-300 dark:border-slate-700 hover:border-amber-500 hover:text-amber-500'
          }`}
        >
          Weight
        </button>
      </div>

      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} opacity={0.3} />
            <XAxis 
              dataKey="date" 
              stroke="#94a3b8" 
              tick={{ fill: '#94a3b8', fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              yAxisId="left"
              stroke="#94a3b8"
              tick={{ fill: '#94a3b8', fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              domain={[0, 10]}
              allowDataOverflow={false}
            />
            <YAxis 
              yAxisId="right" 
              orientation="right" 
              stroke="#f59e0b" 
              tick={{ fill: '#f59e0b', fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              domain={['auto', 'auto']}
              hide={!visibleMetrics.weight}
            />
            <Tooltip content={<CustomTooltip />} />
            
            {visibleMetrics.endomorphy && (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="endomorphy"
                stroke="#f43f5e"
                strokeWidth={3}
                dot={{ r: 4, strokeWidth: 0, fill: '#f43f5e' }}
                activeDot={{ r: 6, strokeWidth: 0 }}
                animationDuration={1500}
              />
            )}
            {visibleMetrics.mesomorphy && (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="mesomorphy"
                stroke="#10b981"
                strokeWidth={3}
                dot={{ r: 4, strokeWidth: 0, fill: '#10b981' }}
                activeDot={{ r: 6, strokeWidth: 0 }}
                animationDuration={1500}
                animationBegin={200}
              />
            )}
            {visibleMetrics.ectomorphy && (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="ectomorphy"
                stroke="#6366f1"
                strokeWidth={3}
                dot={{ r: 4, strokeWidth: 0, fill: '#6366f1' }}
                activeDot={{ r: 6, strokeWidth: 0 }}
                animationDuration={1500}
                animationBegin={400}
              />
            )}
            {visibleMetrics.weight && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="weight"
                stroke="#f59e0b"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ r: 3, strokeWidth: 0, fill: '#f59e0b' }}
                activeDot={{ r: 5, strokeWidth: 0 }}
                animationDuration={1500}
                animationBegin={600}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ProgressChart;
