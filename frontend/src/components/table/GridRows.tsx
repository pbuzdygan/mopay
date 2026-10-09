import { memo, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { DndContext, closestCenter, type DragEndEvent, type SensorDescriptor, type SensorOptions } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAppStore } from '../../store';
import { MONTHS, type MonthKey } from '../../utils/months';
import { formatCurrency, formatCurrencyPlain, parseCurrencyInputNullable } from '../../utils/currency';
import { Icon } from '../ui';
import type { EntryGroup, EntryRowData, EntryTag } from './types';

export type Totals = { sums: number[]; totalSum: number; totalAvg: number };

export const makeGroupTotals = (list: EntryRowData[]): Totals => {
  const sums = new Array(12).fill(0);
  for (const e of list) {
    MONTHS.forEach((m, i) => {
      sums[i] += Number(e[m as keyof EntryRowData] ?? (m === 'Dec' ? e.Decm : e[m as keyof EntryRowData]) ?? 0);
    });
  }
  const totalSum = sums.reduce((a, b) => a + b, 0);
  const totalAvg = sums.length ? totalSum / sums.length : 0;
  return { sums, totalSum, totalAvg };
};

/**
 * dnd-kit sortable list when Arrange is active, plain children otherwise.
 * The accessibility nodes go to document.body: inline they would be <div>s
 * inside <table>/<tbody>.
 */
export function SortableScope({
  enabled,
  sensors,
  items,
  onDragEnd,
  children,
}: {
  enabled: boolean;
  sensors: SensorDescriptor<SensorOptions>[];
  items: number[];
  onDragEnd: (event: DragEndEvent) => void;
  children: ReactNode;
}) {
  if (!enabled) return <>{children}</>;
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{ container: document.body }}
    >
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

function GroupCells({
  lead,
  name,
  entryCount,
  isCollapsed,
  totals,
  showGroupTotals,
  currentMonth,
  onToggleCollapse,
}: {
  lead?: ReactNode;
  name: ReactNode;
  entryCount: number;
  isCollapsed: boolean;
  totals: Totals;
  showGroupTotals: boolean;
  currentMonth: MonthKey | null;
  onToggleCollapse: () => void;
}) {
  return (
    <>
      <th scope="rowgroup" className="ledger-col-name">
        <div className="ledger-name">
          {lead}
          <button
            type="button"
            className="ledger-collapse"
            onClick={onToggleCollapse}
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? 'Expand group' : 'Collapse group'}
          >
            <Icon name={isCollapsed ? 'chevron-right' : 'chevron-down'} size="sm" />
          </button>
          {name}
          <span className="ledger-count">{entryCount}</span>
        </div>
      </th>
      {MONTHS.map((m, idx) => (
        <td key={m} className={m === currentMonth ? 'is-current' : undefined}>
          {showGroupTotals ? formatCurrency(totals.sums[idx] ?? 0) : null}
        </td>
      ))}
      <td className="ledger-col-sum">{showGroupTotals ? formatCurrency(totals.totalSum) : null}</td>
      <td className="ledger-col-avg">{showGroupTotals ? formatCurrency(totals.totalAvg) : null}</td>
    </>
  );
}

type GroupRowProps = {
  /** null = the Ungrouped section, which has no details and cannot be arranged or removed. */
  group: EntryGroup | null;
  entryCount: number;
  isCollapsed: boolean;
  totals: Totals;
  showGroupTotals: boolean;
  currentMonth: MonthKey | null;
  onToggleCollapse: () => void;
  onOpenDetails?: (opener: HTMLElement) => void;
  removing?: boolean;
  /** The inspector shows this group. */
  active?: boolean;
};

export const GroupRow = memo(function GroupRow({ group, onOpenDetails, removing, active, ...cells }: GroupRowProps) {
  const editMode = useAppStore((s) => s.editMode);
  const toggleRemoveGroupId = useAppStore((s) => s.toggleRemoveGroupId);
  const isSelected = useAppStore((s) => (group ? s.groupRemoveSelection.has(group.id) : false));
  const selected = editMode === 'remove' && isSelected;
  const name = !group ? (
    <span className="ledger-group-name">Ungrouped</span>
  ) : (
    <button
      type="button"
      className="ledger-group-name ledger-name-button"
      onClick={(event) => !editMode && onOpenDetails?.(event.currentTarget)}
    >
      {group.name}
    </button>
  );
  return (
    <tr className={`ledger-group ${selected ? 'is-selected' : ''} ${active ? 'is-active' : ''} ${removing ? 'fade-out' : ''}`}>
      <GroupCells
        {...cells}
        name={name}
        lead={group && editMode === 'remove' ? (
          <input
            type="checkbox"
            className="ledger-check"
            aria-label={`Select group ${group.name}`}
            checked={isSelected}
            onChange={() => toggleRemoveGroupId(group.id)}
          />
        ) : null}
      />
    </tr>
  );
});

