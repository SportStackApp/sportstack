export const MINIMUM_PREDICTIVE_CHARACTERS = 3;

export type RiskDraft = {
  riskDescription: string;
  likelihood: string;
  severity: string;
  mitigationAction: string;
};

export function predictiveMatches<T extends { label: string; description?: string | null }>(
  query: string,
  options: T[],
  minimumCharacters = MINIMUM_PREDICTIVE_CHARACTERS,
) {
  const normalised = query.trim().toLocaleLowerCase();
  if (normalised.length < minimumCharacters) return [];
  return options.filter((option) =>
    `${option.label} ${option.description ?? ""}`
      .toLocaleLowerCase()
      .includes(normalised),
  );
}

export function validateRiskDraft(risk: RiskDraft) {
  const errors: string[] = [];
  if (risk.riskDescription.trim().length < 5) errors.push("Describe the risk.");
  if (!risk.likelihood) errors.push("Select a likelihood.");
  if (!risk.severity) errors.push("Select a severity.");
  if (risk.mitigationAction.trim().length < 5) errors.push("Record the action used to reduce the risk.");
  return errors;
}

export function neutralReferencePrefix(role: string) {
  return {
    REPORTER: "Reporter",
    REPORTED_PERSON: "Reported Person",
    WITNESS: "Witness",
    AFFECTED_PERSON: "Affected Person",
  }[role] ?? "Other Person";
}

export function canCompleteWorkflowStage(stage: string, roles: string[]) {
  if (stage === "NOTICE") return roles.some((role) => ["CASE_COORDINATOR", "TRIBUNAL_ADMINISTRATOR"].includes(role));
  if (["HEARING", "DETERMINATION"].includes(stage)) return roles.includes("TRIBUNAL_MEMBER");
  if (stage === "APPEAL") return roles.some((role) => ["APPEAL_BOARD_MEMBER", "CASE_COORDINATOR"].includes(role));
  if (stage === "CLOSURE") return roles.includes("CASE_COORDINATOR");
  return false;
}
