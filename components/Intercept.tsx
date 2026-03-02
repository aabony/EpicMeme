import React, { useState } from 'react';
import { PosterBlueprint, MemeTone } from '../types';
import { geminiService } from '../services/gemini';
import { Icons } from '../constants';

interface InterceptProps {
  initialBlueprint: PosterBlueprint;
  templateTitle: string;
  userName: string;
  tone: MemeTone;
  onGenerate: (blueprint: PosterBlueprint) => void;
  onBack: () => void;
}

const Intercept: React.FC<InterceptProps> = ({ 
  initialBlueprint, 
  templateTitle, 
  userName, 
  tone, 
  onGenerate, 
  onBack 
}) => {
  const [blueprint, setBlueprint] = useState<PosterBlueprint>(initialBlueprint);
  const [isRegenerating, setIsRegenerating] = useState<'title' | 'tagline' | 'credits' | null>(null);

  const handleRegenerate = async (type: 'title' | 'tagline' | 'credits') => {
    setIsRegenerating(type);
    try {
      const newText = await geminiService.regenerateText(
        type, 
        templateTitle, 
        userName, 
        tone, 
        type === 'tagline' ? blueprint.title : undefined
      );
      setBlueprint(prev => ({ ...prev, [type]: newText }));
    } catch (error) {
      console.error(`Failed to regenerate ${type}:`, error);
    } finally {
      setIsRegenerating(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="space-y-8">
        
        <section className="bg-white/[0.03] border border-white/10 rounded-[2.5rem] p-6 lg:p-10 backdrop-blur-xl shadow-2xl">
          <header className="mb-8 flex justify-between items-start">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-yellow-500/80 mb-2">Step 4</h3>
              <h2 className="text-3xl font-oswald font-bold uppercase tracking-tight">Review <span className="text-yellow-500">Blueprint</span></h2>
              <p className="text-white/40 font-medium text-sm mt-1">Edit the generated text or ask the AI to try again.</p>
            </div>
            <button onClick={onBack} className="text-white/40 hover:text-white text-sm font-bold uppercase tracking-widest">
              ← Back
            </button>
          </header>

          <div className="space-y-8">
            {/* Title */}
            <div>
              <div className="flex justify-between items-end mb-2">
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30">
                  Movie Title
                </label>
                <button 
                  onClick={() => handleRegenerate('title')}
                  disabled={isRegenerating !== null}
                  className="text-yellow-500 hover:text-yellow-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 disabled:opacity-50"
                >
                  {isRegenerating === 'title' ? '...' : <><Icons.Magic /> Regenerate</>}
                </button>
              </div>
              <input 
                type="text"
                value={blueprint.title}
                onChange={(e) => setBlueprint(prev => ({ ...prev, title: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white focus:outline-none focus:border-yellow-500 transition-colors font-oswald text-3xl uppercase tracking-wider"
              />
            </div>

            {/* Tagline */}
            <div>
              <div className="flex justify-between items-end mb-2">
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30">
                  Tagline
                </label>
                <button 
                  onClick={() => handleRegenerate('tagline')}
                  disabled={isRegenerating !== null}
                  className="text-yellow-500 hover:text-yellow-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 disabled:opacity-50"
                >
                  {isRegenerating === 'tagline' ? '...' : <><Icons.Magic /> Regenerate</>}
                </button>
              </div>
              <textarea 
                value={blueprint.tagline}
                onChange={(e) => setBlueprint(prev => ({ ...prev, tagline: e.target.value }))}
                rows={2}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white focus:outline-none focus:border-yellow-500 transition-colors text-lg italic resize-none"
              />
            </div>

            {/* Credits */}
            <div>
              <div className="flex justify-between items-end mb-2">
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30">
                  Production Credits (Billing Block)
                </label>
                <button 
                  onClick={() => handleRegenerate('credits')}
                  disabled={isRegenerating !== null}
                  className="text-yellow-500 hover:text-yellow-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 disabled:opacity-50"
                >
                  {isRegenerating === 'credits' ? '...' : <><Icons.Magic /> Regenerate</>}
                </button>
              </div>
              <textarea 
                value={blueprint.credits}
                onChange={(e) => setBlueprint(prev => ({ ...prev, credits: e.target.value }))}
                rows={4}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white focus:outline-none focus:border-yellow-500 transition-colors text-xs font-mono uppercase tracking-tighter leading-tight resize-none"
              />
            </div>
          </div>
        </section>

        <section className="pt-4">
          <button 
            onClick={() => onGenerate(blueprint)}
            className="w-full relative group cursor-pointer"
          >
             <div className="absolute -inset-1 bg-gradient-to-r from-yellow-600 to-yellow-400 rounded-2xl blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200 group-disabled:opacity-0 pointer-events-none"></div>
             <div className="relative bg-yellow-500 text-black py-6 rounded-2xl font-black text-2xl transition-all hover:bg-white flex items-center justify-center gap-3 uppercase tracking-tight">
               GENERATE FINAL POSTER <span className="text-3xl">🎬</span>
             </div>
          </button>
        </section>

      </div>
    </div>
  );
};

export default Intercept;
