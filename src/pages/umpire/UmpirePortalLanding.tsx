import { Link } from "react-router-dom";
import { ChevronRight, ClipboardCheck, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import fieldBg from "@/assets/Field_1.png";

export default function UmpirePortalLanding() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12">
      <img src={fieldBg} alt="Hockey field" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-primary/75" />

      <Card className="relative z-10 w-full max-w-lg border-primary-foreground/20 bg-card/95 shadow-2xl backdrop-blur">
        <CardContent className="space-y-8 p-7 text-center sm:p-10">
          <div className="space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <Badge variant="secondary">Hockey Ballarat</Badge>
            <div>
              <h1 className="font-display text-4xl font-bold tracking-tight text-foreground">
                Umpire Portal
              </h1>
              <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground sm:text-base">
                Submit official post-match player votes for a completed fixture.
              </p>
            </div>
          </div>

          <div className="rounded-xl border bg-muted/30 p-4 text-left">
            <div className="flex items-start gap-3">
              <ClipboardCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="font-semibold text-foreground">No SportStack account required</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Enter your details, choose the match and submit the required votes.
                </p>
              </div>
            </div>
          </div>

          <Link to="/umpire/public-vote" className="block">
            <Button size="lg" className="w-full gap-2">
              Umpire Login
              <ChevronRight className="h-5 w-5" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
