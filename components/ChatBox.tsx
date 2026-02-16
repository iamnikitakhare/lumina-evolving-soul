
import React, { useState, useRef, useEffect } from 'react';
import { Message } from '../types';

interface ChatBoxProps {
  messages: Message[];
  onSendMessage: (text: string, useSearch?: boolean) => void;
  isTyping: boolean;
}

const ChatBox: React.FC<ChatBoxProps> = ({ messages, onSendMessage, isTyping }) => {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSendMessage(input);
    setInput('');
  };

  return (
    <section className="flex flex-col h-full glass rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl bg-slate-950/20" aria-label="Communication Interface">
      <header className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-white/5">
        <h3 className="font-bold text-slate-300 flex items-center gap-3 text-sm tracking-widest uppercase">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
          Neural Link Active
        </h3>
      </header>

      <div 
        ref={scrollRef} 
        className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth"
        aria-live="polite"
      >
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-4 opacity-30">
            <i className="fas fa-satellite-dish text-5xl"></i>
            <p className="font-medium">Waiting for transmission...</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} gap-2`}>
            <div className={`max-w-[85%] px-5 py-3 rounded-[1.5rem] text-sm leading-relaxed ${
              msg.role === 'user' 
                ? 'bg-indigo-600 text-white rounded-br-none shadow-lg shadow-indigo-900/20' 
                : 'bg-slate-800/80 text-slate-200 border border-white/5 rounded-bl-none shadow-lg'
            }`}>
              {msg.content}
            </div>
            {msg.sources && msg.sources.length > 0 && (
              <div className="flex flex-wrap gap-2 px-1">
                {msg.sources.map((s, idx) => (
                  <a 
                    key={idx} 
                    href={s.uri} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[10px] bg-white/5 hover:bg-white/10 border border-white/10 rounded-full px-2 py-0.5 text-indigo-300 transition-colors flex items-center gap-1"
                  >
                    <i className="fas fa-link text-[8px]"></i> {s.title}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-slate-800/50 px-5 py-3 rounded-2xl rounded-bl-none border border-white/5 flex gap-1.5 items-center">
              <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></div>
              <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
              <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-4 bg-white/5 border-t border-white/5 flex gap-3">
        <input 
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Transmit message..."
          className="flex-1 bg-slate-900/50 border border-white/10 rounded-2xl px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-white placeholder:text-slate-600"
          aria-label="Chat input"
        />
        <button 
          type="submit"
          className="bg-indigo-600 hover:bg-indigo-500 text-white w-12 h-12 rounded-2xl flex items-center justify-center transition-all disabled:opacity-30 disabled:grayscale shadow-lg shadow-indigo-900/40"
          disabled={!input.trim() || isTyping}
          aria-label="Send Message"
        >
          <i className="fas fa-paper-plane text-lg"></i>
        </button>
      </form>
    </section>
  );
};

export default ChatBox;
