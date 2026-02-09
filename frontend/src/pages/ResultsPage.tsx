import { useEffect, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import type { AnalysisResponse, RecommendationResponse, ExerciseInfo, FoodItem } from '../services/api';
import { api } from '../services/api';
import SomatotypeChart from '../components/SomatotypeChart';
import { ExerciseCard } from '../components/ExerciseCard';
import { useCaptureStore } from '../stores/captureStore';
import { SKINFOLD_KEYS, BREADTH_KEYS, GIRTH_KEYS } from '../types/pose';

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

  return (
    <div className="min-h-screen bg-black text-white p-6 pb-20">
       <header className="fixed top-0 left-0 right-0 bg-black/80 backdrop-blur-md z-50 border-b border-white/10">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <div className="w-3 h-3 bg-emerald-500 rounded-full" />
            SomaLens
          </Link>
          <div className="text-xs font-bold uppercase tracking-widest text-white/50">
            Analysis Report
          </div>
        </div>
      </header>

      <main className="container mx-auto pt-20 max-w-4xl space-y-12">
        {/* User Details & Analysis Preferences */}
        {(preferences || userInfo) && (
          <div className="bg-gradient-to-br from-white/10 to-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-sm">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-500"/>
              Analysis Settings
            </h3>
            
            {/* User Info Row */}
            {userInfo && (
              <div className="mb-4 pb-4 border-b border-white/10">
                <div className="flex flex-wrap gap-4 justify-center">
                  {userInfo.name && userInfo.name !== 'Untitled Measurement' && (
                    <div className="bg-black/30 rounded-xl px-4 py-2 flex items-center gap-2">
                      <span className="text-white/50 text-sm">Name:</span>
                      <span className="font-bold text-white">{userInfo.name}</span>
                    </div>
                  )}
                  {userInfo.age && (
                    <div className="bg-black/30 rounded-xl px-4 py-2 flex items-center gap-2">
                      <span className="text-white/50 text-sm">Age:</span>
                      <span className="font-bold text-white">{userInfo.age} years</span>
                    </div>
                  )}
                  {userInfo.gender && (
                    <div className="bg-black/30 rounded-xl px-4 py-2 flex items-center gap-2">
                      <span className="text-white/50 text-sm">Gender:</span>
                      <span className="font-bold text-white capitalize">{userInfo.gender}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Preferences Grid */}
            {preferences && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-black/20 rounded-xl p-4">
                  <p className="text-xs text-white/50 uppercase tracking-wider mb-1">Goal</p>
                  <p className="text-lg font-bold text-emerald-400">
                    {formatPreferenceLabel('goal', preferences.goal)}
                  </p>
                </div>
                <div className="bg-black/20 rounded-xl p-4">
                  <p className="text-xs text-white/50 uppercase tracking-wider mb-1">Activity Level</p>
                  <p className="text-lg font-bold text-blue-400">
                    {formatPreferenceLabel('activityLevel', preferences.activityLevel)}
                  </p>
                </div>
                <div className="bg-black/20 rounded-xl p-4">
                  <p className="text-xs text-white/50 uppercase tracking-wider mb-1">Exercise Level</p>
                  <p className="text-lg font-bold text-amber-400">
                    {formatPreferenceLabel('exerciseComplexity', preferences.exerciseComplexity)}
                  </p>
                </div>
                <div className="bg-black/20 rounded-xl p-4">
                  <p className="text-xs text-white/50 uppercase tracking-wider mb-1">Exercise Type</p>
                  <p className="text-lg font-bold text-rose-400">
                    {formatPreferenceLabel('exerciseType', preferences.exerciseType)}
                  </p>
                </div>
              </div>
            )}
            
            {/* User Metrics Summary */}
            <div className="mt-4 pt-4 border-t border-white/10">
              <div className="flex flex-wrap gap-6 justify-center text-sm">
                {proxy_measurements.Stature && (
                  <div className="flex items-center gap-2">
                    <span className="text-white/50">Height:</span>
                    <span className="font-bold text-white">{proxy_measurements.Stature.toFixed(1)} cm</span>
                  </div>
                )}
                {proxy_measurements.Weight && (
                  <div className="flex items-center gap-2">
                    <span className="text-white/50">Weight:</span>
                    <span className="font-bold text-white">{proxy_measurements.Weight.toFixed(1)} kg</span>
                  </div>
                )}
                {proxy_measurements.Body_Fat_Percentage && (
                  <div className="flex items-center gap-2">
                    <span className="text-white/50">Body Fat:</span>
                    <span className="font-bold text-white">{proxy_measurements.Body_Fat_Percentage.toFixed(1)}%</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6 text-center">
            <div className="inline-block px-4 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-sm font-bold tracking-wider uppercase mb-4">
                {somatotype.classification}
            </div>
            
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-white/40">
                {somatotype.endomorphy.toFixed(1)} - {somatotype.mesomorphy.toFixed(1)} - {somatotype.ectomorphy.toFixed(1)}
            </h1>
            
            <p className="text-white/60 max-w-lg mx-auto leading-relaxed">
                Your body composition analysis indicates a 
                <strong className="text-white"> {somatotype.classification.toLowerCase()} </strong> 
                structure. This profile is characterized by the dominance of 
                {somatotype.endomorphy > somatotype.mesomorphy && somatotype.endomorphy > somatotype.ectomorphy && " adiposity (endomorphy)."}
                {somatotype.mesomorphy > somatotype.endomorphy && somatotype.mesomorphy > somatotype.ectomorphy && " muscularity (mesomorphy)."}
                {somatotype.ectomorphy > somatotype.endomorphy && somatotype.ectomorphy > somatotype.mesomorphy && " linearity (ectomorphy)."}
            </p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-sm">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"/>
                Somatotype Profile
            </h3>
            <SomatotypeChart 
                endomorphy={somatotype.endomorphy}
                mesomorphy={somatotype.mesomorphy}
                ectomorphy={somatotype.ectomorphy}
                className="max-w-xl mx-auto"
            />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(frontImg || sideImg) && (
              <div className="bg-white/5 border border-white/10 rounded-3xl p-8 md:col-span-2">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"/>
                  Your Photos
                </h3>
                <div className="grid grid-cols-2 gap-6 max-w-md mx-auto">
                  {frontImg && (
                    <div className="space-y-2">
                      <span className="text-xs text-white/50 uppercase tracking-wider">Front View</span>
                      <img
                        src={frontImg}
                        alt="Front view"
                        className="w-full aspect-[3/4] object-cover rounded-xl border border-white/10"
                      />
                    </div>
                  )}
                  {sideImg && (
                    <div className="space-y-2">
                      <span className="text-xs text-white/50 uppercase tracking-wider">Side View</span>
                      <img
                        src={sideImg}
                        alt="Side view"
                        className="w-full aspect-[3/4] object-cover rounded-xl border border-white/10"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"/>
                    Key Metrics
                </h3>
                <div className="space-y-4">
                    {mainMeasurements.map((m) => (
                        <div key={m.label} className="flex justify-between items-center border-b border-white/5 pb-2 last:border-0">
                            <span className="text-white/60">{m.label}</span>
                            <span className="text-xl font-bold tabular-nums">{m.value}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
                <h3 className="text-xl font-bold mb-6 fcdlex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500"/>
                    Skinfolds (mm)
                </h3>
                <div className="space-y-4">
                    {SKINFOLD_KEYS.map((key) => {
                        const value = proxy_measurements[key];
                        return (
                          <div key={key} className="flex justify-between items-center border-b border-white/5 pb-2 last:border-0">
                            <span className="text-white/60">{formatKey(key)}</span>
                            <span className="text-lg font-medium tabular-nums text-white/90">
                              {value !== undefined ? value.toFixed(1) : '-'}
                            </span>
                          </div>
                        );
                    })}
                </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"/>
                    Breadths (cm)
                </h3>
                <div className="space-y-4">
                    {BREADTH_KEYS.map((key) => {
                        const value = proxy_measurements[key];
                        return (
                          <div key={key} className="flex justify-between items-center border-b border-white/5 pb-2 last:border-0">
                            <span className="text-white/60">{formatKey(key)}</span>
                            <span className="text-lg font-medium tabular-nums text-white/90">
                              {value !== undefined ? value.toFixed(1) : '-'}
                            </span>
                          </div>
                        );
                    })}
                </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500"/>
                    Girths (cm)
                </h3>
                <div className="space-y-4">
                    {GIRTH_KEYS.map((key) => {
                        const value = proxy_measurements[key];
                        return (
                          <div key={key} className="flex justify-between items-center border-b border-white/5 pb-2 last:border-0">
                            <span className="text-white/60">{formatKey(key)}</span>
                            <span className="text-lg font-medium tabular-nums text-white/90">
                              {value !== undefined ? value.toFixed(1) : '-'}
                            </span>
                          </div>
                        );
                    })}
                </div>
            </div>
        </div>

        {recLoading && (
          <div className="bg-white/5 border border-white/10 rounded-3xl p-8 text-center">
            <div className="w-10 h-10 mx-auto mb-4 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            <p className="text-white/60">Loading personalized recommendations...</p>
          </div>
        )}

        {recError && (
          <div className="bg-red-900/20 border border-red-800/50 rounded-3xl p-8 text-center">
            <p className="text-red-400">{recError}</p>
          </div>
        )}

        {recommendation && !recommendation.message && (
          <>
            <div className="bg-gradient-to-br from-emerald-900/30 to-emerald-800/10 border border-emerald-500/20 rounded-3xl p-8">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"/>
                Daily Energy & Macros
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-black/20 rounded-xl p-4 text-center">
                  <p className="text-3xl font-black text-white">{recommendation.ter?.toLocaleString()}</p>
                  <p className="text-sm text-white/50">kcal/day</p>
                </div>
                <div className="bg-black/20 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-rose-400">{recommendation.macros?.protein_g}g</p>
                  <p className="text-sm text-white/50">Protein ({recommendation.macros?.protein_pct}%)</p>
                </div>
                <div className="bg-black/20 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-amber-400">{recommendation.macros?.carbs_g}g</p>
                  <p className="text-sm text-white/50">Carbs ({recommendation.macros?.carbs_pct}%)</p>
                </div>
                <div className="bg-black/20 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-blue-400">{recommendation.macros?.fats_g}g</p>
                  <p className="text-sm text-white/50">Fats ({recommendation.macros?.fats_pct}%)</p>
                </div>
              </div>
            </div>

            {recommendation.diet_principles && (
              <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"/>
                  Diet Strategy
                </h3>
                <ul className="space-y-2">
                  {recommendation.diet_principles.split('|').map((item: string, i: number) => (
                    <li key={i} className="text-white/70 flex items-start gap-2">
                      <span className="text-amber-400 mt-0.5">•</span>
                      {item.trim()}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {recommendation.meals && (
              <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500"/>
                  Meal Recommendations
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {Object.entries(recommendation.meals).map(([meal, foods]) => (
                    <div key={meal} className="space-y-3">
                      <h4 className="text-lg font-semibold text-white capitalize">{meal}</h4>
                      <div className="space-y-2">
                        {foods.map((food: FoodItem, i: number) => (
                          <div key={i} className="bg-white/5 rounded-lg p-3 border border-white/10">
                            <div className="flex items-start gap-2 mb-2">
                              <span className="text-emerald-400 mt-0.5">•</span>
                              <span className="text-white font-medium">{food.name}</span>
                            </div>
                            <div className="grid grid-cols-4 gap-1 text-xs ml-4">
                              <div className="text-center">
                                <span className="text-amber-400 font-bold">{food.calories_kcal.toFixed(0)}</span>
                                <span className="text-white/40 block">kcal</span>
                              </div>
                              <div className="text-center">
                                <span className="text-rose-400 font-bold">{food.protein_g.toFixed(1)}g</span>
                                <span className="text-white/40 block">Protein</span>
                              </div>
                              <div className="text-center">
                                <span className="text-blue-400 font-bold">{food.carbohydrates_g.toFixed(1)}g</span>
                                <span className="text-white/40 block">Carbs</span>
                              </div>
                              <div className="text-center">
                                <span className="text-purple-400 font-bold">{food.fat_g.toFixed(1)}g</span>
                                <span className="text-white/40 block">Fat</span>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-1 text-xs ml-4 mt-1">
                              <div className="text-center">
                                <span className="text-green-400 font-bold">{food.fiber_g.toFixed(1)}g</span>
                                <span className="text-white/40 block">Fiber</span>
                              </div>
                              <div className="text-center">
                                <span className="text-pink-400 font-bold">{food.sugars_g.toFixed(1)}g</span>
                                <span className="text-white/40 block">Sugar</span>
                              </div>
                              <div className="text-center">
                                <span className="text-cyan-400 font-bold">{food.sodium_mg.toFixed(0)}mg</span>
                                <span className="text-white/40 block">Sodium</span>
                              </div>
                            </div>
                            {food.portion_recommendation && (
                              <div className="text-xs text-white/40 mt-2 ml-4">
                                Portion: {food.portion_recommendation}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {recommendation.fitness_strategy && (
              <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"/>
                  Fitness Strategy
                </h3>
                <ul className="space-y-2">
                  {recommendation.fitness_strategy.split('|').map((item: string, i: number) => (
                    <li key={i} className="text-white/70 flex items-start gap-2">
                      <span className="text-cyan-400 mt-0.5">•</span>
                      {item.trim()}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {recommendation.exercises_ppl && (
              <div className="space-y-8">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500"/>
                  Recommended Exercises (Push/Pull/Legs)
                </h3>
                
                {recommendation.exercises_ppl.push.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold text-rose-400 flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-rose-400"/>
                      Push Day
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {recommendation.exercises_ppl.push.map((exercise: ExerciseInfo) => (
                        <ExerciseCard key={exercise.exerciseId} exercise={exercise} />
                      ))}
                    </div>
                  </div>
                )}

                {recommendation.exercises_ppl.pull.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold text-blue-400 flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-blue-400"/>
                      Pull Day
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {recommendation.exercises_ppl.pull.map((exercise: ExerciseInfo) => (
                        <ExerciseCard key={exercise.exerciseId} exercise={exercise} />
                      ))}
                    </div>
                  </div>
                )}

                {recommendation.exercises_ppl.legs.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold text-emerald-400 flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-emerald-400"/>
                      Legs Day
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {recommendation.exercises_ppl.legs.map((exercise: ExerciseInfo) => (
                        <ExerciseCard key={exercise.exerciseId} exercise={exercise} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {recommendation.exercises && recommendation.exercises.length > 0 && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500"/>
                  Recommended Exercises
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {recommendation.exercises.map((exercise: ExerciseInfo) => (
                    <ExerciseCard key={exercise.exerciseId} exercise={exercise} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {recommendation?.message && (
          <div className="bg-amber-900/20 border border-amber-700/50 rounded-3xl p-8 text-center">
            <h3 className="text-xl font-bold text-amber-400 mb-2">No Matching Template</h3>
            <p className="text-white/60 mb-4">{recommendation.message}</p>
            {recommendation.suggestion && (
              <p className="text-sm text-white/50">{recommendation.suggestion}</p>
            )}
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-4 justify-center items-center pt-8">
            <Link 
                to="/capture" 
                onClick={reset}
                className="group relative px-8 py-4 bg-emerald-500 text-black hover:bg-emerald-400 hover:scale-105 shadow-[0_0_20px_rgba(16,185,129,0.3)] font-bold rounded-xl transition-all w-full md:w-auto text-center"
            >
                Start New Scan
            </Link>
            <Link 
                to="/history" 
                className="group relative px-8 py-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-all w-full md:w-auto text-center"
            >
                View History
            </Link>
        </div>

      </main>
    </div>
  );
}
