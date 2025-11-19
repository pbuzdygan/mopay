import { useState, useRef, useEffect } from "react";

type Props = {
  years: number[];
  value: number | null;
  onChange: (y: number) => void;
  className?: string;
};

export function YearDropdown({ years, value, onChange, className }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // zamykanie kliknięciem poza dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const label = value?.toString() ?? "Select year";

  return (
    <div className={`relative ${className ?? ''}`.trim()} ref={ref}>
      <button
        className="soft-button year-trigger type-body"
        onClick={() => setOpen((o) => !o)}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {label}
        <span className="opacity-60 text-sm">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div
          className="dropdown-panel year-panel absolute left-0 mt-2 z-50 animate-dropdown"
          role="listbox"
        >
          {years.map((y) => (
            <button
              key={y}
              className={`dropdown-item ${value === y ? "active" : ""}`}
              onClick={() => {
                onChange(y);
                setOpen(false);
              }}
              type="button"
            >
              {y}
            </button>
          ))}

          {years.length === 0 && (
            <div className="px-3 py-2 type-body-sm text-textSec">
              No years available
            </div>
          )}
        </div>
      )}
    </div>
  );
}
