import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { MONTHS, MONTH_NAMES } from '../../utils/months';
import { formatCurrency, parseCurrencyInputNullable } from '../../utils/currency';
import { Button, Callout, Icon, IconButton } from '../ui';
import { editDraft, filterValueInput, formatMonthValue, monthValue } from './GridRows';
import type { SaveState } from './useSaveStatus';
import type { EntryGroup, EntryRowData, EntryTag, GridSelection, TagColor } from './types';

export type EntryDetailsPatch = Partial<{ name: string; groupId: number | null; comment: string }>;

type InspectorProps = {
  selection: GridSelection | null;
  entry: EntryRowData | null;
  group: EntryGroup | null;
  /** Entries in the selected group (group variant). */
  groupEntryCount: number;
  groups: EntryGroup[];
  tags: Record<string, EntryTag | undefined>;
  year: number;
  /** Entries of the same type in the previous year; null when that year does not exist (D5). */
  previousYearEntries: EntryRowData[] | null;
  readOnly: boolean;
  saveState: SaveState;
  /** Changes when focus should move into the panel (name click, Shift+Enter on a cell). */
  focusRequest: number;
  onClose: () => void;
  /** Switches the cell variant to the entry's details (name, group, comment, remove). */
  onShowEntry: (entry: EntryRowData) => void;
  onSaveMonth: (entry: EntryRowData, month: string, value: number | null) => void;
  onSaveEntry: (entry: EntryRowData, patch: EntryDetailsPatch) => Promise<boolean>;
  onSaveGroup: (group: EntryGroup, name: string) => Promise<boolean>;
  onSaveTag: (entry: EntryRowData, month: string, color: TagColor, text: string) => Promise<boolean>;
  onRemoveEntry: (entry: EntryRowData) => Promise<boolean>;
  onRemoveGroup: (group: EntryGroup) => Promise<boolean>;
  onAddEntry: (groupId: number) => void;
  onArrangeGroup: () => void;
};

const TAG_COLORS: Array<{ id: TagColor; label: string }> = [
  { id: 'none', label: 'No tag' },
  { id: 'grey', label: 'Grey' },
  { id: 'green', label: 'Green' },
  { id: 'orange', label: 'Orange' },
  { id: 'red', label: 'Red' },
];

const monthIndex = (month: string) => MONTHS.indexOf(month as (typeof MONTHS)[number]);
const monthName = (month: string) => MONTH_NAMES[monthIndex(month)] ?? month;
const timeText = (date: Date) => date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

/** Pending / saved / failed state of the last change, with retry and undo. */
export function SaveStatusLine({ state }: { state: SaveState }) {
  if (state.status === 'saving') return <span className="ledger-save" role="status">Saving…</span>;
  if (state.status === 'saved') {
    return <span className="ledger-save" role="status"><Icon name="check" size="sm" />Saved {timeText(state.savedAt)}</span>;
  }
  if (state.status === 'error') {
    const { error } = state;
    return (
      <div className="ledger-save is-error" role="alert">
        <Icon name="alert-triangle" size="sm" />
        <span>Could not save {error.label}. {error.message}</span>
        <span className="ledger-save-actions">
          <Button size="sm" variant="ghost" onClick={error.retry}>Retry</Button>
          {error.undo && <Button size="sm" variant="ghost" onClick={error.undo}>Undo change</Button>}
        </span>
      </div>
    );
  }
  return null;
}

