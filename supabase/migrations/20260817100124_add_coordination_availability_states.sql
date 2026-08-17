-- Role-specific fixture availability states used after a Coordination assignment is confirmed.
-- This is separate because PostgreSQL enum values must be committed before later migrations use them.

alter type public.availability_status_enum add value if not exists 'UMPIRING';
alter type public.availability_status_enum add value if not exists 'TECHNICAL_BENCH';
alter type public.availability_status_enum add value if not exists 'VOLUNTEERING';
