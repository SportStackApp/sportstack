import { BookOpen, ExternalLink, HelpCircle, ShieldAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  HA_DISCIPLINE_POLICY_URL,
  HV_INCIDENT_FORM_URL,
  HV_RULES_URL,
  JURISDICTION_HELP,
  SIA_INVESTIGATION_GUIDE_URL,
} from "./disciplineIntakeContent";

export function JurisdictionPathwayDetails({ pathway }: { pathway: string }) {
  const item = JURISDICTION_HELP[pathway];
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <BookOpen className="mr-2 h-4 w-4" /> See pathway details
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item.title}</DialogTitle>
          <DialogDescription>{item.summary}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <section><h3 className="font-semibold">When it may apply</h3><p className="text-muted-foreground">{item.whenItMayApply}</p></section>
          <section><h3 className="font-semibold">Required next steps</h3><p className="text-muted-foreground">{item.nextSteps}</p></section>
          <section className="rounded-lg border p-3">
            <h3 className="font-semibold">Source</h3>
            <p>{item.citation}, {item.page}</p>
            <SourceLink href={item.url}>Open the official document</SourceLink>
          </section>
          {item.adoptionWarning ? <Alert><ShieldAlert className="h-4 w-4" /><AlertTitle>Authority confirmation required</AlertTitle><AlertDescription>{item.adoptionWarning}</AlertDescription></Alert> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ConflictGuidance() {
  return (
    <Dialog>
      <DialogTrigger asChild><Button type="button" variant="outline" size="sm"><HelpCircle className="mr-2 h-4 w-4" /> Conflict of interest guidance</Button></DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Actual, potential and perceived conflicts</DialogTitle><DialogDescription>A conflict can exist even when a person believes they can remain fair.</DialogDescription></DialogHeader>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p><strong className="text-foreground">Actual:</strong> a current interest or relationship affects independence.</p>
          <p><strong className="text-foreground">Potential:</strong> an interest could affect independence as the matter develops.</p>
          <p><strong className="text-foreground">Perceived:</strong> a reasonable observer could think independence is affected.</p>
          <p>Investigators should disclose and document conflicts and the management decision. Tribunal members must also meet the exclusions in HV Rule 7.17.</p>
          <p><SourceLink href={SIA_INVESTIGATION_GUIDE_URL}>Sport Integrity Australia investigation guide</SourceLink> — sections 3.3–3.4. <SourceLink href={HV_RULES_URL}>HV Competition Rules</SourceLink> — Rule 7.17, p. 30.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SourceLink({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
    >
      {children}
      <ExternalLink className="h-3.5 w-3.5" />
    </a>
  );
}

export function JurisdictionGuidance() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <HelpCircle className="mr-2 h-4 w-4" />
          Find out which pathway may apply
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Jurisdiction pathways in plain language</DialogTitle>
          <DialogDescription>
            Jurisdiction means deciding which rules or external process should
            manage the reported matter. It is a human triage decision, not a
            finding that misconduct occurred.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <section className="rounded-lg border p-4">
            <h3 className="font-semibold">What is the Rule 7 workflow?</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>Receive a complete written report or other credible match-related information.</li>
              <li>Check jurisdiction, safety, report requirements and the applicable timing path.</li>
              <li>Appoint an appropriately experienced, conflict-free investigator if the matter proceeds.</li>
              <li>Particularise each allegation, collect evidence and give the person a fair opportunity to respond.</li>
              <li>HB selects an available Rule 7.7 outcome: no action, penalty guidance, Tribunal, mediation, a combination or another appropriate course.</li>
            </ol>
            <p className="mt-3 text-muted-foreground">
              The official incident form says club-originated reports go through
              the Club President or Secretary, while umpire reports go to the HV
              umpire coach first. The written report deadline is generally 1 pm
              on the second business day; qualifying last-round/finals matters
              use a separate direct-Tribunal timing path.
            </p>
          </section>

          <section className="grid gap-3 md:grid-cols-2">
            {Object.values(JURISDICTION_HELP).map((item) => (
              <div key={item.title} className="rounded-lg border p-4">
                <h3 className="font-semibold">{item.title}</h3>
                <p className="mt-1 text-muted-foreground">{item.summary}</p>
              </div>
            ))}
          </section>

          <Alert>
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Urgent safety action comes first</AlertTitle>
            <AlertDescription>
              If a child is at immediate risk, the national policy says the
              matter must be reported to law enforcement or child protection as
              soon as possible. An external referral may require the internal
              process to be suspended, but ticking “immediate safety risk” does
              not automatically close the internal record.
            </AlertDescription>
          </Alert>

          <section className="rounded-lg border p-4">
            <h3 className="flex items-center gap-2 font-semibold">
              <BookOpen className="h-4 w-4" /> Official source documents
            </h3>
            <ul className="mt-2 space-y-2 text-muted-foreground">
              <li><SourceLink href={HV_RULES_URL}>Hockey Victoria Competition Rules 2026</SourceLink> — Rule 7 is on pages 27–31.</li>
              <li><SourceLink href={HV_INCIDENT_FORM_URL}>Hockey Victoria Incident Report Form</SourceLink> — prescribed report fields and routing notes.</li>
              <li><SourceLink href={HA_DISCIPLINE_POLICY_URL}>Hockey Australia Complaints, Disputes and Discipline Policy</SourceLink> — jurisdiction and safety triage. The linked document's review date was July 2025, so current HB adoption/contact is still marked for confirmation.</li>
            </ul>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
