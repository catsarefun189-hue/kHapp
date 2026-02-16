import { useState, useEffect } from 'react';
import { useAuth, AuthProvider } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import Auth from './Auth';
import ServerBar from '@/components/chat/ServerBar';
import ChannelSidebar from '@/components/chat/ChannelSidebar';
import DMSidebar from '@/components/chat/DMSidebar';
import ChatArea from '@/components/chat/ChatArea';
import MembersPanel from '@/components/chat/MembersPanel';
import UserBar from '@/components/chat/UserBar';
import UserSettings from '@/components/chat/UserSettings';
import PingsPanel from '@/components/chat/PingsPanel';
import AiBotPanel from '@/components/chat/AiBotPanel';
import DistrictAdminPanel from '@/components/chat/DistrictAdminPanel';
import VoiceVideoChannel from '@/components/chat/VoiceVideoChannel';

function AppContent() {
  const { user, loading } = useAuth();
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [selectedChannelType, setSelectedChannelType] = useState<string>('text');
  const [selectedDmId, setSelectedDmId] = useState<string | null>(null);
  const [showDMs, setShowDMs] = useState(true);
  const [showMembers, setShowMembers] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPings, setShowPings] = useState(false);
  const [showAiBot, setShowAiBot] = useState(false);
  const [showDistrictAdmin, setShowDistrictAdmin] = useState(false);
  const [channelTitle, setChannelTitle] = useState('');
  const [dmTitle, setDmTitle] = useState('');
  const [unreadPings, setUnreadPings] = useState(0);

  useEffect(() => {
    if (!user) return;
    fetchUnreadPings();

    // Auto-join from URL
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get('join');
    if (joinCode) {
      import('@/lib/supabase-helpers').then(({ joinServerByCode }) => {
        joinServerByCode(joinCode).then((id) => {
          setSelectedServerId(id);
          setShowDMs(false);
          window.history.replaceState({}, '', '/');
        }).catch(() => {});
      });
    }

    const channel = supabase
      .channel('pings-count')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'mentions',
        filter: `mentioned_user_id=eq.${user.id}`
      }, () => fetchUnreadPings())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const fetchUnreadPings = async () => {
    if (!user) return;
    const { count } = await supabase.
    from('mentions').
    select('*', { count: 'exact', head: true }).
    eq('mentioned_user_id', user.id).
    eq('read', false);
    setUnreadPings(count || 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-khappy-serverbar">
        <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center animate-pulse">
          <span className="text-xl font-bold text-primary-foreground">k</span>
        </div>
      </div>);

  }

  if (!user) return <Auth />;

  const handleSelectServer = (id: string | null) => {
    setSelectedServerId(id);
    setShowDMs(false);
    setSelectedDmId(null);
    setSelectedChannelId(null);
    setSelectedChannelType('text');
    setChannelTitle('');
  };

  const handleSelectDMs = () => {
    setShowDMs(true);
    setSelectedServerId(null);
    setSelectedChannelId(null);
    setChannelTitle('');
  };

  const handleSelectChannel = (id: string, type?: string) => {
    setSelectedChannelId(id);
    setSelectedChannelType(type || 'text');
    setSelectedDmId(null);
    supabase.from('channels').select('name, channel_type').eq('id', id).single().
    then(({ data }) => {
      if (data) {
        setChannelTitle(data.name);
        setSelectedChannelType((data as any).channel_type || 'text');
      }
    });
  };

  const handleSelectDm = (dmId: string, title: string) => {
    setSelectedDmId(dmId);
    setSelectedChannelId(null);
    setDmTitle(title);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <div className="flex-1 flex overflow-hidden min-h-0">
        <ServerBar
          selectedServerId={selectedServerId}
          onSelectServer={handleSelectServer}
          onSelectDMs={handleSelectDMs}
          showDMs={showDMs} />


        <div className="flex flex-col shrink-0 bg-[#1c1d21]">
          {showDMs ?
          <DMSidebar selectedDmId={selectedDmId} onSelectDm={handleSelectDm} /> :
          selectedServerId ?
          <ChannelSidebar
            serverId={selectedServerId}
            selectedChannelId={selectedChannelId}
            onSelectChannel={handleSelectChannel}
            onShowMembers={() => setShowMembers(!showMembers)} /> :

          null}
        </div>

        {/* Main content area - text chat or voice/video */}
        {selectedChannelId && (selectedChannelType === 'voice' || selectedChannelType === 'video') ?
        <VoiceVideoChannel
          channelId={selectedChannelId}
          channelName={channelTitle}
          channelType={selectedChannelType as 'voice' | 'video'} /> :


        <ChatArea
          channelId={selectedChannelId}
          dmId={selectedDmId}
          title={selectedChannelId ? channelTitle : dmTitle} />

        }

        {showMembers && selectedServerId &&
        <MembersPanel serverId={selectedServerId} onClose={() => setShowMembers(false)} />
        }
      </div>

      <UserBar
        onOpenSettings={() => setShowSettings(true)}
        onOpenPings={() => setShowPings(true)}
        onOpenAiBot={() => setShowAiBot(true)}
        onOpenDistrictAdmin={() => setShowDistrictAdmin(true)}
        unreadPings={unreadPings} />


      {showSettings && <UserSettings onClose={() => setShowSettings(false)} />}
      {showPings && <PingsPanel onClose={() => setShowPings(false)} />}
      {showAiBot && <AiBotPanel onClose={() => setShowAiBot(false)} />}
      {showDistrictAdmin && <DistrictAdminPanel onClose={() => setShowDistrictAdmin(false)} />}
    </div>);

}

export default function Index() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>);

}