import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { type SortState } from "@/lib/adminSorting";
import { cn } from "@/lib/utils";

interface SortableTableHeadProps<Key extends string> {
  label: string;
  sortKey: Key;
  sort: SortState<Key> | null;
  onSort: (key: Key) => void;
  className?: string;
}

export function SortableTableHead<Key extends string>({ label, sortKey, sort, onSort, className }: SortableTableHeadProps<Key>) {
  const active = sort?.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead className={className} aria-sort={!active ? "none" : sort.direction === "asc" ? "ascending" : "descending"}>
      <button type="button" onClick={() => onSort(sortKey)} className={cn("flex w-full items-center gap-1.5 text-left hover:text-foreground", active && "text-foreground")}>
        <span>{label}</span><Icon className="h-3.5 w-3.5 shrink-0" />
      </button>
    </TableHead>
  );
}
