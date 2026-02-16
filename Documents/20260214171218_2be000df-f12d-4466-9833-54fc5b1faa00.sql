
-- Create role enum
CREATE TYPE public.server_role AS ENUM ('owner', 'admin', 'member');

-- Create member status enum
CREATE TYPE public.member_status AS ENUM ('active', 'muted', 'banned');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  status TEXT DEFAULT 'offline',
  bio TEXT DEFAULT '',
  phone_number TEXT,
  last_seen TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view profiles"
  ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Servers table
CREATE TABLE public.servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  icon_url TEXT,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_code TEXT UNIQUE DEFAULT encode(gen_random_bytes(4), 'hex'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.servers ENABLE ROW LEVEL SECURITY;

-- Server members table
CREATE TABLE public.server_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role server_role NOT NULL DEFAULT 'member',
  status member_status NOT NULL DEFAULT 'active',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(server_id, user_id)
);

ALTER TABLE public.server_members ENABLE ROW LEVEL SECURITY;

-- Helper functions
CREATE OR REPLACE FUNCTION public.is_server_member(_user_id UUID, _server_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.server_members
    WHERE user_id = _user_id AND server_id = _server_id AND status != 'banned'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_server_admin(_user_id UUID, _server_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.server_members
    WHERE user_id = _user_id AND server_id = _server_id AND role IN ('admin', 'owner') AND status = 'active'
  );
$$;

-- Server RLS
CREATE POLICY "Members can view servers"
  ON public.servers FOR SELECT TO authenticated
  USING (public.is_server_member(auth.uid(), id));

CREATE POLICY "Authenticated can create servers"
  ON public.servers FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Admins can update servers"
  ON public.servers FOR UPDATE TO authenticated
  USING (public.is_server_admin(auth.uid(), id));

CREATE POLICY "Owner can delete servers"
  ON public.servers FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- Server members RLS
CREATE POLICY "Members can view server members"
  ON public.server_members FOR SELECT TO authenticated
  USING (public.is_server_member(auth.uid(), server_id));

CREATE POLICY "Users can join servers"
  ON public.server_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND role = 'member');

CREATE POLICY "Admins can update members"
  ON public.server_members FOR UPDATE TO authenticated
  USING (public.is_server_admin(auth.uid(), server_id));

CREATE POLICY "Members can leave or admins can kick"
  ON public.server_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_server_admin(auth.uid(), server_id));

-- Channels table
CREATE TABLE public.channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'general',
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view channels"
  ON public.channels FOR SELECT TO authenticated
  USING (public.is_server_member(auth.uid(), server_id));

CREATE POLICY "Admins can create channels"
  ON public.channels FOR INSERT TO authenticated
  WITH CHECK (public.is_server_admin(auth.uid(), server_id));

CREATE POLICY "Admins can update channels"
  ON public.channels FOR UPDATE TO authenticated
  USING (public.is_server_admin(auth.uid(), server_id));

CREATE POLICY "Admins can delete channels"
  ON public.channels FOR DELETE TO authenticated
  USING (public.is_server_admin(auth.uid(), server_id));

-- Messages table
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE,
  dm_id UUID,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at TIMESTAMPTZ
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- DMs table
CREATE TABLE public.dms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dms ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.dm_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dm_id UUID NOT NULL REFERENCES public.dms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(dm_id, user_id)
);

ALTER TABLE public.dm_participants ENABLE ROW LEVEL SECURITY;

-- DM helper
CREATE OR REPLACE FUNCTION public.is_dm_participant(_user_id UUID, _dm_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.dm_participants
    WHERE user_id = _user_id AND dm_id = _dm_id
  );
$$;

-- DM RLS
CREATE POLICY "Participants can view DMs"
  ON public.dms FOR SELECT TO authenticated
  USING (public.is_dm_participant(auth.uid(), id));

CREATE POLICY "Authenticated can create DMs"
  ON public.dms FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Participants can view DM participants"
  ON public.dm_participants FOR SELECT TO authenticated
  USING (public.is_dm_participant(auth.uid(), dm_id));

CREATE POLICY "Authenticated can add DM participants"
  ON public.dm_participants FOR INSERT TO authenticated
  WITH CHECK (true);

-- Messages RLS
CREATE POLICY "Can view channel messages"
  ON public.messages FOR SELECT TO authenticated
  USING (
    (channel_id IS NOT NULL AND public.is_server_member(auth.uid(), (SELECT server_id FROM public.channels WHERE id = channel_id)))
    OR
    (dm_id IS NOT NULL AND public.is_dm_participant(auth.uid(), dm_id))
  );

CREATE POLICY "Can send channel messages"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND (
      (channel_id IS NOT NULL AND public.is_server_member(auth.uid(), (SELECT server_id FROM public.channels WHERE id = channel_id)))
      OR
      (dm_id IS NOT NULL AND public.is_dm_participant(auth.uid(), dm_id))
    )
  );

