'use client';

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactElement } from 'react';
import type { AggKind, ColumnDef, ColumnType, MindSheetProps, Row, RowLines, SortState, ViewDisplay, WrapStrategy } from './types';
import styles from './MindSheet.module.css';

// Примочки из табличных систем, которые задокументированы у вендоров:
// Google Sheets — WrapStrategy и правило соседней ячейки; Coda — высота строки
// 1/2/3/All lines и её жёсткая связь с переносом; Excel/Sheets — тяга колонки
// за границу заголовка и двойной клик для сброса ширины.
const WRAP_MODES: Array<{ id: WrapStrategy; label: string; hint: string }> = [
  { id: 'wrap', label: 'Переносить', hint: 'ячейка растягивается под весь объём текста' },
  { id: 'clip', label: 'Обрезать', hint: 'одна строка, лишнее срезается по границе' },
  { id: 'overflow', label: 'За границу', hint: 'текст уходит под соседнюю ячейку, если она пустая' },
  { id: 'shrink', label: 'Сжать', hint: 'шрифт уменьшается под ширину; что не влезло и в 8px — обрезается' },
];

// Итоги по группам — набор из group-by views Google Таблиц.
const AGG_MODES: Array<{ id: AggKind; label: string; numeric: boolean }> = [
  { id: 'none', label: '—', numeric: false },
  { id: 'sum', label: 'сумма', numeric: true },
  { id: 'avg', label: 'среднее', numeric: true },
  { id: 'min', label: 'мин', numeric: true },
  { id: 'max', label: 'макс', numeric: true },
  { id: 'filled', label: 'заполнено', numeric: false },
  { id: 'unique', label: 'уникальных', numeric: false },
];

// Ниже этого размера сжимать бессмысленно — дальше уже не читается,
// поэтому остаток честно обрезаем.
const MIN_SHRINK_PX = 8;

function aggregate(rows: Row[], key: string, kind: AggKind): string | null {
  if (kind === 'none' || rows.length === 0) return null;
  const values = rows.map((r) => r[key]);
  const filled = values.filter(hasValue);

  if (kind === 'filled') return `${filled.length} из ${rows.length}`;
  if (kind === 'unique') return String(new Set(filled.map((v) => String(v))).size);

  const nums = filled.map((v) => Number(String(v).replace(',', '.'))).filter((n) => Number.isFinite(n));
  if (!nums.length) return null;
  const round = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  if (kind === 'sum') return round(nums.reduce((a, b) => a + b, 0));
  if (kind === 'avg') return round(nums.reduce((a, b) => a + b, 0) / nums.length);
  if (kind === 'min') return round(Math.min(...nums));
  return round(Math.max(...nums));
}

const LINE_MODES: Array<{ id: RowLines; label: string }> = [
  { id: 1, label: '1' },
  { id: 2, label: '2' },
  { id: 3, label: '3' },
  { id: 'all', label: 'Всё' },
];

const MIN_COL_WIDTH = 64;

// типы колонок для меню и формы добавления — те же, что принимает бэкенд
const COLUMN_TYPES: Array<{ id: ColumnType; label: string }> = [
  { id: 'text', label: 'Текст' },
  { id: 'number', label: 'Число' },
  { id: 'select', label: 'Выбор' },
  { id: 'url', label: 'Ссылка' },
  { id: 'long-text', label: 'Длинный текст' },
];

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

function distinct(records: Row[], key: string): string[] {
  const set = new Set<string>();
  for (const r of records) {
    if (hasValue(r[key])) set.add(String(r[key]));
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'ru'));
}

// short columns live in the grid; long-text columns are shown on the record's
// own page (opened via onRowOpen), so they stay out of the table entirely.
// Tracks are fluid (fr, min 0) so the whole grid always fits the page width —
// no horizontal scrolling — and cell text wraps instead of overflowing.
function trackFor(column: ColumnDef, isFirst: boolean): string {
  if (isFirst) return 'minmax(0, 1.7fr)';
  if (column.type === 'number') return 'minmax(0, 0.6fr)';
  if (column.type === 'url') return 'minmax(0, 1.4fr)';
  // select-колонки держат бейджи-пилюли: без нижнего предела их сжимало до
  // ~60px, и текст в пилюле резался. 100px хватает большинству ярлыков на одну
  // строку, длинные переносятся (а не обрезаются).
  if (column.type === 'select') return 'minmax(100px, 1fr)';
  return 'minmax(0, 1.1fr)'; // text
}

