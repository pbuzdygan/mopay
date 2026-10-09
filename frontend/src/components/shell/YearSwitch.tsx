import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from '../ui';

// Working-year picker (listbox popup). Arrows move, Enter/Space choose,
// Escape closes and returns focus to the trigger.
export function YearSwitch({ years, value, onChange }: { years: number[]; value: number | null; onChange: (year: number) => void }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const sorted = [...years].sort((a, b) => b - a);

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
          className="year-switch-list"
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
