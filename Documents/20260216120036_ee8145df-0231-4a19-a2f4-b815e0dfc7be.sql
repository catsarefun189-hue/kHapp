
-- Add username column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text UNIQUE;

-- Update handle_new_user to generate a username from email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL),
    COALESCE(NEW.raw_user_meta_data->>'username', lower(replace(split_part(NEW.email, '@', 1), '.', '_')) || '_' || substr(NEW.id::text, 1, 4))
  );
  RETURN NEW;
END;
$function$;

-- Update admin_action to support make_owner
CREATE OR REPLACE FUNCTION public.admin_action(_server_id uuid, _target_user_id uuid, _action text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Check caller is admin/owner
  IF NOT public.is_server_admin(auth.uid(), _server_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Prevent action on server owner (except by another owner or make_owner)
  IF _action != 'make_owner' AND EXISTS (SELECT 1 FROM public.server_members WHERE server_id = _server_id AND user_id = _target_user_id AND role = 'owner') THEN
    RAISE EXCEPTION 'Cannot perform action on server owner';
  END IF;

  -- make_owner requires caller to be owner
  IF _action = 'make_owner' THEN
    IF NOT EXISTS (SELECT 1 FROM public.server_members WHERE server_id = _server_id AND user_id = auth.uid() AND role = 'owner') THEN
      RAISE EXCEPTION 'Only owners can promote to owner';
    END IF;
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
    WHEN 'make_owner' THEN
      UPDATE public.server_members SET role = 'owner' WHERE server_id = _server_id AND user_id = _target_user_id;
    ELSE
      RAISE EXCEPTION 'Invalid action';
  END CASE;
END;
$function$;
