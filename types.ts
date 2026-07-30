export type Cell = string | number | null;
export type ColumnType = 'text' | 'number' | 'long-text' | 'url' | 'select';

export interface ColumnDef {
  key: string;
  label: string;
  type: ColumnType;
  sortable?: boolean;
  filterable?: boolean;
}

export interface Row {
  id: string;
  [field: string]: Cell;
}

export interface SortState {
  key: string;
  dir: 'asc' | 'desc';
}

export interface FilterState {
  key: string;
  value: string;
}

export interface MindSheetProps {
  columns: ColumnDef[];
  records: Row[];
  /* Unfiltered total, for the "показано X из N" counter. Falls back to
     records.length when not provided. */
  total?: number;
  sort?: SortState;
  filter?: FilterState;
  filterOptions?: Record<string, string[]>;
  search?: string;
  onSortChange: (key: string) => void;
  onFilterChange: (filter: FilterState | undefined) => void;
  onSearchChange?: (query: string) => void;
  /* When provided, each row becomes clickable and opens on its own page/view.
     The host decides what that means (e.g. router.push(`/product/${id}`)). */
  onRowOpen?: (record: Row) => void;
}
