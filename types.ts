import type { ReactNode } from 'react';

export type Cell = string | number | null;
export type ColumnType = 'text' | 'number' | 'long-text' | 'url' | 'select' | 'multiselect' | 'date' | 'checkbox' | 'rating';

/** Формат отображения числовой колонки (как «Формат → Число» в Google Таблицах).
    plain — как есть, thousands — разряды 1 234, currency — символ + разряды,
    percent — число со знаком «%». decimals задаёт знаки после запятой. */
export interface NumberFormat {
  style?: 'plain' | 'thousands' | 'currency' | 'percent';
  /** 0..4 знаков после запятой */
  decimals?: number;
  /** символ валюты-префикс для style:'currency' (по умолчанию «$») */
  currency?: string;
}

export interface ColumnDef {
  key: string;
  label: string;
  type: ColumnType;
  sortable?: boolean;
  filterable?: boolean;
  /** формат чисел — только для type:'number' */
  numberFormat?: NumberFormat;
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

/** Формат одной клетки. bold — жирный; fontScale — множитель размера шрифта
    (undefined/1 = обычный). Хранится в данных строки, не в настройках вида. */
export interface CellFormat {
  bold?: boolean;
  fontScale?: number;
}

export interface SortState {
  key: string;
  dir: 'asc' | 'desc';
}

/** Поведение текста, который не влез в ячейку. Три первых — один в один Google
    Sheets WrapStrategy (WRAP / CLIP / OVERFLOW_CELL), включая правило «если
    соседняя ячейка непустая, OVERFLOW ведёт себя как CLIP». Четвёртый взят у
    Excel: Shrink to fit — «Data in the cell reduces to fit the column width». */
export type WrapStrategy = 'wrap' | 'clip' | 'overflow' | 'shrink';

/** Итог по колонке в заголовке группы. Набор — из group-by views Google Таблиц
    (Sum, Average, Min, Max, Filled, Unique). */
export type AggKind = 'none' | 'sum' | 'avg' | 'min' | 'max' | 'filled' | 'unique';

/** Высота строки в строках текста. Модель Coda (1/2/3/All lines): при
    фиксированной высоте перенос не работает — текст идёт в одну строку. */
export type RowLines = 1 | 2 | 3 | 'all';

export interface ViewDisplay {
  wrap: WrapStrategy;
  lines: RowLines;
  /** ширины колонок в пикселях; колонка без записи тянется резиновым треком */
  widths: Record<string, number>;
  /** какой итог показывать в заголовке группы: ключ колонки → вид итога */
  aggregates: Record<string, AggKind>;
  /** при группировке — тонировать каждую группу своим цветом. Выкл по умолчанию. */
  groupColors?: boolean;
  /** закрепить первую колонку (с названием) при прокрутке вбок. Выкл по умолчанию. */
  freezeFirst?: boolean;
  /** тонировать ячейки select-колонок по значению. Выкл по умолчанию. */
  cellColors?: boolean;
  /** ключи скрытых колонок — не показываются в сетке (управляется вручную). */
  hidden?: string[];
  /** ключи числовых колонок с тепловой картой — фон ячейки от бледного к
      насыщенному по величине значения (color scale из Google Таблиц). */
  heatmap?: string[];
  /** строка итогов внизу таблицы: сумма/среднее по каждой числовой колонке,
      всегда на виду (как строка итогов в Google Таблицах). Выкл по умолчанию. */
  footer?: boolean;
  /** ключи колонок с жирным текстом (форматирование из контекстного меню). */
  bold?: string[];
  /** масштаб шрифта по колонке: ключ → множитель (0.85 / 1 / 1.15). */
  fontScale?: Record<string, number>;
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
  filtersPosition?: 'top' | 'left' | 'menu';
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
  /** replace the whole ordered list of sort levels at once — powers the
     explicit «Sort & Group» panel (add / remove / reorder / asc-desc). */
  onSortsSet?: (levels: SortState[]) => void;
  /** columns to GROUP by, independent of the sort order (Google-Sheets style).
     When provided (even empty), it drives grouping instead of the sort levels;
     when omitted, grouping falls back to the sort levels + autoGroup. */
  groupBy?: string[];
  /** replace the whole ordered list of group-by columns at once. */
  onGroupBySet?: (keys: string[]) => void;

