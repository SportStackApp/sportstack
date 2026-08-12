import { BookOpen, ExternalLink, HelpCircle, Scale, ShieldAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
  HV_RULES_URL,
  HV_SCHEDULES_URL,
  TRIBUNAL_READINESS_CONTENT,
} from "./disciplineIntakeContent";

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

export function TribunalReadinessLegend() {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {Object.entries(TRIBUNAL_READINESS_CONTENT).map(([key, item]) => (
        <div key={key} className={`rounded-lg border p-3 ${item.className}`}>
          <Badge variant="outline" className="mb-2 bg-background/70">
            {key}
          </Badge>
          <p className="text-sm font-semibold">{item.title}</p>
          <p className="mt-1 text-xs opacity-90">{item.description}</p>
        </div>
      ))}
    </div>
  );
}

export function ScreeningGuidance() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <HelpCircle className="mr-2 h-4 w-4" />
          How screening and Tribunal readiness work
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Preliminary classification in plain language</DialogTitle>
          <DialogDescription>
            This screen compares each allegation with the 2026 Hockey Victoria
            Misconduct Penalty System. It helps plan the process; it does not
            decide whether the allegation happened.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <section className="rounded-lg border p-4">
            <h3 className="font-semibold">How to complete this screen</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>Review one allegation and its reported-fact descriptors.</li>
              <li>Assume only for this comparison that it is proven exactly as currently written.</li>
              <li>Select the closest exact Schedule wording and who the conduct was directed towards.</li>
              <li>Record the preliminary result. A later investigation recommendation is kept separately.</li>
            </ol>
          </section>

          <TribunalReadinessLegend />

          <Alert>
            <Scale className="h-4 w-4" />
            <AlertTitle>Direct-Tribunal rows checked from the Schedule</AlertTitle>
            <AlertDescription>
              The table marks Language Level 3, Violent Conduct Level 3,
              Vilification and the listed unfair public personal attack for
              immediate Tribunal referral. A later clarification sentence names
              Level 3 offences and Vilification but does not mention the public
              statement row, so that row remains Red with a visible source warning.
            </AlertDescription>
          </Alert>

          <Alert>
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Penalty information is guidance only</AlertTitle>
            <AlertDescription>
              The displayed suspension or other outcome comes from Schedule 1
              clause 4.2. It is not automatically imposed. Previous guilty
              charges and the Rule 7 human decision factors are considered later.
              Hockey Ballarat's separate no-fine approach for clubs also remains
              a local treatment requiring human review.
            </AlertDescription>
          </Alert>

          <section className="rounded-lg border p-4">
            <h3 className="flex items-center gap-2 font-semibold">
              <BookOpen className="h-4 w-4" /> Official source documents
            </h3>
            <ul className="mt-2 space-y-2 text-muted-foreground">
              <li>
                <SourceLink href={HV_SCHEDULES_URL}>Hockey Victoria Competition Schedules 2026</SourceLink>
                {" "}- Schedule 1 clause 4.2 is on pages 19-21; the report classification guide is in Appendix A on page 39.
              </li>
              <li>
                <SourceLink href={HV_RULES_URL}>Hockey Victoria Competition Rules 2026</SourceLink>
                {" "}- Rule 7 explains the investigation and human decision pathway.
              </li>
            </ul>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
