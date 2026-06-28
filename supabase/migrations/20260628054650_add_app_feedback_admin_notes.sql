alter table public.app_feedback
  add column if not exists admin_notes text;
