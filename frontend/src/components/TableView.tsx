import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '../store';
import { Api } from '../api';
import { MONTHS } from '../utils/months';
import { formatCurrency, parseCurrencyInput } from '../utils/currency';
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

function Row({
  e,
  editingNameId,
  setEditingNameId,
  removingIds,
  onNameUpdate,
  onMonthUpdate,
  tags,
  onRequestTag,
}: {
  e: any;
  editingNameId: number | null;
  setEditingNameId: (id: number | null) => void;
  removingIds: number[];
  onNameUpdate: (name: string) => void;
  onMonthUpdate: (month: string, value: number) => void;
  tags: Record<string, EntryTag | undefined>;
  onRequestTag: (entryId: number, month: string, target: HTMLButtonElement, tag?: EntryTag) => void;
}) {

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: e.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : 'transform 120ms ease-out',
  };
  
  const { editMode, toggleRemoveId, removeSelection, setComment } = useAppStore();
  const isTagMode = editMode === 'tag';
  const isNameMode = editMode === 'name';
  const canEditValues = !editMode;

  const initialNumbers = useMemo(() => {
    const map: Record<string, number> = {};
    MONTHS.forEach((m) => {
      const raw = Number(e[m] ?? (m === 'Dec' ? e.Decm : e[m]) ?? 0);
      map[m] = raw;
    });
    return map;
  }, [e]);

  const [nameValue, setNameValue] = useState(e.name);
  const [monthNumbers, setMonthNumbers] = useState<Record<string, number>>(initialNumbers);
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
    const totalMonths = MONTHS.length;
    return totalMonths ? rowSum / totalMonths : 0;
  }, [rowSum]);

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
    const num = parseCurrencyInput(monthDraft);
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
                  table-row-premium gap-1.5 px-3 py-2 items-center text-[0.72rem]
                  ${isDragging ? 'dragging' : ''}
                  ${editMode === 'remove' && removeSelection.has(e.id) ? 'row-remove-selected' : ''}
                  ${removingIds.includes(e.id) ? 'fade-out' : ''}`}
    >

      <div className="flex items-center justify-center">
        <button
          title={e.comment ? 'Has comment' : 'Add comment'}
          className={`table-comment-btn ${e.comment ? 'active' : ''}`}
          onClick={()=> setComment(e.id, e.comment||'')}
        >
          💬
        </button>
      </div>

      <div className="flex items-center gap-2 text-textPrim">
        {editMode==='order' && (
          <button
            {...attributes}
            {...listeners}
            className="px-2 py-1 rounded-lg border border-border cursor-grab"
            style={{ background: 'var(--panel-subtle)' }}
          >
            ↕
          </button>
        )}
        {editMode === 'remove' && (
          <input
            type="checkbox"
            className="remove-checkbox"
            checked={removeSelection.has(e.id)}
            onChange={() => toggleRemoveId(e.id)}
          />
        )}

        {editingNameId===e.id ? (
          <input
            autoFocus
            className="input"
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
          <button
            className={`table-name ${isNameMode ? 'is-editable' : ''}`}
            onClick={()=>{ if (editMode==='name') setEditingNameId(e.id); }}
          >
            {nameValue}
          </button>
        )}
      </div>
      {MONTHS.map((m)=> {
        const tag = tags?.[m];
        const tagText = tag?.text?.trim();
        return (
        <div key={m} className="text-right">
          {(canEditValues && !isTagMode && editingMonth === m) ? (
            <input
              className="table-input"
              value={monthDraft}
              onChange={(ev)=> {
                const value = ev.target.value.replace(/[^\d,\s]/g, '');
                setMonthDraft(value);
              }}
              onBlur={()=> saveMonth(m)}
              onKeyDown={(ev)=> {
                if (ev.key === 'Enter') saveMonth(m);
                if (ev.key === 'Escape') {
                  setMonthDraft(formatCurrency(monthNumbers[m] ?? 0));
                  setEditingMonth(null);
                }
              }}
              autoFocus
              inputMode="decimal"
            />
          ) : (
            <div className={`table-value-wrapper ${tag ? 'has-tag' : ''}`}>
              <button
                className={`table-value ${tag ? `has-tag tag-color-${tag.color}` : ''}`}
                onClick={(ev)=> {
                  if (isTagMode) {
                    onRequestTag(e.id, m, ev.currentTarget, tag);
                    return;
                  }
                  if (!canEditValues) return;
                  setEditingMonth(m);
                  setMonthDraft(formatCurrency(monthNumbers[m] ?? 0));
                }}
              >
                {formatCurrency(monthNumbers[m] ?? 0)}
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
  const qc = useQueryClient();
  const { data } = useEntries();
  const tagsQuery = useQuery({
    enabled: !!year,
    queryKey: ['tags', year],
    queryFn: () => Api.tags.list(year!),
  });
  const entriesData = (data?.entries ?? []) as any[];
  const [rows, setRows] = useState<any[]>(entriesData);
  const [editingNameId, setEditingNameId] = useState<number|null>(null);
  const [removingIds, setRemovingIds] = useState<number[]>([]);
  const [tagEditor, setTagEditor] = useState<null | { entryId: number; month: string; rect: DOMRect; color: TagColor; text: string }>(null);
  const [tagSaving, setTagSaving] = useState(false);

  useEffect(() => {
    setRows(entriesData);
  }, [entriesData]);

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
      if (!ids.length) return;
  
      // 🔹 Uruchamiamy lokalną animację
      setRemovingIds(ids);
  
      // 🔹 Odczekaj czas animacji zanim backend faktycznie usunie dane
      await new Promise((r) => setTimeout(r, 600));
  
      await Api.entries.remove(ids);
      clearRemove();
      useAppStore.getState().setEditMode(null);
      qc.invalidateQueries({ queryKey: ['entries', type, year] });
  
      // 🔹 Reset lokalnych flag po chwili
      setTimeout(() => setRemovingIds([]), 400);
    };
  
    window.addEventListener('bulk:remove', onBulkRemove as any);
    return () => window.removeEventListener('bulk:remove', onBulkRemove as any);
  }, [removeSelection, type, year]);
  
  
  


  // DnD
  const sensors = useSensors(useSensor(PointerSensor));

  function handleDragEnd(event: any) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
  
    const oldIndex = rows.findIndex(e => e.id === active.id);
    const newIndex = rows.findIndex(e => e.id === over.id);

    const newEntries = arrayMove(rows, oldIndex, newIndex);
    setRows(newEntries);
    const queryKey = ['entries', type, year]; // ✅ dopasowujemy klucz cache
  
    // 🔹 natychmiastowy lokalny update w React Query
    qc.setQueryData(queryKey, (old: any) => ({
      ...(old ?? {}),
      entries: newEntries,
    }));
  
    const newOrder = newEntries.map(e => e.id);
  
    // 🔹 zapis do backendu (bez natychmiastowego refetch)
    Api.entries.reorder(newOrder)
      .then(() => {
        // ⚙️ Czekamy chwilę, żeby backend zapisał, ale nie psujemy wizualnego stanu
        setTimeout(() => {
          qc.invalidateQueries({ queryKey, refetchType: 'inactive' });
        }, 1200);
      })

      .catch(err => console.error('Reorder failed:', err));
  }


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
      color: (tag?.color ?? 'grey') as TagColor,
      text: tag?.text ?? '',
    });
  };

  const handleTagSave = async () => {
    if (!tagEditor) return;
    setTagSaving(true);
    try {
      await Api.tags.save({
        entryId: tagEditor.entryId,
        month: tagEditor.month,
        color: tagEditor.color,
        text: tagEditor.text.trim(),
      });
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
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={rows.map(e=>e.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {rows.map((e:any)=> (
                      <Row
                        key={e.id}
                        e={e}
                        editingNameId={editingNameId}
                        setEditingNameId={setEditingNameId}
                        removingIds={removingIds}
                        onNameUpdate={(name)=> setRows(prev => prev.map(row => row.id === e.id ? { ...row, name } : row))}
                        onMonthUpdate={(month,value)=> setRows(prev => prev.map(row => row.id === e.id ? { ...row, [month === 'Dec' ? 'Decm' : month]: value } : row))}
                        tags={tagsByEntry.get(e.id) ?? {}}
                        onRequestTag={handleTagRequest}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <div className="space-y-2">
                {rows.map((e:any)=> (
                  <Row
                    key={e.id}
                    e={e}
                    editingNameId={editingNameId}
                    setEditingNameId={setEditingNameId}
                    removingIds={removingIds}
                    onNameUpdate={(name)=> setRows(prev => prev.map(row => row.id === e.id ? { ...row, name } : row))}
                    onMonthUpdate={(month,value)=> setRows(prev => prev.map(row => row.id === e.id ? { ...row, [month === 'Dec' ? 'Decm' : month]: value } : row))}
                    tags={tagsByEntry.get(e.id) ?? {}}
                    onRequestTag={handleTagRequest}
                  />
                ))}
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
