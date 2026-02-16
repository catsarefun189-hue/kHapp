import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Bell, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Mention {
  id: string;
  read: boolean;
  created_at: string;
  messages: {
    content: string;
    sender_id: string;
    profiles: {
      display_name: string;
      avatar_url: string | null;
    };
  };
}

interface Props {
  onClose: () => void;
}

export default function PingsPanel({ onClose }: Props) {
  const { user } = useAuth();
  const [mentions, setMentions] = useState<Mention[]>([]);

  useEffect(() => {
    fetchMentions();

    const channel = supabase
      .channel('mentions-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'mentions',
        filter: `mentioned_user_id=eq.${user?.id}`,
      }, () => fetchMentions())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const fetchMentions = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('mentions')
      .select('id, read, created_at, messages:message_id(content, sender_id, profiles:sender_id(display_name, avatar_url))')
      .eq('mentioned_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setMentions(data as any);
  };

  const markRead = async (id: string) => {
    await supabase.from('mentions').update({ read: true }).eq('id', id);
    fetchMentions();
  };

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from('mentions').update({ read: true }).eq('mentioned_user_id', user.id).eq('read', false);
    fetchMentions();
  };

  const unreadCount = mentions.filter(m => !m.read).length;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-card rounded-xl shadow-2xl border border-border overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-foreground">Pings</h3>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 bg-destructive text-destructive-foreground text-xs rounded-full font-bold animate-ping-bounce">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="text-xs text-primary hover:underline">
              Mark all read
            </button>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto">
          <AnimatePresence>
            {mentions.map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`flex items-start gap-3 p-3 border-b border-border/50 hover:bg-khappy-hover/30 ${
                  !m.read ? 'mention-highlight' : ''
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                  {m.messages?.profiles?.avatar_url ? (
                    <img src={m.messages.profiles.avatar_url} className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold text-primary-foreground">
                      {(m.messages?.profiles?.display_name || '?')[0].toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {m.messages?.profiles?.display_name || 'Unknown'}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    {m.messages?.content}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(m.created_at).toLocaleString()}
                  </p>
                </div>
                {!m.read && (
                  <button onClick={() => markRead(m.id)} className="p-1 hover:bg-khappy-hover rounded">
                    <Check className="w-4 h-4 text-khappy-green" />
                  </button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {mentions.length === 0 && (
            <p className="text-center text-muted-foreground py-8 text-sm">No pings yet</p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
