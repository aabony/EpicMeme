
import React, { useRef, useState, useEffect } from 'react';
import { Icons } from '../constants';
import { MemeTemplate, MemeTone, MemeData } from '../types';
import { geminiService, GenerationStrategy } from '../services/gemini';

interface CustomizeFormProps {
  template: MemeTemplate;
  initialData?: MemeData;
  generationError?: string | null;
  onGenerate: (photo: string, name: string, movieTitle: string, costume: string, tagline: string, coverText: string, tone: MemeTone, posterUrl: string, preGenPoster?: string) => void;
  onBack: () => void;
}

type WizardStep = 'casting' | 'typography';

const TONES: MemeTone[] = ['Funny', 'Action', 'Horror', 'Romance'];

const CustomizeForm: React.FC<CustomizeFormProps> = ({ template, initialData, generationError, onGenerate, onBack }) => {
  const [wizardStep, setWizardStep] = useState<WizardStep>(
    initialData?.userPhoto ? 'typography' : 'casting'
  );
  
  // Data State
  const [selectedPoster, setSelectedPoster] = useState<string>(
    (initialData?.selectedPosterUrl && initialData.template?.id === template.id) 
      ? initialData.selectedPosterUrl 
      : (template.images?.[0] || template.coverImage)
  );
  
  const [preview, setPreview] = useState<string | null>(initialData?.userPhoto || null);
  
  // Text State
  const [name, setName] = useState(initialData?.userName || '');
  const [movieTitle, setMovieTitle] = useState(initialData?.movieTitle || template.movieTitle);
  const [tagline, setTagline] = useState(initialData?.tagline || '');
  const [coverText, setCoverText] = useState(initialData?.coverText || '');
  const [tone, setTone] = useState<MemeTone>(initialData?.tone || 'Funny');
  const [isGeneratingText, setIsGeneratingText] = useState(false);
  
  // Validation & Error
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(generationError || null);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  
  // AI Strategy State
  const [strategy, setStrategy] = useState<GenerationStrategy>('cinematic');
  const [bgStatus, setBgStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle');

  // Camera State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // BACKGROUND PROCESSING REF
  const backgroundGenRef = useRef<Promise<string> | null>(null);

  useEffect(() => {
    if (generationError) setError(generationError);
  }, [generationError]);

  const addLog = (msg: string) => {
      setDebugLog(prev => [...prev, msg]);
  };

  const triggerBackgroundGen = (forcedStrategy?: GenerationStrategy) => {
      if (!preview || !selectedPoster) return;
      
      const strat = forcedStrategy || strategy;
      console.log(`⚡ Starting Background AI (${strat})...`);
      setBgStatus('processing');
      setDebugLog([]); // Clear log on new run
      addLog(`Casting call...`);

      backgroundGenRef.current = geminiService.generateAIImageOnly(
          preview,
          selectedPoster,
          template.costume,
          strat,
          addLog // Pass logger
      ).then(result => {
          setBgStatus('done');
          addLog("Poster Painted!");
          return result;
      }).catch(err => {
          console.error("Background Gen Failed:", err);
          setBgStatus('error');
          addLog(`Error: ${err.message}`);
          return "";
      });
  };

  // Auto-start when entering typography step
  useEffect(() => {
    if (wizardStep === 'typography' && preview && selectedPoster && !backgroundGenRef.current) {
        setTimeout(() => nameInputRef.current?.focus(), 100);
        triggerBackgroundGen('cinematic');
    }
  }, [wizardStep, preview, selectedPoster]);

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
    // Reset background gen if photo changes
    backgroundGenRef.current = null;
    setBgStatus('idle');
    setDebugLog([]);
    
    const { valid, message } = await geminiService.validatePhoto(base64);
    if (!valid) {
      setError(message);
    }
    setIsValidating(false);
  };

  const handleGenerateText = async (selectedTone: MemeTone) => {
    setIsGeneratingText(true);
    setError(null);
    const result = await geminiService.generateCreativeText(template.title, selectedTone);
    setMovieTitle(result.movieTitle);
    setTagline(result.slogan);
    setCoverText(result.coverText);
    setIsGeneratingText(false);
  };

  const handleToneChange = (newTone: MemeTone) => {
    setTone(newTone);
  };

  const onGenerateClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    setError(null);
    
    if (preview) {
        if (!name.trim()) {
            setError("Lead Actor name is required.");
            return;
        }

        let preGenPoster = undefined;
        if (backgroundGenRef.current) {
            try {
                const result = await backgroundGenRef.current;
                if (result) preGenPoster = result;
            } catch (e) {
                console.warn("Background gen had error");
            }
        }

        onGenerate(preview, name, movieTitle, template.costume, tagline, coverText, tone, selectedPoster, preGenPoster);
    } else {
        alert("Please upload a photo first!");
        setWizardStep('casting');
    }
  };

  const isPhotoValid = !!preview; 
  const isTextValid = name.trim().length >= 2 && movieTitle.trim().length > 0;
  const variants = template.images && template.images.length > 0 ? template.images : [template.coverImage];

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <div className="flex justify-between items-center mb-8">
        <button 
          onClick={wizardStep === 'typography' ? () => setWizardStep('casting') : onBack}
          className="text-white/40 hover:text-white transition-colors uppercase font-bold text-sm flex items-center gap-2 group"
        >
          <span className="group-hover:-translate-x-1 transition-transform">←</span> {wizardStep === 'typography' ? 'BACK TO PHOTO' : 'BACK TO POSTERS'}
        </button>

        <div className="flex items-center gap-2">
          <div className={`h-2 w-12 rounded-full transition-colors ${wizardStep === 'casting' ? 'bg-yellow-500' : 'bg-yellow-500/30'}`} />
          <div className={`h-2 w-12 rounded-full transition-colors ${wizardStep === 'typography' ? 'bg-yellow-500' : 'bg-white/10'}`} />
        </div>
      </div>

      <div className="flex flex-col-reverse lg:flex-row-reverse gap-8 lg:gap-12 items-start">
        {/* Preview Column */}
        <div className="w-full lg:w-1/4">
          <div className="sticky top-8 space-y-4">
            <div className="flex justify-between items-end">
                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-yellow-500/80">
                  REF POSTER
                </h3>
                {wizardStep === 'typography' && (
                    <span className={`text-[9px] font-bold uppercase ${bgStatus === 'processing' ? 'text-yellow-500 animate-pulse' : bgStatus === 'done' ? 'text-green-500' : bgStatus === 'error' ? 'text-red-500' : 'text-white/50'}`}>
                        {bgStatus === 'processing' ? 'Painting...' : bgStatus === 'done' ? 'Ready!' : bgStatus === 'error' ? 'Failed' : 'Waiting'}
                    </span>
                )}
            </div>

            {/* Selected Thumbnail Card */}
            <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-lg group bg-white/5 w-48 aspect-[2/3] mx-auto transition-all">
              <img 
                src={selectedPoster} 
                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" 
                alt={template.title}
                referrerPolicy="no-referrer"
              />
              {preview && (
                 <img src={preview} className="absolute bottom-2 right-2 w-10 h-10 rounded-lg border border-yellow-500 object-cover shadow-xl z-10" />
              )}
            </div>

            {/* STRATEGY SELECTOR - NEW! */}
            {wizardStep === 'typography' && (
                <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-white/40 mb-2 text-center">Re-Imaging Style</p>
                    <div className="flex gap-1 mb-3">
                        <button 
                            onClick={() => { setStrategy('cinematic'); triggerBackgroundGen('cinematic'); }}
                            className={`flex-1 py-2 text-[9px] font-bold uppercase rounded border ${strategy === 'cinematic' ? 'bg-yellow-500 text-black border-yellow-500' : 'bg-transparent text-white/50 border-white/10 hover:border-white/30'}`}
                            title="Epic, high-budget look"
                        >
                            Cinematic
                        </button>
                        <button 
                            onClick={() => { setStrategy('parody'); triggerBackgroundGen('parody'); }}
                            className={`flex-1 py-2 text-[9px] font-bold uppercase rounded border ${strategy === 'parody' ? 'bg-yellow-500 text-black border-yellow-500' : 'bg-transparent text-white/50 border-white/10 hover:border-white/30'}`}
                            title="Funny, exaggerated look"
                        >
                            Parody
                        </button>
                    </div>

                    {/* Debug Console */}
                    <div className="bg-black/50 rounded p-2 h-24 overflow-y-auto font-mono text-[9px] text-green-400/80 leading-relaxed border border-white/5">
                        {debugLog.length === 0 && <span className="opacity-30">Waiting for logs...</span>}
                        {debugLog.map((log, i) => (
                            <div key={i}>&gt; {log}</div>
                        ))}
                    </div>
                </div>
            )}
            
            {variants.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide justify-center">
                    {variants.map((v, i) => (
                        <div 
                            key={i} 
                            onClick={() => {
                                setSelectedPoster(v);
                                backgroundGenRef.current = null;
                                setBgStatus('idle');
                                if(wizardStep === 'typography') triggerBackgroundGen();
                            }}
                            className={`w-10 h-14 flex-shrink-0 rounded border cursor-pointer overflow-hidden transition-all ${selectedPoster === v ? 'border-yellow-500 ring-2 ring-yellow-500/50' : 'border-white/20 opacity-50 hover:opacity-100'}`}
                        >
                            <img src={v} className="w-full h-full object-cover" />
                        </div>
                    ))}
                </div>
            )}
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
                  onClick={() => setWizardStep('typography')}
                  className="w-full bg-white text-black py-5 rounded-2xl font-black text-lg disabled:opacity-50 disabled:grayscale transition-all hover:bg-yellow-500 flex items-center justify-center gap-3"
                >
                  NEXT: EDIT TITLES →
                </button>
              </div>
            </div>
          )}

          {wizardStep === 'typography' && (
            <div className="space-y-8 animate-fadeIn">
              <header className="flex justify-between items-start">
                <div>
                   <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-yellow-500/80 mb-2">2. PRODUCTION DETAILS</h3>
                   <h2 className="text-3xl lg:text-4xl font-oswald font-bold uppercase tracking-tight mb-2">Typography <span className="text-yellow-500">Setup</span></h2>
                   <p className="text-white/40 font-medium">Customize the credits to make it official.</p>
                </div>
              </header>

              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2">Movie Tone</label>
                  <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/10">
                    {TONES.map(t => (
                      <button
                        key={t}
                        onClick={() => handleToneChange(t)}
                        className={`flex-1 py-3 rounded-lg text-sm font-bold uppercase tracking-wider transition-all ${tone === t ? 'bg-yellow-500 text-black shadow-lg' : 'text-white/40 hover:text-white'}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
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

                <div className={`relative transition-opacity duration-300 ${isGeneratingText ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                    <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2">Blockbuster Title</label>
                    <input 
                        type="text"
                        value={movieTitle}
                        onChange={(e) => setMovieTitle(e.target.value)}
                        placeholder="MOVIE TITLE"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-yellow-500 placeholder:text-white/10 focus:outline-none focus:border-yellow-500 transition-colors font-oswald text-xl uppercase tracking-wider mb-6"
                    />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2">Slogan (One Sentence)</label>
                            <input 
                                type="text"
                                value={tagline}
                                onChange={(e) => setTagline(e.target.value)}
                                placeholder="This time it's personal..."
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white/80 placeholder:text-white/10 focus:outline-none focus:border-yellow-500 transition-colors font-sans text-sm tracking-wide"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2">Cover Text (Plot Summary)</label>
                            <textarea 
                                value={coverText}
                                onChange={(e) => setCoverText(e.target.value)}
                                placeholder="High above the city, one man must fight for survival..."
                                rows={3}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white/80 placeholder:text-white/10 focus:outline-none focus:border-yellow-500 transition-colors font-sans text-xs leading-relaxed resize-none"
                            />
                        </div>
                    </div>
                </div>
              </div>

              {/* Error Message Display */}
              {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 animate-pulse">
                    <span className="text-red-500 text-xl">⚠️</span>
                    <p className="text-red-500 text-xs font-bold uppercase tracking-wider">{error}</p>
                  </div>
              )}

              <div className="pt-4 space-y-4">
                <button
                    type="button"
                    onClick={() => handleGenerateText(tone)}
                    disabled={isGeneratingText}
                    className="w-full bg-white/10 border border-white/20 text-white py-4 rounded-2xl font-bold uppercase tracking-wider hover:bg-white/20 transition-all flex items-center justify-center gap-3 group"
                >
                    {isGeneratingText ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            WRITING SCRIPT...
                        </>
                    ) : (
                        <>
                            <span className="group-hover:scale-110 transition-transform"><Icons.Magic /></span>
                            WRITE AI SCRIPT
                        </>
                    )}
                </button>

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
