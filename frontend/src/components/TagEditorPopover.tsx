import { useEffect, useLayoutEffect, useState } from 'react';
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
  const [position, setPosition] = useState(() => {
    const viewportHeight = window.visualViewport?.height ?? document.documentElement.clientHeight;
    const viewportWidth = window.visualViewport?.width ?? document.documentElement.clientWidth;
    const isMobile = viewportWidth <= 640;
    const estimatedHeight = 260;
    if (isMobile) {
      const offsetTop = window.visualViewport?.offsetTop ?? 0;
      const availableHeight = viewportHeight;
      const top = offsetTop + Math.max(12, (availableHeight - estimatedHeight) / 2);
      const left = Math.max(12, (viewportWidth - 280) / 2);
      return { top, left, mode: 'fixed' as const };
    }
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
    return { top, left, mode: 'absolute' as const };
  });

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

  useLayoutEffect(() => {
    const computePosition = () => {
      const viewportHeight = window.visualViewport?.height ?? document.documentElement.clientHeight;
      const viewportWidth = window.visualViewport?.width ?? document.documentElement.clientWidth;
      const isMobile = viewportWidth <= 640;
      const estimatedHeight = 260;
      if (isMobile) {
        const offsetTop = window.visualViewport?.offsetTop ?? 0;
        const keyboardLikelyOpen = viewportHeight < document.documentElement.clientHeight - 80;
        const top = keyboardLikelyOpen
          ? offsetTop + 12
          : offsetTop + Math.max(12, (viewportHeight - estimatedHeight) / 2);
        const left = Math.max(12, (viewportWidth - 280) / 2);
        setPosition({ top, left, mode: 'fixed' });
        return;
      }
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
      setPosition({ top, left, mode: 'absolute' });
    };
    computePosition();
    const viewport = window.visualViewport;
    window.addEventListener('resize', computePosition);
    viewport?.addEventListener('resize', computePosition);
    return () => {
      window.removeEventListener('resize', computePosition);
      viewport?.removeEventListener('resize', computePosition);
    };
  }, [anchor]);

  return createPortal(
    <div
      className="tag-editor-popover"
      style={{ top: `${position.top}px`, left: `${position.left}px`, position: position.mode }}
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
          onKeyDown={(ev) => {
            if (ev.key === 'Enter') {
              ev.preventDefault();
              onSave();
            }
          }}
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
