
import React, { useEffect, useState } from 'react';

const Processing: React.FC = () => {
  const [progress, setProgress] = useState(0);
  const messages = [
    "Injecting raw star power...",
    "Adjusting cinematic lighting...",
    "Applying blockbuster color grading...",
    "Replacing face with legendary lead actor...",
    "Finalizing credits and title design...",
    "Generating Oscar buzz..."
  ];
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(p => Math.min(p + 1, 99));
    }, 100);
    
    const msgInterval = setInterval(() => {
      setMsgIndex(i => (i + 1) % messages.length);
    }, 2000);

    return () => {
      clearInterval(interval);
      clearInterval(msgInterval);
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="relative w-48 h-48 mb-10">
        <div className="absolute inset-0 border-4 border-white/10 rounded-full" />
        <div 
          className="absolute inset-0 border-4 border-yellow-500 rounded-full border-t-transparent animate-spin"
          style={{ animationDuration: '1.5s' }}
        />
        <div className="absolute inset-0 flex items-center justify-center font-oswald text-4xl font-bold">
          {progress}%
        </div>
      </div>
      
      <h2 className="text-3xl font-oswald font-bold uppercase tracking-widest mb-4">
        Creating Your <span className="text-yellow-500">Masterpiece</span>
      </h2>
      <p className="text-white/60 text-lg animate-pulse h-8">
        {messages[msgIndex]}
      </p>
    </div>
  );
};

export default Processing;
