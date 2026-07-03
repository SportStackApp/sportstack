export interface ProfileCompletionFields {
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
}

const hasValue = (value?: string | null) => Boolean(value?.trim());

export const isProfileReviewRequired = (profile?: ProfileCompletionFields | null) => {
  if (!profile) return true;

  return !(
    hasValue(profile.first_name) &&
    hasValue(profile.last_name) &&
    hasValue(profile.phone) &&
    hasValue(profile.date_of_birth) &&
    hasValue(profile.gender)
  );
};
