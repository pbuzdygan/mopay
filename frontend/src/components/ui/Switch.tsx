// On/off control (switch role). Name it with a visible label via labelledBy.
export function Switch({ checked, onChange, labelledBy, label, disabled }: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  labelledBy?: string;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : label}
      className="ui-switch"
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="ui-switch-knob" aria-hidden="true" />
    </button>
  );
}
