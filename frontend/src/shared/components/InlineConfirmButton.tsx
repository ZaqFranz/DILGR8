import { useState } from "react";

interface Props {
  label?: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
  disabled?: boolean;
}

export function InlineConfirmButton({ label = "Delete", confirmLabel = "Confirm?", onConfirm, disabled }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!confirming) {
    return (
      <button type="button" className="danger" disabled={disabled} onClick={() => setConfirming(true)}>
        {label}
      </button>
    );
  }

  async function handleConfirm() {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <span className="inline-confirm">
      <span>{confirmLabel}</span>
      <button type="button" className="danger" disabled={busy} onClick={handleConfirm}>
        {busy ? "..." : "Yes"}
      </button>
      <button type="button" className="secondary" disabled={busy} onClick={() => setConfirming(false)}>
        No
      </button>
    </span>
  );
}
