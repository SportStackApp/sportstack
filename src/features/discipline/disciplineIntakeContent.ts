export const HV_RULES_URL =
  "https://cdn.revolutionise.com.au/cups/vichockey/files/tuqrabulv5ovd3og.pdf";
export const HV_INCIDENT_FORM_URL =
  "https://cdn.revolutionise.com.au/cups/vichockey/files/qwitffhsg8wpy0lk.docx";
export const HA_DISCIPLINE_POLICY_URL =
  "https://www.hockeyballarat.com.au/uploads/1/4/8/3/148316959/de3wntx1qsqupsyp.pdf";

export const JURISDICTION_HELP: Record<
  string,
  { title: string; summary: string; reasonPrompt: string }
> = {
  UNASSESSED: {
    title: "Needs assessment",
    summary:
      "Use this when the facts or applicable policy are not yet clear. No Rule 7 timing pathway starts until a human completes the assessment.",
    reasonPrompt:
      "State what is known, what is unclear and what information or advice is needed before selecting a pathway.",
  },
  COMPETITION_RULE_7: {
    title: "HV Competition Rule 7",
    summary:
      "Use for alleged misconduct during or in connection with a hockey match when Rule 7 is the applicable competition process. This selection starts screening and the applicable Rule 7 timing pathway; it does not decide guilt.",
    reasonPrompt:
      "State the match connection, who is reported to be involved, how the matter was received and the facts that make Rule 7 potentially applicable.",
  },
  NIF_REFERRAL: {
    title: "National integrity policy referral",
    summary:
      "Use only when the reported conduct may fall under an applicable integrity policy, such as safeguarding or discrimination. Hockey Ballarat's current adoption and referral contact still need confirmation.",
    reasonPrompt:
      "Identify the possible policy area and the reported facts supporting referral. Do not state that a breach has been proven.",
  },
  EXTERNAL_SAFETY_REFERRAL: {
    title: "External safety referral",
    summary:
      "Use when the matter is being referred to police, child protection, emergency services or another external authority. The internal record is retained and may be paused or continue as appropriate.",
    reasonPrompt:
      "Record the safety concern, authority or service involved, action already taken and any instructions about pausing the internal process.",
  },
  OTHER_REFERRAL: {
    title: "Other referral",
    summary:
      "Use when another organisation, policy or process is better placed to manage the matter and the listed pathways do not fit.",
    reasonPrompt:
      "Name the proposed process or organisation and explain the facts supporting that referral.",
  },
};