CREATE POLICY "Can edit own messages"
  ON public.messages FOR UPDATE TO authenticated
  USING (sender_id = auth.uid());

CREATE POLICY "Can delete own messages or admin"
  ON public.messages FOR DELETE TO authenticated
  USING (
    sender_id = auth.uid()
    OR (channel_id IS NOT NULL AND public.is_server_admin(auth.uid(), (SELECT server_id FROM public.channels WHERE id = channel_id)))
  );

-- Mentions/pings table
CREATE TABLE public.mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own mentions"
  ON public.mentions FOR SELECT TO authenticated
  USING (mentioned_user_id = auth.uid());

CREATE POLICY "Authenticated can create mentions"
  ON public.mentions FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own mentions"
  ON public.mentions FOR UPDATE TO authenticated
  USING (mentioned_user_id = auth.uid());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mentions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.server_members;

-- Function to create server with owner as member
CREATE OR REPLACE FUNCTION public.create_server_with_channel(
  _name TEXT,
  _description TEXT DEFAULT ''
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _server_id UUID;
BEGIN
  INSERT INTO public.servers (name, description, owner_id)
  VALUES (_name, _description, auth.uid())
  RETURNING id INTO _server_id;

  INSERT INTO public.server_members (server_id, user_id, role)
  VALUES (_server_id, auth.uid(), 'owner');

  INSERT INTO public.channels (server_id, name, description)
  VALUES (_server_id, 'general', 'General discussion');

  RETURN _server_id;
END;
$$;

-- Function to join server by invite code
CREATE OR REPLACE FUNCTION public.join_server_by_code(_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _server_id UUID;
BEGIN
  SELECT id INTO _server_id FROM public.servers WHERE invite_code = _code;
  IF _server_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  -- Check if banned
  IF EXISTS (SELECT 1 FROM public.server_members WHERE server_id = _server_id AND user_id = auth.uid() AND status = 'banned') THEN
    RAISE EXCEPTION 'You are banned from this server';
  END IF;

  -- Check if already member
  IF EXISTS (SELECT 1 FROM public.server_members WHERE server_id = _server_id AND user_id = auth.uid()) THEN
    RETURN _server_id;
  END IF;

  INSERT INTO public.server_members (server_id, user_id, role)
  VALUES (_server_id, auth.uid(), 'member');

  RETURN _server_id;
END;
$$;

-- Function to get or create DM
CREATE OR REPLACE FUNCTION public.get_or_create_dm(_other_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _dm_id UUID;
BEGIN
  SELECT dp1.dm_id INTO _dm_id
  FROM public.dm_participants dp1
  JOIN public.dm_participants dp2 ON dp1.dm_id = dp2.dm_id
  WHERE dp1.user_id = auth.uid() AND dp2.user_id = _other_user_id;

  IF _dm_id IS NOT NULL THEN
    RETURN _dm_id;
  END IF;

  INSERT INTO public.dms DEFAULT VALUES RETURNING id INTO _dm_id;
  INSERT INTO public.dm_participants (dm_id, user_id) VALUES (_dm_id, auth.uid());
  INSERT INTO public.dm_participants (dm_id, user_id) VALUES (_dm_id, _other_user_id);

  RETURN _dm_id;
END;
$$;

-- Admin action function
CREATE OR REPLACE FUNCTION public.admin_action(
  _server_id UUID,
  _target_user_id UUID,
  _action TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check caller is admin
  IF NOT public.is_server_admin(auth.uid(), _server_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Prevent action on owner
  IF EXISTS (SELECT 1 FROM public.server_members WHERE server_id = _server_id AND user_id = _target_user_id AND role = 'owner') THEN
    RAISE EXCEPTION 'Cannot perform action on server owner';
  END IF;

  CASE _action
    WHEN 'kick' THEN
      DELETE FROM public.server_members WHERE server_id = _server_id AND user_id = _target_user_id;
    WHEN 'ban' THEN
      UPDATE public.server_members SET status = 'banned' WHERE server_id = _server_id AND user_id = _target_user_id;
    WHEN 'mute' THEN
      UPDATE public.server_members SET status = 'muted' WHERE server_id = _server_id AND user_id = _target_user_id;
    WHEN 'unmute' THEN
      UPDATE public.server_members SET status = 'active' WHERE server_id = _server_id AND user_id = _target_user_id;
    WHEN 'make_admin' THEN
      UPDATE public.server_members SET role = 'admin' WHERE server_id = _server_id AND user_id = _target_user_id;
    WHEN 'remove_admin' THEN
      UPDATE public.server_members SET role = 'member' WHERE server_id = _server_id AND user_id = _target_user_id;
    ELSE
      RAISE EXCEPTION 'Invalid action';
  END CASE;
END;
$$;

-- Storage bucket for chat uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-uploads', 'chat-uploads', true);

CREATE POLICY "Authenticated can upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-uploads');

CREATE POLICY "Anyone can view uploads"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chat-uploads');

CREATE POLICY "Users can delete own uploads"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'chat-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Updated at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
