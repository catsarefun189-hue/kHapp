import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Settings, Bell, Mic, MicOff, Headphones, HeadphoneOff, Bot, ShieldCheck } from 'lucide-react';

interface Props {
  onOpenSettings: () => void;
  onOpenPings: () => void;
  onOpenAiBot: () => void;
  onOpenDistrictAdmin: () => void;
  unreadPings: number;
}

export default function UserBar({ onOpenSettings, onOpenPings, onOpenAiBot, onOpenDistrictAdmin, unreadPings }: Props) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);

  useEffect(() => {
    if (user) {
      supabase.from('profiles').select('display_name, avatar_url, status, username').eq('id', user.id).single()
        .then(({ data }) => setProfile(data));
      supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'district_admin').maybeSingle()
        .then(({ data }) => setIsOwner(!!data));
    }
  }, [user]);

  return (
    <div className="h-[52px] px-2 flex items-center gap-2 bg-khappy-serverbar border-t border-border">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="relative">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            {profile?.avatar_url ?
              <img src={profile.avatar_url} className="w-8 h-8 rounded-full object-cover" /> :
              <span className="text-xs font-bold text-primary-foreground">
                {(profile?.display_name || '?')[0].toUpperCase()}
              </span>
            }
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-khappy-serverbar online-indicator" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate font-mono text-[#d02525]">{profile?.display_name || 'User'}</p>
          <p className="text-[10px] text-khappy-green font-mono">
            {profile?.username ? `@${profile.username}` : 'Online'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-0.5">
        <button onClick={onOpenAiBot} className="p-1.5 hover:bg-khappy-hover rounded" title="kBot AI">
          <Bot className="w-4 h-4 text-rose-600" />
        </button>
        {isOwner &&
          <button onClick={onOpenDistrictAdmin} className="p-1.5 hover:bg-khappy-hover rounded" title="Owner Panel">
            <ShieldCheck className="w-4 h-4 text-khappy-yellow" />
          </button>
        }
        <button onClick={onOpenPings} className="relative p-1.5 hover:bg-khappy-hover rounded" title="Pings">
          <Bell className="w-4 h-4 text-[#23a445]" />
          {unreadPings > 0 &&
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] rounded-full flex items-center justify-center font-bold">
              {unreadPings}
            </span>
          }
        </button>
        <button
          onClick={() => setMuted(!muted)}
          className="p-1.5 hover:bg-khappy-hover rounded"
          title={muted ? 'Unmute' : 'Mute'}
        >
          {muted ?
            <MicOff className="w-4 h-4 text-destructive" /> :
            <Mic className="w-4 h-4 text-[#239f44]" />
          }
        </button>
        <button
          onClick={() => setDeafened(!deafened)}
          className="p-1.5 hover:bg-khappy-hover rounded"
          title={deafened ? 'Undeafen' : 'Deafen'}
        >
          {deafened ?
            <HeadphoneOff className="w-4 h-4 text-destructive" /> :
            <Headphones className="w-4 h-4 text-[#239f44]" />
          }
        </button>
        <button onClick={onOpenSettings} className="p-1.5 hover:bg-khappy-hover rounded" title="Settings">
          <Settings className="w-4 h-4 text-[#23a459]" />
        </button>
      </div>
    </div>
  );
}
