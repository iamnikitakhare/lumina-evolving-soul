
import React from 'react';
import { PetState } from '../types';
import { ICONS, MAX_STAT } from '../constants';

interface PetDisplayProps {
  pet: PetState;
}

const StatBar: React.FC<{ label: string; value: number; icon: React.ReactNode }> = ({ label, value, icon }) => {
  const percentage = (value / MAX_STAT) * 100;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-center text-xs font-semibold uppercase tracking-wider text-slate-400">
        <span className="flex items-center gap-2">{icon} {label}</span>
        <span>{value}%</span>
      </div>
      <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700">
        <div 
          className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-500" 
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

const PetDisplay: React.FC<PetDisplayProps> = ({ pet }) => {
  return (
    <div className="flex flex-col gap-8">
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-pink-600 to-purple-600 rounded-3xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
        <div className="relative aspect-square rounded-3xl overflow-hidden glass border border-slate-700/50 animate-float">
          <img 
            src={pet.imageUrl} 
            alt={pet.name} 
            className="w-full h-full object-cover"
          />
        </div>
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/80 backdrop-blur px-6 py-2 rounded-full border border-slate-700 shadow-2xl">
          <h2 className="text-2xl font-bold gradient-text">{pet.name}</h2>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 glass p-6 rounded-3xl border border-slate-700/50 shadow-xl">
        <StatBar label="Happiness" value={pet.stats.happiness} icon={ICONS.Happiness} />
        <StatBar label="Energy" value={pet.stats.energy} icon={ICONS.Energy} />
        <StatBar label="Hunger" value={pet.stats.hunger} icon={ICONS.Hunger} />
        <StatBar label="Intellect" value={pet.stats.intellect} icon={ICONS.Intellect} />
      </div>
    </div>
  );
};

export default PetDisplay;
