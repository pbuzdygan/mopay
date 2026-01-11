import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '../store';
import { Api } from '../api';
import { MONTHS } from '../utils/months';
import { formatCurrency, parseCurrencyInputNullable } from '../utils/currency';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Surface } from './Surface';
import { TagEditorPopover, type TagColor } from './TagEditorPopover';

function useEntries() {
  const { tab, year } = useAppStore();
  const type = tab === 'incomes' ? 'income' : 'expense';
  return useQuery({ enabled: !!year, queryKey: ['entries', type, year], queryFn: () => Api.entries.list(type as 'income'|'expense', year!) });
}

const GRID_TEMPLATE =
  'grid grid-cols-[44px_160px_repeat(12,72px)_78px_72px]';
type EntryTag = { id: number; entryId: number; month: string; color: TagColor; text?: string | null };
type EntryGroup = { id: number; name: string; sortIndex: number };

function GroupRowSortable({
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
  groupEntries: any[];
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
      className={`${GRID_TEMPLATE} table-group-row gap-1.5 px-3 py-1 items-center text-[0.72rem] ${removingGroupIds.includes(group.id) ? 'fade-out' : ''}`}
    >
      <div className="col-span-2 flex items-center gap-2 text-textPrim">
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
          {isCollapsed ? '▸' : '▾'}
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
}

function Row({
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
  e: any;
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

  const { editMode, toggleRemoveId, removeSelection, setComment } = useAppStore();
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
                  table-row-premium gap-1.5 px-3 py-1.5 items-center text-[0.72rem]
                  ${isDragging ? 'dragging' : ''}
                  ${editMode === 'remove' && removeSelection.has(e.id) ? 'row-remove-selected' : ''}
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
          <div className="group-picker mode-enter" title="Change group">
            <span className="group-picker-icon" aria-hidden="true">🔀</span>
            <select
              className="group-picker-select"
              value={e.groupId ?? ''}
              onChange={(ev) => {
                const raw = ev.target.value;
                onGroupChange(e.id, raw ? Number(raw) : null);
              }}
              aria-label="Group"
            >
              <option value="">Ungrouped</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
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
            checked={removeSelection.has(e.id)}
            onChange={() => toggleRemoveId(e.id)}
          />
        ) : (
          <button
            title={e.comment ? 'Has comment' : 'Add comment'}
            className={`table-comment-btn mode-enter ${e.comment ? 'active' : ''}`}
            onClick={()=> setComment(e.id, e.comment||'')}
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
                setMonthDraft(monthNumbers[m] === null || monthNumbers[m] === undefined ? '-' : formatCurrency(monthNumbers[m] ?? 0));
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
}

export function TableView() {
  const { tab, year, editMode, clearRemove, removeSelection } = useAppStore() as any;
  const type = tab === 'incomes' ? 'income' : 'expense';
  const showGroupTotals = useAppStore((s) => s.showGroupTotals);
  const groupRemoveSelection = useAppStore((s) => s.groupRemoveSelection);
  const toggleRemoveGroupId = useAppStore((s) => s.toggleRemoveGroupId);
  const qc = useQueryClient();
  const { data } = useEntries();
  const groupsQuery = useQuery({
    enabled: !!year,
    queryKey: ['entry-groups', type, year],
    queryFn: () => Api.entryGroups.list(type as 'income' | 'expense', year!),
  });
  const tagsQuery = useQuery({
    enabled: !!year,
    queryKey: ['tags', year],
    queryFn: () => Api.tags.list(year!),
  });
  const entriesData = (data?.entries ?? []) as any[];
  const groups = (groupsQuery.data?.groups ?? []) as EntryGroup[];
  const [rows, setRows] = useState<any[]>(entriesData);
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
    setRows(entriesData);
  }, [entriesData]);

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

  const tagsByEntry = useMemo(() => {
    const map = new Map<number, Record<string, EntryTag>>();
    const list = (tagsQuery.data?.tags ?? []) as EntryTag[];
    for (const tag of list) {
      if (!map.has(tag.entryId)) map.set(tag.entryId, {});
      map.get(tag.entryId)![tag.month] = tag;
    }
    return map;
  }, [tagsQuery.data]);

  // Bulk remove
  // Bulk remove z animacją shake
  useEffect(() => {
    const onBulkRemove = async () => {
      const ids = Array.from(removeSelection);
      const groupIds = Array.from(groupRemoveSelection);
      if (!ids.length && !groupIds.length) return;
  
      // 🔹 Uruchamiamy lokalną animację
      setRemovingIds(ids);
      setRemovingGroupIds(groupIds);
  
      // 🔹 Odczekaj czas animacji zanim backend faktycznie usunie dane
      await new Promise((r) => setTimeout(r, 600));
  
      if (groupIds.length) {
        await Api.entryGroups.remove(groupIds);
      }
      if (ids.length) {
        await Api.entries.remove(ids);
      }
      clearRemove();
      useAppStore.getState().setEditMode(null);
      qc.invalidateQueries({ queryKey: ['entries', type, year] });
      qc.invalidateQueries({ queryKey: ['entry-groups', type, year] });
      if (year) qc.invalidateQueries({ queryKey: ['tags', year] });
  
      // 🔹 Reset lokalnych flag po chwili
      setTimeout(() => {
        setRemovingIds([]);
        setRemovingGroupIds([]);
      }, 400);
    };
  
    window.addEventListener('bulk:remove', onBulkRemove as any);
    return () => window.removeEventListener('bulk:remove', onBulkRemove as any);
  }, [removeSelection, groupRemoveSelection, clearRemove, qc, type, year]);
  
  
  


  // DnD
  const sensors = useSensors(useSensor(PointerSensor));

  function handleDragEnd(groupEntries: any[], event: any) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
  
    const oldIndex = groupEntries.findIndex(e => e.id === active.id);
    const newIndex = groupEntries.findIndex(e => e.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const moved = arrayMove(groupEntries, oldIndex, newIndex);
    const orderedIds = moved.map((e) => e.id);
    const sortMap = new Map<number, number>();
    orderedIds.forEach((id, idx) => sortMap.set(id, idx + 1));

    setRows((prev) =>
      prev.map((row) => (sortMap.has(row.id) ? { ...row, sort_index: sortMap.get(row.id) } : row))
    );
    const queryKey = ['entries', type, year]; // ✅ dopasowujemy klucz cache
  
    // 🔹 natychmiastowy lokalny update w React Query
    qc.setQueryData(queryKey, (old: any) => ({
      ...(old ?? {}),
      entries: (old?.entries ?? []).map((row: any) =>
        sortMap.has(row.id) ? { ...row, sort_index: sortMap.get(row.id) } : row
      ),
    }));

    // 🔹 zapis do backendu (bez natychmiastowego refetch)
    Api.entries.reorder(orderedIds)
      .then(() => {
        // ⚙️ Czekamy chwilę, żeby backend zapisał, ale nie psujemy wizualnego stanu
        setTimeout(() => {
          qc.invalidateQueries({ queryKey, refetchType: 'inactive' });
        }, 1200);
      })

      .catch(err => console.error('Reorder failed:', err));
  }

  const handleGroupDragEnd = async (event: any) => {
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
    const map = new Map<number | null, any[]>();
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

  const computeGroupTotals = (list: any[]) => {
    const sums = new Array(12).fill(0);
    for (const e of list) {
      MONTHS.forEach((m, i) => {
        sums[i] += Number(e[m] ?? (m === 'Dec' ? e.Decm : e[m]) ?? 0);
      });
    }
    const totalSum = sums.reduce((a, b) => a + b, 0);
    const totalAvg = sums.length ? totalSum / sums.length : 0;
    return { sums, totalSum, totalAvg };
  };

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
    setRows((prev) => prev.map((row) => (row.id === entryId ? { ...row, groupId } : row)));
    await Api.entries.patch(entryId, { groupId });
    if (year) qc.invalidateQueries({ queryKey: ['entries', type, year] });
  };


  const totals = useMemo(()=>{
    const sums = new Array(12).fill(0);
    for (const e of rows) { MONTHS.forEach((m,i)=> sums[i]+= Number(e[m] ?? (m === 'Dec' ? e.Decm : e[m]) ?? 0)); }
    const totalSum = sums.reduce((a,b)=>a+b,0);
    const totalAvg = sums.length ? totalSum/sums.length : 0;
    return { sums, totalSum, totalAvg };
  }, [rows]);

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
        <div className="overflow-x-auto">
          <div
            className="inline-block min-w-full space-y-3 px-3 sm:px-4 py-4"
            style={{ width: 'max-content' }}
          >
            <div className={`table-header-premium ${GRID_TEMPLATE} gap-1.5 px-3 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-textSec`}>
              <div className="text-center">💬</div>
              <div>{tab === 'incomes' ? 'Incomes' : 'Expenses'}</div>
              {MONTHS.map(m=> <div key={m} className="text-right">{m}</div>)}
              <div className="text-right">Sum</div>
              <div className="text-right">Avg</div>
            </div>

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
                      const totals = computeGroupTotals(groupEntries);
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
                                  {groupEntries.map((e: any) => (
                                    <Row
                                      key={e.id}
                                      e={e}
                                      editingNameId={editingNameId}
                                      setEditingNameId={setEditingNameId}
                                      removingIds={removingIds}
                                      onNameUpdate={(name) => setRows((prev) => prev.map((row) => (row.id === e.id ? { ...row, name } : row)))}
                                  onMonthUpdate={(month, value) =>
                                    setRows((prev) =>
                                      prev.map((row) =>
                                        row.id === e.id ? { ...row, [month === 'Dec' ? 'Decm' : month]: value } : row
                                      )
                                    )
                                  }
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
                      const totals = computeGroupTotals(groupEntries);
                      const shouldRender = groupEntries.length > 0 || sortedGroups.length === 0;
                      if (!shouldRender) return null;
                      return (
                        <div key={groupKey} className="space-y-2">
                          <div className={`${GRID_TEMPLATE} table-group-row gap-1.5 px-3 py-1 items-center text-[0.72rem]`}>
                            <div className="col-span-2 flex items-center gap-2 text-textPrim">
                              <button
                                type="button"
                                className="group-toggle"
                                onClick={() => setGroupCollapsed(groupKey, !isCollapsed)}
                                aria-label={isCollapsed ? 'Expand group' : 'Collapse group'}
                              >
                                {isCollapsed ? '▸' : '▾'}
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
                                  {groupEntries.map((e: any) => (
                                    <Row
                                      key={e.id}
                                      e={e}
                                      editingNameId={editingNameId}
                                      setEditingNameId={setEditingNameId}
                                      removingIds={removingIds}
                                      onNameUpdate={(name) => setRows((prev) => prev.map((row) => (row.id === e.id ? { ...row, name } : row)))}
                                  onMonthUpdate={(month, value) =>
                                    setRows((prev) =>
                                      prev.map((row) =>
                                        row.id === e.id ? { ...row, [month === 'Dec' ? 'Decm' : month]: value } : row
                                      )
                                    )
                                  }
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
                  const totals = computeGroupTotals(groupEntries);
                  return (
                    <div key={groupKey} className="space-y-2">
                      <div className={`${GRID_TEMPLATE} table-group-row gap-1.5 px-3 py-1 items-center text-[0.72rem] ${removingGroupIds.includes(g.id) ? 'fade-out' : ''}`}>
                        <div className="col-span-2 flex items-center gap-2 text-textPrim">
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
                            {isCollapsed ? '▸' : '▾'}
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
                          {groupEntries.map((e: any) => (
                            <Row
                              key={e.id}
                              e={e}
                              editingNameId={editingNameId}
                              setEditingNameId={setEditingNameId}
                              removingIds={removingIds}
                              onNameUpdate={(name) => setRows((prev) => prev.map((row) => (row.id === e.id ? { ...row, name } : row)))}
                                  onMonthUpdate={(month, value) =>
                                    setRows((prev) =>
                                      prev.map((row) =>
                                        row.id === e.id ? { ...row, [month === 'Dec' ? 'Decm' : month]: value } : row
                                      )
                                    )
                                  }
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
                  const totals = computeGroupTotals(groupEntries);
                  const shouldRender = groupEntries.length > 0 || sortedGroups.length === 0;
                  if (!shouldRender) return null;
                  return (
                    <div key={groupKey} className="space-y-2">
                      <div className={`${GRID_TEMPLATE} table-group-row gap-1.5 px-3 py-1 items-center text-[0.72rem]`}>
                        <div className="col-span-2 flex items-center gap-2 text-textPrim">
                          <button
                            type="button"
                            className="group-toggle"
                            onClick={() => setGroupCollapsed(groupKey, !isCollapsed)}
                            aria-label={isCollapsed ? 'Expand group' : 'Collapse group'}
                          >
                            {isCollapsed ? '▸' : '▾'}
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
                          {groupEntries.map((e: any) => (
                            <Row
                              key={e.id}
                              e={e}
                              editingNameId={editingNameId}
                              setEditingNameId={setEditingNameId}
                              removingIds={removingIds}
                              onNameUpdate={(name) => setRows((prev) => prev.map((row) => (row.id === e.id ? { ...row, name } : row)))}
                                  onMonthUpdate={(month, value) =>
                                    setRows((prev) =>
                                      prev.map((row) =>
                                        row.id === e.id ? { ...row, [month === 'Dec' ? 'Decm' : month]: value } : row
                                      )
                                    )
                                  }
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

            <div className={`table-total-premium ${GRID_TEMPLATE} gap-1.5 px-3 py-2 font-semibold text-[0.72rem]`}>
              <div />
              <div className="font-semibold">Total</div>
              {totals.sums.map((v,i)=> (
                <div key={i} className="text-right font-semibold">
                  {formatCurrency(v)}
                </div>
              ))}
              <div className="text-right font-semibold">{formatCurrency(totals.totalSum)}</div>
              <div className="text-right font-semibold">{formatCurrency(totals.totalAvg)}</div>
            </div>
          </div>
        </div>
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
