
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
    if (!navigator.share) {
      alert("Sharing is not supported on this browser. Please download the image instead.");
      return;
    }

    try {
      // 1. Attempt to share the Image File directly (Best UX)
      const response = await fetch(imageUrl, { referrerPolicy: 'no-referrer' });
      const blob = await response.blob();
      const file = new File([blob], 'epic-meme-poster.png', { type: 'image/png' });

      const shareData = {
        files: [file],
        title: 'EpicMeme Poster',
        text: 'Check out my AI-generated movie poster!',
      };

      if (navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
        return;
      }

      // 2. Fallback to URL sharing if files aren't supported
      let urlToShare = window.location.href;
      if (!urlToShare.startsWith('http')) {
        urlToShare = 'https://epicmeme.ai'; 
      }

      await navigator.share({
        title: 'EpicMeme - AI Movie Poster Generator',
        text: 'Transform your selfies into epic movie posters.',
        url: urlToShare
      });

    } catch (e) {
      console.warn("Sharing failed", e);
      if ((e as Error).name !== 'AbortError') {
         alert("Could not share. Try downloading the image instead.");
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col items-center py-10">
      <div className="w-full max-w-md mb-8">
        <div className="relative rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(255,255,255,0.1)] group">
          <img 
            src={imageUrl} 
            className="w-full h-auto" 
            alt="Generated Poster" 
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-yellow-500/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
        </div>
      </div>
      
      <div className="flex flex-col gap-4 w-full max-w-sm">
          <button 
            onClick={handleDownload}
            className="w-full bg-yellow-500 text-black py-4 rounded-xl font-black text-xl hover:bg-white transition-all flex items-center justify-center gap-3 uppercase tracking-wider"
          >
            DOWNLOAD POSTER ⬇
          </button>
          
          <div className="flex gap-4">
            <button 
              onClick={handleShare}
              className="flex-1 bg-white/10 border border-white/20 text-white py-4 rounded-xl font-bold hover:bg-white/20 transition-all uppercase tracking-wider"
            >
              SHARE
            </button>
            <button 
              onClick={onReset}
              className="flex-1 bg-white/10 border border-white/20 text-white py-4 rounded-xl font-bold hover:bg-white/20 transition-all uppercase tracking-wider"
            >
              CREATE NEW
            </button>
          </div>
      </div>
    </div>
  );
};

export default ResultDisplay;
