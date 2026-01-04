import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useEffect, useState } from 'react';
import { ModalBase } from './ModalBase';
import { useAppStore } from '../../store';
import { Api } from '../../api';
import { FormSection } from '../FormSection';
import { SoftButton } from '../SoftButton';

export function YearOperationsModal(){
  const { modals, closeModal } = useAppStore();
  const open = modals.yearOps;
  const qc = useQueryClient();
  const yearsQ = useQuery({ queryKey: ['years'], queryFn: Api.years.list });
  const years = (yearsQ.data?.years ?? []) as number[];
  const [sel, setSel] = useState<number[]>([]);
  const [newYear, setNewYear] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<null | { type: "ok" | "err"; text: string }>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);


  async function add() {
    const y = Number(newYear);
    if (!Number.isInteger(y) || String(y).length !== 4) return;
  
    // sprawdzenie duplikatu
    if (years.includes(y)) {
      setMessage({ type: "err", text: `Year ${y} already exists` });
      setTimeout(() => setMessage(null), 2000);
      return;
    }
  
    await Api.years.add(y);
  
    // sukces
    setMessage({ type: "ok", text: `Year ${y} added` });
    setTimeout(() => setMessage(null), 2000);
  
    // wyczyść pole
    setNewYear("");
  
    // odśwież listę lat
    qc.invalidateQueries({ queryKey: ["years"] });
  
    // ustaw aktywny rok
    useAppStore.getState().setYear(y);
  
    // focus ponownie w input
    setTimeout(() => inputRef.current?.focus(), 30);
  }
  
  async function remove() {
    if (!sel.length) return;

    const remainingYears = years.filter((y) => !sel.includes(y));

    await Api.years.remove(sel);

    setMessage({ type: "ok", text: `Removed ${sel.length} year(s)` });
    setTimeout(() => setMessage(null), 2000);

    setSel([]);

    if (remainingYears.length) {
      const fallback = Math.max(...remainingYears);
      useAppStore.getState().setYear(fallback);
    } else {
      useAppStore.getState().setYear(null);
    }

    qc.invalidateQueries({ queryKey: ["years"] });
  }
  



  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    const tm = setTimeout(() => inputRef.current?.focus(), 60);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(tm);
    };
  }, [open]);

  useEffect(() => {
    if (!confirmingDelete) return;
    const tm = setTimeout(() => setConfirmingDelete(false), 4000);
    return () => clearTimeout(tm);
  }, [confirmingDelete]);

  useEffect(() => {
    if (!open) setConfirmingDelete(false);
  }, [open]);

  useEffect(() => {
    if (!open) setSel([]);
  }, [open]);
  

  return (
    <ModalBase
      open={open}
      title="Year operations"
      subtitle="At least one year is required"
      icon="📅"
      onClose={() => closeModal("yearOps")}
    >
      <div className="space-y-3 sm:space-y-4 modal-compact-mobile">
        <FormSection
          label="Create year"
        >
          <div className="field-row">
            <div className="field-stack">
              <label className="field-label" htmlFor="new-year-input">Year</label>
                <input
                  id="new-year-input"
                  ref={inputRef}
                  className="input"
                  autoFocus={open}
                  placeholder="YYYY"
                  inputMode="numeric"
                  maxLength={4}
                  value={newYear}
                  onChange={(e) =>
                    setNewYear(e.target.value.replace(/[^0-9]/g, ""))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") add();
                    if (e.key === "Escape") closeModal("yearOps");
                  }}
                />
              </div>
              <button className="btn min-w-[140px]" disabled={newYear.length!==4} onClick={add}>
                Add year
              </button>
            </div>
        </FormSection>

        <FormSection
          label="Cleanup"
        >
          <div className="selection-card year-selection-grid">
            {years.map(y=> (
              <button
                key={y}
                type="button"
                className={`year-tile ${sel.includes(y) ? 'is-selected' : ''}`}
                aria-pressed={sel.includes(y)}
                onClick={() => {
                  setConfirmingDelete(false);
                  setSel((p) => (p.includes(y) ? p.filter((v) => v !== y) : [...p, y]));
                }}
              >
                {y}
              </button>
            ))}
            {!years.length && (
              <div className="selection-empty">
                No years in DB — add one to initialize.
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2 justify-between">
            <SoftButton
              type="button"
              variant="ghost"
              onClick={() => {
                setConfirmingDelete(false);
                setSel([]);
              }}
              disabled={!sel.length}
            >
              Clear selection
            </SoftButton>
            <SoftButton
              type="button"
              variant="danger"
              disabled={!sel.length}
              onClick={() => {
                if (!confirmingDelete) {
                  setConfirmingDelete(true);
                  return;
                }
                setConfirmingDelete(false);
                remove();
              }}
            >
              {confirmingDelete ? 'Confirm' : `Delete ${sel.length ? `${sel.length} year(s)` : 'years'}`}
            </SoftButton>
          </div>
        </FormSection>

        <div className="modal-footer-premium flex items-center justify-between gap-3">
          <div className="min-w-0">
            {message && (
              <div className={`feedback-badge ${message.type === 'ok' ? 'ok' : 'err'}`}>
                {message.text}
              </div>
            )}
          </div>
          <SoftButton variant="ghost" onClick={()=>closeModal('yearOps')}>
            Close
          </SoftButton>
        </div>
      </div>
    </ModalBase>
  );
}
