'use client';

import { useState, type CSSProperties, type ReactElement } from 'react';
import type { ColumnDef, MindSheetProps, Row, SortState } from './types';
import styles from './MindSheet.module.css';

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
  editable, onCellEdit, onAddRow, autoGroup, sorts, onSortsChange,
}: MindSheetProps) {
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
  const grid = [lead, ...gridCols.map((c, i) => trackFor(c, i === 0))].join(' ');
  const gridStyle = { '--grid': grid } as CSSProperties;

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

  const countEl = (
    <span className={styles.count}>
      {isFiltered ? `показано ${records.length} из ${grandTotal}` : `${grandTotal} записей`}
    </span>
  );

  const tableEl = (
    <div className={styles.tableScroll}>
      <div className={cx(styles.table, editable && styles.compact)} style={gridStyle} role="table">
          <div className={styles.tableHead} role="row">
            <div className={styles.caretCell} aria-hidden="true" />
            {gridCols.map((c) => {
              const levelIdx = levels.findIndex((l) => l.key === c.key);
              const active = levelIdx >= 0;
              return (
                <div
                  key={c.key}
                  role="columnheader"
                  className={cx(styles.th, isCentered(c) && styles.center)}
                >
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
                </div>
              );
            })}
          </div>

          {loading && records.length === 0 ? (
            Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className={styles.row} aria-hidden="true">
                <div className={styles.caretCell} />
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

  // рекурсивная отрисовка группы: заголовок + вложенные группы или строки
  function renderGroup(g: GroupNode) {
    const isCollapsed = collapsed.has(g.path);
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
        {gridCols.map((c) => {
          const editingThis = editable && editing?.id === r.id && editing?.key === c.key;
          return (
            <div
              key={c.key}
              role="cell"
              className={cx(
                styles.td,
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
