import { useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ModalBase } from './ModalBase';
import { useAppStore } from '../../store';
import { Api } from '../../api';
import { FormSection } from '../FormSection';
import { SoftButton } from '../SoftButton';

export function InitiateYearModal() {
  const { modals, closeModal, setYear, pinSession } = useAppStore();
  const open = modals.initiateYear;

  const qc = useQueryClient();
  const [year, setYearInput] = useState('');
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && pinSession) {
      const tm = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(tm);
    }
  }, [open, pinSession]);

  async function save() {
    const y = Number(year);

    if (!Number.isInteger(y) || String(y).length !== 4) {
      setError(true);
      setTimeout(() => setError(false), 400);
      return;
    }

    await Api.years.add(y);
    setYear(y);

    setYearInput('');
    await qc.invalidateQueries({ queryKey: ['years'] });

    closeModal('initiateYear');
  }

  return (
    <ModalBase
      open={open}
      title="Initiate MOPAY"
      icon="🚀"
      onClose={() => {}}
      disableClose
      size="sm"
    >
      <div className="stack">
        <FormSection
          label="Create year"
        >
          <div className="field-stack">
            <label className="field-label" htmlFor="init-year-input">
            </label>
            <input
              id="init-year-input"
              ref={inputRef}
              inputMode="numeric"
              className={`input w-32 ${error ? 'input-error' : ''}`}
              placeholder="YYYY"
              maxLength={4}
              value={year}
              onChange={(e) =>
                setYearInput(e.target.value.replace(/[^0-9]/g, ''))
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter') save();
              }}
            />
          </div>
        </FormSection>

        <div className="modal-footer-premium cluster justify-end">
          <SoftButton
            variant="ghost"
            onClick={() => setYearInput('')}
            disabled={!year.length}
          >
            Clear
          </SoftButton>
          <button
            className="btn"
            onClick={save}
            disabled={year.length !== 4}
          >
            Start
          </button>
        </div>
      </div>
    </ModalBase>
  );
}
