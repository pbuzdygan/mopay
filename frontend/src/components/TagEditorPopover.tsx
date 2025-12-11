import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export type TagColor = 'grey' | 'green' | 'orange' | 'red';

const COLORS: Array<{ id: TagColor; label: string; className: string }> = [
  { id: 'grey', label: 'None', className: 'tag-chip grey' },
  { id: 'green', label: 'Green', className: 'tag-chip green' },
  { id: 'orange', label: 'Orange', className: 'tag-chip orange' },
  { id: 'red', label: 'Red', className: 'tag-chip red' },
];

type Props = {
  month: string;
  color: TagColor;
  text: string;
  anchor: DOMRect;
  saving: boolean;
  onChange: (patch: Partial<{ color: TagColor; text: string }>) => void;
  onSave: () => void;
  onClear: () => void;
  onClose: () => void;
};

export function TagEditorPopover({ month, color, text, anchor, saving, onChange, onSave, onClear, onClose }: Props) {
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onClose();
    };
    const onClick = (ev: MouseEvent) => {
      if (!(ev.target as HTMLElement)?.closest('.tag-editor-popover')) {
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [onClose]);

  const viewportHeight = document.documentElement.clientHeight;
  const viewportWidth = document.documentElement.clientWidth;
  const estimatedHeight = 260;
  let top = anchor.bottom + window.scrollY + 8;
  if (top + estimatedHeight - window.scrollY > viewportHeight) {
    top = anchor.top + window.scrollY - estimatedHeight - 8;
  }
  if (top < window.scrollY + 12) {
    top = window.scrollY + 12;
  }
  let left = anchor.left + window.scrollX;
  left = Math.min(left, window.scrollX + viewportWidth - 300);
  left = Math.max(left, window.scrollX + 12);

  return createPortal(
    <div
      className="tag-editor-popover"
      style={{ top: `${top}px`, left: `${left}px` }}
    >
      <div className="tag-editor-header">
        <span className="tag-editor-title">Tag {month}</span>
      </div>
      <div className="tag-editor-section">
        <span className="tag-editor-label">Color</span>
        <div className="tag-chip-row">
          {COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`${c.className} ${color === c.id ? 'selected' : ''}`}
              onClick={() => onChange({ color: c.id })}
            >
              <span className="tag-chip-swatch" />
              <span className="tag-chip-label">{c.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="tag-editor-section">
        <span className="tag-editor-label">Note</span>
        <input
          type="text"
          className="tag-editor-input"
          value={text}
          maxLength={160}
          onChange={(ev) => onChange({ text: ev.target.value })}
        />
      </div>
      <div className="tag-editor-actions">
        <button type="button" className="soft-button ghost" onClick={onClear} disabled={saving}>
          Clear
        </button>
        <div className="flex gap-2">
          <button type="button" className="soft-button ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="btn px-4" onClick={onSave} disabled={saving}>
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
