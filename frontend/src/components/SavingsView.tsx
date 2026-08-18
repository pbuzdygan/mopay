import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Api } from '../api';
import { useAppStore } from '../store';
import { Surface } from './Surface';
import { SoftButton } from './SoftButton';
import { formatCurrency, formatCurrencyPlain, parseCurrencyInput } from '../utils/currency';
import { includesSearch, normalizeSearchText } from '../utils/search';

type SavingsItem = {
  id: number;
  goalId: number;
  name: string;
  value: number;
};

type SavingsGoal = {
  id: number;
  name: string;
  targetValue: number | null;
  items: SavingsItem[];
};

type DraftRow = {
  id: number;
  nameDraft: string;
  valueDraft: string;
};

const isBlankItem = (item: SavingsItem) => !item.name?.trim() && Number(item.value ?? 0) === 0;

const buildDrafts = (items: SavingsItem[]): DraftRow[] =>
  items.map((item) => {
    const hasContent = Boolean(item.name?.trim() || item.value);
    return {
      id: item.id,
      nameDraft: item.name ?? '',
      valueDraft: hasContent ? formatCurrencyPlain(Number(item.value ?? 0)) : '',
    };
  });

const formatSignedCurrency = (value: number) =>
  value > 0 ? `+${formatCurrency(value)}` : formatCurrency(value);

export function SavingsView() {
  const year = useAppStore((s) => s.year);
  const searchQuery = useAppStore((s) => s.searchQuery);
  const openGoalModal = useAppStore((s) => s.openGoalModal);
  const [expandedGoalId, setExpandedGoalId] = useState<number | null>(null);

  const savingsQuery = useQuery({
    queryKey: ['savings', year],
    queryFn: () => Api.savings.list(year!),
    enabled: !!year,
  });

  const goals = (savingsQuery.data?.goals ?? []) as SavingsGoal[];
  const normalizedSearch = normalizeSearchText(searchQuery);
  const visibleGoals = useMemo(() => {
    if (!normalizedSearch) return goals;
    return goals.filter((goal) =>
      includesSearch(goal.name, normalizedSearch)
      || goal.items.some((item) => includesSearch(item.name, normalizedSearch))
    );
  }, [goals, normalizedSearch]);
  const goalIdsKey = goals.map((goal) => goal.id).join(',');

  useEffect(() => {
    setExpandedGoalId((current) => {
      if (current !== null && goals.some((goal) => goal.id === current)) return current;
      return null;
    });
  }, [goalIdsKey]);

  useEffect(() => {
    setExpandedGoalId(null);
  }, [year]);

  if (!year) {
    return (
      <Surface variant="layer" className="savings-placeholder">
        <p>Select a year to plan your savings goals.</p>
      </Surface>
    );
  }

  if (savingsQuery.isLoading) {
    return (
      <Surface variant="layer" className="savings-placeholder">
        <p>Loading your savings goals…</p>
      </Surface>
    );
  }

  if (!goals.length) {
    return (
      <Surface variant="layer" className="savings-placeholder">
        <div className="savings-empty-stack">
          <p>
            Set up your first goal to start tracking progress. Goals live next to your yearly
            budget, so you can update them anytime.
          </p>
          <SoftButton type="button" onClick={() => openGoalModal()} disabled={!year}>
            Add goal
          </SoftButton>
        </div>
      </Surface>
    );
  }

  if (normalizedSearch && !visibleGoals.length) {
    return (
      <Surface variant="layer" className="savings-placeholder search-results-empty" role="status">
        <p>No savings goals match “{searchQuery.trim()}”.</p>
      </Surface>
    );
  }

  return (
    <div className="savings-accordion">
      {visibleGoals.map((goal) => (
        <GoalCard
          key={goal.id}
          year={year}
          goal={goal}
          expanded={normalizedSearch ? true : expandedGoalId === goal.id}
          onToggle={() =>
            setExpandedGoalId((current) => (current === goal.id ? null : goal.id))
          }
        />
      ))}
    </div>
  );
}