function ValueSection({ entry, month, year, readOnly, onSave }: {
  entry: EntryRowData;
  month: string;
  year: number;
  readOnly: boolean;
  onSave: InspectorProps['onSaveMonth'];
}) {
  const value = monthValue(entry, month);
  const [draft, setDraft] = useState(editDraft(value));
  const focused = useRef(false);
  const index = monthIndex(month);
  const previous = index > 0 ? monthValue(entry, MONTHS[index - 1]) : null;
  const values = MONTHS.map((m) => monthValue(entry, m)).filter((v): v is number => v !== null);
  const average = values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100 : null;

  useEffect(() => {
    if (!focused.current) setDraft(editDraft(value));
  }, [value]);

  // Unchanged text is not saved, so an empty month stays empty (F07 rules otherwise).
  const commit = () => {
    if (draft === editDraft(value)) return;
    const next = parseCurrencyInputNullable(draft);
    setDraft(editDraft(next));
    if (next !== value) onSave(entry, month, next);
  };
  const fill = (next: number | null) => {
    setDraft(editDraft(next));
    if (next !== value) onSave(entry, month, next);
  };

  return (
    <section className="ledger-insp-sec" aria-label="Value">
      <h3>Value</h3>
      {readOnly ? (
        <p className="ledger-insp-value">{formatMonthValue(value)}</p>
      ) : (
        <>
          <input
            className="ledger-insp-value-input"
            aria-label={`${monthName(month)} ${year} value`}
            inputMode="decimal"
            value={draft}
            data-autofocus
            placeholder="No value"
            onFocus={(event) => {
              focused.current = true;
              // Typing replaces the current value.
              event.currentTarget.select();
            }}
            onChange={(event) => setDraft(filterValueInput(event.target.value))}
            onBlur={() => {
              focused.current = false;
              commit();
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commit();
              // A changed draft is reverted first; otherwise Escape closes the panel.
              if (event.key === 'Escape' && draft !== editDraft(value)) {
                event.preventDefault();
                setDraft(editDraft(value));
              }
            }}
          />
          <div className="ledger-quick" role="group" aria-label="Quick fill">
            {previous !== null && (
              <button type="button" aria-label={`Use ${monthName(MONTHS[index - 1])} value ${formatCurrency(previous)}`} onClick={() => fill(previous)}>
                {MONTHS[index - 1]} {formatCurrency(previous)}
              </button>
            )}
            {average !== null && (
              <button type="button" aria-label={`Use average ${formatCurrency(average)}`} onClick={() => fill(average)}>
                Avg {formatCurrency(average)}
              </button>
            )}
            {value !== null && (
              <button type="button" aria-label="Clear value" onClick={() => fill(null)}>Clear</button>
            )}
          </div>
        </>
      )}
    </section>
  );
}

/** Cell variant: the entry's name and group, with a link to its details. */
function EntryLine({ entry, groups, onShowEntry }: {
  entry: EntryRowData;
  groups: EntryGroup[];
  onShowEntry: InspectorProps['onShowEntry'];
}) {
  const groupName = groups.find((g) => g.id === entry.groupId)?.name ?? 'Ungrouped';
  const comment = entry.comment?.trim();
  return (
    <section className="ledger-insp-sec ledger-insp-entry" aria-label="Entry">
      <div className="ledger-insp-entry-text">
        <strong>{entry.name}</strong>
        <span>{groupName}{comment ? ` · ${comment}` : ''}</span>
      </div>
      <Button size="sm" variant="ghost" onClick={() => onShowEntry(entry)}>Entry details</Button>
    </section>
  );
}