  /** ids of favourited records — shown with a filled star */
  favorites?: string[];
  /** star click on a row */
  onToggleFavorite?: (record: Row) => void;
  /** when true only favourites are listed (host does the filtering) */
  favoritesOnly?: boolean;
  onFavoritesOnlyChange?: (only: boolean) => void;
  /** host-rendered control(s) placed at the start of the toolbar, right after
      the search box (e.g. a «Saved views» button that lives with Filters/View). */
  toolbarLead?: ReactNode;
  /** Раскрывать строку карточкой сбоку: все поля целиком, включая длинный
      текст, которого в сетке нет вовсе. Так тесноту решают все не-табличные
      системы — не режимом отображения, а вторым уровнем интерфейса. */
  recordCard?: boolean;

  /** Живое управление колонками прямо из шапки грида: меню ▾ на заголовке
      (переименовать, сменить тип, удалить), кнопка «+ колонка» и перетаскивание
      порядка. Опт-ин — хост включает, только если умеет сохранять изменения. */
  editableColumns?: boolean;
  /** добавить колонку (label + type) */
  onColumnAdd?: (col: { label: string; type: ColumnType }) => void;
  /** переименовать колонку — key стабилен, меняется подпись */
  onColumnRename?: (key: string, label: string) => void;
  /** сменить тип колонки */
  onColumnRetype?: (key: string, type: ColumnType) => void;
  /** удалить колонку */
  onColumnDelete?: (key: string) => void;
  /** сменить формат отображения числовой колонки */
  onColumnFormat?: (key: string, format: NumberFormat) => void;

  /** Режим Google Таблиц для мыши: одиночный клик ВЫДЕЛЯЕТ клетку (синий бокс),
      перетаскивание/Shift-клик — диапазон, правый клик — контекстное меню,
      двойной клик — правка (или открытие страницы, если не editable). Опт-ин:
      хост Fathom его не включает и работает как раньше (клик = открыть строку). */
  cellSelection?: boolean;
  /** Поклеточное форматирование (жирный/размер шрифта), пришедшее из данных:
      rowId → ключ колонки → формат. Так формат живёт на конкретных клетках,
      а не на всей колонке (как в Google Таблицах). */
  cellFormats?: Record<string, Record<string, CellFormat>>;
  /** применить формат к выделенным клеткам (прямоугольник rowIds × colKeys).
      Когда задан — контекстное меню форматирует клетки, а не колонку. */
  onCellFormat?: (rowIds: string[], colKeys: string[], patch: CellFormat) => void;
  /** новый порядок колонок (полный список ключей грид-колонок) */
  onColumnsReorder?: (keys: string[]) => void;

  /** стартовые настройки вида; дальше их меняет сам пользователь через «Вид» */
  defaultDisplay?: Partial<ViewDisplay>;
  /** настройки вида, которые ВСЕГДА побеждают сохранённое в localStorage — для
      тех, что хост навязывает независимо от прошлого выбора пользователя
      (например, wrap: 'shrink' как обязательный режим). Ширины/итоги при этом
      по-прежнему восстанавливаются из localStorage. */
  forceDisplay?: Partial<ViewDisplay>;
  /** когда задан — настройки вида и ширины колонок запоминаются в localStorage
      под этим ключом (у каждой базы свой вид, как филтр-вью в Sheets) */
  viewKey?: string;

  /** commit an edited cell: (record, columnKey, newValue) */
  onCellEdit?: (record: Row, key: string, value: string) => void;
  /** append a new row from the bottom input line (columnKey → value) */
  onAddRow?: (data: Record<string, string>) => void;
  /** Ручной порядок строк перетаскиванием. Хост передаёт колбэк только когда
      порядок «естественный» — без сортировки, фильтров и поиска (иначе drag
      конфликтует с порядком, заданным сортировкой). Приходит полный список id
      строк в новом порядке. */
  onRowReorder?: (orderedIds: string[]) => void;
  /** удалить строку: показывает контрол удаления в строке (только в editable) */
  onDeleteRow?: (record: Row) => void;

