-- Remove the 3 stale admin_save_user_roles overloads.
-- Keep only the version the app calls: (uuid, text[], jsonb, jsonb, uuid[], jsonb).
-- Full source of all 4 backed up in notes/2026-06-24-admin_save_user_roles-backup.sql
-- Fixes: "Roles & Teams save reports success but doesn't persist" (overload resolution clash).
DROP FUNCTION IF EXISTS public.admin_save_user_roles(uuid, text[], uuid[], uuid[]);
DROP FUNCTION IF EXISTS public.admin_save_user_roles(uuid, text[], uuid[], uuid[], uuid[], uuid[]);
DROP FUNCTION IF EXISTS public.admin_save_user_roles(uuid, text[], jsonb, jsonb, uuid[], uuid[]);
