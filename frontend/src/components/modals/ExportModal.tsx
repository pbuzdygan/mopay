import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
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

  async function doExport(){ if (sel.length) await Api.exportYears(sel); }

  return (
    <ModalBase
      open={open}
      title="Export data"
      //subtitle="Export your data for backup or analysis. Nothing is sent anywhere."
      icon="📤"
      onClose={() => closeModal("export")}
      size="md"
    >
      <div className="space-y-4">
        <FormSection
          //label="Data scope"
          title="Choose years to export"
          //description="Download selected years as JSON backups."
        >
            <div className="selection-card">
              {years.map(y=> (
                <label key={y} className="selection-row">
                  <input
                    type="checkbox"
                    checked={sel.includes(y)}
                    onChange={()=> setSel(p=> p.includes(y)? p.filter(v=>v!==y) : [...p, y]) }
                  />
                  <span className="type-body font-medium">{y}</span>
                </label>
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
                disabled={!sel.length}
              >
                Clear selection
              </SoftButton>
              <button
                type="button"
                className="btn min-w-[140px]"
                disabled={!sel.length}
                onClick={doExport}
              >
                Export {sel.length ? `${sel.length}` : ''}
              </button>
            </div>
        </FormSection>

        <div className="modal-footer-premium flex justify-end">
          <SoftButton variant="ghost" onClick={()=>closeModal('export')}>
            Close
          </SoftButton>
        </div>
      </div>
    </ModalBase>
  );
}
