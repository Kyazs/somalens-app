import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import type { AnalysisResponse } from '../services/api';
import type { MeasurementSession } from '../types/pose';
import { SKINFOLD_KEYS, BREADTH_KEYS, GIRTH_KEYS, ADDITIONAL_GIRTH_KEYS } from '../types/pose';
import ProgressChart from '../components/ProgressChart';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export function HistoryPage() {
  const navigate = useNavigate();
  const [history, setHistory] = useState<MeasurementSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<MeasurementSession | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await api.getHistory();
        setHistory(data);
      } catch (err) {
        console.error('Failed to fetch history:', err);
        setError('Failed to load measurement history.');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  const handleViewDetails = (session: MeasurementSession) => {
    if (!session.somatotype_class) return;

    const circumferences = session.circumferences || {};
    
    const proxy_measurements: Record<string, number> = {
      ...circumferences,
      Stature: session.height || 0,
      Weight: session.weight || 0,
      Body_Fat_Percentage: session.body_fat_percentage || 0,
    };

    const result: AnalysisResponse = {
      id: session.id,
      proxy_measurements,
      heath_carter_inputs: circumferences,
      somatotype: {
        endomorphy: session.somatotype_endo || 0,
        mesomorphy: session.somatotype_meso || 0,
        ectomorphy: session.somatotype_ecto || 0,
        classification: session.somatotype_class,
        hwr: circumferences.hwr || 0
      },
      front_image_url: session.front_image_url,
      side_image_url: session.side_image_url,
    };

    navigate('/results', { state: { result } });
  };

  const getImageUrl = (path: string | null) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return `${API_URL.replace('/api/v1', '')}${path}`;
  };

  const formatKey = (key: string) => {
    return key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="fixed top-0 left-0 right-0 bg-black/80 backdrop-blur-md z-50 border-b border-white/10">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <div className="w-3 h-3 bg-emerald-500 rounded-full" />
            SomaLens
          </Link>
          <nav className="flex items-center gap-6">
             <Link to="/capture" className="text-sm font-medium text-white/60 hover:text-white transition-colors">
              New Scan
            </Link>
             <Link to="/history" className="text-sm font-medium text-white hover:text-white transition-colors">
              History
            </Link>
            <button 
              onClick={() => {
                localStorage.removeItem('access_token');
                localStorage.removeItem('refresh_token');
                window.location.href = '/login';
              }}
              className="text-sm font-medium text-white/60 hover:text-rose-400 transition-colors"
            >
              Sign Out
            </button>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-24 max-w-5xl">
        <div className="flex justify-between items-end mb-8">
          <div>
             <h1 className="text-3xl font-bold text-white mb-2">Progress Tracking</h1>
             <p className="text-white/60">Monitor your somatotype and body metrics over time</p>
          </div>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl mb-8">
            {error}
          </div>
        )}

        {history.length === 0 && !error ? (
          <div className="bg-white/5 border border-white/10 rounded-3xl p-12 text-center">
            <div className="text-6xl mb-6 opacity-50">📊</div>
            <h2 className="text-xl font-bold text-white mb-2">No measurements yet</h2>
            <p className="text-white/60 mb-8 max-w-md mx-auto">
              Complete your first body scan to start tracking your transformation journey.
            </p>
            <Link
              to="/capture"
              className="inline-block bg-emerald-500 text-black px-8 py-3 rounded-xl font-bold hover:bg-emerald-400 transition-colors"
            >
              Start First Scan
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 backdrop-blur-sm">
              <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"/>
                Trends
              </h3>
              <ProgressChart sessions={history} />
            </div>

            <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-sm">
               <div className="p-6 md:p-8 border-b border-white/10">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500"/>
                    Recent Scans
                </h3>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-white/5 text-left text-xs font-bold text-white/50 uppercase tracking-wider">
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Somatotype</th>
                      <th className="px-6 py-4">Endo - Meso - Ecto</th>
                      <th className="px-6 py-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {history.map((session) => (
                      <tr key={session.id} className="hover:bg-white/5 transition-colors group">
                        <td className="px-6 py-4 text-sm font-medium text-white">
                          {new Date(session.created_at).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                        <td className="px-6 py-4">
                          {session.somatotype_class ? (
                             <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                {session.somatotype_class}
                             </span>
                          ) : (
                            <span className="text-white/40 text-xs">Processing...</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-white/70 font-mono">
                          {session.somatotype_endo !== null ? (
                            `${session.somatotype_endo.toFixed(1)} - ${session.somatotype_meso?.toFixed(1)} - ${session.somatotype_ecto?.toFixed(1)}`
                          ) : '-'}
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <button
                            onClick={() => setSelectedSession(selectedSession?.id === session.id ? null : session)}
                            className="text-sm font-bold text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            {selectedSession?.id === session.id ? 'Hide Details' : 'Details'}
                          </button>
                          <button
                            onClick={() => handleViewDetails(session)}
                            disabled={!session.somatotype_class}
                            className="text-sm font-bold text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Full Report →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedSession && (
              <div className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"/>
                    Measurement Details - {new Date(selectedSession.created_at).toLocaleDateString()}
                  </h3>
                  <button
                    onClick={() => setSelectedSession(null)}
                    className="text-white/60 hover:text-white"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-1 space-y-4">
                    <h4 className="text-sm font-bold text-white/70 uppercase tracking-wider">Images</h4>
                    <div className="grid grid-cols-2 gap-4">
                      {selectedSession.front_image_url && (
                        <div className="space-y-2">
                          <span className="text-xs text-white/50">Front View</span>
                          <img
                            src={getImageUrl(selectedSession.front_image_url) || ''}
                            alt="Front view"
                            className="w-full aspect-[3/4] object-cover rounded-xl border border-white/10"
                          />
                        </div>
                      )}
                      {selectedSession.side_image_url && (
                        <div className="space-y-2">
                          <span className="text-xs text-white/50">Side View</span>
                          <img
                            src={getImageUrl(selectedSession.side_image_url) || ''}
                            alt="Side view"
                            className="w-full aspect-[3/4] object-cover rounded-xl border border-white/10"
                          />
                        </div>
                      )}
                      {!selectedSession.front_image_url && !selectedSession.side_image_url && (
                        <div className="col-span-2 text-white/40 text-sm p-4 bg-white/5 rounded-xl text-center">
                          No images available
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                      <h4 className="text-sm font-bold text-rose-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500"/>
                        Skinfolds (mm)
                      </h4>
                      <div className="space-y-2">
                        {SKINFOLD_KEYS.map(key => {
                          const value = selectedSession.circumferences?.[key];
                          return (
                            <div key={key} className="flex justify-between text-sm">
                              <span className="text-white/60">{formatKey(key)}</span>
                              <span className="text-white font-mono">
                                {value !== undefined ? value.toFixed(1) : '-'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                      <h4 className="text-sm font-bold text-blue-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500"/>
                        Breadths (cm)
                      </h4>
                      <div className="space-y-2">
                        {BREADTH_KEYS.map(key => {
                          const value = selectedSession.circumferences?.[key];
                          return (
                            <div key={key} className="flex justify-between text-sm">
                              <span className="text-white/60">{formatKey(key)}</span>
                              <span className="text-white font-mono">
                                {value !== undefined ? value.toFixed(1) : '-'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                      <h4 className="text-sm font-bold text-purple-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500"/>
                        Girths (cm)
                      </h4>
                      <div className="space-y-2">
                        {GIRTH_KEYS.map(key => {
                          const value = selectedSession.circumferences?.[key];
                          return (
                            <div key={key} className="flex justify-between text-sm">
                              <span className="text-white/60">{formatKey(key)}</span>
                              <span className="text-white font-mono">
                                {value !== undefined ? value.toFixed(1) : '-'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                      <h4 className="text-sm font-bold text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"/>
                        Additional Girths (cm)
                      </h4>
                      <div className="space-y-2">
                        {ADDITIONAL_GIRTH_KEYS.map(key => {
                          const value = selectedSession.circumferences?.[key];
                          return (
                            <div key={key} className="flex justify-between text-sm">
                              <span className="text-white/60">{formatKey(key)}</span>
                              <span className="text-white font-mono">
                                {value !== undefined ? value.toFixed(1) : '-'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default HistoryPage;
