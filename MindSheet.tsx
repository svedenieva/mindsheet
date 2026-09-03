'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactElement } from 'react';
import type { AggKind, ColumnDef, ColumnType, MindSheetProps, MindSheetStrings, NumberFormat, Row, RowLines, SortState, ViewDisplay, WrapStrategy } from './types';
import styles from './MindSheet.module.css';

// Надписи по умолчанию — русские. Хост может переопределить любую через проп
// strings; не переданные берутся отсюда, поэтому старые хосты не меняются.
export const DEFAULT_STRINGS: MindSheetStrings = {
  searchPlaceholder: 'Поиск…',
  searchAria: 'Поиск',
  filterAll: 'Все',
  filterAria: (label) => `Фильтр ${label}`,
  filtersHead: 'Фильтры',
  favoritesOnly: 'Только избранные',
  addToFav: 'В избранное',
  removeFromFav: 'Убрать из избранного',
  reset: 'Сбросить',
  clearSort: 'Убрать сортировку',
  shownOf: (shown, total) => `показано ${shown} из ${total}`,
  countRecords: (total) => `${total} записей`,
  viewButton: 'Вид',
  viewButtonTitle: 'Как показывать текст в ячейках',
  viewDialogAria: 'Вид таблицы',
  wrapHead: 'Текст не влез в ячейку',
  wrapWrap: 'Переносить', wrapWrapHint: 'ячейка растягивается под весь объём текста',
  wrapClip: 'Обрезать', wrapClipHint: 'одна строка, лишнее срезается по границе',
  wrapOverflow: 'За границу', wrapOverflowHint: 'текст уходит под соседнюю ячейку, если она пустая',
  wrapShrink: 'Сжать', wrapShrinkHint: 'шрифт уменьшается под ширину; что не влезло и в 8px — обрезается',
  rowHeightHead: 'Высота строки',
  rowLinesAll: 'Всё',
  rowHeightNote: 'Высота работает только с переносом — без него строка всегда одна.',
  aggFold: 'Итоги по группам',
  aggNote: 'Считается по всей ветке, включая вложенные группы.',
  aggNone: '—', aggSum: 'сумма', aggAvg: 'среднее', aggMin: 'мин', aggMax: 'макс', aggFilled: 'заполнено', aggUnique: 'уникальных',
  filledOf: (filled, total) => `${filled} из ${total}`,
  autoWidthLink: 'Вернуть авто-ширину колонок',
  widthNote: 'Ширина колонки — тяни за границу заголовка.',
  sortHeaderTitle: 'Клик — сортировать; Shift + клик — добавить уровень группировки',
  sortPanel: 'Сортировка', sortPanelTitle: 'Сортировка и группировка (несколько уровней)',
  sortGroupHead: 'Группировка и сортировка', sortEmpty: 'Уровней нет — обычный порядок',
  sortAsc: '↑ А–Я', sortDesc: '↓ Я–А', sortUp: 'Выше', sortDown: 'Ниже', sortRemove: 'Убрать',
  sortAddLevel: 'Добавить уровень', sortReset: 'Сбросить',
  groupHead: 'Группировать по', groupEmpty: 'Без группировки', groupAddLevel: 'Добавить группировку', sortByHead: 'Сортировать по',
  hideColumn: 'Скрыть колонку', columnsHead: 'Колонки',
  numFormatHead: 'Формат числа',
  numFmtPlain: 'Обычное', numFmtThousands: 'Разряды 1 234', numFmtCurrency: 'Валюта', numFmtPercent: 'Проценты',
  numDecimalsHead: 'Знаков после запятой',
  heatmapLabel: 'Тепловая карта',
  footerLabel: 'Итоги внизу',
  selCellsLabel: 'Ячеек',
  menuSortAsc: 'Сортировать ↑ А–Я',
  menuSortDesc: 'Сортировать ↓ Я–А',
  menuBold: 'Жирный',
  menuFontHead: 'Размер шрифта',
  menuFontSmall: 'Мельче',
  menuFontNormal: 'Обычный',
  menuFontLarge: 'Крупнее',
  colMenuAria: (label) => `Колонка ${label}`,
  rename: 'Переименовать',
  typeHead: 'Тип',
  typeText: 'Текст', typeNumber: 'Число', typeSelect: 'Выбор', typeUrl: 'Ссылка', typeLongText: 'Длинный текст',
  typeDate: 'Дата', typeCheckbox: 'Галочка', typeRating: 'Рейтинг', typeMultiselect: 'Теги',
  widthHead: 'Ширина',
  fitContent: 'По содержимому',
  fitAllContent: 'По содержимому',
  shrinkAllContent: 'Компактно',
  resetWidth: 'Сбросить ширину',
  deleteColumn: 'Удалить колонку',
  deleteColumnConfirm: (label) => `Удалить колонку «${label}»? Её значения из строк будут скрыты.`,
  retypeNumberConfirm: (n) => `${n} значений не станут числом — они останутся как есть, но сортировка и итоги их не учтут. Сменить тип?`,
  resizerAria: (label) => `Ширина колонки ${label}`,
  resizerTitle: 'Потяни, чтобы изменить ширину колонки',
  addColNamePlaceholder: 'Название',
  addColumnAria: 'Добавить колонку',
  addRowTitle: 'Добавить строку',
  nothingFound: 'Ничего не найдено',
  emptyTitle: 'Здесь пока пусто',
  emptyHint: 'Добавьте первую строку',
  expandAll: 'Развернуть все', collapseAll: 'Свернуть все',
  expandGroup: 'Развернуть', collapseGroup: 'Свернуть',
  dragRow: 'Перетащить строку',
  expandRecord: 'Раскрыть запись',
  deleteRow: 'Удалить строку',
  recordAria: 'Запись',
  close: 'Закрыть',
  openAsPage: 'Открыть страницей →',
  ok: 'ОК',
  groupingBy: (label, count) => `группировка: ${label} · ${count}`,
  groupingHint: 'Shift + клик по заголовку — добавить уровень',
  groupColorsLabel: 'Цветные группы',
  freezeFirstLabel: 'Закрепить первую колонку',
  cellColorsLabel: 'Цветные ячейки',
  clearFilter: 'Убрать фильтр',
  filterByValue: (value) => `Фильтр: ${value}`,
};

// Stable, theme-agnostic tint for a group value: the same value always gets the
// same hue. Used only when ViewDisplay.groupColors is on, so hosts that leave it
// off are unaffected. The caller mixes this hue into the row background at low
// alpha, which reads correctly on both light and dark themes.
function groupHue(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return h % 360;
}

// Ниже этого размера сжимать бессмысленно — дальше уже не читается,
// поэтому остаток честно обрезаем.
const MIN_SHRINK_PX = 8;

function aggregate(rows: Row[], key: string, kind: AggKind, s: MindSheetStrings): string | null {
  if (kind === 'none' || rows.length === 0) return null;
  const values = rows.map((r) => r[key]);
  const filled = values.filter(hasValue);

  if (kind === 'filled') return s.filledOf(filled.length, rows.length);
  if (kind === 'unique') return String(new Set(filled.map((v) => String(v))).size);

  const nums = filled.map((v) => Number(String(v).replace(',', '.'))).filter((n) => Number.isFinite(n));
  if (!nums.length) return null;
  const round = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  if (kind === 'sum') return round(nums.reduce((a, b) => a + b, 0));
  if (kind === 'avg') return round(nums.reduce((a, b) => a + b, 0) / nums.length);
  if (kind === 'min') return round(Math.min(...nums));
  return round(Math.max(...nums));
}

const MIN_COL_WIDTH = 64;

// ширина хвостового трека под кнопку «+ колонка»
const ADD_COL_TRACK = 40;

// узел дерева авто-группировки: либо ветка (children), либо лист со строками
interface GroupNode {
  path: string;
  value: string;
  label: string;
  depth: number;
  count: number;
  children: GroupNode[] | null;
  rows: Row[];
}

function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

function hasValue(v: Row[string]): boolean {
  return v !== null && v !== undefined && v !== '';
}

// checkbox / date / rating helpers — one place, used by both render and edit
function isChecked(v: Row[string]): boolean {
  const s = String(v ?? '').trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'да' || s === 'так' || s === '✓' || s === '✔';
}
function formatDateCell(v: Row[string]): string {
  const s = String(v ?? '').trim();
  if (!s) return '';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString();
}
function ratingStars(v: Row[string]): string {
  const n = Math.max(0, Math.min(5, Math.round(Number(v) || 0)));
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

// A multiselect cell holds several tags, stored comma-separated (fits the string
// Cell type and the host's JSON storage); an array is also accepted defensively.
// Empty tags dropped, duplicates collapsed, order kept.
function splitTags(v: Row[string]): string[] {
  const parts = Array.isArray(v) ? v : String(v ?? '').split(',');
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    const t = String(p ?? '').trim();
    if (t && !seen.has(t)) { seen.add(t); out.push(t); }
  }
  return out;
}

// distinct values for a facet; when `multi`, a cell's tags are split so the
// facet lists each tag on its own (multiselect columns).
function distinct(records: Row[], key: string, multi = false): string[] {
  const set = new Set<string>();
  for (const r of records) {
    if (!hasValue(r[key])) continue;
    if (multi) for (const t of splitTags(r[key])) set.add(t);
    else set.add(String(r[key]));
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'ru'));
}

// Multi-level row sort, independent of grouping. Respects a column's explicit
// `order`, numeric/rating columns as numbers, else locale text; empties sink to
// the bottom regardless of direction; the original index is the stable tiebreak.
function sortRows(rows: Row[], levels: SortState[], columns: ColumnDef[]): Row[] {
  if (!levels.length) return rows;
  const colOf = new Map(columns.map((c) => [c.key, c]));
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      for (const lv of levels) {
        const col = colOf.get(lv.key);
        const dir = lv.dir === 'desc' ? -1 : 1;
        const av = a.r[lv.key];
        const bv = b.r[lv.key];
        const ae = !hasValue(av);
        const be = !hasValue(bv);
        if (ae && be) continue;
        if (ae) return 1;
        if (be) return -1;
        let c: number;
        if (col?.order) c = col.order.indexOf(String(av)) - col.order.indexOf(String(bv));
        else if (col?.type === 'number' || col?.type === 'rating') c = Number(av) - Number(bv);
        else c = String(av).localeCompare(String(bv), 'ru');
        if (c !== 0) return c * dir;
      }
      return a.i - b.i;
    })
    .map((d) => d.r);
}

// short columns live in the grid; long-text columns are shown on the record's
// own page (opened via onRowOpen), so they stay out of the table entirely.
// Tracks are fluid (fr, min 0) so the whole grid always fits the page width —
// no horizontal scrolling — and cell text wraps instead of overflowing.
function trackFor(column: ColumnDef, isFirst: boolean): string {
  if (isFirst) return 'minmax(0, 1.7fr)';
  if (column.type === 'checkbox') return 'minmax(44px, 0.35fr)';
  if (column.type === 'rating') return 'minmax(0, 0.6fr)';
  if (column.type === 'date') return 'minmax(0, 0.75fr)';
  if (column.type === 'number') return 'minmax(0, 0.6fr)';
  if (column.type === 'url') return 'minmax(0, 1.4fr)';
  // select-колонки держат бейджи-пилюли: без нижнего предела их сжимало до
  // ~60px, и текст в пилюле резался. 100px хватает большинству ярлыков на одну
  // строку, длинные переносятся (а не обрезаются).
  if (column.type === 'select') return 'minmax(100px, 1fr)';
  // multiselect shows several pills — give it a touch more room than a single select
  if (column.type === 'multiselect') return 'minmax(120px, 1.3fr)';
  return 'minmax(0, 1.1fr)'; // text
}

function isCentered(column: ColumnDef): boolean {
  // multiselect is left-aligned: several pills read better from the left edge
  return column.type === 'number' || column.type === 'select' || column.type === 'checkbox' || column.type === 'rating';
}

