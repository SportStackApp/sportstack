import type { ReactNode } from "react";
import { Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export interface GuidedWorkflowStep {
  id: string;
  title: string;
  description: string;
}

interface GuidedWorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  steps: GuidedWorkflowStep[];
  currentStep: number;
  onStepChange: (step: number) => void;
  canContinue: boolean;
  saving: boolean;
  onFinish: () => void;
  onSkip?: () => void;
  skipLabel?: string;
  finishLabel?: string;
  children: ReactNode;
}

export function GuidedWorkflowDialog({
  open,
  onOpenChange,
  title,
  steps,
  currentStep,
  onStepChange,
  canContinue,
  saving,
  onFinish,
  onSkip,
  skipLabel = "Skip for now",
  finishLabel = "Create committee",
  children,
}: GuidedWorkflowDialogProps) {
  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[92vh] w-[calc(100vw-1rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:w-full"
        onInteractOutside={(event) => saving && event.preventDefault()}
        onEscapeKeyDown={(event) => saving && event.preventDefault()}
      >
        <DialogHeader className="border-b bg-muted/20 px-5 py-4 text-left sm:px-7">
          <div className="flex items-start justify-between gap-4 pr-7">
            <div>
              <DialogTitle className="text-xl">{title}</DialogTitle>
              <DialogDescription className="mt-1">Step {currentStep + 1} of {steps.length}: {step.title}</DialogDescription>
            </div>
          </div>
          <Progress value={progress} className="mt-3 h-2" aria-label={`${Math.round(progress)}% complete`} />
          <ol className="mt-3 hidden grid-cols-5 gap-2 md:grid">
            {steps.map((item, index) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                    index === currentStep && "bg-primary/10 font-medium text-primary",
                    index < currentStep && "text-foreground",
                    index > currentStep && "text-muted-foreground",
                  )}
                  onClick={() => index < currentStep && onStepChange(index)}
                  disabled={index > currentStep || saving}
                >
                  <span className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px]",
                    index <= currentStep && "border-primary bg-primary text-primary-foreground",
                  )}>
                    {index < currentStep ? <Check className="h-3 w-3" /> : index + 1}
                  </span>
                  <span className="truncate">{item.title}</span>
                </button>
              </li>
            ))}
          </ol>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          <div className="mx-auto max-w-3xl">
            <div className="mb-5">
              <h2 className="text-2xl font-semibold tracking-tight">{step.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
            </div>
            {children}
          </div>
        </div>

        <DialogFooter className="flex-row flex-wrap items-center justify-between gap-3 border-t bg-background px-5 py-4 sm:px-7">
          <div>
            {currentStep > 0 && (
              <Button type="button" variant="outline" onClick={() => onStepChange(currentStep - 1)} disabled={saving}>
                <ChevronLeft className="mr-2 h-4 w-4" />Back
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {onSkip && <Button type="button" variant="ghost" onClick={onSkip} disabled={saving}>{skipLabel}</Button>}
            {isLastStep ? (
              <Button type="button" onClick={onFinish} disabled={!canContinue || saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {finishLabel}
              </Button>
            ) : (
              <Button type="button" onClick={() => onStepChange(currentStep + 1)} disabled={!canContinue || saving}>
                Continue<ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
