import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import type { AnalysisResponse } from '../services/api';
import type { MeasurementSession } from '../types/pose';
import ProgressChart from '../components/ProgressChart';

export function HistoryPage() {
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
        setError('Failed to load measurement history.');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  const handleViewDetails = (session: MeasurementSession) => {
    if (!session.somatotype_result) return;

    // Transform MeasurementSession to AnalysisResponse format for ResultsPage
    const proxy_measurements: Record<string, number> = {};
    const heath_carter_inputs: Record<string, number> = {};

    session.body_measurements.forEach(m => {
      // Backend stores keys as sent, so they should match (e.g., 'Stature', 'Weight')
      proxy_measurements[m.measurement_type] = m.value;
      
      // If it's a skinfold or bone breadth, it might be heath_carter
      // But ResultsPage checks specific keys in specific arrays.
      // We can safely put everything in proxy_measurements if keys are unique enough
      // or duplicate them.
      heath_carter_inputs[m.measurement_type] = m.value;
    });

    const result: AnalysisResponse = {
      proxy_measurements,
      heath_carter_inputs,
      somatotype: {
        endomorphy: session.somatotype_result.endomorphy,
        mesomorphy: session.somatotype_result.mesomorphy,
        ectomorphy: session.somatotype_result.ectomorphy,
        classification: session.somatotype_result.classification,
        hwr: 0 // Not stored/calculated in backend yet
      }
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
                          {session.somatotype_result ? (
                             <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                {session.somatotype_result.classification}
                             </span>
                          ) : (
                            <span className="text-white/40 text-xs">Processing...</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-white/70 font-mono">
                          {session.somatotype_result ? (
                            `${session.somatotype_result.endomorphy.toFixed(1)} - ${session.somatotype_result.mesomorphy.toFixed(1)} - ${session.somatotype_result.ectomorphy.toFixed(1)}`
                          ) : '-'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleViewDetails(session)}
                            className="text-sm font-bold text-emerald-400 hover:text-emerald-300 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            View Report →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default HistoryPage;
