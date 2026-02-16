import React from 'react';
import { PetState } from '../types';
import { ICONS, MAX_STAT } from '../constants';

interface PetDisplayProps {
  pet: PetState;
}

const StatBar: React.FC<{ label: string; value: number; icon: React.ReactNode }> = ({ label, value, icon }) => {
  const percentage = Math.min(100, Math.max(0, (value / MAX_STAT) * 100));
  return (
    <div className="flex flex-col gap-1.5" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
        <span className="flex items-center gap-2">{icon} {label}</span>
        <span className="tabular-nums">{Math.round(value)}%</span>
      </div>
      <div className="h-2 w-full bg-slate-800/50 rounded-full overflow-hidden border border-white/5 shadow-inner">
        <div 
          className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-1000 cubic-bezier(0.34, 1.56, 0.64, 1)" 
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

const PetDisplay: React.FC<PetDisplayProps> = React.memo(({ pet }) => {
  return (
    <section className="flex flex-col gap-6 w-full max-w-md mx-auto lg:max-w-none" aria-label="Companion Status">
      {/* Enhanced Image Container with 3D Hover Effects */}
      <div className="relative group perspective-1000">
        {/* Dynamic Glow Aura */}
        <div className="absolute -inset-4 bg-gradient-to-tr from-indigo-600/20 via-purple-600/20 to-pink-600/20 rounded-[3rem] blur-2xl opacity-40 group-hover:opacity-70 transition-opacity duration-700"></div>
        
        <div className="relative aspect-square rounded-[2.5rem] overflow-hidden glass border border-white/10 shadow-2xl animate-float transform-gpu transition-all duration-700 ease-out group-hover:scale-[1.02] group-hover:rotate-x-2 group-hover:rotate-y-2 group-hover:shadow-indigo-500/10">
          {/* Subtle Scanning Overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-transparent h-1/2 w-full animate-pulse pointer-events-none z-10"></div>
          
          <img 
            src={pet.imageUrl} 
            alt={`Visual core of ${pet.name}`} 
            className="w-full h-full object-cover transition-transform duration-[2000ms] ease-out group-hover:scale-110"
            loading="lazy"
          />
          
          {/* Inner Vignette for Depth */}
          <div className="absolute inset-0 shadow-[inset_0_0_80px_rgba(0,0,0,0.4)] pointer-events-none"></div>
        </div>

        {/* Floating Name Tag */}
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 z-20 transition-transform duration-500 group-hover:-translate-y-2">
          <div className="bg-slate-900/95 backdrop-blur-xl px-10 py-3 rounded-2xl border border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.5)] ring-1 ring-white/5">
            <h2 className="text-2xl md:text-3xl font-black gradient-text tracking-tighter uppercase whitespace-nowrap">
              {pet.name}
            </h2>
          </div>
        </div>
      </div>

      {/* Stats and Traits Card */}
      <div className="mt-4 flex flex-col gap-5 glass p-7 rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden">
        {/* Tech Corner Decoration */}
        <div className="absolute top-0 right-0 w-16 h-16 border-t-2 border-r-2 border-indigo-500/20 rounded-tr-[2.5rem] pointer-events-none"></div>
        
        <div className="flex flex-col gap-3 pb-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]"></span>
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-400/80">Neural Identity</span>
          </div>
          <p className="text-sm font-medium text-slate-300 italic leading-relaxed">
            "{pet.personality}"
          </p>
          
          {pet.traits && pet.traits.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {pet.traits.map((trait, idx) => (
                <span 
                  key={idx} 
                  className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[9px] font-black text-indigo-200 uppercase tracking-widest hover:border-indigo-500/50 transition-colors cursor-default"
                >
                  {trait}
                </span>
              ))}
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
          <StatBar label="Happiness" value={pet.stats.happiness} icon={ICONS.Happiness} />
          <StatBar label="Energy" value={pet.stats.energy} icon={ICONS.Energy} />
          <StatBar label="Hunger" value={pet.stats.hunger} icon={ICONS.Hunger} />
          <StatBar label="Intellect" value={pet.stats.intellect} icon={ICONS.Intellect} />
        </div>
      </div>
    </section>
  );
});

export default PetDisplay;