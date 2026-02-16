import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { uploadChatImage } from '@/lib/supabase-helpers';
import { X, Camera, LogOut, Volume2, VolumeX } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

interface Props {
  onClose: () => void;
}

export default function UserSettings({ onClose }: Props) {
  const { user, signOut } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Sound settings (stored in localStorage)
  const [soundPing, setSoundPing] = useState(() => localStorage.getItem('sound_ping') !== 'false');
  const [soundMessage, setSoundMessage] = useState(() => localStorage.getItem('sound_message') !== 'false');
  const [soundJoin, setSoundJoin] = useState(() => localStorage.getItem('sound_join') !== 'false');

  useEffect(() => {
    if (user) {
      fetchProfile();
      setEmail(user.email || '');
    }
  }, [user]);

  const fetchProfile = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('display_name, bio, phone_number, avatar_url, username')
      .eq('id', user!.id)
      .single();
    if (data) {
      setDisplayName(data.display_name || '');
      setUsername(data.username || '');
      setBio(data.bio || '');
      setPhone(data.phone_number || '');
      setAvatarUrl(data.avatar_url);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({
        display_name: displayName,
        username: username.toLowerCase(),
        bio,
        phone_number: phone,
      }).eq('id', user!.id);
      if (error) throw error;

      if (email !== user!.email) {
        const { error: emailError } = await supabase.auth.updateUser({ email });
        if (emailError) throw emailError;
      }

      // Save sound settings
      localStorage.setItem('sound_ping', String(soundPing));
      localStorage.setItem('sound_message', String(soundMessage));
      localStorage.setItem('sound_join', String(soundJoin));

      toast.success('Profile updated!');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    try {
      const url = await uploadChatImage(file, user.id);
      await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id);
      setAvatarUrl(url);
      toast.success('Avatar updated!');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const toggleSound = (key: string, value: boolean, setter: (v: boolean) => void) => {
    setter(value);
    localStorage.setItem(key, String(value));
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex">
      <div className="flex-1 max-w-2xl mx-auto p-8 overflow-y-auto">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-foreground">User Settings</h2>
          <button onClick={onClose} className="p-2 hover:bg-khappy-hover rounded-full">
            <X className="w-6 h-6 text-muted-foreground" />
          </button>
        </div>

        {/* Avatar */}
        <div className="flex items-center gap-4 mb-8">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-primary-foreground">
                  {displayName[0]?.toUpperCase() || '?'}
                </span>
              )}
            </div>
            <label className="absolute bottom-0 right-0 w-7 h-7 bg-primary rounded-full flex items-center justify-center cursor-pointer hover:opacity-80">
              <Camera className="w-4 h-4 text-primary-foreground" />
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </label>
          </div>
          <div>
            <p className="font-semibold text-foreground">{displayName || 'User'}</p>
            <p className="text-sm text-muted-foreground">{username ? `@${username}` : user?.email}</p>
          </div>
        </div>

        {/* Fields */}
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Display Name</label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="bg-secondary" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Username</label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              className="bg-secondary"
              placeholder="your_username"
              maxLength={20}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Bio</label>
            <Input value={bio} onChange={(e) => setBio(e.target.value)} className="bg-secondary" placeholder="Tell us about yourself..." />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Email</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-secondary" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase mb-1 block">Phone Number</label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="bg-secondary" placeholder="+1 234 567 8900" />
          </div>

          {/* Sound Settings */}
          <div className="border-t border-border pt-4 mt-4">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Volume2 className="w-4 h-4" /> Sound Settings
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">Ping notifications</span>
                <Switch checked={soundPing} onCheckedChange={(v) => toggleSound('sound_ping', v, setSoundPing)} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">Message sounds</span>
                <Switch checked={soundMessage} onCheckedChange={(v) => toggleSound('sound_message', v, setSoundMessage)} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">Join/leave sounds</span>
                <Switch checked={soundJoin} onCheckedChange={(v) => toggleSound('sound_join', v, setSoundJoin)} />
              </div>
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>

          <Button variant="destructive" onClick={signOut} className="w-full">
            <LogOut className="w-4 h-4 mr-2" /> Log Out
          </Button>
        </div>
      </div>
    </div>
  );
}
