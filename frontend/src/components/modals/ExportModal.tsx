import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ModalBase } from './ModalBase';
import { useAppStore } from '../../store';
import { Api } from '../../api';
import { FormSection } from '../FormSection';
import { SoftButton } from '../SoftButton';

export function ExportModal(){
  const { modals, closeModal } = useAppStore();
  const open = modals.export;
  const yearsQ = useQuery({ queryKey: ['years'], queryFn: Api.years.list });
  const years = (yearsQ.data?.years ?? []) as number[];
  const [sel, setSel] = useState<number[]>([]);
  const [message, setMessage] = useState<null | { type: 'ok' | 'err'; text: string }>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (!open) {
      setSel([]);
      setMessage(null);
      setIsExporting(false);
    }
  }, [open]);

  useEffect(() => {
    if (!message) return;
    const tm = setTimeout(() => setMessage(null), 5000);
    return () => clearTimeout(tm);
  }, [message]);

  async function doExport(){
    if (!sel.length) return;
    setIsExporting(true);
    setMessage(null);
    try {
      await Api.exportYears(sel);
      setMessage({ type: 'ok', text: `Export completed. Exported ${sel.length} year(s).` });
      setSel([]);
    } catch {
      setMessage({ type: 'err', text: 'Export failed. Please try again.' });
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <ModalBase
      open={open}
      title="Export data"
      //subtitle="Export your data for backup or analysis. Nothing is sent anywhere."
      icon="📤"
      onClose={() => closeModal("export")}
      size="md"
    >
      <div className="space-y-3 sm:space-y-4 modal-compact-mobile">
        <FormSection
          //label="Data scope"
          title="Choose years to export"
          //description="Download selected years as JSON backups."
        >
          <div className="selection-card year-selection-grid">
            {years.map((y) => (
              <button
                key={y}
                type="button"
                className={`year-tile ${sel.includes(y) ? 'is-selected' : ''}`}
                aria-pressed={sel.includes(y)}
                onClick={() => setSel((p) => (p.includes(y) ? p.filter((v) => v !== y) : [...p, y]))}
              >
                {y}
              </button>
            ))}
            {!years.length && (
              <div className="selection-empty">
                No years available.
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 justify-between">
            <SoftButton
              type="button"
              variant="ghost"
              onClick={() => setSel([])}
              disabled={!sel.length || isExporting}
            >
              Clear selection
            </SoftButton>
            <button
              type="button"
              className="btn min-w-[140px]"
              disabled={!sel.length || isExporting}
              onClick={doExport}
            >
              {isExporting ? 'Exporting...' : `Export ${sel.length ? `${sel.length}` : ''}`}
            </button>
          </div>
        </FormSection>

        <div className="modal-footer-premium flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-h-[34px]">
            {message && (
              <div className={`feedback-badge ${message.type === 'ok' ? 'ok' : 'err'}`}>
                {message.text}
              </div>
            )}
          </div>
          <SoftButton variant="ghost" onClick={()=>closeModal('export')}>
            Close
          </SoftButton>
        </div>
      </div>
    </ModalBase>
  );
}
