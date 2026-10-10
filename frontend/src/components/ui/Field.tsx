import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

type FieldOwnProps = {
  label: string;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
};

// Label, hint and error are wired to the control through id/aria-describedby.
function useFieldIds(id: string | undefined, hint: ReactNode, error: ReactNode) {
  const generated = useId();
  const controlId = id ?? generated;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  return { controlId, hintId, errorId, describedBy: [errorId, hintId].filter(Boolean).join(' ') || undefined };
}

function FieldFrame({ label, hint, error, className, controlId, hintId, errorId, children }: FieldOwnProps & {
  controlId: string;
  hintId?: string;
  errorId?: string;
  children: ReactNode;
}) {
  return (
    <div className={['ui-field', className ?? ''].filter(Boolean).join(' ')}>
      <label className="ui-field-label" htmlFor={controlId}>{label}</label>
      {children}
      {error && <p id={errorId} className="ui-field-error" role="alert">{error}</p>}
      {hint && <p id={hintId} className="ui-field-hint">{hint}</p>}
    </div>
  );
}

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> & FieldOwnProps & { inputClassName?: string };

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, className, inputClassName, id, ...props },
  ref
) {
  const ids = useFieldIds(id, hint, error);
  return (
    <FieldFrame label={label} hint={hint} error={error} className={className} {...ids}>
      <input
        ref={ref}
        id={ids.controlId}
        className={['ui-input', inputClassName ?? ''].filter(Boolean).join(' ')}
        aria-invalid={error ? true : undefined}
        aria-describedby={ids.describedBy}
        {...props}
      />
    </FieldFrame>
  );
});

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className'> & FieldOwnProps;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, className, id, children, ...props },
  ref
) {
  const ids = useFieldIds(id, hint, error);
  return (
    <FieldFrame label={label} hint={hint} error={error} className={className} {...ids}>
      <select ref={ref} id={ids.controlId} className="ui-input" aria-invalid={error ? true : undefined} aria-describedby={ids.describedBy} {...props}>
        {children}
      </select>
    </FieldFrame>
  );
});

type TextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> & FieldOwnProps;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className, id, ...props },
  ref
) {
  const ids = useFieldIds(id, hint, error);
  return (
    <FieldFrame label={label} hint={hint} error={error} className={className} {...ids}>
      <textarea ref={ref} id={ids.controlId} className="ui-input" aria-invalid={error ? true : undefined} aria-describedby={ids.describedBy} {...props} />
    </FieldFrame>
  );
});
