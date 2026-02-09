import { useState } from 'react';
import type { ExerciseInfo } from '../services/api';

interface ExerciseCardProps {
  exercise: ExerciseInfo;
}

export function ExerciseCard({ exercise }: ExerciseCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
      <div className="aspect-square bg-black/20">
        <img
          src={exercise.gifUrl}
          alt={exercise.name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
      <div className="p-4 space-y-2">
        <h4 className="font-bold text-white capitalize">{exercise.name}</h4>
        <div className="flex flex-wrap gap-1">
          {exercise.targetMuscles.map((muscle) => (
            <span
              key={muscle}
              className="text-xs px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full"
            >
              {muscle}
            </span>
          ))}
        </div>
        <div className="text-xs text-white/50">
          {exercise.equipments.join(', ')}
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          {expanded ? 'Hide Instructions ▲' : 'Show Instructions ▼'}
        </button>
        {expanded && (
          <div className="text-xs text-white/70 space-y-1 pt-2 border-t border-white/10">
            {exercise.instructions.map((step, i) => (
              <p key={i}>{step}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
