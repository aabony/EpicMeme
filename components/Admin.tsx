
import React, { useState, useRef, useEffect } from 'react';
import { MemeTemplate } from '../types';
import { geminiService } from '../services/gemini';
import { Icons } from '../constants';

interface AdminProps {
  templates: MemeTemplate[];
  onUpdateTemplate: () => void;
  onExit: () => void;
}

// Sub-component for handling the upload state machine
const UploadCard = ({ templateId, onUploadSuccess }: { templateId: string, onUploadSuccess: () => void }) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'error' | 'success'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      
      // Basic validation
      if (!selected.type.startsWith('image/')) {
        setStatus('error');
        setErrorMsg('File must be an image.');
        return;
      }

      // Check size (5MB limit)
      if (selected.size > 5 * 1024 * 1024) {
          setStatus('error');
          setErrorMsg('File too large (Max 5MB).');
          return;
      }
      
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
      setStatus('idle');
      setErrorMsg('');
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setStatus('uploading');
    try {
      await geminiService.uploadTemplateImage(templateId, file);
      setStatus('success');
      // Delay to show success state before triggering refresh
      setTimeout(() => {
        onUploadSuccess();
        reset();
      }, 1000);
    } catch (e) {
      console.error(e);
      setStatus('error');
      setErrorMsg((e as Error).message || "Upload failed");
    }
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setStatus('idle');
    setErrorMsg('');
    if (inputRef.current) inputRef.current.value = '';
  };

  if (status === 'success') {
     return (
        <div className="flex-shrink-0 w-32 h-48 bg-green-500/10 border border-green-500 rounded-lg flex flex-col items-center justify-center text-green-500 animate-fadeIn">
             <span className="text-2xl mb-2">✓</span>
             <span className="text-[10px] font-bold uppercase">Saved</span>
        </div>
     )
  }

  if (file) {
      return (
        <div className="flex-shrink-0 w-32 h-48 relative bg-white/5 rounded-lg border border-white/20 overflow-hidden flex flex-col animate-fadeIn">
            {/* Preview Area */}
            <div className="h-28 w-full relative bg-black/50">
                {preview && <img src={preview} className="w-full h-full object-contain" alt="Preview" />}
                <button 
                    onClick={reset}
                    className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-500 transition-colors"
                >
                    ×
                </button>
            </div>
            
            {/* Controls Area */}
            <div className="flex-1 p-2 flex flex-col justify-between bg-white/5">
                {status === 'error' ? (
                     <div className="text-[9px] text-red-400 leading-tight mb-1 font-bold break-words line-clamp-3" title={errorMsg}>
                         {errorMsg}
                     </div>
                ) : (
                     <div className="text-[9px] text-white/50 truncate mb-1">{file.name}</div>
                )}
                
                {status === 'error' ? (
                    <button 
                        onClick={reset}
                        className="w-full py-1.5 rounded text-[9px] font-bold uppercase tracking-wider bg-white/10 hover:bg-white/20"
                    >
                        TRY AGAIN
                    </button>
                ) : (
                    <button 
                        onClick={handleUpload}
                        disabled={status === 'uploading'}
                        className={`w-full py-1.5 rounded text-[9px] font-bold uppercase tracking-wider transition-all ${status === 'uploading' ? 'bg-yellow-500/50 cursor-wait' : 'bg-yellow-500 hover:bg-white text-black shadow-lg hover:shadow-yellow-500/20'}`}
                    >
                        {status === 'uploading' ? '...' : 'UPLOAD'}
                    </button>
                )}
            </div>
        </div>
      );
  }

  // Default Empty State
  return (
    <div className="flex-shrink-0 w-32 h-48 relative">
        <label className="block w-full h-full rounded-lg border-2 border-dashed border-white/20 hover:border-yellow-500/50 hover:bg-yellow-500/10 cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group">
            <input 
                ref={inputRef}
                type="file" 
                accept="image/png, image/jpeg, image/jpg, image/gif, image/webp" 
                className="hidden" 
                onChange={handleFileSelect}
            />
            <span className="text-3xl text-white/20 group-hover:text-yellow-500/50 transition-colors">+</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-center px-2 group-hover:text-yellow-500 transition-colors">
                    Upload
            </span>
        </label>
    </div>
  );
}

