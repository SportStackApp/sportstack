import { useId, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Search, UserRoundX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { UmpireLinkedPlayerOption } from "@/lib/umpireLinkedPlayers";

interface UmpireLinkedPlayerPickerProps {
  value: string;
  profileId: string | null;
  selectedOptionId?: string | null;
  options: UmpireLinkedPlayerOption[];
  loading?: boolean;
  disabled?: boolean;
  simplifiedSuggestions?: boolean;
  placeholder?: string;
  onNameChange: (value: string) => void;
  onSelect: (option: UmpireLinkedPlayerOption) => void;
}

const normaliseSearch = (value: string) => value.trim().toLocaleLowerCase("en-AU");

export function UmpireLinkedPlayerPicker({
  value,
  profileId,
  selectedOptionId = null,
  options,
  loading = false,
  disabled = false,
  simplifiedSuggestions = false,
  placeholder,
  onNameChange,
  onSelect,
}: UmpireLinkedPlayerPickerProps) {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const listId = useId();
  const minimumSearchLength = simplifiedSuggestions ? 1 : 2;
  const inputPlaceholder = placeholder || (
    simplifiedSuggestions ? "Start typing a name" : "Type at least two letters"
  );

  const matches = useMemo(() => {
    if (showAll) return options;

    const search = normaliseSearch(value);
    if (search.length < minimumSearchLength) return [];

    if (simplifiedSuggestions) {
      return options.filter((option) => normaliseSearch(option.name).includes(search));
    }

    return options.filter((option) =>
      [
        option.name,
        option.number,
        option.teamLabel,
        option.contextLabel,
      ]
        .join(" ")
        .toLocaleLowerCase("en-AU")
        .includes(search),
    );
  }, [minimumSearchLength, options, showAll, simplifiedSuggestions, value]);

  const selectedOption = useMemo(
    () =>
      options.find((option) =>
        selectedOptionId
          ? option.optionId === selectedOptionId
          : profileId
          ? option.profileId === profileId
          : false,
      ),
    [options, profileId, selectedOptionId],
  );

  const handleBlur = () => {
    window.setTimeout(() => setOpen(false), 150);
  };

  return (
    <div className="relative min-w-0">
      <div className="flex min-w-0 gap-2">
        <Input
          value={value}
          disabled={disabled}
          placeholder={inputPlaceholder}
          autoComplete="off"
          aria-label="Linked player name"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
          onFocus={() => {
            if (value.trim().length >= minimumSearchLength) setOpen(true);
          }}
          onBlur={handleBlur}
          onChange={(event) => {
            const nextValue = event.target.value;
            setShowAll(false);
            setOpen(nextValue.trim().length >= minimumSearchLength);
            onNameChange(nextValue);
          }}
        />
        {!simplifiedSuggestions && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-10 w-10 shrink-0"
            disabled={disabled}
            aria-label="Search all linked players"
            title="Search all linked players"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setShowAll(true);
              setOpen(true);
            }}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        )}
      </div>

      {simplifiedSuggestions ? (
        value.trim() && !selectedOption?.profileId ? (
          <div className="mt-1.5 flex min-w-0 items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
            <UserRoundX className="h-3.5 w-3.5 shrink-0" />
            <span>Needs admin review.</span>
          </div>
        ) : null
      ) : selectedOption?.profileId ? (
        <div className="mt-1.5 flex min-w-0 items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            Linked to {selectedOption?.name || value}
            {selectedOption?.number ? ` #${selectedOption.number}` : ""}
          </span>
        </div>
      ) : selectedOption?.source === "unresolved" ? (
        <div className="mt-1.5 flex min-w-0 items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
          <UserRoundX className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Pending umpire entry; an admin will verify this spelling.</span>
        </div>
      ) : value.trim() ? (
        <div className="mt-1.5 flex min-w-0 items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
          <UserRoundX className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Unlisted player; an admin must link this line before approval.</span>
        </div>
      ) : null}

      {open && !disabled && (
        <div
          id={listId}
          role="listbox"
          className={`absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md ${
            simplifiedSuggestions ? "" : "min-w-[20rem]"
          }`}
        >
          {loading ? (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading linked players...
            </div>
          ) : matches.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              {simplifiedSuggestions
                ? "No matching player."
                : showAll || value.trim().length >= minimumSearchLength
                ? "No linked player was found."
                : "Type at least two letters to search."}
            </p>
          ) : (
            matches.map((option) => (
              <button
                key={option.optionId}
                type="button"
                role="option"
                aria-selected={
                  selectedOptionId
                    ? option.optionId === selectedOptionId
                    : Boolean(profileId && option.profileId === profileId)
                }
                className="flex w-full min-w-0 items-start gap-2 rounded-sm px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onSelect(option);
                  setOpen(false);
                  setShowAll(false);
                }}
              >
                {simplifiedSuggestions ? (
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {option.name}{option.number ? ` #${option.number}` : ""}
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-sm font-medium">{option.name}</span>
                        {option.number && (
                          <span className="shrink-0 text-xs text-muted-foreground">#{option.number}</span>
                        )}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {option.teamLabel} - {option.contextLabel || "Linked club profile"}
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {option.source === "roster"
                        ? "Roster"
                        : option.source === "club"
                        ? "Club"
                        : option.source === "unresolved"
                        ? "Pending"
                        : "SportStack"}
                    </Badge>
                  </>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
