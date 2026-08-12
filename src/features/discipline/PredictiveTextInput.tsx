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
  helperText = "Choose a suggestion or type a different value.",
}: PredictiveTextInputProps<T>) {
  const generatedId = useId().replaceAll(":", "");
  const listId = `${id}-${generatedId}-options`;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        list={listId}
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
        {options.map((option) => (
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
