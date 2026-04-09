import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ModalBase } from './ModalBase';
import { useAppStore } from '../../store';
import { Api, ApiError } from '../../api';
import { FormSection } from '../FormSection';
import { SoftButton } from '../SoftButton';

type ImportApiBody = {
  error?: string;
  message?: string;
  years?: unknown;
};

type ParsedImportError =
  | { kind: 'overwrite_required'; years: number[]; message: string }
  | { kind: 'import_in_progress'; message: string }
  | { kind: 'sqlite_busy'; message: string }
  | { kind: 'auth'; message: string }
  | { kind: 'key_mismatch'; message: string }
  | { kind: 'validation_invalid_file'; message: string }
  | { kind: 'other'; message: string };

function asImportApiBody(value: unknown): ImportApiBody {
  return value && typeof value === 'object' ? (value as ImportApiBody) : {};
}

function parseYears(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => Number(item)).filter((item) => Number.isInteger(item));
}

function parseImportError(error: unknown): ParsedImportError {
  if (!(error instanceof ApiError)) {
    return { kind: 'other', message: 'Import failed. Please check the template and try again.' };
  }
  const body = asImportApiBody(error.body);
  const code = typeof body.error === 'string' ? body.error : '';
  const message = typeof body.message === 'string' && body.message.trim() ? body.message : error.message;

  if (code === 'OVERWRITE_REQUIRED') {
    const years = parseYears(body.years);
    return {
      kind: 'overwrite_required',
      years,
      message:
        years.length > 0
          ? `Year(s) already exist: ${years.join(', ')}. Mark overwrite or remove them from the file.`
          : 'One or more selected years already exist. Mark overwrite to continue.',
    };
  }
  if (code === 'IMPORT_IN_PROGRESS') {
    return { kind: 'import_in_progress', message: message || 'Another import is currently running. Please wait.' };
  }
  if (code === 'SQLITE_BUSY') {
    return { kind: 'sqlite_busy', message: message || 'Database is busy/locked. Please retry.' };
  }
  if (code === 'AUTH_REQUIRED' || code === 'AUTH_EXPIRED' || error.status === 401) {
    return { kind: 'auth', message: 'Session expired. Unlock with PIN and try import again.' };
  }
  if (code === 'ENCRYPTION_KEY_MISMATCH') {
    return {
      kind: 'key_mismatch',
      message: message || 'Encryption key mismatch detected. Restore previous key or reset data before import.',
    };
  }
  if (code === 'INVALID_FILE' || code === 'INVALID_NAME' || code === 'MISSING_DATA') {
    return { kind: 'validation_invalid_file', message: 'Invalid template structure. Check Guide' };
  }
  return { kind: 'other', message: message || 'Import failed. Please check the template and try again.' };
}

