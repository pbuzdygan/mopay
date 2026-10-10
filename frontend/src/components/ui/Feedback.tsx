import type { ReactNode } from 'react';
import { Icon } from './Icon';

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`ui-badge ${tone === 'neutral' ? '' : `ui-badge-${tone}`}`.trim()}>{children}</span>;
}

type CalloutTone = 'info' | 'success' | 'warning' | 'danger';
const calloutIcons: Record<CalloutTone, string> = {
  info: 'info-circle',
  success: 'check',
  warning: 'alert-triangle',
  danger: 'alert-triangle',
};

// Inline message. Pass role="alert" for errors that appear after a user action.
export function Callout({ tone = 'info', title, children, role }: {
  tone?: CalloutTone;
  title?: ReactNode;
  children?: ReactNode;
  role?: 'status' | 'alert';
}) {
  return (
    <div className={`ui-callout ${tone === 'info' ? '' : `ui-callout-${tone}`}`.trim()} role={role}>
      <Icon name={calloutIcons[tone]} />
      <div>
        {title && <strong className="ui-callout-title">{title}</strong>}
        {children}
      </div>
    </div>
  );
}
