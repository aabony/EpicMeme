
import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import TemplateGallery from './components/TemplateGallery';
import CustomizeForm from './components/CustomizeForm';
import Processing from './components/Processing';
import ResultDisplay from './components/ResultDisplay';
import Admin from './components/Admin';
import { GenerationStep, MemeData, MemeTemplate, MemeTone } from './types';
import { geminiService } from './services/gemini';

// Extends GenerationStep for internal app routing only
type AppStep = GenerationStep | 'hero' | 'admin';

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>('hero');
  const [templates, setTemplates] = useState<MemeTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  
  const [data, setData] = useState<MemeData>({
    userPhoto: null,
    userName: '',
    movieTitle: '',
    tagline: '',
    coverText: '',
    tone: 'Funny',
    template: null,
    resultUrl: null
  });

  // Load Templates on Mount
  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setIsLoadingTemplates(true);
    const result = await geminiService.fetchTemplates();
    setTemplates(result);
    setIsLoadingTemplates(false);
  };

  const handleStart = () => setStep('gallery');

  const handleTemplateSelected = (template: MemeTemplate) => {
    // Only reset data if choosing a new template, but keep user name if entered
    setData(prev => ({ 
      ...prev, 
      template,
      movieTitle: template.movieTitle, 
      tagline: '',
      coverText: '',
      tone: 'Funny',
      userPhoto: null, // Reset photo for new template
      selectedPosterUrl: template.images?.[0] || template.coverImage
    }));
    setGenerationError(null);
    setStep('customize');
  };

  const handleGenerate = async (
    photo: string, 
    name: string, 
    title: string, 
    costume: string, 
    tagline: string,
    coverText: string,
    tone: MemeTone,
    posterUrl: string,
    preGeneratedPoster?: string // Optional background art
  ) => {
    console.log("App.handleGenerate called with:", { name, title, tone, posterUrl: !!posterUrl, preGenerated: !!preGeneratedPoster });
    setGenerationError(null);
    
    if (!data.template) {
        console.error("Missing template in state!");
        return;
    }
    
    // 1. SAVE STATE IMMEDIATELY so it's not lost if we crash/error
    // We update the state container with the latest form values
    setData(prev => ({ 
      ...prev, 
      userPhoto: photo, 
      userName: name, 
      movieTitle: title, 
      tagline: tagline,
      coverText: coverText,
      tone: tone,
      selectedPosterUrl: posterUrl
    }));

    setStep('processing');
    
    try {
      const result = await geminiService.generateMeme(
        photo,
        data.template.id, 
        posterUrl, 
        name,
        title,
        costume,
        tagline,
        coverText,
        tone,
        preGeneratedPoster // Pass the already completed background if available!
      );
      
      setData(prev => ({ 
        ...prev, 
        resultUrl: result 
      }));
      setStep('result');
    } catch (err) {
      console.error("Generation error:", err);
      setGenerationError((err as Error).message || "Unknown error occurred");
      // Go back to form, data is already saved in state so form will rehydrate
      setStep('customize');
    }
  };

  const reset = () => {
    setStep('gallery');
    setData({
      userPhoto: null,
      userName: '',
      movieTitle: '',
      tagline: '',
      coverText: '',
      tone: 'Funny',
      template: null,
      resultUrl: null
    });
    setGenerationError(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0a] text-white">
      <Header />
      
      <main className="flex-grow">
        {step === 'hero' && <Hero onStart={handleStart} />}
        
        {step === 'gallery' && (
          <TemplateGallery 
            templates={templates} 
            onSelect={handleTemplateSelected} 
            isLoading={isLoadingTemplates}
          />
        )}

        {step === 'customize' && data.template && (
          <CustomizeForm 
            template={data.template}
            initialData={data} // Pass preserved data
            generationError={generationError}
            onBack={() => setStep('gallery')}
            onGenerate={handleGenerate}
          />
        )}

        {step === 'processing' && <Processing />}

        {step === 'result' && data.resultUrl && (
          <ResultDisplay imageUrl={data.resultUrl} onReset={reset} />
        )}

        {step === 'admin' && (
            <Admin 
                templates={templates} 
                onUpdateTemplate={loadTemplates}
                onExit={() => setStep('gallery')}
            />
        )}
      </main>

      <footer className="border-t border-white/10 py-12 px-6 bg-black">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center font-oswald font-bold text-black text-xl">
                E!
              </div>
              <span className="font-oswald text-xl font-bold tracking-tighter uppercase">
                Epic<span className="text-yellow-500">Meme</span>
              </span>
            </div>
            <p className="text-white/40 text-sm max-w-xs">AI-powered cinematic artifacts, personalized for the lead actor in you.</p>
          </div>
          <div className="flex gap-8 text-sm text-white/40 font-bold uppercase tracking-widest">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <button onClick={() => setStep('admin')} className="hover:text-white transition-colors">Admin</button>
          </div>
          <div className="text-sm text-white/20">© 2024 EpicMeme AI Studio</div>
        </div>
      </footer>
    </div>
  );
};

export default App;
