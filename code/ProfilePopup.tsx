import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { X, AtSign, Phone, Mail, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  userId: string;
  onClose: () => void;
}

export default function ProfilePopup({ userId, onClose }: Props) {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('display_name, username, avatar_url, bio, status, phone_number, created_at')
      .eq('id', userId)
      .single()
      .then(({ data }) => setProfile(data));
  }, [userId]);

  if (!profile) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm bg-card rounded-xl shadow-2xl border border-border overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Banner */}
        <div className="h-20 bg-gradient-to-r from-primary to-accent" />

        {/* Avatar */}
        <div className="px-4 -mt-10">
          <div className="w-20 h-20 rounded-full bg-primary border-4 border-card flex items-center justify-center overflow-hidden">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl font-bold text-primary-foreground">
                {(profile.display_name || '?')[0].toUpperCase()}
              </span>
            )}
          </div>
        </div>

        <div className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-foreground">{profile.display_name}</h3>
              {profile.username && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <AtSign className="w-3 h-3" /> {profile.username}
                </p>
              )}
            </div>
            <div className={`w-3 h-3 rounded-full ${profile.status === 'online' ? 'online-indicator' : 'offline-indicator'}`} />
          </div>

          {profile.bio && (
            <p className="text-sm text-foreground mt-3 p-2 bg-secondary rounded">{profile.bio}</p>
          )}

          <div className="mt-3 space-y-1.5">
            {profile.phone_number && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="w-3 h-3" /> {profile.phone_number}
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-3 h-3" /> Joined {new Date(profile.created_at).toLocaleDateString()}
            </div>
          </div>

          <button onClick={onClose} className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground">
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}
