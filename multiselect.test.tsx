import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MindSheet from './MindSheet';
import type { ColumnDef, Row } from './types';

const cols: ColumnDef[] = [
  { key: 'name', label: 'N', type: 'text', sortable: true },
  { key: 'tags', label: 'Теги', type: 'multiselect', sortable: true, filterable: true },
];
const rows: Row[] = [
  { id: 'a', name: 'Alpha', tags: 'ai, tooling' },
  { id: 'b', name: 'Beta', tags: 'ai' },
];

describe('MindSheet multiselect — grid verification', () => {
  it('renders each tag as its own pill (a filterable multiselect pill is a button)', () => {
    render(<MindSheet columns={cols} records={rows} onSortChange={() => {}} />);
    // pill buttons, distinct from filter <option>s and the edit datalist
    expect(screen.getAllByRole('button', { name: 'tooling' }).length).toBe(1); // only Alpha
    expect(screen.getAllByRole('button', { name: 'ai' }).length).toBe(2); // Alpha + Beta
  });

  it('groups a multi-tag row under EACH of its tags (§5.7)', () => {
    render(
      <MindSheet columns={cols} records={rows} autoGroup sort={{ key: 'tags', dir: 'asc' }} onSortChange={() => {}} />,
    );
    // grouped by tags, Alpha (ai + tooling) is placed under one MORE group than
    // Beta (ai) — that extra placement is the multi-value grouping we're proving
    expect(screen.getAllByText('Alpha').length).toBe(screen.getAllByText('Beta').length + 1);
  });
});
