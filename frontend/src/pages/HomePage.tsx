import { Link } from 'react-router-dom';

export function HomePage() {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-teal-100 selection:text-teal-900">
      {/* 1. Sticky Navigation Bar */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex-shrink-0 flex items-center cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <span className="text-xl font-bold tracking-tight text-slate-900">
                SomaLens<span className="text-teal-600">.</span>
              </span>
            </div>

            {/* Desktop Nav Links */}
            <div className="hidden md:flex space-x-8">
              <button onClick={() => scrollToSection('features')} className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors cursor-pointer">
                Features
              </button>
              <button onClick={() => scrollToSection('how-it-works')} className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors cursor-pointer">
                How It Works
              </button>
            </div>

            {/* CTA Button */}
            <div className="flex items-center space-x-4">
              <Link to="/login" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">
                Sign In
              </Link>
              <Link
                to="/register"
                className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-full text-white bg-slate-900 hover:bg-slate-800 transition-all shadow-sm hover:shadow-md"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* 2. Hero Section */}
      <section className="relative pt-12 pb-16 sm:pt-16 sm:pb-20 md:pt-20 md:pb-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid lg:grid-cols-2 gap-8 md:gap-12 items-center">
            {/* Text Content */}
            <div className="max-w-2xl">
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 mb-4 sm:mb-6 leading-tight">
                Your Body, <br />
                <span className="text-teal-600">Decoded by AI</span>
              </h1>
              <p className="text-base sm:text-lg text-slate-500 mb-6 sm:mb-8 leading-relaxed">
                Somalens uses Ensemble AI to analyze your unique body shape from simple photos — crafting a personalized wellness roadmap designed specifically for your biology.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  to="/register"
                  className="inline-flex justify-center items-center px-8 py-3 border border-transparent text-base font-medium rounded-full text-white bg-teal-600 hover:bg-teal-700 transition-all shadow-lg hover:shadow-teal-500/30"
                >
                  Get Started
                </Link>
                <button
                  onClick={() => scrollToSection('features')}
                  className="inline-flex justify-center items-center px-8 py-3 border border-slate-200 text-base font-medium rounded-full text-slate-600 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
                >
                  Learn More
                </button>
              </div>
            </div>

            {/* Dashboard Mockup */}
            <div className="relative lg:ml-auto w-full max-w-sm sm:max-w-md lg:max-w-full mx-auto lg:mx-0">
              <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden transform transition-transform hover:scale-[1.01] duration-500">
                {/* Mockup Header */}
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400"></div>
                  <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                  <div className="w-3 h-3 rounded-full bg-green-400"></div>
                </div>
                
                {/* Mockup Body */}
                <div className="p-6 grid grid-cols-2 gap-6">
                  {/* Silhouette */}
                  <div className="bg-slate-50 rounded-xl p-4 flex items-center justify-center h-48">
                     <svg viewBox="0 0 100 200" className="h-full w-auto text-slate-300 fill-current">
                        <path d="M50 20 C60 20 65 25 65 35 C65 45 60 50 50 50 C40 50 35 45 35 35 C35 25 40 20 50 20 Z M30 60 C20 60 15 70 15 80 L15 130 C15 135 20 135 20 130 L20 90 L30 90 L30 180 C30 190 40 190 40 180 L40 140 L60 140 L60 180 C60 190 70 190 70 180 L70 90 L80 90 L80 130 C80 135 85 135 85 130 L85 80 C85 70 80 60 70 60 Z" />
                     </svg>
                  </div>
                  
                  {/* Stats */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-medium text-slate-500">
                        <span>Endomorph</span>
                        <span className="text-slate-900">2.1</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-teal-500 w-[21%] rounded-full"></div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-medium text-slate-500">
                        <span>Mesomorph</span>
                        <span className="text-slate-900">4.3</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-teal-600 w-[43%] rounded-full"></div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-medium text-slate-500">
                        <span>Ectomorph</span>
                        <span className="text-slate-900">3.0</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-teal-400 w-[30%] rounded-full"></div>
                      </div>
                    </div>
                    
                    <div className="pt-4 mt-4 border-t border-slate-100">
                       <div className="text-xs text-slate-400 mb-1">Analysis Confidence</div>
                       <div className="text-lg font-bold text-slate-900">98.5%</div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Floating Badge */}
              <div className="hidden sm:flex absolute -bottom-4 -right-4 md:-bottom-6 md:-right-6 bg-white p-3 md:p-4 rounded-xl shadow-xl border border-slate-100 items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center text-teal-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Status</div>
                  <div className="text-sm font-bold text-slate-900">Optimized</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Features Section */}
      <section id="features" className="py-12 sm:py-16 md:py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-10 md:mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mb-3 sm:mb-4">Science-Backed Precision</h2>
            <p className="text-lg text-slate-500">Everything you need to understand your body and reach your peak potential.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {/* Feature 1 */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-teal-50 rounded-xl flex items-center justify-center text-teal-600 mb-4 sm:mb-6">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-3">Precision Scan Analysis</h3>
              <p className="text-slate-500 leading-relaxed">Snap front and side photos for an automated, objective analysis of your body composition and anthropometric measurements.</p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-teal-50 rounded-xl flex items-center justify-center text-teal-600 mb-4 sm:mb-6">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-3">Tailored Diet & Fitness</h3>
              <p className="text-slate-500 leading-relaxed">Receive scientifically-backed meal plans and exercise regimens mapped directly to your somatotype and goals.</p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-teal-50 rounded-xl flex items-center justify-center text-teal-600 mb-4 sm:mb-6">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-3">Intuitive Dashboard</h3>
              <p className="text-slate-500 leading-relaxed">View your current biological profile and daily targets at a glance within a streamlined desktop environment.</p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-teal-50 rounded-xl flex items-center justify-center text-teal-600 mb-4 sm:mb-6">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"></path></svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-3">Progress Tracking</h3>
              <p className="text-slate-500 leading-relaxed">Maintain a complete history of your inputs and changes to monitor how your body composition evolves over time.</p>
            </div>

            {/* Feature 5 */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow md:col-span-2 lg:col-span-2">
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="w-12 h-12 bg-teal-50 rounded-xl flex items-center justify-center text-teal-600 flex-shrink-0">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-slate-900 mb-3">Professional Export</h3>
                  <p className="text-slate-500 leading-relaxed">Instantly generate and export comprehensive PDF reports of your personalized plans to share with your coach or nutritionist.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. How It Works Section */}
      <section id="how-it-works" className="py-12 sm:py-16 md:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 md:mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mb-3 sm:mb-4">How It Works</h2>
            <p className="text-lg text-slate-500">Three simple steps to your personalized roadmap.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 relative">
            {/* Connecting Line (Desktop) */}
            <div className="hidden md:block absolute top-12 left-0 w-full h-0.5 bg-slate-100 -z-10"></div>

            {/* Step 1 */}
            <div className="text-center">
              <div className="w-24 h-24 bg-white border-4 border-teal-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                <span className="text-3xl font-bold text-teal-600">1</span>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-3">Capture</h3>
              <p className="text-slate-500">Take front and side photos with our guided pose validation system.</p>
            </div>

            {/* Step 2 */}
            <div className="text-center">
              <div className="w-24 h-24 bg-white border-4 border-teal-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                <span className="text-3xl font-bold text-teal-600">2</span>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-3">Analyze</h3>
              <p className="text-slate-500">Our Ensemble AI processes your body composition in seconds.</p>
            </div>

            {/* Step 3 */}
            <div className="text-center">
              <div className="w-24 h-24 bg-white border-4 border-teal-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                <span className="text-3xl font-bold text-teal-600">3</span>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-3">Transform</h3>
              <p className="text-slate-500">Get personalized diet, fitness, and tracking tools instantly.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. CTA / Footer Section */}
      <section className="py-16 sm:py-20 md:py-24 bg-slate-900 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6">Ready to decode your body?</h2>
          <p className="text-base sm:text-lg md:text-xl text-slate-400 mb-8 sm:mb-10">Join thousands of users optimizing their health with SomaLens.</p>
          <Link
            to="/register"
            className="inline-flex justify-center items-center px-8 py-4 border border-transparent text-lg font-medium rounded-full text-slate-900 bg-white hover:bg-slate-100 transition-all shadow-lg hover:shadow-white/20"
          >
            Start Your Analysis Today
          </Link>
        </div>
      </section>

      <footer className="bg-white border-t border-slate-100 py-8 sm:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center mb-4 md:mb-0">
            <span className="text-xl font-bold tracking-tight text-slate-900">
              SomaLens<span className="text-teal-600">.</span>
            </span>
          </div>
          <div className="text-slate-500 text-sm">
            &copy; {new Date().getFullYear()} SomaLens. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

export default HomePage;
