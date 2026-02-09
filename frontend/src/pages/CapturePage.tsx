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
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-2xl space-y-8">
                <button onClick={onBack} className="text-white/60 hover:text-white mb-4">← Back</button>
                
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold">Upload Photos</h1>
                    <p className="text-white/60 mt-2">Upload a front and side profile photo.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col items-center text-center">
                        <div className="mb-4 font-bold text-emerald-400 uppercase tracking-widest text-xs">Front Profile</div>
                        {frontPreviewUrl ? (
                            <div className="relative w-full aspect-[3/4] bg-black rounded-lg overflow-hidden mb-4 group">
                                <img src={frontPreviewUrl} alt="Front" className="w-full h-full object-cover" />
                                <button 
                                    onClick={() => { setFrontFile(null); setFrontPreviewUrl(null); }}
                                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                                >
                                    Remove
                                </button>
                            </div>
                        ) : (
                            <label className="w-full aspect-[3/4] bg-white/5 border-2 border-dashed border-white/20 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-white/10 transition-colors mb-4">
                                <span className="text-2xl mb-2">+</span>
                                <span className="text-sm text-white/60">Select Front Photo</span>
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, 'front')} />
                            </label>
                        )}
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col items-center text-center">
                         <div className="mb-4 font-bold text-emerald-400 uppercase tracking-widest text-xs">Side Profile</div>
                        {sidePreviewUrl ? (
                            <div className="relative w-full aspect-[3/4] bg-black rounded-lg overflow-hidden mb-4 group">
                                <img src={sidePreviewUrl} alt="Side" className="w-full h-full object-cover" />
                                <button 
                                    onClick={() => { setSideFile(null); setSidePreviewUrl(null); }}
                                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                                >
                                    Remove
                                </button>
                            </div>
                        ) : (
                            <label className="w-full aspect-[3/4] bg-white/5 border-2 border-dashed border-white/20 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-white/10 transition-colors mb-4">
                                <span className="text-2xl mb-2">+</span>
                                <span className="text-sm text-white/60">Select Side Photo</span>
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, 'side')} />
                            </label>
                        )}
                    </div>
                </div>

                <button 
                    onClick={handleSubmit}
                    disabled={!frontFile || !sideFile}
                    className={`
                        w-full py-4 rounded-xl font-bold transition-all
                        ${frontFile && sideFile 
                            ? 'bg-emerald-500 text-black hover:bg-emerald-400 shadow-lg shadow-emerald-500/20' 
                            : 'bg-white/10 text-white/40 cursor-not-allowed'}
                    `}
                >
                    Analyze Photos
                </button>
            </div>
        </div>
    );
};

