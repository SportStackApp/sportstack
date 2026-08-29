export type MvpSessionStatus = "PENDING" | "OPEN" | "RESULT_DISPUTED" | "CLOSED";

export type MvpResultCheckResponse = "CORRECT" | "INCORRECT";

export type MvpSessionDisplayState = "open" | "disputed" | "closed";

export interface MvpResultCheckState {
  response: MvpResultCheckResponse | null;
  incorrectCount: number;
  requiresCheck: boolean;
  canVote: boolean;
  resultCheckRound: number;
}

type SupabaseLikeError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

const MVP_ERROR_MESSAGES: Record<string, string> = {
  MVP_UNAUTHENTICATED: "Please sign in again before continuing.",
  MVP_NOT_AUTHENTICATED: "Please sign in again before continuing.",
  MVP_SESSION_NOT_FOUND: "This MVP voting round could not be found.",
  MVP_FIXTURE_NOT_FOUND: "This fixture could not be found.",
  MVP_TEAM_NOT_FOUND: "This team could not be found.",
  MVP_LEGACY_SESSION_READ_ONLY: "This older voting round is available as history only.",
  MVP_TEAM_SESSION_REQUIRED: "This older voting round is available as history only.",
  MVP_NOT_ELIGIBLE: "You are not listed as an attended player for this team in this match.",
  MVP_VOTER_NOT_ELIGIBLE: "You are not listed as an attended player for this team in this match.",
  MVP_TEAM_MISMATCH: "This voting round belongs to the other team in the match.",
  MVP_TEAM_NOT_IN_FIXTURE: "That team is not part of this fixture.",
  MVP_TEAM_DISABLED: "MVP voting is currently turned off for this team.",
  MVP_FIXTURE_NOT_COMPLETED: "The fixture must have a confirmed result before MVP voting can open.",
  MVP_CLOSE_TIME_MUST_BE_FUTURE: "Choose a closing time that is still in the future.",
  MVP_CLOSE_TIME_TOO_LATE: "Choose a closing time within the next 72 hours.",
  MVP_SESSION_CREATE_FAILED: "The team voting round could not be created.",
  MVP_SESSION_NOT_OPEN: "This MVP voting round is not open.",
  MVP_SESSION_ALREADY_OPEN: "This MVP voting round is already open.",
  MVP_SESSION_EXPIRED: "The voting deadline has passed.",
  MVP_SESSION_DEADLINE_PASSED: "The voting deadline has passed.",
  MVP_RESULT_DISPUTED: "Voting is paused while the match result is being reviewed.",
  MVP_RESOLVE_RESULT_FIRST: "Review the match result concern before changing this voting round.",
  MVP_UNRESOLVED_RESULT_CONCERN: "Review the match result concern before publishing the MVP results.",
  MVP_NO_ACTIVE_RESULT_CONCERN: "There is no result concern to resolve for this voting round.",
  MVP_RESULT_CHECK_REQUIRED: "Please check the match result before casting your vote.",
  MVP_RESULT_REPORTED_INCORRECT: "You reported that the match result is incorrect, so you cannot vote in this review round.",
  MVP_ALREADY_CHECKED_RESULT: "You have already checked the result for this review round.",
  MVP_RESULT_ALREADY_CHECKED: "You have already checked the result for this review round.",
  MVP_INVALID_RESULT_RESPONSE: "Choose whether the match result is correct or incorrect.",
  MVP_RESULT_COMMENT_TOO_LONG: "Keep the result comment under 2,000 characters.",
  MVP_ALREADY_SUBMITTED: "You have already submitted your ballot for this voting round.",
  MVP_BALLOT_ALREADY_SUBMITTED: "You have already submitted your ballot for this voting round.",
  MVP_SELF_VOTE: "You cannot vote for yourself.",
  MVP_SELF_VOTE_NOT_ALLOWED: "You cannot vote for yourself.",
  MVP_OPPONENT_VOTE: "You can only vote for an attended teammate.",
  MVP_PLAYER_NOT_ELIGIBLE: "You are not listed as an attended player for this team in this match.",
  MVP_INVALID_VOTE_TARGET: "Choose three different attended teammates from your side.",
  MVP_THREE_VOTES_REQUIRED: "Choose one player for three, two and one points.",
  MVP_DUPLICATE_PLAYER: "Choose three different players.",
  MVP_DUPLICATE_POINT_VALUE: "Each point value can only be used once.",
  MVP_INVALID_BALLOT: "Choose three different attended teammates.",
  MVP_REOPEN_NOT_ALLOWED: "This voting round cannot be reopened.",
  MVP_SESSION_CANNOT_REOPEN: "This voting round cannot be reopened.",
  MVP_USE_REOPEN: "This voting round is closed. Use Reopen to start a new voting cycle.",
  MVP_SESSION_NOT_CLOSED: "A reopen request can only be made after voting has closed.",
  MVP_REOPEN_ALREADY_REQUESTED: "A reopen request has already been sent for this round.",
  MVP_PERMISSION_DENIED: "You do not have permission to do that.",
  MVP_NOT_AUTHORISED: "You do not have permission to do that.",
  MVP_SUPER_ADMIN_REQUIRED: "Only a Super Admin can complete this action.",
  MVP_WITHDRAW_REASON_REQUIRED: "Enter a reason for withdrawing this ballot.",
  MVP_SUBMISSION_NOT_FOUND: "That player's submitted ballot could not be found.",
  MVP_PUBLISHED_BALLOT_IMMUTABLE: "A published ballot cannot be withdrawn.",
  MVP_RESULTS_NOT_PUBLISHED: "MVP results are available only after the round is safely closed.",
  MVP_CUTOVER_REASON_REQUIRED: "Enter an audit reason before closing legacy voting rounds.",
};

