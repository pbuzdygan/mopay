import { useEffect, useMemo, useState } from 'react';
import { useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Api } from '../api';
import { useAppStore } from '../store';
import { Surface } from './Surface';
import { SoftButton } from './SoftButton';
import { formatCurrency, formatCurrencyPlain, parseCurrencyInput } from '../utils/currency';

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

export function SavingsView() {
  const year = useAppStore((s) => s.year);
  const openGoalModal = useAppStore((s) => s.openGoalModal);

  const savingsQuery = useQuery({
    queryKey: ['savings', year],
    queryFn: () => Api.savings.list(year!),
    enabled: !!year,
  });

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

  const goals = (savingsQuery.data?.goals ?? []) as SavingsGoal[];

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

  return (
    <div className="savings-grid">
      {goals.map((goal) => (
        <GoalCard key={goal.id} year={year} goal={goal} />
      ))}
    </div>
  );
}

function GoalCard({ goal, year }: { goal: SavingsGoal; year: number }) {
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
    invalidate();
  }

  async function handleAddRow() {
    await Api.savings.addItem(goal.id);
    invalidate();
  }

  return (
    <Surface variant="layer" className="goal-card">
      <div className="goal-card-header">
        <div className="goal-card-label-row">
          <p className="goal-card-label">Goal</p>
          <div className="goal-card-actions" ref={actionsRef}>
            <button
              type="button"
              className="goal-action-icon ui-tooltip"
              data-tooltip="Edit"
              aria-label="Edit"
              onClick={() => openGoalModal(goal.id)}
            >
              <img src="/icons/ui/edit.svg" alt="" className="goal-action-icon-img" aria-hidden="true" />
            </button>
            <button
              type="button"
              className={`goal-action-icon ui-tooltip ${confirmingDelete ? 'is-warning' : ''}`}
              data-tooltip={confirmingDelete ? 'Confirm remove' : 'Remove'}
              aria-label={confirmingDelete ? 'Confirm remove' : 'Remove'}
              onClick={() => {
                if (confirmingDelete) {
                  void handleDelete();
                  return;
                }
                setConfirmingDelete(true);
              }}
            >
              <img
                src={confirmingDelete ? "/icons/ui/check.svg" : "/icons/ui/trash.svg"}
                alt=""
                className="goal-action-icon-img"
                aria-hidden="true"
              />
            </button>
          </div>
        </div>
        <h3 className="goal-card-title">{goal.name}</h3>
      </div>

      {showProgress ? (
        <div className="goal-progress">
          <div className="goal-progress-row">
            <span className="goal-progress-caption">
              {formatCurrency(totalValue)} / {formatCurrency(goal.targetValue ?? 0)}
            </span>
            <span className="goal-progress-pill">{progressPct.toFixed(0)}%</span>
          </div>
          <div className="goal-progress-bar">
            <div className="goal-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      ) : (
        <p className="goal-progress-hint">Add a target amount to keep an eye on progress.</p>
      )}

      <GoalItemsTable
        items={goal.items}
        total={totalValue}
        onRefresh={invalidate}
        onAddRow={handleAddRow}
      />
    </Surface>
  );
}

type DraftRow = {
  id: number;
  nameDraft: string;
  valueDraft: string;
};

function GoalItemsTable({
  items,
  total,
  onRefresh,
  onAddRow,
}: {
  items: SavingsItem[];
  total: number;
  onRefresh: () => void;
  onAddRow: () => void;
}) {
  const [rows, setRows] = useState<DraftRow[]>(() => buildDrafts(items));

  useEffect(() => {
    setRows(buildDrafts(items));
  }, [items]);

  function buildDrafts(source: SavingsItem[]) {
    return source.map((item) => {
      const hasContent = Boolean(item.name?.trim() || item.value);
      return {
        id: item.id,
        nameDraft: item.name ?? '',
        valueDraft: hasContent ? formatCurrencyPlain(Number(item.value ?? 0)) : '',
      };
    });
  }

  const updateRow = (id: number, patch: Partial<DraftRow>) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
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
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const trimmedName = row.nameDraft.trim();
    const cleanedValue = row.valueDraft.replace(/[^\d\s,.\-]/g, '');
    const hasValue = cleanedValue.trim().length > 0;

    if (!trimmedName && !hasValue) {
      await Api.savings.removeItem(id);
      onRefresh();
      return;
    }

    const numericValue = hasValue ? parseCurrencyInput(cleanedValue) : 0;
    await Api.savings.updateItem(id, {
      name: trimmedName,
      value: numericValue,
    });
    updateRow(id, {
      nameDraft: trimmedName,
      valueDraft: hasValue ? formatCurrencyPlain(numericValue) : '',
    });
    onRefresh();
  }

  async function removeRow(id: number) {
    await Api.savings.removeItem(id);
    onRefresh();
  }

  const handleValueChange = (id: number, next: string) => {
    const sanitized = next.replace(/[^\d\s,.\-]/g, '');
    updateRow(id, { valueDraft: sanitized });
  };

  return (
    <div className="goal-table">
      <div className="goal-table-head">
        <span>Name</span>
        <span className="text-right">Value</span>
      </div>

      {rows.map((row) => (
        <div key={row.id} className="goal-table-row">
          <input
            type="text"
            className="goal-input"
            value={row.nameDraft}
            placeholder="Name"
            maxLength={80}
            onChange={(ev) => updateRow(row.id, { nameDraft: ev.target.value })}
            onBlur={() => persistRow(row.id)}
            onKeyDown={(ev) => {
              if (ev.key === 'Enter') (ev.currentTarget as HTMLInputElement).blur();
              if (ev.key === 'Escape') {
                resetRow(row.id);
                (ev.currentTarget as HTMLInputElement).blur();
              }
            }}
          />
          <div className="goal-value-cell">
            <input
              type="text"
              className="goal-input value"
              inputMode="decimal"
              value={row.valueDraft}
              placeholder="0,00"
              onChange={(ev) => handleValueChange(row.id, ev.target.value)}
              onBlur={() => persistRow(row.id)}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter') (ev.currentTarget as HTMLInputElement).blur();
                if (ev.key === 'Escape') {
                  resetRow(row.id);
                  (ev.currentTarget as HTMLInputElement).blur();
                }
              }}
            />
            <button
              type="button"
              className="goal-row-remove"
              aria-label="Remove row"
              onClick={() => removeRow(row.id)}
            >
              ×
            </button>
          </div>
        </div>
      ))}

      <div className="goal-table-footer">
        <SoftButton type="button" variant="ghost" onClick={onAddRow}>
          + Add item
        </SoftButton>
        <div className="goal-table-total">
          <span>Total</span>
          <strong>{formatCurrency(total)}</strong>
        </div>
      </div>
    </div>
  );
}
