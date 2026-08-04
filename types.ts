export type Cell = string | number | null;
export type ColumnType = 'text' | 'number' | 'long-text' | 'url' | 'select';

export interface ColumnDef {
  key: string;
  label: string;
  type: ColumnType;
  sortable?: boolean;
  filterable?: boolean;
  /** explicit sort order for select values (e.g. importance), most-first.
     Values not listed sort after listed ones. */
  order?: string[];
  /** render select values as coloured pills */
  badge?: boolean;
  /** value → colour variant (green|teal|blue|amber|red|purple|grey);
     unmapped values fall back to grey */
  badgeVariant?: Record<string, string>;
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
  /** shows skeleton rows on the first load (records empty + loading) */
  loading?: boolean;
  /** where the filter controls live: a top toolbar (default) or a left sidebar */
  filtersPosition?: 'top' | 'left';
  sort?: SortState;
  /** legacy single filter (one facet at a time) */
  filter?: FilterState;
  /** multiple simultaneous filters (column key → value); preferred */
  filters?: Record<string, string>;
  filterOptions?: Record<string, string[]>;
  search?: string;
  onSortChange: (key: string) => void;
  /** legacy single-filter handler; used when onFiltersChange is absent */
  onFilterChange?: (filter: FilterState | undefined) => void;
  /** multi-filter handler; receives the full next map */
  onFiltersChange?: (filters: Record<string, string>) => void;
  onSearchChange?: (query: string) => void;
  /* When provided, each row becomes clickable and opens on its own page/view.
     The host decides what that means (e.g. router.push(`/product/${id}`)). */
  onRowOpen?: (record: Row) => void;

  /** spreadsheet mode: dense rows, click-to-edit cells, an add-row at the
     bottom. Opt-in — read-only hosts (e.g. Fathom) leave it off. */
  editable?: boolean;
  /** when sorting is active, rows sharing the sorted value collapse into
     groups with a +/- toggle (Google-Sheets style). No effect when every
     value is unique. */
  autoGroup?: boolean;
  /** commit an edited cell: (record, columnKey, newValue) */
  onCellEdit?: (record: Row, key: string, value: string) => void;
  /** append a new row from the bottom input line (columnKey → value) */
  onAddRow?: (data: Record<string, string>) => void;
}
