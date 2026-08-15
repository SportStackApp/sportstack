import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type PredictiveOption = {
  id: string;
  label: string;
  description?: string | null;
};

type PredictiveTextInputProps<T extends PredictiveOption> = {
  id: string;
  name?: string;
  label: string;
  value: string;
  options: T[];
  onChange: (value: string, matchedOption: T | null) => void;
  placeholder?: string;
  required?: boolean;
  helperText?: string;
  minimumCharacters?: number;
};

export function PredictiveTextInput<T extends PredictiveOption>({
  id,
  name,
  label,
  value,
  options,
  onChange,
  placeholder,
  required,
  helperText = "Type at least three characters for suggestions, or keep your free-text entry.",
  minimumCharacters = 3,
}: PredictiveTextInputProps<T>) {
  const generatedId = useId().replaceAll(":", "");
  const listId = `${id}-${generatedId}-options`;
  const query = value.trim().toLocaleLowerCase();
  const visibleOptions =
    query.length >= minimumCharacters
      ? options.filter((option) =>
          `${option.label} ${option.description ?? ""}`
            .toLocaleLowerCase()
            .includes(query),
        )
      : [];

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        list={visibleOptions.length > 0 ? listId : undefined}
        value={value}
        onChange={(event) => {
          const nextValue = event.target.value;
          const normalised = nextValue.trim().toLocaleLowerCase();
          const match =
            options.find(
              (option) =>
                option.label.trim().toLocaleLowerCase() === normalised,
            ) ?? null;
          onChange(nextValue, match);
        }}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
      />
      <datalist id={listId}>
        {visibleOptions.map((option) => (
          <option
            key={option.id}
            value={option.label}
            label={option.description ?? undefined}
          />
        ))}
      </datalist>
      {helperText ? (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      ) : null}
    </div>
  );
}
