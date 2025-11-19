import type { ReactNode } from 'react';

type SectionProps = {
  label?: string;
  title?: string;
  caption?: string;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
  bodyClassName?: string;
};

export function Section({
  label,
  title,
  caption,
  children,
  footer,
  className,
  bodyClassName,
}: SectionProps) {
  return (
    <section className={`section-block ${className ?? ''}`.trim()}>
      {(label || title || caption) && (
        <div className="section-meta">
          {label && <p className="section-label">{label}</p>}
          {title && <h2 className="section-title">{title}</h2>}
          {caption && <p className="section-caption">{caption}</p>}
        </div>
      )}
      {children && (
        <div className={bodyClassName ?? ''}>
          {children}
        </div>
      )}
      {footer}
    </section>
  );
}