// Sub-component for AI Generation
const AIGeneratorCard = ({ templateId, templateTitle, onGenerateSuccess }: { templateId: string, templateTitle: string, onGenerateSuccess: () => void }) => {
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState<'idle' | 'drafting' | 'generating' | 'error' | 'success'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const handleAutoDraft = async () => {
    setStatus('drafting');
    try {
        const draft = await geminiService.draftPosterPrompt(templateTitle);
        setPrompt(draft);
        setStatus('idle');
    } catch (e) {
        setPrompt(`A cinematic movie poster for ${templateTitle}, detailed, 8k.`);
        setStatus('idle');
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setStatus('generating');
    try {
      await geminiService.generateTemplateBackground(templateId, prompt);
      setStatus('success');
      setTimeout(() => {
        onGenerateSuccess();
        setPrompt('');
        setStatus('idle');
        setIsOpen(false);
      }, 1500);
    } catch (e) {
      console.error(e);
      setStatus('error');
      setErrorMsg("Gen failed.");
    }
  };

  if (!isOpen) {
     return (
        <button 
            onClick={() => setIsOpen(true)}
            className="flex-shrink-0 w-32 h-48 rounded-lg border border-white/10 bg-gradient-to-br from-purple-500/10 to-blue-500/10 hover:from-purple-500/20 hover:to-blue-500/20 flex flex-col items-center justify-center gap-2 group transition-all"
        >
             <div className="p-3 bg-white/10 rounded-full group-hover:scale-110 transition-transform text-purple-300">
                <Icons.Magic />
             </div>
             <span className="text-[10px] font-bold uppercase tracking-widest text-center px-2 text-purple-200 group-hover:text-white transition-colors">
                AI Generate
            </span>
        </button>
     );
  }

  return (
    <div className="flex-shrink-0 w-64 h-48 relative bg-black/80 rounded-lg border border-purple-500/30 overflow-hidden flex flex-col animate-fadeIn p-3">
        <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-bold text-purple-400 uppercase">New AI Background</span>
            <button onClick={() => setIsOpen(false)} className="text-white/50 hover:text-white">×</button>
        </div>

        {status === 'success' ? (
             <div className="flex-1 flex flex-col items-center justify-center text-green-500">
                <span className="text-2xl mb-1">✓</span>
                <span className="text-[10px]">Created!</span>
             </div>
        ) : (
            <>
                <div className="relative mb-2">
                    <textarea 
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="E.g., A cyborg in a burning city..."
                        className="w-full h-24 bg-white/5 border border-white/10 rounded text-[10px] p-2 text-white placeholder:text-white/20 resize-none focus:outline-none focus:border-purple-500 pr-8"
                    />
                    <button 
                        onClick={handleAutoDraft}
                        disabled={status === 'drafting'}
                        className="absolute top-1 right-1 text-purple-400 hover:text-white p-1 rounded bg-black/50"
                        title="Auto-Draft Prompt based on Movie Title"
                    >
                        {status === 'drafting' ? (
                            <div className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <Icons.Magic />
                        )}
                    </button>
                </div>
                
                {status === 'error' ? (
                     <div className="text-[9px] text-red-400 text-center mb-1">{errorMsg}</div>
                ) : (
                    <button 
                        onClick={handleGenerate}
                        disabled={status === 'generating' || !prompt.trim()}
                        className={`w-full py-1.5 rounded text-[9px] font-bold uppercase tracking-wider transition-all ${status === 'generating' ? 'bg-purple-500/50 cursor-wait' : 'bg-purple-600 hover:bg-purple-500 text-white'}`}
                    >
                        {status === 'generating' ? 'Dreaming...' : 'Generate'}
                    </button>
                )}
            </>
        )}
    </div>
  );
};

const Admin: React.FC<AdminProps> = ({ templates, onUpdateTemplate, onExit }) => {
  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex justify-between items-center mb-10">
        <div>
            <h2 className="text-4xl font-oswald font-bold uppercase tracking-tighter">
            Admin <span className="text-yellow-500">Panel</span>
            </h2>
            <p className="text-white/60">Manage your movie poster templates and add new variants.</p>
        </div>
        <button onClick={onExit} className="bg-white/10 hover:bg-white/20 px-6 py-3 rounded-lg font-bold uppercase text-sm">
            Exit Admin
        </button>
      </div>

      {/* Serverless Status Banner */}
      <div className="bg-green-500/10 border border-green-500/20 text-white p-4 rounded-xl mb-8 flex flex-col md:flex-row items-center justify-between gap-4 animate-fadeIn shadow-2xl">
          <div className="flex items-center gap-3">
              <span className="text-2xl bg-green-500/20 rounded-full w-10 h-10 flex items-center justify-center text-green-500">✓</span>
              <div>
                  <h3 className="font-bold text-lg uppercase tracking-wide text-green-500">Serverless Mode Active</h3>
                  <p className="text-sm text-white/60">
                      Running entirely in the browser using Gemini API. No terminal connection required.
                  </p>
              </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs font-bold uppercase tracking-widest text-green-500 bg-green-500/10 px-3 py-1 rounded-full">
                System Online
            </span>
          </div>
      </div>

      <div className="space-y-12">
        {templates.map((t) => (
          <div key={t.id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden p-6">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h3 className="font-oswald font-bold text-2xl uppercase mb-1">{t.title}</h3>
                    <div className="text-xs font-bold text-yellow-500 uppercase tracking-widest">{t.category}</div>
                </div>
                <div className="text-xs text-white/40 uppercase font-mono bg-black/30 px-3 py-1 rounded">
                    ID: {t.id}
                </div>
            </div>

            {/* Image Grid */}
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide items-center">
                 {/* Upload Card */}
                 <UploadCard templateId={t.id} onUploadSuccess={onUpdateTemplate} />
                 
                 {/* AI Generator Card */}
                 <AIGeneratorCard 
                    templateId={t.id} 
                    templateTitle={t.title} 
                    onGenerateSuccess={onUpdateTemplate} 
                 />

                {/* Existing Images */}
                {(t.images && t.images.length > 0 ? t.images : [t.coverImage]).map((img, idx) => (
                    <div key={idx} className="flex-shrink-0 w-32 h-48 bg-black rounded-lg overflow-hidden relative group border border-white/10 hover:border-yellow-500 transition-colors">
                        <img 
                            src={img} 
                            className="w-full h-full object-cover"
                            alt={`${t.title} variant ${idx}`} 
                        />
                        {idx === 0 && (
                            <div className="absolute top-2 left-2 bg-yellow-500 text-black text-[10px] font-bold px-2 py-0.5 rounded shadow-lg uppercase">
                                Main
                            </div>
                        )}
                    </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Admin;
