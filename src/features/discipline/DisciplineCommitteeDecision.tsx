import { FormEvent, useState } from "react";
import { Archive, ExternalLink, Gavel, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { HV_RULES_URL } from "./disciplineIntakeContent";
import type { DisciplineWorkspaceData } from "./types";
import { WorkflowSection } from "./DisciplineUi";

type DecisionValues = {
  outcome: string;
  decisionReason: string;
  ruleReference: string;
  recommendationFollowed: boolean;
  differenceReason?: string;
};

export function DisciplineCommitteeDecision({
  data,
  canDecide,
  busy,
  onDecision,
  onDirectTribunalReferral,
}: {
  data: DisciplineWorkspaceData;
  canDecide: boolean;
  busy: boolean;
  onDecision: (values: DecisionValues) => void;
  onDirectTribunalReferral: (reason: string, authorityReference: string) => void;
}) {
  const [recommendationFollowed, setRecommendationFollowed] = useState("YES");
  const directTribunal = data.incidentCase.pathway === "DIRECT_TRIBUNAL";

  const submitDecision = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onDecision({
      outcome: String(form.get("outcome") || ""),
      decisionReason: String(form.get("decisionReason") || ""),
      ruleReference: String(form.get("ruleReference") || "HV Rule 7.7"),
      recommendationFollowed: recommendationFollowed === "YES",
      differenceReason: String(form.get("differenceReason") || ""),
    });
  };

  const submitDirectReferral = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onDirectTribunalReferral(String(form.get("referralReason") || ""), String(form.get("authorityReference") || "HV Rule 7.1"));
  };

  return (
    <div className="space-y-5">
      {data.reviewPanels.length > 0 ? (
        <Alert>
          <Archive className="h-4 w-4" />
          <AlertTitle>Legacy independent review record</AlertTitle>
          <AlertDescription>
            This case contains {data.reviewPanels.length} review-panel record{data.reviewPanels.length === 1 ? "" : "s"} created under the earlier workflow. They remain read-only audit history and are not required for new Rule 7.7 decisions.
          </AlertDescription>
        </Alert>
      ) : null}

      <WorkflowSection
        title={directTribunal ? "Direct Tribunal referral" : "Hockey Ballarat Rule 7.7 decision"}
        description={directTribunal ? "A qualifying final-round or finals matter can move directly to the formal Tribunal under Rule 7.1." : "Non-conflicted Hockey Ballarat decision makers consider the signed investigation report and record the organisation's outcome."}
        kind="RULE"
        responsibleRole="Non-conflicted committee members"
        reviewRole={directTribunal ? "Formal Tribunal" : undefined}
      >
        <p className="mb-4 text-sm text-muted-foreground">
          Source: <a href={HV_RULES_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">HV Competition Rules {directTribunal ? "7.1" : "7.7"}, pp. 27–28 <ExternalLink className="h-3.5 w-3.5" /></a>.
        </p>
        {!canDecide ? <Alert><AlertTitle>Read-only</AlertTitle><AlertDescription>An assigned Case Coordinator or Decision Maker must record this step. Anyone with a conflict must not participate in the decision.</AlertDescription></Alert> : directTribunal ? (
          <form className="space-y-4" onSubmit={submitDirectReferral}>
            <div className="space-y-2"><Label htmlFor="referral-reason">Factual referral reason</Label><Textarea id="referral-reason" name="referralReason" minLength={10} required /></div>
            <div className="space-y-2"><Label htmlFor="direct-authority">Authority reference</Label><Input id="direct-authority" name="authorityReference" defaultValue="HV Rule 7.1" required /></div>
            <Button type="submit" disabled={busy}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Gavel className="mr-2 h-4 w-4" />} Refer to formal Tribunal</Button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={submitDecision}>
            <div className="space-y-2"><Label>Outcome</Label><Select name="outcome" required><SelectTrigger aria-label="Rule 7.7 outcome"><SelectValue placeholder="Select outcome" /></SelectTrigger><SelectContent><SelectItem value="NO_ACTION">No further action</SelectItem><SelectItem value="MISCONDUCT_PENALTY_GUIDANCE">Misconduct penalty guidance</SelectItem><SelectItem value="TRIBUNAL_REFERRAL">Refer to formal Tribunal</SelectItem><SelectItem value="MEDIATION_REFERRAL">Refer to mediation</SelectItem><SelectItem value="COMBINATION_REFERRAL">Combination of available outcomes</SelectItem><SelectItem value="OTHER_APPROPRIATE_COURSE">Another appropriate course</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="decision-reason">Reasons</Label><Textarea id="decision-reason" name="decisionReason" minLength={10} required /></div>
            <div className="space-y-2"><Label htmlFor="rule-reference">Rule source</Label><Input id="rule-reference" name="ruleReference" defaultValue="HV Rule 7.7" required /></div>
            <div className="space-y-2"><Label>Was the investigator's recommendation followed?</Label><Select value={recommendationFollowed} onValueChange={setRecommendationFollowed}><SelectTrigger aria-label="Recommendation followed"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="YES">Yes</SelectItem><SelectItem value="NO">No</SelectItem></SelectContent></Select></div>
            {recommendationFollowed === "NO" ? <div className="space-y-2"><Label htmlFor="difference-reason">Why the decision differs</Label><Textarea id="difference-reason" name="differenceReason" minLength={5} required /></div> : null}
            <Button type="submit" disabled={busy || !["REPORT_SIGNED", "HB_DECISION"].includes(data.incidentCase.status)}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Record Rule 7.7 decision</Button>
          </form>
        )}
      </WorkflowSection>
    </div>
  );
}
