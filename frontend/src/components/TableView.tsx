import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '../store';
import { Api } from '../api';
import { getCurrentMonthForYear } from '../utils/months';
import { includesSearch, normalizeSearchText } from '../utils/search';
import { PointerSensor, type DragEndEvent, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { TagEditorPopover, type TagColor } from './TagEditorPopover';
import { TableHeaderRow, TableTotalRow } from './table/TableGridRows';
import { EntryRow, GroupRow, SortableGroupRow, SortableScope, makeGroupTotals } from './table/GridRows';
import { GridSummary } from './table/GridSummary';
import { BulkRemoveBar, ModeBanner } from './table/EditModeBars';
import { useTableQueryState } from './table/useTableQueryState';
import { TableContextPanel, type TableContextTarget } from './table/TableContextPanel';
import type { EntryPatch, EntryRowData, EntryTag } from './table/types';

// Name column + 12 months + Sum + Avg.
const COLUMN_COUNT = 15;

const normalizeEntryMonthKey = (month: string) => (month === 'Dec' ? 'Decm' : month);

export function TableView() {
  const tab = useAppStore((s) => s.tab);
  const year = useAppStore((s) => s.year);
  const editMode = useAppStore((s) => s.editMode);
  const setEditMode = useAppStore((s) => s.setEditMode);
  const openAddEntry = useAppStore((s) => s.openAddEntry);
  const clearRemove = useAppStore((s) => s.clearRemove);
  const removeSelection = useAppStore((s) => s.removeSelection);
  const groupRemoveSelection = useAppStore((s) => s.groupRemoveSelection);
  const demo = useAppStore((s) => s.demo);
  const tableTab = tab === 'incomes' ? 'incomes' : 'expenses';
  const type = tableTab === 'incomes' ? 'income' : 'expense';
  const currentMonth = getCurrentMonthForYear(year);
  const showGroupTotals = useAppStore((s) => s.showGroupTotals);
  const searchQuery = useAppStore((s) => s.searchQuery);
  const qc = useQueryClient();
  const { loaded, rows, groups, tagsByEntry, patchEntryLocal, setEntryOverrides } = useTableQueryState({
    type,
    year,
  });
  const [removingIds, setRemovingIds] = useState<number[]>([]);
  const [removingGroupIds, setRemovingGroupIds] = useState<number[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [tagEditor, setTagEditor] = useState<null | { entryId: number; month: string; rect: DOMRect; color: TagColor; text: string }>(null);
  const [tagSaving, setTagSaving] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [groupOrder, setGroupOrder] = useState<number[] | null>(null);
  const [contextTarget, setContextTarget] = useState<TableContextTarget | null>(null);
  const normalizedSearch = normalizeSearchText(searchQuery);
  const matchingGroupIds = useMemo(() => {
    if (!normalizedSearch) return new Set<number>();
    return new Set(
      groups
        .filter((group) => includesSearch(group.name, normalizedSearch))
        .map((group) => group.id)
    );
  }, [groups, normalizedSearch]);
  const visibleRows = useMemo(() => {
    if (!normalizedSearch) return rows;
    const matchesUngrouped = 'ungrouped'.includes(normalizedSearch);
    return rows.filter((entry) =>
      includesSearch(entry.name, normalizedSearch)
      || includesSearch(entry.comment, normalizedSearch)
      || (entry.groupId !== null && matchingGroupIds.has(entry.groupId))
      || (entry.groupId === null && matchesUngrouped)
    );
  }, [matchingGroupIds, normalizedSearch, rows]);

  // Restore the current table's groups before paint, including cached tab/year switches.
  useLayoutEffect(() => {
    if (!year) return;
    const key = `${useAppStore.getState().demo ? 'demo-' : ''}group-collapsed:${type}:${year}`;
    try {
      const raw = localStorage.getItem(key);
      setCollapsedGroups(raw ? (JSON.parse(raw) as Record<string, boolean>) : {});
    } catch {
      setCollapsedGroups({});
    }
  }, [type, year]);

  useEffect(() => {
    setGroupOrder(null);
    setContextTarget(null);
  }, [type, year]);

  useEffect(() => {
    setContextTarget(null);
  }, [normalizedSearch]);

  const setGroupCollapsed = (groupKey: string, collapsed: boolean) => {
    if (!year) return;
    setCollapsedGroups((prev) => {
      const next = { ...prev, [groupKey]: collapsed };
      try {
        localStorage.setItem(`${useAppStore.getState().demo ? 'demo-' : ''}group-collapsed:${type}:${year}`, JSON.stringify(next));
      } catch {}
      return next;
    });
  };


  useEffect(() => {
    if (editMode !== 'tag') setTagEditor(null);
  }, [editMode]);

  const queryKey = ['entries', type, year];

  useEffect(() => {
    if (editMode !== 'remove') setBulkError(null);
  }, [editMode]);

  // Bulk remove after confirmation in the bulk bar (fade-out, then groups before entries).
  const removeSelected = async () => {
    const ids = Array.from(removeSelection);
    const groupIds = Array.from(groupRemoveSelection);
    if (!ids.length && !groupIds.length) return;

    setBulkError(null);
    setBulkBusy(true);
    setRemovingIds(ids);
    setRemovingGroupIds(groupIds);

    await new Promise((r) => setTimeout(r, 600));
    let removed = false;
    try {
      if (groupIds.length) {
        await Api.entryGroups.remove(groupIds);
        // Already removed: a retry after a failed entry removal must not resend them.
        useAppStore.setState({ groupRemoveSelection: new Set<number>() });
      }
      if (ids.length) {
        await Api.entries.remove(ids);
      }
      removed = true;
      clearRemove();
      useAppStore.getState().setEditMode(null);
    } catch {
      setBulkError('Could not remove the selection. Try again.');
    } finally {
      // Refresh on failure too: a removal may have partly succeeded.
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ['entry-groups', type, year] });
      if (year) qc.invalidateQueries({ queryKey: ['tags', year] });
      setBulkBusy(false);
      setTimeout(() => {
        setRemovingIds([]);
        setRemovingGroupIds([]);
      }, removed ? 400 : 0);
    }
  };

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
    for (const e of visibleRows) {
      const key = e.groupId ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    for (const [key, list] of map) {
      list.sort((a, b) => (a.sort_index ?? 0) - (b.sort_index ?? 0) || a.id - b.id);
      map.set(key, list);
    }
    return map;
  }, [visibleRows]);

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

  const visibleGroups = useMemo(() => {
    if (!normalizedSearch) return sortedGroups;
    return sortedGroups.filter((group) =>
      matchingGroupIds.has(group.id) || entriesByGroup.has(group.id)
    );
  }, [entriesByGroup, matchingGroupIds, normalizedSearch, sortedGroups]);

  const totals = useMemo(()=>{
    return makeGroupTotals(visibleRows);
  }, [visibleRows]);

  const handleRowMonthUpdate = (entryId: number, month: string, value: number | null) => {
    const patch = { [normalizeEntryMonthKey(month)]: value } as EntryPatch;
    patchEntryLocal(entryId, patch);
    // Keep the shared query data current too, so the sidebar totals follow edits.
    qc.setQueryData(queryKey, (old: { entries?: EntryRowData[] } | undefined) => old && ({
      ...old,
      entries: (old.entries ?? []).map((row) => (row.id === entryId ? { ...row, ...patch } : row)),
    }));
  };

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

  const handleContextEntrySave = async (
    entryId: number,
    patch: { name: string; groupId: number | null; comment: string }
  ) => {
    await Api.entries.patch(entryId, patch);
    patchEntryLocal(entryId, patch);
    await qc.invalidateQueries({ queryKey });
  };

  const handleContextGroupSave = async (groupId: number, name: string) => {
    await Api.entryGroups.patch(groupId, { name });
    if (year) await qc.invalidateQueries({ queryKey: ['entry-groups', type, year] });
  };

  const handleContextEntryRemove = async (entryId: number) => {
    await Api.entries.remove([entryId]);
    await qc.invalidateQueries({ queryKey });
    if (year) await qc.invalidateQueries({ queryKey: ['tags', year] });
  };

  const handleContextGroupRemove = async (groupId: number) => {
    await Api.entryGroups.remove([groupId]);
    await Promise.all([
      qc.invalidateQueries({ queryKey }),
      qc.invalidateQueries({ queryKey: ['entry-groups', type, year] }),
    ]);
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

  const ordering = editMode === 'order';
  const renderEntries = (groupEntries: EntryRowData[]) => (
    <SortableScope
      enabled={ordering}
      sensors={sensors}
      items={groupEntries.map((e) => e.id)}
      onDragEnd={(event) => handleDragEnd(groupEntries, event)}
    >
      {groupEntries.map((e) => (
        <EntryRow
          key={e.id}
          e={e}
          removing={removingIds.includes(e.id)}
          currentMonth={currentMonth}
          onMonthUpdate={(month, value) => handleRowMonthUpdate(e.id, month, value)}
          tags={tagsByEntry.get(e.id) ?? {}}
          onRequestTag={handleTagRequest}
          onOpenDetails={(entry) => setContextTarget({ kind: 'entry', entry })}
        />
      ))}
    </SortableScope>
  );

  const ungroupedEntries = entriesByGroup.get(null) ?? [];
  const ungroupedCollapsed = normalizedSearch ? false : Boolean(collapsedGroups.ungrouped);
  const isEmpty = loaded && !normalizedSearch && rows.length === 0 && groups.length === 0;
  const noMatches = Boolean(normalizedSearch) && visibleRows.length === 0 && visibleGroups.length === 0;

  // Remove mode: names for the confirmation; entries of a removed group stay unless selected.
  const selectedEntryNames = rows.filter((e) => removeSelection.has(e.id)).map((e) => e.name);
  const selectedGroups = sortedGroups
    .filter((g) => groupRemoveSelection.has(g.id))
    .map((g) => ({ name: g.name, entryCount: rows.filter((e) => e.groupId === g.id && !removeSelection.has(e.id)).length }));

  return (
    <div className="ledger-view" data-edit-mode={editMode ?? undefined}>
      {editMode ? <ModeBanner mode={editMode} /> : <GridSummary totals={totals} currentMonth={currentMonth} type={type} />}
      <div className="ledger-wrap" data-testid="entry-table">
        <table className="ledger">
          <caption className="sr-only">{type === 'income' ? 'Incomes' : 'Expenses'} {year} by month</caption>
          <TableHeaderRow currentMonth={currentMonth} />
          <SortableScope
            enabled={ordering}
            sensors={sensors}
            items={visibleGroups.map((g) => g.id)}
            onDragEnd={handleGroupDragEnd}
          >
            {visibleGroups.map((g) => {
              const groupKey = `g:${g.id}`;
              const groupEntries = entriesByGroup.get(g.id) ?? [];
              const isCollapsed = normalizedSearch ? false : Boolean(collapsedGroups[groupKey]);
              const groupProps = {
                entryCount: groupEntries.length,
                isCollapsed,
                totals: makeGroupTotals(groupEntries),
                showGroupTotals,
                currentMonth,
                onToggleCollapse: () => setGroupCollapsed(groupKey, !isCollapsed),
              };
              return (
                <tbody key={groupKey}>
                  {ordering ? (
                    <SortableGroupRow group={g} {...groupProps} />
                  ) : (
                    <GroupRow
                      group={g}
                      {...groupProps}
                      removing={removingGroupIds.includes(g.id)}
                      onOpenDetails={() => setContextTarget({ kind: 'group', group: g, entryCount: groupEntries.length })}
                    />
                  )}
                  {!isCollapsed && renderEntries(groupEntries)}
                </tbody>
              );
            })}

            {ungroupedEntries.length > 0 && (
              <tbody key="ungrouped">
                <GroupRow
                  group={null}
                  entryCount={ungroupedEntries.length}
                  isCollapsed={ungroupedCollapsed}
                  totals={makeGroupTotals(ungroupedEntries)}
                  showGroupTotals={showGroupTotals}
                  currentMonth={currentMonth}
                  onToggleCollapse={() => setGroupCollapsed('ungrouped', !ungroupedCollapsed)}
                />
                {!ungroupedCollapsed && renderEntries(ungroupedEntries)}
              </tbody>
            )}
          </SortableScope>

          {(isEmpty || noMatches) && (
            <tbody>
              <tr>
                <td colSpan={COLUMN_COUNT} className="ledger-empty">
                  {noMatches ? (
                    <div role="status">No entries match “{searchQuery.trim()}”.</div>
                  ) : (
                    <div>
                      <strong>No {type === 'income' ? 'incomes' : 'expenses'} in {year} yet.</strong>
                      {!demo && <span> Add the first one with New entry, or create a group to organise them.</span>}
                    </div>
                  )}
                </td>
              </tr>
            </tbody>
          )}

          <TableTotalRow totals={totals} currentMonth={currentMonth} />
        </table>
      </div>

      {editMode === 'remove' && (
        <BulkRemoveBar
          entryNames={selectedEntryNames}
          groups={selectedGroups}
          busy={bulkBusy}
          error={bulkError}
          onClear={() => {
            clearRemove();
            setBulkError(null);
          }}
          onConfirm={() => void removeSelected()}
        />
      )}

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
      <TableContextPanel
        target={contextTarget}
        groups={sortedGroups}
        onClose={() => setContextTarget(null)}
        onSaveEntry={handleContextEntrySave}
        onSaveGroup={handleContextGroupSave}
        onRemoveEntry={handleContextEntryRemove}
        onRemoveGroup={handleContextGroupRemove}
        onAddEntry={(groupId) => {
          setContextTarget(null);
          openAddEntry(groupId);
        }}
        onArrangeGroup={() => {
          setContextTarget(null);
          useAppStore.getState().setSearchQuery('');
          setEditMode('order');
        }}
      />
    </div>
  );
}
