import type { Json } from "@/integrations/supabase/types";

export type Phase2Stage =
  | "NOTICE"
  | "HEARING"
  | "DETERMINATION"
  | "APPEAL"
  | "CLOSURE";
export type Phase2Mode = "REAL" | "SIMULATION";

export const PHASE2_STAGES: Array<{
  key: Phase2Stage;
  title: string;
  source: string;
  guidance: string;
}> = [
  {
    key: "NOTICE",
    title: "Tribunal notice pack",
    source: "HV Rule 7.18, pages 31–32",
    guidance:
      "Give every affected person the hearing details, sufficient allegation particulars, the evidence relied on and their right to make written or oral submissions.",
  },
  {
    key: "HEARING",
    title: "Hearing record",
    source: "HV Rules 7.18–7.20, pages 31–33",
    guidance:
      "Record the charges, plea, parties heard, evidence considered and natural-justice checks. The Tribunal determines proof on the balance of probabilities.",
  },
  {
    key: "DETERMINATION",
    title: "Determination and sanctions",
    source: "HV Rules 7.20–7.21, pages 33–35",
    guidance:
      "Record each charge result and the majority basis. If a charge is proved, invite penalty submissions before recording any sanction.",
  },
  {
    key: "APPEAL",
    title: "Appeal pathway",
    source: "HV Rules 7.22–7.25, pages 35–38",
    guidance:
      "Record decision notification, the calculated deadline and the confirmed HB appeal destination. A lodged appeal stays execution and requires an independent Appeal Board and a new hearing on the merits.",
  },
  {
    key: "CLOSURE",
    title: "Final closure",
    source: "HV Rules 7.13–7.14 and 7.21.8; HB local treatment",
    guidance:
      "Close only after outcome notification, appeal completion, record completeness and a privacy/publication review. HB publication and retention treatment still requires confirmation.",
  },
];

export const PHASE2_STATUS_OPTIONS: Record<Phase2Stage, string[]> = {
  NOTICE: ["DRAFT", "ISSUED"],
  HEARING: ["DRAFT", "ADJOURNED", "COMPLETED"],
  DETERMINATION: ["DRAFT", "FINAL"],
  APPEAL: ["DRAFT", "LODGED", "NO_APPEAL", "FINAL"],
  CLOSURE: ["DRAFT", "CLOSED"],
};

export function blankPhase2Payload(stage: Phase2Stage): Record<string, Json> {
  const common = { simulation_acknowledged: false };
  if (stage === "NOTICE")
    return {
      ...common,
      recipient_name: "",
      recipient_email: "",
      hearing_at: "",
      hearing_location: "",
      allegation_particulars: "",
      evidence_relied_on: "",
      response_rights:
        "The affected person may make written representations and/or appear before the Tribunal to make submissions.",
      hb_presenter: "",
      all_affected_people_checked: false,
      notice_manually_issued: false,
      service_reference: "",
    };
  if (stage === "HEARING")
    return {
      ...common,
      charges_read: false,
      plea_recorded: false,
      plea: "",
      parties_heard: false,
      evidence_considered: false,
      natural_justice_confirmed: false,
      standard_of_proof: "BALANCE_OF_PROBABILITIES",
      hearing_notes: "",
      adjournment_reason: "",
    };
  if (stage === "DETERMINATION")
    return {
      ...common,
      standard_of_proof: "BALANCE_OF_PROBABILITIES",
      charge_results: "",
      majority_basis: "",
      reasons: "",
      any_charge_proved: false,
      penalty_submissions_invited: false,
      penalty_submissions: "",
      sanctions: "",
      reasons_publication_authorised: false,
    };
  if (stage === "APPEAL")
    return {
      ...common,
      decision_notified_at: "",
      appeal_deadline_at: "",
      pathway_confirmation: "",
      application_received: false,
      application_received_at: "",
      stay_applied: false,
      fee_status: "NOT_APPLICABLE_OR_UNCONFIRMED",
      applicant_and_grounds: "",
      cooperation_eligibility: "",
      panel_appointment_authority: "",
      panel_composition: "",
      qualified_chair_confirmed: false,
      panel_independence_confirmed: false,
      affected_people_heard: false,
      new_hearing_on_merits: false,
      appeal_majority_basis: "",
      appeal_outcome: "",
    };
  return {
    ...common,
    outcome_notified: false,
    appeal_complete: false,
    records_complete: false,
    privacy_review_complete: false,
    publication_treatment: "HB local treatment not yet confirmed",
    retention_treatment: "HB local treatment not yet confirmed",
    decision_notice_reference: "",
    sanctions_register_updated: false,
    administrative_fee_treatment: "",
    closure_summary: "",
  };
}

