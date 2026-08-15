export const HV_RULES_URL =
  "https://cdn.revolutionise.com.au/cups/vichockey/files/tuqrabulv5ovd3og.pdf";
export const HV_INCIDENT_FORM_URL =
  "https://cdn.revolutionise.com.au/cups/vichockey/files/qwitffhsg8wpy0lk.docx";
export const HV_SCHEDULES_URL =
  "https://cdn.revolutionise.com.au/cups/vichockey/files/jnpjob9q1ytyxveo.pdf";
export const HA_DISCIPLINE_POLICY_URL =
  "https://www.hockeyballarat.com.au/uploads/1/4/8/3/148316959/de3wntx1qsqupsyp.pdf";
export const HB_BYLAW_ADDENDUM_URL =
  "https://www.hockeyballarat.com.au/uploads/1/4/8/3/148316959/hb_by-law_addendum_2026.pdf";
export const SIA_INVESTIGATION_GUIDE_URL =
  "https://www.sportintegrity.gov.au/sites/default/files/Investigation%20of%20Complaints%20Guidelines.pdf";

export const TRIBUNAL_READINESS_CONTENT = {
  GREEN: {
    title: "Green - no current direct-Tribunal trigger",
    description:
      "The recorded facts match a Schedule row that is not marked for immediate Tribunal referral. This does not mean the allegation is minor, proven or finished.",
    className:
      "border-emerald-500/40 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-100",
  },
  AMBER: {
    title: "Amber - classification review required",
    description:
      "The answers do not safely match one verified Schedule row. Seek human classification advice and prepare for the possibility of a Tribunal if the facts change.",
    className:
      "border-amber-500/40 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100",
  },
  RED: {
    title: "Red - prepare for direct Tribunal referral",
    description:
      "The selected Schedule row is marked for immediate Tribunal referral. This is a preparation flag only; it is not a finding of guilt.",
    className:
      "border-red-500/40 bg-red-50 text-red-950 dark:bg-red-950/30 dark:text-red-100",
  },
} as const;

export const JURISDICTION_HELP: Record<
  string,
  {
    title: string;
    summary: string;
    reasonPrompt: string;
    whenItMayApply: string;
    nextSteps: string;
    citation: string;
    page: string;
    url: string;
    adoptionWarning?: string;
  }
> = {
  UNASSESSED: {
    title: "Needs assessment",
    summary:
      "Use this when the facts or applicable policy are not yet clear. No Rule 7 timing pathway starts until a human completes the assessment.",
    reasonPrompt:
      "State what is known, what is unclear and what information or advice is needed before selecting a pathway.",
    whenItMayApply: "The available facts or the governing policy are not yet clear enough for a responsible jurisdiction decision.",
    nextSteps: "Preserve the source material, obtain the missing facts or advice, then record a human pathway decision. Do not start a Rule 7 deadline automatically.",
    citation: "Human triage safeguard; compare HV Rules 7.1–7.12",
    page: "pp. 27–29",
    url: HV_RULES_URL,
    adoptionWarning: "Hockey Ballarat's local decision authority remains to be formally mapped.",
  },
  COMPETITION_RULE_7: {
    title: "HV Competition Rule 7",
    summary:
      "Use for alleged misconduct during or in connection with a hockey match when Rule 7 is the applicable competition process. This selection starts screening and the applicable Rule 7 timing pathway; it does not decide guilt.",
    reasonPrompt:
      "State the match connection, who is reported to be involved, how the matter was received and the facts that make Rule 7 potentially applicable.",
    whenItMayApply: "Reported misconduct occurred during, or in connection with, a hockey match and Hockey Victoria Competition Rule 7 governs the competition.",
    nextSteps: "Check timing and report requirements, screen the matter, appoint a suitable investigator where required, then use the Rule 7.7 Hockey Ballarat decision or formal Tribunal branch.",
    citation: "HV Competition Rules 7.1–7.12",
    page: "pp. 27–29",
    url: HV_RULES_URL,
    adoptionWarning: "HV references to the CEO or delegate are not yet formally mapped to a Hockey Ballarat office-holder.",
  },
  NIF_REFERRAL: {
    title: "National integrity policy referral",
    summary:
      "Use only when the reported conduct may fall under an applicable integrity policy, such as safeguarding or discrimination. Hockey Ballarat's current adoption and referral contact still need confirmation.",
    reasonPrompt:
      "Identify the possible policy area and the reported facts supporting referral. Do not state that a breach has been proven.",
    whenItMayApply: "The reported facts may engage a national integrity policy, including safeguarding, discrimination or member protection.",
    nextSteps: "Identify the policy area, preserve the report and make the authorised referral. Record any direction about whether the local process pauses or continues.",
    citation: "Hockey Australia Complaints, Disputes and Discipline Policy 6.7 and 7.1–7.6",
    page: "pp. 13–17",
    url: HA_DISCIPLINE_POLICY_URL,
    adoptionWarning: "Current Hockey Ballarat adoption, referral contact and authority are unconfirmed.",
  },
  EXTERNAL_SAFETY_REFERRAL: {
    title: "External safety referral",
    summary:
      "Use when the matter is being referred to police, child protection, emergency services or another external authority. The internal record is retained and may be paused or continue as appropriate.",
    reasonPrompt:
      "Record the safety concern, authority or service involved, action already taken and any instructions about pausing the internal process.",
    whenItMayApply: "There may be an urgent child-safety, criminal, medical or other regulatory concern requiring an external response.",
    nextSteps: "Act on the urgent risk, contact the appropriate authority, retain the internal record and document any direction about the internal process.",
    citation: "Hockey Australia Complaints, Disputes and Discipline Policy 6.7",
    page: "p. 13",
    url: HA_DISCIPLINE_POLICY_URL,
  },
  OTHER_REFERRAL: {
    title: "Other referral",
    summary:
      "Use when another organisation, policy or process is better placed to manage the matter and the listed pathways do not fit.",
    reasonPrompt:
      "Name the proposed process or organisation and explain the facts supporting that referral.",
    whenItMayApply: "Another policy, organisation or specialist process is better placed to manage the matter.",
    nextSteps: "Identify the receiving body, record the referral basis and maintain the private audit record without incorrectly starting Rule 7 timing.",
    citation: "Record the specific governing source selected by the Case Coordinator",
    page: "Case-specific",
    url: HV_RULES_URL,
    adoptionWarning: "The authority and governing source must be confirmed for each other referral.",
  },
};