/** Group row in Arrange mode: the row is the dnd-kit node, the handle the activator. */
export const SortableGroupRow = memo(function SortableGroupRow({ group, ...cells }: Omit<GroupRowProps, 'group' | 'onOpenDetails' | 'removing' | 'active'> & { group: EntryGroup }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({ id: group.id });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: 'none',
    opacity: isDragging ? 0.9 : 1,
  };
  return (
    <tr ref={setNodeRef} style={style} className={`ledger-group ${isDragging ? 'is-dragging' : ''}`}>
      <GroupCells
        {...cells}
        name={<span className="ledger-group-name">{group.name}</span>}
        lead={(
          <button type="button" className="ledger-handle" {...attributes} {...listeners} aria-label={`Reorder group ${group.name}`}>
            <Icon name="arrows-sort" size="sm" />
          </button>
        )}
      />
    </tr>
  );
});

const TAG_NAMES: Record<string, string> = { grey: 'Grey', green: 'Green', orange: 'Orange', red: 'Red' };

/** Month value of an entry (December is stored as `Decm`). */
export const monthValue = (e: EntryRowData, month: string): number | null => {
  const raw = month === 'Dec' ? e.Decm : e[month as Exclude<MonthKey, 'Dec'>];
  return raw === null || raw === undefined ? null : Number(raw);
};

export const formatMonthValue = (value: number | null) => (value === null ? '-' : formatCurrency(value));
export const plainMonthValue = (value: number | null) => (value === null ? '-' : formatCurrencyPlain(value));

/** Allowed while typing a value: digits, separators, spaces and minus. */
export const filterValueInput = (text: string) => text.replace(/[^\d,.\s-]/g, '');

// A printable key that starts editing in place, like a spreadsheet (plan D4).
const STARTS_EDIT = /^[\d,.-]$/;

