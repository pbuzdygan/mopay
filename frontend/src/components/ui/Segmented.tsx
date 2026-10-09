import type { ReactNode } from 'react';
import { Icon } from './Icon';

type Option<T extends string> = { value: T; label: string; icon?: string; content?: ReactNode };

// A small group of toggle buttons where exactly one is pressed.
export function Segmented<T extends string>({ label, value, options, onChange, iconOnly = false, className }: {
  label: string;
  value: T;
  options: Array<Option<T>>;
  onChange: (value: T) => void;
  iconOnly?: boolean;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={['ui-segmented', className ?? ''].filter(Boolean).join(' ')}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          aria-label={iconOnly ? option.label : undefined}
          title={iconOnly ? option.label : undefined}
          onClick={() => option.value !== value && onChange(option.value)}
        >
          {option.icon && <Icon name={option.icon} size="sm" />}
          {!iconOnly && (option.content ?? option.label)}
        </button>
      ))}
    </div>
  );
}