function DetailsSection({ entry, groups, readOnly, onSave }: {
  entry: EntryRowData;
  groups: EntryGroup[];
  readOnly: boolean;
  onSave: InspectorProps['onSaveEntry'];
}) {
  const [name, setName] = useState(entry.name);
  const [comment, setComment] = useState(entry.comment ?? '');
  const [nameError, setNameError] = useState('');
  const editing = useRef<'name' | 'comment' | null>(null);
  // Last submitted values: Enter followed by blur must not send the same change twice.
  const submittedName = useRef(entry.name);
  const submittedComment = useRef(entry.comment ?? '');
  const nameId = useId();
  const groupId = useId();
  const commentId = useId();
  const groupName = groups.find((g) => g.id === entry.groupId)?.name ?? 'Ungrouped';

  useEffect(() => {
    submittedName.current = entry.name;
    if (editing.current !== 'name') setName(entry.name);
  }, [entry.name]);
  useEffect(() => {
    submittedComment.current = entry.comment ?? '';
    if (editing.current !== 'comment') setComment(entry.comment ?? '');
  }, [entry.comment]);

  if (readOnly) {
    return (
      <section className="ledger-insp-sec" aria-label="Entry details">
        <h3>Entry details</h3>
        <dl className="ledger-facts ledger-facts-list">
          <div><dt>Name</dt><dd>{entry.name}</dd></div>
          <div><dt>Group</dt><dd>{groupName}</dd></div>
          <div><dt>Comment</dt><dd>{entry.comment?.trim() || '—'}</dd></div>
        </dl>
      </section>
    );
  }

  const commitName = () => {
    const trimmed = name.trim().slice(0, 40);
    if (!trimmed) {
      setNameError('Enter a name.');
      return;
    }
    setNameError('');
    if (trimmed === submittedName.current) return;
    // After a failure the draft stays; Retry in the footer sends it again, a blur does not.
    submittedName.current = trimmed;
    void onSave(entry, { name: trimmed });
  };
  const commitComment = () => {
    if (comment === submittedComment.current) return;
    submittedComment.current = comment;
    void onSave(entry, { comment });
  };

  return (
    <section className="ledger-insp-sec" aria-label="Entry details">
      <h3>Entry details</h3>
      <div className="ledger-field">
        <label htmlFor={nameId}>Name</label>
        <input
          id={nameId}
          className="ui-input"
          maxLength={40}
          value={name}
          data-autofocus
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? `${nameId}-error` : undefined}
          onFocus={() => { editing.current = 'name'; }}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => {
            editing.current = null;
            commitName();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commitName();
            if (event.key === 'Escape' && (name !== entry.name || nameError)) {
              event.preventDefault();
              setName(entry.name);
              setNameError('');
            }
          }}
        />
        {nameError && <p id={`${nameId}-error`} className="ledger-field-error">{nameError}</p>}
      </div>
      <div className="ledger-field">
        <label htmlFor={groupId}>Group</label>
        <select
          id={groupId}
          className="ui-input"
          value={entry.groupId ?? ''}
          onChange={(event) => void onSave(entry, { groupId: event.target.value ? Number(event.target.value) : null })}
        >
          <option value="">Ungrouped</option>
          {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
        </select>
      </div>
      <div className="ledger-field">
        <label htmlFor={commentId}>Comment <span className="ledger-optional">optional</span></label>
        <textarea
          id={commentId}
          className="ui-input"
          rows={2}
          maxLength={240}
          value={comment}
          onFocus={() => { editing.current = 'comment'; }}
          onChange={(event) => setComment(event.target.value)}
          onBlur={() => {
            editing.current = null;
            commitComment();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && comment !== (entry.comment ?? '')) {
              event.preventDefault();
              setComment(entry.comment ?? '');
            }
          }}
        />
      </div>
    </section>
  );
}

