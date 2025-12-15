import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Api } from '../../api';
import { useAppStore } from '../../store';
import { ModalBase } from './ModalBase';
import { FormSection } from '../FormSection';
import { SoftButton } from '../SoftButton';
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
  const nameInputRef = useRef<HTMLInputElement>(null);

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
  };

  const sanitizeValue = (value: string) => value.replace(/[^\d\s,.\-]/g, '');

  const handleTargetBlur = () => {
    if (!targetDraft.trim()) return;
    const value = parseCurrencyInput(targetDraft);
    setTargetDraft(formatCurrency(value));
  };

  async function submit() {
    if (!year || !name.trim()) return;
    const trimmedName = name.trim();
    const targetValue = targetDraft.trim() ? parseCurrencyInput(targetDraft) : null;

    if (editingId) {
      await Api.savings.updateGoal(editingId, { name: trimmedName, targetValue });
    } else {
      await Api.savings.addGoal({ year, name: trimmedName, targetValue });
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
    >
      <div className="space-y-3 sm:space-y-4">
        <FormSection title="Goal basics">
          <div className="field-stack">
            <label className="field-label" htmlFor="goal-name-input">
              Name
            </label>
            <input
              id="goal-name-input"
              ref={nameInputRef}
              type="text"
              className="input"
              maxLength={80}
              autoFocus={open}
              value={name}
              onChange={(ev) => setName(ev.target.value)}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter') submit();
              }}
            />
            <p className="field-helper">Give this goal a short label.</p>
          </div>

          <div className="field-stack">
            <label className="field-label" htmlFor="goal-target-input">
              Target amount
            </label>
            <input
              id="goal-target-input"
              type="text"
              className="input"
              inputMode="decimal"
              value={targetDraft}
              placeholder="Optional"
              onChange={(ev) => setTargetDraft(sanitizeValue(ev.target.value))}
              onBlur={handleTargetBlur}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter') submit();
                if (ev.key === 'Escape') {
                  if (editingGoal && typeof editingGoal.targetValue === 'number') {
                    setTargetDraft(formatCurrency(editingGoal.targetValue));
                  } else {
                    setTargetDraft('');
                  }
                  (ev.currentTarget as HTMLInputElement).blur();
                }
              }}
            />
            <p className="field-helper">Leave blank to hide the progress indicator.</p>
          </div>
        </FormSection>

        <div className="modal-footer-premium flex justify-end gap-2">
          <SoftButton type="button" variant="ghost" onClick={handleClose}>
            Cancel
          </SoftButton>
          <button type="button" className="btn" disabled={!name.trim() || !year} onClick={submit}>
            {editingId ? 'Save changes' : 'Add goal'}
          </button>
        </div>
      </div>
    </ModalBase>
  );
}
