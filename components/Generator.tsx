import React, { useRef, useState, useEffect } from 'react';
import { Icons } from '../constants';
import { MemeTone, MemeTemplate } from '../types';
import { geminiService } from '../services/gemini';

interface GeneratorProps {
  templates: MemeTemplate[];
  generationError?: string | null;
  onGenerate: (template: MemeTemplate, templateBase64: string, selfieBase64: string, name: string, tone: MemeTone) => void;
}

const TONES: MemeTone[] = ['Funny', 'Funnier', 'Dumb Funny'];

const Generator: React.FC<GeneratorProps> = ({ templates, generationError, onGenerate }) => {
  // Step 1: Template
  const [selectedTemplate, setSelectedTemplate] = useState<MemeTemplate | null>(null);
  
  // Step 2: Selfie
  const [selfieBase64, setSelfieBase64] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);
  
  // Step 3: Tone & Name
  const [selectedTone, setSelectedTone] = useState<MemeTone>('Funny');
  const [userName, setUserName] = useState('');
  
  // Validation & Error
  const [error, setError] = useState<string | null>(generationError || null);
  const [isValidating, setIsValidating] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (generationError) {
      setError(generationError);
      setIsGenerating(false);
    }
  }, [generationError]);

  // Clean up camera on unmount
  useEffect(() => {
    return () => stopCamera();
  }, []);

  // --- Step 2 Handlers ---
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
        processSelfie(base64);
        stopCamera();
      }
    }
  };

  const handleSelfieChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        processSelfie(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const processSelfie = async (base64: string) => {
    setSelfieBase64(base64);
    setError(null);
    setIsValidating(true);
    
    const { valid, message } = await geminiService.validatePhoto(base64);
    if (!valid) {
      setError(message);
    }
    setIsValidating(false);
  };

  // --- Step 4 Handler ---
  const handleGenerateClick = async () => {
    if (!selectedTemplate || !selfieBase64 || !userName.trim()) return;
    
    setIsGenerating(true);
    setError(null);
    
    try {
      const templateBase64 = await geminiService.urlToBase64(selectedTemplate.coverUrl);
      onGenerate(selectedTemplate, templateBase64, selfieBase64, userName, selectedTone);
    } catch (err) {
      console.error(err);
      setError("Failed to process the selected template. Please try again.");
      setIsGenerating(false);
    }
  };

  const isReady = selectedTemplate && selfieBase64 && userName.trim().length >= 2;

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="space-y-12">
        
        {/* Step 1: Template */}
        <section className="bg-white/[0.03] border border-white/10 rounded-[2.5rem] p-6 lg:p-10 backdrop-blur-xl shadow-2xl">
          <header className="mb-6">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-yellow-500/80 mb-2">Step 1</h3>
            <h2 className="text-3xl font-oswald font-bold uppercase tracking-tight">Select <span className="text-yellow-500">Template Poster</span></h2>
            <p className="text-white/40 font-medium text-sm mt-1">Choose a reference movie poster for the AI to parody.</p>
          </header>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {templates.map((template) => (
              <div 
                key={template.id}
                onClick={() => setSelectedTemplate(template)}
                className={`relative aspect-[2/3] rounded-xl overflow-hidden cursor-pointer transition-all border-2 ${selectedTemplate?.id === template.id ? 'border-yellow-500 scale-105 shadow-xl shadow-yellow-500/20' : 'border-transparent hover:border-white/20 hover:scale-105'}`}
              >
                <img 
                  src={template.coverUrl} 
                  alt={template.title}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                {selectedTemplate?.id === template.id && (
                  <div className="absolute inset-0 bg-yellow-500/20 flex items-center justify-center">
                    <div className="bg-yellow-500 text-black p-2 rounded-full shadow-lg">
                      <Icons.Check />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Step 2: Selfie */}
        <section className={`bg-white/[0.03] border border-white/10 rounded-[2.5rem] p-6 lg:p-10 backdrop-blur-xl shadow-2xl transition-opacity duration-500 ${!selectedTemplate ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
          <header className="mb-6">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-yellow-500/80 mb-2">Step 2</h3>
            <h2 className="text-3xl font-oswald font-bold uppercase tracking-tight">Upload <span className="text-yellow-500">Headshot</span></h2>
            <p className="text-white/40 font-medium text-sm mt-1">Take a photo or upload a file. Look directly at the camera.</p>
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
                    onClick={() => selfieInputRef.current?.click()}
                    className={`flex-1 relative border-2 border-dashed rounded-[2rem] aspect-square sm:aspect-video flex flex-col items-center justify-center gap-4 cursor-pointer transition-all overflow-hidden group
                      ${selfieBase64 ? 'border-yellow-500/50 bg-yellow-500/5' : 'border-white/10 hover:border-yellow-500/50 hover:bg-yellow-500/5'}
                    `}
                  >
                    {selfieBase64 ? (
                      <>
                        <img src={selfieBase64} className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity" alt="User selfie" />
                        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="bg-black/50 p-4 rounded-full backdrop-blur-sm">
                            <Icons.Upload />
                          </div>
                          <span className="font-bold text-sm mt-4 uppercase tracking-widest text-white">Change Photo</span>
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
          </div>
          <input type="file" ref={selfieInputRef} className="hidden" accept="image/*" onChange={handleSelfieChange} />
        </section>

        {/* Step 3: Tone & Name */}
        <section className={`bg-white/[0.03] border border-white/10 rounded-[2.5rem] p-6 lg:p-10 backdrop-blur-xl shadow-2xl transition-opacity duration-500 ${(!selectedTemplate || !selfieBase64) ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
          <header className="mb-6">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-yellow-500/80 mb-2">Step 3</h3>
            <h2 className="text-3xl font-oswald font-bold uppercase tracking-tight">Set The <span className="text-yellow-500">Tone</span></h2>
            <p className="text-white/40 font-medium text-sm mt-1">The AI will handle the jokes. Just give us your name and pick a vibe.</p>
          </header>

          <div className="space-y-6">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2">Parody Tone</label>
              <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/10">
                {TONES.map(t => (
                  <button
                    key={t}
                    onClick={() => setSelectedTone(t)}
                    className={`flex-1 py-3 rounded-lg text-sm font-bold uppercase tracking-wider transition-all ${selectedTone === t ? 'bg-yellow-500 text-black shadow-lg' : 'text-white/40 hover:text-white'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-white/40 italic">
                {selectedTone === 'Funny' && 'Structured, clever parody with witty puns.'}
                {selectedTone === 'Funnier' && 'Absolute, absurd slapstick with extreme caricature.'}
                {selectedTone === 'Dumb Funny' && 'So stupid it\'s hilarious. Think bad puns and ridiculous situations.'}
              </p>
            </div>

            <div>
              <div className="flex justify-between items-end mb-2">
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30">
                    Lead Actor <span className="text-yellow-500">*</span>
                </label>
                <span className={`text-[9px] font-bold tracking-widest ${userName.length > 20 ? 'text-red-500' : 'text-white/20'}`}>
                    {userName.length}/20
                </span>
              </div>
              <input 
                type="text"
                required
                maxLength={20}
                value={userName}
                onChange={(e) => {
                    setError(null);
                    setUserName(e.target.value);
                }}
                placeholder="YOUR NAME"
                className={`w-full bg-white/5 border rounded-xl px-5 py-4 text-white placeholder:text-white/10 focus:outline-none focus:border-yellow-500 transition-colors font-oswald text-xl uppercase tracking-wider ${!userName.trim() && error ? 'border-red-500/50' : 'border-white/10'}`}
              />
            </div>
          </div>
        </section>

        {/* Error Message Display */}
        {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 animate-pulse">
              <span className="text-red-500 text-xl">⚠️</span>
              <p className="text-red-500 text-xs font-bold uppercase tracking-wider">{error}</p>
            </div>
        )}

        {/* Step 4: Generate */}
        <section className="pt-4">
          <button 
            disabled={!isReady || isGenerating}
            onClick={handleGenerateClick}
            className="w-full relative group cursor-pointer"
          >
             <div className="absolute -inset-1 bg-gradient-to-r from-yellow-600 to-yellow-400 rounded-2xl blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200 group-disabled:opacity-0 pointer-events-none"></div>
             <div className="relative bg-yellow-500 text-black py-6 rounded-2xl font-black text-2xl disabled:opacity-50 disabled:grayscale transition-all hover:bg-white flex items-center justify-center gap-3 uppercase tracking-tight">
               {isGenerating ? 'DRAFTING...' : 'DRAFT POSTER'} <span className="text-3xl">📝</span>
             </div>
          </button>
        </section>
        
      </div>
      
      {/* Hidden Canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default Generator;
