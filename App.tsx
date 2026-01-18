
import React, { useState } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import TemplateGallery from './components/TemplateGallery';
import CustomizeForm from './components/CustomizeForm';
import Processing from './components/Processing';
import ResultDisplay from './components/ResultDisplay';
import { GenerationStep, MemeData, MemeTemplate, MemeTone } from './types';
import { geminiService } from './services/gemini';

const App: React.FC = () => {
  const [step, setStep] = useState<GenerationStep | 'hero'>('hero');
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

  const handleStart = () => setStep('gallery');

  const handleTemplateSelected = (template: MemeTemplate) => {
    setData(prev => ({ 
      ...prev, 
      template,
      movieTitle: template.movieTitle, 
      tagline: '',
      coverText: '',
      tone: 'Funny'
    }));
    setStep('customize');
  };

  const handleGenerate = async (
    photo: string, 
    name: string, 
    title: string, 
    costume: string, 
    tagline: string,
    coverText: string,
    tone: MemeTone
  ) => {
    if (!data.template) return;
    
    setStep('processing');
    try {
      const result = await geminiService.generateMeme(
        photo,
        data.template.id, 
        name,
        title,
        costume,
        tagline,
        coverText,
        tone
      );
      
      setData(prev => ({ 
        ...prev, 
        userPhoto: photo, 
        userName: name, 
        movieTitle: title, 
        tagline: tagline,
        coverText: coverText,
        tone: tone,
        resultUrl: result 
      }));
      setStep('result');
    } catch (err) {
      console.error(err);
      setStep('customize');
      alert("Something went wrong during generation. Please try a different photo or template.");
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
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0a] text-white">
      <Header />
      
      <main className="flex-grow">
        {step === 'hero' && <Hero onStart={handleStart} />}
        
        {step === 'gallery' && (
          <TemplateGallery onSelect={handleTemplateSelected} />
        )}

        {step === 'customize' && data.template && (
          <CustomizeForm 
            template={data.template}
            onBack={() => setStep('gallery')}
            onGenerate={handleGenerate}
          />
        )}

        {step === 'processing' && <Processing />}

        {step === 'result' && data.resultUrl && (
          <ResultDisplay imageUrl={data.resultUrl} onReset={reset} />
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
            <a href="#" className="hover:text-white transition-colors">API</a>
          </div>
          <div className="text-sm text-white/20">© 2024 EpicMeme AI Studio</div>
        </div>
      </footer>
    </div>
  );
};

export default App;