function TagSection({ entry, month, tag, readOnly, onSave }: {
  entry: EntryRowData;
  month: string;
  tag: EntryTag | undefined;
  readOnly: boolean;
  onSave: InspectorProps['onSaveTag'];
}) {
  const savedColor: TagColor = tag?.color ?? 'none';
  const saved = tag?.text ?? '';
  // Shown at once on click; the saved tag arrives with the refreshed list.
  const [color, setColor] = useState<TagColor>(savedColor);
  const [note, setNote] = useState(saved);
  const focused = useRef(false);
  const noteId = useId();
  // Last submitted tag: Enter followed by blur must not send it twice.
  const submitted = useRef(`${savedColor}|${saved.trim()}`);

  useEffect(() => {
    submitted.current = `${savedColor}|${saved.trim()}`;
    setColor(savedColor);
  }, [savedColor, saved]);
  useEffect(() => {
    if (!focused.current) setNote(saved);
  }, [saved]);

  const save = (nextColor: TagColor, nextNote: string) => {
    const key = `${nextColor}|${nextNote.trim()}`;
    if (key === submitted.current) return;
    // No colour and no note removes the tag (F10).
    if (nextColor === 'none' && !nextNote.trim() && !tag) return;
    submitted.current = key;
    setColor(nextColor);
    void onSave(entry, month, nextColor, nextNote.trim());
  };

  const title = `Tag · ${monthName(month)}`;
  if (readOnly) {
    return (
      <section className="ledger-insp-sec" aria-label={title}>
        <h3>{title}</h3>
        <p className="ledger-insp-text">
          {tag ? `${TAG_COLORS.find((c) => c.id === color)?.label ?? color}${saved.trim() ? ` · ${saved.trim()}` : ''}` : 'No tag'}
        </p>
      </section>
    );
  }

  return (
    <section className="ledger-insp-sec" aria-label={title}>
      <h3>
        {title}
        {tag && <button type="button" className="ledger-link" onClick={() => { setNote(''); save('none', ''); }}>Clear tag</button>}
      </h3>
      <div className="ledger-swatches" role="group" aria-label="Tag colour">
        {TAG_COLORS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`ledger-swatch ${option.id === 'none' ? 'is-none' : ''}`}
            style={option.id === 'none' ? undefined : ({ '--sw': `var(--tag-${option.id})` } as CSSProperties)}
            aria-label={option.label}
            aria-pressed={color === option.id}
            onClick={() => save(option.id, note)}
          >
            {option.id === 'none' ? <Icon name="x" size="sm" /> : color === option.id ? <Icon name="check" size="sm" /> : null}
          </button>
        ))}
      </div>
      <div className="ledger-field">
        <label htmlFor={noteId}>Note</label>
        <input
          id={noteId}
          className="ui-input"
          maxLength={160}
          value={note}
          onFocus={() => { focused.current = true; }}
          onChange={(event) => setNote(event.target.value)}
          onBlur={() => {
            focused.current = false;
            save(color, note);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') save(color, note);
            if (event.key === 'Escape' && note !== saved) {
              event.preventDefault();
              setNote(saved);
            }
          }}
        />
      </div>
    </section>
  );
}

