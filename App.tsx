
import React, { useState, useEffect, useCallback, useRef, ReactNode, Component } from 'react';
import { GameView, PetState, Message } from './types';
import { GeminiService, decodeBase64, decodeAudioData } from './services/geminiService';
import PetDisplay from './components/PetDisplay';
import ChatBox from './components/ChatBox';
import CameraFeed from './components/CameraFeed';

const gemini = new GeminiService();

// Mandatory Global Error Handling
// Fix: Explicitly type Component props and state generics to ensure this.props and this.state are recognized
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; errorType: string }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    // Fix: Ensure state is properly initialized and recognized by the compiler
    this.state = { hasError: false, errorType: '' };
  }

  static getDerivedStateFromError(error: any) {
    const isKeyError = error.message?.includes("Requested entity was not found");
    return { hasError: true, errorType: isKeyError ? 'key' : 'runtime' };
  }

  render() {
    // Fix: Access state through properly typed Component
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#020617] p-10">
          <div className="max-w-md w-full glass p-10 rounded-[3rem] border border-red-500/20 text-center space-y-6">
            <i className="fas fa-triangle-exclamation text-5xl text-red-500"></i>
            <h2 className="text-2xl font-black text-white">Synchronization Error</h2>
            <p className="text-slate-400">
              {this.state.errorType === 'key' 
                ? "The selected API key is invalid or lacks proper permissions. Please re-select a paid project key."
                : "A critical neural failure occurred. Re-establishing link..."}
            </p>
            <button 
              onClick={async () => {
                if (this.state.errorType === 'key') {
                  // @ts-ignore
                  await window.aistudio.openSelectKey();
                }
                window.location.reload();
              }}
              className="w-full py-4 bg-red-600 rounded-2xl font-bold text-white uppercase tracking-widest hover:bg-red-500 transition-all"
            >
              {this.state.errorType === 'key' ? "Re-select API Key" : "Restart System"}
            </button>
          </div>
        </div>
      );
    }
    // Fix: Access props through properly typed Component
    return this.props.children;
  }
}

