import type { CSSProperties } from 'react';

type IconProps = {
  name: string;
  size?: 'md' | 'sm';
  className?: string;
};

// Tabler outline icons from /public/icons/ui, tinted with currentColor via CSS mask.
export function Icon({ name, size = 'md', className }: IconProps) {
  return (
    <span
      aria-hidden="true"
      className={['ui-icon', size === 'sm' ? 'ui-icon-sm' : '', className ?? ''].filter(Boolean).join(' ')}
      style={{ '--icon': `url("/icons/ui/${name}.svg")` } as CSSProperties}
    />
  );
}
