import { Link } from 'react-router-dom';

export function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-900 to-primary-700 text-white">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-5xl font-bold mb-6">SomaLens</h1>
          <p className="text-xl text-primary-100 mb-8 max-w-2xl mx-auto">
            Advanced body measurement and somatotype classification using AI-powered pose analysis.
          </p>
          
          <div className="flex justify-center gap-4">
            <Link
              to="/capture"
              className="bg-white text-primary-700 px-8 py-3 rounded-lg font-semibold hover:bg-primary-50 transition-colors"
            >
              Start Measurement
            </Link>
            <Link
              to="/login"
              className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white/10 transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>

        <div className="mt-20 grid md:grid-cols-3 gap-8">
          <div className="bg-white/10 rounded-xl p-6 backdrop-blur">
            <div className="text-3xl mb-4">📷</div>
            <h3 className="text-xl font-semibold mb-2">Pose Capture</h3>
            <p className="text-primary-100">
              Real-time pose validation guides you to the perfect front and side poses.
            </p>
          </div>
          
          <div className="bg-white/10 rounded-xl p-6 backdrop-blur">
            <div className="text-3xl mb-4">📊</div>
            <h3 className="text-xl font-semibold mb-2">AI Analysis</h3>
            <p className="text-primary-100">
              Advanced ML models extract body measurements from your images.
            </p>
          </div>
          
          <div className="bg-white/10 rounded-xl p-6 backdrop-blur">
            <div className="text-3xl mb-4">🏋️</div>
            <h3 className="text-xl font-semibold mb-2">Somatotype</h3>
            <p className="text-primary-100">
              Get your Heath-Carter somatotype classification instantly.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
