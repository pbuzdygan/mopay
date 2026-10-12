import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from '../ui';

const LIST_MAX_HEIGHT = 280;
const LIST_GAP = 4;
const EDGE_MARGIN = 8;

// Visible area for the popup: the viewport narrowed by every scrolling or
// clipping ancestor (for example the More sheet body below 960 px).
function visibleBounds(node: HTMLElement) {
  let top = 0;
  let bottom = window.visualViewport?.height ?? window.innerHeight;
  for (let el = node.parentElement; el; el = el.parentElement) {
    if (getComputedStyle(el).overflowY === 'visible') continue;
    const rect = el.getBoundingClientRect();
    top = Math.max(top, rect.top);
    bottom = Math.min(bottom, rect.bottom);
  }
  return { top, bottom };
}

// Working-year picker (listbox popup). Arrows move, Enter/Space choose,
// Escape closes and returns focus to the trigger. The list is limited to the
// visible space of its container and scrolls on its own, so every year can be
// reached without scrolling the surrounding page or sheet.
export function YearSwitch({ years, value, onChange }: { years: number[]; value: number | null; onChange: (year: number) => void }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [fit, setFit] = useState<{ up: boolean; maxHeight: number }>({ up: false, maxHeight: LIST_MAX_HEIGHT });
  const sorted = [...years].sort((a, b) => b - a);

  // Measured before paint so the list never shows at a height that overflows.
  useLayoutEffect(() => {
    if (!open) return;
    const fitList = () => {
      const trigger = triggerRef.current;
      const list = listRef.current;
      if (!trigger || !list) return;
      const rect = trigger.getBoundingClientRect();
      const bounds = visibleBounds(trigger);
      const below = bounds.bottom - rect.bottom - LIST_GAP - EDGE_MARGIN;
      const above = rect.top - bounds.top - LIST_GAP - EDGE_MARGIN;
      const natural = Math.min(LIST_MAX_HEIGHT, list.scrollHeight);
      const up = below < natural && above > below;
      setFit({ up, maxHeight: Math.max(0, Math.min(natural, up ? above : below)) });
    };
    fitList();
    window.addEventListener('resize', fitList);
    return () => window.removeEventListener('resize', fitList);
  }, [open]);

  useEffect(() => {
    if (open) optionRefs.current[active]?.focus();
  }, [open, active]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const show = () => {
    if (!sorted.length) return;
    setActive(Math.max(0, sorted.indexOf(value ?? -1)));
    setOpen(true);
  };

  const choose = (year: number) => {
    setOpen(false);
    triggerRef.current?.focus();
    if (year !== value) onChange(year);
  };

  return (
    <div ref={rootRef} className="year-switch-root">
      <button
        ref={triggerRef}
        type="button"
        className="year-switch"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={value ? `Working year ${value}` : 'Select working year'}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            show();
          }
        }}
      >
        <span>
          <small>Working year</small>
          <strong>{value ?? '—'}</strong>
        </span>
        <Icon name="chevron-down" size="sm" />
      </button>
      {open && (
        <div
          id={listId}
          role="listbox"
          aria-label="Available years"
          ref={listRef}
          className={`year-switch-list${fit.up ? ' is-up' : ''}`}
          style={{ maxHeight: fit.maxHeight }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') { event.preventDefault(); setActive((i) => Math.min(sorted.length - 1, i + 1)); }
            else if (event.key === 'ArrowUp') { event.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
            else if (event.key === 'Home') { event.preventDefault(); setActive(0); }
            else if (event.key === 'End') { event.preventDefault(); setActive(sorted.length - 1); }
            else if (event.key === 'Escape') { event.preventDefault(); setOpen(false); triggerRef.current?.focus(); }
            else if (event.key === 'Tab') setOpen(false);
          }}
        >
          {sorted.map((year, index) => (
            <button
              key={year}
              ref={(node) => { optionRefs.current[index] = node; }}
              type="button"
              role="option"
              aria-selected={year === value}
              tabIndex={index === active ? 0 : -1}
              className="year-switch-option"
              onClick={() => choose(year)}
            >
              {year}
              {year === value && <Icon name="check" size="sm" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
