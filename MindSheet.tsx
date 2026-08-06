'use client';

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactElement } from 'react';
import type { AggKind, ColumnDef, MindSheetProps, Row, RowLines, SortState, ViewDisplay, WrapStrategy } from './types';
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
  if (column.type === 'select') return 'minmax(0, 1fr)';
  return 'minmax(0, 1.1fr)'; // text
}

function isCentered(column: ColumnDef): boolean {
  return column.type === 'number' || column.type === 'select';
}

export default function MindSheet({
  columns, records, total, loading, filtersPosition = 'top',
  sort, filter, filters, filterOptions, search,
  onSortChange, onFilterChange, onFiltersChange, onSearchChange, onRowOpen,
  editable, onCellEdit, onAddRow, autoGroup, sorts, onSortsChange, onSortReset,
  favorites, onToggleFavorite, favoritesOnly, onFavoritesOnlyChange,
  defaultDisplay, viewKey,
}: MindSheetProps) {
  const favSet = new Set(favorites ?? []);
  const canFavorite = Boolean(onToggleFavorite);
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

  const autoWidth = (key: string) =>
    setDisplay((d) => {
      const widths = { ...d.widths };
      delete widths[key];
      return { ...d, widths };
    });

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

  const lead = rowsClickable || editable ? '22px' : '0px';

  const sizedCols = Object.keys(display.widths).length > 0;
  const aggCount = Object.keys(display.aggregates).length;
  const grid = [
    lead,
    ...(canFavorite ? ['24px'] : []),
    ...gridCols.map((c, i) => (display.widths[c.key] ? `${display.widths[c.key]}px` : trackFor(c, i === 0))),
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
          <div className={styles.tableHead} role="row">
            <div className={styles.caretCell} aria-hidden="true" />
            {canFavorite && <div className={styles.caretCell} aria-hidden="true">★</div>}
            {gridCols.map((c) => {
              const levelIdx = levels.findIndex((l) => l.key === c.key);
              const active = levelIdx >= 0;
              return (
                <div
                  key={c.key}
                  role="columnheader"
                  className={cx(styles.th, isCentered(c) && styles.center)}
                >
                  {/* подпись клипуем отдельным слоем: сама ячейка обязана
                      остаться overflow: visible, иначе ручку ширины срежет
                      по её же краю */}
                  <span className={styles.thLabel}>
                    {c.sortable ? (
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
                  <span
                    className={styles.resizer}
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={`Ширина колонки ${c.label}`}
                    title="Тяни — ширина колонки; двойной клик — вернуть авто"
                    onPointerDown={(e) => startResize(e, c.key)}
                    onDoubleClick={() => autoWidth(c.key)}
                  />
                </div>
              );
            })}
          </div>

          {loading && records.length === 0 ? (
            Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className={styles.row} aria-hidden="true">
                <div className={styles.caretCell} />
                {canFavorite && <div className={styles.caretCell} />}
                {gridCols.map((c) => (
                  <div key={c.key} className={cx(styles.td, isCentered(c) && styles.center)}>
                    <span className={styles.skel} style={{ width: `${50 + ((i * 7 + c.key.length * 5) % 45)}%` }} />
                  </div>
                ))}
              </div>
            ))
          ) : records.length === 0 ? (
            <div className={styles.none}>Ничего не найдено</div>
          ) : grouped ? (
            <>
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
            {groups.map(renderGroup)}
            </>
          ) : (
            records.map(renderRow)
          )}

          {editable && !loading && (
            <div className={cx(styles.row, styles.addRow)} role="row">
              <div className={styles.caretCell} aria-hidden="true">+</div>
              {canFavorite && <div className={styles.caretCell} />}
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

  // рекурсивная отрисовка группы: заголовок + вложенные группы или строки
  function renderGroup(g: GroupNode) {
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
      <div key={g.path}>
        <div
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
        {!isCollapsed && (g.children ? g.children.map(renderGroup) : g.rows.map(renderRow))}
      </div>
    );
  }

  // отрисовка одной строки таблицы (плоский и групповой вид)
  function renderRow(r: Row) {
    return (
      <div
        key={r.id}
        className={cx(styles.row, rowsClickable && styles.clickable)}
        role={rowsClickable ? "button" : "row"}
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
        <div className={styles.caretCell} aria-hidden="true">{rowsClickable ? "›" : ""}</div>
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
        {gridCols.map((c, i) => {
          const editingThis = editable && editing?.id === r.id && editing?.key === c.key;
          return (
            <div
              key={c.key}
              role="cell"
              className={cx(
                styles.td,
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
      {tableEl}
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
