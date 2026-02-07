import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import type { AnalysisResponse } from '../services/api';
import type { MeasurementSession } from '../types/pose';
import ProgressChart from '../components/ProgressChart';

export function UserDashboard() {
  const navigate = useNavigate();
  const [history, setHistory] = useState<MeasurementSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    
    const result: AnalysisResponse = {
      id: session.id,
      proxy_measurements: circumferences,
      heath_carter_inputs: circumferences,
      somatotype: {
        endomorphy: session.somatotype_endo ?? 0,
        mesomorphy: session.somatotype_meso ?? 0,
        ectomorphy: session.somatotype_ecto ?? 0,
        classification: session.somatotype_class,
        hwr: circumferences.hwr ?? 0
      },
      front_image_url: session.front_image_url,
      side_image_url: session.side_image_url
    };

    navigate('/results', { state: { result } });
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
             <Link to="/history" className="text-sm font-medium text-white/60 hover:text-white transition-colors">
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

      <main className="container mx-auto px-4 py-24 max-w-6xl">
        <div className="flex justify-between items-end mb-12">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">My Dashboard</h1>
            <p className="text-white/60">Welcome back. Here is your body analysis overview.</p>
          </div>
          <Link
            to="/capture"
            className="hidden md:inline-flex items-center gap-2 bg-emerald-500 text-black px-6 py-3 rounded-xl font-bold hover:bg-emerald-400 transition-colors"
          >
            <span>+</span> New Analysis
          </Link>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl mb-8">
            {error}
          </div>
        )}

        {history.length === 0 && !error ? (
          <div className="bg-white/5 border border-white/10 rounded-3xl p-12 text-center">
            <div className="text-6xl mb-6 opacity-50">👋</div>
            <h2 className="text-xl font-bold text-white mb-2">Welcome to SomaLens</h2>
            <p className="text-white/60 mb-8 max-w-md mx-auto">
              Get started by creating your first body analysis.
            </p>
            <Link
              to="/capture"
              className="inline-block bg-emerald-500 text-black px-8 py-3 rounded-xl font-bold hover:bg-emerald-400 transition-colors"
            >
              Start Analysis
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Chart Section */}
            <div className="lg:col-span-2 space-y-8">
              <div className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 backdrop-blur-sm">
                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"/>
                  Somatotype Trends
                </h3>
                <ProgressChart sessions={history} />
              </div>

              {/* Recent Activity Table */}
              <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-sm">
                <div className="p-6 md:p-8 border-b border-white/10 flex justify-between items-center">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500"/>
                    Recent Scans
                  </h3>
                  <Link to="/history" className="text-xs font-bold text-emerald-400 hover:text-emerald-300 uppercase tracking-wider">
                    View All
                  </Link>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-white/5 text-left text-xs font-bold text-white/50 uppercase tracking-wider">
                        <th className="px-6 py-4">Date</th>
                        <th className="px-6 py-4">Type</th>
                        <th className="px-6 py-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {history.slice(0, 5).map((session) => (
                        <tr key={session.id} className="hover:bg-white/5 transition-colors cursor-pointer" onClick={() => handleViewDetails(session)}>
                          <td className="px-6 py-4 text-sm font-medium text-white">
                            {new Date(session.created_at).toLocaleDateString(undefined, {
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
                          <td className="px-6 py-4 text-right">
                            <span className="text-white/40 group-hover:text-white">→</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Side Stats / Quick Actions */}
            <div className="space-y-6">
                <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 rounded-3xl p-6">
                    <h3 className="text-lg font-bold text-white mb-2">Latest Status</h3>
                    {history[0]?.somatotype_class ? (
                        <>
                            <div className="text-4xl font-black text-emerald-400 mb-1">
                                {history[0].somatotype_class}
                            </div>
                            <div className="text-white/60 text-sm mb-4">
                                Last analysis on {new Date(history[0].created_at).toLocaleDateString()}
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="bg-black/20 rounded-lg p-2">
                                    <div className="text-xs text-white/40 mb-1">Endo</div>
                                    <div className="font-bold">{(history[0].somatotype_endo ?? 0).toFixed(1)}</div>
                                </div>
                                <div className="bg-black/20 rounded-lg p-2">
                                    <div className="text-xs text-white/40 mb-1">Meso</div>
                                    <div className="font-bold">{(history[0].somatotype_meso ?? 0).toFixed(1)}</div>
                                </div>
                                <div className="bg-black/20 rounded-lg p-2">
                                    <div className="text-xs text-white/40 mb-1">Ecto</div>
                                    <div className="font-bold">{(history[0].somatotype_ecto ?? 0).toFixed(1)}</div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="text-white/40">No data available</div>
                    )}
                </div>

                <Link to="/capture" className="block w-full bg-white/5 border border-white/10 hover:bg-white/10 rounded-3xl p-6 transition-colors group">
                    <div className="text-2xl mb-2 group-hover:scale-110 transition-transform duration-300">📸</div>
                    <div className="font-bold text-white">New Body Scan</div>
                    <div className="text-sm text-white/40">Update your measurements</div>
                </Link>
                
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                    <h3 className="text-sm font-bold text-white/60 uppercase tracking-widest mb-4">Stats</h3>
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-white/60">Total Scans</span>
                        <span className="text-xl font-bold text-white">{history.length}</span>
                    </div>
                </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
