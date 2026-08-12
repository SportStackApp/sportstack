import { Check, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
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
            <Button
              key={tag.id}
              type="button"
              variant="outline"
              aria-pressed={selected}
              onClick={() => toggle(tag.id)}
              className={cn(
                "h-auto min-h-16 items-start justify-start whitespace-normal px-3 py-2 text-left",
                selected &&
                  "border-primary bg-primary/10 text-foreground hover:bg-primary/15",
              )}
            >
              <span className="flex w-full gap-2">
                <span
                  className={cn(
                    "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                    selected && "border-primary bg-primary text-primary-foreground",
                  )}
                >
                  {selected ? <Check className="h-3 w-3" /> : null}
                </span>
                <span>
                  <span className="block text-sm font-medium">{tag.label}</span>
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                    {tag.description}
                  </span>
                </span>
              </span>
            </Button>
          );
        })}
      </div>
    </fieldset>
  );
}
