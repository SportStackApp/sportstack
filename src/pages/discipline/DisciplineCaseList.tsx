import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  FilePlus2,
  ShieldAlert,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { loadDisciplineCases } from "@/features/discipline/api";
import { InformationBadge } from "@/features/discipline/DisciplineUi";
import {
  formatMelbourneDateTime,
  formatStatus,
} from "@/features/discipline/format";
import { useDisciplineAccess } from "@/features/discipline/useDisciplineAccess";

export default function DisciplineCaseList() {
  const { context } = useDisciplineAccess();
  const casesQuery = useQuery({
    queryKey: ["discipline-cases"],
    queryFn: loadDisciplineCases,
  });

  if (casesQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-foreground md:text-4xl">
            ASSIGNED CASES
          </h1>
          <p className="mt-1 text-muted-foreground">
            Only cases explicitly assigned to you are shown.
          </p>
        </div>
        {context?.can_create_cases ? (
          <Button asChild>
            <Link to="/discipline/new">
              <FilePlus2 className="mr-2 h-4 w-4" />
              New case
            </Link>
          </Button>
        ) : null}
      </div>

      <Alert>
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Private case access</AlertTitle>
        <AlertDescription>
          Association or committee status alone does not reveal case contents.
          Every case assignment is recorded.
        </AlertDescription>
      </Alert>

      {casesQuery.error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Cases could not be loaded</AlertTitle>
          <AlertDescription>{casesQuery.error.message}</AlertDescription>
        </Alert>
      ) : null}

      {casesQuery.data?.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No assigned cases</CardTitle>
            <CardDescription>
              Create a case or ask a Case Coordinator for access.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {casesQuery.data?.map((incidentCase) => (
            <Card key={incidentCase.id} className="flex flex-col">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge variant="secondary">{incidentCase.case_number}</Badge>
                  <InformationBadge kind="FACT" />
                </div>
                <CardTitle className="text-xl">{incidentCase.title}</CardTitle>
                <CardDescription>
                  {formatStatus(incidentCase.status)} ·{" "}
                  {formatStatus(incidentCase.pathway)}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">Match</dt>
                  <dd>
                    {incidentCase.first_named_team || "Not recorded"} v{" "}
                    {incidentCase.second_named_team || "Not recorded"}
                  </dd>
                  <dt className="text-muted-foreground">Competition</dt>
                  <dd>{incidentCase.competition || "Not recorded"}</dd>
                </dl>
                <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                  <div className="flex items-center gap-2 font-medium">
                    <CalendarClock className="h-4 w-4" />
                    Next required action
                  </div>
                  <p className="mt-1">
                    {incidentCase.nextDeadline?.label ??
                      "No open calculated deadline"}
                  </p>
                  {incidentCase.nextDeadline ? (
                    <p className="text-muted-foreground">
                      Due{" "}
                      {formatMelbourneDateTime(
                        incidentCase.nextDeadline.due_at,
                      )}
                    </p>
                  ) : null}
                </div>
                <Button variant="outline" asChild className="mt-auto w-full">
                  <Link to={`/discipline/cases/${incidentCase.id}`}>
                    Open case
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
