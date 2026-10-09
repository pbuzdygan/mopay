import { useState } from 'react';
import { Button, Dialog, Icon } from '../ui';

type EditMode = 'order' | 'remove' | 'tag';

const MODE_TEXT: Record<EditMode, { icon: string; title: string; text: string }> = {
  order: {
    icon: 'arrows-sort',
    title: 'Arrange mode',
    text: 'Drag entries within their group, or drag groups to change their order. To move an entry to another group, change its group in the entry details.',
  },
  remove: {
    icon: 'trash',
    title: 'Remove mode',
    text: 'Select entries or whole groups. Nothing is removed until you confirm.',
  },
  tag: {
    icon: 'tag',
    title: 'Tags mode',
    text: 'Select a month to set its tag colour and note.',
  },
};

/** Explains the active edit mode above the grid; Done/Close in the toolbar ends it. */
export function ModeBanner({ mode }: { mode: EditMode }) {
  const { icon, title, text } = MODE_TEXT[mode];
  return (
    <div className={`ledger-mode-bar ${mode === 'remove' ? 'is-danger' : ''}`} role="status">
      <Icon name={icon} />
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** "1 group and 2 entries", used for the selection count and the action labels. */
export function describeSelection(groupCount: number, entryCount: number) {
  const parts = [];
  if (groupCount) parts.push(plural(groupCount, 'group', 'groups'));
  if (entryCount) parts.push(plural(entryCount, 'entry', 'entries'));
  return parts.join(' and ');
}

export function BulkRemoveBar({
  entryNames,
  groups,
  busy,
  error,
  onClear,
  onConfirm,
}: {
  entryNames: string[];
  /** entryCount: entries that stay (not selected themselves) and become ungrouped. */
  groups: Array<{ name: string; entryCount: number }>;
  busy: boolean;
  error: string | null;
  onClear: () => void;
  onConfirm: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const selection = describeSelection(groups.length, entryNames.length);
  const movedEntries = groups.reduce((sum, group) => sum + group.entryCount, 0);

  return (
    <>
      <div className="ledger-bulk-bar">
        <span className="ledger-bulk-count">{selection ? `${selection} selected` : 'Nothing selected'}</span>
        {error && <span className="ledger-bulk-error" role="alert"><Icon name="alert-triangle" size="sm" />{error}</span>}
        <Button variant="ghost" size="sm" disabled={!selection || busy} onClick={onClear}>Clear selection</Button>
        <Button
          variant="danger"
          size="sm"
          icon="trash"
          disabled={!selection}
          loading={busy}
          onClick={() => setConfirming(true)}
        >
          {selection ? `Remove ${selection}` : 'Remove selected'}
        </Button>
      </div>
      <Dialog
        open={confirming}
        title={`Remove ${selection}?`}
        description="This cannot be undone."
        size="sm"
        onClose={() => setConfirming(false)}
      >
        <div className="ledger-confirm-list">
          {entryNames.length > 0 && (
            <p><strong>{entryNames.length === 1 ? 'Entry:' : 'Entries:'}</strong> {entryNames.join(', ')}. Their values and tags are removed.</p>
          )}
          {groups.length > 0 && (
            <p>
              <strong>{groups.length === 1 ? 'Group:' : 'Groups:'}</strong> {groups.map((group) => group.name).join(', ')}.{' '}
              {movedEntries > 0
                ? `${plural(movedEntries, 'entry', 'entries')} in ${groups.length === 1 ? 'this group' : 'these groups'} ${movedEntries === 1 ? 'stays and moves' : 'stay and move'} to Ungrouped.`
                : 'No entries are affected.'}
            </p>
          )}
        </div>
        <div className="ui-dialog-actions">
          <Button variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
          <Button
            variant="danger"
            icon="trash"
            onClick={() => {
              setConfirming(false);
              onConfirm();
            }}
          >
            Remove
          </Button>
        </div>
      </Dialog>
    </>
  );
}