export default function MindSheet({
  columns, records, total, loading, filtersPosition = 'top',
  sort, filter, filters, filterOptions, search,
  onSortChange, onFilterChange, onFiltersChange, onSearchChange, onRowOpen,
  editable, onCellEdit, onAddRow, onDeleteRow, onRowReorder, autoGroup, sorts, onSortsChange, onSortReset, onSortsSet, groupBy, onGroupBySet,
  favorites, onToggleFavorite, favoritesOnly, onFavoritesOnlyChange,
  recordCard,
  editableColumns, onColumnAdd, onColumnRename, onColumnRetype, onColumnDelete, onColumnFormat, onColumnsReorder,
  defaultDisplay, forceDisplay, viewKey, strings, accent, toolbarLead,
}: MindSheetProps) {
  // надписи: переданные хостом поверх русских значений по умолчанию
  const S: MindSheetStrings = { ...DEFAULT_STRINGS, ...strings };
  // наборы для «Вида», высоты строки, итогов и типов колонок — на текущем языке
  const WRAP_MODES: Array<{ id: WrapStrategy; label: string; hint: string }> = [
    { id: 'wrap', label: S.wrapWrap, hint: S.wrapWrapHint },
    { id: 'clip', label: S.wrapClip, hint: S.wrapClipHint },
    { id: 'overflow', label: S.wrapOverflow, hint: S.wrapOverflowHint },
    { id: 'shrink', label: S.wrapShrink, hint: S.wrapShrinkHint },
  ];
  const LINE_MODES: Array<{ id: RowLines; label: string }> = [
    { id: 1, label: '1' }, { id: 2, label: '2' }, { id: 3, label: '3' }, { id: 'all', label: S.rowLinesAll },
  ];
  const AGG_MODES: Array<{ id: AggKind; label: string; numeric: boolean }> = [
    { id: 'none', label: S.aggNone, numeric: false },
    { id: 'sum', label: S.aggSum, numeric: true },
    { id: 'avg', label: S.aggAvg, numeric: true },
    { id: 'min', label: S.aggMin, numeric: true },
    { id: 'max', label: S.aggMax, numeric: true },
    { id: 'filled', label: S.aggFilled, numeric: false },
    { id: 'unique', label: S.aggUnique, numeric: false },
  ];
  const COLUMN_TYPES: Array<{ id: ColumnType; label: string }> = [
    { id: 'text', label: S.typeText }, { id: 'number', label: S.typeNumber }, { id: 'select', label: S.typeSelect },
    { id: 'multiselect', label: S.typeMultiselect ?? 'Tags' },
    { id: 'url', label: S.typeUrl }, { id: 'long-text', label: S.typeLongText },
    { id: 'date', label: S.typeDate ?? 'Date' }, { id: 'checkbox', label: S.typeCheckbox ?? 'Checkbox' }, { id: 'rating', label: S.typeRating ?? 'Rating' },
  ];
  const favSet = new Set(favorites ?? []);
  const canFavorite = Boolean(onToggleFavorite);
  // опт-ин контрол удаления строки — виден только в editable-режиме, когда
  // хост передал обработчик; отсутствие пропа не меняет разметку вовсе
  const showRowDelete = Boolean(editable && onDeleteRow);
  const filterables = columns.filter((c) => c.filterable);
  const sidebar = filtersPosition === 'left';

  // свёрнутые группы авто-группировки (по значению сортируемой колонки)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  // groups start COLLAPSED when a base opens or its grouping changes — you open
  // them yourself. Tracks the grouping «signature» so a manual expand isn't
  // undone on every re-render, only when the base / group column actually changes.
  const groupSigRef = useRef<string | null>(null);
  const toggleGroup = (value: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });

  // ── вид таблицы: перенос текста, высота строки, ширины колонок ──────
  // Настройка живёт у пользователя, а не у хоста: как в Sheets, где wrap и
  // высота строки — свойство того, кто смотрит. С viewKey запоминается.
  const storeKey = viewKey ? `mindsheet:view:${viewKey}` : null;
  const [display, setDisplay] = useState<ViewDisplay>(() => ({
    // в режиме таблицы плотность важнее объёма — стартуем с одной строки
    wrap: 'wrap', lines: editable ? 1 : 3, widths: {}, aggregates: {}, ...defaultDisplay, ...forceDisplay,
  }));
  const [viewOpen, setViewOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  // фильтры слева свёрнуты в выпадашку — панель не занимает всю колонку
  const [filtersOpen, setFiltersOpen] = useState(false);
  // раздел итогов внутри панели «Вид» — свёрнут, пока не понадобится
  const [aggOpen, setAggOpen] = useState(false);
  // читаем сохранённый вид только на клиенте — иначе разъедется гидрация
  const loaded = useRef(false);

  useEffect(() => {
    loaded.current = false;
    if (!storeKey) return;
    try {
      const raw = window.localStorage.getItem(storeKey);
      // forceDisplay wins over whatever was saved, so a host-mandated mode
      // (e.g. wrap: 'shrink') isn't defeated by an older saved choice; widths
      // and the rest still come back from localStorage.
      if (raw) setDisplay((d) => ({ ...d, ...(JSON.parse(raw) as Partial<ViewDisplay>), ...forceDisplay }));
    } catch {
      /* приватный режим или битый JSON — просто едем с настройками по умолчанию */
    }
    loaded.current = true;
  }, [storeKey]);

  useEffect(() => {
    if (!storeKey || !loaded.current) return;
    try {
      window.localStorage.setItem(storeKey, JSON.stringify(display));
    } catch {
      /* хранилище недоступно — вид просто не переживёт перезагрузку */
    }
  }, [storeKey, display]);

  const setWrap = (wrap: WrapStrategy) => setDisplay((d) => ({ ...d, wrap }));
  const setLines = (lines: RowLines) => setDisplay((d) => ({ ...d, lines }));
  const resetWidths = () => setDisplay((d) => ({ ...d, widths: {} }));
  const setAgg = (key: string, kind: AggKind) =>
    setDisplay((d) => {
      const aggregates = { ...d.aggregates };
      if (kind === 'none') delete aggregates[key];
      else aggregates[key] = kind;
      return { ...d, aggregates };
    });

  // «Сжать» = Shrink to fit из Excel. CSS такого не умеет, поэтому меряем сами:
  // сначала сбрасываем размер у всех ячеек, потом читаем — так браузер считает
  // раскладку дважды на всю таблицу, а не дважды на каждую ячейку.
  const tableRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const root = tableRef.current;
    if (!root) return;
    // вне режима таких ячеек нет вовсе, так что выборка пустая и стоит копейки
    const all = Array.from(root.querySelectorAll<HTMLElement>(`.${styles.shrinkCell}`));
    for (const c of all) c.style.fontSize = '';
    if (display.wrap !== 'shrink' || !all.length) return;
    // Меряем всё, кроме однобуквенных значений (галочка, значок): короткое
    // слово вроде «США» или «Reddit» переполняет узкую колонку и тоже должно
    // сжиматься, а не обрезаться. Длину читаем без обращения к раскладке, а сам
    // замер дёшев — в DOM живут только видимые строки.
    const cells = all.filter((c) => (c.textContent ?? '').trim().length >= 2);
    if (!cells.length) return;
    // базовый размер один на всю таблицу — читаем его один раз, а не по ячейке:
    // getComputedStyle на каждую из тысяч ячеек стоил дороже самих замеров
    const base = parseFloat(getComputedStyle(cells[0]).fontSize) || 12;

    // Замеры идут двумя проходами — сначала читаем все размеры, потом
    // проставляем: иначе браузер пересчитывал бы раскладку на каждой ячейке.
    // Цена всё равно заметная: на каталоге в 400 строк это примерно полсекунды
    // при каждой смене данных. Платит её только тот, кто выбрал этот режим,
    // — по-настоящему дёшево станет, когда таблица начнёт отрисовывать лишь
    // видимые строки, а это отдельная работа.
    const sizes = cells.map((c) => ({ full: c.scrollWidth, box: c.clientWidth }));
    cells.forEach((c, i) => {
      const { full, box } = sizes[i];
      if (!box || full <= box + 1) return;
      c.style.fontSize = `${Math.max(MIN_SHRINK_PX, Math.floor(base * (box / full) * 10) / 10)}px`;
    });
    // пересчитываем только когда меняется то, от чего зависит раскладка,
    // а не на каждую перерисовку — иначе цена платится при каждом фильтре
  }, [display.wrap, display.widths, display.lines, records, columns]);

  // тяга за правый край заголовка — ширина колонки в px; двойной клик снимает
  const startResize = (e: ReactPointerEvent<HTMLSpanElement>, key: string) => {
    e.preventDefault();
    e.stopPropagation();
    const head = (e.currentTarget.parentElement as HTMLElement | null);
    const startWidth = head?.getBoundingClientRect().width ?? 120;
    const startX = e.clientX;

    // Pin EVERY column to its current pixel width before the drag. Otherwise the
    // columns still on fluid (fr) tracks soak up the freed space and visibly
    // expand when you resize one — the user asked for the others to stay put.
    // The header's data cells (.th) map 1:1 to gridCols; leading service cells
    // are .caretCell and are skipped.
    const heads = tableRef.current
      ?.querySelector(`.${styles.tableHead}`)
      ?.querySelectorAll<HTMLElement>(`.${styles.th}`);
    if (heads) {
      const frozen: Record<string, number> = {};
      gridCols.forEach((c, i) => {
        const cell = heads[i];
        if (cell) frozen[c.key] = Math.round(cell.getBoundingClientRect().width);
      });
      // keep any width the user already set explicitly (d.widths wins)
      setDisplay((d) => ({ ...d, widths: { ...frozen, ...d.widths } }));
    }
    // тянуть можно и мимо ручки — события ловим на окне; заодно глушим
    // выделение текста, иначе протяжка выделяет заголовки соседних колонок
    const prevSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';
    const move = (ev: globalThis.PointerEvent) => {
      const w = Math.max(MIN_COL_WIDTH, Math.round(startWidth + ev.clientX - startX));
      setDisplay((d) => ({ ...d, widths: { ...d.widths, [key]: w } }));
    };
    const up = () => {
      document.body.style.userSelect = prevSelect;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  // «Ширина по содержимому» (Fit to data из Google Таблиц) — теперь ЯВНЫМ
  // пунктом меню колонки, а не двойным кликом по краю: авто-раздувание на
  // случайный двойной клик по ручке путало и мешало тянуть ширину руками.
  // Ячейки ищем по классу .td/.th, а не по позиции: служебных колонок слева
  // бывает разное число (ручка перетаскивания, раскрытие, звезда, корзина),
  // и счёт по индексу промахивался мимо нужной колонки.
  const fitWidth = (key: string, index: number) => {
    const root = tableRef.current;
    if (!root) return;
    let need = 0;
    for (const row of root.querySelectorAll<HTMLElement>(`.${styles.row}`)) {
      const cell = row.querySelectorAll<HTMLElement>(`.${styles.td}`)[index];
      if (cell) need = Math.max(need, cell.scrollWidth);
    }
    const headCell = root.querySelector<HTMLElement>(`.${styles.tableHead}`)?.querySelectorAll<HTMLElement>(`.${styles.th}`)[index];
    if (headCell) need = Math.max(need, headCell.scrollWidth);
    if (!need) return;
    // немного воздуха, чтобы текст не упирался в границу
    const width = Math.min(520, Math.max(MIN_COL_WIDTH, Math.ceil(need) + 12));
    setDisplay((d) => ({ ...d, widths: { ...d.widths, [key]: width } }));
  };

  // «Подогнать все под содержимое» — одной кнопкой меряем все колонки за один
  // проход по таблице (заголовки + строки) и ставим каждой ширину под её самую
  // длинную ячейку: длинные колонки становятся широкими, короткие — узкими
  // (в тех же рамках 64..520px, что и у по-колоночного «По содержимому»).
  const fitAllWidths = () => {
    const root = tableRef.current;
    if (!root) return;
    const need: number[] = [];
    const track = (i: number, w: number) => { need[i] = Math.max(need[i] ?? 0, w); };
    root
      .querySelector<HTMLElement>(`.${styles.tableHead}`)
      ?.querySelectorAll<HTMLElement>(`.${styles.th}`)
      .forEach((cell, i) => track(i, cell.scrollWidth));
    for (const row of root.querySelectorAll<HTMLElement>(`.${styles.row}`)) {
      row.querySelectorAll<HTMLElement>(`.${styles.td}`).forEach((cell, i) => track(i, cell.scrollWidth));
    }
    setDisplay((d) => {
      const widths = { ...d.widths };
      gridCols.forEach((c, i) => {
        if (need[i]) widths[c.key] = Math.min(520, Math.max(MIN_COL_WIDTH, Math.ceil(need[i]) + 12));
      });
      return { ...d, widths };
    });
  };

  // «Сузить все колонки» — обратное к «Подогнать все»: жмём каждую колонку до
  // минимальной ширины (в режиме «Сжать» шрифт сам ужмётся под неё, иначе
  // работает перенос/обрезка). Быстрый способ вернуть таблице компактность.
  const shrinkAllWidths = () =>
    setDisplay((d) => {
      const widths = { ...d.widths };
      for (const c of gridCols) widths[c.key] = MIN_COL_WIDTH;
      return { ...d, widths };
    });

  // снять ручную ширину — колонка возвращается к резиновому треку
  const resetWidth = (key: string) =>
    setDisplay((d) => {
      const widths = { ...d.widths };
      delete widths[key];
      return { ...d, widths };
    });

  // строка, раскрытая карточкой сбоку
  const [openRow, setOpenRow] = useState<string | null>(null);

  // ── перетаскивание строк (ручной порядок) ───────────────────────────
  const [dragRow, setDragRow] = useState<string | null>(null); // какую строку тащим
  const [overRow, setOverRow] = useState<{ id: string; below: boolean } | null>(null);
  // оптимистичный порядок: показываем новый порядок сразу, до ответа сервера.
  // Сбрасываем, как только придёт свежий набор строк (там уже нужный порядок).
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);
  useEffect(() => { setLocalOrder(null); }, [records]);

  // ── живое управление колонками ──────────────────────────────────────
  const [colMenu, setColMenu] = useState<string | null>(null); // key колонки с открытым меню
  const [colRename, setColRename] = useState<{ key: string; draft: string } | null>(null);
  const [dragCol, setDragCol] = useState<string | null>(null); // перетаскиваемая колонка
  const [dropCol, setDropCol] = useState<string | null>(null); // цель, над которой висим
  const [addingCol, setAddingCol] = useState(false);
  const [newCol, setNewCol] = useState<{ label: string; type: ColumnType }>({ label: '', type: 'text' });

  useEffect(() => {
    if (!colMenu) return;
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(`.${styles.colMenuPanel}, .${styles.colMenuBtn}`)) setColMenu(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setColMenu(null); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [colMenu]);

  // сколько значений колонки не станут числом при смене типа — для честного
  // предупреждения перед конверсией (то, чего рынок в открытую не делает)
  const lossToNumber = (key: string): number => {
    let bad = 0;
    for (const r of records) {
      const v = r[key];
      if (v === null || v === undefined || String(v).trim() === '') continue;
      if (!Number.isFinite(Number(String(v).replace(',', '.')))) bad++;
    }
    return bad;
  };

  const doRetype = (key: string, type: ColumnType) => {
    if (type === 'number') {
      const bad = lossToNumber(key);
      if (bad > 0 && !window.confirm(S.retypeNumberConfirm(bad))) {
        return;
      }
    }
    onColumnRetype?.(key, type);
    setColMenu(null);
  };

  // карточка ведёт себя как остальные оверлеи: Esc и клик вне закрывают.
  // Раньше закрыть можно было только крестиком — вразрез с окном дерева и
  // панелью «Вид», которые закрываются и так.
  const cardRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!openRow) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenRow(null);
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      // клик по кнопке раскрытия другой строки не считаем «вне» — иначе
      // карточка закрылась бы в тот же миг, что открывается новая
      if (cardRef.current?.contains(t) || t.closest(`.${styles.expand}`)) return;
      setOpenRow(null);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [openRow]);

  // spreadsheet mode: which cell is open, its draft, and the bottom add-row draft
  const [editing, setEditing] = useState<{ id: string; key: string } | null>(null);
  const [draft, setDraft] = useState('');
  const [addDraft, setAddDraft] = useState<Record<string, string>>({});

  const startEdit = (r: Row, key: string) => {
    setEditing({ id: r.id, key });
    setDraft(r[key] == null ? '' : String(r[key]));
  };
  const commitEdit = (r: Row, key: string) => {
    setEditing(null);
    if (onCellEdit && draft !== (r[key] == null ? '' : String(r[key]))) onCellEdit(r, key, draft);
  };
  // commit a value right away without leaving edit mode — used by the tag picker
  // so each toggle saves immediately (no separate «done» step)
  const liveEdit = (r: Row, key: string, v: string) => {
    setDraft(v);
    if (onCellEdit && v !== (r[key] == null ? '' : String(r[key]))) onCellEdit(r, key, v);
  };

  // click outside the open editor closes it (committing any typed draft). The
  // grid's blur handling is unreliable when the editor is a focusable shell, so
  // this is the dependable way to finish an edit by clicking away.
  const editingCellRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!editing) return;
    const onDown = (e: MouseEvent) => {
      const cell = editingCellRef.current;
      if (cell && !cell.contains(e.target as Node)) {
        const r = records.find((x) => String(x.id) === editing.id);
        if (r) commitEdit(r, editing.key);
        else setEditing(null);
      }
    };
    document.addEventListener('mousedown', onDown, true);
    return () => document.removeEventListener('mousedown', onDown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, records, draft]);
  const commitAdd = () => {
    if (onAddRow && Object.values(addDraft).some((v) => v.trim())) {
      onAddRow(addDraft);
      setAddDraft({});
    }
  };

  // One internal model regardless of which API the host uses: a {key: value}
  // map. The legacy single `filter` folds into it so old hosts keep working.
  const filterMap: Record<string, string> =
    filters ?? (filter ? { [filter.key]: filter.value } : {});
  const multi = Boolean(onFiltersChange);

  const setFilter = (key: string, value: string) => {
    if (multi) {
      const next = { ...filterMap };
      if (value) next[key] = value;
      else delete next[key];
      onFiltersChange!(next);
    } else {
      onFilterChange?.(value ? { key, value } : undefined);
    }
  };

  // click a badge to filter by it; click the active one again to clear
  const toggleFilter = (key: string, value: string) => {
    setFilter(key, filterMap[key] === value ? '' : value);
  };

  const hasSearch = Boolean(search && search.trim());
  const isFiltered = Object.keys(filterMap).length > 0 || hasSearch;
  const grandTotal = total ?? records.length;

  const resetAll = () => {
    if (multi) onFiltersChange!({});
    else onFilterChange?.(undefined);
    onSearchChange?.('');
  };
  // all columns that CAN sit in the grid (long-text lives on the record page),
  // then the visible set with the manually-hidden ones removed
  const allCols = columns.filter((c) => c.type !== 'long-text');
  const hiddenKeys = display.hidden ?? [];
  const gridCols = allCols.filter((c) => !hiddenKeys.includes(c.key));
  const firstKey = gridCols[0]?.key;
  const toggleHidden = (key: string) =>
    setDisplay((d) => {
      const cur = d.hidden ?? [];
      return { ...d, hidden: cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key] };
    });
  const toggleHeatmap = (key: string) =>
    setDisplay((d) => {
      const cur = d.heatmap ?? [];
      return { ...d, heatmap: cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key] };
    });

  // ── выделение диапазона ячеек мышью (как в Google Таблицах) ──────────
  // Тянем мышью или Shift-клик — прямоугольник ячеек подсвечивается, снизу
  // всплывает счётчик/сумма/среднее. Работает в плоском виде (без группировки),
  // а обычный клик (правка/открытие строки) остаётся нетронутым: подавляем его
  // только когда реально был сделан drag или Shift-клик.
  const [sel, setSel] = useState<null | { a: [number, number]; b: [number, number] }>(null);
  const selDragging = useRef(false);
  const selMoved = useRef(false);
  const selSuppressClick = useRef(false);
  const cellDown = (row: number, col: number, shift: boolean) => {
    if (shift && sel) {
      setSel({ a: sel.a, b: [row, col] });
      selSuppressClick.current = true;
      selMoved.current = true;
      return;
    }
    selDragging.current = true;
    selMoved.current = false;
    selSuppressClick.current = false;
    setSel({ a: [row, col], b: [row, col] });
  };
  const cellEnter = (row: number, col: number) => {
    if (!selDragging.current) return;
    selMoved.current = true;
    selSuppressClick.current = true;
    setSel((s) => (s ? { a: s.a, b: [row, col] } : s));
  };
  const selRect = sel
    ? {
        r0: Math.min(sel.a[0], sel.b[0]),
        r1: Math.max(sel.a[0], sel.b[0]),
        c0: Math.min(sel.a[1], sel.b[1]),
        c1: Math.max(sel.a[1], sel.b[1]),
      }
    : null;
  const inSel = (row: number, col: number) =>
    !!selRect && row >= selRect.r0 && row <= selRect.r1 && col >= selRect.c0 && col <= selRect.c1;

  // ── контекстное меню по правому клику (сортировка, жирный, размер шрифта) ──
  const [ctxMenu, setCtxMenu] = useState<null | { x: number; y: number; cols: string[]; col: string }>(null);
  const openCtx = (row: number, col: number, x: number, y: number) => {
    // если клик вне текущего выделения — выделяем эту одну ячейку
    let cols: string[];
    if (inSel(row, col) && selRect) {
      cols = gridCols.slice(selRect.c0, selRect.c1 + 1).map((c) => c.key);
    } else {
      setSel({ a: [row, col], b: [row, col] });
      cols = [gridCols[col]?.key].filter(Boolean) as string[];
    }
    setCtxMenu({ x, y, cols, col: gridCols[col]?.key ?? '' });
  };
  useEffect(() => {
    if (!ctxMenu) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== 'Escape') return;
      setCtxMenu(null);
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', close);
    return () => { window.removeEventListener('pointerdown', close); window.removeEventListener('keydown', close); };
  }, [ctxMenu]);
  const applyBold = (cols: string[]) =>
    setDisplay((d) => {
      const cur = new Set(d.bold ?? []);
      const allOn = cols.every((k) => cur.has(k));
      cols.forEach((k) => (allOn ? cur.delete(k) : cur.add(k)));
      return { ...d, bold: [...cur] };
    });
  const applyFontScale = (cols: string[], mult: number) =>
    setDisplay((d) => {
      const next = { ...(d.fontScale ?? {}) };
      for (const k of cols) {
        if (mult === 1) delete next[k];
        else next[k] = mult;
      }
      return { ...d, fontScale: next };
    });
  const rowsClickable = Boolean(onRowOpen);

  // Ручной порядок строк доступен только в «естественном» порядке: без
  // сортировки (иначе drag спорит с ней), без поиска/фильтров (виден срез, а
  // не вся база) и без подмешанных строк вложенных баз (у них свой base_id —
  // сервер их не переставит). Всё это проверяем по входным пропсам.
  const anyFilter = Boolean(filter) || Boolean(filters && Object.keys(filters).length);
  // «сборный» вид (база + вложенные) помечается колонкой __source — строки
  // таких баз имеют разный base_id, и сервер их одним списком не переставит.
  // Проверяем именно колонку: скрытое поле __source хост добавляет и одиночным
  // базам, а вот колонка появляется только при наличии вложенных.
  const mixedSources = columns.some((c) => c.key === '__source');
  const canReorderRows =
    Boolean(editable && onRowReorder) &&
    !(sorts?.length) && !sort &&
    !search && !anyFilter && !mixedSources;

  // применяем оптимистичный порядок к строкам (только когда drag включён)
  const orderedRecords = (() => {
    if (!localOrder || !canReorderRows) return records;
    const byId = new Map(records.map((r) => [String(r.id), r]));
    const seen = new Set<string>();
    const out: Row[] = [];
    for (const id of localOrder) { const r = byId.get(id); if (r) { out.push(r); seen.add(id); } }
    for (const r of records) if (!seen.has(String(r.id))) out.push(r);
    return out;
  })();

  const lead = rowsClickable || editable ? '22px' : '0px';

  const sizedCols = Object.keys(display.widths).length > 0;
  const aggCount = Object.keys(display.aggregates).length;

  // Заморозка первой колонки имеет смысл только когда таблица едет вбок —
  // то есть после того, как ширины задали руками. Прижимаем служебные ячейки
  // слева и саму колонку с названием. Список активных лид-колонок идёт в
  // том же порядке, в каком они реально рендерятся (caret → star → delete),
  // поэтому смещения (--fzN) считаются накопительно по нему — годится для
  // любой комбинации, а не только «есть обе» / «есть одна».
  const HANDLE_W = 22;
  const CARET_W = 22;
  const STAR_W = 18;
  const DEL_W = 20;
  const GAP = 10;
  // ручка перетаскивания идёт самой левой лид-ячейкой — до caret/star/delete
  const leadWidths = [
    ...(canReorderRows ? [HANDLE_W] : []),
    ...(rowsClickable || editable ? [CARET_W] : []),
    ...(canFavorite ? [STAR_W] : []),
    ...(showRowDelete ? [DEL_W] : []),
  ];
  const freezeVars: CSSProperties = {};
  let leadAcc = 0;
  leadWidths.forEach((w, i) => {
    leadAcc += w + GAP;
    (freezeVars as Record<string, string>)[`--fz${i + 2}`] = `${leadAcc}px`;
  });
  // Opt-in: pin the lead cells + the name column so it stays put when the table
  // scrolls sideways. The freeze machinery (offsets + fade shadow) is all in the
  // CSS; freeze{N} pins the first N children, so N = lead cells + 1 (the name).
  const freezeCount = leadWidths.length + 1;
  const freezeClass = display.freezeFirst && freezeCount <= 5 ? styles[`freeze${freezeCount}`] : undefined;
  const grid = [
    ...(canReorderRows ? [`${HANDLE_W}px`] : []),
    lead,
    ...(canFavorite ? [`${STAR_W}px`] : []),
    ...(showRowDelete ? [`${DEL_W}px`] : []),
    ...gridCols.map((c, i) => (display.widths[c.key] ? `${display.widths[c.key]}px` : trackFor(c, i === 0))),
    // хвостовой трек под «+ колонка»; строки его просто оставляют пустым
    ...(editableColumns ? [`${ADD_COL_TRACK}px`] : []),
  ].join(' ');
  const gridStyle = { '--grid': grid } as CSSProperties;

  // класс ячейки по выбранному режиму. Для «за границу» действует правило
  // Google: наплывать можно только на пустого соседа, иначе обрезаем.
  const lineClass = display.lines === 'all' ? styles.linesAll : styles[`lines${display.lines}`];
  const cellMode = (r: Row, idx: number): string => {
    if (display.wrap === 'wrap') return cx(styles.wrapCell, lineClass);
    if (display.wrap === 'clip') return styles.clipCell;
    if (display.wrap === 'shrink') return styles.shrinkCell;
    const next = gridCols[idx + 1];
    return !next || !hasValue(r[next.key]) ? styles.spillCell : styles.clipCell;
  };

  // Авто-группировка по уровням сортировки (до 3). Собираем по ЗНАЧЕНИЮ, а не
  // по соседству строк: одно значение — ровно одна группа, даже если строки
  // идут вразбивку. Порядок групп — по правилам колонки (явный order, число
  // или текст) и направлению уровня; внутри последнего уровня строки
  // сортируются по первой колонке.
  const levels: SortState[] = (sorts?.length ? sorts : sort ? [sort] : []).slice(0, 3);
  const nameKey = gridCols[0]?.key;

  // rows in display order: a manual drag order wins; otherwise sort by the sort
  // levels (independent of grouping — Google-Sheets style)
  const displayRecords = localOrder && canReorderRows ? orderedRecords : sortRows(records, levels, columns);

  // Тепловая карта: min/max по каждой числовой колонке с включённым color scale.
  // Считаем один раз на рендер, потом красим фон ячеек интерполяцией min→max.
  const heatStats = useMemo(() => {
    const on = (display.heatmap ?? []).filter((k) => columns.some((c) => c.key === k && c.type === 'number'));
    const stats: Record<string, { min: number; max: number }> = {};
    for (const k of on) {
      let min = Infinity;
      let max = -Infinity;
      for (const r of displayRecords) {
        const v = r[k];
        if (v === null || v === '') continue;
        const n = Number(v);
        if (!isFinite(n)) continue;
        if (n < min) min = n;
        if (n > max) max = n;
      }
      if (isFinite(min)) stats[k] = { min, max };
    }
    return stats;
  }, [display.heatmap, columns, displayRecords]);

  // GROUP levels are separate from SORT: use explicit groupBy when the host gives
  // it (even empty), else fall back to the sort levels while autoGroup is on
  const groupKeys: string[] = groupBy !== undefined ? groupBy : autoGroup ? levels.map((l) => l.key) : [];
  const groupLevels: SortState[] = groupKeys.slice(0, 3).map((k) => ({ key: k, dir: levels.find((l) => l.key === k)?.dir ?? 'asc' }));

  // Значения ячейки для группировки. Мультиселект держит в ячейке массив, и
  // раньше он проходил через String() — теги склеивались в одну бессмысленную
  // группу «Популярность,Вердикт», которой не соответствует ни один фильтр.
  // Теперь строка с двумя тегами попадает в группу КАЖДОГО своего тега, как в
  // Notion и Airtable. Поэтому сумма счётчиков групп может быть больше числа
  // строк: это не дубли, а одна запись, показанная в каждом своём разрезе.
  const groupValues = (r: Row, key: string): string[] => {
    const cell = r[key];

    // a multiselect (or an array) row falls into the group of EACH of its tags,
    // as in Notion/Airtable — this is what groups nodes by topic (§5.7). The sum
    // of group counts can exceed the row count: one row shown in each of its cuts.
    const col = columns.find((c) => c.key === key);
    if (Array.isArray(cell) || col?.type === 'multiselect') {
      const tags = splitTags(cell);
      return tags.length ? tags : ['—'];
    }

    const raw = hasValue(cell) ? String(cell).trim() : '';
    return raw === '' ? ['—'] : [raw];
  };

  function buildGroups(rows: Row[], depth: number, prefix: string): GroupNode[] {
    const level = groupLevels[depth];
    const col = columns.find((c) => c.key === level.key);
    const dir = level.dir === 'desc' ? -1 : 1;
    const map = new Map<string, Row[]>();
    for (const r of rows) {
      for (const value of groupValues(r, level.key)) {
        const bucket = map.get(value);
        if (bucket) bucket.push(r);
        else map.set(value, [r]);
      }
    }
    const rank = (v: string) => {
      if (!col?.order) return -1;
      const i = col.order.indexOf(v);
      return i === -1 ? col.order.length : i;
    };
    const out: GroupNode[] = [];
    for (const [value, bucket] of map) {
      const path = prefix ? prefix + ' / ' + value : value;
      const deeper = depth + 1 < groupLevels.length;
      const label = col?.label ?? level.key;
      if (deeper) {
        out.push({
          path,
          value,
          label,
          depth,
          count: bucket.length,
          children: buildGroups(bucket, depth + 1, path),
          rows: [],
        });
      } else {
        // bucket already preserves the sort order of displayRecords
        out.push({ path, value, label, depth, count: bucket.length, children: null, rows: bucket });
      }
    }
    out.sort((a, b) => {
      if (a.value === '—') return 1;
      if (b.value === '—') return -1;
      if (col?.order) return (rank(a.value) - rank(b.value)) * dir;
      if (col?.type === 'number' || col?.type === 'rating') return (Number(a.value) - Number(b.value)) * dir;
      return a.value.localeCompare(b.value, 'ru') * dir;
    });
    return out;
  }

  const groups: GroupNode[] = groupLevels.length ? buildGroups(displayRecords, 0, '') : [];
  // сколько раз строки вообще показываются: с мультиселектом одна запись
  // попадает в несколько групп, поэтому сравнивать с records.length нельзя —
  // две записи с четырьмя разными тегами дали бы 4 группы > 2 строк, и
  // группировка молча выключилась бы
  const placements = (function count(nodes: GroupNode[]): number {
    let n = 0;
    for (const node of nodes) n += node.children ? count(node.children) : node.rows.length;
    return n;
  })(groups);
  // группировка осмысленна, только если она реально что-то объединяет
  const grouped = groups.length > 0 && groups.length < placements;
  const allPaths: string[] = [];
  (function collect(nodes: GroupNode[]) {
    for (const n of nodes) {
      allPaths.push(n.path);
      if (n.children) collect(n.children);
    }
  })(groups);
  // Default the groups collapsed when the grouping context changes (new base or
  // new group column). Adjusting state during render (not an effect) avoids a
  // flash of everything expanded before it collapses.
  const groupSig = grouped ? `${viewKey ?? ''}|${groupLevels.map((l) => l.key).join('>')}` : '';
  if (grouped && groupSigRef.current !== groupSig) {
    groupSigRef.current = groupSig;
    setCollapsed(new Set(allPaths));
  } else if (!grouped && groupSigRef.current !== null) {
    groupSigRef.current = null;
  }
  const allCollapsed = grouped && allPaths.length > 0 && allPaths.every((p) => collapsed.has(p));
  const levelsLabel = levels
    .map((l) => columns.find((c) => c.key === l.key)?.label ?? l.key)
    .join(' → ');

  // ── что рисуем: плоский список заголовков групп и строк ─────────────
  // Виртуализация работает по одному списку независимо от того, сгруппировано
  // сейчас или нет: дерево групп разворачивается в ленту в порядке показа.
  // у строки теперь может быть несколько мест на экране, поэтому вместе с ней
  // несём путь её группы: по нему строится ключ react, иначе две копии одной
  // записи получили бы один и тот же key
  type Item = { kind: 'group'; node: GroupNode } | { kind: 'row'; row: Row; path: string };
  const items: Item[] = [];
  if (grouped) {
    (function walk(nodes: GroupNode[]) {
      for (const n of nodes) {
        items.push({ kind: 'group', node: n });
        if (collapsed.has(n.path)) continue;
        if (n.children) walk(n.children);
        else for (const r of n.rows) items.push({ kind: 'row', row: r, path: n.path });
      }
    })(groups);
  } else {
    for (const r of displayRecords) items.push({ kind: 'row', row: r, path: '' });
  }

  // выделение ячеек — только в плоском виде; при группировке сбрасываем
  const selectable = !grouped;
  useEffect(() => { if (grouped) setSel(null); }, [grouped]);
  useEffect(() => {
    const up = () => {
      if (!selDragging.current) return;
      selDragging.current = false;
      if (!selMoved.current) { setSel(null); selSuppressClick.current = false; }
    };
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  }, []);
  // счётчик/сумма/среднее по выделенному прямоугольнику (только числа считаются)
  const selStats = useMemo(() => {
    if (!sel || grouped) return null;
    const r0 = Math.min(sel.a[0], sel.b[0]);
    const r1 = Math.max(sel.a[0], sel.b[0]);
    const c0 = Math.min(sel.a[1], sel.b[1]);
    const c1 = Math.max(sel.a[1], sel.b[1]);
    if (r0 === r1 && c0 === c1) return null; // одна ячейка — не показываем панель
    let count = 0;
    let sum = 0;
    let nums = 0;
    for (let ri = r0; ri <= r1; ri++) {
      const it = items[ri];
      if (!it || it.kind !== 'row') continue;
      for (let ci = c0; ci <= c1; ci++) {
        const col = gridCols[ci];
        if (!col) continue;
        const v = it.row[col.key];
        if (v === null || v === undefined || v === '') continue;
        count++;
        const n = Number(String(v).replace(',', '.'));
        if (isFinite(n)) { sum += n; nums++; }
      }
    }
    return { count, sum, nums };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, grouped, gridCols, records, displayRecords]);

  // ── окно видимых строк ──────────────────────────────────────────────
  // Раньше в DOM жили все строки разом: на каталоге это почти пять тысяч
  // ячеек, и каждая смена фильтра стоила почти секунду. Держим только то,
  // что попадает в видимую часть, плюс запас сверху и снизу.
  const OVERSCAN = 8;
  const estRow = editable ? 30 : display.wrap !== 'wrap' ? 40 : display.lines === 1 ? 40 : 79;
  const estGroup = 34;
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(900);
  const heights = useRef<number[]>([]);

  // при смене набора строк или режима старые замеры больше не про эти строки
  const shapeKey = `${records.length}|${items.length}|${display.wrap}|${display.lines}|${grouped}`;
  const prevShape = useRef(shapeKey);
  if (prevShape.current !== shapeKey) {
    prevShape.current = shapeKey;
    heights.current = [];
  }

  const heightAt = (i: number) =>
    heights.current[i] ?? (items[i]?.kind === 'group' ? estGroup : estRow);

  // смещения считаем префиксной суммой — на четырёх сотнях элементов это
  // дешевле, чем держать отдельную структуру и её синхронизировать
  const offsets: number[] = new Array(items.length + 1);
  offsets[0] = 0;
  for (let i = 0; i < items.length; i++) offsets[i + 1] = offsets[i] + heightAt(i);
  const totalH = offsets[items.length];

  let from = 0;
  while (from < items.length && offsets[from + 1] < scrollTop) from++;
  let to = from;
  while (to < items.length && offsets[to] < scrollTop + viewport) to++;
  from = Math.max(0, from - OVERSCAN);
  to = Math.min(items.length, to + OVERSCAN);

  const padTop = offsets[from];
  const padBottom = Math.max(0, totalH - offsets[to]);

  // следим за прокруткой и размером окна прокрутки
  useEffect(() => {
    const root = tableRef.current;
    if (!root) return;
    // без «прореживания» через кадры анимации: событие прокрутки приходит
    // всегда, а кадры — нет (например, во вкладке, которую не показывают).
    // Рисуем мы теперь два десятка строк, так что обновление на каждое
    // событие дешевле, чем риск не обновиться вовсе.
    const onScroll = () => setScrollTop(root.scrollTop);
    const ro = new ResizeObserver(() => setViewport(root.clientHeight || 900));
    ro.observe(root);
    setViewport(root.clientHeight || 900);
    root.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      root.removeEventListener('scroll', onScroll);
      ro.disconnect();
    };
  }, []);

  // фактические высоты запоминаем: оценка нужна только до первого показа,
  // дальше список считается по настоящим размерам и прокрутка не «плывёт»
  useLayoutEffect(() => {
    const root = tableRef.current;
    if (!root) return;
    let changed = false;
    for (const el of root.querySelectorAll<HTMLElement>('[data-vi]')) {
      const i = Number(el.dataset.vi);
      const h = el.getBoundingClientRect().height;
      if (h > 0 && Math.abs((heights.current[i] ?? -1) - h) > 1) {
        heights.current[i] = h;
        changed = true;
      }
    }
    if (changed) setScrollTop((v) => v + 0.0001);
  });

  // reusable in-cell editor (used by both edit-in-place and the add-row line)
  const cellInput = (
    col: ColumnDef,
    value: string,
    onInput: (v: string) => void,
    opts: {
      autoFocus?: boolean;
      placeholder?: string;
      commitOnBlur?: boolean;
      onCommit?: () => void;
      onCancel?: () => void;
      /** commit a specific value in one gesture (badge pick), bypassing the
          draft state that onCommit reads. */
      onPick?: (v: string) => void;
      /** commit a value immediately WITHOUT leaving edit mode (tag picker: each
          toggle saves, the editor stays open for more). */
      onLive?: (v: string) => void;
    },
  ) => {
    // a checkbox commits on toggle — no separate «type then Enter» step
    if (col.type === 'checkbox') {
      return (
        <input
          className={styles.cellCheck}
          type="checkbox"
          autoFocus={opts.autoFocus}
          checked={isChecked(value)}
          onChange={(e) => { onInput(e.target.checked ? 'true' : ''); opts.onCommit?.(); }}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); opts.onCancel?.(); } }}
        />
      );
    }
    // A select cell with a known option set becomes a one-click picker: every
    // choice is shown up front as a badge, and a single click sets it — no
    // dropdown, no typing. This is what makes flipping a status (Режим) or a
    // stage (Стадия) effortless. `col.order` marks a closed vocabulary (only
    // those values); otherwise the options are the values already in the column,
    // plus a text field to enter a new one.
    if (col.type === 'select') {
      const options = [...new Set([...(col.order ?? []), ...distinct(records, col.key)])].filter(Boolean);
      if (options.length > 0) {
        const pick = (opt: string) => {
          if (opts.onPick) opts.onPick(opt);
          else { onInput(opt); opts.onCommit?.(); }
        };
        const pills = options.map((opt) => {
          const variant = col.badgeVariant?.[opt] ?? 'grey';
          const active = opt === value;
          return (
            <button
              key={opt}
              type="button"
              className={cx(styles.badge, styles[`badge_${variant}`], styles.badgeBtn, active && styles.badgeActive)}
              // commit on mousedown so it lands before any blur-to-cancel
              onMouseDown={(e) => { e.preventDefault(); pick(opt); }}
            >
              {opt}
            </button>
          );
        });
        // Always keep a text field alongside the badges — even for a closed
        // vocabulary (col.order) — so any value can be typed, not only the
        // preset ones. Pick a badge for the common case; type for anything else.
        return (
          <div className={styles.pick}>
            <div className={styles.pickOpts}>{pills}</div>
            <input
              className={styles.cellInput}
              autoFocus={opts.autoFocus}
              type="text"
              list={`dl-${col.key}`}
              placeholder={opts.placeholder}
              value={value}
              onChange={(e) => onInput(e.target.value)}
              onBlur={opts.commitOnBlur ? opts.onCommit : undefined}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); opts.onCommit?.(); }
                else if (e.key === 'Escape') { e.preventDefault(); opts.onCancel?.(); }
              }}
            />
          </div>
        );
      }
    }
    // multiselect: toggle several tags at once (each click adds/removes), and a
    // free text field to add any new tag. Stored comma-separated. Each toggle
    // saves immediately (onLive) — no separate «done» step; click away to close.
    if (col.type === 'multiselect') {
      const current = splitTags(value);
      const chosen = new Set(current);
      const options = [...new Set([...(col.order ?? []), ...distinct(records, col.key, true)])].filter(Boolean);
      const setTags = (tags: string[]) => (opts.onLive ?? onInput)([...new Set(tags.filter(Boolean))].join(', '));
      const toggle = (opt: string) => setTags(chosen.has(opt) ? current.filter((t) => t !== opt) : [...current, opt]);
      const addNew = (raw: string) => { const t = raw.trim(); if (t && !chosen.has(t)) setTags([...current, t]); };
      return (
        <div className={styles.pick}>
          <div className={styles.pickOpts}>
            {options.map((opt) => {
              const variant = col.badgeVariant?.[opt] ?? 'grey';
              const active = chosen.has(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  // mousedown + preventDefault so the badge toggles without
                  // stealing focus from the input (whose blur commits)
                  className={cx(styles.badge, styles[`badge_${variant}`], styles.badgeBtn, active && styles.badgeActive)}
                  onMouseDown={(e) => { e.preventDefault(); toggle(opt); }}
                >
                  {active ? '✓ ' : ''}{opt}
                </button>
              );
            })}
          </div>
          <input
            className={styles.cellInput}
            autoFocus={opts.autoFocus}
            type="text"
            list={`dl-${col.key}`}
            placeholder={opts.placeholder}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); addNew((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = ''; }
              else if (e.key === 'Escape' || e.key === 'Tab') { opts.onCommit?.(); }
            }}
          />
        </div>
      );
    }
    const inputType = col.type === 'date' ? 'date' : col.type === 'rating' || col.type === 'number' ? 'number' : 'text';
    return (
      <input
        className={styles.cellInput}
        autoFocus={opts.autoFocus}
        type={inputType}
        min={col.type === 'rating' ? 0 : undefined}
        max={col.type === 'rating' ? 5 : undefined}
        step={col.type === 'rating' ? 1 : undefined}
        placeholder={opts.placeholder}
        value={value}
        onChange={(e) => onInput(e.target.value)}
        onBlur={opts.commitOnBlur ? opts.onCommit : undefined}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); opts.onCommit?.(); }
          else if (e.key === 'Escape') { e.preventDefault(); opts.onCancel?.(); }
        }}
      />
    );
  };

  const searchEl = onSearchChange && (
    <input
      type="search"
      className={styles.search}
      aria-label={S.searchAria}
      placeholder={S.searchPlaceholder}
      value={search ?? ''}
      onChange={(e) => onSearchChange(e.target.value)}
    />
  );

  const filterEls = filterables.map((c) => (
    <label key={c.key} className={sidebar ? styles.sideFilter : styles.filter}>
      {sidebar ? <span className={styles.sideFilterLabel}>{c.label}</span> : `${c.label}:`}
      <select
        className={styles.select}
        aria-label={S.filterAria(c.label)}
        value={filterMap[c.key] ?? ''}
        onChange={(e) => setFilter(c.key, e.target.value)}
      >
        <option value="">{S.filterAll}</option>
        {(filterOptions?.[c.key] ?? distinct(records, c.key, c.type === 'multiselect')).map((v) => (
          <option key={v} value={v}>{v}</option>
        ))}
      </select>
    </label>
  ));

  const resetEl = isFiltered && (
    <button type="button" className={styles.reset} onClick={resetAll}>
      {S.reset}
    </button>
  );

  // «только избранные» + сброс сортировки/группировки
  const favEl = onFavoritesOnlyChange && (
    <label className={styles.favOnly}>
      <input
        type="checkbox"
        className={styles.favInput}
        checked={Boolean(favoritesOnly)}
        onChange={(e) => onFavoritesOnlyChange(e.target.checked)}
      />
      <span className={styles.favStar} aria-hidden="true" />
      {S.favoritesOnly}
    </label>
  );

  const sortResetEl = onSortReset && levels.length > 0 && (
    <button type="button" className={styles.reset} onClick={onSortReset}>
      {S.clearSort}
    </button>
  );

  // фильтры слева — не постоянной колонкой, а выпадашкой «Фильтры»: кнопка со
  // счётчиком активных, панель с теми же селектами раскрывается поверх таблицы.
  const activeFilterCount = Object.values(filterMap).filter((v) => v !== '' && v != null).length;
  const filtersEl = (filterables.length > 0 || onFavoritesOnlyChange) && (
    <div className={styles.viewMenu}>
      <button
        type="button"
        className={styles.viewBtn}
        aria-expanded={filtersOpen}
        onClick={() => setFiltersOpen((o) => !o)}
        title={S.filtersHead}
      >
        ⛃ {S.filtersHead}
        {activeFilterCount > 0 && <span className={styles.viewFoldCount}>{activeFilterCount}</span>}
      </button>
      {filtersOpen && (
        <>
          <div className={styles.viewBackdrop} onClick={() => setFiltersOpen(false)} aria-hidden="true" />
          <div
            className={styles.filtersPanel}
            role="dialog"
            aria-label={S.filtersHead}
            onKeyDown={(e) => { if (e.key === 'Escape') setFiltersOpen(false); }}
          >
            {filterEls}
            {favEl && <div className={styles.favInFilters}>{favEl}</div>}
          </div>
        </>
      )}
    </div>
  );

  // «Сортировка/Группировка» — explicit multi-level panel (Google-Sheets style):
  // pick columns, asc/desc per level, reorder, add/remove. Levels double as
  // grouping levels when autoGroup is on.
  const sortableCols = gridCols;
  const setLevels = (next: SortState[]) => onSortsSet?.(next.slice(0, 3));
  const patchLevel = (i: number, patch: Partial<SortState>) => setLevels(levels.map((lv, j) => (j === i ? { ...lv, ...patch } : lv)));
  const moveLevel = (i: number, d: number) => { const n = [...levels]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; setLevels(n); };
  const removeLevel = (i: number) => setLevels(levels.filter((_, j) => j !== i));
  const addLevel = () => { const used = new Set(levels.map((l) => l.key)); const free = sortableCols.find((c) => !used.has(c.key)); if (free) setLevels([...levels, { key: free.key, dir: 'asc' }]); };
  // group-by list (separate from sort), when the host wires onGroupBySet
  const gKeys = groupBy ?? [];
  const setGroups = (ks: string[]) => onGroupBySet?.(ks.slice(0, 3));
  const patchGroup = (i: number, key: string) => setGroups(gKeys.map((k, j) => (j === i ? key : k)));
  const moveGroup = (i: number, d: number) => { const n = [...gKeys]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; setGroups(n); };
  const removeGroup = (i: number) => setGroups(gKeys.filter((_, j) => j !== i));
  const addGroup = () => { const used = new Set(gKeys); const free = sortableCols.find((c) => !used.has(c.key)); if (free) setGroups([...gKeys, free.key]); };

  const sortEl = onSortsSet && (
    <div className={styles.viewMenu}>
      <button type="button" className={styles.viewBtn} aria-expanded={sortOpen} onClick={() => setSortOpen((o) => !o)} title={S.sortPanelTitle}>
        ⇅ {S.sortPanel}{levels.length ? ` · ${levels.length}` : ''}
      </button>
      {sortOpen && (
        <>
          <div className={styles.viewBackdrop} onClick={() => setSortOpen(false)} aria-hidden="true" />
          <div className={styles.viewPanel} role="dialog" aria-label={S.sortPanel} onKeyDown={(e) => { if (e.key === 'Escape') setSortOpen(false); }}>
            {onGroupBySet && (
              <>
                <div className={styles.viewHead}>{S.groupHead}</div>
                {gKeys.length === 0 && <div className={styles.viewNote}>{S.groupEmpty}</div>}
                {gKeys.map((k, i) => (
                  <div key={i} className={styles.sortRow}>
                    <span className={styles.sortIdx}>{i + 1}</span>
                    <select className={styles.sortSel} value={k} onChange={(e) => patchGroup(i, e.target.value)}>
                      {sortableCols.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </select>
                    <button type="button" className={styles.sortIco} disabled={i === 0} title={S.sortUp} onClick={() => moveGroup(i, -1)}>↑</button>
                    <button type="button" className={styles.sortIco} disabled={i === gKeys.length - 1} title={S.sortDown} onClick={() => moveGroup(i, 1)}>↓</button>
                    <button type="button" className={styles.sortIco} title={S.sortRemove} onClick={() => removeGroup(i)}>×</button>
                  </div>
                ))}
                {gKeys.length < 3 && gKeys.length < sortableCols.length && (
                  <button type="button" className={styles.viewChip} onClick={addGroup}>+ {S.groupAddLevel}</button>
                )}
              </>
            )}
            <div className={styles.viewHead}>{onGroupBySet ? S.sortByHead : S.sortPanel}</div>
            {levels.length === 0 && <div className={styles.viewNote}>{S.sortEmpty}</div>}
            {levels.map((lv, i) => (
              <div key={i} className={styles.sortRow}>
                <span className={styles.sortIdx}>{i + 1}</span>
                <select className={styles.sortSel} value={lv.key} onChange={(e) => patchLevel(i, { key: e.target.value })}>
                  {sortableCols.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
                <button type="button" className={styles.sortChip} onClick={() => patchLevel(i, { dir: lv.dir === 'desc' ? 'asc' : 'desc' })}>
                  {lv.dir === 'desc' ? S.sortDesc : S.sortAsc}
                </button>
                <button type="button" className={styles.sortIco} disabled={i === 0} title={S.sortUp} onClick={() => moveLevel(i, -1)}>↑</button>
                <button type="button" className={styles.sortIco} disabled={i === levels.length - 1} title={S.sortDown} onClick={() => moveLevel(i, 1)}>↓</button>
                <button type="button" className={styles.sortIco} title={S.sortRemove} onClick={() => removeLevel(i)}>×</button>
              </div>
            ))}
            {levels.length < 3 && levels.length < sortableCols.length && (
              <button type="button" className={styles.viewChip} onClick={addLevel}>+ {S.sortAddLevel}</button>
            )}
            {(levels.length > 0 || gKeys.length > 0) && (
              <button type="button" className={styles.viewLink} onClick={() => { setLevels([]); onGroupBySet?.([]); }}>{S.sortReset}</button>
            )}
          </div>
        </>
      )}
    </div>
  );

  // «Вид» — перенос текста, высота строки, сброс ширин. Одна кнопка, чтобы
  // не растягивать панель: раскрывается панелькой поверх таблицы.
  const displayEl = (
    <div className={styles.viewMenu}>
      <button
        type="button"
        className={styles.viewBtn}
        aria-expanded={viewOpen}
        onClick={() => setViewOpen((o) => !o)}
        title={S.viewButtonTitle}
      >
        ▤ {S.viewButton}
      </button>
      {viewOpen && (
        <>
          <div className={styles.viewBackdrop} onClick={() => setViewOpen(false)} aria-hidden="true" />
          <div
            className={styles.viewPanel}
            role="dialog"
            aria-label={S.viewDialogAria}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setViewOpen(false);
            }}
          >
            <div className={styles.viewHead}>{S.wrapHead}</div>
            {WRAP_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                className={cx(styles.viewOpt, display.wrap === m.id && styles.viewOptOn)}
                onClick={() => setWrap(m.id)}
              >
                <span className={styles.viewOptName}>{m.label}</span>
                <span className={styles.viewOptHint}>{m.hint}</span>
              </button>
            ))}

            <div className={styles.viewHead}>{S.rowHeightHead}</div>
            <div className={styles.viewRow}>
              {LINE_MODES.map((m) => (
                <button
                  key={String(m.id)}
                  type="button"
                  className={cx(styles.viewChip, display.lines === m.id && styles.viewChipOn)}
                  disabled={display.wrap !== 'wrap'}
                  onClick={() => setLines(m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {display.wrap !== 'wrap' && (
              <div className={styles.viewNote}>{S.rowHeightNote}</div>
            )}

            <div className={styles.viewHead}>{S.columnsHead}</div>
            {allCols.map((c) => (
              <label key={c.key} className={styles.viewToggle}>
                <input
                  type="checkbox"
                  checked={!hiddenKeys.includes(c.key)}
                  disabled={!hiddenKeys.includes(c.key) && gridCols.length <= 1}
                  onChange={() => toggleHidden(c.key)}
                />
                {c.label}
              </label>
            ))}

            <label className={styles.viewToggle}>
              <input
                type="checkbox"
                checked={!!display.freezeFirst}
                onChange={(e) => setDisplay((d) => ({ ...d, freezeFirst: e.target.checked }))}
              />
              {S.freezeFirstLabel}
            </label>
            <label className={styles.viewToggle}>
              <input
                type="checkbox"
                checked={!!display.cellColors}
                onChange={(e) => setDisplay((d) => ({ ...d, cellColors: e.target.checked }))}
              />
              {S.cellColorsLabel}
            </label>
            <label className={styles.viewToggle}>
              <input
                type="checkbox"
                checked={!!display.footer}
                onChange={(e) => setDisplay((d) => ({ ...d, footer: e.target.checked }))}
              />
              {S.footerLabel}
            </label>

            {autoGroup && (
              <>
                <label className={styles.viewToggle}>
                  <input
                    type="checkbox"
                    checked={!!display.groupColors}
                    onChange={(e) => setDisplay((d) => ({ ...d, groupColors: e.target.checked }))}
                  />
                  {S.groupColorsLabel}
                </label>
                {/* колонок бывает дюжина, и списком они растягивают панель на
                    весь экран — держим свёрнутыми, раскрывая по требованию */}
                <button
                  type="button"
                  className={styles.viewFold}
                  aria-expanded={aggOpen}
                  onClick={() => setAggOpen((o) => !o)}
                >
                  <span className={styles.viewFoldCaret} aria-hidden="true">{aggOpen ? '▾' : '▸'}</span>
                  {S.aggFold}
                  {aggCount > 0 && <span className={styles.viewFoldCount}>{aggCount}</span>}
                </button>
                {aggOpen && gridCols.map((c) => (
                  <label key={c.key} className={styles.viewAggRow}>
                    <span className={styles.viewAggName}>{c.label}</span>
                    <select
                      className={styles.viewAggSelect}
                      value={display.aggregates[c.key] ?? 'none'}
                      onChange={(e) => setAgg(c.key, e.target.value as AggKind)}
                    >
                      {AGG_MODES.filter((m) => !m.numeric || c.type === 'number').map((m) => (
                        <option key={m.id} value={m.id}>{m.label}</option>
                      ))}
                    </select>
                  </label>
                ))}
                {aggOpen && (
                  <div className={styles.viewNote}>{S.aggNote}</div>
                )}
              </>
            )}

            <div className={styles.viewHead}>{S.widthHead}</div>
            <div className={styles.viewRow}>
              <button type="button" className={styles.viewChip} onClick={fitAllWidths}>
                {S.fitAllContent}
              </button>
              <button type="button" className={styles.viewChip} onClick={shrinkAllWidths}>
                {S.shrinkAllContent}
              </button>
            </div>
            {sizedCols && (
              <button type="button" className={styles.viewLink} onClick={resetWidths}>
                {S.autoWidthLink}
              </button>
            )}
            <div className={styles.viewNote}>{S.widthNote}</div>
          </div>
        </>
      )}
    </div>
  );

  const countEl = (
    <span className={styles.count}>
      {isFiltered ? S.shownOf(records.length, grandTotal) : S.countRecords(grandTotal)}
    </span>
  );

  const tableEl = (
    <div className={cx(styles.tableScroll, sizedCols && styles.sized)} ref={tableRef}>
      <div className={cx(styles.table, editable && styles.compact)} style={gridStyle} role="table">
          <div className={cx(styles.tableHead, freezeClass)} style={freezeVars} role="row">
            {canReorderRows && <div className={styles.caretCell} aria-hidden="true" />}
            <div className={styles.caretCell} aria-hidden="true" />
            {canFavorite && <div className={styles.caretCell} aria-hidden="true" />}
            {showRowDelete && <div className={styles.caretCell} aria-hidden="true" />}
            {gridCols.map((c, ci) => {
              const levelIdx = levels.findIndex((l) => l.key === c.key);
              const active = levelIdx >= 0;
              return (
                <div
                  key={c.key}
                  role="columnheader"
                  className={cx(
                    styles.th,
                    ci === 0 && styles.firstCol,
                    isCentered(c) && styles.center,
                    dragCol === c.key && styles.thDragging,
                    dropCol === c.key && styles.thDropTarget,
                  )}
                  draggable={editableColumns && !colRename}
                  onDragStart={editableColumns ? () => setDragCol(c.key) : undefined}
                  onDragOver={editableColumns ? (e) => { e.preventDefault(); if (dragCol && dragCol !== c.key) setDropCol(c.key); } : undefined}
                  onDragEnd={editableColumns ? () => { setDragCol(null); setDropCol(null); } : undefined}
                  onDrop={editableColumns ? (e) => {
                    e.preventDefault();
                    if (dragCol && dragCol !== c.key) {
                      const keys = gridCols.map((g) => g.key).filter((k) => k !== dragCol);
                      const at = keys.indexOf(c.key);
                      keys.splice(at, 0, dragCol);
                      onColumnsReorder?.(keys);
                    }
                    setDragCol(null); setDropCol(null);
                  } : undefined}
                >
                  {/* подпись клипуем отдельным слоем: сама ячейка обязана
                      остаться overflow: visible, иначе ручку ширины срежет
                      по её же краю */}
                  <span className={styles.thLabel}>
                    {colRename?.key === c.key ? (
                      <input
                        className={styles.colRenameInput}
                        autoFocus
                        value={colRename.draft}
                        onChange={(e) => setColRename({ key: c.key, draft: e.target.value })}
                        onBlur={() => {
                          const v = colRename.draft.trim();
                          if (v && v !== c.label) onColumnRename?.(c.key, v);
                          setColRename(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
                          else if (e.key === 'Escape') { e.preventDefault(); setColRename(null); }
                        }}
                      />
                    ) : c.sortable ? (
                      <button
                        type="button"
                        className={styles.colHead}
                        data-active={active || undefined}
                        onClick={(e) =>
                          onSortsChange
                            ? onSortsChange(c.key, e.shiftKey || e.ctrlKey || e.metaKey)
                            : onSortChange(c.key)
                        }
                        title={S.sortHeaderTitle}
                      >
                        {c.label}
                        <span className={styles.arrow}>
                          {levelIdx >= 0 ? (levels[levelIdx].dir === 'asc' ? '▲' : '▼') : ''}
                          {levels.length > 1 && levelIdx >= 0 ? (
                            <sup className={styles.levelNum}>{levelIdx + 1}</sup>
                          ) : null}
                        </span>
                      </button>
                    ) : (
                      c.label
                    )}
                  </span>

                  {editableColumns && !colRename && (
                    <button
                      type="button"
                      className={styles.colMenuBtn}
                      aria-label={S.colMenuAria(c.label)}
                      aria-expanded={colMenu === c.key}
                      onClick={() => setColMenu(colMenu === c.key ? null : c.key)}
                    >
                      ▾
                    </button>
                  )}
                  {colMenu === c.key && (
                    <div className={styles.colMenuPanel} role="menu">
                      <button type="button" className={styles.colMenuItem} onClick={() => { setColRename({ key: c.key, draft: c.label }); setColMenu(null); }}>
                        {S.rename}
                      </button>
                      <div className={styles.colMenuHead}>{S.typeHead}</div>
                      {COLUMN_TYPES.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          className={cx(styles.colMenuItem, c.type === t.id && styles.colMenuItemOn)}
                          onClick={() => doRetype(c.key, t.id)}
                        >
                          {t.label}{c.type === t.id ? ' ✓' : ''}
                        </button>
                      ))}
                      <div className={styles.colMenuHead}>{S.widthHead}</div>
                      <button type="button" className={styles.colMenuItem} onClick={() => { fitWidth(c.key, ci); setColMenu(null); }}>
                        {S.fitContent}
                      </button>
                      {display.widths[c.key] && (
                        <button type="button" className={styles.colMenuItem} onClick={() => { resetWidth(c.key); setColMenu(null); }}>
                          {S.resetWidth}
                        </button>
                      )}
                      {c.type === 'number' && onColumnFormat && (() => {
                        const fmt = c.numberFormat ?? {};
                        const style = fmt.style ?? 'plain';
                        const decimals = fmt.decimals ?? 0;
                        const opts: Array<{ id: NumberFormat['style']; label: string }> = [
                          { id: 'plain', label: S.numFmtPlain },
                          { id: 'thousands', label: S.numFmtThousands },
                          { id: 'currency', label: S.numFmtCurrency },
                          { id: 'percent', label: S.numFmtPercent },
                        ];
                        return (
                          <>
                            <div className={styles.colMenuHead}>{S.numFormatHead}</div>
                            {opts.map((o) => (
                              <button
                                key={o.id}
                                type="button"
                                className={cx(styles.colMenuItem, style === o.id && styles.colMenuItemOn)}
                                onClick={() => onColumnFormat(c.key, { style: o.id, decimals, currency: fmt.currency })}
                              >
                                {o.label}{style === o.id ? ' ✓' : ''}
                              </button>
                            ))}
                            <div className={styles.colMenuHead}>{S.numDecimalsHead}</div>
                            <div className={styles.colMenuDecimals}>
                              {[0, 1, 2, 3].map((d) => (
                                <button
                                  key={d}
                                  type="button"
                                  className={cx(styles.colMenuDecBtn, decimals === d && styles.colMenuItemOn)}
                                  onClick={() => onColumnFormat(c.key, { style, decimals: d, currency: fmt.currency })}
                                >
                                  {d}
                                </button>
                              ))}
                            </div>
                            <button
                              type="button"
                              className={cx(styles.colMenuItem, (display.heatmap ?? []).includes(c.key) && styles.colMenuItemOn)}
                              onClick={() => { toggleHeatmap(c.key); setColMenu(null); }}
                            >
                              {S.heatmapLabel}{(display.heatmap ?? []).includes(c.key) ? ' ✓' : ''}
                            </button>
                          </>
                        );
                      })()}
                      <button type="button" className={styles.colMenuItem} disabled={gridCols.length <= 1} onClick={() => { toggleHidden(c.key); setColMenu(null); }}>
                        {S.hideColumn}
                      </button>
                      <button
                        type="button"
                        className={cx(styles.colMenuItem, styles.colMenuDanger)}
                        disabled={gridCols.length <= 1}
                        onClick={() => {
                          if (window.confirm(S.deleteColumnConfirm(c.label))) {
                            onColumnDelete?.(c.key);
                          }
                          setColMenu(null);
                        }}
                      >
                        {S.deleteColumn}
                      </button>
                    </div>
                  )}

                  <span
                    className={styles.resizer}
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={S.resizerAria(c.label)}
                    title={S.resizerTitle}
                    onPointerDown={(e) => startResize(e, c.key)}
                  />
                </div>
              );
            })}
            {editableColumns && (
              <div className={styles.thAdd} role="columnheader">
                {addingCol ? (
                  <div className={styles.colAddForm}>
                    <input
                      className={styles.colRenameInput}
                      autoFocus
                      placeholder={S.addColNamePlaceholder}
                      value={newCol.label}
                      onChange={(e) => setNewCol((n) => ({ ...n, label: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newCol.label.trim()) {
                          onColumnAdd?.({ label: newCol.label.trim(), type: newCol.type });
                          setNewCol({ label: '', type: 'text' }); setAddingCol(false);
                        } else if (e.key === 'Escape') { setAddingCol(false); }
                      }}
                    />
                    <select
                      className={styles.colAddType}
                      value={newCol.type}
                      onChange={(e) => setNewCol((n) => ({ ...n, type: e.target.value as ColumnType }))}
                    >
                      {COLUMN_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </select>
                    <button
                      type="button"
                      className={styles.colAddOk}
                      disabled={!newCol.label.trim()}
                      onClick={() => {
                        onColumnAdd?.({ label: newCol.label.trim(), type: newCol.type });
                        setNewCol({ label: '', type: 'text' }); setAddingCol(false);
                      }}
                    >
                      {S.ok}
                    </button>
                  </div>
                ) : (
                  <button type="button" className={styles.colAddBtn} title={S.addColumnAria} onClick={() => setAddingCol(true)}>
                    +
                  </button>
                )}
              </div>
            )}
          </div>

          {loading && records.length === 0 ? (
            Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className={styles.row} aria-hidden="true">
                {canReorderRows && <div className={styles.caretCell} />}
                <div className={styles.caretCell} />
                {canFavorite && <div className={styles.caretCell} />}
                {showRowDelete && <div className={styles.caretCell} />}
                {gridCols.map((c) => (
                  <div key={c.key} className={cx(styles.td, isCentered(c) && styles.center)}>
                    <span className={styles.skel} style={{ width: `${50 + ((i * 7 + c.key.length * 5) % 45)}%` }} />
                  </div>
                ))}
              </div>
            ))
          ) : records.length === 0 ? (
            isFiltered ? (
              // narrowed by a filter/search to nothing
              <div className={styles.none}>{S.nothingFound}</div>
            ) : (
              // the base itself has no rows yet
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon} aria-hidden="true">🗒️</div>
                <div className={styles.emptyTitle}>{S.emptyTitle}</div>
                {editable && onAddRow ? (
                  <button type="button" className={styles.emptyBtn} onClick={() => onAddRow({})}>{S.emptyHint}</button>
                ) : (
                  <div className={styles.emptyHintText}>{S.emptyHint}</div>
                )}
              </div>
            )
          ) : (
            <>
            {grouped && (
              <div className={styles.groupBar} role="row">
                <button
                  type="button"
                  className={styles.groupBarBtn}
                  onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(allPaths))}
                >
                  {allCollapsed ? S.expandAll : S.collapseAll}
                </button>
                <span className={styles.groupBarInfo}>
                  {S.groupingBy(levelsLabel, groups.length)}
                </span>
                {levels.length < 3 && (
                  <span className={styles.groupBarHint}>
                    {S.groupingHint}
                  </span>
                )}
              </div>
            )}
            {/* распорки держат высоту прокрутки за невидимые строки */}
            {padTop > 0 && <div style={{ height: padTop }} aria-hidden="true" />}
            {items.slice(from, to).map((it, k) => {
              const i = from + k;
              return it.kind === 'group'
                ? renderGroupHead(it.node, i)
                : renderRow(it.row, i, it.path);
            })}
            {padBottom > 0 && <div style={{ height: padBottom }} aria-hidden="true" />}
            </>
          )}

          {editable && !loading && (
            <div className={cx(styles.row, styles.addRow)} role="row">
              {canReorderRows && <div className={styles.caretCell} />}
              {/* a real button: click adds the row straight away (an empty one
                  if nothing was typed), so you don't have to discover Enter */}
              <button
                type="button"
                className={cx(styles.caretCell, styles.addRowBtn)}
                title={S.addRowTitle}
                aria-label={S.addRowTitle}
                onClick={() => { onAddRow?.(addDraft); setAddDraft({}); }}
              >
                +
              </button>
              {canFavorite && <div className={styles.caretCell} />}
              {showRowDelete && <div className={styles.caretCell} />}
              {gridCols.map((c) => (
                <div key={c.key} className={cx(styles.td, isCentered(c) && styles.center)}>
                  {cellInput(
                    c,
                    addDraft[c.key] ?? '',
                    (v) => setAddDraft((d) => ({ ...d, [c.key]: v })),
                    // picking a badge on the add-row just fills the draft; the
                    // row is created by the + button / Enter, as with typing
                    { placeholder: c.label, onCommit: commitAdd, onPick: (v) => setAddDraft((d) => ({ ...d, [c.key]: v })) },
                  )}
                </div>
              ))}
            </div>
          )}

          {display.footer && !loading && (
            <div className={cx(styles.row, styles.footerRow, freezeClass)} style={freezeVars} role="row">
              {canReorderRows && <div className={styles.caretCell} />}
              <div className={styles.caretCell} />
              {canFavorite && <div className={styles.caretCell} />}
              {showRowDelete && <div className={styles.caretCell} />}
              {gridCols.map((c, i) => {
                let content = '';
                let title: string | undefined;
                if (i === 0) {
                  content = String(displayRecords.length);
                } else if (c.type === 'number') {
                  const kind = display.aggregates[c.key] ?? 'sum';
                  content = aggregate(displayRecords, c.key, kind, S) ?? '';
                  title = kind;
                } else if (display.aggregates[c.key]) {
                  content = aggregate(displayRecords, c.key, display.aggregates[c.key], S) ?? '';
                }
                return (
                  <div key={c.key} className={cx(styles.td, styles.footerCell, isCentered(c) && styles.center)} title={title}>
                    {content}
                  </div>
                );
              })}
            </div>
          )}
      </div>

      {selStats && (
        <div className={styles.selBar} role="status">
          <span>{S.selCellsLabel} <b>{selStats.count}</b></span>
          {selStats.nums > 0 && (
            <>
              <span>{S.aggSum} <b>{Number.isInteger(selStats.sum) ? selStats.sum : selStats.sum.toFixed(2)}</b></span>
              <span>{S.aggAvg} <b>{(() => { const a = selStats.sum / selStats.nums; return Number.isInteger(a) ? a : a.toFixed(2); })()}</b></span>
            </>
          )}
        </div>
      )}

      {ctxMenu && (
        <div
          className={styles.ctxMenu}
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          role="menu"
          // не даём событию закрыть меню раньше, чем отработает пункт
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button type="button" className={styles.ctxItem} onClick={() => { if (onSortsSet) onSortsSet([{ key: ctxMenu.col, dir: 'asc' }]); else onSortChange(ctxMenu.col); setCtxMenu(null); }}>
            {S.menuSortAsc}
          </button>
          <button type="button" className={styles.ctxItem} onClick={() => { if (onSortsSet) onSortsSet([{ key: ctxMenu.col, dir: 'desc' }]); else onSortChange(ctxMenu.col); setCtxMenu(null); }}>
            {S.menuSortDesc}
          </button>
          <div className={styles.ctxSep} />
          <button
            type="button"
            className={cx(styles.ctxItem, ctxMenu.cols.every((k) => (display.bold ?? []).includes(k)) && styles.ctxItemOn)}
            onClick={() => { applyBold(ctxMenu.cols); setCtxMenu(null); }}
          >
            {S.menuBold}{ctxMenu.cols.every((k) => (display.bold ?? []).includes(k)) ? ' ✓' : ''}
          </button>
          <div className={styles.ctxHead}>{S.menuFontHead}</div>
          <div className={styles.ctxFont}>
            <button type="button" className={styles.ctxFontBtn} onClick={() => { applyFontScale(ctxMenu.cols, 0.85); setCtxMenu(null); }}>{S.menuFontSmall}</button>
            <button type="button" className={styles.ctxFontBtn} onClick={() => { applyFontScale(ctxMenu.cols, 1); setCtxMenu(null); }}>{S.menuFontNormal}</button>
            <button type="button" className={styles.ctxFontBtn} onClick={() => { applyFontScale(ctxMenu.cols, 1.15); setCtxMenu(null); }}>{S.menuFontLarge}</button>
          </div>
          <div className={styles.ctxSep} />
          <button type="button" className={styles.ctxItem} disabled={gridCols.length <= 1} onClick={() => { toggleHidden(ctxMenu.col); setCtxMenu(null); }}>
            {S.hideColumn}
          </button>
        </div>
      )}

      {editable &&
        gridCols
          .filter((c) => c.type === 'select' || c.type === 'multiselect')
          .map((c) => (
            <datalist key={c.key} id={`dl-${c.key}`}>
              {(filterOptions?.[c.key] ?? distinct(records, c.key, c.type === 'multiselect')).map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
          ))}
    </div>
  );

  // все строки ветки, включая вложенные — итог у родителя должен считаться
  // по всему, что под ним, а не по тому, что лежит прямо в нём
  function rowsOf(g: GroupNode): Row[] {
    return g.children ? g.children.flatMap(rowsOf) : g.rows;
  }

  // Заголовок группы. Вложенные узлы и строки больше не рисуются отсюда —
  // порядок задаёт плоский список, из которого берётся видимое окно.
  function renderGroupHead(g: GroupNode, index: number) {
    const isCollapsed = collapsed.has(g.path);
    const aggKeys = Object.keys(display.aggregates);
    const totals = aggKeys.length
      ? aggKeys
          .map((key) => {
            const col = columns.find((c) => c.key === key);
            const value = aggregate(rowsOf(g), key, display.aggregates[key], S);
            return value === null ? null : { label: col?.label ?? key, value };
          })
          .filter(Boolean)
      : [];
    // when colouring is on, tint the header by its value and mark it with a
    // colour bar on the left; the tint is a low-alpha mix so both themes stay legible
    const colorStyle: CSSProperties = display.groupColors
      ? {
          background: `color-mix(in srgb, hsl(${groupHue(g.value)} 70% 50%) 13%, transparent)`,
          boxShadow: `inset 3px 0 0 hsl(${groupHue(g.value)} 65% 48%)`,
        }
      : {};
    return (
      <div
        key={g.path}
        data-vi={index}
        className={cx(styles.groupRow, styles[`groupDepth${g.depth}`])}
        role="row"
        style={{ paddingLeft: `${14 + g.depth * 18}px`, ...colorStyle, ...(accent ? { ['--accent']: accent } as CSSProperties : {}) }}
      >
          <button
            type="button"
            className={styles.groupToggle}
            onClick={() => toggleGroup(g.path)}
            aria-expanded={!isCollapsed}
            title={isCollapsed ? S.expandGroup : S.collapseGroup}
          >
            {isCollapsed ? '+' : '−'}
          </button>
          <span className={styles.groupLabel}>{g.label}:</span>
          <span className={styles.groupValue}>{g.value}</span>
          {totals.map((t) => (
            <span key={t!.label} className={styles.groupAgg}>
              {t!.label} <b>{t!.value}</b>
            </span>
          ))}
        <span className={styles.groupCount}>{g.count}</span>
      </div>
    );
  }

  // отрисовка одной строки таблицы (плоский и групповой вид)
  // перетащили строку sourceId и бросили на targetId (ниже её середины → below)
  function performReorder(sourceId: string, targetId: string, below: boolean) {
    if (sourceId === targetId) return;
    const ids = orderedRecords.map((r) => String(r.id));
    const from = ids.indexOf(sourceId);
    if (from < 0) return;
    ids.splice(from, 1);
    let to = ids.indexOf(targetId);
    if (to < 0) return;
    if (below) to += 1;
    ids.splice(to, 0, sourceId);
    setLocalOrder(ids); // оптимистично — строка встаёт на место сразу
    onRowReorder!(ids);
  }

  function renderRow(r: Row, index: number, groupPath = '') {
    const dragging = canReorderRows && dragRow === String(r.id);
    const dropHere = canReorderRows && overRow?.id === String(r.id) && dragRow !== String(r.id);
    return (
      <div
        key={groupPath ? `${groupPath} :: ${r.id}` : String(r.id)}
        data-vi={index}
        className={cx(
          styles.row,
          rowsClickable && styles.clickable,
          freezeClass,
          String(r.id) === openRow && styles.rowOpen,
          dragging && styles.rowDragging,
          dropHere && (overRow!.below ? styles.dropBelow : styles.dropAbove),
        )}
        style={freezeVars}
        role={rowsClickable ? "button" : "row"}
        onDragOver={
          canReorderRows && dragRow
            ? (e) => {
                e.preventDefault();
                const rect = e.currentTarget.getBoundingClientRect();
                const below = e.clientY > rect.top + rect.height / 2;
                if (overRow?.id !== String(r.id) || overRow?.below !== below) setOverRow({ id: String(r.id), below });
              }
            : undefined
        }
        onDrop={
          canReorderRows && dragRow
            ? (e) => {
                e.preventDefault();
                const rect = e.currentTarget.getBoundingClientRect();
                const below = e.clientY > rect.top + rect.height / 2;
                performReorder(dragRow, String(r.id), below);
                setDragRow(null);
                setOverRow(null);
              }
            : undefined
        }
        tabIndex={rowsClickable ? 0 : undefined}
        onClick={rowsClickable ? () => onRowOpen!(r) : undefined}
        onKeyDown={
          rowsClickable
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onRowOpen!(r);
                }
              }
            : undefined
        }
      >
        {canReorderRows && (
          <div className={styles.caretCell}>
            {/* ручка перетаскивания: тащим только за неё, чтобы правка ячеек
                и раскрытие карточки продолжали работать */}
            <span
              className={styles.dragHandle}
              draggable
              title={S.dragRow}
              aria-label={S.dragRow}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(r.id));
                setDragRow(String(r.id));
              }}
              onDragEnd={() => { setDragRow(null); setOverRow(null); }}
            >
              ⠿
            </span>
          </div>
        )}
        {recordCard ? (
          <div className={styles.caretCell}>
            {/* раскрыть строку целиком — отдельной кнопкой, чтобы правка
                ячеек в таблице продолжала работать как раньше */}
            <button
              type="button"
              className={styles.expand}
              title={S.expandRecord}
              onClick={(e) => {
                e.stopPropagation();
                setOpenRow(r.id);
              }}
              onKeyDown={(e) => e.stopPropagation()}
            >
              ⤢
            </button>
          </div>
        ) : (
          <div className={styles.caretCell} aria-hidden="true">{rowsClickable ? "›" : ""}</div>
        )}
        {canFavorite && (
          <div className={styles.caretCell}>
            <button
              type="button"
              className={cx(styles.star, favSet.has(r.id) && styles.starOn)}
              title={favSet.has(r.id) ? S.removeFromFav : S.addToFav}
              aria-pressed={favSet.has(r.id)}
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite!(r);
              }}
              onKeyDown={(e) => e.stopPropagation()}
            >
              {favSet.has(r.id) ? '★' : '☆'}
            </button>
          </div>
        )}
        {editable && onDeleteRow && (
          <div className={styles.caretCell}>
            <button
              type="button"
              className={styles.rowDelete}
              title={S.deleteRow}
              aria-label={S.deleteRow}
              onClick={(e) => {
                e.stopPropagation();
                onDeleteRow(r);
              }}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 6h18" />
                <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
                <path d="M6 6v14a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6" />
                <path d="M10 11v6M14 11v6" />
              </svg>
            </button>
          </div>
        )}
        {gridCols.map((c, i) => {
          const editingThis = editable && editing?.id === r.id && editing?.key === c.key;
          const selected = selectable && !editingThis && inSel(index, i);
          const cellStyle: CSSProperties = editingThis ? {} : { background: heatBg(heatStats, c.key, r[c.key]) };
          if ((display.bold ?? []).includes(c.key)) cellStyle.fontWeight = 700;
          const fs = display.fontScale?.[c.key];
          if (fs) cellStyle.fontSize = `${fs}em`;
          if (selected && selRect) {
            // синий диапазон с рамкой по краям прямоугольника — как в Google Таблицах
            const edges: string[] = [];
            if (index === selRect.r0) edges.push('inset 0 2px 0 0 var(--sel, #1a73e8)');
            if (index === selRect.r1) edges.push('inset 0 -2px 0 0 var(--sel, #1a73e8)');
            if (i === selRect.c0) edges.push('inset 2px 0 0 0 var(--sel, #1a73e8)');
            if (i === selRect.c1) edges.push('inset -2px 0 0 0 var(--sel, #1a73e8)');
            cellStyle.background = 'var(--sel-fill, rgba(26,115,232,0.12))';
            if (edges.length) cellStyle.boxShadow = edges.join(', ');
          }
          return (
            <div
              key={c.key}
              role="cell"
              className={cx(
                styles.td,
                i === 0 && styles.firstCol,
                editingThis ? styles.wrapCell : cellMode(r, i),
                c.key === firstKey && styles.strong,
                isCentered(c) && styles.center,
                editable && styles.editableTd,
                selected && styles.selCell,
              )}
              style={cellStyle}
              // stop the click bubbling to the row's onRowOpen — otherwise
              // starting an edit (or clicking a tag/select option while editing)
              // also opens the record page and throws the editor away
              ref={editingThis ? editingCellRef : undefined}
              onPointerDown={selectable && !editingThis ? (e) => { if (e.button === 0) cellDown(index, i, e.shiftKey); } : undefined}
              onPointerEnter={selectable && !editingThis ? () => cellEnter(index, i) : undefined}
              onContextMenu={selectable ? (e) => { e.preventDefault(); e.stopPropagation(); openCtx(index, i, e.clientX, e.clientY); } : undefined}
              onClick={(e) => {
                // проглатываем клик, оставшийся от drag/Shift-выделения, чтобы он
                // не запустил правку и не открыл карточку строки
                if (selSuppressClick.current) { e.stopPropagation(); selSuppressClick.current = false; return; }
                if (editable) { e.stopPropagation(); if (!editingThis) startEdit(r, c.key); }
              }}
              // keep editor keystrokes (Enter to commit, Space in a tag) from
              // bubbling to the row, whose Enter/Space opens the record page
              onKeyDown={editable ? (e) => e.stopPropagation() : undefined}
            >
              {editingThis
                ? cellInput(c, draft, setDraft, {
                    autoFocus: true,
                    commitOnBlur: true,
                    onCommit: () => commitEdit(r, c.key),
                    onCancel: () => setEditing(null),
                    onLive: (v) => liveEdit(r, c.key, v),
                    onPick: (v) => {
                      setEditing(null);
                      if (onCellEdit && v !== (r[c.key] == null ? '' : String(r[c.key]))) onCellEdit(r, c.key, v);
                    },
                  })
                : renderCell(r[c.key], c, search, {
                    activeValue: filterMap[c.key],
                    onFilter: toggleFilter,
                  }, S, display.cellColors)}
            </div>
          );
        })}
      </div>
    );
  }

  // ── карточка записи: всё поля целиком, сбоку ────────────────────────
  // Сетка намеренно остаётся плотной, а объём уходит на второй уровень —
  // ровно так тесноту решают Airtable, Smartsheet, Notion и Coda. Сюда же
  // попадают длинные текстовые колонки, которых в сетке нет вовсе.
  const cardRow = openRow ? records.find((r) => String(r.id) === openRow) : undefined;
  const cardEl = cardRow && (
    <aside ref={cardRef} className={styles.card} role="dialog" aria-label={S.recordAria}>
      <div className={styles.cardHead}>
        <span className={styles.cardTitle}>
          {String(cardRow[gridCols[0]?.key ?? 'id'] ?? S.recordAria)}
        </span>
        <button type="button" className={styles.cardClose} onClick={() => setOpenRow(null)} aria-label={S.close}>
          ×
        </button>
      </div>
      <div className={styles.cardBody}>
        {columns.map((c) => {
          const value = cardRow[c.key];
          const editingThis = editable && editing?.id === cardRow.id && editing?.key === c.key;
          return (
            <div key={c.key} className={styles.cardField}>
              <span className={styles.cardLabel}>{c.label}</span>
              <div
                className={cx(styles.cardValue, editable && styles.cardEditable)}
                onClick={editable && !editingThis ? () => startEdit(cardRow, c.key) : undefined}
              >
                {editingThis
                  ? cellInput(c, draft, setDraft, {
                      autoFocus: true,
                      commitOnBlur: true,
                      onCommit: () => commitEdit(cardRow, c.key),
                      onCancel: () => setEditing(null),
                      onPick: (v) => {
                        setEditing(null);
                        if (onCellEdit && v !== (cardRow[c.key] == null ? '' : String(cardRow[c.key]))) onCellEdit(cardRow, c.key, v);
                      },
                    })
                  : hasValue(value)
                    ? renderCell(value, c, search, undefined, S, display.cellColors)
                    : <span className={styles.empty}>—</span>}
              </div>
            </div>
          );
        })}
      </div>
      {onRowOpen && (
        <button type="button" className={styles.cardOpen} onClick={() => onRowOpen(cardRow)}>
          {S.openAsPage}
        </button>
      )}
    </aside>
  );

  if (sidebar) {
    return (
      <div className={styles.sheet}>
        <div className={styles.withSidebar}>
          <aside className={styles.sidebar}>
            {searchEl}
            {toolbarLead}
            {filtersEl}
            {sortEl}
            {displayEl}
            {sortResetEl}
            {resetEl}
            {countEl}
          </aside>
          {tableEl}
          {cardEl}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.sheet}>
      <div className={styles.tableTools}>
        {searchEl}
        {/* host controls (e.g. «Views») sit right after the search, beside
            Filters/View */}
        {toolbarLead}
        {/* 'menu' collapses the filters into one «Фильтры» popover button so the
            toolbar stays compact; 'top' keeps them inline as before. The
            «favorites only» toggle lives inside the Filters menu; in inline mode
            it stays next to the filter selects. */}
        {filtersPosition === 'menu' ? filtersEl : (<>{filterEls}{favEl}</>)}
        {sortEl}
        {displayEl}
        {sortResetEl}
        {resetEl}
        {countEl}
      </div>
      <div className={styles.withCard}>
        {tableEl}
        {cardEl}
      </div>
    </div>
  );
}

