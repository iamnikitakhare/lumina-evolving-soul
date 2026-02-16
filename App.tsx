
import React, { useState, useEffect, useCallback } from 'react';
import { GameView, PetState, Message } from './types';
import { GeminiService } from './services/geminiService';
import PetDisplay from './components/PetDisplay';
import ChatBox from './components/ChatBox';
import CameraFeed from './components/CameraFeed';

const gemini = new GeminiService();

const App: React.FC = () => {
  const [view, setView] = useState<GameView>(GameView.WELCOME);
  const [petName, setPetName] = useState('');
  const [pet, setPet] = useState<PetState | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingVision, setIsProcessingVision] = useState(false);

  // Load pet from local storage
  useEffect(() => {
    const saved = localStorage.getItem('lumina_pet');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setPet(parsed);
        setView(GameView.MAIN);
      } catch (e) {
        console.error("Failed to load pet:", e);
      }
    }
  }, []);

  // Save pet to local storage
  useEffect(() => {
    if (pet) {
      localStorage.setItem('lumina_pet', JSON.stringify(pet));
    }
  }, [pet]);

  const handleHatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!petName.trim()) return;
    
    setIsLoading(true);
    setView(GameView.HATCHING);
    try {
      const newPet = await gemini.generateInitialPet(petName);
      setPet(newPet);
      setView(GameView.MAIN);
    } catch (err) {
      console.error("Hatching failed:", err);
      alert("The cosmic alignment failed. Please try again.");
      setView(GameView.WELCOME);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!pet) return;

    const userMsg: Message = { role: 'user', content, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const { response, updatedStats } = await gemini.processInteraction(pet, content, messages);
      const assistantMsg: Message = { role: 'assistant', content: response, timestamp: Date.now() };
      
      setMessages(prev => [...prev, assistantMsg]);
      setPet(prev => prev ? { ...prev, stats: updatedStats } : null);
    } catch (err) {
      console.error("Chat error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVision = async (base64: string) => {
    if (!pet) return;
    setIsProcessingVision(true);
    try {
      const description = await gemini.seeObject(pet, base64);
      setMessages(prev => [...prev, { role: 'assistant', content: description, timestamp: Date.now() }]);
    } catch (err) {
      console.error("Vision error:", err);
    } finally {
      setIsProcessingVision(false);
    }
  };

  const resetGame = () => {
    if (confirm("Reset Lumina and start a new soul connection?")) {
      localStorage.removeItem('lumina_pet');
      setPet(null);
      setMessages([]);
      setView(GameView.WELCOME);
    }
  };

  if (view === GameView.WELCOME) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-lg w-full glass p-10 rounded-[3rem] border border-slate-700/50 shadow-2xl text-center space-y-8 animate-float">
          <div className="space-y-4">
            <h1 className="text-5xl font-extrabold tracking-tight">
              LUMINA <span className="gradient-text font-black">2026</span>
            </h1>
            <p className="text-slate-400 leading-relaxed text-lg">
              Reimagine the virtual companion of your childhood. No longer just sprites on a screen, 
              Lumina is a multimodal soul that evolves with your reality.
            </p>
          </div>
          
          <form onSubmit={handleHatch} className="space-y-6">
            <div className="space-y-2 text-left">
              <label className="text-sm font-bold uppercase tracking-widest text-indigo-400 px-1">Companion Name</label>
              <input 
                type="text" 
                value={petName}
                onChange={(e) => setPetName(e.target.value)}
                placeholder="Enter a name to begin..."
                className="w-full bg-slate-900/50 border-2 border-slate-700/50 rounded-2xl px-6 py-4 text-xl focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-white"
              />
            </div>
            <button 
              type="submit"
              className="w-full py-5 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-bold text-xl rounded-2xl shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] pulse-glow"
            >
              Hatch Your Companion
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (view === GameView.HATCHING) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-8">
        <div className="relative">
          <div className="w-48 h-48 bg-gradient-to-tr from-indigo-500 to-pink-500 rounded-full animate-ping opacity-20"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-32 h-32 bg-white/10 backdrop-blur rounded-full flex items-center justify-center animate-pulse">
              <i className="fas fa-dna text-4xl text-white"></i>
            </div>
          </div>
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold gradient-text">Weaving Cosmic Strings...</h2>
          <p className="text-slate-400">Gemini is synthesizing a unique personality and form for {petName}.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col p-4 md:p-10 gap-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 glass rounded-2xl flex items-center justify-center">
            <i className="fas fa-sparkles text-purple-500"></i>
          </div>
          <div>
            <h1 className="text-2xl font-black gradient-text">LUMINA</h1>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">v2.026.04</p>
          </div>
        </div>
        
        <button 
          onClick={resetGame}
          className="glass hover:bg-red-500/10 hover:border-red-500/50 text-slate-400 hover:text-red-500 p-3 rounded-2xl transition-all"
          title="Release companion"
        >
          <i className="fas fa-power-off"></i>
        </button>
      </div>

      {/* Main Game Area */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Pet Column */}
        <div className="lg:col-span-5 flex flex-col gap-8">
          {pet && <PetDisplay pet={pet} />}
          
          <div className="flex-1">
             <CameraFeed onCapture={handleVision} isProcessing={isProcessingVision} />
          </div>
        </div>

        {/* Interaction Column */}
        <div className="lg:col-span-7 flex flex-col gap-8 h-full">
          <div className="flex-1">
            <ChatBox 
              messages={messages} 
              onSendMessage={handleSendMessage} 
              isTyping={isLoading} 
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <QuickAction 
              icon={<i className="fas fa-cookie text-orange-400"></i>} 
              label="Feed" 
              onClick={() => handleSendMessage("I'm giving you a tasty digital snack!")} 
            />
            <QuickAction 
              icon={<i className="fas fa-gamepad text-indigo-400"></i>} 
              label="Play" 
              onClick={() => handleSendMessage("Let's play a game together!")} 
            />
            <QuickAction 
              icon={<i className="fas fa-book-open text-emerald-400"></i>} 
              label="Learn" 
              onClick={() => handleSendMessage("Tell me something fascinating you've discovered.")} 
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const QuickAction: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void }> = ({ icon, label, onClick }) => (
  <button 
    onClick={onClick}
    className="glass p-6 rounded-[2rem] border border-slate-700/50 hover:bg-slate-700/30 hover:scale-105 active:scale-95 transition-all flex flex-col items-center gap-3 group shadow-lg"
  >
    <div className="text-3xl group-hover:scale-110 transition-transform">{icon}</div>
    <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{label}</span>
  </button>
);

export default App;