  /** Надписи интерфейса таблицы. Опциональны: не переданные берутся из русских
      значений по умолчанию, поэтому существующие хосты (Fathom) ничего не
      замечают. Хост, у которого есть переключатель языков, передаёт сюда набор
      на выбранном языке. */
  strings?: Partial<MindSheetStrings>;

  /** Акцентный цвет базы (её «tone»). Когда задан — заголовки группировок
      получают цветную полосу слева в тон базы, перекликаясь с раскраской
      веток в дереве. Не передан — ничего не меняется (хост Fathom не замечает). */
  accent?: string;
}

/** Все надписи таблицы, которые видит пользователь. Строки с подстановкой —
    функции. Значения по умолчанию (русские) лежат в DEFAULT_STRINGS. */
export interface MindSheetStrings {
  searchPlaceholder: string;
  searchAria: string;
  filterAll: string;
  filterAria: (label: string) => string;
  filtersHead: string;
  favoritesOnly: string;
  addToFav: string;
  removeFromFav: string;
  reset: string;
  clearSort: string;
  shownOf: (shown: number, total: number) => string;
  countRecords: (total: number) => string;
  viewButton: string;
  viewButtonTitle: string;
  viewDialogAria: string;
  wrapHead: string;
  wrapWrap: string; wrapWrapHint: string;
  wrapClip: string; wrapClipHint: string;
  wrapOverflow: string; wrapOverflowHint: string;
  wrapShrink: string; wrapShrinkHint: string;
  rowHeightHead: string;
  rowLinesAll: string;
  rowHeightNote: string;
  aggFold: string;
  aggNote: string;
  aggNone: string; aggSum: string; aggAvg: string; aggMin: string; aggMax: string; aggFilled: string; aggUnique: string;
  filledOf: (filled: number, total: number) => string;
  autoWidthLink: string;
  widthNote: string;
  sortHeaderTitle: string;
  sortPanel: string;
  sortPanelTitle: string;
  sortGroupHead: string;
  sortEmpty: string;
  sortAsc: string;
  sortDesc: string;
  sortUp: string;
  sortDown: string;
  sortRemove: string;
  sortAddLevel: string;
  sortReset: string;
  groupHead: string;
  groupEmpty: string;
  groupAddLevel: string;
  sortByHead: string;
  hideColumn: string;
  columnsHead: string;
  numFormatHead: string;
  numFmtPlain: string;
  numFmtThousands: string;
  numFmtCurrency: string;
  numFmtPercent: string;
  numDecimalsHead: string;
  heatmapLabel: string;
  footerLabel: string;
  selCellsLabel: string;
  menuSortAsc: string;
  menuSortDesc: string;
  menuBold: string;
  menuFontHead: string;
  menuFontSmall: string;
  menuFontNormal: string;
  menuFontLarge: string;
  colMenuAria: (label: string) => string;
  rename: string;
  typeHead: string;
  typeText: string; typeNumber: string; typeSelect: string; typeUrl: string; typeLongText: string;
  typeDate?: string; typeCheckbox?: string; typeRating?: string; typeMultiselect?: string;
  widthHead: string;
  fitContent: string;
  fitAllContent: string;
  shrinkAllContent: string;
  resetWidth: string;
  deleteColumn: string;
  deleteColumnConfirm: (label: string) => string;
  retypeNumberConfirm: (n: number) => string;
  resizerAria: (label: string) => string;
  resizerTitle: string;
  addColNamePlaceholder: string;
  addColumnAria: string;
  addRowTitle: string;
  nothingFound: string;
  emptyTitle: string;
  emptyHint: string;
  expandAll: string; collapseAll: string;
  expandGroup: string; collapseGroup: string;
  dragRow: string;
  expandRecord: string;
  deleteRow: string;
  recordAria: string;
  close: string;
  openAsPage: string;
  ok: string;
  groupingBy: (label: string, count: number) => string;
  groupingHint: string;
  /** optional so existing hosts that build a full strings object don't break;
      DEFAULT_STRINGS still supplies it, and the host may localise it. */
  groupColorsLabel?: string;
  freezeFirstLabel?: string;
  cellColorsLabel?: string;
  clearFilter: string;
  filterByValue: (value: string) => string;
}