export const EntryRow = memo(function EntryRow({
  e,
  removing,
  currentMonth,
  tags,
  selectedMonth,
  rowSelected,
  activeMonth,
  onSelectCell,
  onFocusCell,
  onSaveMonth,
  onMoveFrom,
  onOpenDetails,
}: {
  e: EntryRowData;
  removing: boolean;
  currentMonth: MonthKey | null;
  tags: Record<string, EntryTag | undefined>;
  /** Month of the selected cell when it is in this row. */
  selectedMonth: string | null;
  /** The inspector shows this entry (cell or name). */
  rowSelected: boolean;
  /** Month cell of this row in the Tab order (roving tabindex), if any. */
  activeMonth: string | null;
  onSelectCell: (entryId: number, month: string, options?: { focusInspector?: boolean }) => void;
  onFocusCell: (entryId: number, month: string) => void;
  onSaveMonth: (entry: EntryRowData, month: string, value: number | null) => void;
  /** Tab/Shift+Tab in the in-place editor saves and moves to the next/previous month. */
  onMoveFrom: (entryId: number, month: string, key: 'ArrowRight' | 'ArrowLeft') => void;
  onOpenDetails: (entry: EntryRowData, opener: HTMLElement) => void;
}) {
  const editMode = useAppStore((s) => s.editMode);
  const toggleRemoveId = useAppStore((s) => s.toggleRemoveId);
  const isRemoveSelected = useAppStore((s) => s.removeSelection.has(e.id));
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({ id: e.id });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging || editMode === 'order' ? 'none' : 'transform 120ms ease-out',
  };
  const demo = useAppStore((s) => s.demo);
  const canEditValues = demo === false && !editMode;
  const rowRef = useRef<HTMLTableRowElement | null>(null);
  const refocusMonth = useRef<string | null>(null);
  // Set once an edit is saved or cancelled, so the input's later blur does nothing.
  const editClosed = useRef(false);

  const [editingMonth, setEditingMonth] = useState<string | null>(null);
  const [monthDraft, setMonthDraft] = useState('');

  useEffect(() => {
    if (editMode) {
      setEditingMonth(null);
    }
  }, [editMode]);

  // Keyboard-ended edits return focus to the cell; a blur leaves focus where the user went.
  useEffect(() => {
    if (editingMonth !== null || !refocusMonth.current) return;
    rowRef.current?.querySelector<HTMLButtonElement>(`button[data-month="${refocusMonth.current}"]`)?.focus();
    refocusMonth.current = null;
  }, [editingMonth]);

  const values = useMemo(() => MONTHS.map((m) => monthValue(e, m)), [e]);
  const rowSum = values.reduce<number>((sum, v) => sum + (v ?? 0), 0);
  const filled = values.filter((v) => v !== null).length;
  const rowAvg = filled ? rowSum / filled : 0;

  const startEdit = (month: string, draft: string) => {
    if (!canEditValues) return;
    editClosed.current = false;
    setEditingMonth(month);
    setMonthDraft(draft);
  };

  // F07 rules: Enter and blur save, Escape reverts, '-' = no value, empty = 0.
  const saveMonth = (month: string) => {
    if (editClosed.current) return;
    editClosed.current = true;
    setEditingMonth(null);
    onSaveMonth(e, month, parseCurrencyInputNullable(monthDraft));
  };

  const comment = e.comment?.trim();
  const selected = editMode === 'remove' && isRemoveSelected;
  const setRowRef = (node: HTMLTableRowElement | null) => {
    rowRef.current = node;
    setNodeRef(node);
  };

  return (
    <tr
      ref={setRowRef}
      data-entry-id={e.id}
      style={style}
      className={`ledger-entry ${isDragging ? 'is-dragging' : ''} ${selected ? 'is-selected' : ''} ${rowSelected ? 'is-active' : ''} ${removing ? 'fade-out' : ''}`}
    >
      <th scope="row" className="ledger-col-name">
        <div className="ledger-name">
          {editMode === 'order' ? (
            <button type="button" className="ledger-handle" {...attributes} {...listeners} aria-label={`Reorder ${e.name}`}>
              <Icon name="arrows-sort" size="sm" />
            </button>
          ) : editMode === 'remove' ? (
            <input
              type="checkbox"
              className="ledger-check"
              aria-label={`Select ${e.name}`}
              checked={isRemoveSelected}
              onChange={() => toggleRemoveId(e.id)}
            />
          ) : null}
          <button
            type="button"
            className="ledger-name-button"
            onClick={(ev) => !editMode && onOpenDetails(e, ev.currentTarget)}
          >
            {e.name}
          </button>
          {comment && (
            <span className="ledger-comment" role="img" aria-label="Has a comment" title={comment}>
              <Icon name="message" size="sm" />
            </span>
          )}
        </div>
      </th>
      {MONTHS.map((m, index) => {
        const tag = tags?.[m];
        const tagText = tag?.text?.trim();
        const tagHasColor = Boolean(tag && tag.color !== 'none');
        const value = values[index];
        const valueText = formatMonthValue(value);
        const noteId = tagText ? `ledger-note-${e.id}-${m}` : undefined;
        const isSelectedCell = selectedMonth === m;
        const cellClass = [
          'ledger-cell',
          m === currentMonth && 'is-current',
          value === null && 'is-empty',
          tagHasColor && 'is-tagged',
          tagText && 'has-note',
          isSelectedCell && 'is-selected-cell',
        ].filter(Boolean).join(' ');
        return (
          <td
            key={m}
            className={cellClass}
            style={tag && (tagHasColor || tagText) ? ({ '--tag-c': tagHasColor ? `var(--tag-${tag.color})` : 'var(--text-3)' } as CSSProperties) : undefined}
            title={tagText || (tagHasColor ? `${TAG_NAMES[tag!.color] ?? tag!.color} tag` : undefined)}
          >
            {(canEditValues && editingMonth === m) ? (
              <input
                className="ledger-input"
                aria-label={`${e.name}, ${m}`}
                value={monthDraft}
                onChange={(ev) => setMonthDraft(filterValueInput(ev.target.value))}
                onBlur={() => saveMonth(m)}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter') {
                    refocusMonth.current = m;
                    saveMonth(m);
                  } else if (ev.key === 'Escape') {
                    // Handled here so the inspector stays open; the next Escape closes it.
                    ev.preventDefault();
                    editClosed.current = true;
                    refocusMonth.current = m;
                    setEditingMonth(null);
                  } else if (ev.key === 'Tab') {
                    ev.preventDefault();
                    saveMonth(m);
                    onMoveFrom(e.id, m, ev.shiftKey ? 'ArrowLeft' : 'ArrowRight');
                  }
                }}
                autoFocus
                inputMode="decimal"
              />
            ) : (
              <button
                type="button"
                className="ledger-value"
                data-month={m}
                tabIndex={activeMonth === m ? 0 : -1}
                // Name includes the visible value; tests locate cells by entry and month.
                aria-label={`${e.name}, ${m}: ${valueText}`}
                aria-describedby={noteId}
                aria-current={isSelectedCell ? 'true' : undefined}
                aria-keyshortcuts="Enter Shift+Enter"
                onFocus={() => onFocusCell(e.id, m)}
                onClick={() => {
                  if (!editMode) onSelectCell(e.id, m);
                }}
                onDoubleClick={() => startEdit(m, plainMonthValue(value))}
                onKeyDown={(ev) => {
                  if (editMode || ev.altKey || ev.ctrlKey || ev.metaKey) return;
                  if (ev.key === 'Enter' && ev.shiftKey) {
                    ev.preventDefault();
                    onSelectCell(e.id, m, { focusInspector: true });
                  } else if (ev.key === 'Enter' || ev.key === 'F2') {
                    ev.preventDefault();
                    startEdit(m, plainMonthValue(value));
                  } else if (canEditValues && STARTS_EDIT.test(ev.key)) {
                    ev.preventDefault();
                    startEdit(m, ev.key);
                  }
                }}
              >
                {valueText}
              </button>
            )}
            {/* The note stays in the DOM for assistive technology; `title` shows it on hover. */}
            {noteId && <span id={noteId} className="sr-only">{tagText}</span>}
          </td>
        );
      })}
      <td className="ledger-col-sum">{formatCurrency(rowSum)}</td>
      <td className="ledger-col-avg">{formatCurrency(rowAvg)}</td>
    </tr>
  );
});
