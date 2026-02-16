import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { adminAction } from '@/lib/supabase-helpers';
import { Shield, ShieldAlert, Ban, VolumeX, Volume2, UserX, Crown, X, Bell, Star } from 'lucide-react';
import { toast } from 'sonner';
import ProfilePopup from './ProfilePopup';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Member {
  id: string;
  user_id: string;
  role: string;
  status: string;
  profiles: {
    display_name: string;
    username: string | null;
    avatar_url: string | null;
    status: string;
  };
}

interface Props {
  serverId: string;
  onClose: () => void;
}

export default function MembersPanel({ serverId, onClose }: Props) {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [viewingProfile, setViewingProfile] = useState<string | null>(null);

  useEffect(() => {
    fetchMembers();
  }, [serverId]);

  const fetchMembers = async () => {
    const { data } = await supabase
      .from('server_members')
      .select('id, user_id, role, status, profiles:user_id(display_name, username, avatar_url, status)')
      .eq('server_id', serverId)
      .neq('status', 'banned');

    if (data) {
      setMembers(data as any);
      const me = data.find((m: any) => m.user_id === user?.id);
      setIsAdmin(me?.role === 'admin' || me?.role === 'owner');
      setIsOwner(me?.role === 'owner');
    }
  };

  const handleAction = async (targetUserId: string, action: string) => {
    try {
      await adminAction(serverId, targetUserId, action);
      toast.success(`Action ${action} completed`);
      fetchMembers();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const pingAllMembers = async () => {
    if (!user) return;
    const { data: channel } = await supabase
      .from('channels')
      .select('id')
      .eq('server_id', serverId)
      .order('created_at')
      .limit(1)
      .single();
    if (!channel) return;

    const { data: msg } = await supabase
      .from('messages')
      .insert({ content: '🔔 @everyone Admin announcement ping!', sender_id: user.id, channel_id: channel.id })
      .select('id')
      .single();

    if (msg) {
      for (const member of members) {
        if (member.user_id !== user.id) {
          await supabase.from('mentions').insert({ message_id: msg.id, mentioned_user_id: member.user_id });
        }
      }
    }
    toast.success('Pinged all members!');
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner': return <Crown className="w-3 h-3 text-khappy-yellow" />;
      case 'admin': return <Shield className="w-3 h-3 text-primary" />;
      default: return null;
    }
  };

  const online = members.filter(m => m.profiles?.status === 'online');
  const offline = members.filter(m => m.profiles?.status !== 'online');

  const renderMember = (member: Member) => (
    <div key={member.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-khappy-hover group">
      <div
        className="relative cursor-pointer"
        onClick={() => setViewingProfile(member.user_id)}
      >
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
          {member.profiles?.avatar_url ? (
            <img src={member.profiles.avatar_url} className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <span className="text-xs font-bold text-primary-foreground">
              {(member.profiles?.display_name || '?')[0].toUpperCase()}
            </span>
          )}
        </div>
        <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card ${
          member.profiles?.status === 'online' ? 'online-indicator' : 'offline-indicator'
        }`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span
            className={`text-sm truncate cursor-pointer hover:underline ${member.profiles?.status === 'online' ? 'text-foreground' : 'text-muted-foreground'}`}
            onClick={() => setViewingProfile(member.user_id)}
          >
            {member.profiles?.display_name}
          </span>
          {getRoleIcon(member.role)}
          {member.status === 'muted' && <VolumeX className="w-3 h-3 text-destructive" />}
        </div>
        {member.profiles?.username && (
          <span className="text-[10px] text-muted-foreground">@{member.profiles.username}</span>
        )}
      </div>

      {isAdmin && member.user_id !== user?.id && member.role !== 'owner' && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-khappy-hover rounded">
              <ShieldAlert className="w-4 h-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-card border-border">
            {isOwner && member.role !== 'owner' && (
              <DropdownMenuItem onClick={() => handleAction(member.user_id, 'make_owner')}>
                <Star className="w-4 h-4 mr-2 text-khappy-yellow" /> Make Owner
              </DropdownMenuItem>
            )}
            {member.role === 'member' && (
              <DropdownMenuItem onClick={() => handleAction(member.user_id, 'make_admin')}>
                <Shield className="w-4 h-4 mr-2" /> Make Admin
              </DropdownMenuItem>
            )}
            {member.role === 'admin' && (
              <DropdownMenuItem onClick={() => handleAction(member.user_id, 'remove_admin')}>
                <Shield className="w-4 h-4 mr-2" /> Remove Admin
              </DropdownMenuItem>
            )}
            {member.status !== 'muted' ? (
              <DropdownMenuItem onClick={() => handleAction(member.user_id, 'mute')}>
                <VolumeX className="w-4 h-4 mr-2" /> Mute
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => handleAction(member.user_id, 'unmute')}>
                <Volume2 className="w-4 h-4 mr-2" /> Unmute
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => handleAction(member.user_id, 'kick')} className="text-destructive">
              <UserX className="w-4 h-4 mr-2" /> Kick
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleAction(member.user_id, 'ban')} className="text-destructive">
              <Ban className="w-4 h-4 mr-2" /> Ban
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );

  return (
    <>
      <div className="w-60 flex flex-col khappy-sidebar border-l border-border shrink-0">
        <div className="h-12 px-4 flex items-center justify-between border-b border-border">
          <h3 className="font-semibold text-foreground text-sm">Members — {members.length}</h3>
          <div className="flex items-center gap-1">
            {isAdmin && (
              <button onClick={pingAllMembers} className="text-muted-foreground hover:text-khappy-yellow" title="Ping all members">
                <Bell className="w-4 h-4" />
              </button>
            )}
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {online.length > 0 && (
            <>
              <p className="text-xs font-semibold text-muted-foreground uppercase px-2 mb-1">
                Online — {online.length}
              </p>
              {online.map(renderMember)}
            </>
          )}
          {offline.length > 0 && (
            <>
              <p className="text-xs font-semibold text-muted-foreground uppercase px-2 mt-3 mb-1">
                Offline — {offline.length}
              </p>
              {offline.map(renderMember)}
            </>
          )}
        </div>
      </div>
      {viewingProfile && (
        <ProfilePopup userId={viewingProfile} onClose={() => setViewingProfile(null)} />
      )}
    </>
  );
}
