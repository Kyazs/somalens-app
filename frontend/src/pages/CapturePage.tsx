import { useRef, useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { usePoseLandmarker } from '../hooks/usePoseLandmarker';
import { usePoseValidation } from '../hooks/usePoseValidation';
import { useImageCapture } from '../hooks/useImageCapture';
import { useCaptureStore } from '../stores/captureStore';
import { useAuth } from '../context/AuthContext';
import PoseGuide from '../components/PoseGuide';
import { CapturePreview } from '../components/CapturePreview';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { ValidationResult } from '../types/pose';

// --- Icons ---
const Icons = {
  Back: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>,
  Check: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>,
  ChevronRight: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>,
  Camera: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>,
  Upload: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>,
  Refresh: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>,
  Rotate: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>,
  Orientation: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6.364 6.364 0 0 0 9 9 9 9 0 1 1-9-9Z"></path></svg>,
  Plus: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
};

// --- Helper Components ---

const SimpleNav = () => (
  <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="h-16 flex items-center justify-between">
        <Link to="/dashboard" className="text-xl font-bold tracking-tight text-slate-900">
          SomaLens<span className="text-teal-600">.</span>
        </Link>
        <Link to="/dashboard" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1">
          <Icons.Back />
          Back to Dashboard
        </Link>
      </div>
    </div>
  </nav>
);

const StepIndicator = ({ currentPhase }: { currentPhase: 'setup' | 'method' }) => {
  const steps = [
    { id: 1, label: 'Details', status: currentPhase === 'setup' ? 'active' : 'completed' },
    { id: 2, label: 'Method', status: currentPhase === 'setup' ? 'inactive' : 'active' },
    { id: 3, label: 'Capture', status: 'inactive' },
  ];

  return (
    <div className="max-w-md mx-auto mb-8">
      <div className="flex items-center justify-between relative">
        {/* Connecting lines */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-slate-200 -z-10" />
        
        {steps.map((step) => (
          <div key={step.id} className="flex flex-col items-center bg-slate-50 px-2">
            <div className={`
              w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors duration-300
              ${step.status === 'completed' ? 'bg-teal-500 text-white' : 
                step.status === 'active' ? 'bg-teal-600 text-white' : 
                'bg-slate-200 text-slate-400'}
            `}>
              {step.status === 'completed' ? <Icons.Check /> : step.id}
            </div>
            <span className={`
              text-xs font-medium mt-2 transition-colors duration-300
              ${step.status === 'active' ? 'text-slate-900' : 'text-slate-500'}
            `}>
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- Subcomponents for Phases ---

const UploadInterface = ({ onBack, onComplete }: { onBack: () => void, onComplete: () => void }) => {
    const { setFrontImage, setSideImage, goToPreview } = useCaptureStore();
    const [frontFile, setFrontFile] = useState<File | null>(null);
    const [sideFile, setSideFile] = useState<File | null>(null);
    const [frontPreviewUrl, setFrontPreviewUrl] = useState<string | null>(null);
    const [sidePreviewUrl, setSidePreviewUrl] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'front' | 'side') => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const url = URL.createObjectURL(file);
            if (type === 'front') {
                setFrontFile(file);
                setFrontPreviewUrl(url);
            } else {
                setSideFile(file);
                setSidePreviewUrl(url);
            }
        }
    };

    const handleSubmit = () => {
        if (frontFile && sideFile && frontPreviewUrl && sidePreviewUrl) {
            setFrontImage(frontFile, frontPreviewUrl);
            setSideImage(sideFile, sidePreviewUrl);
            goToPreview();
            onComplete();
        }
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <SimpleNav />
            <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
                <button onClick={onBack} className="text-slate-500 hover:text-slate-900 mb-6 flex items-center gap-1 text-sm font-medium">
                    <Icons.Back /> Back
                </button>
                
                <div className="text-center mb-8">
                    <h1 className="text-xl font-semibold text-slate-900">Upload Photos</h1>
                    <p className="text-slate-500 text-sm mt-1">Upload a front and side profile photo.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col items-center text-center">
                        <div className="mb-4 font-semibold text-teal-600 uppercase tracking-widest text-xs">Front Profile</div>
                        {frontPreviewUrl ? (
                            <div className="relative w-full aspect-[3/4] bg-slate-100 rounded-lg overflow-hidden mb-4 group">
                                <img src={frontPreviewUrl} alt="Front" className="w-full h-full object-cover" />
                                <button 
                                    onClick={() => { setFrontFile(null); setFrontPreviewUrl(null); }}
                                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white font-medium"
                                >
                                    Remove
                                </button>
                            </div>
                        ) : (
                            <label className="w-full aspect-[3/4] bg-slate-50 border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 hover:border-teal-300 transition-all mb-4">
                                <span className="text-slate-400 mb-2"><Icons.Plus /></span>
                                <span className="text-sm text-slate-500">Select Front Photo</span>
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, 'front')} />
                            </label>
                        )}
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col items-center text-center">
                         <div className="mb-4 font-semibold text-teal-600 uppercase tracking-widest text-xs">Side Profile</div>
                        {sidePreviewUrl ? (
                            <div className="relative w-full aspect-[3/4] bg-slate-100 rounded-lg overflow-hidden mb-4 group">
                                <img src={sidePreviewUrl} alt="Side" className="w-full h-full object-cover" />
                                <button 
                                    onClick={() => { setSideFile(null); setSidePreviewUrl(null); }}
                                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white font-medium"
                                >
                                    Remove
                                </button>
                            </div>
                        ) : (
                            <label className="w-full aspect-[3/4] bg-slate-50 border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 hover:border-teal-300 transition-all mb-4">
                                <span className="text-slate-400 mb-2"><Icons.Plus /></span>
                                <span className="text-sm text-slate-500">Select Side Photo</span>
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, 'side')} />
                            </label>
                        )}
                    </div>
                </div>

                <button 
                    onClick={handleSubmit}
                    disabled={!frontFile || !sideFile}
                    className={`
                        w-full py-4 rounded-xl font-medium transition-all shadow-sm
                        ${frontFile && sideFile 
                            ? 'bg-teal-600 text-white hover:bg-teal-700' 
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'}
                    `}
                >
                    Analyze Photos
                </button>
            </div>
        </div>
    );
};

