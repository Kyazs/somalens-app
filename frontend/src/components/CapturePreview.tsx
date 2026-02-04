import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCaptureStore } from '../stores/captureStore';
import { api } from '../services/api';

export const CapturePreview: React.FC = () => {
  const { 
    frontPreview, 
    sidePreview, 
    frontImage,
    sideImage,
    setStep,
    userData
  } = useCaptureStore();
  
  const navigate = useNavigate();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRetakeFront = () => {
    if (frontPreview) URL.revokeObjectURL(frontPreview);
    setStep('front');
  };

  const handleRetakeSide = () => {
    if (sidePreview) URL.revokeObjectURL(sidePreview);
    setStep('side');
  };

  const handleAnalyzeClick = async () => {
    if (!frontImage || !sideImage) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const result = await api.analyze(
        frontImage,
        sideImage,
        parseInt(userData.age) || 25,
        userData.gender,
        parseInt(userData.height),
        parseInt(userData.weight)
      );
      
      navigate('/results', { state: { result } });
    } catch (err) {
      console.error('Analysis failed:', err);
      setError(err instanceof Error ? err.message : 'Analysis failed. Please try again.');
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6 relative">
      <h2 className="text-3xl font-bold text-white mb-8 text-center">Review Your Captures</h2>
      
      {error && (
        <div className="max-w-2xl mx-auto mb-8 p-4 bg-red-900/30 border border-red-800 text-red-300 rounded-lg text-sm text-center">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
        {/* Front View Card */}
        <div className="bg-gray-800 rounded-2xl overflow-hidden shadow-xl border border-gray-700 flex flex-col">
          <div className="p-4 bg-gray-900/50 border-b border-gray-700 flex justify-between items-center">
            <h3 className="text-xl font-semibold text-white">Front View</h3>
            <button 
              onClick={handleRetakeFront}
              className="text-sm text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
            >
              Retake
            </button>
          </div>
          <div className="aspect-[3/4] bg-black relative group">
            {frontPreview ? (
              <img 
                src={frontPreview} 
                alt="Front Pose" 
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                No image captured
              </div>
            )}
          </div>
        </div>

        {/* Side View Card */}
        <div className="bg-gray-800 rounded-2xl overflow-hidden shadow-xl border border-gray-700 flex flex-col">
          <div className="p-4 bg-gray-900/50 border-b border-gray-700 flex justify-between items-center">
            <h3 className="text-xl font-semibold text-white">Side View</h3>
            <button 
              onClick={handleRetakeSide}
              className="text-sm text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
            >
              Retake
            </button>
          </div>
          <div className="aspect-[3/4] bg-black relative group">
            {sidePreview ? (
              <img 
                src={sidePreview} 
                alt="Side Pose" 
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                No image captured
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex justify-center gap-6">
        <button
          onClick={handleAnalyzeClick}
          disabled={!frontPreview || !sidePreview || isAnalyzing}
          className="bg-emerald-600 text-white px-10 py-4 rounded-xl font-bold text-lg shadow-lg shadow-emerald-900/20 hover:bg-emerald-500 hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-3"
        >
          {isAnalyzing && (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          )}
          {isAnalyzing ? 'Analyzing...' : 'Analyze Posture'}
        </button>
      </div>
    </div>
  );
};
