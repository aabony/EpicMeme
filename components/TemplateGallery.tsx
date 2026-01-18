
import React from 'react';
import { TEMPLATES } from '../data/templates';
import { MemeTemplate } from '../types';

interface TemplateGalleryProps {
  onSelect: (template: MemeTemplate) => void;
}

const TemplateGallery: React.FC<TemplateGalleryProps> = ({ onSelect }) => {
  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="text-center mb-16">
        <h2 className="text-5xl font-oswald font-bold uppercase tracking-tighter mb-4">
          Choose Your <span className="text-yellow-500">Poster</span>
        </h2>
        <p className="text-white/60 text-lg max-w-2xl mx-auto">
          Select a template to begin your cinematic transformation.
        </p>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {TEMPLATES.map((t) => (
          <div 
            key={t.id}
            onClick={() => onSelect(t)}
            className="group cursor-pointer transition-all transform hover:-translate-y-2"
          >
            <div className="relative rounded-3xl overflow-hidden aspect-[2/3] border border-white/10 group-hover:border-yellow-500/50 transition-all shadow-2xl bg-white/5">
              <img 
                src={t.coverImage} 
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                alt={t.title}
                onError={(e) => {
                   // Fallback if asset is missing
                   (e.target as HTMLImageElement).src = `https://placehold.co/400x600/1a1a1a/white?text=${encodeURIComponent(t.title)}`;
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-90" />
              <div className="absolute bottom-0 p-6 w-full">
                <div className="bg-yellow-500 text-black text-[10px] font-bold px-2 py-1 rounded w-fit mb-2 uppercase tracking-widest">
                  {t.category}
                </div>
                <p className="font-oswald text-2xl font-bold uppercase leading-none mb-2">{t.title}</p>
              </div>
              
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-[2px]">
                <button className="bg-white text-black px-6 py-3 rounded-full font-bold uppercase text-sm tracking-widest transform translate-y-4 group-hover:translate-y-0 transition-transform">
                  Select Template
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TemplateGallery;
