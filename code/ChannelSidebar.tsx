import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Hash, Plus, Copy, Users, LogOut, Volume2, Video, Key, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface Channel {
  id: string;
  name: string;
  channel_type: 'text' | 'voice' | 'video';
}

interface ServerInfo {
  id: string;
  name: string;
  invite_code: string;
  owner_id: string;
}

interface Props {
  serverId: string;
  selectedChannelId: string | null;
  onSelectChannel: (id: string, type?: string) => void;
  onShowMembers: () => void;
}

export default function ChannelSidebar({ serverId, selectedChannelId, onSelectChannel, onShowMembers }: Props) {
  const { user } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [server, setServer] = useState<ServerInfo | null>(null);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelType, setNewChannelType] = useState<'text' | 'voice' | 'video'>('text');
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [showAdminCode, setShowAdminCode] = useState(false);
  const [adminCodeInput, setAdminCodeInput] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetchServer();
    fetchChannels();
    checkAdmin();
  }, [serverId]);

  const fetchServer = async () => {
    const { data } = await supabase.from('servers').select('id, name, invite_code, owner_id').eq('id', serverId).single();
    if (data) setServer(data);
  };

  const fetchChannels = async () => {
    const { data } = await supabase.from('channels').select('id, name, channel_type').eq('server_id', serverId).order('created_at');
    if (data) {
      setChannels(data as Channel[]);
      if (data.length > 0 && !selectedChannelId) onSelectChannel(data[0].id, (data[0] as any).channel_type);
    }
  };

  const checkAdmin = async () => {
    if (!user) return;
    const { data } = await supabase.from('server_members').select('role').eq('server_id', serverId).eq('user_id', user.id).single();
    setIsAdmin(data?.role === 'admin' || data?.role === 'owner');
  };

  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) return;
    const { error } = await supabase.from('channels').insert({
      server_id: serverId,
      name: newChannelName.trim().toLowerCase().replace(/\s+/g, '-'),
      channel_type: newChannelType,
    });
    if (error) toast.error(error.message);
    else {
      setNewChannelName('');
      setNewChannelType('text');
      setShowNewChannel(false);
      fetchChannels();
    }
  };

  const copyInviteCode = () => {
    if (server?.invite_code) {
      navigator.clipboard.writeText(server.invite_code);
      toast.success('Invite code copied!');
    }
  };

  const copyJoinLink = () => {
    if (server?.invite_code) {
      const link = `${window.location.origin}?join=${server.invite_code}`;
      navigator.clipboard.writeText(link);
      toast.success('Join link copied!');
    }
  };

  const handleUseAdminCode = async () => {
    if (!adminCodeInput.trim()) return;
    const { data, error } = await supabase.rpc('use_admin_code', { _code: adminCodeInput.trim() });
    if (error) toast.error(error.message);
    else {
      toast.success('You are now an admin!');
      setShowAdminCode(false);
      setAdminCodeInput('');
      checkAdmin();
    }
  };

  const handleLeave = async () => {
    if (!user) return;
    await supabase.from('server_members').delete().eq('server_id', serverId).eq('user_id', user.id);
    toast.success('Left server');
    window.location.reload();
  };

  const textChannels = channels.filter(c => c.channel_type === 'text');
  const voiceChannels = channels.filter(c => c.channel_type === 'voice');
  const videoChannels = channels.filter(c => c.channel_type === 'video');

  const getChannelIcon = (type: string) => {
    switch (type) {
      case 'voice': return <Volume2 className="w-4 h-4 shrink-0" />;
      case 'video': return <Video className="w-4 h-4 shrink-0" />;
      default: return <Hash className="w-4 h-4 shrink-0" />;
    }
  };

  const renderChannelList = (title: string, list: Channel[]) => {
    if (list.length === 0) return null;
    return (
      <div className="mb-2">
        <span className="text-xs font-semibold uppercase text-muted-foreground px-2">{title}</span>
        {list.map(ch => (
          <button
            key={ch.id}
            onClick={() => onSelectChannel(ch.id, ch.channel_type)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
              selectedChannelId === ch.id
                ? 'bg-khappy-hover text-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-khappy-hover/50'
            }`}
          >
            {getChannelIcon(ch.channel_type)}
            <span className="truncate">{ch.name}</span>
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="w-60 flex flex-col khappy-sidebar shrink-0">
      <div className="h-12 px-4 flex items-center justify-between border-b border-border shadow-sm">
        <h2 className="font-semibold text-foreground truncate">{server?.name}</h2>
        <div className="flex gap-1">
          <button onClick={copyJoinLink} title="Copy join link" className="p-1 hover:bg-khappy-hover rounded">
            <Link2 className="w-4 h-4 text-muted-foreground" />
          </button>
          <button onClick={copyInviteCode} title="Copy invite code" className="p-1 hover:bg-khappy-hover rounded">
            <Copy className="w-4 h-4 text-muted-foreground" />
          </button>
          <button onClick={onShowMembers} title="Members" className="p-1 hover:bg-khappy-hover rounded">
            <Users className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <div className="flex items-center justify-between px-2 mb-1">
          <span className="text-xs font-semibold uppercase text-muted-foreground">Channels</span>
          {isAdmin && (
            <Dialog open={showNewChannel} onOpenChange={setShowNewChannel}>
              <DialogTrigger asChild>
                <button className="hover:text-foreground text-muted-foreground">
                  <Plus className="w-4 h-4" />
                </button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader><DialogTitle>Create Channel</DialogTitle></DialogHeader>
                <Input
                  placeholder="channel-name"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  className="bg-secondary"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateChannel()}
                />
                <Select value={newChannelType} onValueChange={(v: any) => setNewChannelType(v)}>
                  <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">💬 Text Channel</SelectItem>
                    <SelectItem value="voice">🎙️ Voice Channel</SelectItem>
                    <SelectItem value="video">🎥 Video Channel</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleCreateChannel}>Create</Button>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {renderChannelList('Text Channels', textChannels)}
        {renderChannelList('Voice Channels', voiceChannels)}
        {renderChannelList('Video Channels', videoChannels)}
      </div>

      <div className="p-2 border-t border-border space-y-1">
        <Dialog open={showAdminCode} onOpenChange={setShowAdminCode}>
          <DialogTrigger asChild>
            <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-khappy-yellow hover:bg-khappy-hover transition-colors">
              <Key className="w-4 h-4" /> Use Admin Code
            </button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader><DialogTitle>Enter Admin Code</DialogTitle></DialogHeader>
            <Input
              placeholder="Paste admin code..."
              value={adminCodeInput}
              onChange={(e) => setAdminCodeInput(e.target.value)}
              className="bg-secondary"
              onKeyDown={(e) => e.key === 'Enter' && handleUseAdminCode()}
            />
            <Button onClick={handleUseAdminCode}>Activate</Button>
          </DialogContent>
        </Dialog>
        <button
          onClick={handleLeave}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="w-4 h-4" /> Leave Server
        </button>
      </div>
    </div>
  );
}
