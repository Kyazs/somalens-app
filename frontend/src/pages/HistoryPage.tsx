import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import type { AnalysisResponse } from '../services/api';
import type { MeasurementSession } from '../types/pose';
import { SKINFOLD_KEYS, BREADTH_KEYS, GIRTH_KEYS, ADDITIONAL_GIRTH_KEYS } from '../types/pose';
import AppNavbar from '../components/AppNavbar';

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

    navigate('/results', { 
      state: { 
        result,
        measurementId: session.id,
        preferences: {
          goal: 'maintenance',
          activityLevel: 'moderate',
          exerciseComplexity: 'beginner',
          exerciseType: 'gym',
        },
        userInfo: {
          name: session.name,
          age: session.age,
          gender: session.gender,
        }
      } 
    });
  };

  const getImageUrl = (path: string | null) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return `${API_URL.replace('/api/v1', '')}${path}`;
  };

  const formatKey = (key: string) => {
    return key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();
  };

  // Stats Calculations
  const totalScans = history.length;
  
  const scansThisWeek = history.filter(session => {
    const date = new Date(session.created_at);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    return diffDays <= 7;
  }).length;

  const latestScan = history[0];
  const latestDate = latestScan 
    ? new Date(latestScan.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : "No scans yet";

  const latestBMI = latestScan && latestScan.weight && latestScan.height
    ? (latestScan.weight / Math.pow(latestScan.height / 100, 2)).toFixed(1)
    : "-";

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-500"></div>
      </div>
    );
  }

  return (
    <>
      <AppNavbar />
      <div className="min-h-screen bg-slate-50">
        <main className="container mx-auto px-4 py-8 max-w-5xl">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">Progress Tracking</h1>
              <p className="text-slate-500">Monitor your somatotype and body metrics over time</p>
            </div>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-600 p-4 rounded-xl mb-8">
              {error}
            </div>
          )}

          {history.length === 0 && !error ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
              <div className="flex justify-center mb-6">
                <svg className="w-16 h-16 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">No measurements yet</h2>
              <p className="text-slate-500 mb-8 max-w-md mx-auto">
                Complete your first body scan to start tracking your transformation journey.
              </p>
              <Link
                to="/capture"
                className="inline-block bg-teal-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-teal-700 shadow-sm hover:shadow-md transition-all"
              >
                Start First Scan
              </Link>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Scans */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="20" x2="18" y2="10"></line>
                      <line x1="12" y1="20" x2="12" y2="4"></line>
                      <line x1="6" y1="20" x2="6" y2="14"></line>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 font-medium">Total Scans</p>
                    <p className="text-2xl font-bold text-slate-900">{totalScans}</p>
                  </div>
                </div>

                {/* Scans This Week */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="16" y1="2" x2="16" y2="6"></line>
                      <line x1="8" y1="2" x2="8" y2="6"></line>
                      <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 font-medium">This Week</p>
                    <p className="text-2xl font-bold text-slate-900">{scansThisWeek}</p>
                  </div>
                </div>

                {/* Latest Scan */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 font-medium">Latest Scan</p>
                    <p className="text-lg font-bold text-slate-900">{latestDate}</p>
                  </div>
                </div>

                {/* BMI */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 font-medium">Latest BMI</p>
                    <p className="text-2xl font-bold text-slate-900">{latestBMI}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 md:p-8 border-b border-slate-100">
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500"/>
                    Recent Scans
                  </h3>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                        <th className="px-6 py-4">Date</th>
                        <th className="px-6 py-4">Somatotype</th>
                        <th className="px-6 py-4">Endo - Meso - Ecto</th>
                        <th className="px-6 py-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {history.map((session) => (
                        <tr key={session.id} className="hover:bg-slate-50 transition-colors group">
                          <td className="px-6 py-4 text-sm font-medium text-slate-900">
                            {new Date(session.created_at).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </td>
                          <td className="px-6 py-4">
                            {session.somatotype_class ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-50 text-teal-700 border border-teal-200">
                                {session.somatotype_class}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs">Processing...</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600 font-mono">
                            {session.somatotype_endo !== null ? (
                              `${session.somatotype_endo.toFixed(1)} - ${session.somatotype_meso?.toFixed(1)} - ${session.somatotype_ecto?.toFixed(1)}`
                            ) : '-'}
                          </td>
                          <td className="px-6 py-4 text-right space-x-2">
                            <button
                              onClick={() => setSelectedSession(selectedSession?.id === session.id ? null : session)}
                              className="p-2 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition-colors"
                              title="View Details"
                            >
                              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                              </svg>
                            </button>
                            <button
                              onClick={() => handleViewDetails(session)}
                              disabled={!session.somatotype_class}
                              className="p-2 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Full Report"
                            >
                              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                <line x1="16" y1="17" x2="8" y2="17"></line>
                                <polyline points="10 9 9 9 8 9"></polyline>
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedSession && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-500"/>
                      Measurement Details - {new Date(selectedSession.created_at).toLocaleDateString()}
                    </h3>
                    <button
                      onClick={() => setSelectedSession(null)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  </div>

                  {/* Summary Row */}
                  <div className="flex flex-wrap gap-3 mb-8 pb-6 border-b border-slate-100">
                    <div className="px-4 py-2 bg-slate-50 rounded-full border border-slate-200 text-sm font-medium text-slate-700">
                      Height: <span className="font-bold text-slate-900">{selectedSession.height ? `${selectedSession.height} cm` : '-'}</span>
                    </div>
                    <div className="px-4 py-2 bg-slate-50 rounded-full border border-slate-200 text-sm font-medium text-slate-700">
                      Weight: <span className="font-bold text-slate-900">{selectedSession.weight ? `${selectedSession.weight} kg` : '-'}</span>
                    </div>
                    <div className="px-4 py-2 bg-slate-50 rounded-full border border-slate-200 text-sm font-medium text-slate-700">
                      Body Fat: <span className="font-bold text-slate-900">{selectedSession.body_fat_percentage ? `${selectedSession.body_fat_percentage}%` : '-'}</span>
                    </div>
                    <div className="px-4 py-2 bg-slate-50 rounded-full border border-slate-200 text-sm font-medium text-slate-700">
                      Somatotype: <span className="font-bold text-slate-900">
                        {selectedSession.somatotype_endo?.toFixed(1)} - {selectedSession.somatotype_meso?.toFixed(1)} - {selectedSession.somatotype_ecto?.toFixed(1)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1 space-y-4">
                      <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Images</h4>
                      <div className="grid grid-cols-2 gap-4">
                        {selectedSession.front_image_url && (
                          <div className="space-y-2">
                            <span className="text-xs text-slate-400">Front View</span>
                            <img
                              src={getImageUrl(selectedSession.front_image_url) || ''}
                              alt="Front view"
                              className="w-full aspect-[3/4] object-cover rounded-xl border border-slate-200"
                            />
                          </div>
                        )}
                        {selectedSession.side_image_url && (
                          <div className="space-y-2">
                            <span className="text-xs text-slate-400">Side View</span>
                            <img
                              src={getImageUrl(selectedSession.side_image_url) || ''}
                              alt="Side view"
                              className="w-full aspect-[3/4] object-cover rounded-xl border border-slate-200"
                            />
                          </div>
                        )}
                        {!selectedSession.front_image_url && !selectedSession.side_image_url && (
                          <div className="col-span-2 text-slate-400 text-sm p-4 bg-slate-50 rounded-xl text-center">
                            No images available
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-rose-50/30 rounded-xl p-5 border-l-4 border-rose-500 shadow-sm">
                        <h4 className="text-sm font-bold text-rose-700 uppercase tracking-wider mb-4">
                          Skinfolds (mm)
                        </h4>
                        <div className="space-y-3">
                          {SKINFOLD_KEYS.map(key => {
                            const value = selectedSession.circumferences?.[key];
                            return (
                              <div key={key} className="flex justify-between items-center">
                                <span className="text-sm text-slate-600">{formatKey(key)}</span>
                                <span className="text-base font-bold text-slate-900 font-mono">
                                  {value !== undefined ? value.toFixed(1) : '-'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="bg-blue-50/30 rounded-xl p-5 border-l-4 border-blue-500 shadow-sm">
                        <h4 className="text-sm font-bold text-blue-700 uppercase tracking-wider mb-4">
                          Breadths (cm)
                        </h4>
                        <div className="space-y-3">
                          {BREADTH_KEYS.map(key => {
                            const value = selectedSession.circumferences?.[key];
                            return (
                              <div key={key} className="flex justify-between items-center">
                                <span className="text-sm text-slate-600">{formatKey(key)}</span>
                                <span className="text-base font-bold text-slate-900 font-mono">
                                  {value !== undefined ? value.toFixed(1) : '-'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="bg-purple-50/30 rounded-xl p-5 border-l-4 border-purple-500 shadow-sm">
                        <h4 className="text-sm font-bold text-purple-700 uppercase tracking-wider mb-4">
                          Girths (cm)
                        </h4>
                        <div className="space-y-3">
                          {GIRTH_KEYS.map(key => {
                            const value = selectedSession.circumferences?.[key];
                            return (
                              <div key={key} className="flex justify-between items-center">
                                <span className="text-sm text-slate-600">{formatKey(key)}</span>
                                <span className="text-base font-bold text-slate-900 font-mono">
                                  {value !== undefined ? value.toFixed(1) : '-'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="bg-amber-50/30 rounded-xl p-5 border-l-4 border-amber-500 shadow-sm">
                        <h4 className="text-sm font-bold text-amber-700 uppercase tracking-wider mb-4">
                          Additional Girths (cm)
                        </h4>
                        <div className="space-y-3">
                          {ADDITIONAL_GIRTH_KEYS.map(key => {
                            const value = selectedSession.circumferences?.[key];
                            return (
                              <div key={key} className="flex justify-between items-center">
                                <span className="text-sm text-slate-600">{formatKey(key)}</span>
                                <span className="text-base font-bold text-slate-900 font-mono">
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
    </>
  );
}

export default HistoryPage;
