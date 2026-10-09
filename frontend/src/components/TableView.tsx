import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '../store';
import { Api } from '../api';
import { getCurrentMonthForYear, MONTHS, type MonthKey } from '../utils/months';
import { includesSearch, normalizeSearchText } from '../utils/search';
import { KeyboardSensor, PointerSensor, type DragEndEvent, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { TableHeaderRow, TableTotalRow } from './table/TableGridRows';
import { EntryRow, GroupRow, SortableGroupRow, SortableScope, makeGroupTotals, monthValue } from './table/GridRows';
import { GridSummary } from './table/GridSummary';
import { BulkRemoveBar, ModeBanner } from './table/EditModeBars';
import { useTableQueryState } from './table/useTableQueryState';
import { Inspector, SaveStatusLine, type EntryDetailsPatch } from './table/Inspector';
import { useSaveStatus } from './table/useSaveStatus';
import { useYears } from './shell/useShell';
import { useNarrow } from './shell/useNarrow';
import { MonthList } from './table/MonthList';
import type { EntryGroup, EntryPatch, EntryRowData, EntryTag, GridSelection, TagColor } from './table/types';

// Name column + 12 months + Sum + Avg.
const COLUMN_COUNT = 15;

const normalizeEntryMonthKey = (month: string) => (month === 'Dec' ? 'Decm' : month);
// Shared empty value keeps memoised rows without tags from re-rendering.
const NO_TAGS: Record<string, EntryTag | undefined> = {};
const GRID_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']);

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
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [groupOrder, setGroupOrder] = useState<number[] | null>(null);
  // Inspector (plan Phase 4): selected cell, entry or group; focusCell is the
  // month cell in the Tab order (roving tabindex).
  const [selection, setSelection] = useState<GridSelection | null>(null);
  const [focusCell, setFocusCell] = useState<{ entryId: number; month: string } | null>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  // Month column opened from Overview (plan Phase 5): its header is highlighted
  // and the first visible cell focused, without selecting it or opening the inspector.
  const gridMonthRequest = useAppStore((s) => s.gridMonthRequest);
  const clearGridMonthRequest = useAppStore((s) => s.clearGridMonthRequest);
  const [pickedMonth, setPickedMonth] = useState<MonthKey | null>(null);
  // Below 960 px the month list replaces the grid (plan Phase 8, D11).
  const narrow = useNarrow();
  const storedListMonth = useAppStore((s) => s.listMonth);
  const setListMonth = useAppStore((s) => s.setListMonth);
  const listMonth: MonthKey = storedListMonth ?? currentMonth ?? 'Jan';
  const listRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const { state: saveState, run: runSave } = useSaveStatus();
  const { years } = useYears();
  const previousYear = year ? year - 1 : null;
  const hasPreviousYear = previousYear !== null && years.includes(previousYear);
  // D5: the previous year's entries of this type, shared with Overview's query.
  const previousYearQuery = useQuery({
    enabled: hasPreviousYear && selection !== null && selection.kind !== 'group',
    queryKey: ['entries', type, previousYear],
    queryFn: () => Api.entries.list(type, previousYear!),
  });
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
    setSelection(null);
    setFocusCell(null);
    setPickedMonth(null);
  }, [type, year]);

  useEffect(() => {
    if (!gridMonthRequest || type !== 'expense' || !loaded) return;
    clearGridMonthRequest();
    if (narrow) {
      // The month list shows the month and focuses its first row.
      setListMonth(gridMonthRequest);
      requestAnimationFrame(() => listRef.current?.querySelector<HTMLButtonElement>('.mlist-row')?.focus());
      return;
    }
    setPickedMonth(gridMonthRequest);
    const cell = tableRef.current?.querySelector<HTMLButtonElement>(`tr.ledger-entry button[data-month="${gridMonthRequest}"]`);
    // focusVisible shows the ring after a mouse click where supported; the header highlight covers the rest.
    cell?.focus({ focusVisible: true } as FocusOptions);
  }, [gridMonthRequest, type, loaded, narrow, clearGridMonthRequest]);

  // Filtering or an edit mode closes the inspector (Arrange/Remove block details, as before).
  useEffect(() => {
    setSelection(null);
  }, [normalizedSearch]);

  useEffect(() => {
    if (editMode) setSelection(null);
  }, [editMode]);

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
  // Keyboard: Space or Enter on a handle picks the row up, arrows move it, Space/Enter drops, Escape cancels.
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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

  // Value edits from the grid and the inspector: optimistic, with retry and undo on failure (F07).
  const saveMonth = (entry: EntryRowData, month: string, value: number | null) => {
    const previous = monthValue(entry, month);
    handleRowMonthUpdate(entry.id, month, value);
    void runSave({
      label: `${entry.name}, ${month}`,
      request: () => Api.entries.patch(entry.id, { [month]: value }),
      undo: () => handleRowMonthUpdate(entry.id, month, previous),
    });
  };

  // Inspector fields save one field at a time on blur/Enter/change.
  const saveEntry = (entry: EntryRowData, patch: EntryDetailsPatch) => runSave({
    label: `the details of ${entry.name}`,
    request: async () => {
      await Api.entries.patch(entry.id, patch);
      patchEntryLocal(entry.id, patch);
      await qc.invalidateQueries({ queryKey });
    },
  });

  const saveGroup = (group: EntryGroup, name: string) => runSave({
    label: `group ${group.name}`,
    request: async () => {
      await Api.entryGroups.patch(group.id, { name });
      if (year) await qc.invalidateQueries({ queryKey: ['entry-groups', type, year] });
    },
  });

  // No colour and no note removes the tag (F10).
  const saveTag = (entry: EntryRowData, month: string, color: TagColor, text: string) => runSave({
    label: `the ${month} tag of ${entry.name}`,
    request: async () => {
      if (color === 'none' && !text) await Api.tags.remove(entry.id, month);
      else await Api.tags.save({ entryId: entry.id, month, color, text });
      if (year) await qc.invalidateQueries({ queryKey: ['tags', year] });
    },
  });

  const removeEntry = async (entry: EntryRowData) => {
    const ok = await runSave({
      label: `the removal of ${entry.name}`,
      request: async () => {
        await Api.entries.remove([entry.id]);
        await qc.invalidateQueries({ queryKey });
        if (year) await qc.invalidateQueries({ queryKey: ['tags', year] });
      },
    });
    if (ok) setSelection(null);
    return ok;
  };

  const removeGroup = async (group: EntryGroup) => {
    const ok = await runSave({
      label: `the removal of group ${group.name}`,
      request: async () => {
        await Api.entryGroups.remove([group.id]);
        await Promise.all([
          qc.invalidateQueries({ queryKey }),
          qc.invalidateQueries({ queryKey: ['entry-groups', type, year] }),
        ]);
      },
    });
    if (ok) setSelection(null);
    return ok;
  };

  const closeInspector = useCallback(() => {
    const closed = selectionRef.current;
    setSelection(null);
    // Return focus to the cell or name that opened the panel, unless the user moved on.
    requestAnimationFrame(() => {
      const active = document.activeElement;
      if (active && active !== document.body && !active.closest('[data-testid="inspector"]')) return;
      const container = tableRef.current ?? listRef.current;
      const cell = closed?.kind === 'cell'
        ? container?.querySelector<HTMLElement>(`[data-entry-id="${closed.entryId}"] button[data-month="${closed.month}"]`)
        : null;
      const target = cell ?? (openerRef.current?.isConnected ? openerRef.current : null);
      target?.focus({ preventScroll: true });
    });
  }, []);

  // Escape closes the inspector after inner fields, menus and dialogs had their turn.
  useEffect(() => {
    if (!selection) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      closeInspector();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [selection, closeInspector]);

  // Arrow keys, Home and End move between month cells; the selection follows
  // while the inspector shows a cell (plan D4).
  const moveFrom = (entryId: number, month: string, key: string) => {
    const rowsInGrid = [...(tableRef.current?.querySelectorAll<HTMLTableRowElement>('tr.ledger-entry') ?? [])];
    let row = rowsInGrid.findIndex((node) => node.dataset.entryId === String(entryId));
    let column = MONTHS.indexOf(month as (typeof MONTHS)[number]);
    if (row < 0 || column < 0) return;
    if (key === 'ArrowLeft') column = Math.max(0, column - 1);
    if (key === 'ArrowRight') column = Math.min(11, column + 1);
    if (key === 'ArrowUp') row = Math.max(0, row - 1);
    if (key === 'ArrowDown') row = Math.min(rowsInGrid.length - 1, row + 1);
    if (key === 'Home') column = 0;
    if (key === 'End') column = 11;
    const target = rowsInGrid[row].querySelector<HTMLButtonElement>(`button[data-month="${MONTHS[column]}"]`);
    if (!target) return;
    target.focus();
    if (selectionRef.current?.kind === 'cell') {
      setSelection({ kind: 'cell', entryId: Number(rowsInGrid[row].dataset.entryId), month: MONTHS[column] });
    }
  };

  const onGridKeyDown = (event: ReactKeyboardEvent<HTMLTableElement>) => {
    const target = event.target as HTMLElement;
    if (!target.matches('button.ledger-value') || !GRID_KEYS.has(event.key)) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    const row = target.closest<HTMLTableRowElement>('tr.ledger-entry');
    if (row?.dataset.entryId && target.dataset.month) moveFrom(Number(row.dataset.entryId), target.dataset.month, event.key);
  };

  // Stable callbacks for the memoised rows; they read the latest handlers.
  const latest = useRef({ saveMonth, moveFrom });
  latest.current = { saveMonth, moveFrom };
  const onSaveMonth = useCallback((entry: EntryRowData, month: string, value: number | null) => latest.current.saveMonth(entry, month, value), []);
  const onMoveFrom = useCallback((entryId: number, month: string, key: string) => latest.current.moveFrom(entryId, month, key), []);
  const onFocusCell = useCallback((entryId: number, month: string) => {
    setFocusCell((prev) => (prev?.entryId === entryId && prev.month === month ? prev : { entryId, month }));
    setPickedMonth((prev) => (prev === month ? prev : null));
  }, []);
  const onSelectCell = useCallback((entryId: number, month: string, options?: { focusInspector?: boolean }) => {
    openerRef.current = null;
    setPickedMonth(null);
    setSelection({ kind: 'cell', entryId, month });
    setFocusCell({ entryId, month });
    if (options?.focusInspector) setFocusRequest((value) => value + 1);
  }, []);
  const onOpenEntry = useCallback((entry: EntryRowData, opener: HTMLElement) => {
    openerRef.current = opener;
    setSelection({ kind: 'entry', entryId: entry.id });
    setFocusRequest((value) => value + 1);
  }, []);
  const openGroup = (group: EntryGroup, opener: HTMLElement) => {
    openerRef.current = opener;
    setSelection({ kind: 'group', groupId: group.id });
    setFocusRequest((value) => value + 1);
  };

  const ordering = editMode === 'order';
  const renderEntries = (groupEntries: EntryRowData[]) => (
    <SortableScope
      enabled={ordering}
      sensors={sensors}
      items={groupEntries.map((e) => e.id)}
      onDragEnd={(event) => handleDragEnd(groupEntries, event)}
    >
      {groupEntries.map((e) => {
        const shown = selection && selection.kind !== 'group' && selection.entryId === e.id;
        return (
          <EntryRow
            key={e.id}
            e={e}
            removing={removingIds.includes(e.id)}
            currentMonth={currentMonth}
            tags={tagsByEntry.get(e.id) ?? NO_TAGS}
            selectedMonth={shown && selection.kind === 'cell' ? selection.month : null}
            rowSelected={Boolean(shown)}
            activeMonth={activeCell?.entryId === e.id ? activeCell.month : null}
            onSelectCell={onSelectCell}
            onFocusCell={onFocusCell}
            onSaveMonth={onSaveMonth}
            onMoveFrom={onMoveFrom}
            onOpenDetails={onOpenEntry}
          />
        );
      })}
    </SortableScope>
  );

  const ungroupedEntries = entriesByGroup.get(null) ?? [];
  const ungroupedCollapsed = normalizedSearch ? false : Boolean(collapsedGroups.ungrouped);
  const isGroupCollapsed = (groupId: number) => (normalizedSearch ? false : Boolean(collapsedGroups[`g:${groupId}`]));

  // One month cell is in the Tab order: the focused one, else the first visible entry's January.
  const renderedEntries = [
    ...visibleGroups.flatMap((g) => (isGroupCollapsed(g.id) ? [] : entriesByGroup.get(g.id) ?? [])),
    ...(ungroupedCollapsed ? [] : ungroupedEntries),
  ];
  const activeCell = focusCell && renderedEntries.some((e) => e.id === focusCell.entryId)
    ? focusCell
    : renderedEntries[0] ? { entryId: renderedEntries[0].id, month: 'Jan' } : null;

  const selectedEntry = selection && selection.kind !== 'group' ? rows.find((e) => e.id === selection.entryId) ?? null : null;
  const selectedGroup = selection?.kind === 'group' ? groups.find((g) => g.id === selection.groupId) ?? null : null;
  const inspectorOpen = Boolean(selectedEntry || selectedGroup);
  const isEmpty = loaded && !normalizedSearch && rows.length === 0 && groups.length === 0;
  const noMatches = Boolean(normalizedSearch) && visibleRows.length === 0 && visibleGroups.length === 0;
  const emptyMessage = noMatches ? (
    <div role="status">No entries match “{searchQuery.trim()}”.</div>
  ) : isEmpty ? (
    <div>
      <strong>No {type === 'income' ? 'incomes' : 'expenses'} in {year} yet.</strong>
      {!demo && <span> Add the first one with New entry, or create a group to organise them.</span>}
    </div>
  ) : null;

  // Remove mode: names for the confirmation; entries of a removed group stay unless selected.
  const selectedEntryNames = rows.filter((e) => removeSelection.has(e.id)).map((e) => e.name);
  const selectedGroups = sortedGroups
    .filter((g) => groupRemoveSelection.has(g.id))
    .map((g) => ({ name: g.name, entryCount: rows.filter((e) => e.groupId === g.id && !removeSelection.has(e.id)).length }));

  return (
    <div className="ledger-view" data-edit-mode={editMode ?? undefined}>
      {editMode ? <ModeBanner mode={editMode} /> : !narrow && <GridSummary totals={totals} currentMonth={currentMonth} type={type} />}
      {saveState.status === 'error' && !inspectorOpen && (
        <div className="ledger-save-bar"><SaveStatusLine state={saveState} /></div>
      )}
      {narrow && year ? (
        <MonthList
          listRef={listRef}
          type={type}
          year={year}
          month={listMonth}
          onMonthChange={(next) => {
            setSelection(null);
            setListMonth(next);
          }}
          currentMonth={currentMonth}
          allRows={rows}
          groups={visibleGroups}
          entriesByGroup={entriesByGroup}
          isCollapsed={(key) => (key === 'ungrouped' ? ungroupedCollapsed : isGroupCollapsed(key))}
          onToggleCollapse={(key) => (key === 'ungrouped'
            ? setGroupCollapsed('ungrouped', !ungroupedCollapsed)
            : setGroupCollapsed(`g:${key}`, !isGroupCollapsed(key)))}
          showGroupTotals={showGroupTotals}
          tagsByEntry={tagsByEntry}
          selection={selection}
          ordering={ordering}
          sensors={sensors}
          onEntryDragEnd={handleDragEnd}
          onGroupDragEnd={handleGroupDragEnd}
          removingIds={removingIds}
          removingGroupIds={removingGroupIds}
          onSelect={onSelectCell}
          onOpenGroup={openGroup}
          empty={emptyMessage && <div className="mlist-empty">{emptyMessage}</div>}
        />
      ) : (
        <div className="ledger-wrap" data-testid="entry-table">
          <table
            className={`ledger ${pickedMonth ? 'is-picked' : ''}`}
            ref={tableRef}
            onKeyDown={onGridKeyDown}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPickedMonth(null);
            }}
          >
            <caption className="sr-only">{type === 'income' ? 'Incomes' : 'Expenses'} {year} by month</caption>
            <TableHeaderRow currentMonth={currentMonth} pickedMonth={pickedMonth} />
            <SortableScope
              enabled={ordering}
              sensors={sensors}
              items={visibleGroups.map((g) => g.id)}
              onDragEnd={handleGroupDragEnd}
            >
              {visibleGroups.map((g) => {
                const groupKey = `g:${g.id}`;
                const groupEntries = entriesByGroup.get(g.id) ?? [];
                const isCollapsed = isGroupCollapsed(g.id);
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
                        active={selection?.kind === 'group' && selection.groupId === g.id}
                        onOpenDetails={(opener) => openGroup(g, opener)}
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

            {emptyMessage && (
              <tbody>
                <tr>
                  <td colSpan={COLUMN_COUNT} className="ledger-empty">{emptyMessage}</td>
                </tr>
              </tbody>
            )}

            <TableTotalRow totals={totals} currentMonth={currentMonth} />
          </table>
        </div>
      )}

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

      {year && (
        <Inspector
          selection={selection}
          entry={selectedEntry}
          group={selectedGroup}
          groupEntryCount={selectedGroup ? rows.filter((e) => e.groupId === selectedGroup.id).length : 0}
          groups={sortedGroups}
          tags={selectedEntry ? tagsByEntry.get(selectedEntry.id) ?? NO_TAGS : NO_TAGS}
          year={year}
          previousYearEntries={hasPreviousYear ? ((previousYearQuery.data?.entries ?? null) as EntryRowData[] | null) : null}
          readOnly={demo !== false}
          saveState={saveState}
          focusRequest={focusRequest}
          onClose={closeInspector}
          onSaveMonth={saveMonth}
          onSaveEntry={saveEntry}
          onSaveGroup={saveGroup}
          onSaveTag={saveTag}
          onRemoveEntry={removeEntry}
          onRemoveGroup={removeGroup}
          onAddEntry={(groupId) => {
            setSelection(null);
            openAddEntry(groupId);
          }}
          onArrangeGroup={() => {
            setSelection(null);
            useAppStore.getState().setSearchQuery('');
            setEditMode('order');
          }}
        />
      )}
    </div>
  );
}
