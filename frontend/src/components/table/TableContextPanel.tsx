import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SoftButton } from '../SoftButton';
import type { EntryGroup, EntryRowData } from './types';

export type TableContextTarget =
  | { kind: 'entry'; entry: EntryRowData }
  | { kind: 'group'; group: EntryGroup; entryCount: number };

type EntryDetailsPatch = {
  name: string;
  groupId: number | null;
  comment: string;
};

type Props = {
  target: TableContextTarget | null;
  groups: EntryGroup[];
  onClose: () => void;
  onSaveEntry: (entryId: number, patch: EntryDetailsPatch) => Promise<void>;
  onSaveGroup: (groupId: number, name: string) => Promise<void>;
  onRemoveEntry: (entryId: number) => Promise<void>;
  onRemoveGroup: (groupId: number) => Promise<void>;
  onAddEntry: (groupId: number) => void;
  onArrangeGroup: () => void;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'The change could not be saved.';
}

export function TableContextPanel({
  target,
  groups,
  onClose,
  onSaveEntry,
  onSaveGroup,
  onRemoveEntry,
  onRemoveGroup,
  onAddEntry,
  onArrangeGroup,
}: Props) {
  const [name, setName] = useState('');
  const [groupId, setGroupId] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!target) return;
    if (target.kind === 'entry') {
      setName(target.entry.name);
      setGroupId(target.entry.groupId ?? null);
      setComment(target.entry.comment ?? '');
    } else {
      setName(target.group.name);
      setGroupId(null);
      setComment('');
    }
    setError('');
    setConfirmRemove(false);
    const timer = window.setTimeout(() => nameRef.current?.focus(), 180);
    return () => window.clearTimeout(timer);
  }, [target]);

  useEffect(() => {
    if (!target) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, saving, target]);

  const save = async () => {
    if (!target || !name.trim() || saving) return;
    setSaving(true);
    setError('');
    try {
      if (target.kind === 'entry') {
        await onSaveEntry(target.entry.id, {
          name: name.trim().slice(0, 40),
          groupId,
          comment,
        });
      } else {
        await onSaveGroup(target.group.id, name.trim().slice(0, 40));
      }
      onClose();
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!target || saving) return;
    setSaving(true);
    setError('');
    try {
      if (target.kind === 'entry') await onRemoveEntry(target.entry.id);
      else await onRemoveGroup(target.group.id);
      onClose();
    } catch (removeError) {
      setError(errorMessage(removeError));
      setSaving(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      {target && (
        <div className="table-context-layer">
          <motion.button
            type="button"
            aria-label="Close details"
            className="table-context-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !saving && onClose()}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="table-context-title"
            className="table-context-panel"
            initial={{ opacity: 0.7 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <header className="table-context-header">
              <div>
                <span className="table-context-kicker">{target.kind === 'entry' ? 'Entry' : 'Group'}</span>
                <h2 id="table-context-title" className="type-title-m">
                  {target.kind === 'entry' ? 'Entry details' : 'Group details'}
                </h2>
                <p className="type-body-sm text-textSec">
                  {target.kind === 'entry'
                    ? 'Edit structure and context without changing table mode.'
                    : `${target.entryCount} ${target.entryCount === 1 ? 'entry' : 'entries'} in this group.`}
                </p>
              </div>
              <SoftButton type="button" variant="ghost" className="table-context-close" onClick={onClose} disabled={saving} aria-label="Close details">
                ✕
              </SoftButton>
            </header>

            <div className="table-context-content">
              <label className="field-stack">
                <span className="field-label">Name</span>
                <input
                  ref={nameRef}
                  className="input"
                  maxLength={40}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void save();
                    }
                  }}
                />
              </label>

              {target.kind === 'entry' ? (
                <>
                  <label className="field-stack">
                    <span className="field-label">Group</span>
                    <select
                      className="input"
                      value={groupId ?? ''}
                      onChange={(event) => setGroupId(event.target.value ? Number(event.target.value) : null)}
                    >
                      <option value="">Ungrouped</option>
                      {groups.map((group) => (
                        <option key={group.id} value={group.id}>{group.name}</option>
                      ))}
                    </select>
                    <span className="field-helper">Moving one entry belongs here, not in selection mode.</span>
                  </label>
                  <label className="field-stack">
                    <span className="field-label">Comment</span>
                    <textarea
                      className="input table-context-comment"
                      maxLength={240}
                      value={comment}
                      onChange={(event) => setComment(event.target.value)}
                      placeholder="Optional context for this entry"
                    />
                  </label>
                </>
              ) : (
                <div className="table-context-shortcuts">
                  <span className="field-label">Group actions</span>
                  <div className="flex flex-wrap gap-2">
                    <SoftButton type="button" onClick={() => onAddEntry(target.group.id)} disabled={saving}>
                      + Add entry here
                    </SoftButton>
                    <SoftButton type="button" onClick={onArrangeGroup} disabled={saving}>
                      Arrange
                    </SoftButton>
                  </div>
                </div>
              )}

              {error && <p className="table-context-error" role="alert">{error}</p>}

              <div className="table-context-save-row">
                <SoftButton type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</SoftButton>
                <button type="button" className="btn px-5" onClick={() => void save()} disabled={!name.trim() || saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>

              <section className="table-context-danger">
                <div>
                  <strong>{target.kind === 'entry' ? 'Remove entry' : 'Remove group'}</strong>
                  <p>
                    {target.kind === 'entry'
                      ? 'The entry and its values will be removed.'
                      : 'Entries will remain and move to Ungrouped.'}
                  </p>
                </div>
                {!confirmRemove ? (
                  <SoftButton type="button" variant="danger" onClick={() => setConfirmRemove(true)} disabled={saving}>Remove</SoftButton>
                ) : (
                  <div className="table-context-confirm">
                    <span>Are you sure?</span>
                    <SoftButton type="button" variant="ghost" onClick={() => setConfirmRemove(false)} disabled={saving}>No</SoftButton>
                    <SoftButton type="button" variant="danger" onClick={() => void remove()} disabled={saving}>Yes, remove</SoftButton>
                  </div>
                )}
              </section>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
