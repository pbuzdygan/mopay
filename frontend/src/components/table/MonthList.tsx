import { memo, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { DragEndEvent, SensorDescriptor, SensorOptions } from '@dnd-kit/core';
import { Api } from '../../api';
import { useAppStore } from '../../store';
import { MONTHS, MONTH_NAMES, type MonthKey } from '../../utils/months';
import { formatCurrency, formatCurrencyWhole } from '../../utils/currency';
import { Icon, IconButton } from '../ui';
import { SortableScope, formatMonthValue, monthValue } from './GridRows';
import type { EntryGroup, EntryRowData, EntryTag, GridSelection } from './types';

// Expenses / Incomes below 960 px (plan Phase 8, D11): one month at a time
// with a month stepper and summary instead of the horizontally scrolling grid.
// A row opens the inspector bottom sheet; Arrange and Remove work in the list
// with the same dnd-kit handlers and store selection as the grid (D14).

type GroupKey = number | 'ungrouped';

export type MonthListProps = {
  listRef: RefObject<HTMLDivElement>;
  type: 'income' | 'expense';
  year: number;
  month: MonthKey;
  onMonthChange: (month: MonthKey) => void;
  currentMonth: MonthKey | null;
  /** All entries of this type, for the month summary (not filtered by search). */
  allRows: EntryRowData[];
  groups: EntryGroup[];
  entriesByGroup: Map<number | null, EntryRowData[]>;
  isCollapsed: (key: GroupKey) => boolean;
  onToggleCollapse: (key: GroupKey) => void;
  showGroupTotals: boolean;
  tagsByEntry: Map<number, Record<string, EntryTag | undefined>>;
  selection: GridSelection | null;
  ordering: boolean;
  sensors: SensorDescriptor<SensorOptions>[];
  onEntryDragEnd: (groupEntries: EntryRowData[], event: DragEndEvent) => void;
  onGroupDragEnd: (event: DragEndEvent) => void;
  removingIds: number[];
  removingGroupIds: number[];
  onSelect: (entryId: number, month: string) => void;
  onOpenGroup: (group: EntryGroup, opener: HTMLElement) => void;
  empty: ReactNode;
};

const monthTotal = (rows: EntryRowData[], month: MonthKey) =>
  rows.reduce((sum, row) => sum + (monthValue(row, month) ?? 0), 0);

export function MonthList(props: MonthListProps) {
  const { type, year, month, onMonthChange, currentMonth, groups, entriesByGroup, ordering, sensors, empty } = props;
  const index = MONTHS.indexOf(month);
  const ungrouped = entriesByGroup.get(null) ?? [];

  return (
    <div className="mlist-view">
      <div className="mlist-stepper">
        <IconButton icon="chevron-left" label="Previous month" tooltip={false} disabled={index <= 0} onClick={() => onMonthChange(MONTHS[index - 1])} />
        <h2 aria-live="polite">
          {MONTH_NAMES[index]}{' '}
          <small>{type === 'income' ? 'Incomes' : 'Expenses'} · {year}{month === currentMonth ? ' · current month' : ''}</small>
        </h2>
        <IconButton icon="chevron-right" label="Next month" tooltip={false} disabled={index >= 11} onClick={() => onMonthChange(MONTHS[index + 1])} />
      </div>
      <MonthSummary {...props} />
      <div className="mlist" data-testid="entry-table" ref={props.listRef}>
        <SortableScope enabled={ordering} sensors={sensors} items={groups.map((group) => group.id)} onDragEnd={props.onGroupDragEnd}>
          {groups.map((group) => (
            <ListGroup key={group.id} {...props} group={group} entries={entriesByGroup.get(group.id) ?? []} />
          ))}
        </SortableScope>
        {ungrouped.length > 0 && <ListGroup {...props} group={null} entries={ungrouped} />}
        {empty}
      </div>
    </div>
  );
}

// Month totals of both types, like the mockup (Income, Expenses, Net). The other
// type uses the same query key as its view, so it is usually cached.
function MonthSummary({ type, year, month, allRows }: MonthListProps) {
  const otherType = type === 'income' ? 'expense' : 'income';
  const other = useQuery({ queryKey: ['entries', otherType, year], queryFn: () => Api.entries.list(otherType, year) });
  const own = monthTotal(allRows, month);
  const otherTotal = other.data ? monthTotal((other.data.entries ?? []) as EntryRowData[], month) : null;
  const income = type === 'income' ? own : otherTotal;
  const expense = type === 'expense' ? own : otherTotal;
  const net = income !== null && expense !== null ? income - expense : null;
  return (
    <dl className="mlist-summary" aria-label={`${MONTH_NAMES[MONTHS.indexOf(month)]} summary`}>
      <div><dt>Income</dt><dd>{income === null ? '—' : formatCurrencyWhole(income)}</dd></div>
      <div><dt>Expenses</dt><dd>{expense === null ? '—' : formatCurrencyWhole(expense)}</dd></div>
      <div>
        <dt>Net</dt>
        <dd className={net === null ? '' : net < 0 ? 'is-negative' : 'is-positive'}>
          {net === null ? '—' : `${net > 0 ? '+' : ''}${formatCurrencyWhole(net)}`}
        </dd>
      </div>
    </dl>
  );
}

function ListGroup(props: MonthListProps & { group: EntryGroup | null; entries: EntryRowData[] }) {
  const { group, entries, month, ordering, sensors, isCollapsed, onToggleCollapse, showGroupTotals, removingGroupIds } = props;
  const key: GroupKey = group ? group.id : 'ungrouped';
  const collapsed = isCollapsed(key);
  const editMode = useAppStore((s) => s.editMode);
  const toggleRemoveGroupId = useAppStore((s) => s.toggleRemoveGroupId);
  const groupSelected = useAppStore((s) => (group ? s.groupRemoveSelection.has(group.id) : false));
  // Groups are sortable only in Arrange mode; Ungrouped stays last.
  const sortable = useSortable({ id: group?.id ?? -1, disabled: !ordering || !group });
  const style: CSSProperties | undefined = ordering && group
    ? { transform: CSS.Transform.toString(sortable.transform), transition: 'none' }
    : undefined;
  const selected = editMode === 'remove' && groupSelected;

  return (
    <section
      ref={ordering && group ? sortable.setNodeRef : undefined}
      style={style}
      className={`mlist-group ${selected ? 'is-selected' : ''} ${group && removingGroupIds.includes(group.id) ? 'fade-out' : ''} ${sortable.isDragging ? 'is-dragging' : ''}`}
    >
      <div className="mlist-group-head">
        {group && ordering && (
          <button type="button" className="mlist-handle" {...sortable.attributes} {...sortable.listeners} aria-label={`Reorder group ${group.name}`}>
            <Icon name="arrows-sort" size="sm" />
          </button>
        )}
        {group && editMode === 'remove' && (
          <input
            type="checkbox"
            className="mlist-check"
            aria-label={`Select group ${group.name}`}
            checked={groupSelected}
            onChange={() => toggleRemoveGroupId(group.id)}
          />
        )}
        <button
          type="button"
          className="mlist-collapse"
          onClick={() => onToggleCollapse(key)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand group' : 'Collapse group'}
        >
          <Icon name={collapsed ? 'chevron-right' : 'chevron-down'} size="sm" />
        </button>
        {group ? (
          <button
            type="button"
            className="mlist-group-name"
            onClick={(event) => !editMode && props.onOpenGroup(group, event.currentTarget)}
          >
            {group.name}
          </button>
        ) : (
          <span className="mlist-group-name">Ungrouped</span>
        )}
        <span className="mlist-count">{entries.length}</span>
        {showGroupTotals && <span className="mlist-group-total">{formatCurrency(monthTotal(entries, month))}</span>}
      </div>
      {!collapsed && (
        <SortableScope enabled={ordering} sensors={sensors} items={entries.map((entry) => entry.id)} onDragEnd={(event) => props.onEntryDragEnd(entries, event)}>
          <ul className="mlist-rows">
            {entries.map((entry) => (
              <ListEntry
                key={entry.id}
                entry={entry}
                month={month}
                tags={props.tagsByEntry.get(entry.id)}
                ordering={ordering}
                selected={props.selection?.kind === 'cell' && props.selection.entryId === entry.id && props.selection.month === month}
                removing={props.removingIds.includes(entry.id)}
                onSelect={props.onSelect}
              />
            ))}
          </ul>
        </SortableScope>
      )}
    </section>
  );
}

const ListEntry = memo(function ListEntry({ entry, month, tags, ordering, selected, removing, onSelect }: {
  entry: EntryRowData;
  month: MonthKey;
  tags: Record<string, EntryTag | undefined> | undefined;
  ordering: boolean;
  selected: boolean;
  removing: boolean;
  onSelect: (entryId: number, month: string) => void;
}) {
  const editMode = useAppStore((s) => s.editMode);
  const toggleRemoveId = useAppStore((s) => s.toggleRemoveId);
  const removeSelected = useAppStore((s) => s.removeSelection.has(entry.id));
  const sortable = useSortable({ id: entry.id, disabled: !ordering });
  const index = MONTHS.indexOf(month);
  const value = monthValue(entry, month);
  const valueText = formatMonthValue(value);
  const previous = index > 0 ? monthValue(entry, MONTHS[index - 1]) : null;
  const tag = tags?.[month];
  const tagText = tag?.text?.trim();
  const tagHasColor = Boolean(tag && tag.color !== 'none');
  const noteId = tagText ? `mlist-note-${entry.id}-${month}` : undefined;
  const comment = entry.comment?.trim();
  const style: CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: 'none',
    ...(tag && (tagHasColor || tagText) ? { '--tag-c': tagHasColor ? `var(--tag-${tag.color})` : 'var(--text-3)' } : {}),
  } as CSSProperties;

  return (
    <li
      ref={sortable.setNodeRef}
      style={style}
      data-entry-id={entry.id}
      className={[
        'mlist-item',
        (tagHasColor || tagText) && 'is-tagged',
        selected && 'is-active',
        editMode === 'remove' && removeSelected && 'is-selected',
        removing && 'fade-out',
        sortable.isDragging && 'is-dragging',
      ].filter(Boolean).join(' ')}
    >
      {ordering && (
        <button type="button" className="mlist-handle" {...sortable.attributes} {...sortable.listeners} aria-label={`Reorder ${entry.name}`}>
          <Icon name="arrows-sort" size="sm" />
        </button>
      )}
      {editMode === 'remove' && (
        <input
          type="checkbox"
          className="mlist-check"
          aria-label={`Select ${entry.name}`}
          checked={removeSelected}
          onChange={() => toggleRemoveId(entry.id)}
        />
      )}
      <button
        type="button"
        className="mlist-row"
        data-month={month}
        // Same name as the grid cell, so the entry and month identify it on both layouts.
        aria-label={`${entry.name}, ${month}: ${valueText}`}
        aria-describedby={noteId}
        aria-current={selected ? 'true' : undefined}
        disabled={Boolean(editMode)}
        onClick={() => onSelect(entry.id, month)}
      >
        <span className="mlist-row-text">
          <span className="mlist-row-name">
            {entry.name}
            {comment && <Icon name="message" size="sm" className="mlist-comment" />}
          </span>
          <span className="mlist-row-sub">
            {index > 0 ? `${MONTHS[index - 1]} ${formatMonthValue(previous)}` : 'First month'}
            {tagText ? ` · ${tagText}` : ''}
          </span>
        </span>
        <span className={`mlist-row-value ${value === null ? 'is-empty' : ''}`}>{valueText}</span>
      </button>
      {noteId && <span id={noteId} className="sr-only">{tagText}</span>}
    </li>
  );
});
