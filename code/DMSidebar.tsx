import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getOrCreateDm } from '@/lib/supabase-helpers';
import { Search, Plus, MessageSquare } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger } from
'@/components/ui/dialog';

interface DmInfo {
  dm_id: string;
  other_user_id: string;
  display_name: string;
  avatar_url: string | null;
  status: string;
}

interface Props {
  selectedDmId: string | null;
  onSelectDm: (dmId: string, title: string) => void;
}

export default function DMSidebar({ selectedDmId, onSelectDm }: Props) {
  const { user } = useAuth();
  const [dms, setDms] = useState<DmInfo[]>([]);
  const [search, setSearch] = useState('');
  const [showNewDm, setShowNewDm] = useState(false);
  const [searchUsers, setSearchUsers] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState('');

  useEffect(() => {
    if (user) fetchDms();
  }, [user]);

  const fetchDms = async () => {
    if (!user) return;
    const { data: myDms } = await supabase.
    from('dm_participants').
    select('dm_id').
    eq('user_id', user.id);

    if (!myDms || myDms.length === 0) {setDms([]);return;}

    const dmIds = myDms.map((d) => d.dm_id);
    const { data: others } = await supabase.
    from('dm_participants').
    select('dm_id, user_id, profiles:user_id(display_name, avatar_url, status)').
    in('dm_id', dmIds).
    neq('user_id', user.id);

    if (others) {
      setDms(others.map((o: any) => ({
        dm_id: o.dm_id,
        other_user_id: o.user_id,
        display_name: o.profiles?.display_name || 'Unknown',
        avatar_url: o.profiles?.avatar_url,
        status: o.profiles?.status || 'offline'
      })));
    }
  };

  const handleSearchUsers = async (query: string) => {
    setUserSearch(query);
    if (query.length < 2) {setSearchUsers([]);return;}
    const { data } = await supabase.
    from('profiles').
    select('id, display_name, avatar_url, status').
    ilike('display_name', `%${query}%`).
    neq('id', user!.id).
    limit(10);
    setSearchUsers(data || []);
  };

  const startDm = async (otherUserId: string, name: string) => {
    try {
      const dmId = await getOrCreateDm(otherUserId);
      setShowNewDm(false);
      fetchDms();
      onSelectDm(dmId, name);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const filtered = dms.filter((d) =>
  d.display_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="w-60 flex flex-col khappy-sidebar shrink-0">
      <div className="h-12 px-4 flex items-center border-b border-border shadow-sm">
        <h2 className="font-semibold text-destructive font-mono">Direct Messages</h2>
      </div>

      <div className="p-2">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search DMs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 bg-secondary h-8 text-sm" />

        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <div className="flex items-center justify-between px-2 mb-2">
          <span className="text-xs font-semibold uppercase text-destructive">Messages</span>
          <Dialog open={showNewDm} onOpenChange={setShowNewDm}>
            <DialogTrigger asChild>
              <button className="text-muted-foreground hover:text-foreground">
                <Plus className="w-4 h-4 text-[#5865f3]" />
              </button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle>New Message</DialogTitle>
              </DialogHeader>
              <Input
                placeholder="Search users..."
                value={userSearch}
                onChange={(e) => handleSearchUsers(e.target.value)}
                className="bg-secondary" />

              <div className="max-h-60 overflow-y-auto space-y-1">
                {searchUsers.map((u) =>
                <button
                  key={u.id}
                  onClick={() => startDm(u.id, u.display_name)}
                  className="w-full flex items-center gap-2 p-2 rounded hover:bg-khappy-hover text-left">

                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                        {u.avatar_url ?
                      <img src={u.avatar_url} className="w-8 h-8 rounded-full object-cover" /> :

                      <span className="text-xs font-bold text-primary-foreground">
                            {u.display_name[0]?.toUpperCase()}
                          </span>
                      }
                      </div>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card ${
                    u.status === 'online' ? 'online-indicator' : 'offline-indicator'}`
                    } />
                    </div>
                    <span className="text-sm text-foreground">{u.display_name}</span>
                  </button>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {filtered.map((dm) =>
        <button
          key={dm.dm_id}
          onClick={() => onSelectDm(dm.dm_id, dm.display_name)}
          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded transition-colors ${
          selectedDmId === dm.dm_id ?
          'bg-khappy-hover text-foreground' :
          'text-muted-foreground hover:text-foreground hover:bg-khappy-hover/50'}`
          }>

            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                {dm.avatar_url ?
              <img src={dm.avatar_url} className="w-8 h-8 rounded-full object-cover" /> :

              <span className="text-xs font-bold text-primary-foreground">
                    {dm.display_name[0]?.toUpperCase()}
                  </span>
              }
              </div>
              <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-sidebar ${
            dm.status === 'online' ? 'online-indicator' : 'offline-indicator'}`
            } />
            </div>
            <span className="text-sm truncate">{dm.display_name}</span>
          </button>
        )}

        {filtered.length === 0 &&
        <p className="text-sm text-center py-4 text-destructive font-mono">
            No conversations yet
          </p>
        }
      </div>
    </div>);

}