const SetupForm = ({ onComplete }: { onComplete: () => void }) => {
  const { userData, setUserData } = useCaptureStore();
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  
  // Track which fields user has touched - once touched, don't use fallback
  const [touched, setTouched] = useState({ name: false, age: false, gender: false });

  // Display values: use userData if touched, otherwise fallback to user profile
  const displayName = touched.name ? userData.name : (userData.name || user?.name || '');
  const displayAge = touched.age ? userData.age : (userData.age || user?.age?.toString() || '');
  const displayGender = touched.gender ? userData.gender : (userData.gender || (user?.gender === 'male' || user?.gender === 'female' ? user.gender : 'male'));

  const handleNameChange = (value: string) => {
    setTouched(prev => ({ ...prev, name: true }));
    setUserData({ name: value });
  };

  const handleAgeChange = (value: string) => {
    setTouched(prev => ({ ...prev, age: true }));
    setUserData({ age: value });
  };

  const handleGenderChange = (value: 'male' | 'female') => {
    setTouched(prev => ({ ...prev, gender: true }));
    setUserData({ gender: value });
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Save display values to store before validation
    setUserData({ name: displayName, age: displayAge, gender: displayGender });
    
    if (!displayName) {
      setError("Name is required");
      return;
    }
    
    const age = parseInt(displayAge);
    const height = parseInt(userData.height);
    const weight = parseInt(userData.weight);

    if (isNaN(age) || age < 10 || age > 100) {
      setError("Age must be between 10 and 100 years");
      return;
    }
    if (isNaN(height) || height < 100 || height > 250) {
      setError("Height must be between 100 and 250 cm");
      return;
    }
    if (isNaN(weight) || weight < 30 || weight > 200) {
      setError("Weight must be between 30 and 200 kg");
      return;
    }
    
    setError(null);
    onComplete();
  };

  return (
    <div className="w-full">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 sm:p-8">
        <div className="text-center mb-8">
          <h1 className="text-xl font-semibold text-slate-900">Profile Setup</h1>
          <p className="text-slate-500 text-sm mt-1">Enter your metrics for accurate analysis</p>
        </div>

        {error && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-sm text-center">
                {error}
            </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Full Name</label>
                    <input 
                        type="text" 
                        required
                        value={displayName}
                        onChange={e => handleNameChange(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all"
                        placeholder="John Doe"
                    />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Age</label>
                        <input 
                            type="number" 
                            required
                            min="10" max="100"
                            value={displayAge}
                            onChange={e => handleAgeChange(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all"
                            placeholder="25"
                        />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Gender</label>
                        <select 
                            value={displayGender}
                            onChange={e => handleGenderChange(e.target.value as 'male' | 'female')}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all"
                        >
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                        </select>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Height (cm)</label>
                        <input 
                            type="number" 
                            required
                            min="100" max="250"
                            value={userData.height}
                            onChange={e => setUserData({ height: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all"
                            placeholder="175"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Weight (kg)</label>
                        <input 
                            type="number" 
                            required
                            min="30" max="200"
                            value={userData.weight}
                            onChange={e => setUserData({ weight: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all"
                            placeholder="70"
                        />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">What's Your Goal?</label>
                        <select 
                            value={userData.goal}
                            onChange={e => setUserData({ goal: e.target.value as 'weight_loss' | 'weight_gain' | 'maintenance' })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all"
                        >
                            <option value="weight_loss">Weight Loss</option>
                            <option value="weight_gain">Weight Gain</option>
                            <option value="maintenance">Maintenance</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Activity Level</label>
                        <select 
                            value={userData.activityLevel}
                            onChange={e => setUserData({ activityLevel: e.target.value as 'sedentary' | 'light' | 'moderate' | 'heavy' })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all"
                        >
                            <option value="sedentary">Sedentary</option>
                            <option value="light">Lightly Active</option>
                            <option value="moderate">Moderately Active</option>
                            <option value="heavy">Very Active</option>
                        </select>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Fitness Level</label>
                        <select 
                            value={userData.exerciseComplexity}
                            onChange={e => setUserData({ exerciseComplexity: e.target.value as 'beginner' | 'intermediate' | 'hard' })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all"
                        >
                            <option value="beginner">Beginner</option>
                            <option value="intermediate">Intermediate</option>
                            <option value="hard">Advanced</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Workout Preference</label>
                        <select 
                            value={userData.exerciseType}
                            onChange={e => setUserData({ exerciseType: e.target.value as 'bodyweight' | 'gym' })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all"
                        >
                            <option value="bodyweight">Bodyweight Only</option>
                            <option value="gym">Gym Equipment</option>
                        </select>
                    </div>
                </div>
            </div>

            <button
                type="submit"
                className="w-full bg-teal-600 text-white font-medium py-3 rounded-xl hover:bg-teal-700 transition-colors shadow-sm flex items-center justify-center gap-2"
            >
                Next <Icons.ChevronRight />
            </button>
        </form>
      </div>
    </div>
  );
};

const MethodSelection = ({ 
    onCameraSelect, 
    onUploadSelect,
    onBack 
}: { 
    onCameraSelect: (deviceId: string) => void;
    onUploadSelect: () => void;
    onBack: () => void;
}) => {
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDevice, setSelectedDevice] = useState<string>('');
    const [loading, setLoading] = useState(true);

    const loadDevices = useCallback(async () => {
        setLoading(true);
        try {
            await navigator.mediaDevices.getUserMedia({ video: true });
            
            const devs = await navigator.mediaDevices.enumerateDevices();

            const videoDevs = devs.filter(d => d.kind === 'videoinput');
            console.log("Devices found:", videoDevs);
            
            setDevices(videoDevs);
            if (videoDevs.length > 0 && !selectedDevice) {
                setSelectedDevice(videoDevs[0].deviceId);
            }
        } catch (err) {
            console.error("Error loading devices:", err);
        } finally {
            setLoading(false);
        }
    }, [selectedDevice]);

    useEffect(() => {
        loadDevices();
        
        const handleDeviceChange = () => {
            console.log("Device change detected");
            loadDevices();
        };

        navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
        return () => navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    }, [loadDevices]);

    return (
        <div className="w-full">
            <div className="space-y-8">
                <div className="text-center mb-8">
                    <h1 className="text-xl font-semibold text-slate-900">Choose Method</h1>
                    <p className="text-slate-500 text-sm mt-1">Select how you want to provide images</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Camera Option */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 hover:shadow-md hover:border-teal-200 transition-all">
                        <div className="text-teal-600 mb-4"><Icons.Camera /></div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-2">Live Camera</h3>
                        <p className="text-sm text-slate-500 mb-6">Capture photos using your device camera.</p>
                        
                        {loading ? (
                            <div className="text-sm text-slate-400">Loading cameras...</div>
                        ) : (
                            <div className="space-y-4">
                                <select 
                                    value={selectedDevice}
                                    onChange={(e) => setSelectedDevice(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                                >
                                    {devices.map(d => (
                                        <option key={d.deviceId} value={d.deviceId}>
                                            {d.label || `Camera ${devices.indexOf(d) + 1} (${d.deviceId.slice(0, 5)}...)`}
                                        </option>
                                    ))}
                                </select>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={loadDevices}
                                        className="bg-slate-100 text-slate-600 px-3 py-2 rounded-lg hover:bg-slate-200 transition-colors"
                                        title="Refresh Camera List"
                                    >
                                        <Icons.Refresh />
                                    </button>
                                    <button 
                                        onClick={() => onCameraSelect(selectedDevice)}
                                        className="flex-1 bg-teal-600 text-white font-medium py-2 rounded-lg hover:bg-teal-700 transition-colors"
                                    >
                                        Start Camera
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Upload Option */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 hover:shadow-md hover:border-teal-200 transition-all flex flex-col justify-between">
                        <div>
                            <div className="text-teal-600 mb-4"><Icons.Upload /></div>
                            <h3 className="text-lg font-semibold text-slate-900 mb-2">Upload File</h3>
                            <p className="text-sm text-slate-500">Upload existing photos from your device.</p>
                        </div>
                        <button 
                            onClick={onUploadSelect}
                            className="w-full bg-slate-100 text-slate-700 font-medium py-2 rounded-lg hover:bg-slate-200 mt-6 transition-colors"
                        >
                            Upload Photos
                        </button>
                    </div>
                </div>

                <div className="flex justify-center">
                    <button onClick={onBack} className="text-slate-500 hover:text-slate-900 font-medium text-sm flex items-center gap-1">
                        <Icons.Back /> Back
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Main Component ---

export function CapturePage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const requestRef = useRef<number | null>(null);
  const [hasCamera, setHasCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturePhase, setCapturePhase] = useState<'setup' | 'method' | 'capture' | 'upload'>('setup');
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [rotation, setRotation] = useState(0);

  // State for current frame analysis
  const [currentLandmarks, setCurrentLandmarks] = useState<NormalizedLandmark[] | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  
  // UX State
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);

  // Hooks
  const { isLoading: mediapipeLoading, error: mediapipeError, isReady, detectPose } = usePoseLandmarker();
  const { validateFrontPose, validateSidePose } = usePoseValidation();
  const { captureFrame, createPreview } = useImageCapture();
  const { 
    step, 
    setFrontImage, 
    setSideImage, 
    goToSideCapture, 
    goToPreview,
    reset // Added reset
  } = useCaptureStore();

  // Reset store on mount if clean start
  useEffect(() => {
     reset();
  }, [reset]);

  // Keep stream in a ref so it persists across step changes
  const streamRef = useRef<MediaStream | null>(null);

  // Initialize Camera — only depends on capturePhase, deviceId, and orientation.
  // step is intentionally excluded so the camera doesn't restart when switching front→side.
  useEffect(() => {
    if (capturePhase !== 'capture') return;

    async function startCamera() {
      try {
        const constraints = {
            video: {
                deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
                width: orientation === 'portrait' ? { ideal: 1080 } : { ideal: 1920 },
                height: orientation === 'portrait' ? { ideal: 1920 } : { ideal: 1080 },
                aspectRatio: orientation === 'portrait' ? { ideal: 0.5625 } : { ideal: 1.7777777778 },
                // @ts-ignore - zoom is not in standard types yet but supported in Chrome
                advanced: [{ zoom: 1 } as any]
            }
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            setHasCamera(true);
            videoRef.current?.play();
          };
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to access camera';
        setCameraError(message);
      }
    }

    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [capturePhase, selectedDeviceId, orientation]);

  // Reattach stream to video element after retake (when video element re-mounts from preview)
  useEffect(() => {
    if (step === 'preview') return;
    if (capturePhase !== 'capture') return;
    if (!streamRef.current) return;
    
    // If video element exists but has no stream, reattach
    if (videoRef.current && !videoRef.current.srcObject) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.onloadedmetadata = () => {
        setHasCamera(true);
        videoRef.current?.play();
      };
    }
  }, [step, capturePhase]);

  // Use refs for values that animate needs to always read fresh
  const stepRef = useRef(step);
  stepRef.current = step;
  const rotationRef = useRef(rotation);
  rotationRef.current = rotation;

  // Reset validation state when step changes so old results don't carry over
  useEffect(() => {
    setValidationResult(null);
    setCurrentLandmarks(null);
    setCountdown(null);
  }, [step]);

  // Pose Detection Loop
  const animate = useCallback(() => {
    const currentStep = stepRef.current;
    const currentRotation = rotationRef.current;

    if (
      videoRef.current && 
      videoRef.current.readyState >= 2 && 
      isReady && 
      currentStep !== 'preview' &&
      capturePhase === 'capture'
    ) {
      // Determine what to send to MediaPipe
      let inputElement: HTMLVideoElement | HTMLCanvasElement = videoRef.current;
      
      // If rotated, we must draw to an offscreen canvas first so MediaPipe sees the upright image
      if (currentRotation !== 0) {
          const canvas = document.createElement('canvas');
          // Swap dimensions if 90/270
          if (currentRotation === 90 || currentRotation === 270) {
              canvas.width = videoRef.current.videoHeight;
              canvas.height = videoRef.current.videoWidth;
          } else {
              canvas.width = videoRef.current.videoWidth;
              canvas.height = videoRef.current.videoHeight;
          }
          
          const ctx = canvas.getContext('2d');
          if (ctx) {
              ctx.translate(canvas.width / 2, canvas.height / 2);
              ctx.rotate((currentRotation * Math.PI) / 180);
               if (currentRotation === 90 || currentRotation === 270) {
                  ctx.drawImage(videoRef.current, -videoRef.current.videoWidth / 2, -videoRef.current.videoHeight / 2);
               } else {
                  ctx.drawImage(videoRef.current, -videoRef.current.videoWidth / 2, -videoRef.current.videoHeight / 2);
               }
               inputElement = canvas;
          }
      }

      const result = detectPose(inputElement, performance.now());
      
      if (result && result.landmarks && result.landmarks.length > 0) {
        const landmarks = result.landmarks[0];
        setCurrentLandmarks(landmarks);
        
        // Validate based on current step (read from ref for freshness)
        if (currentStep === 'front') {
          setValidationResult(validateFrontPose(landmarks));
        } else if (currentStep === 'side') {
          setValidationResult(validateSidePose(landmarks));
        }
      } else {
        setCurrentLandmarks(null);
        setValidationResult(null);
      }
    }
    requestRef.current = requestAnimationFrame(animate);
  }, [isReady, capturePhase, detectPose, validateFrontPose, validateSidePose]);

  useEffect(() => {
    if (capturePhase === 'capture') {
        requestRef.current = requestAnimationFrame(animate);
    }
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [animate, capturePhase]);

  useEffect(() => {
    if (!validationResult?.isValid || countdown !== null || isFlashing) {
      return;
    }

    const stabilityTimer = setTimeout(() => {
        setCountdown(3);
    }, 3000);

    return () => clearTimeout(stabilityTimer);
  }, [validationResult?.isValid, countdown, isFlashing]);

  const handleCaptureClick = () => {
    if (!videoRef.current || !validationResult?.isValid || countdown !== null) return;
    setCountdown(3);
  };

  const handleRotate = () => {
      setRotation(prev => (prev + 90) % 360);
  };

  const toggleOrientation = () => {
      setOrientation(prev => prev === 'portrait' ? 'landscape' : 'portrait');
  };

  useEffect(() => {
    if (countdown === null) return;

    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown((c) => c! - 1), 1000);
      return () => clearTimeout(timer);
    }

    if (countdown === 0) {
      const performCapture = async () => {
        if (!videoRef.current) return;
        
        setIsFlashing(true);
        setTimeout(() => setIsFlashing(false), 150);

        try {
          const blob = await captureFrame(videoRef.current, rotation);
          const previewUrl = createPreview(blob);

          // Small delay to let flash finish visually before switching steps
          setTimeout(() => {
            if (step === 'front') {
              setFrontImage(blob, previewUrl);
              goToSideCapture();
            } else if (step === 'side') {
              setSideImage(blob, previewUrl);
              goToPreview();
            }
            setCountdown(null);
          }, 300);
          
        } catch (err) {
          console.error('Capture failed:', err);
          setCountdown(null);
        }
      };
      performCapture();
    }
  }, [countdown, captureFrame, createPreview, step, goToSideCapture, goToPreview, setFrontImage, setSideImage]);


  // --- Render Phases ---

  if (step === 'preview') {
    return (
      <div className="min-h-screen bg-slate-50">
        <SimpleNav />
        <div className="pt-8 h-screen">
            <CapturePreview />
        </div>
      </div>
    );
  }

  if (capturePhase === 'capture') {
      // Camera Capture UI (Reuse existing UI with teal accents)
      return (
        <div className="h-screen bg-black text-white flex flex-col overflow-hidden">
          <header className="fixed top-0 left-0 right-0 z-50 px-6 py-6 flex justify-between items-start pointer-events-none">
            <Link to="/dashboard" className="pointer-events-auto text-xl font-bold tracking-tight text-white flex items-center gap-2 drop-shadow-md">
               <div className="w-3 h-3 bg-teal-500 rounded-full" />
               SomaLens
            </Link>
            
            <div className="flex flex-col items-end gap-2">
                <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-full px-4 py-1.5 flex items-center gap-3 shadow-xl">
                    <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${step === 'front' ? 'bg-teal-500 animate-pulse' : 'bg-white/20'}`} />
                        <span className={`text-xs font-bold uppercase tracking-widest ${step === 'front' ? 'text-white' : 'text-white/40'}`}>Front</span>
                    </div>
                    <div className="w-px h-3 bg-white/20" />
                    <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${step === 'side' ? 'bg-teal-500 animate-pulse' : 'bg-white/20'}`} />
                        <span className={`text-xs font-bold uppercase tracking-widest ${step === 'side' ? 'text-white' : 'text-white/40'}`}>Side</span>
                    </div>
                </div>
                 {/* Rotate Button */}
                <button 
                    onClick={handleRotate}
                    className="pointer-events-auto flex items-center gap-2 text-xs text-white/80 hover:text-white bg-black/40 px-4 py-2 rounded-full backdrop-blur-md transition-colors"
                >
                    <Icons.Rotate /> Rotate
                </button>
                <button 
                    onClick={toggleOrientation}
                    className="hidden md:flex pointer-events-auto items-center gap-2 text-xs text-white/80 hover:text-white bg-black/40 px-4 py-2 rounded-full backdrop-blur-md transition-colors"
                >
                    <Icons.Orientation /> {orientation === 'portrait' ? 'Landscape' : 'Portrait'}
                </button>
                {/* Added: Back Button to Method Selection */}
                <button 
                    onClick={() => setCapturePhase('method')}
                    className="pointer-events-auto text-xs text-white/60 hover:text-white bg-black/20 px-3 py-1 rounded-full backdrop-blur-md"
                >
                    Change Method
                </button>
            </div>
          </header>
    
          <main className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
            <div 
                className={`absolute inset-0 bg-white z-[60] pointer-events-none transition-opacity duration-150 ease-out ${isFlashing ? 'opacity-100' : 'opacity-0'}`} 
            />
    
            {/* Video Container to handle rotation/scaling cleanly */}
            <div 
                className="relative transition-transform duration-300 ease-out"
                style={{
                    width: '100%',
                    height: '100%',
                    transform: `rotate(${rotation}deg)`
                }}
            >
                <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-contain transform scale-x-[-1]"
                />
            </div>
    
            {countdown !== null && countdown > 0 && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
                    <div className="text-[12rem] font-black text-white drop-shadow-[0_0_50px_rgba(255,255,255,0.5)] animate-bounce">
                        {countdown}
                    </div>
                </div>
            )}
    
            <div className={`transition-opacity duration-500 ${countdown !== null ? 'opacity-0' : 'opacity-100'}`}>
                 <PoseGuide 
                    landmarks={currentLandmarks}
                    validationResult={validationResult}
                    poseType={step}
                 />
            </div>

            {/* Hold Still Indicator */}
            <div className="absolute inset-x-0 top-1/4 z-50 pointer-events-none flex justify-center">
                {validationResult?.isValid && countdown === null && !isFlashing && (
                    <div className="bg-teal-500/90 text-white px-6 py-2 rounded-full font-bold animate-pulse text-lg shadow-lg backdrop-blur-sm transition-all transform scale-100">
                        Hold Still...
                    </div>
                )}
            </div>
    
            {(cameraError || mediapipeError || mediapipeLoading || !isReady || !hasCamera) && (
              <div className="absolute inset-0 flex items-center justify-center bg-black z-40">
                 <div className="flex flex-col items-center gap-6 p-8">
                     {cameraError || mediapipeError ? (
                         <>
                            <div className="w-16 h-16 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center text-3xl mb-2">!</div>
                            <p className="text-xl font-bold text-rose-400">{cameraError || mediapipeError}</p>
                         </>
                     ) : (
                        <>
                            <div className="w-16 h-16 border-4 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" />
                            <div className="text-center">
                                <p className="text-lg font-bold tracking-tight mb-1">Initializing System</p>
                                <p className="text-sm text-white/40 uppercase tracking-widest">Loading Neural Networks</p>
                            </div>
                        </>
                     )}
                 </div>
              </div>
            )}
    
            <div className="absolute bottom-0 left-0 right-0 p-8 pb-12 bg-gradient-to-t from-black via-black/60 to-transparent z-30 flex flex-col items-center">
                 <div className="mb-8 text-center space-y-2">
                     <h2 className="text-3xl font-bold tracking-tight drop-shadow-lg">
                        {step === 'front' ? 'Frontal Scan' : 'Profile Scan'}
                     </h2>
                     <p className="text-white/60 font-medium drop-shadow-md max-w-sm mx-auto">
                        {step === 'front' 
                          ? 'Align your body within the frame. Keep arms relaxed.' 
                          : 'Turn 90 degrees. Ensure your full profile is visible.'}
                     </p>
                 </div>
    
                 <button
                   onClick={handleCaptureClick}
                   disabled={!validationResult?.isValid || countdown !== null}
                   className={`
                     group relative w-24 h-24 rounded-full border border-white/20 flex items-center justify-center transition-all duration-300
                     ${validationResult?.isValid 
                       ? 'bg-white/10 hover:bg-white/20 scale-100 cursor-pointer shadow-[0_0_40px_rgba(255,255,255,0.1)]' 
                       : 'bg-black/50 opacity-50 scale-95 cursor-not-allowed'}
                   `}
                 >
                    {validationResult?.isValid && (
                        <div className="absolute inset-0 rounded-full border border-white/50 animate-ping opacity-20" />
                    )}
                    
                    <div className={`
                        w-16 h-16 rounded-full transition-all duration-300 shadow-lg
                        ${validationResult?.isValid 
                            ? 'bg-white scale-100 group-hover:scale-95' 
                            : 'bg-white/20 scale-90'}
                    `} />
                 </button>
            </div>
          </main>
        </div>
      );
  }

  if (capturePhase === 'upload') {
      return (
          <UploadInterface 
              onBack={() => setCapturePhase('method')}
              onComplete={() => {}}
          />
      );
  }

  // Setup and Method phases - slider within white layout
  return (
    <div className="min-h-screen bg-slate-50">
      <SimpleNav />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <StepIndicator currentPhase={capturePhase as 'setup' | 'method'} />
        
        <div className="overflow-hidden">
          <div 
            className="flex transition-transform duration-500 ease-in-out"
            style={{ transform: `translateX(-${capturePhase === 'method' ? 100 : 0}%)` }}
          >
            {/* Panel 1: SetupForm - width: 100% */}
            <div className="w-full flex-shrink-0 px-px">
              <SetupForm onComplete={() => setCapturePhase('method')} />
            </div>
            {/* Panel 2: MethodSelection - width: 100% */}
            <div className="w-full flex-shrink-0 px-px">
              <MethodSelection 
                  onCameraSelect={(deviceId) => {
                      setSelectedDeviceId(deviceId);
                      setCapturePhase('capture');
                  }}
                  onUploadSelect={() => {
                      setCapturePhase('upload');
                  }}
                  onBack={() => setCapturePhase('setup')}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default CapturePage;
