import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Video, Mic, MicOff, VideoOff, Phone, PhoneOff, Users, Volume2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface Props {
  channelId: string;
  channelName: string;
  channelType: 'voice' | 'video';
}

export default function VoiceVideoChannel({ channelId, channelName, channelType }: Props) {
  const { user } = useAuth();
  const [joined, setJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(channelType === 'voice');
  const [participants, setParticipants] = useState<{ id: string; display_name: string; avatar_url: string | null }[]>([]);

  // Simulated participants for UI (real WebRTC would need a signaling server)
  useEffect(() => {
    if (!joined || !user) return;
    // Add self as participant
    supabase.from('profiles').select('id, display_name, avatar_url').eq('id', user.id).single()
      .then(({ data }) => {
        if (data) setParticipants([data]);
      });
  }, [joined, user]);

  const handleJoin = () => {
    setJoined(true);
    toast.success(`Joined ${channelType} channel: ${channelName}`);
  };

  const handleLeave = () => {
    setJoined(false);
    setParticipants([]);
    toast.info(`Left ${channelType} channel`);
  };

  if (!joined) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          <div className="w-20 h-20 mx-auto rounded-full bg-primary/20 flex items-center justify-center mb-4">
            {channelType === 'video' ? (
              <Video className="w-10 h-10 text-primary" />
            ) : (
              <Volume2 className="w-10 h-10 text-primary" />
            )}
          </div>
          <h3 className="text-xl font-semibold text-foreground mb-2">
            {channelType === 'video' ? '🎥' : '🎙️'} {channelName}
          </h3>
          <p className="text-muted-foreground mb-6">
            {channelType === 'video' ? 'Video Channel' : 'Voice Channel'}
          </p>
          <button
            onClick={handleJoin}
            className="px-6 py-3 bg-khappy-green text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Join {channelType === 'video' ? 'Video' : 'Voice'}
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Header */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          {channelType === 'video' ? <Video className="w-4 h-4 text-primary" /> : <Volume2 className="w-4 h-4 text-primary" />}
          <h3 className="font-semibold text-foreground">{channelName}</h3>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground text-sm">
          <Users className="w-4 h-4" />
          <span>{participants.length}</span>
        </div>
      </div>

      {/* Participants grid */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-2xl">
          {participants.map(p => (
            <motion.div
              key={p.id}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="aspect-video bg-secondary rounded-xl flex flex-col items-center justify-center gap-2 min-w-[200px]"
            >
              <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center">
                {p.avatar_url ? (
                  <img src={p.avatar_url} className="w-16 h-16 rounded-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold text-primary-foreground">
                    {p.display_name[0]?.toUpperCase()}
                  </span>
                )}
              </div>
              <span className="text-sm font-medium text-foreground">{p.display_name}</span>
              {muted && <MicOff className="w-4 h-4 text-destructive" />}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="h-20 flex items-center justify-center gap-4 border-t border-border shrink-0">
        <button
          onClick={() => setMuted(!muted)}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
            muted ? 'bg-destructive text-white' : 'bg-secondary text-foreground hover:bg-khappy-hover'
          }`}
        >
          {muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>
        {channelType === 'video' && (
          <button
            onClick={() => setVideoOff(!videoOff)}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
              videoOff ? 'bg-destructive text-white' : 'bg-secondary text-foreground hover:bg-khappy-hover'
            }`}
          >
            {videoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>
        )}
        <button
          onClick={handleLeave}
          className="w-12 h-12 rounded-full bg-destructive text-white flex items-center justify-center hover:opacity-90"
        >
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
