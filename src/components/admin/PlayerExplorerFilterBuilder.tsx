import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PLAYER_EXPLORER_FIELD_DEFINITIONS,
  PLAYER_EXPLORER_FIELDS,
  createPlayerExplorerCondition,
  createPlayerExplorerGroup,
  createPlayerExplorerSequence,
  type PlayerExplorerFilterCondition,
  type PlayerExplorerEntityField,
  type PlayerExplorerFilterExpression,
  type PlayerExplorerFilterField,
  type PlayerExplorerFilterGroup,
  type PlayerExplorerFilterLogic,
  type PlayerExplorerFilterOperator,
  type PlayerExplorerFilterOptions,
  type PlayerExplorerSequenceRule,
} from "@/lib/playerExplorer";

interface PlayerExplorerFilterBuilderProps {
  expression: PlayerExplorerFilterExpression;
  options: PlayerExplorerFilterOptions;
  disabled?: boolean;
  onChange: (expression: PlayerExplorerFilterExpression) => void;
}

const CATEGORIES = ["Scope", "Match", "Player totals"] as const;
const NO_OPTIONS_VALUE = "__no_options__";

const operatorOptions = (
  field: PlayerExplorerFilterField,
): { value: PlayerExplorerFilterOperator; label: string }[] => {
  const definition = PLAYER_EXPLORER_FIELD_DEFINITIONS[field];
  if (definition.valueType === "entity") return [{ value: "eq", label: "is" }];
  if (definition.valueType === "date") {
    return [
      { value: "eq", label: "is on" },
      { value: "gt", label: "is after" },
      { value: "gte", label: "is on or after" },
      { value: "lt", label: "is before" },
      { value: "lte", label: "is on or before" },
      { value: "between", label: "is between" },
    ];
  }
  return [
    { value: "eq", label: "equals" },
    { value: "gt", label: "is more than" },
    { value: "gte", label: "is at least" },
    { value: "lt", label: "is less than" },
    { value: "lte", label: "is at most" },
    { value: "between", label: "is between" },
  ];
};

const defaultOperator = (field: PlayerExplorerFilterField): PlayerExplorerFilterOperator =>
  PLAYER_EXPLORER_FIELD_DEFINITIONS[field].valueType === "entity" ? "eq" : "gt";

const updateGroup = (
  expression: PlayerExplorerFilterExpression,
  groupId: string,
  update: (group: PlayerExplorerFilterGroup) => PlayerExplorerFilterGroup,
): PlayerExplorerFilterExpression => ({
  ...expression,
  groups: expression.groups.map((group) => group.id === groupId ? update(group) : group),
});

const updateCondition = (
  expression: PlayerExplorerFilterExpression,
  groupId: string,
  conditionId: string,
  update: Partial<Omit<PlayerExplorerFilterCondition, "id">>,
) => updateGroup(expression, groupId, (group) => ({
  ...group,
  conditions: group.conditions.map((condition) =>
    condition.id === conditionId ? { ...condition, ...update } : condition,
  ),
}));

const updateSequence = (
  expression: PlayerExplorerFilterExpression,
  sequenceId: string,
  update: Partial<Omit<PlayerExplorerSequenceRule, "id">>,
): PlayerExplorerFilterExpression => ({
  ...expression,
  sequences: expression.sequences.map((sequence) =>
    sequence.id === sequenceId ? { ...sequence, ...update } : sequence,
  ),
});

