import { supabase } from "@/integrations/supabase/client";

export async function createServer(name: string, description: string = '') {
  const { data, error } = await supabase.rpc('create_server_with_channel', {
    _name: name,
    _description: description,
  });
  if (error) throw error;
  return data as string;
}

export async function joinServerByCode(code: string) {
  const { data, error } = await supabase.rpc('join_server_by_code', {
    _code: code,
  });
  if (error) throw error;
  return data as string;
}

export async function getOrCreateDm(otherUserId: string) {
  const { data, error } = await supabase.rpc('get_or_create_dm', {
    _other_user_id: otherUserId,
  });
  if (error) throw error;
  return data as string;
}

export async function adminAction(serverId: string, targetUserId: string, action: string) {
  const { error } = await supabase.rpc('admin_action', {
    _server_id: serverId,
    _target_user_id: targetUserId,
    _action: action,
  });
  if (error) throw error;
}

export async function uploadChatImage(file: File, userId: string) {
  const ext = file.name.split('.').pop();
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from('chat-uploads')
    .upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from('chat-uploads').getPublicUrl(path);
  return data.publicUrl;
}

export async function updateOnlineStatus(userId: string, status: 'online' | 'offline') {
  await supabase.from('profiles').update({ 
    status, 
    last_seen: new Date().toISOString() 
  }).eq('id', userId);
}

export async function useAdminCode(code: string) {
  const { data, error } = await supabase.rpc('use_admin_code', { _code: code });
  if (error) throw error;
  return data as string;
}

export async function forceJoinServer(serverId: string, targetUserId: string) {
  const { error } = await supabase.rpc('district_admin_force_join', {
    _server_id: serverId,
    _target_user_id: targetUserId,
  });
  if (error) throw error;
}
