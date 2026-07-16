-- Add the disputed state in its own transaction. PostgreSQL enum values cannot
-- safely be added and then used by later statements in the same transaction.
alter type public.mvp_session_status
  add value if not exists 'RESULT_DISPUTED';
