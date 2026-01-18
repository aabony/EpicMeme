
import React from 'react';

interface ResultDisplayProps {
  imageUrl: string;
  onReset: () => void;
}

const ResultDisplay: React.FC<ResultDisplayProps> = ({ imageUrl, onReset }) => {
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = 'epic-meme-poster.png';
    link.click();
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Check out my Epic Meme Poster!',
          text: 'Generated with AI on EpicMeme',
          url: window.location.href
        });
      } catch (e) {
        console.error("Sharing failed", e);
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-12 items-center py-10">
      <div className="flex-1 w-full max-w-sm">
        <div className="relative rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(255,255,255,0.1)] group">
          <img src={imageUrl} className="w-full h-auto" alt="Generated Poster" />
          <div className="absolute inset-0 bg-yellow-500/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
        </div>
      </div>
      
      <div className="flex-1 space-y-8 text-center md:text-left">
        <div className="space-y-4">
          <h2 className="text-5xl font-oswald font-bold uppercase tracking-tighter">You Look <span className="text-yellow-500">Incredible</span></h2>
          <p className="text-lg text-white/60">The AI has analyzed your features and blended them perfectly into the movie poster's world. This is a true cinematic artifact.</p>
        </div>

        <div className="flex flex-col gap-4">
          <button 
            onClick={handleDownload}
            className="w-full bg-white text-black py-4 rounded-xl font-bold text-xl hover:bg-yellow-500 transition-all flex items-center justify-center gap-3"
          >
            DOWNLOAD POSTER
          </button>
          
          <div className="flex gap-4">
            <button 
              onClick={handleShare}
              className="flex-1 bg-white/10 border border-white/20 text-white py-4 rounded-xl font-bold hover:bg-white/20 transition-all"
            >
              SHARE
            </button>
            <button 
              onClick={onReset}
              className="flex-1 bg-white/10 border border-white/20 text-white py-4 rounded-xl font-bold hover:bg-white/20 transition-all"
            >
              CREATE NEW
            </button>
          </div>
        </div>

        <div className="p-6 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl">
          <p className="text-sm font-bold text-yellow-500 uppercase tracking-widest mb-1">PRO TIP</p>
          <p className="text-sm text-white/80">Try different templates for unique color grades and lighting effects. The "Shadow Dweller" is great for dramatic lighting!</p>
        </div>
      </div>
    </div>
  );
};

export default ResultDisplay;