function GoalCard({
  goal,
  year,
  expanded,
  onToggle,
}: {
  goal: SavingsGoal;
  year: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const qc = useQueryClient();
  const openGoalModal = useAppStore((s) => s.openGoalModal);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!confirmingDelete) return;
    const tm = setTimeout(() => setConfirmingDelete(false), 4000);
    return () => clearTimeout(tm);
  }, [confirmingDelete]);

  useEffect(() => {
    if (!confirmingDelete) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!actionsRef.current) return;
      if (actionsRef.current.contains(event.target as Node)) return;
      setConfirmingDelete(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [confirmingDelete]);

  const totalValue = useMemo(
    () => goal.items.reduce((sum, item) => sum + Number(item.value ?? 0), 0),
    [goal.items]
  );
  const showProgress = typeof goal.targetValue === 'number' && goal.targetValue > 0;
  const progressPct = showProgress && goal.targetValue
    ? Math.min(100, Math.max(0, (totalValue / goal.targetValue) * 100))
    : 0;

  const invalidate = () =>
    qc.invalidateQueries({
      queryKey: ['savings', year],
    });

  async function handleDelete() {
    await Api.savings.removeGoal(goal.id);
    setConfirmingDelete(false);
    await invalidate();
  }

  async function handleAddRow() {
    const result = await Api.savings.addItem(goal.id);
    await invalidate();
    return Number(result?.id);
  }

  const balanceLabel = showProgress
    ? `${formatCurrency(totalValue)} / ${formatCurrency(goal.targetValue ?? 0)}`
    : `${formatCurrency(totalValue)} / No target`;

  return (
    <Surface
      variant="layer"
      compact
      className={`goal-card goal-accordion-card ${expanded ? 'is-expanded' : ''}`}
    >
      <div className="goal-accordion-header">
        <button
          type="button"
          className="goal-accordion-toggle"
          aria-expanded={expanded}
          aria-controls={`goal-panel-${goal.id}`}
          onClick={onToggle}
        >
          <span className="goal-accordion-chevron" aria-hidden="true">›</span>
          <span className="goal-accordion-title">{goal.name}</span>
          <span className="goal-accordion-balance">{balanceLabel}</span>
          <span className="goal-summary-progress" aria-hidden="true">
            <span className="goal-progress-fill" style={{ width: `${progressPct}%` }} />
          </span>
          <span className={`goal-progress-pill ${showProgress ? '' : 'is-empty'}`}>
            {showProgress ? `${progressPct.toFixed(0)}%` : '—'}
          </span>
        </button>

        <div className="goal-card-actions" ref={actionsRef}>
          <button
            type="button"
            className="goal-action-icon ui-tooltip"
            data-tooltip="Edit goal"
            aria-label={`Edit ${goal.name}`}
            onClick={() => openGoalModal(goal.id)}
          >
            <img src="/icons/ui/edit.svg" alt="" className="goal-action-icon-img" aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`goal-action-icon ui-tooltip ${confirmingDelete ? 'is-warning' : ''}`}
            data-tooltip={confirmingDelete ? 'Confirm remove' : 'Remove goal'}
            aria-label={confirmingDelete ? `Confirm removal of ${goal.name}` : `Remove ${goal.name}`}
            onClick={() => {
              if (confirmingDelete) {
                void handleDelete();
                return;
              }
              setConfirmingDelete(true);
            }}
          >
            <img
              src={confirmingDelete ? '/icons/ui/check.svg' : '/icons/ui/trash.svg'}
              alt=""
              className="goal-action-icon-img"
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      {expanded && (
        <div id={`goal-panel-${goal.id}`} className="goal-accordion-panel mode-enter">
          <GoalItemsLedger
            items={goal.items}
            total={totalValue}
            onRefresh={invalidate}
            onAddRow={handleAddRow}
          />
        </div>
      )}
    </Surface>
  );
}

