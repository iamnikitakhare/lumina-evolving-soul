import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameView, PetState, Message } from './types';
import { GeminiService } from './services/geminiService';
import PetDisplay from './components/PetDisplay';
import ChatBox from './components/ChatBox';
import CameraFeed from './components/CameraFeed';
import { LiveServerMessage } from '@google/genai';

const gemini = new GeminiService();

const App: React.FC = () => {
  const [view, setView] = useState<GameView>(GameView.WELCOME);
  const [petName, setPetName] = useState('');
  const [pet, setPet] = useState<PetState | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingVision, setIsProcessingVision] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loadingMsg, setLoadingMsg] = useState("");
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const liveSessionRef = useRef<any>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);

  useEffect(() => {
    const saved = localStorage.getItem('lumina_v3_core');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.name) {
          setPet(parsed);
          setView(GameView.MAIN);
        }
      } catch (e) { localStorage.removeItem('lumina_v3_core'); }
    }
  }, []);

  useEffect(() => {
    if (pet) localStorage.setItem('lumina_v3_core', JSON.stringify(pet));
  }, [pet]);

  const ensureKey = async () => {
    // @ts-ignore
    const hasKey = await window.aistudio.hasSelectedApiKey();
    if (!hasKey) {
      // @ts-ignore
      await window.aistudio.openSelectKey();
    }
  };

  const handleHatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!petName.trim()) return;
    await ensureKey();
    setIsLoading(true);
    setView(GameView.HATCHING);
    try {
      const newPet = await gemini.generateInitialPet(petName);
      setPet(newPet);
      setView(GameView.MAIN);
    } catch (err) {
      console.error(err);
      setView(GameView.WELCOME);
    } finally { setIsLoading(false); }
  };

  const generateMemory = async () => {
    if (!pet) return;
    await ensureKey();
    setIsLoading(true);
    const messages = [
      "Accessing GCP Compute Nodes...",
      "Allocating GPU resources for Veo engine...",
      "Dreaming of your soul's architecture...",
      "Rendering cinematic memory sequences...",
      "Finalizing multimodal stream..."
    ];
    let msgIdx = 0;
    const interval = setInterval(() => {
      setLoadingMsg(messages[msgIdx % messages.length]);
      msgIdx++;
    }, 10000);

    try {
      const url = await gemini.generateMemoryVideo(pet);
      setVideoUrl(url);
      setPet(prev => prev ? { ...prev, memories: [...(prev.memories || []), url] } : null);
    } catch (err) {
      console.error(err);
      alert("Neural synthesis failed. Check your GCP billing project.");
    } finally {
      clearInterval(interval);
      setIsLoading(false);
      setLoadingMsg("");
    }
  };

  const playTTS = async (text: string) => {
    try {
      const base64Audio = await gemini.getVoiceResponse(text);
      if (!base64Audio) return;
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const ctx = audioContextRef.current;
      const bytes = new Uint8Array(atob(base64Audio).split('').map(c => c.charCodeAt(0)));
      const dataInt16 = new Int16Array(bytes.buffer);
      const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
      const channelData = buffer.getChannelData(0);
      for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start();
    } catch (e) { console.warn("TTS Failed", e); }
  };

  const startLiveMode = async () => {
    if (!pet) return;
    await ensureKey();
    setView(GameView.LIVING);
    const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    const sessionPromise = gemini.connectLive(pet, {
      onopen: () => {
        const source = inputCtx.createMediaStreamSource(stream);
        const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
        scriptProcessor.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          const int16 = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
          const base64 = btoa(String.fromCharCode(...new Uint8Array(int16.buffer)));
          sessionPromise.then(s => s.sendRealtimeInput({ media: { data: base64, mimeType: 'audio/pcm;rate=16000' } }));
        };
        source.connect(scriptProcessor);
        scriptProcessor.connect(inputCtx.destination);
      },
      onmessage: async (msg: LiveServerMessage) => {
        const base64 = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
        if (base64) {
          nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
          const bytes = new Uint8Array(atob(base64).split('').map(c => c.charCodeAt(0)));
          const dataInt16 = new Int16Array(bytes.buffer);
          const buffer = outputCtx.createBuffer(1, dataInt16.length, 24000);
          const channelData = buffer.getChannelData(0);
          for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;
          const source = outputCtx.createBufferSource();
          source.buffer = buffer;
          source.connect(outputCtx.destination);
          source.addEventListener('ended', () => sourcesRef.current.delete(source));
          source.start(nextStartTimeRef.current);
          nextStartTimeRef.current += buffer.duration;
          sourcesRef.current.add(source);
        }
        if (msg.serverContent?.interrupted) {
          sourcesRef.current.forEach(s => s.stop());
          sourcesRef.current.clear();
          nextStartTimeRef.current = 0;
        }
      }
    });
    liveSessionRef.current = { sessionPromise, inputCtx, outputCtx, stream };
  };

  const stopLiveMode = () => {
    if (liveSessionRef.current) {
      const { sessionPromise, inputCtx, outputCtx, stream } = liveSessionRef.current;
      sessionPromise.then((s: any) => s.close());
      inputCtx.close();
      outputCtx.close();
      stream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
      liveSessionRef.current = null;
    }
    setView(GameView.MAIN);
  };

  const processInteraction = useCallback(async (content: string) => {
    if (!pet) return;
    setIsLoading(true);
    setMessages(prev => [...prev, { role: 'user', content, timestamp: Date.now() }]);
    let userLoc = undefined;
    if (content.toLowerCase().includes("explore")) {
      try {
        const pos: any = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, {timeout: 5000}));
        userLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      } catch (e) {}
    }

    try {
      const assistantMsg: Message = { role: 'assistant', content: "", timestamp: Date.now(), sources: [] };
      setMessages(prev => [...prev, assistantMsg]);
      let accumulatedText = "";
      const stream = gemini.interactStream(pet, content, messages, userLoc);
      for await (const chunk of stream) {
        if (!chunk.done) {
          accumulatedText += chunk.text;
          setMessages(prev => {
            const newMsgs = [...prev];
            const last = newMsgs[newMsgs.length - 1];
            last.content = accumulatedText;
            last.sources = chunk.sources;
            return newMsgs;
          });
        } else if (chunk.stats) {
          setPet(prev => prev ? {
            ...prev,
            stats: {
              happiness: Math.min(100, Math.max(0, prev.stats.happiness + (chunk.stats.happiness || 0))),
              energy: Math.min(100, Math.max(0, prev.stats.energy + (chunk.stats.energy || 0))),
              hunger: Math.min(100, Math.max(0, prev.stats.hunger + (chunk.stats.hunger || 0))),
              intellect: Math.min(100, Math.max(0, prev.stats.intellect + (chunk.stats.intellect || 0))),
            }
          } : null);
          playTTS(accumulatedText);
        }
      }
    } catch (err) { console.error(err); } finally { setIsLoading(false); }
  }, [pet, messages]);

  if (view === GameView.WELCOME) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-[#020617]">
        <div className="max-w-xl w-full glass p-12 rounded-[3.5rem] border border-white/5 shadow-2xl text-center space-y-10 animate-in fade-in zoom-in duration-700">
          <header className="space-y-4">
            <h1 className="text-6xl font-black tracking-tighter text-white">LUMINA <span className="gradient-text">2026</span></h1>
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
            <button type="submit" className="w-full py-6 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 hover:scale-[1.02] active:scale-[0.98] text-white font-black text-xl rounded-3xl transition-all uppercase tracking-widest">
              Initiate Link
            </button>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">GCP Billing Account Required</p>
          </form>
        </div>
      </main>
    );
  }

  if (view === GameView.HATCHING) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-10 text-center">
        <div className="relative glass p-20 rounded-[4rem] border border-white/10 flex flex-col items-center gap-8 overflow-hidden">
          <div className="absolute inset-0 bg-indigo-500/10 animate-pulse"></div>
          <div className="w-24 h-24 rounded-full border-4 border-t-indigo-500 border-indigo-500/20 animate-spin relative z-10"></div>
          <h2 className="text-4xl font-black text-white tracking-tighter relative z-10">SYNCHRONIZING SOUL...</h2>
          <p className="text-slate-400 font-medium max-w-sm relative z-10">Compiling personality matrices on Google Cloud Compute...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col p-6 md:p-12 gap-8 max-w-[1400px] mx-auto bg-[#020617]">
      <header className="flex justify-between items-center">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 glass rounded-2xl flex items-center justify-center border border-white/10 shadow-lg">
            <i className="fas fa-brain text-2xl text-indigo-400"></i>
          </div>
          <div>
            <h1 className="text-3xl font-black gradient-text tracking-tighter leading-none">LUMINA</h1>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] mt-1">GCP MULTIMODAL CORE</p>
          </div>
        </div>
        <div className="flex gap-4">
          <button onClick={startLiveMode} className="glass px-6 py-2 rounded-2xl border border-indigo-500/30 text-indigo-400 font-bold text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-500/10 transition-all">
            <span className="w-2 h-2 bg-indigo-500 rounded-full animate-ping"></span> Live Link
          </button>
          <button onClick={() => { if(confirm("Sever link?")) { localStorage.removeItem('lumina_v3_core'); window.location.reload(); } }} className="glass hover:bg-red-500/20 text-slate-500 hover:text-red-400 w-12 h-12 rounded-2xl transition-all flex items-center justify-center">
            <i className="fas fa-power-off"></i>
          </button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 overflow-hidden">
        <aside className="lg:col-span-4 flex flex-col gap-8">
          {pet && <PetDisplay pet={pet} />}
          <div className="flex-1 min-h-[250px]">
            <CameraFeed onCapture={async (b64) => {
              setIsProcessingVision(true);
              const desc = await gemini.seeObject(pet!, b64);
              setMessages(prev => [...prev, { role: 'assistant', content: desc, timestamp: Date.now() }]);
              playTTS(desc);
              setIsProcessingVision(false);
            }} isProcessing={isProcessingVision} />
          </div>
        </aside>
        
        <section className="lg:col-span-8 flex flex-col gap-8 h-[calc(100vh-250px)] lg:h-auto relative">
          <div className="flex-1 overflow-hidden">
            <ChatBox messages={messages} onSendMessage={processInteraction} isTyping={isLoading && !loadingMsg} />
          </div>
          <nav className="grid grid-cols-3 gap-4">
            <ActionButton icon={<i className="fas fa-video text-pink-400"></i>} label="Memory" sub="Veo Generator" onClick={generateMemory} />
            <ActionButton icon={<i className="fas fa-location-dot text-cyan-400"></i>} label="Explore" onClick={() => processInteraction("Show me interesting places nearby.")} />
            <ActionButton icon={<i className="fas fa-bolt-lightning text-yellow-400"></i>} label="Charge" onClick={() => processInteraction("System energize!")} />
          </nav>

          {isLoading && loadingMsg && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl z-50 flex flex-col items-center justify-center p-10 text-center gap-6 rounded-[2.5rem] border border-white/10 animate-in fade-in duration-500">
              <div className="w-24 h-24 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
              <p className="text-2xl font-black text-white tracking-tight animate-pulse uppercase">{loadingMsg}</p>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Processing on Google Veo Engine</p>
            </div>
          )}

          {videoUrl && (
            <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-2xl z-[60] flex flex-col items-center justify-center p-6 rounded-[2.5rem] border-2 border-indigo-500/30 shadow-[0_0_100px_rgba(99,102,241,0.2)]">
              <button onClick={() => setVideoUrl(null)} className="absolute top-6 right-6 text-white/50 hover:text-white text-3xl transition-colors"><i className="fas fa-times"></i></button>
              <h3 className="text-3xl font-black gradient-text mb-8 tracking-tighter">SOUL MEMORY VISUALIZED</h3>
              <video src={videoUrl} controls autoPlay className="w-full rounded-3xl shadow-2xl border border-white/10" />
              <div className="mt-8 flex items-center gap-4">
                <div className="px-4 py-2 glass rounded-full text-[10px] font-black text-indigo-400 uppercase tracking-widest border border-indigo-500/30">VEEO-3.1-SYNTHESIS</div>
                <div className="px-4 py-2 glass rounded-full text-[10px] font-black text-slate-400 uppercase tracking-widest border border-white/10">720P CINEMATIC</div>
              </div>
            </div>
          )}

          {view === GameView.LIVING && (
            <div className="absolute inset-0 bg-slate-950/98 backdrop-blur-3xl z-[70] flex flex-col items-center justify-center p-10 text-center rounded-[2.5rem] border-2 border-indigo-500/50">
              <div className="relative mb-12">
                <div className="absolute inset-0 bg-indigo-500/40 blur-3xl rounded-full animate-ping"></div>
                <div className="w-48 h-48 glass rounded-full flex items-center justify-center border-4 border-indigo-500 shadow-[0_0_80px_rgba(99,102,241,0.6)]">
                  <i className="fas fa-microphone-lines text-6xl text-indigo-400 animate-pulse"></i>
                </div>
              </div>
              <h2 className="text-5xl font-black text-white mb-4 tracking-tighter">NEURAL SYNC ACTIVE</h2>
              <p className="text-indigo-300 font-medium mb-12 max-w-sm">Real-time multimodal link established. Speak naturally to your companion.</p>
              <button onClick={stopLiveMode} className="px-16 py-6 bg-red-600 hover:bg-red-700 text-white font-black rounded-3xl transition-all uppercase tracking-[0.2em] shadow-2xl shadow-red-900/50 hover:scale-105 active:scale-95">
                Sever Link
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

const ActionButton: React.FC<{ icon: React.ReactNode; label: string; sub?: string; onClick: () => void }> = ({ icon, label, sub, onClick }) => (
  <button onClick={onClick} className="glass group p-5 rounded-[2rem] border border-white/5 hover:bg-white/10 transition-all flex flex-col items-center justify-center gap-1 shadow-xl min-h-[110px]">
    <div className="text-3xl mb-1 group-hover:scale-110 transition-transform">{icon}</div>
    <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">{label}</span>
    {sub && <span className="text-[8px] font-bold text-indigo-400 uppercase tracking-tighter opacity-70">{sub}</span>}
  </button>
);

export default App;