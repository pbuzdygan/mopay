import { memo, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { DndContext, closestCenter, type DragEndEvent, type SensorDescriptor, type SensorOptions } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAppStore } from '../../store';
import { Api } from '../../api';
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
  onOpenDetails?: () => void;
  removing?: boolean;
};

export const GroupRow = memo(function GroupRow({ group, onOpenDetails, removing, ...cells }: GroupRowProps) {
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
      onClick={() => !editMode && onOpenDetails?.()}
    >
      {group.name}
    </button>
  );
  return (
    <tr className={`ledger-group ${selected ? 'is-selected' : ''} ${removing ? 'fade-out' : ''}`}>
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
export const SortableGroupRow = memo(function SortableGroupRow({ group, ...cells }: Omit<GroupRowProps, 'group' | 'onOpenDetails' | 'removing'> & { group: EntryGroup }) {
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

export const EntryRow = memo(function EntryRow({
  e,
  removing,
  currentMonth,
  onMonthUpdate,
  tags,
  onRequestTag,
  onOpenDetails,
}: {
  e: EntryRowData;
  removing: boolean;
  currentMonth: MonthKey | null;
  onMonthUpdate: (month: string, value: number | null) => void;
  tags: Record<string, EntryTag | undefined>;
  onRequestTag: (entryId: number, month: string, target: HTMLButtonElement, tag?: EntryTag) => void;
  onOpenDetails: (entry: EntryRowData) => void;
}) {
  const editMode = useAppStore((s) => s.editMode);
  const toggleRemoveId = useAppStore((s) => s.toggleRemoveId);
  const isRemoveSelected = useAppStore((s) => s.removeSelection.has(e.id));
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({ id: e.id });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging || editMode === 'order' ? 'none' : 'transform 120ms ease-out',
  };
  const isTagMode = editMode === 'tag';
  const demo = useAppStore((s) => s.demo);
  const canEditValues = demo === false && !editMode;

  const initialNumbers = useMemo(() => {
    const map: Record<string, number | null> = {};
    MONTHS.forEach((m) => {
      const raw = m === 'Dec' ? e.Decm : e[m];
      map[m] = raw === null || raw === undefined ? null : Number(raw);
    });
    return map;
  }, [e]);

  const [monthNumbers, setMonthNumbers] = useState<Record<string, number | null>>(initialNumbers);
  const [editingMonth, setEditingMonth] = useState<string | null>(null);
  const [monthDraft, setMonthDraft] = useState('');

  useEffect(() => {
    setMonthNumbers(initialNumbers);
  }, [initialNumbers]);

  useEffect(() => {
    if (editMode) {
      setEditingMonth(null);
    }
  }, [editMode]);

  const rowSum = useMemo(() => {
    return MONTHS.reduce((sum, m) => sum + (monthNumbers[m] ?? 0), 0);
  }, [monthNumbers]);

  const rowAvg = useMemo(() => {
    const count = MONTHS.reduce((acc, m) => acc + (monthNumbers[m] === null || monthNumbers[m] === undefined ? 0 : 1), 0);
    return count ? rowSum / count : 0;
  }, [rowSum, monthNumbers]);

  // Known gap (plan F07): a failed save is not surfaced; Phase 4 adds error and retry.
  async function saveMonth(month: string) {
    const num = parseCurrencyInputNullable(monthDraft);
    setMonthNumbers((prev) => ({ ...prev, [month]: num }));
    onMonthUpdate(month, num);
    setEditingMonth(null);
    await Api.entries.patch(e.id, { [month]: num });
  }

  const comment = e.comment?.trim();
  const selected = editMode === 'remove' && isRemoveSelected;

  return (
    <tr
      ref={setNodeRef}
      data-entry-id={e.id}
      style={style}
      className={`ledger-entry ${isDragging ? 'is-dragging' : ''} ${selected ? 'is-selected' : ''} ${removing ? 'fade-out' : ''}`}
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
            onClick={() => !editMode && onOpenDetails(e)}
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
      {MONTHS.map((m) => {
        const tag = tags?.[m];
        const tagText = tag?.text?.trim();
        const tagHasColor = Boolean(tag && tag.color !== 'none');
        const value = monthNumbers[m];
        const valueText = value === null || value === undefined ? '-' : formatCurrency(value);
        const noteId = tagText ? `ledger-note-${e.id}-${m}` : undefined;
        const cellClass = [
          'ledger-cell',
          m === currentMonth && 'is-current',
          valueText === '-' && 'is-empty',
          tagHasColor && 'is-tagged',
          tagText && 'has-note',
          isTagMode && 'is-tag-target',
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
                onChange={(ev) => {
                  const next = ev.target.value.replace(/[^\d,.\s-]/g, '');
                  setMonthDraft(next);
                }}
                onBlur={() => saveMonth(m)}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter') saveMonth(m);
                  if (ev.key === 'Escape') {
                    setMonthDraft(valueText);
                    setEditingMonth(null);
                  }
                }}
                autoFocus
                inputMode="decimal"
              />
            ) : (
              <button
                type="button"
                className="ledger-value"
                // Name includes the visible value; tests locate cells by entry and month.
                aria-label={`${e.name}, ${m}: ${valueText}`}
                aria-describedby={noteId}
                onClick={(ev) => {
                  if (isTagMode) {
                    onRequestTag(e.id, m, ev.currentTarget, tag);
                    return;
                  }
                  if (!canEditValues) return;
                  setEditingMonth(m);
                  setMonthDraft(value === null || value === undefined ? '-' : formatCurrencyPlain(value));
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
