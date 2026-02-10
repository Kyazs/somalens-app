import React from 'react';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { ValidationResult } from '../types/pose';

interface PoseGuideProps {
  landmarks: NormalizedLandmark[] | null;
  validationResult: ValidationResult | null;
  poseType: 'front' | 'side' | 'unknown';
}

const PoseGuide: React.FC<PoseGuideProps> = ({
  landmarks,
  validationResult,
  poseType,
}) => {
  if (!landmarks || !validationResult) {
    return (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="bg-black/60 text-white px-8 py-6 rounded-2xl backdrop-blur-md border border-white/10 shadow-2xl text-center">
          <div className="w-12 h-12 border-4 border-white/20 border-t-white/80 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-xl font-bold tracking-tight">Looking for you...</p>
          <p className="text-sm text-white/60 mt-2 font-medium">Step into the frame</p>
        </div>
      </div>
    );
  }

  const { isValid, errors, warnings } = validationResult;

  return (
    <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between overflow-hidden">
      <div className="absolute inset-4 border-2 border-white/5 rounded-3xl pointer-events-none" />
      <div className="absolute top-4 left-4 w-16 h-16 border-t-4 border-l-4 border-white/40 rounded-tl-3xl" />
      <div className="absolute top-4 right-4 w-16 h-16 border-t-4 border-r-4 border-white/40 rounded-tr-3xl" />
      <div className="absolute bottom-4 left-4 w-16 h-16 border-b-4 border-l-4 border-white/40 rounded-bl-3xl" />
      <div className="absolute bottom-4 right-4 w-16 h-16 border-b-4 border-r-4 border-white/40 rounded-br-3xl" />

      <div className="flex justify-between items-start z-10">
        <div className={`
          px-5 py-3 rounded-xl backdrop-blur-xl border shadow-lg transition-all duration-300
          ${isValid 
            ? 'bg-teal-500/20 border-teal-500/30 text-teal-100' 
            : 'bg-rose-500/20 border-rose-500/30 text-rose-100'}
        `}>
          <div className="flex items-center gap-3">
            <div className={`
              w-3 h-3 rounded-full animate-pulse
              ${isValid ? 'bg-teal-400' : 'bg-rose-500'}
            `} />
            <h3 className="font-bold text-lg tracking-wide uppercase">
              {isValid ? 'Ready to Capture' : 'Adjustment Needed'}
            </h3>
          </div>
        </div>

        <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl px-4 py-2 text-white/90">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50 mb-1">
            Perspective
          </p>
          <p className="text-xl font-bold capitalize tracking-tight flex items-center gap-2">
            {poseType}
            <span className="text-xs bg-white/10 px-2 py-0.5 rounded text-white/70">VIEW</span>
          </p>
        </div>
      </div>

      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-lg text-center z-10 space-y-3">
        {errors.map((error, index) => (
          <div key={`err-${index}`} className="transition-all duration-300">
             <span className="inline-block bg-rose-600/90 text-white px-8 py-3 rounded-full font-bold shadow-lg backdrop-blur-sm border border-rose-400/30">
              {error}
            </span>
          </div>
        ))}
        
        {warnings.map((warning, index) => (
          <div key={`warn-${index}`} className="transition-all duration-300">
            <span className="inline-block bg-amber-500/90 text-white px-8 py-3 rounded-full font-bold shadow-lg backdrop-blur-sm border border-amber-400/30">
              {warning}
            </span>
          </div>
        ))}
      </div>

      <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 max-w-xs self-end text-white z-10 shadow-2xl">
        <h4 className="text-xs font-bold uppercase tracking-[0.15em] text-white/50 mb-4 border-b border-white/10 pb-2">
          Validation Checks
        </h4>
        <ul className="space-y-3">
          <StatusItem 
            label="Full Body Visible" 
            active={!errors.includes('Body not fully visible')} 
          />
          <StatusItem 
            label="Optimal Distance" 
            active={!errors.includes('Too close to camera') && !warnings.includes('Move closer to camera')} 
          />
          <StatusItem 
            label="Centered" 
            active={!warnings.includes('Move to center of frame')} 
          />
          {poseType === 'front' && (
             <StatusItem 
             label="Feet Shoulder-Width" 
             active={!warnings.includes('Stand with feet shoulder-width apart')} 
           />
          )}
          {poseType === 'side' && (
             <StatusItem 
             label="90° Profile View" 
             active={!warnings.includes('Turn 90 degrees to the side')} 
           />
          )}
        </ul>
      </div>
    </div>
  );
};

const StatusItem = ({ label, active }: { label: string; active: boolean }) => (
  <li className={`flex items-center gap-3 transition-colors duration-300 ${active ? 'text-white' : 'text-white/40'}`}>
    <div className={`
      w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border transition-all duration-300
      ${active 
        ? 'bg-teal-500 border-teal-400 text-white scale-110 shadow-[0_0_10px_rgba(13,148,136,0.4)]' 
        : 'bg-transparent border-white/20 text-transparent scale-100'}
    `}>
      ✓
    </div>
    <span className="font-medium tracking-tight text-sm">{label}</span>
  </li>
);

export default PoseGuide;
