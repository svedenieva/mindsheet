'use client';

import { useState } from 'react';
import type { CSSProperties } from 'react';
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

// short columns live in the grid; long-text columns open in a side panel.
function trackFor(column: ColumnDef, isFirst: boolean): string {
  if (isFirst) return '170px';
  if (column.type === 'number') return '80px';
  if (column.type === 'url') return '160px';
  if (column.type === 'select') return '132px';
  return '160px'; // text
}

function isCentered(column: ColumnDef): boolean {
  return column.type === 'number' || column.type === 'select';
}

export default function MindSheet({
  columns, records, sort, filter, filterOptions, search, onSortChange, onFilterChange, onSearchChange,
}: MindSheetProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  const filterables = columns.filter((c) => c.filterable);
  const gridCols = columns.filter((c) => c.type !== 'long-text');
  const detailCols = columns.filter((c) => c.type === 'long-text');
  const firstKey = gridCols[0]?.key;

  const grid = ['22px', ...gridCols.map((c, i) => trackFor(c, i === 0))].join(' ');
  const gridStyle = { '--grid': grid } as CSSProperties;

  const openRecord = openId ? records.find((r) => r.id === openId) ?? null : null;
  const openDetails = openRecord ? detailCols.filter((c) => hasValue(openRecord[c.key])) : [];

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
              value={filter?.key === c.key ? filter.value : ''}
              onChange={(e) =>
                onFilterChange(
                  e.target.value ? { key: c.key, value: e.target.value } : undefined,
                )
              }
            >
              <option value="">Все</option>
              {(filterOptions?.[c.key] ?? distinct(records, c.key)).map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </label>
        ))}
        <span className={styles.count}>{records.length} записей</span>
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

          {records.length === 0 ? (
            <div className={styles.none}>Ничего не найдено</div>
          ) : (
            records.map((r) => {
              const canOpen = detailCols.some((c) => hasValue(r[c.key]));
              return (
                <div
                  key={r.id}
                  className={cx(styles.row, canOpen && styles.clickable, openId === r.id && styles.rowActive)}
                  role="row"
                  onClick={canOpen ? () => setOpenId(r.id) : undefined}
                >
                  <div className={styles.caretCell} aria-hidden="true">{canOpen ? '›' : ''}</div>
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
                      {renderCell(r[c.key], c)}
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>
      </div>

      {openRecord && (
        <div className={styles.drawerBackdrop} onClick={() => setOpenId(null)}>
          <aside
            className={styles.drawer}
            role="dialog"
            aria-label="Детали записи"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.drawerHead}>
              <span className={styles.drawerTitle}>
                {String((firstKey ? openRecord[firstKey] : '') ?? '')}
              </span>
              <button
                type="button"
                className={styles.drawerClose}
                onClick={() => setOpenId(null)}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>
            <dl className={styles.detail}>
              {openDetails.map((c) => (
                <div key={c.key} className={styles.detailItem}>
                  <dt className={styles.detailLabel}>{c.label}</dt>
                  <dd className={styles.detailValue}>{renderCell(openRecord[c.key], c)}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      )}
    </div>
  );
}

function renderCell(value: Row[string], col: ColumnDef) {
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
  return String(value);
}
