import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [age, setAge] = useState<string>(user?.age?.toString() || '');
  const [gender, setGender] = useState(user?.gender || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (name.trim().length < 2) {
      setError('Name must be at least 2 characters');
      return;
    }

    const ageNum = age ? parseInt(age, 10) : null;
    if (ageNum !== null && (ageNum < 1 || ageNum > 120)) {
      setError('Age must be between 1 and 120');
      return;
    }

    setIsSubmitting(true);

    try {
      await updateProfile({
        name: name.trim(),
        age: ageNum,
        gender: gender.trim() || null,
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="fixed top-0 left-0 right-0 bg-black/80 backdrop-blur-md z-50 border-b border-white/10">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/dashboard" className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <div className="w-3 h-3 bg-emerald-500 rounded-full" />
            SomaLens
          </Link>
          <nav className="flex items-center gap-6">
            <Link to="/dashboard" className="text-sm font-medium text-white/60 hover:text-white transition-colors">
              Dashboard
            </Link>
            <Link to="/capture" className="text-sm font-medium text-white/60 hover:text-white transition-colors">
              New Scan
            </Link>
            <Link to="/history" className="text-sm font-medium text-white/60 hover:text-white transition-colors">
              History
            </Link>
            <Link to="/profile" className="text-sm font-medium text-white transition-colors">
              Profile
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

      <main className="container mx-auto px-4 py-24 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Profile Settings</h1>
          <p className="text-white/60">Manage your account information</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm">
                Profile updated successfully
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white/60 mb-2">
                Email
              </label>
              <div className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white/40">
                {user?.email}
              </div>
              <p className="text-xs text-white/40 mt-1">Email cannot be changed</p>
            </div>

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-white/60 mb-2">
                Full Name
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                placeholder="Your name"
                required
              />
            </div>

            <div>
              <label htmlFor="age" className="block text-sm font-medium text-white/60 mb-2">
                Age
              </label>
              <input
                type="number"
                id="age"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                placeholder="Optional"
                min="1"
                max="120"
              />
            </div>

            <div>
              <label htmlFor="gender" className="block text-sm font-medium text-white/60 mb-2">
                Gender
              </label>
              <select
                id="gender"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
              >
                <option value="" className="bg-gray-900">Select (Optional)</option>
                <option value="male" className="bg-gray-900">Male</option>
                <option value="female" className="bg-gray-900">Female</option>
                <option value="other" className="bg-gray-900">Other</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-emerald-500 text-black py-3 rounded-xl font-bold hover:bg-emerald-400 transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                'Save Changes'
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

export default ProfilePage;
