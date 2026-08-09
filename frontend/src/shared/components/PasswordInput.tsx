import { useState, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12c2.4-5 6.4-8 10-8s7.6 3 10 8c-2.4 5-6.4 8-10 8s-7.6-3-10-8Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3l18 18" />
      <path d="M10.6 5.2A10.6 10.6 0 0 1 12 5c3.6 0 7.6 3 10 8-.8 1.7-1.8 3.1-3 4.3M6.2 6.2C4.1 7.6 2.4 9.6 1.5 12c2.4 5 6.4 8 10 8 1.4 0 2.7-.4 4-1.1" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}

/** A password `<input>` with a trailing eye toggle to reveal/hide the value, instead of it staying masked with no way to check it. */
export function PasswordInput(inputProps: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-input">
      <input {...inputProps} type={visible ? "text" : "password"} />
      <button
        type="button"
        className="password-toggle"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}
