import { useId, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface AdminMultiSelectOption {
  value: string;
  label: string;
}

interface AdminMultiSelectFilterProps {
  label: string;
  options: AdminMultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  allLabel: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  disabledPlaceholder?: string;
}

export function AdminMultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  allLabel,
  searchPlaceholder = "Search options...",
  disabled = false,
  disabledPlaceholder = "Unavailable",
}: AdminMultiSelectFilterProps) {
  const triggerId = useId();
  const [open, setOpen] = useState(false);
  const selectedOptions = options.filter((option) => selected.includes(option.value));
  const summary = disabled
    ? disabledPlaceholder
    : selected.length === 0
      ? allLabel
      : selected.length === 1
        ? selectedOptions[0]?.label || "1 selected"
        : `${selected.length} selected`;

  const toggleOption = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter((selectedValue) => selectedValue !== value)
        : [...selected, value],
    );
  };

  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={triggerId}>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={triggerId}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full min-w-0 justify-between overflow-hidden px-3 font-normal"
          >
            <span className={cn("truncate", (disabled || selected.length === 0) && "text-muted-foreground")}>
              {summary}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[min(22rem,calc(100vw-2rem))] p-0"
        >
          <div className="flex items-center justify-between gap-2 border-b p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={options.length === 0 || selected.length === options.length}
              onClick={() => onChange(options.map((option) => option.value))}
            >
              Select all
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={selected.length === 0}
              onClick={() => onChange([])}
            >
              Clear
            </Button>
          </div>
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList className="max-h-72">
              <CommandEmpty>No options found.</CommandEmpty>
              <CommandGroup>
                {options.map((option) => {
                  const isSelected = selected.includes(option.value);
                  return (
                    <CommandItem
                      key={option.value}
                      value={`${option.label} ${option.value}`}
                      onSelect={() => toggleOption(option.value)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4 shrink-0",
                          isSelected ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="min-w-0 truncate">{option.label}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
