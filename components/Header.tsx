
import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-white/10 px-6 py-4">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-yellow-500 rounded-lg flex items-center justify-center font-oswald font-bold text-black text-2xl transform -rotate-6">
            E!
          </div>
          <span className="font-oswald text-2xl font-bold tracking-tighter uppercase">
            Epic<span className="text-yellow-500">Meme</span>
          </span>
        </div>
        <nav className="hidden md:flex gap-8 text-sm font-semibold uppercase tracking-widest text-white/60">
          <a href="#" className="hover:text-white transition-colors">How it works</a>
          <a href="#" className="hover:text-white transition-colors">Showcase</a>
          <a href="#" className="hover:text-white transition-colors text-white">Generator</a>
        </nav>
        <button className="bg-white text-black px-4 py-2 rounded-full text-sm font-bold hover:bg-yellow-500 transition-all">
          SIGN IN
        </button>
      </div>
    </header>
  );
};

export default Header;
