import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Api } from '../api';
import { useAppStore } from '../store';
import { formatCurrency, formatCurrencyPlain, parseCurrencyInput } from '../utils/currency';
import { includesSearch, normalizeSearchText } from '../utils/search';
import { Badge, Button, Callout, Dialog, IconButton, Menu } from './ui';

// Savings as goal list + goal detail (plan Phase 6, docs/mockup_UI/final-ledger.html).

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

const normalizeName = (value: string) => value.replace(/\s+/g, ' ').trim();

function goalFigures(goal: SavingsGoal) {
  const values = goal.items.map((item) => Number(item.value ?? 0));
  const total = values.reduce((sum, value) => sum + value, 0);
  const target = typeof goal.targetValue === 'number' && goal.targetValue > 0 ? goal.targetValue : null;
  return {
    total,
    target,
    progress: target ? Math.min(100, Math.max(0, (total / target) * 100)) : null,
    contributions: values.filter((value) => value > 0).reduce((sum, value) => sum + value, 0),
    withdrawals: values.filter((value) => value < 0).reduce((sum, value) => sum + value, 0),
  };
}

export function SavingsView() {
  const year = useAppStore((s) => s.year);
  const searchQuery = useAppStore((s) => s.searchQuery);
  const demo = useAppStore((s) => s.demo);
  const openGoalModal = useAppStore((s) => s.openGoalModal);
  const [selectedGoalId, setSelectedGoalId] = useState<number | null>(null);

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

  useEffect(() => {
    setSelectedGoalId(null);
  }, [year]);

  // The selected goal, or the first visible one (also after removal or filtering).
  const selectedGoal = visibleGoals.find((goal) => goal.id === selectedGoalId) ?? visibleGoals[0] ?? null;

  if (!year) {
    return <SavingsState message="Select a year to plan your savings goals." />;
  }

  if (savingsQuery.isLoading) {
    return <SavingsState message="Loading your savings goals…" />;
  }

  if (!goals.length) {
    return (
      <SavingsState message="Set up your first goal to start tracking progress. Goals live next to your yearly budget, so you can update them anytime.">
        {!demo && <Button variant="primary" icon="target-arrow" onClick={() => openGoalModal()}>Add goal</Button>}
      </SavingsState>
    );
  }

  if (normalizedSearch && !visibleGoals.length) {
    return <SavingsState status message={`No savings goals match “${searchQuery.trim()}”.`} />;
  }

  return (
    <div className="goals-view mode-enter">
      <div className="goals-layout">
        <nav className="goals-list" aria-label="Goals">
          <ul>
            {visibleGoals.map((goal) => (
              <li key={goal.id}>
                <GoalListItem
                  goal={goal}
                  selected={goal.id === selectedGoal?.id}
                  onSelect={() => setSelectedGoalId(goal.id)}
                />
              </li>
            ))}
          </ul>
        </nav>
        {selectedGoal && <GoalDetail key={selectedGoal.id} goal={selectedGoal} year={year} />}
      </div>
    </div>
  );
}

function SavingsState({ message, status = false, children }: { message: string; status?: boolean; children?: ReactNode }) {
  return (
    <div className="goals-state" role={status ? 'status' : undefined}>
      <p>{message}</p>
      {children}
    </div>
  );
}

function GoalListItem({ goal, selected, onSelect }: { goal: SavingsGoal; selected: boolean; onSelect: () => void }) {
  const { total, target, progress } = goalFigures(goal);
  return (
    <button
      type="button"
      className="goals-list-item"
      aria-current={selected ? 'true' : undefined}
      aria-controls="goal-detail"
      onClick={onSelect}
    >
      <span className="goals-list-name">
        <span>{goal.name}</span>
        {progress !== null && <span className="goals-list-pct">{progress.toFixed(0)}%</span>}
      </span>
      <span className={`goals-bar ${progress === null ? 'is-empty' : ''}`} aria-hidden="true">
        <span style={{ width: `${progress ?? 0}%` }} />
      </span>
      <small>
        {target !== null ? `${formatCurrency(total)} of ${formatCurrency(target)}` : `${formatCurrency(total)} · No target`}
      </small>
    </button>
  );
}

