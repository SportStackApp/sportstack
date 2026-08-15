import { Check, Info, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { DisciplineIntakeTagOption } from "./types";

type DisciplineTagPickerProps = {
  label: string;
  description: string;
  tags: DisciplineIntakeTagOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
};

export function DisciplineTagPicker({
  label,
  description,
  tags,
  selectedIds,
  onChange,
}: DisciplineTagPickerProps) {
  const toggle = (tagId: string) => {
    onChange(
      selectedIds.includes(tagId)
        ? selectedIds.filter((id) => id !== tagId)
        : [...selectedIds, tagId],
    );
  };

  return (
    <fieldset className="space-y-3">
      <legend className="flex items-center gap-2 text-sm font-medium">
        <Tags className="h-4 w-4" />
        {label}
      </legend>
      <p className="text-xs text-muted-foreground">{description}</p>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {tags.map((tag) => {
          const selected = selectedIds.includes(tag.id);
          return (
            <div
              key={tag.id}
              className={cn(
                "flex min-h-10 items-center rounded-md border",
                selected && "border-primary bg-primary/10",
              )}
            >
              <Button
                type="button"
                variant="ghost"
                aria-pressed={selected}
                onClick={() => toggle(tag.id)}
                className="h-auto min-h-10 min-w-0 flex-1 justify-start whitespace-normal px-3 py-2 text-left hover:bg-transparent"
              >
                <span
                  className={cn(
                    "mr-2 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                    selected && "border-primary bg-primary text-primary-foreground",
                  )}
                >
                  {selected ? <Check className="h-3 w-3" /> : null}
                </span>
                <span className="text-sm font-medium">{tag.label}</span>
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Information about ${tag.label}`}>
                    <Info className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{tag.label}</DialogTitle>
                    <DialogDescription>{tag.description}</DialogDescription>
                  </DialogHeader>
                  <p className="text-sm text-muted-foreground">
                    This is a neutral descriptor used for searching and triage. Selecting it does not prove the allegation.
                  </p>
                </DialogContent>
              </Dialog>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
