import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { IconButton } from './Button';

type DialogProps = {
  open: boolean;
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
  onClose: () => void;
  /** False for dialogs that must be completed (first-run year, key mismatch). */
  dismissible?: boolean;
  size?: 'sm' | 'md' | 'lg';
  /** Below 960 px: centred, at the top (forms with a keyboard) or as a bottom sheet. */
  mobileAlign?: 'center' | 'top' | 'bottom';
};

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Open dialogs in opening order; only the top one handles Escape and Tab.
const stack: symbol[] = [];

export function Dialog({
  open,
  title,
  description,
  icon,
  children,
  onClose,
  dismissible = true,
  size = 'md',
  mobileAlign = 'center',
}: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // Capture the opener while rendering the opening frame: autoFocus fields in
  // the content take focus during commit, before any effect could read it.
  const openerRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);
  if (open && !wasOpenRef.current) {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
  wasOpenRef.current = open;

  useEffect(() => {
    if (!open) return;
    const token = Symbol('dialog');
    stack.push(token);
    const opener = openerRef.current;
    // Move focus inside unless the content already focused a field (autofocus).
    const frame = requestAnimationFrame(() => {
      const card = cardRef.current;
      if (card && !card.contains(document.activeElement)) card.focus({ preventScroll: true });
    });
    const onKeyDown = (event: KeyboardEvent) => {
      const card = cardRef.current;
      if (stack[stack.length - 1] !== token || !card) return;
      if (event.key === 'Escape' && dismissible && !event.defaultPrevented) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = [...card.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((node) => node.getClientRects().length);
      if (!items.length) {
        event.preventDefault();
        card.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === card || !card.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !card.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      stack.splice(stack.indexOf(token), 1);
      // Return focus to the control that opened the dialog when it still exists.
      const active = document.activeElement;
      if (opener?.isConnected && (!active || active === document.body || cardRef.current?.contains(active))) {
        opener.focus({ preventScroll: true });
      }
    };
  }, [open, dismissible]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={`ui-dialog-backdrop ${mobileAlign === 'center' ? '' : `ui-dialog-backdrop-${mobileAlign}`}`}
          data-testid="dialog-backdrop"
          // Animate a CSS variable so opacity stays in Motion's frame loop.
          // Native opacity animation completion can briefly restore opacity: 0.
          style={{ opacity: 'var(--modal-opacity)' }}
          initial={{ '--modal-opacity': 0 }}
          animate={{ '--modal-opacity': 1 }}
          exit={{ '--modal-opacity': 0 }}
          transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
          onMouseDown={() => {
            if (dismissible) onClose();
          }}
        >
          <motion.div
            ref={cardRef}
            className={`ui-dialog ${size === 'md' ? '' : `ui-dialog-${size}`}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            tabIndex={-1}
            onMouseDown={(event) => event.stopPropagation()}
            style={{ opacity: 'var(--modal-card-opacity)' }}
            initial={{ '--modal-card-opacity': 0, y: 14, scale: 0.96 }}
            animate={{ '--modal-card-opacity': 1, y: 0, scale: 1 }}
            exit={{ '--modal-card-opacity': 0, y: 10, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <header className="ui-dialog-head">
              {icon && <div className="ui-dialog-icon" aria-hidden="true">{icon}</div>}
              <div className="ui-dialog-titles">
                <h2 id={titleId} className="ui-dialog-title">{title}</h2>
                {description && <p id={descriptionId} className="ui-dialog-description">{description}</p>}
              </div>
              {dismissible && <IconButton icon="x" label="Close dialog" tooltip={false} onClick={onClose} />}
            </header>
            <div className="ui-dialog-body">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
