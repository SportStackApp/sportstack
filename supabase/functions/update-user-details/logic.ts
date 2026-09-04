export const PROFILE_FIELDS = [
  "first_name",
  "last_name",
  "phone",
  "street_address",
  "suburb",
  "date_of_birth",
  "gender",
  "emergency_contact_name",
  "emergency_contact_phone",
] as const;

export type ProfileUpdate = Partial<Record<(typeof PROFILE_FIELDS)[number], unknown>>;

export type AuthUser = {
  email?: string | null;
};

export type OperationError = {
  message: string;
};

export type AuthGateway = {
  getUserById: (userId: string) => Promise<{ user: AuthUser | null; error: OperationError | null }>;
  updateEmail: (userId: string, email: string) => Promise<{ error: OperationError | null }>;
};

export type ProfileGateway = {
  updateProfile: (userId: string, update: ProfileUpdate) => Promise<{ error: OperationError | null }>;
};

export type SaveUserDetailsInput = {
  userId: string;
  requestedEmail: string;
  profileUpdate: ProfileUpdate;
  isSuperAdmin: boolean;
  auth: AuthGateway;
  profiles: ProfileGateway;
};

export type SaveUserDetailsResult =
  | { ok: true; emailChanged: boolean }
  | { ok: false; status: number; error: string; rollbackFailed?: boolean };

export const normaliseEmail = (value: string) => value.trim().toLowerCase();

export const buildProfileUpdate = (body: Record<string, unknown>): ProfileUpdate => {
  const update: ProfileUpdate = {};
  for (const field of PROFILE_FIELDS) {
    if (field in body) update[field] = body[field];
  }
  return update;
};

export const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

/**
 * Auth and public profile data cannot share one database transaction. To avoid
 * the old partial-save bug, Auth is validated first, then changed, and rolled
 * back if the profile update fails.
 */
export const saveUserDetails = async ({
  userId,
  requestedEmail,
  profileUpdate,
  isSuperAdmin,
  auth,
  profiles,
}: SaveUserDetailsInput): Promise<SaveUserDetailsResult> => {
  let previousEmail = "";
  let emailChanged = false;

  if (requestedEmail) {
    const authLookup = await auth.getUserById(userId);
    if (authLookup.error || !authLookup.user) {
      return {
        ok: false,
        status: 400,
        error: `Authentication lookup failed: ${authLookup.error?.message || "User not found"}`,
      };
    }

    previousEmail = normaliseEmail(authLookup.user.email || "");
    emailChanged = requestedEmail !== previousEmail;

    if (emailChanged && !isSuperAdmin) {
      return {
        ok: false,
        status: 403,
        error: "Only a Super Admin can change a user's email address.",
      };
    }

    if (emailChanged) {
      const authUpdate = await auth.updateEmail(userId, requestedEmail);
      if (authUpdate.error) {
        return {
          ok: false,
          status: 400,
          error: `Email update failed: ${authUpdate.error.message}`,
        };
      }
    }
  }

  if (Object.keys(profileUpdate).length > 0) {
    const profileResult = await profiles.updateProfile(userId, profileUpdate);
    if (profileResult.error) {
      if (emailChanged && previousEmail) {
        const rollback = await auth.updateEmail(userId, previousEmail);
        if (rollback.error) {
          return {
            ok: false,
            status: 500,
            error: "Profile update failed and the authentication email rollback also failed. Manual repair is required.",
            rollbackFailed: true,
          };
        }
      }

      return {
        ok: false,
        status: 400,
        error: `Profile update failed: ${profileResult.error.message}`,
      };
    }
  }

  return { ok: true, emailChanged };
};
