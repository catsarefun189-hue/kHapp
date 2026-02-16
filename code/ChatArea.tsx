import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { uploadChatImage } from '@/lib/supabase-helpers';
import { Send, Paperclip, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import ProfilePopup from './ProfilePopup';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  image_url: string | null;
  created_at: string;
  profiles?: {
    display_name: string;
    username: string | null;
    avatar_url: string | null;
    status: string;
  };
}

interface Props {
  channelId?: string | null;
  dmId?: string | null;
  title: string;
}

export default function ChatArea({ channelId, dmId, title }: Props) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [viewingProfile, setViewingProfile] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!channelId && !dmId) return;
    fetchMessages();

    const channel = supabase
      .channel(`messages-${channelId || dmId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: channelId ? `channel_id=eq.${channelId}` : `dm_id=eq.${dmId}`
      }, (payload) => {
        fetchSingleMessage(payload.new.id);
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'messages',
      }, (payload) => {
        setMessages(prev => prev.filter(m => m.id !== (payload.old as any).id));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [channelId, dmId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchMessages = async () => {
    let query = supabase
      .from('messages')
      .select('id, content, sender_id, image_url, created_at, profiles:sender_id(display_name, username, avatar_url, status)')
      .order('created_at', { ascending: true })
      .limit(100);

    if (channelId) query = query.eq('channel_id', channelId);
    else if (dmId) query = query.eq('dm_id', dmId);
    else return;

    const { data } = await query;
    if (data) setMessages(data as any);
  };

  const fetchSingleMessage = async (id: string) => {
    const { data } = await supabase
      .from('messages')
      .select('id, content, sender_id, image_url, created_at, profiles:sender_id(display_name, username, avatar_url, status)')
      .eq('id', id)
      .single();
    if (data) {
      setMessages(prev => {
        if (prev.find(m => m.id === data.id)) return prev;
        return [...prev, data as any];
      });
    }
  };

  const sendMessage = async () => {
    if (!input.trim() && !uploading) return;
    if (!user) return;

    const content = input.trim();
    setInput('');

    const msgData: any = { content, sender_id: user.id };
    if (channelId) msgData.channel_id = channelId;
    if (dmId) msgData.dm_id = dmId;

    const { data, error } = await supabase.from('messages').insert(msgData).select('id').single();
    if (error) { toast.error(error.message); return; }

    // Parse mentions (@username or @displayname)
    const mentionRegex = /@(\w+)/g;
    let match;
    while ((match = mentionRegex.exec(content)) !== null) {
      const mentionedName = match[1];
      const { data: mentionedUser } = await supabase
        .from('profiles')
        .select('id')
        .or(`username.ilike.${mentionedName},display_name.ilike.${mentionedName}`)
        .limit(1)
        .maybeSingle();
      if (mentionedUser && data) {
        await supabase.from('mentions').insert({
          message_id: data.id,
          mentioned_user_id: mentionedUser.id,
        });
      }
    }
  };

  const deleteMessage = async (msgId: string) => {
    const { error } = await supabase.from('messages').delete().eq('id', msgId);
    if (error) toast.error(error.message);
    else setMessages(prev => prev.filter(m => m.id !== msgId));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const url = await uploadChatImage(file, user.id);
      const msgData: any = { content: '', sender_id: user.id, image_url: url };
      if (channelId) msgData.channel_id = channelId;
      if (dmId) msgData.dm_id = dmId;
      await supabase.from('messages').insert(msgData);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (date: string) =>
    new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const renderContent = (content: string) =>
    content.replace(/@(\w+)/g, '<span class="text-khappy-yellow font-semibold cursor-pointer">@$1</span>');

  if (!channelId && !dmId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#22a056]">
        <div className="text-center text-muted-foreground">
          <p className="text-xl font-semibold mb-2 font-mono">Welcome to kHappy</p>
          <p>Select a channel or DM to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background min-w-0">
      {/* Header */}
      <div className="h-12 px-4 flex items-center border-b border-border shadow-sm shrink-0">
        <h3 className="font-semibold text-foreground">
          {channelId ? `# ${title}` : title}
        </h3>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        <AnimatePresence>
          {messages.map((msg, i) => {
            const showAuthor = i === 0 || messages[i - 1].sender_id !== msg.sender_id;
            const profile = msg.profiles;
            const isOwn = msg.sender_id === user?.id;

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`group flex gap-3 px-2 py-0.5 rounded hover:bg-khappy-hover/30 ${
                  msg.content.includes(`@${profile?.display_name}`) || msg.content.includes(`@${profile?.username}`) ? 'mention-highlight' : ''
                }`}
              >
                {showAuthor ? (
                  <div
                    className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5 cursor-pointer"
                    onClick={() => setViewingProfile(msg.sender_id)}
                  >
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <span className="text-sm font-bold text-primary-foreground">
                        {(profile?.display_name || '?')[0].toUpperCase()}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="w-10 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  {showAuthor && (
                    <div className="flex items-center gap-2">
                      <span
                        className="font-semibold text-foreground text-sm cursor-pointer hover:underline"
                        onClick={() => setViewingProfile(msg.sender_id)}
                      >
                        {profile?.display_name || 'Unknown'}
                      </span>
                      {profile?.username && (
                        <span className="text-xs text-muted-foreground">@{profile.username}</span>
                      )}
                      <div className={`w-2 h-2 rounded-full ${profile?.status === 'online' ? 'online-indicator' : 'offline-indicator'}`} />
                      <span className="text-xs text-muted-foreground">{formatTime(msg.created_at)}</span>
                    </div>
                  )}
                  {msg.content && (
                    <p
                      className="text-foreground text-sm break-words"
                      dangerouslySetInnerHTML={{ __html: renderContent(msg.content) }}
                    />
                  )}
                  {msg.image_url && (
                    <img
                      src={msg.image_url}
                      alt="Upload"
                      className="mt-1 max-w-xs max-h-64 rounded-lg cursor-pointer hover:opacity-90"
                      onClick={() => window.open(msg.image_url!, '_blank')}
                    />
                  )}
                </div>
                {/* Delete button for own messages */}
                {isOwn && (
                  <button
                    onClick={() => deleteMessage(msg.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/20 rounded shrink-0 self-start"
                    title="Delete message"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </button>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 pb-4">
        <div className="flex items-center gap-2 bg-secondary rounded-lg px-4 py-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${channelId ? '#' + title : title}`}
            className="flex-1 bg-transparent outline-none text-foreground text-sm placeholder:text-muted-foreground"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() && !uploading}
            className="text-muted-foreground hover:text-primary disabled:opacity-50 shrink-0"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>

      {viewingProfile && (
        <ProfilePopup userId={viewingProfile} onClose={() => setViewingProfile(null)} />
      )}
    </div>
  );
}