const SetupForm = ({ onComplete, onBack }: { onComplete: () => void; onBack?: () => void }) => {
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
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        {onBack && (
          <Link to="/" className="text-white/60 hover:text-white mb-4 inline-block">← Back</Link>
        )}
        <div className="text-center">
          <div className="w-16 h-16 bg-emerald-500 rounded-full mx-auto mb-6 flex items-center justify-center text-2xl">📋</div>
          <h1 className="text-3xl font-bold">Profile Setup</h1>
          <p className="text-white/60 mt-2">Enter your metrics for accurate analysis</p>
        </div>

        {error && (
            <div className="p-4 bg-red-900/30 border border-red-800 text-red-300 rounded-lg text-sm text-center">
                {error}
            </div>
        )}

<form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-white/60 mb-2">Full Name</label>
                    <input 
                        type="text" 
                        required
                        value={displayName}
                        onChange={e => handleNameChange(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-500 focus:outline-none transition-colors"
                        placeholder="John Doe"
                    />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-white/60 mb-2">Age</label>
                        <input 
                            type="number" 
                            required
                            min="10" max="100"
                            value={displayAge}
                            onChange={e => handleAgeChange(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-500 focus:outline-none transition-colors"
                            placeholder="25"
                        />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-white/60 mb-2">Gender</label>
                        <select 
                            value={displayGender}
                            onChange={e => handleGenderChange(e.target.value as 'male' | 'female')}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-500 focus:outline-none transition-colors appearance-none"
                        >
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                        </select>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-white/60 mb-2">Height (cm)</label>
                        <input 
                            type="number" 
                            required
                            min="100" max="250"
                            value={userData.height}
                            onChange={e => setUserData({ height: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-500 focus:outline-none transition-colors"
                            placeholder="175"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-white/60 mb-2">Weight (kg)</label>
                        <input 
                            type="number" 
                            required
                            min="30" max="200"
                            value={userData.weight}
                            onChange={e => setUserData({ weight: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-500 focus:outline-none transition-colors"
                            placeholder="70"
                        />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-white/60 mb-2">What's Your Goal?</label>
                        <select 
                            value={userData.goal}
                            onChange={e => setUserData({ goal: e.target.value as 'weight_loss' | 'weight_gain' | 'maintenance' })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-500 focus:outline-none transition-colors appearance-none"
                        >
                            <option value="weight_loss">Weight Loss</option>
                            <option value="weight_gain">Weight Gain</option>
                            <option value="maintenance">Maintenance</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-white/60 mb-2">Activity Level</label>
                        <select 
                            value={userData.activityLevel}
                            onChange={e => setUserData({ activityLevel: e.target.value as 'sedentary' | 'light' | 'moderate' | 'heavy' })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-500 focus:outline-none transition-colors appearance-none"
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
                        <label className="block text-sm font-medium text-white/60 mb-2">Fitness Level</label>
                        <select 
                            value={userData.exerciseComplexity}
                            onChange={e => setUserData({ exerciseComplexity: e.target.value as 'beginner' | 'intermediate' | 'hard' })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-500 focus:outline-none transition-colors appearance-none"
                        >
                            <option value="beginner">Beginner</option>
                            <option value="intermediate">Intermediate</option>
                            <option value="hard">Advanced</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-white/60 mb-2">Workout Preference</label>
                        <select 
                            value={userData.exerciseType}
                            onChange={e => setUserData({ exerciseType: e.target.value as 'bodyweight' | 'gym' })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-500 focus:outline-none transition-colors appearance-none"
                        >
                            <option value="bodyweight">Bodyweight Only</option>
                            <option value="gym">Gym Equipment</option>
                        </select>
                    </div>
                </div>
            </div>

            <button
                type="submit"
                className="w-full bg-emerald-500 text-black font-bold py-4 rounded-xl hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20"
            >
                Continue
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
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-lg space-y-8">
                <button onClick={onBack} className="text-white/60 hover:text-white mb-4">← Back</button>
                
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold">Choose Method</h1>
                    <p className="text-white/60 mt-2">Select how you want to provide images</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Camera Option */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors">
                        <div className="text-4xl mb-4">📸</div>
                        <h3 className="text-xl font-bold mb-2">Live Camera</h3>
                        <p className="text-sm text-white/60 mb-6">Capture photos using your device camera.</p>
                        
                        {loading ? (
                            <div className="text-sm text-white/40">Loading cameras...</div>
                        ) : (
                            <div className="space-y-4">
                                <select 
                                    value={selectedDevice}
                                    onChange={(e) => setSelectedDevice(e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
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
                                        className="bg-white/10 text-white px-3 py-2 rounded-lg hover:bg-white/20 transition-colors"
                                        title="Refresh Camera List"
                                    >
                                        🔄
                                    </button>
                                    <button 
                                        onClick={() => onCameraSelect(selectedDevice)}
                                        className="flex-1 bg-emerald-500 text-black font-bold py-2 rounded-lg hover:bg-emerald-400"
                                    >
                                        Start Camera
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Upload Option */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors flex flex-col justify-between">
                        <div>
                            <div className="text-4xl mb-4">📁</div>
                            <h3 className="text-xl font-bold mb-2">Upload File</h3>
                            <p className="text-sm text-white/60">Upload existing photos from your device.</p>
                        </div>
                        <button 
                            onClick={onUploadSelect}
                            className="w-full bg-white/10 text-white font-bold py-2 rounded-lg hover:bg-white/20 mt-6"
                        >
                            Upload Photos
                        </button>
                    </div>
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

  // Initialize Camera
  useEffect(() => {
    if (capturePhase !== 'capture' || step === 'preview') return;

    async function startCamera() {
      try {
        const constraints = {
            video: {
                deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
                width: orientation === 'portrait' ? { ideal: 1080 } : { ideal: 1920 },
                height: orientation === 'portrait' ? { ideal: 1920 } : { ideal: 1080 },
                aspectRatio: orientation === 'portrait' ? { ideal: 0.5625 } : { ideal: 1.7777777778 }
            }
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);

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
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [capturePhase, step, selectedDeviceId, orientation]);

  // Pose Detection Loop
  const animate = useCallback(() => {
    if (
      videoRef.current && 
      videoRef.current.readyState >= 2 && 
      isReady && 
      step !== 'preview' &&
      capturePhase === 'capture'
    ) {
      // Determine what to send to MediaPipe
      let inputElement: HTMLVideoElement | HTMLCanvasElement = videoRef.current;
      
      // If rotated, we must draw to an offscreen canvas first so MediaPipe sees the upright image
      if (rotation !== 0) {
          const canvas = document.createElement('canvas');
          // Swap dimensions if 90/270
          if (rotation === 90 || rotation === 270) {
              canvas.width = videoRef.current.videoHeight;
              canvas.height = videoRef.current.videoWidth;
          } else {
              canvas.width = videoRef.current.videoWidth;
              canvas.height = videoRef.current.videoHeight;
          }
          
          const ctx = canvas.getContext('2d');
          if (ctx) {
              ctx.translate(canvas.width / 2, canvas.height / 2);
              ctx.rotate((rotation * Math.PI) / 180);
               if (rotation === 90 || rotation === 270) {
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
        
        // Validate based on current step
        if (step === 'front') {
          setValidationResult(validateFrontPose(landmarks));
        } else if (step === 'side') {
          setValidationResult(validateSidePose(landmarks));
        }
      } else {
        setCurrentLandmarks(null);
        setValidationResult(null);
      }
    }
    requestRef.current = requestAnimationFrame(animate);
  }, [isReady, step, capturePhase, detectPose, validateFrontPose, validateSidePose]);

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

  // Capture Logic with Countdown
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
      <div className="min-h-screen bg-black text-white">
        <header className="fixed top-0 left-0 right-0 bg-black/50 backdrop-blur-md z-50 border-b border-white/10">
            <div className="container mx-auto px-6 h-16 flex items-center justify-between">
                <Link to="/" className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                    <div className="w-3 h-3 bg-emerald-500 rounded-full" />
                    SomaLens
                </Link>
                <div className="text-xs font-bold uppercase tracking-widest text-white/50">
                    Review Mode
                </div>
            </div>
        </header>
        <div className="pt-20 h-screen">
            <CapturePreview />
        </div>
      </div>
    );
  }

  if (capturePhase === 'setup') {
      return <SetupForm onComplete={() => setCapturePhase('method')} onBack={() => {}} />;
  }

  if (capturePhase === 'method') {
      return (
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

  // Camera Capture UI (Reuse existing UI)
  return (
    <div className="h-screen bg-black text-white flex flex-col overflow-hidden">
      <header className="fixed top-0 left-0 right-0 z-50 px-6 py-6 flex justify-between items-start pointer-events-none">
        <Link to="/" className="pointer-events-auto text-xl font-bold tracking-tight text-white flex items-center gap-2 drop-shadow-md">
           <div className="w-3 h-3 bg-emerald-500 rounded-full" />
           SomaLens
        </Link>
        
        <div className="flex flex-col items-end gap-2">
            <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-full px-4 py-1.5 flex items-center gap-3 shadow-xl">
                <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${step === 'front' ? 'bg-emerald-500 animate-pulse' : 'bg-white/20'}`} />
                    <span className={`text-xs font-bold uppercase tracking-widest ${step === 'front' ? 'text-white' : 'text-white/40'}`}>Front</span>
                </div>
                <div className="w-px h-3 bg-white/20" />
                <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${step === 'side' ? 'bg-emerald-500 animate-pulse' : 'bg-white/20'}`} />
                    <span className={`text-xs font-bold uppercase tracking-widest ${step === 'side' ? 'text-white' : 'text-white/40'}`}>Side</span>
                </div>
            </div>
             {/* Rotate Button */}
            <button 
                onClick={handleRotate}
                className="pointer-events-auto flex items-center gap-2 text-xs text-white/80 hover:text-white bg-black/40 px-4 py-2 rounded-full backdrop-blur-md transition-colors"
            >
                <span>🔄</span> Rotate
            </button>
            <button 
                onClick={toggleOrientation}
                className="pointer-events-auto flex items-center gap-2 text-xs text-white/80 hover:text-white bg-black/40 px-4 py-2 rounded-full backdrop-blur-md transition-colors"
            >
                <span>↔️</span> {orientation === 'portrait' ? 'Landscape' : 'Portrait'}
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
            className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1]"
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
                        <div className="w-16 h-16 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
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

export default CapturePage;