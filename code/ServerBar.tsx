import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { createServer, joinServerByCode } from '@/lib/supabase-helpers';
import { Plus, MessageCircle, Compass } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Server {
  id: string;
  name: string;
  icon_url: string | null;
}

interface ServerBarProps {
  selectedServerId: string | null;
  onSelectServer: (id: string | null) => void;
  onSelectDMs: () => void;
  showDMs: boolean;
}

export default function ServerBar({ selectedServerId, onSelectServer, onSelectDMs, showDMs }: ServerBarProps) {
  const { user } = useAuth();
  const [servers, setServers] = useState<Server[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newName, setNewName] = useState('');
  const [joinCode, setJoinCode] = useState('');

  useEffect(() => {
    if (!user) return;
    fetchServers();

    const channel = supabase
      .channel('server_members_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'server_members', filter: `user_id=eq.${user.id}` }, () => {
        fetchServers();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const fetchServers = async () => {
    const { data } = await supabase
      .from('server_members')
      .select('server_id, servers:server_id(id, name, icon_url)')
      .eq('user_id', user!.id)
      .neq('status', 'banned');
    if (data) {
      setServers(data.map((d: any) => d.servers).filter(Boolean));
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const id = await createServer(newName.trim());
      setShowCreate(false);
      setNewName('');
      onSelectServer(id);
      toast.success('Server created!');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    try {
      const id = await joinServerByCode(joinCode.trim());
      setShowJoin(false);
      setJoinCode('');
      onSelectServer(id);
      toast.success('Joined server!');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="w-[72px] flex flex-col items-center py-3 gap-2 khappy-serverbar overflow-y-auto shrink-0">
      {/* DMs button */}
      <button
        onClick={onSelectDMs}
        className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 ${
          showDMs ? 'bg-primary rounded-xl' : 'bg-secondary hover:bg-khappy-hover hover:rounded-xl'
        }`}
      >
        <MessageCircle className="w-6 h-6 text-foreground" />
      </button>

      <div className="w-8 h-0.5 bg-border rounded-full mx-auto" />

      {/* Server list */}
      {servers.map((server) => (
        <button
          key={server.id}
          onClick={() => onSelectServer(server.id)}
          title={server.name}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 font-bold text-sm ${
            selectedServerId === server.id
              ? 'bg-primary rounded-xl text-primary-foreground'
              : 'bg-secondary hover:bg-khappy-hover hover:rounded-xl text-foreground'
          }`}
        >
          {server.icon_url ? (
            <img src={server.icon_url} alt="" className="w-full h-full rounded-2xl object-cover" />
          ) : (
            server.name.slice(0, 2).toUpperCase()
          )}
        </button>
      ))}

      {/* Create server */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogTrigger asChild>
          <button className="w-12 h-12 rounded-2xl bg-secondary hover:bg-khappy-green hover:rounded-xl transition-all duration-200 flex items-center justify-center text-khappy-green hover:text-primary-foreground">
            <Plus className="w-6 h-6" />
          </button>
        </DialogTrigger>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Create a Server</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Server name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="bg-secondary"
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <Button onClick={handleCreate}>Create</Button>
        </DialogContent>
      </Dialog>

      {/* Join server */}
      <Dialog open={showJoin} onOpenChange={setShowJoin}>
        <DialogTrigger asChild>
          <button className="w-12 h-12 rounded-2xl bg-secondary hover:bg-khappy-green hover:rounded-xl transition-all duration-200 flex items-center justify-center text-khappy-green hover:text-primary-foreground">
            <Compass className="w-6 h-6" />
          </button>
        </DialogTrigger>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Join a Server</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Enter invite code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            className="bg-secondary"
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
          />
          <Button onClick={handleJoin}>Join</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
