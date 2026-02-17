import React from 'react';

interface SomatotypeChartProps {
  endomorphy: number;
  mesomorphy: number;
  ectomorphy: number;
  className?: string;
}

const SomatotypeChart: React.FC<SomatotypeChartProps> = ({
  endomorphy,
  mesomorphy,
  ectomorphy,
  className = '',
}) => {
  // Max value for scaling (usually 9 is considered very high, but can go higher)
  const MAX_VALUE = 10;

  const getWidth = (value: number) => {
    return `${Math.min((value / MAX_VALUE) * 100, 100)}%`;
  };

  return (
    <div className={`w-full space-y-3 ${className}`}>
      {/* Endomorphy - Roundness/Fatness */}
      <div className="flex items-center text-sm">
        <div className="w-24 font-medium text-slate-700">Endomorphy</div>
        <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-rose-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: getWidth(endomorphy) }}
          />
        </div>
        <div className="w-12 text-right font-bold text-rose-600">
          {endomorphy.toFixed(1)}
        </div>
      </div>

      {/* Mesomorphy - Muscularity */}
      <div className="flex items-center text-sm">
        <div className="w-24 font-medium text-slate-700">Mesomorphy</div>
        <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-teal-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: getWidth(mesomorphy) }}
          />
        </div>
        <div className="w-12 text-right font-bold text-teal-600">
          {mesomorphy.toFixed(1)}
        </div>
      </div>

      {/* Ectomorphy - Linearity/Thinness */}
      <div className="flex items-center text-sm">
        <div className="w-24 font-medium text-slate-700">Ectomorphy</div>
        <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: getWidth(ectomorphy) }}
          />
        </div>
        <div className="w-12 text-right font-bold text-blue-600">
          {ectomorphy.toFixed(1)}
        </div>
      </div>
    </div>
  );
};

export default SomatotypeChart;
