alter table public.coach_position_assessments
  alter column assessment drop not null;

alter table public.coach_position_assessments
  drop constraint if exists coach_position_assessments_assessment_check;

alter table public.coach_position_assessments
  add constraint coach_position_assessments_assessment_check
  check (assessment is null or assessment between 1 and 4);

comment on column public.coach_position_assessments.assessment is
  'Optional coach rating from 1 to 4. Null means the rating has been cleared or not supplied.';
