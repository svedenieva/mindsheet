import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MindSheet from './MindSheet';
import type { ColumnDef, Row } from './types';

// A closed-vocabulary select (has `order`) that is NOT filterable, so its grid
// cell is a plain badge — clicking it starts editing rather than toggling a filter.
const cols: ColumnDef[] = [
  { key: 'name', label: 'N', type: 'text', sortable: true },
  { key: 'mode', label: 'Режим', type: 'select', sortable: true, order: ['Черновик', 'Готово'] },
];
const rows: Row[] = [{ id: 'a', name: 'Alpha', mode: 'Черновик' }];

describe('MindSheet select picker — one-click status change', () => {
  it('shows every option as a pill when editing and sets the picked one in a single click', () => {
    const onCellEdit = vi.fn();
    render(<MindSheet columns={cols} records={rows} editable onCellEdit={onCellEdit} onSortChange={() => {}} />);

    // the cell shows the current value; click it to start editing.
    // MindSheet keeps both a table and a card layout in the DOM (CSS hides one),
    // so the value and, after editing, the option pills each appear more than
    // once — query all and act on the first.
    fireEvent.click(screen.getAllByText('Черновик')[0]);

    // both choices are offered up front as buttons — no dropdown, no typing
    const ready = screen.getAllByRole('button', { name: 'Готово' });
    expect(ready.length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Черновик' }).length).toBeGreaterThan(0);

    // one click (mousedown, before any blur) commits the picked value
    fireEvent.mouseDown(ready[0]);
    expect(onCellEdit).toHaveBeenCalledTimes(1);
    const [row, key, value] = onCellEdit.mock.calls[0];
    expect(row.id).toBe('a');
    expect(key).toBe('mode');
    expect(value).toBe('Готово');
  });
});
