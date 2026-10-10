import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ModalBase } from './ModalBase';
import { useAppStore } from '../../store';
import { Api } from '../../api';
import { Button, Callout, Icon } from '../ui';

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

  // Success messages fade after 5 s; errors stay until the next action or until
  // the dialog closes, so a failure is not missed while the user looks away.
  useEffect(() => {
    if (message?.type !== 'ok') return;
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
      icon={<Icon name="table-export" />}
      onClose={() => closeModal("export")}
      size="md"
    >
      <div className="dialog-form">
        <div role="group" aria-labelledby="export-years-label" className="dialog-years-field">
          <p id="export-years-label" className="ui-field-label">Choose years to export</p>
          <div className="dialog-years">
            {years.map((y) => (
              <button
                key={y}
                type="button"
                className="dialog-year"
                aria-pressed={sel.includes(y)}
                onClick={() => setSel((p) => (p.includes(y) ? p.filter((v) => v !== y) : [...p, y]))}
              >
                {y}
              </button>
            ))}
            {!years.length && <p className="dialog-years-empty">No years available.</p>}
          </div>
        </div>
        {message && (
          <Callout tone={message.type === 'ok' ? 'success' : 'danger'} role={message.type === 'ok' ? 'status' : 'alert'}>
            {message.text}
          </Callout>
        )}
        <div className="ui-dialog-actions dialog-actions-split">
          <Button variant="ghost" onClick={() => setSel([])} disabled={!sel.length || isExporting}>
            Clear selection
          </Button>
          <span className="dialog-actions-end">
            <Button variant="ghost" onClick={() => closeModal('export')}>
              Close
            </Button>
            <Button variant="primary" icon="table-export" disabled={!sel.length} loading={isExporting} onClick={doExport}>
              {`Export ${sel.length ? `${sel.length}` : ''}`}
            </Button>
          </span>
        </div>
      </div>
    </ModalBase>
  );
}
