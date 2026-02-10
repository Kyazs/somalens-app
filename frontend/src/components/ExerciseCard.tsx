import { useState } from 'react';
import type { ExerciseInfo } from '../services/api';

interface ExerciseCardProps {
  exercise: ExerciseInfo;
}

export function ExerciseCard({ exercise }: ExerciseCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
      <div className="aspect-square bg-slate-100">
        <img
          src={exercise.gifUrl}
          alt={exercise.name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
      <div className="p-4 space-y-2">
        <h4 className="font-bold text-slate-900 capitalize">{exercise.name}</h4>
        <div className="flex flex-wrap gap-1">
          {exercise.targetMuscles.map((muscle) => (
            <span
              key={muscle}
              className="text-xs px-2 py-0.5 bg-teal-50 text-teal-700 rounded-full"
            >
              {muscle}
            </span>
          ))}
        </div>
        <div className="text-xs text-slate-400">
          {exercise.equipments.join(', ')}
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-teal-600 hover:text-teal-700 transition-colors"
        >
          {expanded ? 'Hide Instructions ▲' : 'Show Instructions ▼'}
        </button>
        {expanded && (
          <div className="text-xs text-slate-600 space-y-1 pt-2 border-t border-slate-100">
            {exercise.instructions.map((step, i) => (
              <p key={i}>{step}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
