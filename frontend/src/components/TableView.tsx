import { memo, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '../store';
import { Api } from '../api';
import { getCurrentMonthForYear, MONTHS } from '../utils/months';
import { formatCurrency, formatCurrencyPlain, parseCurrencyInputNullable } from '../utils/currency';
import { DndContext, closestCenter, PointerSensor, type DragEndEvent, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion, useAnimationControls } from 'framer-motion';
import { Surface } from './Surface';
import { TagEditorPopover, type TagColor } from './TagEditorPopover';
import { DropdownItem, DropdownMenu } from './DropdownMenu';
import { TableHeaderRow, TableTotalRow } from './table/TableGridRows';
import { useTableQueryState } from './table/useTableQueryState';
import type { EntryGroup, EntryPatch, EntryRowData, EntryTag } from './table/types';

const GRID_TEMPLATE =
  'grid grid-cols-[28px_176px_repeat(12,72px)_78px_72px]';

const normalizeEntryMonthKey = (month: string) => (month === 'Dec' ? 'Decm' : month);
const makeGroupTotals = (list: EntryRowData[]) => {
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

const GroupRowSortable = memo(function GroupRowSortable({
  group,
  groupEntries,
  isCollapsed,
  totals,
  showGroupTotals,
  editMode,
  removingGroupIds,
  groupRemoveSelection,
  onToggleRemoveGroup,
  onToggleCollapse,
  editingGroupId,
  groupNameDraft,
  setGroupNameDraft,
  onGroupNameSave,
  onGroupNameEdit,
}: {
  group: EntryGroup;
  groupEntries: EntryRowData[];
  isCollapsed: boolean;
  totals: { sums: number[]; totalSum: number; totalAvg: number };
  showGroupTotals: boolean;
  editMode: string;
  removingGroupIds: number[];
  groupRemoveSelection: Set<number>;
  onToggleRemoveGroup: (groupId: number) => void;
  onToggleCollapse: () => void;
  editingGroupId: number | null;
  groupNameDraft: string;
  setGroupNameDraft: (value: string) => void;
  onGroupNameSave: (groupId: number) => void;
  onGroupNameEdit: (group: EntryGroup) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({ id: group.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: 'none',
    opacity: isDragging ? 0.9 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${GRID_TEMPLATE} table-group-row gap-1 pl-0 pr-3 py-1 items-center text-[0.72rem] ${removingGroupIds.includes(group.id) ? 'fade-out' : ''}`}
    >
      <div className="col-span-2 group-leading flex items-center gap-2 text-textPrim">
        {editMode === 'remove' ? (
          <input
            type="checkbox"
            className="remove-checkbox remove-checkbox-group mode-enter"
            checked={groupRemoveSelection.has(group.id)}
            onChange={() => onToggleRemoveGroup(group.id)}
          />
        ) : null}
        <button
          type="button"
          className="order-handle group-order-handle mode-enter"
          {...attributes}
          {...listeners}
          aria-label="Reorder group"
        >
          ↕
        </button>
        <button
          type="button"
          className="group-toggle"
          onClick={onToggleCollapse}
          aria-label={isCollapsed ? 'Expand group' : 'Collapse group'}
        >
          <span className="group-toggle-icon">{isCollapsed ? '▸' : '▾'}</span>
        </button>
        {editMode === 'name' && editingGroupId === group.id ? (
          <input
            autoFocus
            className="group-name-input"
            maxLength={40}
            value={groupNameDraft}
            onChange={(ev) => setGroupNameDraft(ev.target.value)}
            onBlur={() => onGroupNameSave(group.id)}
            onKeyDown={(ev) => {
              if (ev.key === 'Enter') onGroupNameSave(group.id);
              if (ev.key === 'Escape') {
                setGroupNameDraft('');
              }
            }}
          />
        ) : (
          <button
            type="button"
            className={`table-name group-name ${editMode === 'name' ? 'is-editable' : ''}`}
            onClick={() => {
              if (editMode !== 'name') return;
              onGroupNameEdit(group);
            }}
          >
            <span className="font-semibold">{group.name}</span>{' '}
            <span className="text-textSec">({groupEntries.length})</span>
          </button>
        )}
      </div>
      {MONTHS.map((m, idx) => (
        <div key={m} className="text-right text-textSec">
          {showGroupTotals ? formatCurrency(totals.sums[idx] ?? 0) : null}
        </div>
      ))}
      <div className="text-right text-textSec">{showGroupTotals ? formatCurrency(totals.totalSum) : null}</div>
      <div className="text-right text-textSec">{showGroupTotals ? formatCurrency(totals.totalAvg) : null}</div>
    </div>
  );
});

const Row = memo(function Row({
  e,
  editingNameId,
  setEditingNameId,
  removingIds,
  onNameUpdate,
  onMonthUpdate,
  groups,
  onGroupChange,
  tags,
  onRequestTag,
  onTagHint,
}: {
  e: EntryRowData;
  editingNameId: number | null;
  setEditingNameId: (id: number | null) => void;
  removingIds: number[];
  onNameUpdate: (name: string) => void;
  onMonthUpdate: (month: string, value: number | null) => void;
  groups: EntryGroup[];
  onGroupChange: (entryId: number, groupId: number | null) => void;
  tags: Record<string, EntryTag | undefined>;
  onRequestTag: (entryId: number, month: string, target: HTMLButtonElement, tag?: EntryTag) => void;
  onTagHint: () => void;
}) {
  const editMode = useAppStore((s) => s.editMode);
  const toggleRemoveId = useAppStore((s) => s.toggleRemoveId);
  const isRemoveSelected = useAppStore((s) => s.removeSelection.has(e.id));
  const setComment = useAppStore((s) => s.setComment);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: e.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging || editMode === 'order' ? 'none' : 'transform 120ms ease-out',
  };
  const isTagMode = editMode === 'tag';
  const isNameMode = editMode === 'name';
  const canEditValues = !editMode;

  const initialNumbers = useMemo(() => {
    const map: Record<string, number | null> = {};
    MONTHS.forEach((m) => {
      const raw = m === 'Dec' ? e.Decm : e[m];
      map[m] = raw === null || raw === undefined ? null : Number(raw);
    });
    return map;
  }, [e]);

  const [nameValue, setNameValue] = useState(e.name);
  const [monthNumbers, setMonthNumbers] = useState<Record<string, number | null>>(initialNumbers);
  const [editingMonth, setEditingMonth] = useState<string | null>(null);
  const [monthDraft, setMonthDraft] = useState('');

  useEffect(() => {
    setNameValue(e.name);
  }, [e.name]);

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

  async function saveName() {
    const trimmed = nameValue.trim().slice(0, 40);
    if (!trimmed) {
      setNameValue(e.name);
      setEditingNameId(null);
      return;
    }
    setNameValue(trimmed);
    onNameUpdate(trimmed);
    setEditingNameId(null);
    await Api.entries.patch(e.id, { name: trimmed });
  }

  async function saveMonth(month: string) {
    const num = parseCurrencyInputNullable(monthDraft);
    setMonthNumbers((prev) => ({ ...prev, [month]: num }));
    onMonthUpdate(month, num);
    setEditingMonth(null);
    await Api.entries.patch(e.id, { [month]: num });
  }

  return (
    <div
      ref={setNodeRef}
      data-entry-id={e.id}
      style={style}
      className={`${GRID_TEMPLATE}
                  table-row-premium gap-1 pl-0 pr-3 py-1.5 items-center text-[0.72rem]
                  ${isDragging ? 'dragging' : ''}
                  ${editMode === 'remove' && isRemoveSelected ? 'row-remove-selected' : ''}
                  ${removingIds.includes(e.id) ? 'fade-out' : ''}`}
    >

      <div className="row-leading" key={`lead-${editMode || 'view'}`}>
        {editMode === 'order' ? (
          <button
            {...attributes}
            {...listeners}
            className="order-handle mode-enter"
            style={{ background: 'var(--panel-subtle)' }}
            aria-label="Reorder"
          >
            ↕
          </button>
        ) : editMode === 'group' ? (
          <DropdownMenu
            label={<span className="group-picker-icon" aria-hidden="true">🔀</span>}
            align="left"
            buttonClassName="group-picker-btn mode-enter"
            buttonAriaLabel="Change group"
            buttonTooltip="Change group"
            showCaret={false}
          >
            {({ close }) => (
              <>
                <DropdownItem
                  onSelect={() => {
                    onGroupChange(e.id, null);
                    close();
                  }}
                >
                  Ungrouped
                </DropdownItem>
                {groups.map((g) => (
                  <DropdownItem
                    key={g.id}
                    onSelect={() => {
                      onGroupChange(e.id, g.id);
                      close();
                    }}
                  >
                    {g.name}
                  </DropdownItem>
                ))}
              </>
            )}
          </DropdownMenu>
        ) : editMode === 'tag' ? (
          <button
            type="button"
            className="tag-mode-icon mode-enter"
            aria-label="Tagging help"
            onClick={onTagHint}
          >
            🏷️
          </button>
        ) : editMode === 'name' ? (
          <div className="mode-indicator mode-enter" aria-hidden="true">
            ✏️
          </div>
        ) : editMode === 'remove' ? (
          <input
            type="checkbox"
            className="remove-checkbox mode-enter"
            checked={isRemoveSelected}
            onChange={() => toggleRemoveId(e.id)}
          />
        ) : (
          <button
            className={`table-comment-btn mode-enter ui-tooltip ${e.comment ? 'active' : ''}`}
            onClick={()=> setComment(e.id, e.comment||'')}
            aria-label={e.comment ? 'Has comment' : 'Add comment'}
            data-tooltip={e.comment ? 'Has comment' : 'Add comment'}
          >
            💬
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 text-textPrim">

        {editingNameId===e.id ? (
          <input
            autoFocus
            className="table-name-input"
            maxLength={40}
            value={nameValue}
            onChange={(ev)=> setNameValue(ev.target.value)}
            onBlur={saveName}
            onKeyDown={(ev)=> {
              if (ev.key === 'Enter') saveName();
              if (ev.key === 'Escape') {
                setNameValue(e.name);
                setEditingNameId(null);
              }
            }}
          />
        ) : (
          <div className="flex items-center gap-2 w-full min-w-0">
            <button
              className={`table-name flex-1 min-w-0 truncate ${isNameMode ? 'is-editable' : ''}`}
              onClick={()=>{ if (editMode==='name') setEditingNameId(e.id); }}
            >
              {nameValue}
            </button>
          </div>
        )}
      </div>
      {MONTHS.map((m)=> {
        const tag = tags?.[m];
        const tagText = tag?.text?.trim();
        const tagHasColor = Boolean(tag && tag.color !== 'none');
        return (
        <div key={m} className="text-right">
          {(canEditValues && !isTagMode && editingMonth === m) ? (
            <input
              className="table-input"
              value={monthDraft}
              onChange={(ev)=> {
                const value = ev.target.value.replace(/[^\d,.\s-]/g, '');
                setMonthDraft(value);
              }}
              onBlur={()=> saveMonth(m)}
              onKeyDown={(ev)=> {
                if (ev.key === 'Enter') saveMonth(m);
                if (ev.key === 'Escape') {
                  setMonthDraft(monthNumbers[m] === null || monthNumbers[m] === undefined ? '-' : formatCurrency(monthNumbers[m] ?? 0));
                  setEditingMonth(null);
                }
              }}
              autoFocus
              inputMode="decimal"
            />
          ) : (
            <div className={`table-value-wrapper ${tagHasColor ? 'has-tag' : ''}`}>
              <button
                className={`table-value ${tagHasColor ? `has-tag tag-color-${tag!.color}` : ''}`}
                onClick={(ev)=> {
                if (isTagMode) {
                  onRequestTag(e.id, m, ev.currentTarget, tag);
                  return;
                }
                if (!canEditValues) return;
                setEditingMonth(m);
                setMonthDraft(monthNumbers[m] === null || monthNumbers[m] === undefined ? '-' : formatCurrencyPlain(monthNumbers[m] ?? 0));
              }}
            >
                {monthNumbers[m] === null || monthNumbers[m] === undefined ? '-' : formatCurrency(monthNumbers[m] ?? 0)}
              </button>
              {tagText && (
                <span className="tag-tooltip">{tagText}</span>
              )}
            </div>
          )}
        </div>
      )})}
      <div className="text-right text-textPrim">{formatCurrency(rowSum)}</div>
      <div className="text-right text-textSec">{formatCurrency(rowAvg)}</div>
    </div>
  );
});

export function TableView() {
  const tab = useAppStore((s) => s.tab);
  const year = useAppStore((s) => s.year);
  const editMode = useAppStore((s) => s.editMode);
  const clearRemove = useAppStore((s) => s.clearRemove);
  const removeSelection = useAppStore((s) => s.removeSelection);
  const groupRemoveSelection = useAppStore((s) => s.groupRemoveSelection);
  const toggleRemoveGroupId = useAppStore((s) => s.toggleRemoveGroupId);
  const bulkRemoveRequestId = useAppStore((s) => s.bulkRemoveRequestId);
  const tableTab = tab === 'incomes' ? 'incomes' : 'expenses';
  const type = tableTab === 'incomes' ? 'income' : 'expense';
  const currentMonth = getCurrentMonthForYear(year);
  const showGroupTotals = useAppStore((s) => s.showGroupTotals);
  const qc = useQueryClient();
  const fadeControls = useAnimationControls();
  const [hasRendered, setHasRendered] = useState(false);
  const { rows, groups, tagsByEntry, patchEntryLocal, setEntryOverrides } = useTableQueryState({
    type,
    year,
  });
  const [editingNameId, setEditingNameId] = useState<number|null>(null);
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [groupNameDraft, setGroupNameDraft] = useState('');
  const [removingIds, setRemovingIds] = useState<number[]>([]);
  const [removingGroupIds, setRemovingGroupIds] = useState<number[]>([]);
  const [tagEditor, setTagEditor] = useState<null | { entryId: number; month: string; rect: DOMRect; color: TagColor; text: string }>(null);
  const [tagSaving, setTagSaving] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [groupOrder, setGroupOrder] = useState<number[] | null>(null);

  useEffect(() => {
    setHasRendered(true);
  }, []);

  useEffect(() => {
    if (!hasRendered) return;
    let cancelled = false;
    (async () => {
      await fadeControls.start({
        opacity: 0.55,
        transition: { duration: 0.08, ease: 'easeOut' },
      });
      if (cancelled) return;
      await fadeControls.start({
        opacity: 1,
        transition: { duration: 0.14, ease: 'easeOut' },
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [fadeControls, hasRendered, type, year]);

  useEffect(() => {
    setEditingGroupId(null);
    setGroupNameDraft('');
  }, [editMode]);


  useEffect(() => {
    if (!year) return;
    const key = `group-collapsed:${type}:${year}`;
    try {
      const raw = localStorage.getItem(key);
      setCollapsedGroups(raw ? (JSON.parse(raw) as Record<string, boolean>) : {});
    } catch {
      setCollapsedGroups({});
    }
  }, [type, year]);

  useEffect(() => {
    setGroupOrder(null);
  }, [type, year]);

  const setGroupCollapsed = (groupKey: string, collapsed: boolean) => {
    if (!year) return;
    setCollapsedGroups((prev) => {
      const next = { ...prev, [groupKey]: collapsed };
      try {
        localStorage.setItem(`group-collapsed:${type}:${year}`, JSON.stringify(next));
      } catch {}
      return next;
    });
  };


  useEffect(() => {
    if (editMode !== 'tag') setTagEditor(null);
  }, [editMode]);

  const queryKey = ['entries', type, year];

  // Bulk remove (with shake animation), decoupled from window events.
  useEffect(() => {
    const runBulkRemove = async () => {
      const ids = Array.from(removeSelection);
      const groupIds = Array.from(groupRemoveSelection);
      if (!ids.length && !groupIds.length) return;

      setRemovingIds(ids);
      setRemovingGroupIds(groupIds);

      await new Promise((r) => setTimeout(r, 600));
      try {
        if (groupIds.length) {
          await Api.entryGroups.remove(groupIds);
        }
        if (ids.length) {
          await Api.entries.remove(ids);
        }
        clearRemove();
        useAppStore.getState().setEditMode(null);
        qc.invalidateQueries({ queryKey });
        qc.invalidateQueries({ queryKey: ['entry-groups', type, year] });
        if (year) qc.invalidateQueries({ queryKey: ['tags', year] });
      } finally {
        setTimeout(() => {
          setRemovingIds([]);
          setRemovingGroupIds([]);
        }, 400);
      }
    };
    void runBulkRemove();
  }, [bulkRemoveRequestId]);

  // DnD
  const sensors = useSensors(useSensor(PointerSensor));

  function handleDragEnd(groupEntries: EntryRowData[], event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = groupEntries.findIndex(e => e.id === active.id);
    const newIndex = groupEntries.findIndex(e => e.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const moved = arrayMove(groupEntries, oldIndex, newIndex);
    const orderedIds = moved.map((e) => e.id);
    const sortMap = new Map<number, number>();
    orderedIds.forEach((id, idx) => sortMap.set(id, idx + 1));

    setEntryOverrides((prev) => {
      const next = { ...prev };
      sortMap.forEach((value, entryId) => {
        next[entryId] = { ...(next[entryId] ?? {}), sort_index: value };
      });
      return next;
    });

    qc.setQueryData(queryKey, (old: { entries?: EntryRowData[] } | undefined) => ({
      ...(old ?? {}),
      entries: (old?.entries ?? []).map((row) =>
        sortMap.has(row.id) ? { ...row, sort_index: sortMap.get(row.id) } : row
      ),
    }));

    Api.entries.reorder(orderedIds)
      .then(() => {
        setTimeout(() => {
          qc.invalidateQueries({ queryKey, refetchType: 'inactive' });
        }, 1200);
      })
      .catch((err) => console.error('Reorder failed:', err));
  }

  const handleGroupDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const orderedIds = sortedGroups.map((g) => g.id);
    const oldIndex = orderedIds.findIndex((id) => id === active.id);
    const newIndex = orderedIds.findIndex((id) => id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const nextOrder = arrayMove(orderedIds, oldIndex, newIndex);
    setGroupOrder(nextOrder);
    await Api.entryGroups.reorder({ type, year: year!, orderedIds: nextOrder });
    if (year) qc.invalidateQueries({ queryKey: ['entry-groups', type, year] });
  };

  const entriesByGroup = useMemo(() => {
    const map = new Map<number | null, EntryRowData[]>();
    for (const e of rows) {
      const key = e.groupId ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    for (const [key, list] of map) {
      list.sort((a, b) => (a.sort_index ?? 0) - (b.sort_index ?? 0) || a.id - b.id);
      map.set(key, list);
    }
    return map;
  }, [rows]);

  const sortedGroups = useMemo(() => {
    const list = [...groups];
    list.sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0) || a.id - b.id);
    if (!groupOrder || !groupOrder.length) return list;
    const orderIndex = new Map(groupOrder.map((id, idx) => [id, idx]));
    return list.slice().sort((a, b) => {
      const ai = orderIndex.has(a.id) ? orderIndex.get(a.id)! : Number.MAX_SAFE_INTEGER;
      const bi = orderIndex.has(b.id) ? orderIndex.get(b.id)! : Number.MAX_SAFE_INTEGER;
      if (ai !== bi) return ai - bi;
      return (a.sortIndex ?? 0) - (b.sortIndex ?? 0) || a.id - b.id;
    });
  }, [groups, groupOrder]);

  const handleGroupNameSave = async (groupId: number) => {
    const trimmed = groupNameDraft.trim().slice(0, 40);
    if (!trimmed) {
      setEditingGroupId(null);
      setGroupNameDraft('');
      return;
    }
    await Api.entryGroups.patch(groupId, { name: trimmed });
    setEditingGroupId(null);
    setGroupNameDraft('');
    if (year) qc.invalidateQueries({ queryKey: ['entry-groups', type, year] });
  };

  const handleEntryGroupChange = async (entryId: number, groupId: number | null) => {
    patchEntryLocal(entryId, { groupId });
    await Api.entries.patch(entryId, { groupId });
    if (year) qc.invalidateQueries({ queryKey: ['entries', type, year] });
  };


  const totals = useMemo(()=>{
    return makeGroupTotals(rows);
  }, [rows]);

  const handleRowNameUpdate = (entryId: number, name: string) => patchEntryLocal(entryId, { name });
  const handleRowMonthUpdate = (entryId: number, month: string, value: number | null) =>
    patchEntryLocal(entryId, { [normalizeEntryMonthKey(month)]: value } as EntryPatch);

  const handleTagRequest = (entryId: number, month: string, target: HTMLButtonElement, tag?: EntryTag) => {
    if (editMode !== 'tag') return;
    const rect = target.getBoundingClientRect();
    setTagEditor({
      entryId,
      month,
      rect,
      color: (tag?.color ?? 'none') as TagColor,
      text: tag?.text ?? '',
    });
  };

  const handleTagHint = () => {
    window.dispatchEvent(new CustomEvent('tags:hint'));
  };

  const handleTagSave = async () => {
    if (!tagEditor) return;
    setTagSaving(true);
    try {
      const trimmed = tagEditor.text.trim();
      if (tagEditor.color === 'none' && !trimmed) {
        await Api.tags.remove(tagEditor.entryId, tagEditor.month);
      } else {
        await Api.tags.save({
          entryId: tagEditor.entryId,
          month: tagEditor.month,
          color: tagEditor.color,
          text: trimmed,
        });
      }
      if (year) qc.invalidateQueries({ queryKey: ['tags', year] });
      setTagEditor(null);
    } finally {
      setTagSaving(false);
    }
  };

  const handleTagClear = async () => {
    if (!tagEditor) return;
    setTagSaving(true);
    try {
      await Api.tags.remove(tagEditor.entryId, tagEditor.month);
      if (year) qc.invalidateQueries({ queryKey: ['tags', year] });
      setTagEditor(null);
    } finally {
      setTagSaving(false);
    }
  };

  return (
    <div className="stack">
      <Surface variant="table">
        <motion.div animate={fadeControls} initial={{ opacity: 1 }}>
          <div className="overflow-x-auto">
            <div
              className="inline-block min-w-full space-y-3 px-3 sm:px-4 py-4"
              style={{ width: 'max-content' }}
            >
            <TableHeaderRow gridTemplate={GRID_TEMPLATE} tab={tableTab} currentMonth={currentMonth} />

            {editMode==='order' ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleGroupDragEnd}
              >
                <SortableContext items={sortedGroups.map((g) => g.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {sortedGroups.map((g) => {
                      const groupKey = `g:${g.id}`;
                      const groupEntries = entriesByGroup.get(g.id) ?? [];
                      const isCollapsed = Boolean(collapsedGroups[groupKey]);
                      const totals = makeGroupTotals(groupEntries);
                      return (
                        <div key={groupKey} className="space-y-2">
                          <GroupRowSortable
                            group={g}
                            groupEntries={groupEntries}
                            isCollapsed={isCollapsed}
                            totals={totals}
                            showGroupTotals={showGroupTotals}
                            editMode={editMode}
                            removingGroupIds={removingGroupIds}
                            groupRemoveSelection={groupRemoveSelection}
                            onToggleRemoveGroup={toggleRemoveGroupId}
                            onToggleCollapse={() => setGroupCollapsed(groupKey, !isCollapsed)}
                            editingGroupId={editingGroupId}
                            groupNameDraft={groupNameDraft}
                            setGroupNameDraft={setGroupNameDraft}
                            onGroupNameSave={handleGroupNameSave}
                            onGroupNameEdit={(group) => {
                              setEditingGroupId(group.id);
                              setGroupNameDraft(group.name);
                            }}
                          />

                          {!isCollapsed && (
                            <DndContext
                              sensors={sensors}
                              collisionDetection={closestCenter}
                              onDragEnd={(event) => handleDragEnd(groupEntries, event)}
                            >
                              <SortableContext items={groupEntries.map((e) => e.id)} strategy={verticalListSortingStrategy}>
                                <div className="space-y-2">
                                  {groupEntries.map((e) => (
                                    <Row
                                      key={e.id}
                                      e={e}
                                      editingNameId={editingNameId}
                                      setEditingNameId={setEditingNameId}
                                      removingIds={removingIds}
                                      onNameUpdate={(name) => handleRowNameUpdate(e.id, name)}
                                      onMonthUpdate={(month, value) => handleRowMonthUpdate(e.id, month, value)}
                                      groups={sortedGroups}
                                      onGroupChange={handleEntryGroupChange}
                                      tags={tagsByEntry.get(e.id) ?? {}}
                                      onRequestTag={handleTagRequest}
                                      onTagHint={handleTagHint}
                                    />
                                  ))}
                                </div>
                              </SortableContext>
                            </DndContext>
                          )}
                        </div>
                      );
                    })}

                    {(() => {
                      const groupKey = 'ungrouped';
                      const groupEntries = entriesByGroup.get(null) ?? [];
                      const isCollapsed = Boolean(collapsedGroups[groupKey]);
                      const totals = makeGroupTotals(groupEntries);
                      const shouldRender = groupEntries.length > 0 || sortedGroups.length === 0;
                      if (!shouldRender) return null;
                      return (
                        <div key={groupKey} className="space-y-2">
                          <div className={`${GRID_TEMPLATE} table-group-row gap-1 pl-0 pr-3 py-1 items-center text-[0.72rem]`}>
                            <div className="col-span-2 group-leading flex items-center gap-2 text-textPrim">
                              <button
                                type="button"
                                className="group-toggle"
                                onClick={() => setGroupCollapsed(groupKey, !isCollapsed)}
                                aria-label={isCollapsed ? 'Expand group' : 'Collapse group'}
                              >
                                <span className="group-toggle-icon">{isCollapsed ? '▸' : '▾'}</span>
                              </button>
                              <span className="font-semibold group-name-label">
                                <span>Ungrouped</span>
                                <span className="text-textSec">({groupEntries.length})</span>
                              </span>
                            </div>
                            {MONTHS.map((m, idx) => (
                              <div key={m} className="text-right text-textSec">
                                {showGroupTotals ? formatCurrency(totals.sums[idx] ?? 0) : null}
                              </div>
                            ))}
                            <div className="text-right text-textSec">{showGroupTotals ? formatCurrency(totals.totalSum) : null}</div>
                            <div className="text-right text-textSec">{showGroupTotals ? formatCurrency(totals.totalAvg) : null}</div>
                          </div>

                          {!isCollapsed && (
                            <DndContext
                              sensors={sensors}
                              collisionDetection={closestCenter}
                              onDragEnd={(event) => handleDragEnd(groupEntries, event)}
                            >
                              <SortableContext items={groupEntries.map((e) => e.id)} strategy={verticalListSortingStrategy}>
                                <div className="space-y-2">
                                  {groupEntries.map((e) => (
                                    <Row
                                      key={e.id}
                                      e={e}
                                      editingNameId={editingNameId}
                                      setEditingNameId={setEditingNameId}
                                      removingIds={removingIds}
                                      onNameUpdate={(name) => handleRowNameUpdate(e.id, name)}
                                      onMonthUpdate={(month, value) => handleRowMonthUpdate(e.id, month, value)}
                                      groups={sortedGroups}
                                      onGroupChange={handleEntryGroupChange}
                                      tags={tagsByEntry.get(e.id) ?? {}}
                                      onRequestTag={handleTagRequest}
                                      onTagHint={handleTagHint}
                                    />
                                  ))}
                                </div>
                              </SortableContext>
                            </DndContext>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <div className="space-y-2">
                {sortedGroups.map((g) => {
                  const groupKey = `g:${g.id}`;
                  const groupEntries = entriesByGroup.get(g.id) ?? [];
                  const isCollapsed = Boolean(collapsedGroups[groupKey]);
                  const totals = makeGroupTotals(groupEntries);
                  return (
                    <div key={groupKey} className="space-y-2">
                      <div className={`${GRID_TEMPLATE} table-group-row gap-1 pl-0 pr-3 py-1 items-center text-[0.72rem] ${removingGroupIds.includes(g.id) ? 'fade-out' : ''}`}>
                        <div className="col-span-2 group-leading flex items-center gap-2 text-textPrim">
                          {editMode === 'remove' ? (
                            <input
                              type="checkbox"
                              className="remove-checkbox remove-checkbox-group mode-enter"
                              checked={groupRemoveSelection.has(g.id)}
                              onChange={() => toggleRemoveGroupId(g.id)}
                            />
                          ) : null}
                          <button
                            type="button"
                            className="group-toggle"
                            onClick={() => setGroupCollapsed(groupKey, !isCollapsed)}
                            aria-label={isCollapsed ? 'Expand group' : 'Collapse group'}
                          >
                            <span className="group-toggle-icon">{isCollapsed ? '▸' : '▾'}</span>
                          </button>
                          {editMode === 'name' && editingGroupId === g.id ? (
                            <input
                              autoFocus
                              className="group-name-input"
                              maxLength={40}
                              value={groupNameDraft}
                              onChange={(ev) => setGroupNameDraft(ev.target.value)}
                              onBlur={() => handleGroupNameSave(g.id)}
                              onKeyDown={(ev) => {
                                if (ev.key === 'Enter') handleGroupNameSave(g.id);
                                if (ev.key === 'Escape') {
                                  setEditingGroupId(null);
                                  setGroupNameDraft('');
                                }
                              }}
                            />
                          ) : (
                            <button
                              type="button"
                              className={`table-name group-name ${editMode === 'name' ? 'is-editable' : ''}`}
                              onClick={() => {
                                if (editMode !== 'name') return;
                                setEditingGroupId(g.id);
                                setGroupNameDraft(g.name);
                              }}
                            >
                              <span className="font-semibold">{g.name}</span>{' '}
                              <span className="text-textSec">({groupEntries.length})</span>
                            </button>
                          )}
                        </div>
                        {MONTHS.map((m, idx) => (
                          <div key={m} className="text-right text-textSec">
                            {showGroupTotals ? formatCurrency(totals.sums[idx] ?? 0) : null}
                          </div>
                        ))}
                        <div className="text-right text-textSec">{showGroupTotals ? formatCurrency(totals.totalSum) : null}</div>
                        <div className="text-right text-textSec">{showGroupTotals ? formatCurrency(totals.totalAvg) : null}</div>
                      </div>

                      {!isCollapsed && (
                        <div className="space-y-2">
                          {groupEntries.map((e) => (
                            <Row
                              key={e.id}
                              e={e}
                              editingNameId={editingNameId}
                              setEditingNameId={setEditingNameId}
                              removingIds={removingIds}
                              onNameUpdate={(name) => handleRowNameUpdate(e.id, name)}
                              onMonthUpdate={(month, value) => handleRowMonthUpdate(e.id, month, value)}
                              groups={sortedGroups}
                              onGroupChange={handleEntryGroupChange}
                              tags={tagsByEntry.get(e.id) ?? {}}
                              onRequestTag={handleTagRequest}
                              onTagHint={handleTagHint}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {(() => {
                  const groupKey = 'ungrouped';
                  const groupEntries = entriesByGroup.get(null) ?? [];
                  const isCollapsed = Boolean(collapsedGroups[groupKey]);
                  const totals = makeGroupTotals(groupEntries);
                  const shouldRender = groupEntries.length > 0 || sortedGroups.length === 0;
                  if (!shouldRender) return null;
                  return (
                    <div key={groupKey} className="space-y-2">
                      <div className={`${GRID_TEMPLATE} table-group-row gap-1 pl-0 pr-3 py-1 items-center text-[0.72rem]`}>
                        <div className="col-span-2 group-leading flex items-center gap-2 text-textPrim">
                          <button
                            type="button"
                            className="group-toggle"
                            onClick={() => setGroupCollapsed(groupKey, !isCollapsed)}
                            aria-label={isCollapsed ? 'Expand group' : 'Collapse group'}
                          >
                            <span className="group-toggle-icon">{isCollapsed ? '▸' : '▾'}</span>
                          </button>
                          <span className="font-semibold group-name-label">
                            <span>Ungrouped</span>
                            <span className="text-textSec">({groupEntries.length})</span>
                          </span>
                        </div>
                        {MONTHS.map((m, idx) => (
                          <div key={m} className="text-right text-textSec">
                            {showGroupTotals ? formatCurrency(totals.sums[idx] ?? 0) : null}
                          </div>
                        ))}
                        <div className="text-right text-textSec">{showGroupTotals ? formatCurrency(totals.totalSum) : null}</div>
                        <div className="text-right text-textSec">{showGroupTotals ? formatCurrency(totals.totalAvg) : null}</div>
                      </div>
                      {!isCollapsed && (
                        <div className="space-y-2">
                          {groupEntries.map((e) => (
                            <Row
                              key={e.id}
                              e={e}
                              editingNameId={editingNameId}
                              setEditingNameId={setEditingNameId}
                              removingIds={removingIds}
                              onNameUpdate={(name) => handleRowNameUpdate(e.id, name)}
                              onMonthUpdate={(month, value) => handleRowMonthUpdate(e.id, month, value)}
                              groups={sortedGroups}
                              onGroupChange={handleEntryGroupChange}
                              tags={tagsByEntry.get(e.id) ?? {}}
                              onRequestTag={handleTagRequest}
                              onTagHint={handleTagHint}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            <TableTotalRow gridTemplate={GRID_TEMPLATE} totals={totals} />
            </div>
          </div>
        </motion.div>
      </Surface>

      {tagEditor && (
        <TagEditorPopover
          month={tagEditor.month}
          color={tagEditor.color}
          text={tagEditor.text}
          anchor={tagEditor.rect}
          saving={tagSaving}
          onChange={(patch) =>
            setTagEditor((prev) => (prev ? { ...prev, ...patch } : prev))
          }
          onSave={handleTagSave}
          onClear={handleTagClear}
          onClose={() => !tagSaving && setTagEditor(null)}
        />
      )}
    </div>
  );
}
