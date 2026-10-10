import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Api } from '../../api';
import { useAppStore } from '../../store';
import { ModalBase } from './ModalBase';
import { Button, Callout, Input } from '../ui';
import { formatCurrency, parseCurrencyInput } from '../../utils/currency';

export function SavingsGoalModal() {
  const qc = useQueryClient();
  const year = useAppStore((s) => s.year);
  const { goalModal, closeGoalModal } = useAppStore((s) => ({
    goalModal: s.goalModal,
    closeGoalModal: s.closeGoalModal,
  }));
  const open = goalModal.open;
  const editingId = goalModal.goalId;

  const [name, setName] = useState('');
  const [targetDraft, setTargetDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  // Escape restores the saved target and blurs the field; the blur must not
  // reformat the draft typed before Escape (F21 defect characterised in Phase 0).
  const revertingTargetRef = useRef(false);

  const editingGoal = (() => {
    if (!open || !year || editingId == null) return null;
    const cached = qc.getQueryData<{ goals: Array<{ id: number; name: string; targetValue: number | null }> }>([
      'savings',
      year,
    ]);
    return cached?.goals?.find((g) => g.id === editingId) ?? null;
  })();

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editingGoal) {
      setName(editingGoal.name);
      setTargetDraft(
        typeof editingGoal.targetValue === 'number'
          ? formatCurrency(editingGoal.targetValue)
          : ''
      );
    } else {
      setName('');
      setTargetDraft('');
    }
  }, [open, editingGoal]);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => nameInputRef.current?.focus());
    const tm = setTimeout(() => nameInputRef.current?.focus(), 100);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(tm);
    };
  }, [open, editingGoal]);

  const handleClose = () => {
    closeGoalModal();
    setName('');
    setTargetDraft('');
    setError(null);
  };

  const sanitizeValue = (value: string) => value.replace(/[^\d\s,.\-]/g, '');

  const handleTargetBlur = () => {
    if (revertingTargetRef.current) {
      revertingTargetRef.current = false;
      return;
    }
    if (!targetDraft.trim()) return;
    const value = parseCurrencyInput(targetDraft);
    setTargetDraft(formatCurrency(value));
  };

  async function submit() {
    if (!year || !name.trim() || saving) return;
    const trimmedName = name.trim();
    const targetValue = targetDraft.trim() ? parseCurrencyInput(targetDraft) : null;

    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await Api.savings.updateGoal(editingId, { name: trimmedName, targetValue });
      } else {
        await Api.savings.addGoal({ year, name: trimmedName, targetValue });
      }
    } catch {
      // The dialog stays open with the typed values so the user can retry.
      setError('Could not save the goal. Try again.');
      return;
    } finally {
      setSaving(false);
    }

    qc.invalidateQueries({ queryKey: ['savings', year] });
    handleClose();
  }

  return (
    <ModalBase
      open={open}
      onClose={handleClose}
      title={editingId ? 'Edit savings goal' : 'Add savings goal'}
      size="sm"
      mobileAlign="top"
    >
      <form
        className="goals-dialog-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Input
          id="goal-name-input"
          ref={nameInputRef}
          label="Name"
          maxLength={80}
          autoFocus={open}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Input
          id="goal-target-input"
          label="Target amount"
          hint="Optional. Leave blank to hide the progress indicator."
          inputMode="decimal"
          value={targetDraft}
          placeholder="Optional"
          onChange={(event) => setTargetDraft(sanitizeValue(event.target.value))}
          onBlur={handleTargetBlur}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              // Escape reverts the target here instead of closing the dialog.
              event.preventDefault();
              setTargetDraft(
                editingGoal && typeof editingGoal.targetValue === 'number'
                  ? formatCurrency(editingGoal.targetValue)
                  : ''
              );
              revertingTargetRef.current = true;
              event.currentTarget.blur();
            }
          }}
        />
        {error && <Callout tone="danger" role="alert">{error}</Callout>}
        <div className="ui-dialog-actions">
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={!name.trim() || !year} loading={saving}>
            {editingId ? 'Save changes' : 'Add goal'}
          </Button>
        </div>
      </form>
    </ModalBase>
  );
}