const readErrorText = (error: unknown) => {
  if (typeof error === "string") return error;
  if (!error || typeof error !== "object") return "";

  const typedError = error as SupabaseLikeError;
  return [typedError.code, typedError.message, typedError.details, typedError.hint]
    .filter(Boolean)
    .join(" ");
};

export const getMvpErrorMessage = (
  error: unknown,
  fallback = "Something went wrong. Please try again.",
) => {
  const errorText = readErrorText(error);
  const namedError = Object.keys(MVP_ERROR_MESSAGES).find((code) => errorText.includes(code));

  if (namedError) return MVP_ERROR_MESSAGES[namedError];

  if (/duplicate key|unique constraint/i.test(errorText)) {
    return "This action has already been completed. Refresh the page to see the latest result.";
  }

  return fallback;
};

export const isMvpUpgradeUnavailable = (error: unknown) => {
  const errorText = readErrorText(error);
  return (
    /PGRST202|PGRST204|schema cache/i.test(errorText) ||
    /column .*team_id.* does not exist/i.test(errorText) ||
    /function public\.(get_mvp_result_check_state|submit_mvp_ballot|record_mvp_result_check|request_mvp_session_reopen).*does not exist/i.test(
      errorText,
    )
  );
};

export const getMvpSessionDisplayState = (
  status: MvpSessionStatus,
  closesAt?: string | null,
): MvpSessionDisplayState => {
  if (status === "RESULT_DISPUTED") return "disputed";
  if (status === "CLOSED") return "closed";

  if (status === "OPEN" && closesAt) {
    const closesAtMs = new Date(closesAt).getTime();
    if (!Number.isNaN(closesAtMs) && closesAtMs <= Date.now()) return "closed";
  }

  return status === "OPEN" ? "open" : "closed";
};

export const normaliseMvpResultCheckState = (value: unknown): MvpResultCheckState => {
  const unwrapped = Array.isArray(value) ? value[0] : value;
  const row = unwrapped && typeof unwrapped === "object"
    ? (unwrapped as Record<string, unknown>)
    : {};

  const response = row.response === "CORRECT" || row.response === "INCORRECT"
    ? row.response
    : row.player_response === "CORRECT" || row.player_response === "INCORRECT"
      ? row.player_response
      : null;
  const incorrectCountValue = row.incorrect_count ?? row.incorrectCount ?? 0;
  const incorrectCount = Number.isFinite(Number(incorrectCountValue))
    ? Number(incorrectCountValue)
    : 0;
  const resultCheckRoundValue = row.result_check_round ?? row.resultCheckRound ?? 1;
  const resultCheckRound = Number.isFinite(Number(resultCheckRoundValue))
    ? Number(resultCheckRoundValue)
    : 1;
  const requiresCheckValue = row.requires_check ?? row.requiresCheck ?? row.required;
  const canVoteValue = row.can_vote ?? row.canVote;

  return {
    response,
    incorrectCount,
    requiresCheck: typeof requiresCheckValue === "boolean" ? requiresCheckValue : incorrectCount > 0,
    canVote: typeof canVoteValue === "boolean" ? canVoteValue : response !== "INCORRECT",
    resultCheckRound,
  };
};
