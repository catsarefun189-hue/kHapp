
-- District admin role type
CREATE TYPE public.app_role AS ENUM ('district_admin');

-- User roles table (cross-server roles)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check app roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- District admins can view all user_roles
CREATE POLICY "District admins can view roles"
ON public.user_roles FOR SELECT
USING (has_role(auth.uid(), 'district_admin') OR user_id = auth.uid());

-- District admins can manage roles
CREATE POLICY "District admins can insert roles"
ON public.user_roles FOR INSERT
WITH CHECK (has_role(auth.uid(), 'district_admin'));

CREATE POLICY "District admins can delete roles"
ON public.user_roles FOR DELETE
USING (has_role(auth.uid(), 'district_admin'));

-- Channel type enum
CREATE TYPE public.channel_type AS ENUM ('text', 'voice', 'video');

-- Add channel_type to channels
ALTER TABLE public.channels ADD COLUMN channel_type channel_type NOT NULL DEFAULT 'text';

-- Admin codes table for generating admin invite codes
CREATE TABLE public.admin_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(6), 'hex'),
  server_id UUID NOT NULL,
  created_by UUID NOT NULL,
  used_by UUID,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '24 hours')
);

ALTER TABLE public.admin_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can create admin codes"
ON public.admin_codes FOR INSERT
WITH CHECK (is_server_admin(auth.uid(), server_id) OR has_role(auth.uid(), 'district_admin'));

CREATE POLICY "Admins can view admin codes"
ON public.admin_codes FOR SELECT
USING (is_server_admin(auth.uid(), server_id) OR has_role(auth.uid(), 'district_admin'));

CREATE POLICY "Users can use admin codes"
ON public.admin_codes FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- District admin: force join any server function
CREATE OR REPLACE FUNCTION public.district_admin_force_join(_server_id UUID, _target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'district_admin') THEN
    RAISE EXCEPTION 'Not a district admin';
  END IF;

  -- Remove ban if exists
  DELETE FROM public.server_members WHERE server_id = _server_id AND user_id = _target_user_id AND status = 'banned';

  -- Add if not member
  IF NOT EXISTS (SELECT 1 FROM public.server_members WHERE server_id = _server_id AND user_id = _target_user_id) THEN
    INSERT INTO public.server_members (server_id, user_id, role) VALUES (_server_id, _target_user_id, 'member');
  END IF;
END;
$$;

-- Use admin code function
CREATE OR REPLACE FUNCTION public.use_admin_code(_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _record RECORD;
BEGIN
  SELECT * INTO _record FROM public.admin_codes
  WHERE code = _code AND used_by IS NULL AND expires_at > now();

  IF _record IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired admin code';
  END IF;

  -- Make user admin of that server
  UPDATE public.server_members SET role = 'admin'
  WHERE server_id = _record.server_id AND user_id = auth.uid();

  -- If not member, join + admin
  IF NOT FOUND THEN
    INSERT INTO public.server_members (server_id, user_id, role)
    VALUES (_record.server_id, auth.uid(), 'admin');
  END IF;

  -- Mark code used
  UPDATE public.admin_codes SET used_by = auth.uid(), used_at = now() WHERE id = _record.id;

  RETURN _record.server_id;
END;
$$;

-- Enable realtime for messages (if not already)
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_codes;
