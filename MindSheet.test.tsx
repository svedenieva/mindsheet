import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MindSheet from './MindSheet';
import type { ColumnDef, Row } from './types';

const columns: ColumnDef[] = [
  { key: 'name', label: 'Название', type: 'text', sortable: true },
  { key: 'region', label: 'Регион', type: 'select', sortable: true, filterable: true },
];
const records: Row[] = [
  { id: 'a', name: 'Alpha', region: 'EU' },
  { id: 'b', name: 'Beta', region: 'US' },
];

describe('MindSheet', () => {
  it('renders a header per column and a row per record', () => {
    render(
      <MindSheet columns={columns} records={records}
        onSortChange={() => {}} onFilterChange={() => {}} />,
    );
    expect(screen.getByRole('columnheader', { name: /Название/ })).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('calls onSortChange when a sortable header is clicked', () => {
    const onSortChange = vi.fn();
    render(
      <MindSheet columns={columns} records={records}
        onSortChange={onSortChange} onFilterChange={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Название/ }));
    expect(onSortChange).toHaveBeenCalledWith('name');
  });

  it('calls onFilterChange with the selected value', () => {
    const onFilterChange = vi.fn();
    render(
      <MindSheet columns={columns} records={records}
        onSortChange={() => {}} onFilterChange={onFilterChange} />,
    );
    fireEvent.change(screen.getByLabelText(/Фильтр Регион/), { target: { value: 'US' } });
    expect(onFilterChange).toHaveBeenCalledWith({ key: 'region', value: 'US' });
  });

  it('calls onFiltersChange with the merged map when multiple filters are used', () => {
    const onFiltersChange = vi.fn();
    render(
      <MindSheet columns={columns} records={records} filters={{ name: 'Alpha' }}
        onSortChange={() => {}} onFiltersChange={onFiltersChange} />,
    );
    // a second facet is added on top of the existing one, not replacing it
    fireEvent.change(screen.getByLabelText(/Фильтр Регион/), { target: { value: 'US' } });
    expect(onFiltersChange).toHaveBeenCalledWith({ name: 'Alpha', region: 'US' });
  });

  it('removes a facet from the map when its select is cleared (multi)', () => {
    const onFiltersChange = vi.fn();
    render(
      <MindSheet columns={columns} records={records} filters={{ region: 'US' }}
        onSortChange={() => {}} onFiltersChange={onFiltersChange} />,
    );
    fireEvent.change(screen.getByLabelText(/Фильтр Регион/), { target: { value: '' } });
    expect(onFiltersChange).toHaveBeenCalledWith({});
  });

  it('uses filterOptions for select options when provided, even values absent from records', () => {
    render(
      <MindSheet columns={columns} records={records} filterOptions={{ region: ['EU', 'US', 'APAC'] }}
        onSortChange={() => {}} onFilterChange={() => {}} />,
    );
    const select = screen.getByLabelText(/Фильтр Регион/);
    expect(screen.getByRole('option', { name: 'APAC' })).toBeInTheDocument();
    expect(select).toBeInTheDocument();
  });

  it('keeps long-text columns out of the grid (they open on the record page)', () => {
    const cols: ColumnDef[] = [
      { key: 'name', label: 'Название', type: 'text' },
      { key: 'bio', label: 'Описание', type: 'long-text' },
    ];
    const rows: Row[] = [{ id: 'a', name: 'Alpha', bio: 'Длинный текст про Alpha' }];
    render(
      <MindSheet columns={cols} records={rows}
        onSortChange={() => {}} onFilterChange={() => {}} />,
    );
    // the long-text column is neither a grid header nor rendered in the table
    expect(screen.queryByRole('columnheader', { name: /Описание/ })).toBeNull();
    expect(screen.queryByText('Длинный текст про Alpha')).toBeNull();
  });

  it('calls onRowOpen with the record when a row is clicked', () => {
    const onRowOpen = vi.fn();
    render(
      <MindSheet columns={columns} records={records}
        onSortChange={() => {}} onFilterChange={() => {}} onRowOpen={onRowOpen} />,
    );
    fireEvent.click(screen.getByText('Alpha'));
    expect(onRowOpen).toHaveBeenCalledWith(records[0]);
  });

  it('does not make rows clickable without onRowOpen', () => {
    render(
      <MindSheet columns={columns} records={records}
        onSortChange={() => {}} onFilterChange={() => {}} />,
    );
    expect(screen.queryByRole('button', { name: /Alpha/ })).toBeNull();
  });

  // ── вид ячейки: правило Google про наплыв на соседа ─────────────────
  const spillRows: Row[] = [
    { id: 'a', name: 'Очень длинное название компании', region: 'EU' },
    { id: 'b', name: 'Очень длинное название компании', region: null },
  ];

  it('spills over the neighbour only when that neighbour is empty', () => {
    render(
      <MindSheet columns={columns} records={spillRows} defaultDisplay={{ wrap: 'overflow' }}
        onSortChange={() => {}} onFilterChange={() => {}} />,
    );
    const [withNeighbour, withoutNeighbour] = screen.getAllByText('Очень длинное название компании');
    // сосед занят — режем по границе, как OVERFLOW_CELL у Google
    expect(withNeighbour.className).toMatch(/clipCell/);
    expect(withNeighbour.className).not.toMatch(/spillCell/);
    // сосед пустой — можно наплывать
    expect(withoutNeighbour.className).toMatch(/spillCell/);
  });

  it('switches the whole grid to clip when the clip mode is chosen', () => {
    render(
      <MindSheet columns={columns} records={spillRows} defaultDisplay={{ wrap: 'clip' }}
        onSortChange={() => {}} onFilterChange={() => {}} />,
    );
    for (const cell of screen.getAllByText('Очень длинное название компании')) {
      expect(cell.className).toMatch(/clipCell/);
    }
  });

  it('clamps wrapped cells to the chosen number of lines', () => {
    render(
      <MindSheet columns={columns} records={records} defaultDisplay={{ wrap: 'wrap', lines: 1 }}
        onSortChange={() => {}} onFilterChange={() => {}} />,
    );
    const cell = screen.getByText('Alpha');
    expect(cell.className).toMatch(/wrapCell/);
    expect(cell.className).toMatch(/lines1/);
  });

  it('locks row height to one line while wrapping is off', () => {
    render(
      <MindSheet columns={columns} records={records} defaultDisplay={{ wrap: 'clip' }}
        onSortChange={() => {}} onFilterChange={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Вид/ }));
    for (const chip of ['1', '2', '3', 'Всё']) {
      expect(screen.getByRole('button', { name: chip })).toBeDisabled();
    }
  });
});