function GoalDetail({ goal, year }: { goal: SavingsGoal; year: number }) {
  const qc = useQueryClient();
  const demo = useAppStore((s) => s.demo);
  const openGoalModal = useAppStore((s) => s.openGoalModal);
  const headingId = useId();
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const { total, target, progress, contributions, withdrawals } = goalFigures(goal);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['savings', year] });

  async function removeGoal() {
    setRemoving(true);
    setRemoveError(null);
    try {
      await Api.savings.removeGoal(goal.id);
      setConfirming(false);
      await invalidate();
    } catch {
      setConfirming(false);
      setRemoveError('Could not remove the goal. Try again.');
    } finally {
      setRemoving(false);
    }
  }

  const itemCount = goal.items.length;

  return (
    <section id="goal-detail" className="goals-detail" aria-labelledby={headingId}>
      <header className="goals-detail-head">
        <div>
          <h2 id={headingId}>{goal.name}</h2>
          <p>{target !== null ? `Target ${formatCurrency(target)}` : 'No target'} · {year}</p>
        </div>
        {!demo && (
          <div className="goals-detail-actions">
            <Button size="sm" icon="edit" onClick={() => openGoalModal(goal.id)}>Edit goal</Button>
            <Menu
              label="Goal actions"
              ariaLabel="Goal actions"
              icon="dots"
              iconOnly
              caret={false}
              variant="ghost"
              size="sm"
              items={[{ label: 'Remove goal', icon: 'trash', danger: true, onSelect: () => setConfirming(true) }]}
            />
          </div>
        )}
      </header>

      {removeError && <div className="goals-detail-message"><Callout tone="danger" role="alert">{removeError}</Callout></div>}

      <div className="goals-progress">
        <div className="goals-progress-row">
          <p className={`goals-big-num ${total < 0 ? 'is-negative' : ''}`}>{formatCurrency(total)}</p>
          <span>{target !== null ? `of ${formatCurrency(target)}` : 'No target'}</span>
          {progress !== null && <strong className="goals-progress-pct">{progress.toFixed(0)}%</strong>}
        </div>
        {progress !== null && (
          <div
            className="goals-bar is-large"
            role="progressbar"
            aria-label="Progress toward target"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
          >
            <span style={{ width: `${progress}%` }} />
          </div>
        )}
        <dl className="goals-facts">
          {target !== null && (
            <div><dt>Remaining</dt><dd>{formatCurrency(Math.max(0, target - total))}</dd></div>
          )}
          <div><dt>Contributions</dt><dd>{formatCurrency(contributions)}</dd></div>
          <div><dt>Withdrawals</dt><dd>{formatCurrency(withdrawals)}</dd></div>
        </dl>
      </div>

      {demo
        ? <p className="goals-readonly">Demo data is read only.</p>
        : <QuickAddForm goalId={goal.id} onRefresh={invalidate} />}

      <GoalItemsLedger goalName={goal.name} items={goal.items} total={total} onRefresh={invalidate} />

      <Dialog
        open={confirming}
        title={`Remove ${goal.name}?`}
        description="This cannot be undone."
        size="sm"
        onClose={() => setConfirming(false)}
      >
        <p className="goals-confirm-text">
          {itemCount
            ? `The goal and its ${itemCount === 1 ? 'item' : `${itemCount} items`} (balance ${formatCurrency(total)}) are removed.`
            : 'The goal has no items.'}
        </p>
        <div className="ui-dialog-actions">
          <Button variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
          <Button variant="danger" icon="trash" loading={removing} onClick={() => void removeGoal()}>Remove goal</Button>
        </div>
      </Dialog>
    </section>
  );
}

