import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import type { AnalysisResponse } from '../services/api';
import type { MeasurementSession } from '../types/pose';
import ProgressChart from '../components/ProgressChart';
import { useAuth } from '../context/AuthContext';
import AppNavbar from '../components/AppNavbar';

export function UserDashboard() {
  const navigate = useNavigate();
  const [history, setHistory] = useState<MeasurementSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await api.getHistory();
        setHistory(data);
      } catch (err) {
        console.error('Failed to fetch history:', err);
        setError('Failed to load dashboard data.');
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
        endomorphy: session.somatotype_endo ?? 0,
        mesomorphy: session.somatotype_meso ?? 0,
        ectomorphy: session.somatotype_ecto ?? 0,
        classification: session.somatotype_class,
        hwr: circumferences.hwr ?? 0
      },
      front_image_url: session.front_image_url,
      side_image_url: session.side_image_url,
      confidence_data: session.confidence_data || null,
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
          medicalConditions: session.medical_conditions || [],
        },
        userInfo: {
          name: session.name,
          age: session.age,
          gender: session.gender,
        }
      } 
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-teal-600/20 border-t-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AppNavbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Welcome back, {user?.name || 'there'}
            </h1>
            <p className="text-slate-500 mt-1">Here's your body analysis overview.</p>
          </div>
          <Link
            to="/capture"
            className="hidden sm:inline-flex items-center gap-2 bg-teal-600 text-white px-5 py-2.5 rounded-xl font-medium text-sm hover:bg-teal-700 transition-colors shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            New Analysis
          </Link>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-600 p-4 rounded-xl mb-6">
            {error}
          </div>
        )}

        {/* Empty State */}
        {history.length === 0 && !error ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
            <div className="mx-auto w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-6 text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                <circle cx="12" cy="13" r="4"></circle>
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Welcome to SomaLens</h2>
            <p className="text-slate-500 mb-8">Get started by creating your first body analysis.</p>
            <Link
              to="/capture"
              className="inline-flex items-center gap-2 bg-teal-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-teal-700 transition-colors shadow-sm"
            >
              Start Analysis
            </Link>
          </div>
        ) : (
          /* Dashboard Content */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Somatotype Trends */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-1.5 h-1.5 rounded-full bg-teal-500"></div>
                  <h3 className="text-base font-semibold text-slate-900">Somatotype Trends</h3>
                </div>
                <ProgressChart sessions={history} />
              </div>

              {/* Recent Scans Table */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="text-base font-semibold text-slate-900">Recent Scans</h3>
                  <Link to="/history" className="text-teal-600 text-xs font-semibold uppercase tracking-wider hover:text-teal-700">
                    View All
                  </Link>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                        <th className="px-6 py-4">Date</th>
                        <th className="px-6 py-4">Type</th>
                        <th className="px-6 py-4 hidden sm:table-cell">Score</th>
                        <th className="px-6 py-4 hidden sm:table-cell">Weight</th>
                        <th className="px-6 py-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {history.slice(0, 5).map((session) => (
                        <tr 
                          key={session.id} 
                          className="hover:bg-slate-50 transition-colors cursor-pointer" 
                          onClick={() => handleViewDetails(session)}
                        >
                          <td className="px-6 py-4 text-sm font-medium text-slate-900">
                            {new Date(session.created_at).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </td>
                          <td className="px-6 py-4">
                            {session.somatotype_class ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-50 text-teal-700 border border-teal-100">
                                {session.somatotype_class}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs">Processing...</span>
                            )}
                          </td>
                          <td className="px-6 py-4 hidden sm:table-cell">
                            {session.somatotype_endo !== null ? (
                              <span className="font-mono text-sm text-slate-600">
                                {session.somatotype_endo.toFixed(1)} - {(session.somatotype_meso ?? 0).toFixed(1)} - {(session.somatotype_ecto ?? 0).toFixed(1)}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 hidden sm:table-cell">
                            {session.weight ? (
                              <span className="text-sm text-slate-600">{session.weight} kg</span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleViewDetails(session); }} 
                              className="p-2 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition-colors" 
                              title="View Report"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right Sidebar */}
            <div className="space-y-6">
              {/* Latest Status */}
              <div className="bg-gradient-to-br from-teal-50 to-white border border-teal-100 rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Latest Status</h3>
                {history[0]?.somatotype_class ? (
                  <>
                    <div className="text-2xl font-bold text-teal-700 mb-1">
                      {history[0].somatotype_class}
                    </div>
                    <div className="text-slate-400 text-sm mb-6">
                      {new Date(history[0].created_at).toLocaleDateString()}
                    </div>
                    
                    <div className="space-y-3">
                      {[
                        { label: 'Endomorph', value: history[0].somatotype_endo ?? 0 },
                        { label: 'Mesomorph', value: history[0].somatotype_meso ?? 0 },
                        { label: 'Ectomorph', value: history[0].somatotype_ecto ?? 0 },
                      ].map((stat) => (
                        <div key={stat.label}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-500">{stat.label}</span>
                            <span className="font-semibold text-slate-700">{stat.value.toFixed(1)}</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-teal-500 rounded-full" 
                              style={{ width: `${Math.min((stat.value / 10) * 100, 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {history[0].confidence_data && (
                      <div className={`mt-4 px-3 py-2 rounded-lg text-xs font-medium text-center ${
                        history[0].confidence_data.confidence === 'HIGH'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : history[0].confidence_data.confidence === 'MEDIUM'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {history[0].confidence_data.confidence} Confidence
                        {history[0].confidence_data.n_flagged > 0 && (
                          <span className="opacity-70"> · {history[0].confidence_data.n_flagged}/8 flagged</span>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-slate-400 text-sm">No data available</div>
                )}
              </div>

              {/* Quick Actions */}
              <Link 
                to="/capture" 
                className="block bg-white rounded-2xl shadow-sm border border-slate-100 p-5 hover:shadow-md transition-shadow group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center text-teal-600 group-hover:scale-110 transition-transform">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                      <circle cx="12" cy="13" r="4"></circle>
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium text-slate-900">New Body Scan</div>
                    <div className="text-sm text-slate-400">Update your measurements</div>
                  </div>
                </div>
              </Link>

              {/* Stats */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Stats</h3>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Total Scans</span>
                  <span className="text-lg font-bold text-slate-900">{history.length}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