function EntryFacts({ entry, month, year, previousYearEntries }: {
  entry: EntryRowData;
  month: string | null;
  year: number;
  previousYearEntries: EntryRowData[] | null;
}) {
  const values = MONTHS.map((m) => monthValue(entry, m));
  const filled = values.filter((v): v is number => v !== null);
  const sum = filled.reduce((a, b) => a + b, 0);
  const average = filled.length ? sum / filled.length : 0;
  const max = Math.max(0, ...filled);
  const index = month ? monthIndex(month) : -1;
  const current = index >= 0 ? values[index] : null;
  const previous = index > 0 ? values[index - 1] : null;
  const change = current !== null && previous !== null && previous !== 0 ? ((current - previous) / Math.abs(previous)) * 100 : null;
  // D5: same name in the previous year (same type by query), exact match only.
  const lastYearEntry = previousYearEntries?.find((candidate) => candidate.name === entry.name) ?? null;
  const lastYear = lastYearEntry && month ? monthValue(lastYearEntry, month) : null;
  const percent = (value: number) => `${Math.abs(value).toFixed(0)}%`;

  return (
    <section className="ledger-insp-sec" aria-label={`Entry ${year}`}>
      <h3>Entry · {year}</h3>
      <div className="ledger-spark" role="img" aria-label={`Monthly values ${year}, average ${formatCurrency(average)}`}>
        {values.map((value, i) => (
          <span
            key={MONTHS[i]}
            className={i === index ? 'is-current' : undefined}
            style={{ height: `${value && max > 0 ? Math.max(2, (Math.max(0, value) / max) * 100) : 2}%` }}
            title={`${MONTHS[i]} ${formatMonthValue(value)}`}
          />
        ))}
        {max > 0 && <div className="ledger-spark-avg" style={{ bottom: `${(Math.max(0, average) / max) * 100}%` }} />}
      </div>
      <div className="ledger-spark-labels" aria-hidden="true">
        {MONTHS.map((m, i) => <span key={m} className={i === index ? 'is-current' : undefined}>{m[0]}</span>)}
      </div>
      <dl className="ledger-facts">
        <div><dt>Sum</dt><dd>{formatCurrency(sum)}</dd></div>
        <div><dt>Average</dt><dd>{formatCurrency(average)}</dd></div>
        {month && index > 0 && (
          <div>
            <dt>vs {MONTH_NAMES[index - 1]}</dt>
            <dd>
              {change === null ? '—' : `${change > 0 ? '▲' : change < 0 ? '▼' : ''} ${percent(change)}`.trim()}
              {previous !== null && <span className="ledger-facts-note"> ({formatCurrency(previous)})</span>}
            </dd>
          </div>
        )}
        {month && previousYearEntries && (
          <div>
            <dt>{monthName(month)} {year - 1}</dt>
            <dd>{lastYear === null ? '—' : formatCurrency(lastYear)}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}

function GroupSection({ group, entryCount, readOnly, onSave, onAddEntry, onArrangeGroup }: {
  group: EntryGroup;
  entryCount: number;
  readOnly: boolean;
  onSave: InspectorProps['onSaveGroup'];
  onAddEntry: InspectorProps['onAddEntry'];
  onArrangeGroup: InspectorProps['onArrangeGroup'];
}) {
  const [name, setName] = useState(group.name);
  const [nameError, setNameError] = useState('');
  const focused = useRef(false);
  const submitted = useRef(group.name);
  const nameId = useId();

  useEffect(() => {
    submitted.current = group.name;
    if (!focused.current) setName(group.name);
  }, [group.name]);

  const commit = () => {
    const trimmed = name.trim().slice(0, 40);
    if (!trimmed) {
      setNameError('Enter a name.');
      return;
    }
    setNameError('');
    if (trimmed === submitted.current) return;
    submitted.current = trimmed;
    void onSave(group, trimmed);
  };

  return (
    <section className="ledger-insp-sec" aria-label="Group details">
      <h3>Group details</h3>
      <p className="ledger-insp-text">{entryCount} {entryCount === 1 ? 'entry' : 'entries'} in this group.</p>
      {readOnly ? null : (
        <>
          <div className="ledger-field">
            <label htmlFor={nameId}>Name</label>
            <input
              id={nameId}
              className="ui-input"
              maxLength={40}
              value={name}
              data-autofocus
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? `${nameId}-error` : undefined}
              onFocus={() => { focused.current = true; }}
              onChange={(event) => setName(event.target.value)}
              onBlur={() => {
                focused.current = false;
                commit();
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') commit();
                if (event.key === 'Escape' && (name !== group.name || nameError)) {
                  event.preventDefault();
                  setName(group.name);
                  setNameError('');
                }
              }}
            />
            {nameError && <p id={`${nameId}-error`} className="ledger-field-error">{nameError}</p>}
          </div>
          <div className="ledger-insp-actions">
            <Button size="sm" icon="square-plus" onClick={() => onAddEntry(group.id)}>Add entry to group</Button>
            <Button size="sm" icon="arrows-sort" onClick={onArrangeGroup}>Arrange</Button>
          </div>
        </>
      )}
    </section>
  );
}

/**
 * Non-modal drawer for the selected cell, entry or group (plan Phase 4). It
 * overlays the right side of the grid without a scrim, so the grid stays usable
 * and a click on another cell only updates the panel.
 */
export function Inspector(props: InspectorProps) {
  const { selection, entry, group, groups, year, readOnly, saveState, focusRequest, onClose } = props;
  const asideRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const open = Boolean(selection && (selection.kind === 'group' ? group : entry));
  const selectionKey = !selection ? '' : selection.kind === 'cell' ? `c${selection.entryId}-${selection.month}` : selection.kind === 'entry' ? `e${selection.entryId}` : `g${selection.groupId}`;

  useEffect(() => {
    setConfirmRemove(false);
  }, [selectionKey]);

  useEffect(() => {
    if (!focusRequest) return;
    const frame = requestAnimationFrame(() => {
      const aside = asideRef.current;
      const target = aside?.querySelector<HTMLElement>('[data-autofocus]') ?? aside;
      target?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [focusRequest]);

  const month = selection?.kind === 'cell' ? selection.month : null;
  const groupName = entry ? groups.find((g) => g.id === entry.groupId)?.name ?? 'Ungrouped' : '';
  const crumb = selection?.kind === 'group' ? 'Group' : entry ? (month ? `${groupName} › ${entry.name}` : groupName) : '';
  const title = selection?.kind === 'group' ? group?.name ?? '' : month ? `${monthName(month)} ${year}` : entry?.name ?? '';
  const label = selection?.kind === 'group' ? `Group ${group?.name ?? ''}` : month && entry ? `${entry.name}, ${monthName(month)} ${year}` : `Entry ${entry?.name ?? ''}`;

  const remove = async () => {
    setRemoving(true);
    const ok = selection?.kind === 'group' && group ? await props.onRemoveGroup(group) : entry ? await props.onRemoveEntry(entry) : false;
    setRemoving(false);
    if (!ok) setConfirmRemove(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          key="inspector"
          ref={asideRef}
          className="ledger-insp"
          data-testid="inspector"
          aria-label={label}
          tabIndex={-1}
          // Opacity through a CSS variable keeps it in Motion's frame loop (see Dialog).
          style={{ opacity: 'var(--insp-opacity)' }}
          initial={{ '--insp-opacity': 0, x: 24 }}
          animate={{ '--insp-opacity': 1, x: 0 }}
          exit={{ '--insp-opacity': 0, x: 24 }}
          transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <header className="ledger-insp-head">
            <div>
              <div className="ledger-insp-crumb">{crumb}</div>
              <h2 id={titleId}>{title}</h2>
            </div>
            <IconButton icon="x" label="Close details" tooltip={false} onClick={onClose} />
          </header>
          <div className="ledger-insp-body">
            {readOnly && (
              <div className="ledger-insp-sec">
                <Callout title="Demo data is read only.">
                  <p>Values, details and tags can be viewed but not changed.</p>
                </Callout>
              </div>
            )}
            {selection?.kind === 'group' && group ? (
              <GroupSection
                key={group.id}
                group={group}
                entryCount={props.groupEntryCount}
                readOnly={readOnly}
                onSave={props.onSaveGroup}
                onAddEntry={props.onAddEntry}
                onArrangeGroup={props.onArrangeGroup}
              />
            ) : entry ? (
              <>
                {month && <ValueSection key={`value-${entry.id}-${month}`} entry={entry} month={month} year={year} readOnly={readOnly} onSave={props.onSaveMonth} />}
                {month
                  ? <EntryLine entry={entry} groups={groups} onShowEntry={props.onShowEntry} />
                  : <DetailsSection key={entry.id} entry={entry} groups={groups} readOnly={readOnly} onSave={props.onSaveEntry} />}
                {month && <TagSection key={`tag-${entry.id}-${month}`} entry={entry} month={month} tag={props.tags[month]} readOnly={readOnly} onSave={props.onSaveTag} />}
                <EntryFacts entry={entry} month={month} year={year} previousYearEntries={props.previousYearEntries} />
              </>
            ) : null}
          </div>
          {!readOnly && (
            <footer className="ledger-insp-foot">
              <SaveStatusLine state={saveState} />
              <span className="ledger-insp-spacer" />
              {month ? null : confirmRemove ? (
                <span className="ledger-insp-confirm">
                  <span>{selection?.kind === 'group' ? `Remove group? Its ${props.groupEntryCount === 1 ? 'entry moves' : 'entries move'} to Ungrouped.` : 'Remove this entry and its values?'}</span>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(false)} disabled={removing}>Cancel</Button>
                  <Button size="sm" variant="danger" onClick={() => void remove()} loading={removing}>Confirm</Button>
                </span>
              ) : (
                <Button size="sm" variant="ghost" icon="trash" className="ledger-insp-remove" onClick={() => setConfirmRemove(true)}>
                  {selection?.kind === 'group' ? 'Remove group' : 'Remove entry'}
                </Button>
              )}
            </footer>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
