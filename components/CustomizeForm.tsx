
import React, { useRef, useState, useEffect } from 'react';
import { Icons } from '../constants';
import { MemeTemplate, MemeTone, MemeData } from '../types';
import { geminiService, GenerationStrategy } from '../services/gemini';

interface CustomizeFormProps {
  template: MemeTemplate;
  initialData?: MemeData;
  generationError?: string | null;
  onGenerate: (photo: string, name: string, tone: MemeTone) => void;
  onBack: () => void;
}

type WizardStep = 'casting' | 'setup';

const TONES: MemeTone[] = ['Funny', 'Funnier'];

const CustomizeForm: React.FC<CustomizeFormProps> = ({ template, initialData, generationError, onGenerate, onBack }) => {
  const [wizardStep, setWizardStep] = useState<WizardStep>(
    initialData?.userPhoto ? 'setup' : 'casting'
  );
  
  const [preview, setPreview] = useState<string | null>(initialData?.userPhoto || null);
  
  // Text State
  const [name, setName] = useState(initialData?.userName || '');
  const [tone, setTone] = useState<MemeTone>(initialData?.tone || 'Funny');
  
  // Validation & Error
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(generationError || null);
  
  // Camera State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (generationError) setError(generationError);
  }, [generationError]);

  // Clean up camera on unmount
  useEffect(() => {
    return () => stopCamera();
  }, []);

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
  };

  const startCamera = async () => {
    try {
      setIsCameraOpen(true);
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error(err);
      setError("Could not access camera. Please upload a file instead.");
      setIsCameraOpen(false);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const base64 = canvas.toDataURL('image/jpeg');
        processPhoto(base64);
        stopCamera();
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        processPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const processPhoto = async (base64: string) => {
    setPreview(base64);
    setError(null);
    setIsValidating(true);
    
    const { valid, message } = await geminiService.validatePhoto(base64);
    if (!valid) {
      setError(message);
    }
    setIsValidating(false);
  };

  const onGenerateClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    setError(null);
    
    if (preview) {
        if (!name.trim()) {
            setError("Lead Actor name is required.");
            return;
        }
        onGenerate(preview, name, tone);
    } else {
        alert("Please upload a photo first!");
        setWizardStep('casting');
    }
  };

  const isPhotoValid = !!preview; 
  const isTextValid = name.trim().length >= 2;

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <div className="flex justify-between items-center mb-8">
        <button 
          onClick={wizardStep === 'setup' ? () => setWizardStep('casting') : onBack}
          className="text-white/40 hover:text-white transition-colors uppercase font-bold text-sm flex items-center gap-2 group"
        >
          <span className="group-hover:-translate-x-1 transition-transform">←</span> {wizardStep === 'setup' ? 'BACK TO PHOTO' : 'BACK TO POSTERS'}
        </button>

        <div className="flex items-center gap-2">
          <div className={`h-2 w-12 rounded-full transition-colors ${wizardStep === 'casting' ? 'bg-yellow-500' : 'bg-yellow-500/30'}`} />
          <div className={`h-2 w-12 rounded-full transition-colors ${wizardStep === 'setup' ? 'bg-yellow-500' : 'bg-white/10'}`} />
        </div>
      </div>

      <div className="flex flex-col-reverse lg:flex-row-reverse gap-8 lg:gap-12 items-start">
        {/* Preview Column */}
        <div className="w-full lg:w-1/4">
          <div className="sticky top-8 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-yellow-500/80">
              REF POSTER
            </h3>

            {/* Selected Thumbnail Card */}
            <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-lg group bg-white/5 w-48 aspect-[2/3] mx-auto transition-all">
              <img 
                src={template.coverImage} 
                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" 
                alt={template.title}
                referrerPolicy="no-referrer"
              />
              {preview && (
                 <img src={preview} className="absolute bottom-2 right-2 w-10 h-10 rounded-lg border border-yellow-500 object-cover shadow-xl z-10" />
              )}
            </div>
          </div>
        </div>

        {/* Form Column */}
        <div className="w-full lg:w-3/4 space-y-10 bg-white/[0.03] border border-white/10 rounded-[2.5rem] p-6 lg:p-10 backdrop-blur-xl shadow-2xl">
          
          {wizardStep === 'casting' && (
            <div className="space-y-8 animate-fadeIn">
              <header>
                <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-yellow-500/80">1. CASTING CALL</h3>
                </div>
                <h2 className="text-3xl lg:text-4xl font-oswald font-bold uppercase tracking-tight mb-2">Upload <span className="text-yellow-500">Headshot</span></h2>
                <p className="text-white/40 font-medium text-sm">Take a photo or upload a file. Look directly at the camera.</p>
              </header>

              <div>
                {isCameraOpen ? (
                  <div className="relative border-2 border-white/10 rounded-[2rem] aspect-video overflow-hidden bg-black">
                     <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                     <button 
                        onClick={capturePhoto}
                        className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white text-black w-16 h-16 rounded-full border-4 border-yellow-500 hover:scale-110 transition-transform"
                     />
                     <button onClick={stopCamera} className="absolute top-4 right-4 bg-black/50 text-white px-3 py-1 rounded-full text-xs hover:bg-red-500">
                        CANCEL
                     </button>
                  </div>
                ) : (
                  <div className="flex gap-4">
                     <div 
                        onClick={() => fileInputRef.current?.click()}
                        className={`flex-1 relative border-2 border-dashed rounded-[2rem] aspect-square sm:aspect-video flex flex-col items-center justify-center gap-4 cursor-pointer transition-all overflow-hidden group
                          ${error ? 'border-red-500/50 bg-red-500/5' : 'border-white/10 hover:border-yellow-500/50 hover:bg-yellow-500/5'}
                        `}
                      >
                        {preview ? (
                          <>
                            <img src={preview} className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity" alt="User selfie" />
                            <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                              <div className="bg-black/50 p-4 rounded-full backdrop-blur-sm">
                                <Icons.Upload />
                              </div>
                              <span className="font-bold text-sm mt-4 uppercase tracking-widest">Change Photo</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="p-5 bg-white/5 rounded-full mb-2 group-hover:scale-110 transition-transform">
                              <Icons.Upload />
                            </div>
                            <div className="text-center px-6">
                              <p className="font-bold text-lg">Upload File</p>
                              <p className="text-[10px] text-white/30 mt-2 uppercase tracking-widest font-bold">JPG, PNG</p>
                            </div>
                          </>
                        )}
                        
                        {isValidating && (
                          <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-20">
                            <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin mb-3" />
                            <span className="font-bold text-[10px] uppercase tracking-[0.3em] text-yellow-500">Analyzing Face</span>
                          </div>
                        )}
                      </div>

                      <div 
                        onClick={startCamera}
                        className="flex-1 border-2 border-dashed border-white/10 rounded-[2rem] aspect-square sm:aspect-video flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-yellow-500/50 hover:bg-yellow-500/5 transition-all group"
                      >
                         <div className="p-5 bg-white/5 rounded-full mb-2 group-hover:scale-110 transition-transform">
                            <Icons.Camera />
                         </div>
                         <div className="text-center px-6">
                            <p className="font-bold text-lg">Take Photo</p>
                            <p className="text-[10px] text-white/30 mt-2 uppercase tracking-widest font-bold">USE WEBCAM</p>
                         </div>
                      </div>
                  </div>
                )}
                
                {error && (
                  <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 animate-pulse">
                    <span className="text-red-500 text-xl">⚠️</span>
                    <p className="text-red-500 text-xs font-bold uppercase tracking-wider">{error}</p>
                  </div>
                )}
              </div>

              <div className="pt-4">
                <button 
                  disabled={!isPhotoValid || isCameraOpen}
                  onClick={() => setWizardStep('setup')}
                  className="w-full bg-white text-black py-5 rounded-2xl font-black text-lg disabled:opacity-50 disabled:grayscale transition-all hover:bg-yellow-500 flex items-center justify-center gap-3"
                >
                  NEXT: SETUP PARODY →
                </button>
              </div>
            </div>
          )}

          {wizardStep === 'setup' && (
            <div className="space-y-8 animate-fadeIn">
              <header className="flex justify-between items-start">
                <div>
                   <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-yellow-500/80 mb-2">2. PRODUCTION DETAILS</h3>
                   <h2 className="text-3xl lg:text-4xl font-oswald font-bold uppercase tracking-tight mb-2">Parody <span className="text-yellow-500">Setup</span></h2>
                   <p className="text-white/40 font-medium">The AI will handle the jokes. Just give us your name and pick a vibe.</p>
                </div>
              </header>

              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2">Parody Tone</label>
                  <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/10">
                    {TONES.map(t => (
                      <button
                        key={t}
                        onClick={() => setTone(t)}
                        className={`flex-1 py-3 rounded-lg text-sm font-bold uppercase tracking-wider transition-all ${tone === t ? 'bg-yellow-500 text-black shadow-lg' : 'text-white/40 hover:text-white'}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-[10px] text-white/40 italic">
                    {tone === 'Funny' ? 'Structured, clever parody with witty puns.' : 'Absolute, absurd slapstick with extreme caricature.'}
                  </p>
                </div>

                <div>
                  <div className="flex justify-between items-end mb-2">
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30">
                        Lead Actor <span className="text-yellow-500">*</span>
                    </label>
                    <span className={`text-[9px] font-bold tracking-widest ${name.length > 20 ? 'text-red-500' : 'text-white/20'}`}>
                        {name.length}/20
                    </span>
                  </div>
                  <input 
                    ref={nameInputRef}
                    type="text"
                    required
                    maxLength={20}
                    value={name}
                    onChange={(e) => {
                        setError(null);
                        setName(e.target.value);
                    }}
                    placeholder="YOUR NAME"
                    className={`w-full bg-white/5 border rounded-xl px-5 py-4 text-white placeholder:text-white/10 focus:outline-none focus:border-yellow-500 transition-colors font-oswald text-xl uppercase tracking-wider ${!name.trim() && error ? 'border-red-500/50' : 'border-white/10'}`}
                  />
                </div>
              </div>

              {/* Error Message Display */}
              {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 animate-pulse">
                    <span className="text-red-500 text-xl">⚠️</span>
                    <p className="text-red-500 text-xs font-bold uppercase tracking-wider">{error}</p>
                  </div>
              )}

              <div className="pt-4">
                <button 
                  disabled={!isTextValid}
                  onClick={onGenerateClick}
                  className="w-full relative group cursor-pointer"
                >
                   <div className="absolute -inset-1 bg-gradient-to-r from-yellow-600 to-yellow-400 rounded-2xl blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200 group-disabled:opacity-0 pointer-events-none"></div>
                   <div className="relative bg-yellow-500 text-black py-5 rounded-2xl font-black text-lg disabled:opacity-50 disabled:grayscale transition-all hover:bg-white flex items-center justify-center gap-3">
                     GENERATE POSTER <span className="text-2xl">⚡</span>
                   </div>
                </button>
              </div>
            </div>
          )}
          
        </div>
      </div>
      
      {/* Hidden Canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />

      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*"
        onChange={handleFileChange} 
      />
    </div>
  );
};

export default CustomizeForm;