function GoalItemsLedger({
  items,
  total,
  onRefresh,
  onAddRow,
}: {
  items: SavingsItem[];
  total: number;
  onRefresh: () => Promise<unknown>;
  onAddRow: () => Promise<number>;
}) {
  const [rows, setRows] = useState<DraftRow[]>(() => buildDrafts(items));
  const [editingRowId, setEditingRowId] = useState<number | null>(
    () => items.find(isBlankItem)?.id ?? null
  );
  const [savingRowId, setSavingRowId] = useState<number | null>(null);
  const [addingRow, setAddingRow] = useState(false);
  const editorNameRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setRows((currentRows) => {
      const editedDraft = currentRows.find((row) => row.id === editingRowId);
      return buildDrafts(items).map((row) =>
        row.id === editingRowId && editedDraft ? editedDraft : row
      );
    });

    if (editingRowId && !items.some((item) => item.id === editingRowId)) {
      setEditingRowId(null);
    }
  }, [items, editingRowId]);

  useEffect(() => {
    if (!editingRowId) return;
    const frame = requestAnimationFrame(() => {
      editorNameRef.current?.focus();
      editorNameRef.current?.setSelectionRange(
        editorNameRef.current.value.length,
        editorNameRef.current.value.length
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [editingRowId, rows.length]);

  const updateRow = (id: number, patch: Partial<DraftRow>) => {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row))
    );
  };

  const resetRow = (id: number) => {
    const original = items.find((item) => item.id === id);
    if (!original) return;
    const hasContent = Boolean(original.name?.trim() || original.value);
    updateRow(id, {
      nameDraft: original.name ?? '',
      valueDraft: hasContent ? formatCurrencyPlain(Number(original.value ?? 0)) : '',
    });
  };

  async function persistRow(id: number) {
    if (savingRowId === id) return;
    const row = rows.find((candidate) => candidate.id === id);
    if (!row) return;

    const trimmedName = row.nameDraft.replace(/\s+/g, ' ').trim();
    const cleanedValue = row.valueDraft.replace(/[^\d\s,.\-]/g, '');
    const hasValue = cleanedValue.trim().length > 0;
    setSavingRowId(id);

    try {
      if (!trimmedName && !hasValue) {
        await Api.savings.removeItem(id);
      } else {
        const numericValue = hasValue ? parseCurrencyInput(cleanedValue) : 0;
        await Api.savings.updateItem(id, {
          name: trimmedName,
          value: numericValue,
        });
        updateRow(id, {
          nameDraft: trimmedName,
          valueDraft: hasValue ? formatCurrencyPlain(numericValue) : '',
        });
      }
      await onRefresh();
      setEditingRowId((current) => (current === id ? null : current));
    } finally {
      setSavingRowId(null);
    }
  }

  async function cancelEditing(id: number) {
    const original = items.find((item) => item.id === id);
    if (!original) return;
    if (isBlankItem(original)) {
      await Api.savings.removeItem(id);
      setEditingRowId((current) => (current === id ? null : current));
      await onRefresh();
      return;
    }
    resetRow(id);
    setEditingRowId((current) => (current === id ? null : current));
  }

  async function removeRow(id: number) {
    await Api.savings.removeItem(id);
    setEditingRowId((current) => (current === id ? null : current));
    await onRefresh();
  }

  const handleValueChange = (id: number, next: string) => {
    const sanitized = next.replace(/[^\d\s,.\-]/g, '');
    updateRow(id, { valueDraft: sanitized });
  };

  async function addRow() {
    if (addingRow) return;
    setAddingRow(true);
    try {
      if (editingRowId !== null) {
        await persistRow(editingRowId);
      }
      const id = await onAddRow();
      if (Number.isFinite(id)) setEditingRowId(id);
    } finally {
      setAddingRow(false);
    }
  }

  return (
    <div className="goal-ledger">
      <div className="goal-ledger-head">
        <span>Source or note</span>
        <span>Amount</span>
        <span className="sr-only">Actions</span>
      </div>

      <div className="goal-ledger-rows">
        {!rows.length && (
          <p className="goal-ledger-empty">
            No savings activity yet. Add the first source or temporary withdrawal.
          </p>
        )}

        {rows.map((row) => {
          const item = items.find((candidate) => candidate.id === row.id);
          if (!item) return null;
          const value = Number(item.value ?? 0);
          const negative = value < 0;
          const editing = editingRowId === row.id;

          if (editing) {
            return (
              <div
                key={row.id}
                className="goal-ledger-editor"
                onBlurCapture={(event) => {
                  const nextTarget = event.relatedTarget as Node | null;
                  if (nextTarget && event.currentTarget.contains(nextTarget)) return;
                  void persistRow(row.id);
                }}
              >
                <textarea
                  ref={editorNameRef}
                  className="goal-input goal-description-input"
                  value={row.nameDraft}
                  placeholder="Source or note"
                  maxLength={80}
                  rows={2}
                  onChange={(event) => updateRow(row.id, { nameDraft: event.target.value })}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void persistRow(row.id);
                    }
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      void cancelEditing(row.id);
                    }
                  }}
                />
                <div className="goal-ledger-value-editor">
                  <input
                    type="text"
                    className="goal-input value"
                    inputMode="decimal"
                    value={row.valueDraft}
                    placeholder="0,00"
                    onChange={(event) => handleValueChange(row.id, event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void persistRow(row.id);
                      }
                      if (event.key === 'Escape') {
                        event.preventDefault();
                        void cancelEditing(row.id);
                      }
                    }}
                  />
                  {row.valueDraft.trim().startsWith('-') && (
                    <span className="goal-withdrawal-caption">Temporary withdrawal</span>
                  )}
                </div>
                <div className="goal-ledger-actions">
                  <button
                    type="button"
                    className="goal-row-action is-save ui-tooltip"
                    data-tooltip="Save"
                    aria-label="Save item"
                    disabled={savingRowId === row.id}
                    onClick={() => void persistRow(row.id)}
                  >
                    <img src="/icons/ui/check.svg" alt="" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="goal-row-action ui-tooltip"
                    data-tooltip="Cancel"
                    aria-label="Cancel item editing"
                    disabled={savingRowId === row.id}
                    onClick={() => void cancelEditing(row.id)}
                  >
                    ×
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div key={row.id} className={`goal-ledger-row ${negative ? 'is-negative' : ''}`}>
              <div className="goal-ledger-description">
                <span>{item.name?.trim() || 'Untitled item'}</span>
                {negative && <span className="goal-withdrawal-caption">Temporary withdrawal</span>}
              </div>
              <strong className="goal-ledger-amount">{formatSignedCurrency(value)}</strong>
              <div className="goal-ledger-actions">
                <button
                  type="button"
                  className="goal-row-action ui-tooltip"
                  data-tooltip="Edit"
                  aria-label={`Edit ${item.name || 'item'}`}
                  onClick={() => setEditingRowId(row.id)}
                >
                  <img src="/icons/ui/edit.svg" alt="" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="goal-row-action ui-tooltip"
                  data-tooltip="Remove"
                  aria-label={`Remove ${item.name || 'item'}`}
                  onClick={() => void removeRow(row.id)}
                >
                  <img src="/icons/ui/trash.svg" alt="" aria-hidden="true" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="goal-ledger-footer">
        <SoftButton type="button" variant="ghost" disabled={addingRow} onClick={() => void addRow()}>
          {addingRow ? 'Adding…' : '+ Add item'}
        </SoftButton>
        <div className="goal-ledger-total">
          <span>Current balance</span>
          <strong>{formatCurrency(total)}</strong>
        </div>
      </div>
    </div>
  );
}
