import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type InformationKind =
  | "FACT"
  | "RULE"
  | "JUDGEMENT"
  | "LOCAL INTERPRETATION";

const KIND_STYLES: Record<InformationKind, string> = {
  FACT: "border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-200",
  RULE: "border-violet-500/30 bg-violet-500/10 text-violet-800 dark:text-violet-200",
  JUDGEMENT:
    "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200",
  "LOCAL INTERPRETATION":
    "border-rose-500/30 bg-rose-500/10 text-rose-900 dark:text-rose-200",
};

export function InformationBadge({ kind }: { kind: InformationKind }) {
  return (
    <Badge
      variant="outline"
      className={cn("whitespace-nowrap text-[10px]", KIND_STYLES[kind])}
    >
      {kind}
    </Badge>
  );
}

export function WorkflowSection({
  title,
  description,
  kind,
  responsibleRole,
  reviewRole,
  children,
}: {
  title: string;
  description?: string;
  kind: InformationKind;
  responsibleRole?: string;
  reviewRole?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-lg">{title}</CardTitle>
          <InformationBadge kind={kind} />
        </div>
        {description ? <CardDescription>{description}</CardDescription> : null}
        {responsibleRole ? (
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="rounded-full border px-2 py-1">
              Completed by: {responsibleRole}
            </span>
            {reviewRole ? (
              <span className="rounded-full border px-2 py-1">
                Reviewed by: {reviewRole}
              </span>
            ) : null}
          </div>
        ) : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