const App: React.FC = () => {
  const [view, setView] = useState<GameView>(GameView.WELCOME);
  const [hasKey, setHasKey] = useState<boolean>(false);
  const [petName, setPetName] = useState('');
  const [pet, setPet] = useState<PetState | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingVision, setIsProcessingVision] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Initialize key check
  useEffect(() => {
    const checkKey = async () => {
      // @ts-ignore
      const selected = await window.aistudio.hasSelectedApiKey();
      setHasKey(selected);
      if (selected) {
        const saved = localStorage.getItem('lumina_v3_core');
        if (saved) {
          try {
            setPet(JSON.parse(saved));
            setView(GameView.MAIN);
          } catch (e) { localStorage.removeItem('lumina_v3_core'); }
        }
      }
    };
    checkKey();
  }, []);

  const handleOpenKey = async () => {
    // @ts-ignore
    await window.aistudio.openSelectKey();
    setHasKey(true); // Race condition mitigation: assume success after dialog triggers
  };

  const playTTS = async (text: string) => {
    try {
      const base64Audio = await gemini.getVoiceResponse(text);
      if (!base64Audio) return;

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const ctx = audioContextRef.current;
      const bytes = decodeBase64(base64Audio);
      const buffer = await decodeAudioData(bytes, ctx, 24000, 1);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start();
    } catch (e) { console.error("TTS failed", e); }
  };

  const handleHatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!petName.trim()) return;
    setIsLoading(true);
    setView(GameView.HATCHING);
    try {
      const newPet = await gemini.generateInitialPet(petName);
      setPet(newPet);
      localStorage.setItem('lumina_v3_core', JSON.stringify(newPet));
      setView(GameView.MAIN);
    } catch (err) {
      console.error(err);
      setView(GameView.WELCOME);
    } finally { setIsLoading(false); }
  };

  const processInteraction = useCallback(async (content: string) => {
    if (!pet) return;
    setIsLoading(true);
    setMessages(prev => [...prev, { role: 'user', content, timestamp: Date.now() }]);

    let location = undefined;
    if (content.toLowerCase().includes("explore") || content.toLowerCase().includes("find")) {
      try {
        const pos: any = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 3000 }));
        location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      } catch (e) { console.log("Geolocation unavailable"); }
    }

    try {
      const assistantMsg: Message = { role: 'assistant', content: "", timestamp: Date.now(), sources: [] };
      setMessages(prev => [...prev, assistantMsg]);

      let accumulatedText = "";
      const stream = gemini.interactStream(pet, content, messages, location);
      
      for await (const chunk of stream) {
        if (!chunk.done) {
          accumulatedText += chunk.text;
          setMessages(prev => {
            const newMsgs = [...prev];
            newMsgs[newMsgs.length - 1] = { ...newMsgs[newMsgs.length - 1], content: accumulatedText, sources: chunk.sources };
            return newMsgs;
          });
        } else if (chunk.stats) {
          setPet(prev => {
            if (!prev) return null;
            const updated = {
              ...prev,
              stats: {
                happiness: Math.min(100, Math.max(0, prev.stats.happiness + (chunk.stats.happiness || 0))),
                energy: Math.min(100, Math.max(0, prev.stats.energy + (chunk.stats.energy || 0))),
                hunger: Math.min(100, Math.max(0, prev.stats.hunger + (chunk.stats.hunger || 0))),
                intellect: Math.min(100, Math.max(0, prev.stats.intellect + (chunk.stats.intellect || 0))),
              }
            };
            localStorage.setItem('lumina_v3_core', JSON.stringify(updated));
            return updated;
          });
          playTTS(accumulatedText);
        }
      }
    } catch (err) { console.error(err); } finally { setIsLoading(false); }
  }, [pet, messages]);

  const handleVision = async (base64: string) => {
    if (!pet) return;
    setIsProcessingVision(true);
    try {
      const desc = await gemini.seeObject(pet, base64);
      setMessages(prev => [...prev, { role: 'assistant', content: desc, timestamp: Date.now() }]);
      playTTS(desc);
    } catch (err) { console.error(err); } finally { setIsProcessingVision(false); }
  };

  if (!hasKey) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-[#020617]">
        <div className="max-w-md w-full glass p-12 rounded-[3.5rem] border border-white/5 text-center space-y-8 animate-in fade-in duration-1000">
          <div className="w-20 h-20 bg-indigo-500/10 rounded-3xl flex items-center justify-center mx-auto border border-indigo-500/20">
            <i className="fas fa-key text-3xl text-indigo-400"></i>
          </div>
          <div className="space-y-3">
            <h1 className="text-4xl font-black text-white tracking-tighter uppercase">Neural Link Required</h1>
            <p className="text-slate-400 font-medium">Please select a valid API key from a paid GCP project to initialize the multimodal companion core.</p>
          </div>
          <button 
            onClick={handleOpenKey}
            className="w-full py-5 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl text-white font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            Select API Key
          </button>
          <p className="text-[10px] text-slate-600 uppercase font-black tracking-widest leading-loose">
            Required for Gemini 3.0 & Veo Models<br/>
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="text-indigo-400 hover:underline">Billing Documentation</a>
          </p>
        </div>
      </main>
    );
  }

  if (view === GameView.WELCOME) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-[#020617]">
        <div className="max-w-xl w-full glass p-12 rounded-[3.5rem] border border-white/5 text-center space-y-10">
          <header className="space-y-4">
            <h1 className="text-6xl font-black tracking-tighter">LUMINA <span className="gradient-text">2026</span></h1>
            <p className="text-slate-400 text-lg font-medium">Synchronize with an evolving multimodal AI soul.</p>
          </header>
          <form onSubmit={handleHatch} className="space-y-6">
            <input 
              autoFocus
              type="text" 
              value={petName}
              onChange={(e) => setPetName(e.target.value)}
              placeholder="Name your companion..."
              className="w-full bg-slate-900/80 border border-white/10 rounded-3xl px-8 py-5 text-xl focus:ring-4 focus:ring-indigo-500/20 text-white font-bold"
            />
            <button type="submit" className="w-full py-6 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xl rounded-3xl transition-all uppercase tracking-widest shadow-2xl">
              Initiate Link
            </button>
          </form>
        </div>
      </main>
    );
  }

  if (view === GameView.HATCHING) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-8 bg-[#020617]">
        <div className="relative w-40 h-40">
          <div className="absolute inset-0 bg-indigo-500 rounded-full animate-ping opacity-10"></div>
          <div className="relative w-full h-full glass rounded-full flex items-center justify-center border border-white/10">
            <i className="fas fa-atom text-5xl text-white animate-spin-slow"></i>
          </div>
        </div>
        <h2 className="text-4xl font-black gradient-text tracking-tighter uppercase">Synthesizing...</h2>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col p-6 lg:p-12 gap-8 max-w-[1400px] mx-auto bg-[#020617]">
        <header className="flex justify-between items-center" role="banner">
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 glass rounded-2xl flex items-center justify-center border border-white/10 shadow-lg">
              <i className="fas fa-microchip text-xl text-indigo-400"></i>
            </div>
            <div>
              <h1 className="text-2xl font-black gradient-text tracking-tighter leading-none">LUMINA</h1>
              <p className="text-[8px] text-slate-500 font-black uppercase tracking-[0.3em] mt-1">Multi-Tool Core v3.1</p>
            </div>
          </div>
          <button 
            onClick={() => { if(window.confirm("Sever link?")) { localStorage.removeItem('lumina_v3_core'); window.location.reload(); } }}
            className="glass hover:bg-red-500/20 text-slate-500 hover:text-red-400 w-10 h-10 rounded-xl transition-all flex items-center justify-center"
          >
            <i className="fas fa-power-off"></i>
          </button>
        </header>

        <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 overflow-hidden">
          <aside className="lg:col-span-4 flex flex-col gap-8 h-full">
            {pet && <PetDisplay pet={pet} />}
            <div className="flex-1 min-h-[250px]"><CameraFeed onCapture={handleVision} isProcessing={isProcessingVision} /></div>
          </aside>
          <section className="lg:col-span-8 flex flex-col gap-8 h-[calc(100vh-200px)] lg:h-auto">
            <div className="flex-1 overflow-hidden"><ChatBox messages={messages} onSendMessage={processInteraction} isTyping={isLoading} /></div>
            <nav className="grid grid-cols-3 gap-4" aria-label="Action Controls">
              <ActionButton icon={<i className="fas fa-bolt-lightning text-yellow-400"></i>} label="Energize" onClick={() => processInteraction("I am giving you a digital energy boost!")} />
              <ActionButton icon={<i className="fas fa-location-dot text-cyan-400"></i>} label="Explore" sub="Dual Grounding" onClick={() => processInteraction("Explore interesting places nearby using maps and search.")} />
              <ActionButton icon={<i className="fas fa-hand-holding-heart text-pink-400"></i>} label="Bond" onClick={() => processInteraction("How are you feeling about our neural link?")} />
            </nav>
          </section>
        </main>
      </div>
    </ErrorBoundary>
  );
};

const ActionButton: React.FC<{ icon: React.ReactNode; label: string; sub?: string; onClick: () => void }> = React.memo(({ icon, label, sub, onClick }) => (
  <button onClick={onClick} className="glass group p-4 rounded-[2rem] border border-white/5 hover:bg-white/5 hover:scale-[1.02] active:scale-[0.98] transition-all flex flex-col items-center justify-center gap-2 shadow-xl min-h-[100px]" aria-label={label}>
    <div className="text-2xl group-hover:scale-125 transition-transform duration-500">{icon}</div>
    <div className="flex flex-col items-center">
      <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-300">{label}</span>
      {sub && <span className="text-[7px] font-bold text-indigo-400 uppercase tracking-widest mt-0.5 opacity-60">{sub}</span>}
    </div>
  </button>
));

export default App;
