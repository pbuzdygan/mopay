import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Icon } from './Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  block?: boolean;
  loading?: boolean;
  icon?: string;
  children?: ReactNode;
};

const classes = (variant: ButtonVariant, size: 'md' | 'sm', extra: Array<string | false | undefined>) =>
  ['ui-button', variant !== 'secondary' && `ui-button-${variant}`, size === 'sm' && 'ui-button-sm', ...extra]
    .filter(Boolean)
    .join(' ');

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', block = false, loading = false, icon, className, children, disabled, type = 'button', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={classes(variant, size, [block && 'ui-button-block', className])}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <span className="ui-spinner" aria-hidden="true" /> : icon && <Icon name={icon} size={size === 'sm' ? 'sm' : 'md'} />}
      {children}
    </button>
  );
});

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  icon: string;
  label: string;
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  tooltip?: boolean;
};

// Icon-only button: the label is the accessible name and the hover/focus tooltip.
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, variant = 'ghost', size = 'md', tooltip = true, className, type = 'button', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      data-tip={tooltip ? label : undefined}
      className={classes(variant, size, ['ui-button-icon', tooltip && 'ui-tip', className])}
      {...props}
    >
      <Icon name={icon} size={size === 'sm' ? 'sm' : 'md'} />
    </button>
  );
});
