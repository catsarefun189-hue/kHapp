import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Shield, ShieldCheck, UserPlus, Key, X } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface Props {
  onClose: () => void;
}

export default function DistrictAdminPanel({ onClose }: Props) {
  const { user } = useAuth();
  const [isOwner, setIsOwner] = useState(false);
  const [servers, setServers] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [searchUser, setSearchUser] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [tab, setTab] = useState<'servers' | 'users' | 'codes'>('servers');

  useEffect(() => {
    checkOwner();
  }, [user]);

  const checkOwner = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'district_admin')
      .maybeSingle();
    setIsOwner(!!data);
    if (data) fetchAllServers();
  };

  const fetchAllServers = async () => {
    const { data } = await supabase.from('servers').select('id, name, owner_id, invite_code');
    if (data) setServers(data);
  };

  const searchUsers = async (query: string) => {
    setSearchUser(query);
    if (query.length < 2) { setUsers([]); return; }
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, username, avatar_url')
      .or(`display_name.ilike.%${query}%,username.ilike.%${query}%`)
      .limit(20);
    setUsers(data || []);
  };

  const forceJoin = async (targetUserId: string, serverId: string) => {
    const { error } = await supabase.rpc('district_admin_force_join', {
      _server_id: serverId,
      _target_user_id: targetUserId,
    });
    if (error) toast.error(error.message);
    else toast.success('User force-joined to server');
  };

  const generateAdminCode = async (serverId: string) => {
    const { data, error } = await supabase
      .from('admin_codes')
      .insert({ server_id: serverId, created_by: user!.id })
      .select('code')
      .single();
    if (error) toast.error(error.message);
    else {
      setGeneratedCode(data.code);
      toast.success('Admin code generated!');
    }
  };

  const pingAllAdmins = async (serverId: string) => {
    const { data: admins } = await supabase
      .from('server_members')
      .select('user_id')
      .eq('server_id', serverId)
      .in('role', ['admin', 'owner']);

    if (!admins || admins.length === 0) { toast.info('No admins to ping'); return; }

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
      .insert({ content: `🔔 Owner Ping: @admin`, sender_id: user!.id, channel_id: channel.id })
      .select('id')
      .single();

    if (msg) {
      for (const admin of admins) {
        await supabase.from('mentions').insert({ message_id: msg.id, mentioned_user_id: admin.user_id });
      }
    }
    toast.success('Pinged all admins!');
  };

  if (!isOwner) {
    return (
      <div className="fixed inset-0 z-50 bg-background/95 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Not an Owner</h3>
          <p className="text-muted-foreground mb-4">You don't have owner privileges.</p>
          <Button onClick={onClose} variant="outline">Close</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/95 flex flex-col">
      <div className="h-12 px-4 flex items-center justify-between border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-khappy-yellow" />
          <h3 className="font-semibold text-foreground">Owner Panel</h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {(['servers', 'users', 'codes'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  tab === t ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
                }`}
              >
                {t === 'servers' ? '🏠 Servers' : t === 'users' ? '👥 Users' : '🔑 Admin Codes'}
              </button>
            ))}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'servers' && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase mb-3">All Servers</h4>
            {servers.map(s => (
              <div key={s.id} className="flex items-center justify-between p-3 bg-card rounded-lg border border-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold">
                    {s.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{s.name}</p>
                    <p className="text-xs text-muted-foreground">Code: {s.invite_code}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => pingAllAdmins(s.id)}>
                    🔔 Ping Admins
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => generateAdminCode(s.id)}>
                    <Key className="w-3 h-3 mr-1" /> Admin Code
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'users' && (
          <div className="space-y-3">
            <Input
              placeholder="Search users by name or username..."
              value={searchUser}
              onChange={(e) => searchUsers(e.target.value)}
              className="bg-secondary"
            />
            {users.map(u => (
              <div key={u.id} className="flex items-center justify-between p-3 bg-card rounded-lg border border-border">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
                    {u.display_name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <span className="text-sm text-foreground">{u.display_name}</span>
                    {u.username && <span className="text-xs text-muted-foreground ml-1">@{u.username}</span>}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {servers.map(s => (
                    <Button key={s.id} size="sm" variant="outline" onClick={() => forceJoin(u.id, s.id)}>
                      <UserPlus className="w-3 h-3 mr-1" /> {s.name}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'codes' && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase mb-3">Generate Admin Codes</h4>
            {servers.map(s => (
              <div key={s.id} className="flex items-center justify-between p-3 bg-card rounded-lg border border-border">
                <span className="text-sm text-foreground">{s.name}</span>
                <Button size="sm" onClick={() => generateAdminCode(s.id)}>
                  <Key className="w-3 h-3 mr-1" /> Generate
                </Button>
              </div>
            ))}
            {generatedCode && (
              <div className="p-4 bg-khappy-green/10 rounded-lg border border-khappy-green/30">
                <p className="text-sm text-foreground mb-1">Admin Code:</p>
                <code
                  className="text-lg font-mono font-bold text-khappy-green cursor-pointer"
                  onClick={() => { navigator.clipboard.writeText(generatedCode); toast.success('Copied!'); }}
                >
                  {generatedCode}
                </code>
                <p className="text-xs text-muted-foreground mt-1">Click to copy • Expires in 24h</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
