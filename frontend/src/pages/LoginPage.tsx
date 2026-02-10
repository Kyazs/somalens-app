import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const from = location.state?.from?.pathname || '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to login');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white font-sans flex flex-col lg:flex-row">
      {/* Left Branding Panel — hidden on mobile */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-50 relative overflow-hidden flex-col justify-between p-12">
        {/* Decorative dot grid */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, #0f172a 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

        <div className="relative z-10">
          <Link to="/" className="inline-flex items-center text-xl font-bold tracking-tight text-slate-900">
            SomaLens<span className="text-teal-600">.</span>
          </Link>
        </div>

        <div className="relative z-10 max-w-md">
          <h2 className="text-3xl font-bold text-slate-900 mb-4 leading-tight">
            Your body, decoded with precision.
          </h2>
          <p className="text-slate-500 leading-relaxed mb-8">
            Sign in to access your personalized wellness dashboard, track progress, and get AI-powered body composition insights.
          </p>

          {/* Floating stat cards */}
          <div className="flex gap-4">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                </div>
                <span className="text-xs font-medium text-slate-400">Tracking</span>
              </div>
              <div className="text-lg font-bold text-slate-900">98.5%</div>
              <div className="text-xs text-slate-400">Analysis accuracy</div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
                </div>
                <span className="text-xs font-medium text-slate-400">Progress</span>
              </div>
              <div className="text-lg font-bold text-slate-900">3 types</div>
              <div className="text-xs text-slate-400">Somatotype classes</div>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-sm text-slate-400">
          &copy; {new Date().getFullYear()} SomaLens. All rights reserved.
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8 text-center">
            <Link to="/" className="inline-flex items-center text-xl font-bold tracking-tight text-slate-900">
              SomaLens<span className="text-teal-600">.</span>
            </Link>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Welcome back</h1>
            <p className="text-slate-500 mt-2 text-sm sm:text-base">Sign in to your account to continue.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm flex items-start gap-2">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <span>{error}</span>
              </div>
            )}
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                Email address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all text-sm sm:text-base"
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all text-sm sm:text-base"
                placeholder="Enter your password"
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-teal-600 text-white py-2.5 sm:py-3 rounded-xl font-semibold hover:bg-teal-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex justify-center items-center shadow-sm hover:shadow-md text-sm sm:text-base cursor-pointer"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <p className="text-slate-500 text-sm">
              Don't have an account?{' '}
              <Link to="/register" className="text-teal-600 hover:text-teal-700 font-medium transition-colors">
                Create one
              </Link>
            </p>
          </div>

          <div className="mt-6 text-center">
            <Link to="/" className="text-sm text-slate-400 hover:text-slate-600 transition-colors inline-flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
              Back to home
            </Link>
          </div>

          {/* Mobile footer */}
          <div className="lg:hidden mt-12 text-center text-xs text-slate-400">
            &copy; {new Date().getFullYear()} SomaLens. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
