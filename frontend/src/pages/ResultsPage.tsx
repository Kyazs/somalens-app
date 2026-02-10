import { useEffect, useState, useRef, useCallback } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { usePDF } from 'react-to-pdf';
import type { AnalysisResponse, RecommendationResponse, ExerciseInfo, FoodItem } from '../services/api';
import { api } from '../services/api';
import { ResultPdfTemplate } from '../components/ResultPdfTemplate';
import { useCaptureStore } from '../stores/captureStore';
import { SKINFOLD_KEYS, BREADTH_KEYS, GIRTH_KEYS } from '../types/pose';
import AppNavbar from '../components/AppNavbar';
import { ConfirmationModal } from '../components/ConfirmationModal';

interface LocationState {
  result: AnalysisResponse;
  measurementId?: number;
  preferences?: {
    goal: string;
    activityLevel: string;
    exerciseComplexity: string;
    exerciseType: string;
  };
  userInfo?: {
    name: string | null;
    age: number | null;
    gender: string | null;
  };
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export function ResultsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState | undefined;
  const result = state?.result;
  const measurementId = state?.measurementId;
  const preferences = state?.preferences;
  const userInfo = state?.userInfo;
  const { reset } = useCaptureStore();

  const [recommendation, setRecommendation] = useState<RecommendationResponse | null>(null);
  const [recLoading, setRecLoading] = useState(false);
  const [recError, setRecError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const { toPDF, targetRef } = usePDF({
    filename: 'somalens-analysis.pdf',
    page: { format: 'A4', orientation: 'portrait' },
    method: 'save',
  });

  // New state for interactive features
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<ExerciseInfo | null>(null);
  const [expandedStrategy, setExpandedStrategy] = useState<number | null>(0);
  const [expandedMeasurements, setExpandedMeasurements] = useState<{
    skinfolds: boolean;
    breadths: boolean;
    girths: boolean;
  }>({ skinfolds: false, breadths: false, girths: false });
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleExportPDF = useCallback(async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      await toPDF();
    } finally {
      setIsExporting(false);
    }
  }, [toPDF, isExporting]);

  const handleDelete = async () => {
    if (!measurementId) return;
    try {
      await api.deleteMeasurement(measurementId);
      navigate('/history');
    } catch (err) {
      console.error('Failed to delete scan:', err);
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (!result) {
      navigate('/capture', { replace: true });
    }
  }, [result, navigate]);

  useEffect(() => {
    if (measurementId && preferences) {
      setRecLoading(true);
      setRecError(null);
      api.getRecommendation(
        measurementId,
        preferences.goal,
        preferences.activityLevel,
        preferences.exerciseComplexity,
        preferences.exerciseType
      )
        .then(setRecommendation)
        .catch((err) => setRecError(err.message || 'Failed to load recommendations'))
        .finally(() => setRecLoading(false));
    }
  }, [measurementId, preferences]);

  // Close modals on Escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedFood(null);
        setSelectedExercise(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  if (!result) return null;

  const { somatotype, proxy_measurements, front_image_url, side_image_url } = result;

  const getImageUrl = (path: string | null | undefined) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return `${API_URL.replace('/api/v1', '')}${path}`;
  };

  const formatKey = (key: string) => {
    return key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();
  };

  const mainMeasurements = [
    { label: 'Height', value: `${proxy_measurements.Stature?.toFixed(1) || '-'} cm` },
    { label: 'Weight', value: `${proxy_measurements.Weight?.toFixed(1) || '-'} kg` },
    { label: 'Body Fat %', value: `${proxy_measurements.Body_Fat_Percentage?.toFixed(1) || '-'}%` },
  ];

  const formatPreferenceLabel = (key: string, value: string) => {
    const labels: Record<string, Record<string, string>> = {
      goal: {
        weight_loss: 'Weight Loss',
        weight_gain: 'Weight Gain',
        maintenance: 'Maintenance',
      },
      activityLevel: {
        sedentary: 'Sedentary',
        light: 'Light',
        moderate: 'Moderate',
        heavy: 'Heavy',
      },
      exerciseComplexity: {
        beginner: 'Beginner',
        intermediate: 'Intermediate',
        advanced: 'Advanced',
      },
      exerciseType: {
        gym: 'Gym',
        bodyweight: 'Bodyweight',
      },
    };
    return labels[key]?.[value] || value;
  };

  const frontImg = getImageUrl(front_image_url);
  const sideImg = getImageUrl(side_image_url);

  // Icons
  const ChevronDownIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
  );
  const ChevronUpIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
  );
  const XIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
  );

  return (
    <>
      <AppNavbar />
      <div className="min-h-screen bg-slate-50 p-6 pb-20">
        {/* PDF Template - always rendered offscreen for capture */}
        <div 
          ref={pdfContainerRef}
          style={{ 
            position: 'absolute', 
            left: '-9999px', 
            top: 0,
            width: '210mm',
            backgroundColor: '#fff',
          }}
        >
          <ResultPdfTemplate 
            ref={targetRef}
            userInfo={userInfo}
            preferences={preferences}
            somatotype={somatotype}
            measurements={proxy_measurements}
            recommendation={recommendation}
          />
        </div>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            {/* Export Button - Top Right */}
             <div className="flex justify-end gap-3">
                <Link 
                    to="/capture" 
                    onClick={reset}
                    className="px-4 py-2 cursor-pointer bg-teal-600 text-white hover:bg-teal-700 rounded-xl text-sm font-bold transition-colors shadow-sm"
                >
                    Start New Scan
                </Link>
                <button 
                    onClick={handleExportPDF}
                    disabled={isExporting}
                    className="px-4 py-2 cursor-pointer bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                    {isExporting ? 'Exporting...' : 'Export PDF'}
                </button>
                {measurementId && (
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    className="px-4 py-2 cursor-pointer bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl text-sm font-bold transition-colors shadow-sm"
                  >
                    Delete
                  </button>
                )}
            </div>

          {/* ROW 1: User Details + Somatotype Classification */}
          <div className="grid grid-cols-1 md:grid-cols-[45%_1fr] gap-6">
            {/* User Details */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold mb-4 text-slate-900">User Details</h3>
                {userInfo && (
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider">Name</p>
                      <p className="font-bold text-slate-900 truncate">{userInfo.name || 'Guest'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider">Age / Gender</p>
                      <p className="font-bold text-slate-900 capitalize">
                        {userInfo.age ? `${userInfo.age}y` : '-'} / {userInfo.gender || '-'}
                      </p>
                    </div>
                  </div>
                )}
                {preferences && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Goal</p>
                      <p className="font-bold text-teal-600 text-sm">{formatPreferenceLabel('goal', preferences.goal)}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Activity</p>
                      <p className="font-bold text-blue-600 text-sm">{formatPreferenceLabel('activityLevel', preferences.activityLevel)}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Level</p>
                      <p className="font-bold text-amber-500 text-sm">{formatPreferenceLabel('exerciseComplexity', preferences.exerciseComplexity)}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Type</p>
                      <p className="font-bold text-rose-600 text-sm">{formatPreferenceLabel('exerciseType', preferences.exerciseType)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Somatotype Classification */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col justify-center text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <svg width="120" height="120" viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              </div>
              <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight mb-2 uppercase">
                {somatotype.classification}
              </h2>
              <p className="text-2xl font-bold text-slate-400 mb-4 tracking-widest">
                {somatotype.endomorphy.toFixed(1)} - {somatotype.mesomorphy.toFixed(1)} - {somatotype.ectomorphy.toFixed(1)}
              </p>
              <p className="text-slate-600 text-sm max-w-md mx-auto mb-6 leading-relaxed">
                Your body composition analysis indicates a 
                <strong className="text-slate-900"> {somatotype.classification.toLowerCase()} </strong> 
                structure. This profile is characterized by the dominance of 
                {somatotype.endomorphy > somatotype.mesomorphy && somatotype.endomorphy > somatotype.ectomorphy && " adiposity (endomorphy)."}
                {somatotype.mesomorphy > somatotype.endomorphy && somatotype.mesomorphy > somatotype.ectomorphy && " muscularity (mesomorphy)."}
                {somatotype.ectomorphy > somatotype.endomorphy && somatotype.ectomorphy > somatotype.mesomorphy && " linearity (ectomorphy)."}
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                {mainMeasurements.map((m) => (
                  <span key={m.label} className="inline-flex items-center px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                    {m.label}: {m.value}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* ROW 2: Photos + Measurements */}
          <div className="grid grid-cols-1 md:grid-cols-[35%_1fr] gap-6">
            {/* Photos */}
            {(frontImg || sideImg) ? (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <h3 className="text-lg font-bold mb-4 text-slate-900">Photos</h3>
                <div className="grid grid-cols-2 gap-3">
                  {frontImg && (
                    <div className="space-y-1">
                      <img src={frontImg} alt="Front" className="w-full aspect-[3/4] object-cover rounded-lg border border-slate-200 bg-slate-50" />
                      <p className="text-[10px] text-center text-slate-400 uppercase tracking-wider">Front</p>
                    </div>
                  )}
                  {sideImg && (
                    <div className="space-y-1">
                      <img src={sideImg} alt="Side" className="w-full aspect-[3/4] object-cover rounded-lg border border-slate-200 bg-slate-50" />
                      <p className="text-[10px] text-center text-slate-400 uppercase tracking-wider">Side</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="hidden md:block"></div> // Placeholder if no photos, or could make measurements full width
            )}

            {/* Measurements (Compact) */}
            <div className={`bg-white rounded-2xl shadow-sm border border-slate-100 p-6 ${(frontImg || sideImg) ? '' : 'md:col-span-2'}`}>
              <h3 className="text-lg font-bold mb-4 text-slate-900">Measurements</h3>
              <div className="space-y-3">
                {/* Skinfolds */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <button 
                    onClick={() => setExpandedMeasurements(prev => ({ ...prev, skinfolds: !prev.skinfolds }))}
                    className="w-full flex items-center justify-between p-4 bg-rose-50 hover:bg-rose-100 transition-colors"
                  >
                    <span className="font-bold text-rose-700 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                      Skinfolds ({SKINFOLD_KEYS.length})
                    </span>
                    {expandedMeasurements.skinfolds ? <ChevronUpIcon /> : <ChevronDownIcon />}
                  </button>
                  {expandedMeasurements.skinfolds && (
                    <div className="p-4 bg-white grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {SKINFOLD_KEYS.map(key => (
                        <div key={key}>
                          <p className="text-xs text-slate-400">{formatKey(key)}</p>
                          <p className="font-bold text-slate-900">{proxy_measurements[key]?.toFixed(1) || '-'} mm</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Breadths */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <button 
                    onClick={() => setExpandedMeasurements(prev => ({ ...prev, breadths: !prev.breadths }))}
                    className="w-full flex items-center justify-between p-4 bg-blue-50 hover:bg-blue-100 transition-colors"
                  >
                    <span className="font-bold text-blue-700 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      Breadths ({BREADTH_KEYS.length})
                    </span>
                    {expandedMeasurements.breadths ? <ChevronUpIcon /> : <ChevronDownIcon />}
                  </button>
                  {expandedMeasurements.breadths && (
                    <div className="p-4 bg-white grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {BREADTH_KEYS.map(key => (
                        <div key={key}>
                          <p className="text-xs text-slate-400">{formatKey(key)}</p>
                          <p className="font-bold text-slate-900">{proxy_measurements[key]?.toFixed(1) || '-'} cm</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Girths */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <button 
                    onClick={() => setExpandedMeasurements(prev => ({ ...prev, girths: !prev.girths }))}
                    className="w-full flex items-center justify-between p-4 bg-purple-50 hover:bg-purple-100 transition-colors"
                  >
                    <span className="font-bold text-purple-700 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                      Girths ({GIRTH_KEYS.length})
                    </span>
                    {expandedMeasurements.girths ? <ChevronUpIcon /> : <ChevronDownIcon />}
                  </button>
                  {expandedMeasurements.girths && (
                    <div className="p-4 bg-white grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {GIRTH_KEYS.map(key => (
                        <div key={key}>
                          <p className="text-xs text-slate-400">{formatKey(key)}</p>
                          <p className="font-bold text-slate-900">{proxy_measurements[key]?.toFixed(1) || '-'} cm</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Loading / Error States */}
          {recLoading && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
              <div className="w-12 h-12 mx-auto mb-4 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
              <p className="text-slate-500 font-medium">Generating personalized plan...</p>
            </div>
          )}

          {recError && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-8 text-center">
              <p className="text-rose-600 font-bold">{recError}</p>
            </div>
          )}

          {/* Recommendations Content */}
          {recommendation && !recommendation.message && (
            <>
              {/* ROW 3: Daily Energy & Macros + Diet Principles */}
              <div className="grid grid-cols-1 md:grid-cols-[45%_1fr] gap-6">
                {/* Daily Energy & Macros */}
                <div className="bg-teal-50 border border-teal-200 rounded-2xl p-6 flex flex-col justify-center">
                  <div className="text-center mb-8">
                    <p className="text-5xl font-black text-slate-900 tracking-tight">{recommendation.ter?.toLocaleString()}</p>
                    <p className="text-sm font-bold text-teal-700 uppercase tracking-wider mt-1">kcal / day</p>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="h-2 bg-rose-200 rounded-full mb-2 overflow-hidden">
                        <div className="h-full bg-rose-500" style={{ width: `${recommendation.macros?.protein_pct}%` }}></div>
                      </div>
                      <p className="text-2xl font-bold text-rose-600">{recommendation.macros?.protein_pct}%</p>
                      <p className="text-xs text-slate-500 font-medium">{recommendation.macros?.protein_g}g Protein</p>
                    </div>
                    <div className="text-center">
                      <div className="h-2 bg-amber-200 rounded-full mb-2 overflow-hidden">
                        <div className="h-full bg-amber-500" style={{ width: `${recommendation.macros?.carbs_pct}%` }}></div>
                      </div>
                      <p className="text-2xl font-bold text-amber-500">{recommendation.macros?.carbs_pct}%</p>
                      <p className="text-xs text-slate-500 font-medium">{recommendation.macros?.carbs_g}g Carbs</p>
                    </div>
                    <div className="text-center">
                      <div className="h-2 bg-blue-200 rounded-full mb-2 overflow-hidden">
                        <div className="h-full bg-blue-500" style={{ width: `${recommendation.macros?.fats_pct}%` }}></div>
                      </div>
                      <p className="text-2xl font-bold text-blue-600">{recommendation.macros?.fats_pct}%</p>
                      <p className="text-xs text-slate-500 font-medium">{recommendation.macros?.fats_g}g Fats</p>
                    </div>
                  </div>
                </div>

                {/* Diet Principles */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                  <h3 className="text-lg font-bold mb-4 text-slate-900">Diet Principles</h3>
                  <div className="flex flex-wrap gap-3">
                    {recommendation.diet_principles?.split('|').map((item, i) => (
                      <div key={i} className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex-1 min-w-[200px]">
                        <p className="text-slate-700 text-sm font-medium leading-relaxed">
                          {item.trim()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ROW 4: Foods (Full Width) */}
              {recommendation.meals && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                  <h3 className="text-lg font-bold mb-6 text-slate-900">Recommended Foods</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {Object.entries(recommendation.meals).map(([meal, foods]) => (
                      <div key={meal} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                        <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">{meal}</h4>
                        <div className="flex flex-wrap gap-2">
                          {foods.map((food: FoodItem, i: number) => (
                            <button
                              key={i}
                              onClick={() => setSelectedFood(food)}
                              className="bg-white border border-slate-200 rounded-lg px-3 py-2 cursor-pointer hover:bg-teal-50 hover:border-teal-200 hover:shadow-sm transition-all text-left group"
                            >
                              <span className="block text-sm font-bold text-slate-700 group-hover:text-teal-700">{food.name}</span>
                              <span className="block text-[10px] text-slate-400">{food.calories_kcal.toFixed(0)} kcal</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ROW 5: Interactive Fitness Strategy */}
              {recommendation.fitness_strategy && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                  <h3 className="text-lg font-bold mb-6 text-slate-900">Fitness Strategy</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {recommendation.fitness_strategy.split('|').map((item, i) => {
                      const isExpanded = expandedStrategy === i;
                      return (
                        <div 
                          key={i}
                          onClick={() => setExpandedStrategy(isExpanded ? null : i)}
                          className={`border rounded-xl p-4 cursor-pointer transition-all ${
                            isExpanded 
                              ? 'bg-slate-50 border-teal-200 shadow-sm' 
                              : 'bg-white border-slate-200 hover:border-teal-200 hover:shadow-sm'
                          }`}
                        >
                          <div className="flex items-start gap-4">
                            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                              isExpanded ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {i + 1}
                            </div>
                            <div className="flex-1">
                              <h4 className={`font-bold text-sm mb-1 ${isExpanded ? 'text-teal-900' : 'text-slate-700'}`}>
                                Strategy Point {i + 1}
                              </h4>
                              <p className={`text-sm leading-relaxed ${isExpanded ? 'text-slate-700' : 'text-slate-500 line-clamp-1'}`}>
                                {item.trim()}
                              </p>
                            </div>
                            <div className="text-slate-400">
                              {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ROW 6: Exercises */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <h3 className="text-lg font-bold mb-6 text-slate-900">Exercise Plan</h3>
                
                {/* PPL Structure */}
                {recommendation.exercises_ppl ? (
                  <div className="space-y-8">
                    {recommendation.exercises_ppl.push.length > 0 && (
                      <div>
                        <h4 className="text-sm font-bold text-rose-600 uppercase tracking-wider mb-4 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-rose-600"></span> Push Day
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {recommendation.exercises_ppl.push.map((ex) => (
                            <ExerciseThumbnail key={ex.exerciseId} exercise={ex} onClick={() => setSelectedExercise(ex)} />
                          ))}
                        </div>
                      </div>
                    )}
                    {recommendation.exercises_ppl.pull.length > 0 && (
                      <div>
                        <h4 className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-4 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-600"></span> Pull Day
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {recommendation.exercises_ppl.pull.map((ex) => (
                            <ExerciseThumbnail key={ex.exerciseId} exercise={ex} onClick={() => setSelectedExercise(ex)} />
                          ))}
                        </div>
                      </div>
                    )}
                    {recommendation.exercises_ppl.legs.length > 0 && (
                      <div>
                        <h4 className="text-sm font-bold text-teal-600 uppercase tracking-wider mb-4 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-teal-600"></span> Legs Day
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {recommendation.exercises_ppl.legs.map((ex) => (
                            <ExerciseThumbnail key={ex.exerciseId} exercise={ex} onClick={() => setSelectedExercise(ex)} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  // Fallback for flat exercise list
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {recommendation.exercises?.map((ex) => (
                      <ExerciseThumbnail key={ex.exerciseId} exercise={ex} onClick={() => setSelectedExercise(ex)} />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ROW 7: No Matching Template Message */}
          {recommendation?.message && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
              <h3 className="text-xl font-bold text-amber-700 mb-2">No Matching Template</h3>
              <p className="text-slate-600 mb-4">{recommendation.message}</p>
              {recommendation.suggestion && (
                <p className="text-sm text-slate-400">{recommendation.suggestion}</p>
              )}
            </div>
          )}
        </main>

        {/* MODALS */}
        {selectedFood && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedFood(null)}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="inline-block px-2 py-1 rounded-md bg-teal-50 text-teal-700 text-xs font-bold uppercase tracking-wider mb-2">
                    {selectedFood.category}
                  </span>
                  <h3 className="text-2xl font-bold text-slate-900">{selectedFood.name}</h3>
                </div>
                <button onClick={() => setSelectedFood(null)} className="p-1 hover:bg-slate-100 rounded-full transition-colors">
                  <XIcon />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-50 p-3 rounded-xl text-center">
                  <p className="text-3xl font-black text-slate-900">{selectedFood.calories_kcal.toFixed(0)}</p>
                  <p className="text-xs text-slate-500 uppercase font-bold">Calories</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-rose-50 p-2 rounded-lg text-center">
                    <p className="font-bold text-rose-700">{selectedFood.protein_g}g</p>
                    <p className="text-[10px] text-rose-400 uppercase">Protein</p>
                  </div>
                  <div className="bg-amber-50 p-2 rounded-lg text-center">
                    <p className="font-bold text-amber-700">{selectedFood.carbohydrates_g}g</p>
                    <p className="text-[10px] text-amber-400 uppercase">Carbs</p>
                  </div>
                  <div className="bg-blue-50 p-2 rounded-lg text-center">
                    <p className="font-bold text-blue-700">{selectedFood.fat_g}g</p>
                    <p className="text-[10px] text-blue-400 uppercase">Fat</p>
                  </div>
                  <div className="bg-green-50 p-2 rounded-lg text-center">
                    <p className="font-bold text-green-700">{selectedFood.fiber_g}g</p>
                    <p className="text-[10px] text-green-400 uppercase">Fiber</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500 text-sm">Sugar</span>
                  <span className="font-bold text-slate-900">{selectedFood.sugars_g}g</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500 text-sm">Sodium</span>
                  <span className="font-bold text-slate-900">{selectedFood.sodium_mg}mg</span>
                </div>
                {selectedFood.portion_recommendation && (
                  <div className="bg-slate-50 p-3 rounded-xl mt-4">
                    <p className="text-xs text-slate-400 uppercase font-bold mb-1">Portion</p>
                    <p className="text-slate-700 text-sm">{selectedFood.portion_recommendation}</p>
                  </div>
                )}
                {selectedFood.meal_timing && (
                  <div className="bg-slate-50 p-3 rounded-xl">
                    <p className="text-xs text-slate-400 uppercase font-bold mb-1">Timing</p>
                    <p className="text-slate-700 text-sm">{selectedFood.meal_timing}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {selectedExercise && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedExercise(null)}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-0 animate-in fade-in zoom-in duration-200 flex flex-col md:flex-row overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="w-full md:w-1/2 bg-slate-100 flex items-center justify-center p-4">
                <img src={selectedExercise.gifUrl} alt={selectedExercise.name} className="w-full h-auto rounded-xl mix-blend-multiply" />
              </div>
              <div className="w-full md:w-1/2 p-6 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-bold text-slate-900">{selectedExercise.name}</h3>
                  <button onClick={() => setSelectedExercise(null)} className="p-1 hover:bg-slate-100 rounded-full transition-colors">
                    <XIcon />
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 mb-6">
                  {selectedExercise.targetMuscles.map(m => (
                    <span key={m} className="px-2 py-1 bg-teal-50 text-teal-700 text-xs font-bold rounded-md uppercase">
                      {m}
                    </span>
                  ))}
                  {selectedExercise.equipments.map(e => (
                    <span key={e} className="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-md uppercase">
                      {e}
                    </span>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto pr-2">
                  <h4 className="text-sm font-bold text-slate-900 mb-3">Instructions</h4>
                  <ol className="space-y-3">
                    {selectedExercise.instructions.map((step, i) => (
                      <li key={i} className="flex gap-3 text-sm text-slate-600">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-bold mt-0.5">
                          {i + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
      
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Delete Scan"
        message="Are you sure you want to delete this scan? This action cannot be undone."
        confirmLabel="Delete Scan"
        isDangerous={true}
      />
    </>
  );
}

// Helper component for Exercise Grid Items
function ExerciseThumbnail({ exercise, onClick }: { exercise: ExerciseInfo; onClick: () => void }) {
  return (
    <div 
      onClick={onClick}
      className="group bg-white border border-slate-200 rounded-xl p-3 cursor-pointer hover:border-teal-400 hover:shadow-md transition-all flex items-center gap-4"
    >
      <div className="w-16 h-16 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0">
        <img src={exercise.gifUrl} alt={exercise.name} className="w-full h-full object-cover mix-blend-multiply" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-slate-900 text-sm truncate group-hover:text-teal-700 transition-colors">{exercise.name}</h4>
        <div className="flex flex-wrap gap-1 mt-1">
          {exercise.targetMuscles.slice(0, 2).map(m => (
            <span key={m} className="text-[10px] px-1.5 py-0.5 bg-slate-50 text-slate-500 rounded border border-slate-100 truncate">
              {m}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
