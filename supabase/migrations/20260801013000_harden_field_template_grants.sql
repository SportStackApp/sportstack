-- Keep reusable formation templates private to signed-in users.
-- RLS controls which signed-in users can read or manage each owner scope.

REVOKE ALL ON TABLE public.field_templates FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.field_templates FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.field_templates TO authenticated;
