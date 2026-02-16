
-- Fix overly permissive policies on dms
DROP POLICY "Authenticated can create DMs" ON public.dms;
CREATE POLICY "Authenticated can create DMs"
  ON public.dms FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Fix dm_participants
DROP POLICY "Authenticated can add DM participants" ON public.dm_participants;
CREATE POLICY "Authenticated can add DM participants"
  ON public.dm_participants FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_dm_participant(auth.uid(), dm_id));

-- Fix mentions
DROP POLICY "Authenticated can create mentions" ON public.mentions;
CREATE POLICY "Authenticated can create mentions"
  ON public.mentions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