export function PlayerExplorerFilterBuilder({
  expression,
  options,
  disabled = false,
  onChange,
}: PlayerExplorerFilterBuilderProps) {
  const conditionCount = expression.groups.reduce(
    (total, group) => total + group.conditions.length,
    0,
  );

  const setExpressionLogic = (logic: PlayerExplorerFilterLogic) => onChange({
    ...expression,
    logic,
  });

  const addGroup = () => onChange({
    ...expression,
    groups: [...expression.groups, createPlayerExplorerGroup()],
  });

  const removeGroup = (groupId: string) => onChange({
    ...expression,
    groups: expression.groups.filter((group) => group.id !== groupId),
  });

  const addCondition = (groupId: string) => onChange(updateGroup(expression, groupId, (group) => ({
    ...group,
    conditions: [...group.conditions, createPlayerExplorerCondition()],
  })));

  const removeCondition = (groupId: string, conditionId: string) => onChange(
    updateGroup(expression, groupId, (group) => ({
      ...group,
      conditions: group.conditions.filter((condition) => condition.id !== conditionId),
    })),
  );

  const addSequence = () => onChange({
    ...expression,
    sequences: [...expression.sequences, createPlayerExplorerSequence()],
  });

  const removeSequence = (sequenceId: string) => onChange({
    ...expression,
    sequences: expression.sequences.filter((sequence) => sequence.id !== sequenceId),
  });

  return (
    <div className="overflow-hidden rounded-md border">
      <div className="flex flex-col gap-3 bg-foreground px-4 py-3 text-background sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium">Filters ({conditionCount})</p>
          <p className="text-xs opacity-75">Build rules using fields, operators and values.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">Match</span>
          <Select value={expression.logic} onValueChange={(value) => setExpressionLogic(value as PlayerExplorerFilterLogic)} disabled={disabled}>
            <SelectTrigger className="h-8 w-40 border-background/30 bg-background text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="and">All groups</SelectItem>
              <SelectItem value="or">Any group</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-4 bg-card p-3 sm:p-4">
        {expression.groups.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            No groups yet. Add a group to start filtering.
          </div>
        ) : expression.groups.map((group, groupIndex) => (
          <div key={group.id} className="rounded-md border bg-background">
            <div className="flex flex-col gap-2 border-b bg-muted/50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Group {groupIndex + 1}</span>
                <Select
                  value={group.logic}
                  onValueChange={(value) => onChange(updateGroup(expression, group.id, (current) => ({
                    ...current,
                    logic: value as PlayerExplorerFilterLogic,
                  })))}
                  disabled={disabled}
                >
                  <SelectTrigger className="h-8 w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="and">All conditions</SelectItem>
                    <SelectItem value="or">Any condition</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => addCondition(group.id)} disabled={disabled}>
                  <Plus className="mr-1 h-4 w-4" />Condition
                </Button>
                {expression.groups.length > 1 ? (
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeGroup(group.id)} disabled={disabled} aria-label={`Remove group ${groupIndex + 1}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="space-y-2 p-3">
              {group.conditions.length === 0 ? (
                <button
                  type="button"
                  className="w-full rounded-md border border-dashed p-4 text-left text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => addCondition(group.id)}
                  disabled={disabled}
                >
                  Select Add condition to choose a filter.
                </button>
              ) : group.conditions.map((condition, conditionIndex) => {
                const definition = PLAYER_EXPLORER_FIELD_DEFINITIONS[condition.field];
                const fieldOptions = definition.valueType === "entity"
                  ? options[condition.field as PlayerExplorerEntityField] || []
                  : [];
                const isBetween = condition.operator === "between";

                return (
                  <div key={condition.id} className="grid gap-2 rounded-md border p-2 lg:grid-cols-[minmax(180px,1.25fr)_minmax(150px,0.9fr)_minmax(160px,1.5fr)_auto] lg:items-center">
                    <Select
                      value={condition.field}
                      onValueChange={(value) => {
                        const field = value as PlayerExplorerFilterField;
                        onChange(updateCondition(expression, group.id, condition.id, {
                          field,
                          operator: defaultOperator(field),
                          value: "",
                          toValue: "",
                        }));
                      }}
                      disabled={disabled}
                    >
                      <SelectTrigger className="w-full min-w-0 overflow-hidden" aria-label={`Group ${groupIndex + 1} condition ${conditionIndex + 1} field`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((category) => (
                          <SelectGroup key={category}>
                            <SelectLabel>{category}</SelectLabel>
                            {PLAYER_EXPLORER_FIELDS.filter((field) =>
                              PLAYER_EXPLORER_FIELD_DEFINITIONS[field].category === category,
                            ).map((field) => (
                              <SelectItem key={field} value={field}>{PLAYER_EXPLORER_FIELD_DEFINITIONS[field].label}</SelectItem>
                            ))}
                          </SelectGroup>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={condition.operator}
                      onValueChange={(value) => onChange(updateCondition(expression, group.id, condition.id, {
                        operator: value as PlayerExplorerFilterOperator,
                        toValue: value === "between" ? condition.toValue : "",
                      }))}
                      disabled={disabled}
                    >
                      <SelectTrigger className="w-full min-w-0 overflow-hidden" aria-label={`${definition.label} operator`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {operatorOptions(condition.field).map((operator) => (
                          <SelectItem key={operator.value} value={operator.value}>{operator.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {definition.valueType === "entity" ? (
                      <Select
                        value={condition.value}
                        onValueChange={(value) => onChange(updateCondition(expression, group.id, condition.id, { value }))}
                        disabled={disabled || fieldOptions.length === 0}
                      >
                        <SelectTrigger className="w-full min-w-0 overflow-hidden" aria-label={`${definition.label} value`}>
                          <SelectValue placeholder={fieldOptions.length === 0 ? "No options available" : `Select ${definition.label.toLocaleLowerCase("en-AU")}`} />
                        </SelectTrigger>
                        <SelectContent>
                          {fieldOptions.length === 0 ? (
                            <SelectItem value={NO_OPTIONS_VALUE} disabled>No options available</SelectItem>
                          ) : fieldOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className={isBetween ? "grid grid-cols-[1fr_auto_1fr] items-center gap-2" : undefined}>
                        <Input
                          type={definition.valueType === "date" ? "date" : "number"}
                          min={definition.valueType === "number" ? "0" : undefined}
                          step={definition.valueType === "number" ? "1" : undefined}
                          value={condition.value}
                          onChange={(event) => onChange(updateCondition(expression, group.id, condition.id, { value: event.target.value }))}
                          placeholder={isBetween ? "From" : "Value"}
                          aria-label={`${definition.label} ${isBetween ? "from" : "value"}`}
                          disabled={disabled}
                        />
                        {isBetween ? (
                          <>
                            <span className="text-xs text-muted-foreground">to</span>
                            <Input
                              type={definition.valueType === "date" ? "date" : "number"}
                              min={definition.valueType === "number" ? "0" : undefined}
                              step={definition.valueType === "number" ? "1" : undefined}
                              value={condition.toValue}
                              onChange={(event) => onChange(updateCondition(expression, group.id, condition.id, { toValue: event.target.value }))}
                              placeholder="To"
                              aria-label={`${definition.label} to`}
                              disabled={disabled}
                            />
                          </>
                        ) : null}
                      </div>
                    )}

                    <Button type="button" variant="ghost" size="icon" onClick={() => removeCondition(group.id, condition.id)} disabled={disabled} aria-label={`Remove ${definition.label} condition`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <Button type="button" variant="outline" size="sm" onClick={addGroup} disabled={disabled}>
          <Plus className="mr-1 h-4 w-4" />Add group
        </Button>

        <div className="space-y-3 rounded-md border border-dashed p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Sequence rules ({expression.sequences.length})</p>
              <p className="text-xs text-muted-foreground">
                Reach a game count in one division, then play in another division afterwards.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addSequence} disabled={disabled}>
              <Plus className="mr-1 h-4 w-4" />Add sequence
            </Button>
          </div>

          {expression.sequences.map((sequence, sequenceIndex) => {
            const divisionOptions = options.division || [];
            return (
              <div key={sequence.id} className="grid gap-3 rounded-md border bg-background p-3 xl:grid-cols-[auto_minmax(180px,1fr)_130px_auto_minmax(180px,1fr)_130px_auto] xl:items-end">
                <span className="pb-2 text-sm font-medium">{sequenceIndex + 1}.</span>
                <div className="space-y-1">
                  <label className="text-xs font-medium">First division</label>
                  <Select
                    value={sequence.firstDivisionId}
                    onValueChange={(value) => onChange(updateSequence(expression, sequence.id, { firstDivisionId: value }))}
                    disabled={disabled || divisionOptions.length === 0}
                  >
                    <SelectTrigger className="w-full min-w-0 overflow-hidden" aria-label={`Sequence ${sequenceIndex + 1} first division`}>
                      <SelectValue placeholder="Select division" />
                    </SelectTrigger>
                    <SelectContent>
                      {divisionOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">At least games</label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={sequence.firstMinimumGames}
                    onChange={(event) => onChange(updateSequence(expression, sequence.id, { firstMinimumGames: event.target.value }))}
                    disabled={disabled}
                    aria-label={`Sequence ${sequenceIndex + 1} first division minimum games`}
                  />
                </div>
                <span className="pb-2 text-center text-sm font-medium text-muted-foreground">then</span>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Next division</label>
                  <Select
                    value={sequence.nextDivisionId}
                    onValueChange={(value) => onChange(updateSequence(expression, sequence.id, { nextDivisionId: value }))}
                    disabled={disabled || divisionOptions.length === 0}
                  >
                    <SelectTrigger className="w-full min-w-0 overflow-hidden" aria-label={`Sequence ${sequenceIndex + 1} next division`}>
                      <SelectValue placeholder="Select division" />
                    </SelectTrigger>
                    <SelectContent>
                      {divisionOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">At least games</label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={sequence.nextMinimumGames}
                    onChange={(event) => onChange(updateSequence(expression, sequence.id, { nextMinimumGames: event.target.value }))}
                    disabled={disabled}
                    aria-label={`Sequence ${sequenceIndex + 1} next division minimum games`}
                  />
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => removeSequence(sequence.id)} disabled={disabled} aria-label={`Remove sequence ${sequenceIndex + 1}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
