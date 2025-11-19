type DividerProps = {
  className?: string;
};

export function Divider({ className }: DividerProps) {
  return <div className={`divider-soft ${className ?? ''}`.trim()} aria-hidden="true" />;
}