function isCentered(column: ColumnDef): boolean {
  return column.type === 'number' || column.type === 'select';
}

export default function MindSheet({
  columns, records, total, loading, filtersPosition = 'top',
  sort, filter, filters, filterOptions, search,
  onSortChange, onFilterChange, onFiltersChange, onSearchChange, onRowOpen,
  editable, onCellEdit, onAddRow, onDeleteRow, onRowReorder, autoGroup, sorts, onSortsChange, onSortReset,
  favorites, onToggleFavorite, favoritesOnly, onFavoritesOnlyChange,
  recordCard,
  editableColumns, onColumnAdd, onColumnRename, onColumnRetype, onColumnDelete, onColumnsReorder,
  defaultDisplay, viewKey,
}: MindSheetProps) {
  const favSet = new Set(favorites ?? []);
  const canFavorite = Boolean(onToggleFavorite);
  // опт-ин контрол удаления строки — виден только в editable-режиме, когда
  // хост передал обработчик; отсутствие пропа не меняет разметку вовсе
  const showRowDelete = Boolean(editable && onDeleteRow);
  const filterables = columns.filter((c) => c.filterable);
  const sidebar = filtersPosition === 'left';

  // свёрнутые группы авто-группировки (по значению сортируемой колонки)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
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
    wrap: 'wrap', lines: editable ? 1 : 3, widths: {}, aggregates: {}, ...defaultDisplay,
  }));
  const [viewOpen, setViewOpen] = useState(false);
  // раздел итогов внутри панели «Вид» — свёрнут, пока не понадобится
  const [aggOpen, setAggOpen] = useState(false);
  // читаем сохранённый вид только на клиенте — иначе разъедется гидрация
  const loaded = useRef(false);

  useEffect(() => {
    loaded.current = false;
    if (!storeKey) return;
    try {
      const raw = window.localStorage.getItem(storeKey);
      if (raw) setDisplay((d) => ({ ...d, ...(JSON.parse(raw) as Partial<ViewDisplay>) }));
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
    // Короткие значения — регион, год, галочка — не переполняют даже узкую
    // колонку, а замер каждой ячейки стоит пересчёта раскладки. Длину текста
    // читаем без обращения к раскладке, поэтому отсев бесплатный.
    const cells = all.filter((c) => (c.textContent ?? '').length >= 10);
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
      if (bad > 0 && !window.confirm(`${bad} значений не станут числом — они останутся как есть, но сортировка и итоги их не учтут. Сменить тип?`)) {
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
  const gridCols = columns.filter((c) => c.type !== 'long-text');
  const firstKey = gridCols[0]?.key;
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
  // Заморозка колонки с названием отключена по просьбе: при прокрутке вбок
  // название больше не прилипает слева, и нет тени-«фейда» на его правом крае.
  const freezeClass = undefined;
  const freezeVars: CSSProperties = {};
  let leadAcc = 0;
  leadWidths.forEach((w, i) => {
    leadAcc += w + GAP;
    (freezeVars as Record<string, string>)[`--fz${i + 2}`] = `${leadAcc}px`;
  });
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

  const groupValue = (r: Row, key: string) => {
    const raw = hasValue(r[key]) ? String(r[key]).trim() : '';
    return raw === '' ? '—' : raw;
  };

  function buildGroups(rows: Row[], depth: number, prefix: string): GroupNode[] {
    const level = levels[depth];
    const col = columns.find((c) => c.key === level.key);
    const dir = level.dir === 'desc' ? -1 : 1;
    const map = new Map<string, Row[]>();
    for (const r of rows) {
      const value = groupValue(r, level.key);
      const bucket = map.get(value);
      if (bucket) bucket.push(r);
      else map.set(value, [r]);
    }
    const rank = (v: string) => {
      if (!col?.order) return -1;
      const i = col.order.indexOf(v);
      return i === -1 ? col.order.length : i;
    };
    const out: GroupNode[] = [];
    for (const [value, bucket] of map) {
      const path = prefix ? prefix + ' / ' + value : value;
      const deeper = depth + 1 < levels.length;
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
        const sorted = nameKey
          ? [...bucket].sort((a, b) =>
              String(a[nameKey] ?? '').localeCompare(String(b[nameKey] ?? ''), 'ru'),
            )
          : bucket;
        out.push({ path, value, label, depth, count: bucket.length, children: null, rows: sorted });
      }
    }
    out.sort((a, b) => {
      if (a.value === '—') return 1;
      if (b.value === '—') return -1;
      if (col?.order) return (rank(a.value) - rank(b.value)) * dir;
      if (col?.type === 'number') return (Number(a.value) - Number(b.value)) * dir;
      return a.value.localeCompare(b.value, 'ru') * dir;
    });
    return out;
  }

  const groups: GroupNode[] = autoGroup && levels.length ? buildGroups(records, 0, '') : [];
  // группировка осмысленна, только если она реально что-то объединяет
  const grouped = groups.length > 0 && groups.length < records.length;
  const allPaths: string[] = [];
  (function collect(nodes: GroupNode[]) {
    for (const n of nodes) {
      allPaths.push(n.path);
      if (n.children) collect(n.children);
    }
  })(groups);
  const allCollapsed = grouped && allPaths.length > 0 && allPaths.every((p) => collapsed.has(p));
  const levelsLabel = levels
    .map((l) => columns.find((c) => c.key === l.key)?.label ?? l.key)
    .join(' → ');

  // ── что рисуем: плоский список заголовков групп и строк ─────────────
  // Виртуализация работает по одному списку независимо от того, сгруппировано
  // сейчас или нет: дерево групп разворачивается в ленту в порядке показа.
  type Item = { kind: 'group'; node: GroupNode } | { kind: 'row'; row: Row };
  const items: Item[] = [];
  if (grouped) {
    (function walk(nodes: GroupNode[]) {
      for (const n of nodes) {
        items.push({ kind: 'group', node: n });
        if (collapsed.has(n.path)) continue;
        if (n.children) walk(n.children);
        else for (const r of n.rows) items.push({ kind: 'row', row: r });
      }
    })(groups);
  } else {
    for (const r of orderedRecords) items.push({ kind: 'row', row: r });
  }

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
    },
  ) => (
    <input
      className={styles.cellInput}
      autoFocus={opts.autoFocus}
      type={col.type === 'number' ? 'number' : 'text'}
      list={col.type === 'select' ? `dl-${col.key}` : undefined}
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

  const searchEl = onSearchChange && (
    <input
      type="search"
      className={styles.search}
      aria-label="Поиск"
      placeholder="Поиск…"
      value={search ?? ''}
      onChange={(e) => onSearchChange(e.target.value)}
    />
  );

  const filterEls = filterables.map((c) => (
    <label key={c.key} className={sidebar ? styles.sideFilter : styles.filter}>
      {sidebar ? <span className={styles.sideFilterLabel}>{c.label}</span> : `${c.label}:`}
      <select
        className={styles.select}
        aria-label={`Фильтр ${c.label}`}
        value={filterMap[c.key] ?? ''}
        onChange={(e) => setFilter(c.key, e.target.value)}
      >
        <option value="">Все</option>
        {(filterOptions?.[c.key] ?? distinct(records, c.key)).map((v) => (
          <option key={v} value={v}>{v}</option>
        ))}
      </select>
    </label>
  ));

  const resetEl = isFiltered && (
    <button type="button" className={styles.reset} onClick={resetAll}>
      Сбросить
    </button>
  );

  // «только избранные» + сброс сортировки/группировки
  const favEl = onFavoritesOnlyChange && (
    <label className={styles.favOnly}>
      <input
        type="checkbox"
        checked={Boolean(favoritesOnly)}
        onChange={(e) => onFavoritesOnlyChange(e.target.checked)}
      />
      ★ Только избранные
    </label>
  );

  const sortResetEl = onSortReset && levels.length > 0 && (
    <button type="button" className={styles.reset} onClick={onSortReset}>
      Убрать сортировку
    </button>
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
        title="Как показывать текст в ячейках"
      >
        ▤ Вид
      </button>
      {viewOpen && (
        <>
          <div className={styles.viewBackdrop} onClick={() => setViewOpen(false)} aria-hidden="true" />
          <div
            className={styles.viewPanel}
            role="dialog"
            aria-label="Вид таблицы"
            onKeyDown={(e) => {
              if (e.key === 'Escape') setViewOpen(false);
            }}
          >
            <div className={styles.viewHead}>Текст не влез в ячейку</div>
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

            <div className={styles.viewHead}>Высота строки</div>
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
              <div className={styles.viewNote}>Высота работает только с переносом — без него строка всегда одна.</div>
            )}

            {autoGroup && (
              <>
                {/* колонок бывает дюжина, и списком они растягивают панель на
                    весь экран — держим свёрнутыми, раскрывая по требованию */}
                <button
                  type="button"
                  className={styles.viewFold}
                  aria-expanded={aggOpen}
                  onClick={() => setAggOpen((o) => !o)}
                >
                  <span className={styles.viewFoldCaret} aria-hidden="true">{aggOpen ? '▾' : '▸'}</span>
                  Итоги по группам
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
                  <div className={styles.viewNote}>Считается по всей ветке, включая вложенные группы.</div>
                )}
              </>
            )}

            {sizedCols && (
              <button type="button" className={styles.viewLink} onClick={resetWidths}>
                Вернуть авто-ширину колонок
              </button>
            )}
            <div className={styles.viewNote}>Ширина колонки — тяни за границу заголовка.</div>
          </div>
        </>
      )}
    </div>
  );

  const countEl = (
    <span className={styles.count}>
      {isFiltered ? `показано ${records.length} из ${grandTotal}` : `${grandTotal} записей`}
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
                        title="Клик — сортировать; Shift + клик — добавить уровень группировки"
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
                      aria-label={`Колонка ${c.label}`}
                      aria-expanded={colMenu === c.key}
                      onClick={() => setColMenu(colMenu === c.key ? null : c.key)}
                    >
                      ▾
                    </button>
                  )}
                  {colMenu === c.key && (
                    <div className={styles.colMenuPanel} role="menu">
                      <button type="button" className={styles.colMenuItem} onClick={() => { setColRename({ key: c.key, draft: c.label }); setColMenu(null); }}>
                        Переименовать
                      </button>
                      <div className={styles.colMenuHead}>Тип</div>
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
                      <div className={styles.colMenuHead}>Ширина</div>
                      <button type="button" className={styles.colMenuItem} onClick={() => { fitWidth(c.key, ci); setColMenu(null); }}>
                        По содержимому
                      </button>
                      {display.widths[c.key] && (
                        <button type="button" className={styles.colMenuItem} onClick={() => { resetWidth(c.key); setColMenu(null); }}>
                          Сбросить ширину
                        </button>
                      )}
                      <button
                        type="button"
                        className={cx(styles.colMenuItem, styles.colMenuDanger)}
                        disabled={gridCols.length <= 1}
                        onClick={() => {
                          if (window.confirm(`Удалить колонку «${c.label}»? Её значения из строк будут скрыты.`)) {
                            onColumnDelete?.(c.key);
                          }
                          setColMenu(null);
                        }}
                      >
                        Удалить колонку
                      </button>
                    </div>
                  )}

                  <span
                    className={styles.resizer}
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={`Ширина колонки ${c.label}`}
                    title="Потяни, чтобы изменить ширину колонки"
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
                      placeholder="Название"
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
                      ОК
                    </button>
                  </div>
                ) : (
                  <button type="button" className={styles.colAddBtn} title="Добавить колонку" onClick={() => setAddingCol(true)}>
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
            <div className={styles.none}>Ничего не найдено</div>
          ) : (
            <>
            {grouped && (
              <div className={styles.groupBar} role="row">
                <button
                  type="button"
                  className={styles.groupBarBtn}
                  onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(allPaths))}
                >
                  {allCollapsed ? 'Развернуть все' : 'Свернуть все'}
                </button>
                <span className={styles.groupBarInfo}>
                  группировка: {levelsLabel} · {groups.length}
                </span>
                {levels.length < 3 && (
                  <span className={styles.groupBarHint}>
                    Shift + клик по заголовку — добавить уровень
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
                : renderRow(it.row, i);
            })}
            {padBottom > 0 && <div style={{ height: padBottom }} aria-hidden="true" />}
            </>
          )}

          {editable && !loading && (
            <div className={cx(styles.row, styles.addRow)} role="row">
              {canReorderRows && <div className={styles.caretCell} />}
              <div className={styles.caretCell} aria-hidden="true">+</div>
              {canFavorite && <div className={styles.caretCell} />}
              {showRowDelete && <div className={styles.caretCell} />}
              {gridCols.map((c) => (
                <div key={c.key} className={cx(styles.td, isCentered(c) && styles.center)}>
                  {cellInput(
                    c,
                    addDraft[c.key] ?? '',
                    (v) => setAddDraft((d) => ({ ...d, [c.key]: v })),
                    { placeholder: c.label, onCommit: commitAdd },
                  )}
                </div>
              ))}
            </div>
          )}
      </div>

      {editable &&
        gridCols
          .filter((c) => c.type === 'select')
          .map((c) => (
            <datalist key={c.key} id={`dl-${c.key}`}>
              {(filterOptions?.[c.key] ?? distinct(records, c.key)).map((v) => (
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
            const value = aggregate(rowsOf(g), key, display.aggregates[key]);
            return value === null ? null : { label: col?.label ?? key, value };
          })
          .filter(Boolean)
      : [];
    return (
      <div
        key={g.path}
        data-vi={index}
        className={cx(styles.groupRow, styles[`groupDepth${g.depth}`])}
        role="row"
        style={{ paddingLeft: `${14 + g.depth * 18}px` }}
      >
          <button
            type="button"
            className={styles.groupToggle}
            onClick={() => toggleGroup(g.path)}
            aria-expanded={!isCollapsed}
            title={isCollapsed ? 'Развернуть' : 'Свернуть'}
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

  function renderRow(r: Row, index: number) {
    const dragging = canReorderRows && dragRow === String(r.id);
    const dropHere = canReorderRows && overRow?.id === String(r.id) && dragRow !== String(r.id);
    return (
      <div
        key={r.id}
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
              title="Перетащить строку"
              aria-label="Перетащить строку"
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
              title="Раскрыть запись"
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
              title={favSet.has(r.id) ? 'Убрать из избранного' : 'В избранное'}
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
              title="Удалить строку"
              aria-label="Удалить строку"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteRow(r);
              }}
              onKeyDown={(e) => e.stopPropagation()}
            >
              🗑
            </button>
          </div>
        )}
        {gridCols.map((c, i) => {
          const editingThis = editable && editing?.id === r.id && editing?.key === c.key;
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
              )}
              onClick={editable && !editingThis ? () => startEdit(r, c.key) : undefined}
            >
              {editingThis
                ? cellInput(c, draft, setDraft, {
                    autoFocus: true,
                    commitOnBlur: true,
                    onCommit: () => commitEdit(r, c.key),
                    onCancel: () => setEditing(null),
                  })
                : renderCell(r[c.key], c, search, {
                    activeValue: filterMap[c.key],
                    onFilter: toggleFilter,
                  })}
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
    <aside ref={cardRef} className={styles.card} role="dialog" aria-label="Запись">
      <div className={styles.cardHead}>
        <span className={styles.cardTitle}>
          {String(cardRow[gridCols[0]?.key ?? 'id'] ?? 'Запись')}
        </span>
        <button type="button" className={styles.cardClose} onClick={() => setOpenRow(null)} aria-label="Закрыть">
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
                    })
                  : hasValue(value)
                    ? renderCell(value, c, search)
                    : <span className={styles.empty}>—</span>}
              </div>
            </div>
          );
        })}
      </div>
      {onRowOpen && (
        <button type="button" className={styles.cardOpen} onClick={() => onRowOpen(cardRow)}>
          Открыть страницей →
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
            {filterables.length > 0 && <div className={styles.sideHead}>Фильтры</div>}
            {filterEls}
            {favEl}
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
        {filterEls}
        {favEl}
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

function renderCell(value: Row[string], col: ColumnDef, query?: string, badge?: BadgeCtx) {
  if (!hasValue(value)) {
    return <span className={styles.empty}>—</span>;
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
          title={active ? 'Убрать фильтр' : `Фильтр: ${String(value)}`}
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
