-- Supabase SQL migration for role-based access and audit trails
-- Run this in Supabase SQL editor.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user';

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id uuid NULL,
  target_user_id uuid NULL,
  action text NOT NULL,
  details text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON public.audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_user_id
  ON public.audit_logs (admin_user_id);

CREATE INDEX IF NOT EXISTS idx_event_access_user_event
  ON public.event_access (user_id, event_id);

ALTER TABLE public.event_access
  DROP CONSTRAINT IF EXISTS event_access_user_id_event_id_key;

ALTER TABLE public.event_access
  ADD CONSTRAINT event_access_user_id_event_id_key UNIQUE (user_id, event_id);
