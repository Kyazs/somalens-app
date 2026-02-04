import { useEffect, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import type { AnalysisResponse } from '../services/api';
import SomatotypeChart from '../components/SomatotypeChart';
import { useCaptureStore } from '../stores/captureStore';

export function ResultsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const result = location.state?.result as AnalysisResponse | undefined;
  const { reset } = useCaptureStore();
  
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (!result) {
      navigate('/capture', { replace: true });
    }
  }, [result, navigate]);

  if (!result) return null;

  const { somatotype, proxy_measurements } = result;

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await api.saveMeasurement({
        id: crypto.randomUUID(), 
        date: new Date().toISOString(),
        ...result
      });
      setSaveSuccess(true);
    } catch (err) {
      console.error('Failed to save:', err);
      setSaveError('Failed to save to history');
    } finally {
      setIsSaving(false);
    }
  };

  const mainMeasurements = [
    { label: 'Height', value: `${proxy_measurements.Stature?.toFixed(1)} cm` },

    { label: 'Weight', value: `${proxy_measurements.Weight?.toFixed(1)} kg` },
    { label: 'Body Fat %', value: `${proxy_measurements.Body_Fat_Percentage?.toFixed(1)}%` },
  ];

  const girths = [
    { label: 'Chest', value: `${proxy_measurements.Chest_Girth?.toFixed(1)} cm` },
    { label: 'Waist', value: `${proxy_measurements.Waist_Girth?.toFixed(1)} cm` },
    { label: 'Hip', value: `${proxy_measurements.Hip_Girth?.toFixed(1)} cm` },
    { label: 'Thigh', value: `${proxy_measurements.Thigh_Girth?.toFixed(1)} cm` },
    { label: 'Bicep', value: `${proxy_measurements.Arm_Circumference_Flexed?.toFixed(1) || 0} cm` },
    { label: 'Calf', value: `${proxy_measurements.Calf_Circumference?.toFixed(1) || 0} cm` },
  ];

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
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500"/>
                    Girths & Circumferences
                </h3>
                <div className="space-y-4">
                     {girths.map((m) => (
                        <div key={m.label} className="flex justify-between items-center border-b border-white/5 pb-2 last:border-0">
                            <span className="text-white/60">{m.label}</span>
                            <span className="text-lg font-medium tabular-nums text-white/90">{m.value}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 justify-center items-center pt-8">
             <button
              onClick={handleSave}
              disabled={isSaving || saveSuccess}
              className={`
                px-8 py-4 rounded-xl font-bold text-lg transition-all w-full md:w-auto
                ${saveSuccess 
                  ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/50 cursor-default' 
                  : 'bg-emerald-500 text-black hover:bg-emerald-400 hover:scale-105 shadow-[0_0_20px_rgba(16,185,129,0.3)]'}
                disabled:opacity-50 disabled:hover:scale-100
              `}
            >
              {isSaving ? 'Saving...' : saveSuccess ? 'Saved to History' : 'Save Results'}
            </button>

            <Link 
                to="/capture" 
                onClick={reset}
                className="group relative px-8 py-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-all w-full md:w-auto text-center"
            >
                Start New Scan
            </Link>
        </div>
        {saveError && (
            <p className="text-rose-400 text-center mt-2">{saveError}</p>
        )}

      </main>
    </div>
  );
}
