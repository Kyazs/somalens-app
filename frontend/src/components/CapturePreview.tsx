import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCaptureStore } from '../stores/captureStore';
import { api } from '../services/api';
import type { MeasurementResponse } from '../services/api';

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
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleRetakeFront = () => {
    if (frontPreview) URL.revokeObjectURL(frontPreview);
    setStep('front');
  };

  const handleRetakeSide = () => {
    if (sidePreview) URL.revokeObjectURL(sidePreview);
    setStep('side');
  };

  const convertMeasurementToResult = (measurement: MeasurementResponse) => {
    return {
      proxy_measurements: {
        height: measurement.height || 0,
        weight: measurement.weight || 0,
        chest: measurement.chest_circumference || 0,
        waist: measurement.waist_circumference || 0,
        hip: measurement.hip_circumference || 0,
        arm: measurement.arm_circumference || 0,
        thigh: measurement.thigh_circumference || 0,
        calf: measurement.calf_circumference || 0,
      },
      heath_carter_inputs: {
        triceps_skinfold: measurement.skinfold_triceps || 0,
        subscapular_skinfold: measurement.skinfold_subscapular || 0,
        supraspinale_skinfold: measurement.skinfold_supraspinale || 0,
        calf_skinfold: measurement.skinfold_calf || 0,
      },
      somatotype: {
        endomorphy: measurement.somatotype_endo || 0,
        mesomorphy: measurement.somatotype_meso || 0,
        ectomorphy: measurement.somatotype_ecto || 0,
        classification: measurement.somatotype_class || '',
        hwr: 0,
      }
    };
  };

  const handleAnalyzeClick = async () => {
    if (!frontImage || !sideImage) return;

    setIsAnalyzing(true);
    setError(null);
    setProcessingStatus('Uploading images...');

    try {
      const age = parseInt(userData.age) || 25;
      const height = parseInt(userData.height);
      const weight = parseInt(userData.weight);

      if (isNaN(height) || isNaN(weight)) {
        throw new Error("Missing height or weight data");
      }

      const submitResponse = await api.analyze(
        frontImage,
        sideImage,
        age,
        userData.gender,
        height,
        weight
      );
      
      const measurementId = (submitResponse as unknown as { id: number }).id;
      
      const completedMeasurement = await api.pollMeasurementUntilComplete(
        measurementId,
        (status) => setProcessingStatus(status)
      );
      
      const result = convertMeasurementToResult(completedMeasurement);
      navigate('/results', { state: { result } });
    } catch (err) {
      console.error('Analysis failed:', err);
      setError(err instanceof Error ? err.message : 'Analysis failed. Please try again.');
      setIsAnalyzing(false);
      setProcessingStatus('');
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6 relative">
      {isAnalyzing && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-gray-900 rounded-2xl p-10 max-w-md w-full mx-4 text-center border border-gray-700 shadow-2xl">
            <div className="w-20 h-20 mx-auto mb-6 relative">
              <div className="absolute inset-0 rounded-full border-4 border-emerald-500/30"></div>
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-emerald-500 animate-spin"></div>
              <div className="absolute inset-2 rounded-full border-4 border-transparent border-t-emerald-400 animate-spin" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }}></div>
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">Analyzing Your Body</h3>
            <p className="text-emerald-400 text-lg font-medium mb-2">{processingStatus}</p>
            <p className="text-gray-400 text-sm">This may take up to 30 seconds</p>
          </div>
        </div>
      )}

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