export function validatePhase2Stage(
  stage: Phase2Stage,
  status: string,
  mode: Phase2Mode,
  payload: Record<string, Json>,
) {
  const errors: string[] = [];
  const text = (key: string) => String(payload[key] ?? "").trim();
  const checked = (key: string) => payload[key] === true;
  if (mode === "SIMULATION" && !checked("simulation_acknowledged"))
    errors.push("Confirm that this record is a workflow simulation only.");
  if (status === "DRAFT") return errors;
  if (stage === "NOTICE") {
    if (text("recipient_name").length < 2 || !text("recipient_email").includes("@"))
      errors.push("Record a valid recipient name and email.");
    if (!text("hearing_at") || !text("hearing_location"))
      errors.push("Record the hearing time and place.");
    if (text("allegation_particulars").length < 20)
      errors.push("Record sufficient allegation particulars.");
    if (text("evidence_relied_on").length < 10 || text("response_rights").length < 10)
      errors.push("Record the relied-upon evidence and response rights.");
    if (!checked("all_affected_people_checked") || !checked("notice_manually_issued"))
      errors.push("Confirm affected people and manual issue outside SportStack.");
  }
  if (stage === "HEARING" && status === "COMPLETED") {
    ["charges_read", "plea_recorded", "parties_heard", "evidence_considered", "natural_justice_confirmed"].forEach(
      (key) => !checked(key) && errors.push("Complete every hearing safeguard."),
    );
    if (text("hearing_notes").length < 20) errors.push("Record detailed hearing notes.");
  }
  if (stage === "DETERMINATION" && status === "FINAL") {
    if (text("charge_results").length < 20 || text("majority_basis").length < 10 || text("reasons").length < 20)
      errors.push("Record the charge results, majority basis and reasons.");
    if (checked("any_charge_proved") && (!checked("penalty_submissions_invited") || !text("sanctions")))
      errors.push("Invite penalty submissions and record sanctions for a proved charge.");
  }
  if (stage === "APPEAL" && status !== "DRAFT") {
    if (!text("decision_notified_at") || !text("appeal_deadline_at") || text("pathway_confirmation").length < 10)
      errors.push("Record notification, deadline and the confirmed appeal pathway.");
    if (status === "LODGED" && (!checked("application_received") || !checked("stay_applied")))
      errors.push("Record the lodged application and stay.");
    if (status === "FINAL" && text("appeal_outcome").length < 10)
      errors.push("Record the final appeal outcome.");
    if (status === "FINAL" && (
      text("panel_appointment_authority").length < 3 ||
      text("panel_composition").length < 10 ||
      !checked("qualified_chair_confirmed") ||
      !checked("panel_independence_confirmed") ||
      !checked("affected_people_heard") ||
      !checked("new_hearing_on_merits") ||
      text("appeal_majority_basis").length < 10
    )) errors.push("Complete the Appeal Board appointment, independence, Chair, hearing and majority checks.");
  }
  if (stage === "CLOSURE" && status === "CLOSED") {
    ["outcome_notified", "appeal_complete", "records_complete", "privacy_review_complete"].forEach(
      (key) => !checked(key) && errors.push("Complete every closure safeguard."),
    );
    if (text("closure_summary").length < 20) errors.push("Record a complete closure summary.");
    if (text("decision_notice_reference").length < 3)
      errors.push("Record the decision-notification reference.");
  }
  return [...new Set(errors)];
}
