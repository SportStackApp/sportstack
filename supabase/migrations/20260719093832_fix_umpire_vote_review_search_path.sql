-- is_super_admin() currently resolves public.user_roles through its caller's
-- fixed search path, so the review function must include public explicitly.
alter function public.review_umpire_vote_submission(uuid, text, jsonb)
  set search_path = 'public';