export function ImportModal() {
  const { modals, closeModal } = useAppStore();
  const open = modals.import;
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<null | { type: 'ok' | 'err'; text: string }>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [payload, setPayload] = useState<null | { name: string; data: string }>(null);
  const [years, setYears] = useState<Array<{ year: number; exists: boolean; overwrite: boolean }>>([]);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  useEffect(() => {
    if (!message) return;
    const tm = setTimeout(() => setMessage(null), 5000);
    return () => clearTimeout(tm);
  }, [message]);

  useEffect(() => {
    if (!open) {
      setMessage(null);
      setIsValidating(false);
      setIsImporting(false);
      setPayload(null);
      setYears([]);
      setConfirmOverwrite(false);
    }
  }, [open]);

  async function downloadTemplate() {
    await Api.downloadImportTemplate();
  }

  function openGuide() {
    window.open('https://github.com/pbuzdygan/mopay/wiki', '_blank', 'noopener,noreferrer');
  }

  async function handleImportClick() {
    setMessage(null);
    inputRef.current?.click();
  }

  function toBase64(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.onload = () => {
        const result = String(reader.result || '');
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      };
      reader.readAsDataURL(file);
    });
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    setMessage(null);
    setYears([]);
    setPayload(null);
    setConfirmOverwrite(false);

    if (file.name !== 'mopay_import_template.xlsx') {
      setMessage({
        type: 'err',
        text: 'Invalid import template. Check Guide',
      });
      return;
    }

    try {
      setIsValidating(true);
      const data = await toBase64(file);
      const result = await Api.validateImportTemplate({ name: file.name, data });
      const nextYears = (result?.years ?? []).map((item: { year: number; exists: boolean }) => ({
        year: item.year,
        exists: item.exists,
        overwrite: false,
      }));
      setYears(nextYears);
      setPayload({ name: file.name, data });
      setMessage({
        type: 'ok',
        text: 'Template verified. Review the years above.',
      });
    } catch (error) {
      const parsed = parseImportError(error);
      if (parsed.kind === 'sqlite_busy' || parsed.kind === 'auth' || parsed.kind === 'key_mismatch') {
        setMessage({ type: 'err', text: parsed.message });
      } else {
        setMessage({
          type: 'err',
          text: 'Invalid template structure. Check Guide',
        });
      }
    } finally {
      setIsValidating(false);
    }
  }

  const overwriteYears = years.filter((item) => item.exists && item.overwrite).map((item) => item.year);
  const importYears = years.filter((item) => !item.exists || item.overwrite).map((item) => item.year);
  const hasNewYears = years.some((item) => !item.exists);
  const summaryActive = years.length > 0;
  const canImport =
    Boolean(payload && years.length) &&
    (hasNewYears || overwriteYears.length > 0) &&
    (!overwriteYears.length || confirmOverwrite) &&
    !isImporting;

  useEffect(() => {
    if (!overwriteYears.length && confirmOverwrite) {
      setConfirmOverwrite(false);
    }
  }, [overwriteYears, confirmOverwrite]);

  useEffect(() => {
    if (overwriteYears.length && message) {
      setMessage(null);
    }
  }, [overwriteYears.length, message]);

  async function handleConfirmImport() {
    if (!payload || !years.length) return;
    setMessage(null);
    setIsImporting(true);
    try {
      const result = await Api.importData({ name: payload.name, data: payload.data, overwriteYears, importYears });
      qc.invalidateQueries({ queryKey: ['years'] });
      setMessage({
        type: 'ok',
        text: `Import completed. Imported ${result.imported?.length ?? 0}, skipped ${result.skipped?.length ?? 0}.`,
      });
      setYears([]);
      setPayload(null);
      setConfirmOverwrite(false);
    } catch (err) {
      const parsed = parseImportError(err);
      if (parsed.kind === 'overwrite_required') {
        if (parsed.years.length > 0) {
          setYears((prev) =>
            prev.map((item) => (parsed.years.includes(item.year) ? { ...item, exists: true, overwrite: false } : item))
          );
        }
        setConfirmOverwrite(false);
        setMessage({ type: 'err', text: parsed.message });
        return;
      }
      if (parsed.kind === 'import_in_progress' || parsed.kind === 'sqlite_busy' || parsed.kind === 'auth' || parsed.kind === 'key_mismatch') {
        setMessage({ type: 'err', text: parsed.message });
        return;
      }
      setMessage({ type: 'err', text: parsed.message });
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <ModalBase
      open={open}
      title="Import data"
      icon={<img src="/icons/ui/table-import.svg" alt="" className="modal-header-icon-svg" aria-hidden="true" />}
      onClose={() => closeModal('import')}
      size="md"
    >
      <div className="space-y-3 sm:space-y-4 modal-compact-mobile">
        <FormSection>
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center w-full">
              <button
                type="button"
                className="btn min-w-[180px] w-full sm:w-auto"
                onClick={downloadTemplate}
              >
                Download template
              </button>
              <button
                type="button"
                className="btn min-w-[180px] w-full sm:w-auto"
                onClick={openGuide}
              >
                Guide (wiki)
              </button>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center w-full">
              <button
                type="button"
                className={`btn min-w-[180px] w-full sm:w-auto min-h-[42px] whitespace-nowrap ${
                  payload ? 'btn-warning' : ''
                }`}
                disabled={payload ? !canImport : isValidating}
                onClick={payload ? handleConfirmImport : handleImportClick}
              >
                {payload
                  ? isImporting
                    ? 'Importing...'
                    : 'Confirm import'
                  : isValidating
                  ? 'Validating...'
                  : 'Import'}
              </button>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </FormSection>

        <FormSection title="Import summary">
          <div className={`stack-sm ${summaryActive ? '' : 'import-summary-disabled'}`}>
            <div className="selection-card year-selection-grid import-summary-card">
              {years.map((item) => {
                const statusClass = item.exists
                  ? item.overwrite
                    ? 'import-overwrite'
                    : 'import-existing'
                  : 'import-new';
                return (
                  <button
                    key={item.year}
                    type="button"
                    className={`year-tile ${statusClass}`}
                    aria-pressed={item.exists ? item.overwrite : true}
                    aria-disabled={!item.exists}
                    onClick={() => {
                      if (!item.exists) return;
                      setYears((prev) =>
                        prev.map((yearItem) =>
                          yearItem.year === item.year
                            ? { ...yearItem, overwrite: !yearItem.overwrite }
                            : yearItem
                        )
                      );
                    }}
                  >
                    {item.year}
                  </button>
                );
              })}
              {!years.length && <div className="selection-empty">Import a template</div>}
            </div>
            <div className="legend-stack text-sm text-textSec">
              <div className="legend-row">
                <span className="year-tile import-existing legend-swatch" aria-hidden="true" />
                <span>Exists in DB - default skip. Overwrite by marking.</span>
              </div>
              <div className="legend-row">
                <span className="year-tile import-new legend-swatch" aria-hidden="true" />
                <span>Ready to import.</span>
              </div>
            </div>
          </div>
        </FormSection>

        <div className="modal-footer-premium flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-h-[34px]">
            {message ? (
              <div className={`feedback-badge ${message.type === 'ok' ? 'ok' : 'err'}`}>
                {message.text}
              </div>
            ) : overwriteYears.length > 0 ? (
              <label className="flex items-center gap-2 text-sm text-textSec">
                <input
                  type="checkbox"
                  className="confirm-checkbox confirm-checkbox-pulse"
                  checked={confirmOverwrite}
                  onChange={(event) => setConfirmOverwrite(event.target.checked)}
                />
                <span>Agree to overwrite: {overwriteYears.join(', ')}</span>
              </label>
            ) : null}
          </div>
          <SoftButton variant="ghost" onClick={() => closeModal('import')}>
            Close
          </SoftButton>
        </div>
      </div>
    </ModalBase>
  );
}
