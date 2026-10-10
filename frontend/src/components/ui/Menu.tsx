import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button, type ButtonVariant } from './Button';
import { Icon } from './Icon';

export type MenuItem = {
  label: string;
  icon?: string;
  onSelect: () => void;
  disabled?: boolean;
  danger?: boolean;
  separatorBefore?: boolean;
};

type MenuProps = {
  label: ReactNode;
  /** Accessible name when the visible label is an icon or differs from the purpose. */
  ariaLabel?: string;
  icon?: string;
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  iconOnly?: boolean;
  caret?: boolean;
  align?: 'start' | 'end';
  items: MenuItem[];
  className?: string;
};

// Menu button pattern: arrows/Home/End move between items, Enter/Space select,
// Escape and Tab close; focus returns to the trigger before an item runs.
export function Menu({ label, ariaLabel, icon, variant = 'secondary', size = 'md', iconOnly = false, caret = true, align = 'end', items, className }: MenuProps) {
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const enabled = items.map((item, index) => (item.disabled ? -1 : index)).filter((index) => index >= 0);

  useEffect(() => {
    if (!open) return;
    itemRefs.current[focusIndex]?.focus();
  }, [open, focusIndex]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const openAt = (position: 'first' | 'last') => {
    if (!enabled.length) return;
    setFocusIndex(position === 'first' ? enabled[0] : enabled[enabled.length - 1]);
    setOpen(true);
  };

  const close = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };

  const move = (step: 1 | -1) => {
    const current = enabled.indexOf(focusIndex);
    setFocusIndex(enabled[(current + step + enabled.length) % enabled.length]);
  };

  const select = (item: MenuItem) => {
    if (item.disabled) return;
    close();
    item.onSelect();
  };

  return (
    <div ref={rootRef} className={['ui-menu-root', className ?? ''].filter(Boolean).join(' ')}>
      <Button
        ref={triggerRef}
        variant={variant}
        size={size}
        icon={icon}
        className={iconOnly ? 'ui-button-icon' : undefined}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? close(false) : openAt('first'))}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') { event.preventDefault(); openAt('first'); }
          if (event.key === 'ArrowUp') { event.preventDefault(); openAt('last'); }
        }}
      >
        {!iconOnly && label}
        {caret && !iconOnly && <Icon name="chevron-down" size="sm" />}
      </Button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={ariaLabel ?? (typeof label === 'string' ? label : undefined)}
          className={`ui-menu ${align === 'start' ? 'ui-menu-start' : ''}`}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') { event.preventDefault(); move(1); }
            else if (event.key === 'ArrowUp') { event.preventDefault(); move(-1); }
            else if (event.key === 'Home') { event.preventDefault(); setFocusIndex(enabled[0]); }
            else if (event.key === 'End') { event.preventDefault(); setFocusIndex(enabled[enabled.length - 1]); }
            else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
            else if (event.key === 'Tab') close(false);
          }}
        >
          {items.map((item, index) => (
            <div key={item.label} role="none">
              {item.separatorBefore && <hr className="ui-menu-separator" />}
              <button
                ref={(node) => { itemRefs.current[index] = node; }}
                type="button"
                role="menuitem"
                tabIndex={index === focusIndex ? 0 : -1}
                disabled={item.disabled}
                className={`ui-menu-item ${item.danger ? 'is-danger' : ''}`}
                onClick={() => select(item)}
              >
                {item.icon && <Icon name={item.icon} size="sm" />}
                <span>{item.label}</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
