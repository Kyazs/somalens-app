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
    const circ = measurement.circumferences || {};
    
    return {
      id: measurement.id,
      front_image_url: measurement.front_image_url,
      side_image_url: measurement.side_image_url,
      proxy_measurements: {
        Stature: measurement.height || circ.Stature || 0,
        Weight: measurement.weight || circ.Weight || 0,
        Body_Fat_Percentage: measurement.body_fat_percentage || circ.Body_Fat_Percentage || 0,
        Chest_Girth: circ.Chest_Circumference || circ.Chest_Girth || 0,
        Waist_Girth: circ.Waist_Circumference || circ.Waist_Girth || 0,
        Hip_Girth: circ.Hip_Circumference || circ.Hip_Girth || 0,
        Thigh_Girth: circ.Thigh_Circumference || circ.Thigh_Girth || 0,
        Arm_Circumference_Flexed: circ.Arm_Circumference_Flexed || 0,
        Calf_Circumference: circ.Calf_Circumference || 0,
        Triceps_Skinfold: circ.Triceps_Skinfold || 0,
        Subscapular_Skinfold: circ.Subscapular_Skinfold || 0,
        Supraspinale_Skinfold: circ.Supraspinale_Skinfold || 0,
        Calf_Skinfold: circ.Calf_Skinfold || 0,
        Humerus_Breadth: circ.Humerus_Breadth || 0,
        Femur_Breadth: circ.Femur_Breadth || 0,
      },
      heath_carter_inputs: {
        triceps_skinfold: circ.Triceps_Skinfold || 0,
        subscapular_skinfold: circ.Subscapular_Skinfold || 0,
        supraspinale_skinfold: circ.Supraspinale_Skinfold || 0,
        calf_skinfold: circ.Calf_Skinfold || 0,
      },
      somatotype: {
        endomorphy: measurement.somatotype_endo || 0,
        mesomorphy: measurement.somatotype_meso || 0,
        ectomorphy: measurement.somatotype_ecto || 0,
        classification: measurement.somatotype_class || '',
        hwr: circ.hwr || 0,
      },
      confidence_data: measurement.confidence_data || null,
    };
  };

  const handleAnalyzeClick = async () => {
    if (!frontImage || !sideImage) return;

    setIsAnalyzing(true);
    setError(null);
    setProcessingStatus('Uploading images...');

    try {
      const age = parseInt(userData.age) || 25;
      const height = userData.heightMode === 'predicted' ? 0 : parseFloat(userData.height);
      const weight = parseFloat(userData.weight);

      if (userData.heightMode === 'input' && (isNaN(height) || height <= 0)) {
        throw new Error("Missing height data");
      }
      if (isNaN(weight)) {
        throw new Error("Missing weight data");
      }

      const submitResponse = await api.analyze(
        frontImage,
        sideImage,
        age,
        userData.gender,
        height > 0 ? height : undefined,
        weight,
        userData.name || undefined,
        userData.medicalConditions
      );
      
      const measurementId = (submitResponse as unknown as { id: number }).id;
      
      const completedMeasurement = await api.pollMeasurementUntilComplete(
        measurementId,
        (status) => setProcessingStatus(status)
      );
      
      const result = convertMeasurementToResult(completedMeasurement);
      navigate('/results', { 
        state: { 
          result,
          measurementId: completedMeasurement.id,
          preferences: {
            goal: userData.goal,
            activityLevel: userData.activityLevel,
            exerciseComplexity: userData.exerciseComplexity,
            exerciseType: userData.exerciseType,
            medicalConditions: userData.medicalConditions,
          },
          userInfo: {
            name: userData.name || null,
            age: parseInt(userData.age) || null,
            gender: userData.gender,
          }
        } 
      });
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
          <div className="bg-white rounded-2xl p-10 max-w-md w-full mx-4 text-center border border-slate-200 shadow-2xl">
            <div className="w-20 h-20 mx-auto mb-6 relative">
              <div className="absolute inset-0 rounded-full border-4 border-teal-200"></div>
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-teal-600 animate-spin"></div>
              <div className="absolute inset-2 rounded-full border-4 border-transparent border-t-teal-400 animate-spin" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }}></div>
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-3">Analyzing Your Body</h3>
            <p className="text-teal-600 text-lg font-medium mb-2">{processingStatus}</p>
            <p className="text-slate-400 text-sm">This may take 2-5 minutes on first run</p>
          </div>
        </div>
      )}

      <h2 className="text-3xl font-bold text-slate-900 mb-8 text-center">Review Your Captures</h2>
      
      {error && (
        <div className="max-w-2xl mx-auto mb-8 p-4 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-sm text-center">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
        {/* Front View Card */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200 flex flex-col">
          <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
            <h3 className="text-xl font-semibold text-slate-900">Front View</h3>
            <button 
              onClick={handleRetakeFront}
              className="text-sm text-teal-600 hover:text-teal-700 font-medium transition-colors"
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
              <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                No image captured
              </div>
            )}
          </div>
        </div>

        {/* Side View Card */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200 flex flex-col">
          <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
            <h3 className="text-xl font-semibold text-slate-900">Side View</h3>
            <button 
              onClick={handleRetakeSide}
              className="text-sm text-teal-600 hover:text-teal-700 font-medium transition-colors"
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
              <div className="absolute inset-0 flex items-center justify-center text-slate-400">
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
          className="bg-teal-600 text-white px-10 py-4 rounded-xl font-bold text-lg shadow-sm hover:shadow-md hover:bg-teal-700 hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-3"
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