// Two existing calls (create an empty item, then save it). If the second call
// fails, the empty item is removed again so no silent blank item stays behind.
function QuickAddForm({ goalId, onRefresh }: { goalId: number; onRefresh: () => Promise<unknown> }) {
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('');
  const [kind, setKind] = useState<'contribution' | 'withdrawal'>('contribution');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const noteRef = useRef<HTMLInputElement>(null);
  const formId = useId();
  const canAdd = Boolean(note.trim() || amount.trim());

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canAdd || busy) return;
    setBusy(true);
    setError(null);
    const name = normalizeName(note);
    const magnitude = amount.trim() ? Math.abs(parseCurrencyInput(amount)) : 0;
    const value = magnitude === 0 ? 0 : kind === 'withdrawal' ? -magnitude : magnitude;
    try {
      let id: number;
      try {
        id = Number((await Api.savings.addItem(goalId))?.id);
      } catch {
        setError('Could not add the item. Try again.');
        return;
      }
      if (!Number.isFinite(id)) {
        setError('Could not add the item. Try again.');
        await onRefresh();
        return;
      }
      try {
        await Api.savings.updateItem(id, { name, value });
      } catch {
        try {
          await Api.savings.removeItem(id);
          setError('Could not save the item, so it was not added. Try again.');
        } catch {
          setError('Could not save the item. An empty item was left in the list; edit or remove it.');
        }
        await onRefresh();
        return;
      }
      setNote('');
      setAmount('');
      setKind('contribution');
      await onRefresh();
      noteRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="goals-add" aria-label="Add item" onSubmit={(event) => void submit(event)}>
      <div className="goals-add-field">
        <label htmlFor={`${formId}-note`}>Source or note</label>
        <input
          ref={noteRef}
          id={`${formId}-note`}
          className="ui-input"
          value={note}
          maxLength={80}
          placeholder="e.g. October transfer"
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
      <div className="goals-add-field">
        <label htmlFor={`${formId}-amount`}>Amount</label>
        <input
          id={`${formId}-amount`}
          className="ui-input goals-amount"
          inputMode="decimal"
          value={amount}
          placeholder="0,00"
          // The type below sets the sign, so a minus is not accepted here.
          onChange={(event) => setAmount(event.target.value.replace(/[^\d\s,.]/g, ''))}
        />
      </div>
      <Button type="submit" variant="primary" icon="square-plus" disabled={!canAdd} loading={busy}>Add item</Button>
      <div className="goals-add-kind" role="radiogroup" aria-label="Type">
        <label>
          <input type="radio" name={`${formId}-kind`} checked={kind === 'contribution'} onChange={() => setKind('contribution')} />
          Contribution
        </label>
        <label>
          <input type="radio" name={`${formId}-kind`} checked={kind === 'withdrawal'} onChange={() => setKind('withdrawal')} />
          Temporary withdrawal
        </label>
      </div>
      {error && <div className="goals-add-error"><Callout tone="danger" role="alert">{error}</Callout></div>}
    </form>
  );
}

