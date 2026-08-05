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

/** Поведение текста, который не влез в ячейку. Один в один Google Sheets
    WrapStrategy (OVERFLOW_CELL / CLIP / WRAP) — включая правило «если соседняя
    ячейка непустая, OVERFLOW ведёт себя как CLIP». */
export type WrapStrategy = 'wrap' | 'clip' | 'overflow';

/** Высота строки в строках текста. Модель Coda (1/2/3/All lines): при
    фиксированной высоте перенос не работает — текст идёт в одну строку. */
export type RowLines = 1 | 2 | 3 | 'all';

export interface ViewDisplay {
  wrap: WrapStrategy;
  lines: RowLines;
  /** ширины колонок в пикселях; колонка без записи тянется резиновым треком */
  widths: Record<string, number>;
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
  /** up to 3 sort levels; each level also becomes a grouping level.
     Falls back to `sort` when absent. */
  sorts?: SortState[];
  /** header click with `additive` (shift/ctrl) appends a sort level instead
     of replacing the primary one */
  onSortsChange?: (key: string, additive: boolean) => void;
  /** clears sorting (and therefore grouping); shows a reset button */
  onSortReset?: () => void;

  /** ids of favourited records — shown with a filled star */
  favorites?: string[];
  /** star click on a row */
  onToggleFavorite?: (record: Row) => void;
  /** when true only favourites are listed (host does the filtering) */
  favoritesOnly?: boolean;
  onFavoritesOnlyChange?: (only: boolean) => void;
  /** стартовые настройки вида; дальше их меняет сам пользователь через «Вид» */
  defaultDisplay?: Partial<ViewDisplay>;
  /** когда задан — настройки вида и ширины колонок запоминаются в localStorage
      под этим ключом (у каждой базы свой вид, как филтр-вью в Sheets) */
  viewKey?: string;

  /** commit an edited cell: (record, columnKey, newValue) */
  onCellEdit?: (record: Row, key: string, value: string) => void;
  /** append a new row from the bottom input line (columnKey → value) */
  onAddRow?: (data: Record<string, string>) => void;
}