interface BadgeCtx {
  activeValue?: string;
  onFilter?: (key: string, value: string) => void;
}

// Форматирование числа по настройке колонки (см. NumberFormat). Проценты и
// валюта НЕ пересчитывают значение — 45 → «45 %», 1200 → «$1 200»: пользователь
// вводит уже готовое число, формат лишь одевает его.
function formatNumber(value: Row[string], fmt: NumberFormat): string {
  const n = Number(value);
  if (!isFinite(n)) return String(value);
  const decimals = Math.min(Math.max(fmt.decimals ?? 0, 0), 4);
  const grouping = fmt.style === 'thousands' || fmt.style === 'currency';
  const body = n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: grouping,
  });
  if (fmt.style === 'currency') return `${fmt.currency || '$'}${body}`;
  if (fmt.style === 'percent') return `${body}%`;
  return body;
}

// Фон ячейки для тепловой карты: бледный при минимуме, насыщенный при максимуме.
// Один тон (sage базы), меняется только его доля — читается как интенсивность.
function heatBg(stats: Record<string, { min: number; max: number }>, key: string, value: Row[string]): string | undefined {
  const s = stats[key];
  if (!s || value === null || value === '') return undefined;
  const n = Number(value);
  if (!isFinite(n)) return undefined;
  const t = s.max > s.min ? (n - s.min) / (s.max - s.min) : 0.5;
  const pct = Math.round(8 + t * 62); // 8%..70%
  return `color-mix(in srgb, var(--sage, #6b8f71) ${pct}%, transparent)`;
}

