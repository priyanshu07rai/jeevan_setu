import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, User, Loader2, Image as ImageIcon } from 'lucide-react';

export default function AIChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: "I am your AI Survival Assistant. How can I help you today?" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  
  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!input.trim() && !isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch('https://jeevansetu-api.onrender.com/api/v2/ai-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: userMessage })
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();
      setMessages(prev => [...prev, { role: 'assistant', text: data.reply }]);
    } catch (error) {
      console.error('Error fetching AI response:', error);
      setMessages(prev => [...prev, { role: 'assistant', text: "⚠ ERROR: Uplink failed. Cannot reach AI core via Grok API." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button 
          onClick={() => setIsOpen(true)}
          className="fixed bottom-8 right-8 w-16 h-16 bg-[#e8630a] hover:bg-[#ff7a21] text-white rounded-full shadow-[0_8px_32px_rgba(232,99,10,0.4)] flex items-center justify-center transition-all z-[9999] hover:scale-110 active:scale-95"
        >
          <MessageSquare size={28} />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-8 right-8 w-96 h-[600px] bg-[#080b10] border border-[#e8630a]33 shadow-[0_20px_50px_rgba(0,0,0,0.8)] rounded-3xl flex flex-col z-[9999] overflow-hidden backdrop-blur-xl">
          
          {/* Header */}
          <div className="bg-[#e8630a]11 border-b border-[#e8630a]22 p-5 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3 text-white">
              <Bot size={24} className="text-[#e8630a]" />
              <div>
                <span className="font-black uppercase tracking-widest text-[11px] italic block leading-none">Jeevan Setu AI</span>
                <span className="text-[10px] text-[#e8630a] font-mono block mt-1 tracking-tighter">● UPLINK ACTIVE</span>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="w-8 h-8 rounded-full hover:bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-all">
              <X size={20} />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-gradient-to-b from-transparent to-[#e8630a]05">
            {messages.map((msg, index) => (
              <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl p-4 text-[13px] leading-relaxed ${
                  msg.role === 'user' 
                    ? 'bg-[#e8630a] text-white rounded-tr-none shadow-lg' 
                    : 'bg-[#141926] text-gray-200 border border-white/5 rounded-tl-none'
                }`}>
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-[#141926] text-gray-200 border border-white/5 rounded-2xl rounded-tl-none p-4 flex items-center gap-3">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-[#e8630a] rounded-full animate-bounce" style={{animationDelay:'0s'}}/>
                    <span className="w-1.5 h-1.5 bg-[#e8630a] rounded-full animate-bounce" style={{animationDelay:'0.2s'}}/>
                    <span className="w-1.5 h-1.5 bg-[#e8630a] rounded-full animate-bounce" style={{animationDelay:'0.4s'}}/>
                  </div>
                  <span className="text-[10px] uppercase font-mono tracking-widest text-gray-500">Processing Core...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-5 border-t border-white/5 bg-black/40 backdrop-blur-md shrink-0">
            <form onSubmit={handleSend} className="flex items-center gap-3">
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Jeevan AI for strategies..." 
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[13px] text-white focus:outline-none focus:border-[#e8630a] transition-all"
                disabled={isLoading}
              />
              <button 
                type="submit" 
                disabled={isLoading || !input.trim()}
                className="bg-[#e8630a] hover:bg-[#ff7a21] disabled:opacity-50 disabled:grayscale text-white w-10 h-10 flex items-center justify-center rounded-xl transition-all shadow-lg"
              >
                <Send size={18} />
              </button>
            </form>
          </div>
        </div>
      )}

    </>
  );
}