function GoalItemsLedger({
  goalName,
  items,
  total,
  onRefresh,
}: {
  goalName: string;
  items: SavingsItem[];
  total: number;
  onRefresh: () => Promise<unknown>;
}) {
  const demo = useAppStore((s) => s.demo);
  const [rows, setRows] = useState<DraftRow[]>(() => buildDrafts(items));
  // A blank item (from an older version or a failed quick add) opens for editing.
  const [editingRowId, setEditingRowId] = useState<number | null>(
    () => demo ? null : items.find(isBlankItem)?.id ?? null
  );
  const [savingRowId, setSavingRowId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
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
  }, [editingRowId]);

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

  // Failures keep the editor open with the draft and show an error (plan Phase 6).
  async function persistRow(id: number) {
    if (savingRowId === id) return;
    const row = rows.find((candidate) => candidate.id === id);
    if (!row) return;

    const trimmedName = normalizeName(row.nameDraft);
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
      setError(null);
      await onRefresh();
      setEditingRowId((current) => (current === id ? null : current));
    } catch {
      setError('Could not save the item. Try again.');
    } finally {
      setSavingRowId(null);
    }
  }

  async function cancelEditing(id: number) {
    const original = items.find((item) => item.id === id);
    if (!original) return;
    if (isBlankItem(original)) {
      await removeRow(id);
      return;
    }
    resetRow(id);
    setError(null);
    setEditingRowId((current) => (current === id ? null : current));
  }

  async function removeRow(id: number) {
    try {
      await Api.savings.removeItem(id);
      setError(null);
      setEditingRowId((current) => (current === id ? null : current));
      await onRefresh();
    } catch {
      setError('Could not remove the item. Try again.');
    }
  }

  const editorKeys = (id: number) => (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void persistRow(id);
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      void cancelEditing(id);
    }
  };

  return (
    <div className="goals-items-wrap">
      {error && <div className="goals-detail-message"><Callout tone="danger" role="alert">{error}</Callout></div>}
      <table className="goals-items">
        <caption className="sr-only">Items of {goalName}</caption>
        <thead>
          <tr>
            <th scope="col">Source or note</th>
            <th scope="col" className="is-num">Amount</th>
            <th scope="col"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {!rows.length && (
            <tr>
              <td colSpan={3} className="goals-items-empty">
                No savings activity yet. Add the first source or temporary withdrawal.
              </td>
            </tr>
          )}

          {rows.map((row) => {
            const item = items.find((candidate) => candidate.id === row.id);
            if (!item) return null;
            const value = Number(item.value ?? 0);
            const negative = value < 0;

            if (editingRowId === row.id) {
              return (
                <tr key={row.id} className="is-editing">
                  <td colSpan={3}>
                    <div
                      className="goals-item-editor"
                      role="group"
                      aria-label="Edit item"
                      onBlurCapture={(event) => {
                        const nextTarget = event.relatedTarget as Node | null;
                        if (nextTarget && event.currentTarget.contains(nextTarget)) return;
                        void persistRow(row.id);
                      }}
                    >
                      <textarea
                        ref={editorNameRef}
                        className="ui-input goals-note-input"
                        aria-label="Source or note"
                        value={row.nameDraft}
                        placeholder="Source or note"
                        maxLength={80}
                        rows={1}
                        onChange={(event) => updateRow(row.id, { nameDraft: event.target.value })}
                        onKeyDown={editorKeys(row.id)}
                      />
                      <div className="goals-item-value">
                        <input
                          type="text"
                          className="ui-input goals-amount"
                          aria-label="Amount"
                          inputMode="decimal"
                          value={row.valueDraft}
                          placeholder="0,00"
                          onChange={(event) => updateRow(row.id, { valueDraft: event.target.value.replace(/[^\d\s,.\-]/g, '') })}
                          onKeyDown={editorKeys(row.id)}
                        />
                        {row.valueDraft.trim().startsWith('-') && <Badge tone="warning">Temporary withdrawal</Badge>}
                      </div>
                      <div className="goals-item-actions is-visible">
                        <IconButton icon="check" label="Save item" size="sm" disabled={savingRowId === row.id} onClick={() => void persistRow(row.id)} />
                        <IconButton icon="x" label="Cancel item editing" size="sm" disabled={savingRowId === row.id} onClick={() => void cancelEditing(row.id)} />
                      </div>
                    </div>
                  </td>
                </tr>
              );
            }

            return (
              <tr key={row.id}>
                <td className="goals-item-name">
                  <span>{item.name?.trim() || 'Untitled item'}</span>
                  {negative && <Badge tone="warning">Temporary withdrawal</Badge>}
                </td>
                <td className={`is-num ${negative ? 'is-negative' : ''}`}>{formatSignedCurrency(value)}</td>
                <td>
                  {!demo && (
                    <div className="goals-item-actions">
                      <IconButton icon="edit" label={`Edit ${item.name || 'item'}`} size="sm" onClick={() => setEditingRowId(row.id)} />
                      <IconButton icon="trash" label={`Remove ${item.name || 'item'}`} size="sm" onClick={() => void removeRow(row.id)} />
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Current balance</th>
            <td className="is-num">{formatCurrency(total)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
