import { useMemo, useState } from 'react';
import { MindSheet } from '../index';
import type { Cell, ColumnDef, Row, SortState } from '../types';
import { columns, rows as seed } from './data';
import './demo.css';

const MAX_SORT_LEVELS = 3;

function byColumn(a: Cell, b: Cell, col: ColumnDef | undefined): number {
  if (a === null || a === '') return b === null || b === '' ? 0 : 1;
  if (b === null || b === '') return -1;
  if (col?.order) {
    const ia = col.order.indexOf(String(a));
    const ib = col.order.indexOf(String(b));
    const ra = ia === -1 ? col.order.length : ia;
    const rb = ib === -1 ? col.order.length : ib;
    if (ra !== rb) return ra - rb;
  }
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'ru');
}

export default function App() {
  const [records, setRecords] = useState<Row[]>(seed);
  const [sorts, setSorts] = useState<SortState[]>([]);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [favorites, setFavorites] = useState<string[]>(['6', '11']);
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  // Опции фильтров считаем по полному набору, иначе после первого фильтра
  // список значений схлопнется до одного.
  const filterOptions = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const c of columns) {
      if (!c.filterable) continue;
      const seen = new Set<string>();
      for (const r of records) {
        const v = r[c.key];
        if (v !== null && v !== '') seen.add(String(v));
      }
      out[c.key] = [...seen].sort((a, b) => byColumn(a, b, c));
    }
    return out;
  }, [records]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = records.filter((r) => {
      for (const [key, value] of Object.entries(filters)) {
        if (value && String(r[key] ?? '') !== value) return false;
      }
      if (favoritesOnly && !favorites.includes(r.id)) return false;
      if (q) {
        const hit = columns.some((c) => String(r[c.key] ?? '').toLowerCase().includes(q));
        if (!hit) return false;
      }
      return true;
    });

    if (sorts.length) {
      const byKey = new Map(columns.map((c) => [c.key, c]));
      out = [...out].sort((ra, rb) => {
        for (const s of sorts) {
          const cmp = byColumn(ra[s.key], rb[s.key], byKey.get(s.key));
          if (cmp !== 0) return s.dir === 'asc' ? cmp : -cmp;
        }
        return 0;
      });
    }
    return out;
  }, [records, filters, search, sorts, favorites, favoritesOnly]);

  // Клик по заголовку: обычный — заменяет первый уровень, с shift/ctrl —
  // добавляет ещё один уровень сортировки (и, значит, группировки).
  function changeSort(key: string, additive: boolean) {
    setSorts((prev) => {
      const at = prev.findIndex((s) => s.key === key);
      if (!additive) {
        if (at === 0 && prev.length === 1) {
          return prev[0].dir === 'asc' ? [{ key, dir: 'desc' }] : [];
        }
        return [{ key, dir: 'asc' }];
      }
      if (at === -1) {
        return prev.length >= MAX_SORT_LEVELS ? prev : [...prev, { key, dir: 'asc' }];
      }
      const next = [...prev];
      if (next[at].dir === 'asc') next[at] = { key, dir: 'desc' };
      else next.splice(at, 1);
      return next;
    });
  }

  return (
    <main className="page">
      <header className="page__head">
        <h1 className="page__title">MindSheet</h1>
        <p className="page__lead">
          Переносимая таблица AiVocado. Компонент ничего не знает про источник данных:
          ему отдают <code>columns</code> и <code>records</code>, а сортировку, фильтры
          и поиск считает хост. Ниже — демо на выдуманном каталоге продуктов.
        </p>
        <ul className="page__hints">
          <li>Клик по заголовку — сортировка; с Shift — второй и третий уровень.</li>
          <li>При сортировке строки схлопываются в группы с +/−.</li>
          <li>Ячейки редактируются по клику, снизу есть строка добавления.</li>
          <li>«Вид» — перенос текста, высота строки; границу колонки можно тянуть.</li>
        </ul>
      </header>

      <MindSheet
        columns={columns}
        records={visible}
        total={records.length}
        sorts={sorts}
        sort={sorts[0]}
        filters={filters}
        filterOptions={filterOptions}
        search={search}
        favorites={favorites}
        favoritesOnly={favoritesOnly}
        editable
        autoGroup
        viewKey="mindsheet-demo"
        onSortChange={(key) => changeSort(key, false)}
        onSortsChange={changeSort}
        onSortReset={() => setSorts([])}
        onFiltersChange={setFilters}
        onSearchChange={setSearch}
        onFavoritesOnlyChange={setFavoritesOnly}
        onToggleFavorite={(r) =>
          setFavorites((prev) =>
            prev.includes(r.id) ? prev.filter((id) => id !== r.id) : [...prev, r.id],
          )
        }
        onCellEdit={(record, key, value) =>
          setRecords((prev) =>
            prev.map((r) => (r.id === record.id ? { ...r, [key]: value } : r)),
          )
        }
        onAddRow={(data) =>
          setRecords((prev) => [...prev, { ...data, id: `new-${prev.length + 1}` }])
        }
      />

      <footer className="page__foot">
        Правки живут только в этой вкладке — демо ничего не сохраняет на сервер.
      </footer>
    </main>
  );
}