function renderCell(value: Row[string], col: ColumnDef, query?: string, badge?: BadgeCtx, s: MindSheetStrings = DEFAULT_STRINGS, colorByValue = false) {
  // a checkbox is never «empty» — it's ticked or not, so it renders before the
  // blank-value check (read-only here; clicking the cell opens the real toggle)
  if (col.type === 'checkbox') {
    return <input type="checkbox" className={styles.cellCheck} checked={isChecked(value)} readOnly tabIndex={-1} aria-label={col.label} />;
  }
  if (!hasValue(value)) {
    return <span className={styles.empty}>—</span>;
  }
  if (col.type === 'date') {
    return <span className={styles.dateCell}>{formatDateCell(value)}</span>;
  }
  if (col.type === 'rating') {
    return <span className={styles.ratingCell} title={String(value)}>{ratingStars(value)}</span>;
  }
  if (col.type === 'url') {
    return (
      <a
        className={styles.link}
        href={String(value)}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
      >
        {String(value)}
      </a>
    );
  }
  // multiselect: one pill per tag. A filterable tag is a button — clicking it
  // filters by that single tag (the host matches "contains").
  if (col.type === 'multiselect') {
    const tags = splitTags(value);
    if (!tags.length) return <span className={styles.empty}>—</span>;
    return (
      <span className={styles.tags}>
        {tags.map((tag) => {
          const variant = col.badgeVariant?.[tag] ?? 'grey';
          const cls = cx(styles.badge, styles[`badge_${variant}`]);
          if (col.filterable && badge?.onFilter) {
            const active = badge.activeValue === tag;
            return (
              <button
                key={tag}
                type="button"
                className={cx(cls, styles.badgeBtn, active && styles.badgeActive)}
                title={active ? s.clearFilter : s.filterByValue(tag)}
                onClick={(e) => { e.stopPropagation(); badge.onFilter!(col.key, tag); }}
                onKeyDown={(e) => e.stopPropagation()}
              >
                {tag}
              </button>
            );
          }
          return <span key={tag} className={cls}>{tag}</span>;
        })}
      </span>
    );
  }
  if (col.badge) {
    const variant = col.badgeVariant?.[String(value)] ?? 'grey';
    const cls = cx(styles.badge, styles[`badge_${variant}`]);
    // filterable badges become buttons: click to filter, click the active
    // one again to clear. stopPropagation keeps the row's open-on-click quiet.
    if (col.filterable && badge?.onFilter) {
      const active = badge.activeValue === String(value);
      return (
        <button
          type="button"
          className={cx(cls, styles.badgeBtn, active && styles.badgeActive)}
          title={active ? s.clearFilter : s.filterByValue(String(value))}
          onClick={(e) => {
            e.stopPropagation();
            badge.onFilter!(col.key, String(value));
          }}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {String(value)}
        </button>
      );
    }
    return <span className={cls}>{String(value)}</span>;
  }
  // opt-in: colour a plain select cell by a stable hue derived from its value,
  // so select columns without an explicit badge palette still read at a glance
  if (colorByValue && col.type === 'select') {
    const hue = groupHue(String(value));
    return (
      <span
        className={styles.badge}
        style={{ background: `color-mix(in srgb, hsl(${hue} 70% 50%) 18%, transparent)`, color: 'var(--ink)' }}
      >
        {String(value)}
      </span>
    );
  }
  // числовая колонка с заданным форматом — разряды / валюта / проценты
  if (col.type === 'number' && col.numberFormat) {
    return <span className={styles.numCell}>{formatNumber(value, col.numberFormat)}</span>;
  }
  return highlight(String(value), query);
}

// Wraps case-insensitive matches of `query` in <mark> so search hits stand out.
function highlight(text: string, query?: string) {
  const q = query?.trim().toLowerCase();
  if (!q) return text;
  const lower = text.toLowerCase();
  const out: Array<string | ReactElement> = [];
  let from = 0;
  let idx = lower.indexOf(q);
  let key = 0;
  while (idx !== -1) {
    if (idx > from) out.push(text.slice(from, idx));
    out.push(
      <mark key={key++} className={styles.mark}>
        {text.slice(idx, idx + q.length)}
      </mark>,
    );
    from = idx + q.length;
    idx = lower.indexOf(q, from);
  }
  if (from < text.length) out.push(text.slice(from));
  return out;
}
