import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Bot, Send, Image as ImageIcon, FileText, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

type Msg = { role: 'user' | 'assistant'; content: string; imageUrl?: string };
type Mode = 'chat' | 'image' | 'text';

interface Props {
  onClose: () => void;
  onInsertMessage?: (content: string) => void;
}

export default function AiBotPanel({ onClose, onInsertMessage }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<Mode>('chat');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const streamChat = async (userMessages: Msg[]) => {
    const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

    const resp = await fetch(CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({
        messages: userMessages.map(m => ({ role: m.role, content: m.content })),
        mode,
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(err.error || `Error ${resp.status}`);
    }

    if (mode === 'image') {
      const data = await resp.json();
      const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      const textContent = data.choices?.[0]?.message?.content || 'Here\'s your generated image:';
      return { text: textContent, imageUrl };
    }

    // Streaming
    if (!resp.body) throw new Error('No stream body');
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = '';
    let assistantSoFar = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);
        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (line.startsWith(':') || line.trim() === '') continue;
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') break;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            assistantSoFar += content;
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last?.role === 'assistant') {
                return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
              }
              return [...prev, { role: 'assistant', content: assistantSoFar }];
            });
          }
        } catch { /* partial JSON */ }
      }
    }
    return null;
  };

  const send = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg: Msg = { role: 'user', content: input.trim() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    try {
      const result = await streamChat(updatedMessages);
      if (result) {
        setMessages(prev => [...prev, { role: 'assistant', content: result.text, imageUrl: result.imageUrl }]);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const modeConfig = {
    chat: { icon: Bot, label: 'kBot Chat', color: 'text-primary' },
    image: { icon: ImageIcon, label: 'AI Image Gen', color: 'text-khappy-yellow' },
    text: { icon: FileText, label: 'AI Text Gen', color: 'text-khappy-green' },
  };
  const ModeIcon = modeConfig[mode].icon;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 flex flex-col">
      {/* Header */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-3">
          <ModeIcon className={`w-5 h-5 ${modeConfig[mode].color}`} />
          <h3 className="font-semibold text-foreground">{modeConfig[mode].label}</h3>
          <div className="flex gap-1 ml-2">
            {(['chat', 'image', 'text'] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  mode === m ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
                }`}
              >
                {m === 'chat' ? '💬 Chat' : m === 'image' ? '🎨 Image' : '📝 Text'}
              </button>
            ))}
          </div>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground py-12">
            <Bot className="w-16 h-16 mx-auto mb-4 text-primary opacity-50" />
            <p className="text-lg font-semibold mb-2">Hey! I'm kBot 🤖</p>
            <p className="text-sm">
              {mode === 'chat' && 'Ask me anything! I can help with questions, ideas, and more.'}
              {mode === 'image' && 'Describe an image and I\'ll generate it for you!'}
              {mode === 'text' && 'I can write stories, poems, code, essays, and more!'}
            </p>
          </div>
        )}

        <AnimatePresence>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-primary-foreground" />
                </div>
              )}
              <div className={`max-w-[70%] rounded-lg px-3 py-2 ${
                msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'
              }`}>
                <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                {msg.imageUrl && (
                  <img
                    src={msg.imageUrl}
                    alt="AI generated"
                    className="mt-2 max-w-full rounded-lg cursor-pointer"
                    onClick={() => window.open(msg.imageUrl, '_blank')}
                  />
                )}
                {msg.role === 'assistant' && onInsertMessage && (
                  <button
                    onClick={() => onInsertMessage(msg.content)}
                    className="mt-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    📋 Insert into chat
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {isLoading && mode === 'image' && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Generating image...</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 pb-4">
        <div className="flex items-center gap-2 bg-secondary rounded-lg px-4 py-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={
              mode === 'chat' ? 'Ask kBot anything...' :
              mode === 'image' ? 'Describe the image you want...' :
              'What should I write?'
            }
            className="flex-1 bg-transparent outline-none text-foreground text-sm placeholder:text-muted-foreground"
            disabled={isLoading}
          />
          <button
            onClick={send}
            disabled={!input.trim() || isLoading}
            className="text-muted-foreground hover:text-primary disabled:opacity-50 shrink-0"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
