'use client';

import type { CSSProperties, ReactElement } from 'react';
import type { ColumnDef, MindSheetProps, Row } from './types';
import styles from './MindSheet.module.css';

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
  columns, records, total, loading, sort, filter, filters, filterOptions, search,
  onSortChange, onFilterChange, onFiltersChange, onSearchChange, onRowOpen,
}: MindSheetProps) {
  const filterables = columns.filter((c) => c.filterable);

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

  const grid = [rowsClickable ? '22px' : '0px', ...gridCols.map((c, i) => trackFor(c, i === 0))].join(' ');
  const gridStyle = { '--grid': grid } as CSSProperties;

  return (
    <div className={styles.sheet}>
      <div className={styles.tableTools}>
        {onSearchChange && (
          <input
            type="search"
            className={styles.search}
            aria-label="Поиск"
            placeholder="Поиск…"
            value={search ?? ''}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        )}
        {filterables.map((c) => (
          <label key={c.key} className={styles.filter}>
            {c.label}:
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
        ))}
        {isFiltered && (
          <button type="button" className={styles.reset} onClick={resetAll}>
            Сбросить
          </button>
        )}
        <span className={styles.count}>
          {isFiltered
            ? `показано ${records.length} из ${grandTotal}`
            : `${grandTotal} записей`}
        </span>
      </div>

      <div className={styles.tableScroll}>
        <div className={styles.table} style={gridStyle} role="table">
          <div className={styles.tableHead} role="row">
            <div className={styles.caretCell} aria-hidden="true" />
            {gridCols.map((c) => {
              const active = sort?.key === c.key;
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
                      onClick={() => onSortChange(c.key)}
                    >
                      {c.label}
                      <span className={styles.arrow}>
                        {active ? (sort!.dir === 'asc' ? '▲' : '▼') : ''}
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
          ) : (
            records.map((r) => (
              <div
                key={r.id}
                className={cx(styles.row, rowsClickable && styles.clickable)}
                role={rowsClickable ? 'button' : 'row'}
                tabIndex={rowsClickable ? 0 : undefined}
                onClick={rowsClickable ? () => onRowOpen!(r) : undefined}
                onKeyDown={
                  rowsClickable
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onRowOpen!(r);
                        }
                      }
                    : undefined
                }
              >
                <div className={styles.caretCell} aria-hidden="true">{rowsClickable ? '›' : ''}</div>
                {gridCols.map((c) => (
                  <div
                    key={c.key}
                    role="cell"
                    className={cx(
                      styles.td,
                      c.key === firstKey && styles.strong,
                      isCentered(c) && styles.center,
                    )}
                  >
                    {renderCell(r[c.key], c, search)}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function renderCell(value: Row[string], col: ColumnDef, query?: string) {
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
    return (
      <span className={cx(styles.badge, styles[`badge_${variant}`])}>
        {String(value)}
      </span>
    );
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
