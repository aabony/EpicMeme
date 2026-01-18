
import React from 'react';

interface HeroProps {
  onStart: () => void;
}

const Hero: React.FC<HeroProps> = ({ onStart }) => {
  return (
    <div className="relative overflow-hidden min-h-[70vh] flex items-center justify-center py-20">
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/60 to-black z-10" />
        <img 
          src="https://picsum.photos/seed/movie-bg/1920/1080" 
          className="w-full h-full object-cover opacity-40 grayscale"
          alt="Cinematic background"
        />
      </div>
      
      <div className="relative z-20 text-center px-6 max-w-4xl">
        <h1 className="text-6xl md:text-8xl font-oswald font-bold uppercase tracking-tighter leading-none mb-6">
          Be the <span className="text-yellow-500">Star</span> <br />
          of your own <span className="italic">Action</span>
        </h1>
        <p className="text-lg md:text-xl text-white/60 mb-10 max-w-2xl mx-auto">
          Upload a selfie and let our AI transform you into the lead actor of a blockbuster movie poster. Instant, cinematic, and totally epic.
        </p>
        <button 
          onClick={onStart}
          className="group relative inline-flex items-center gap-3 bg-yellow-500 text-black px-8 py-4 rounded-full font-bold text-xl hover:bg-white transition-all transform hover:scale-105"
        >
          START GENERATING
          <span className="group-hover:translate-x-1 transition-transform">→</span>
        </button>
      </div>
    </div>
  );
};

export default Hero;
