import { useState, type ReactNode } from "react";
import { Modal } from "./Modal";

interface Props {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

/** Modal-based replacement for ad hoc inline confirm buttons — used for every destructive action in the app. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  danger = true,
  onConfirm,
  onCancel,
}: Props) {
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title={title}
      onClose={() => {
        if (!busy) onCancel();
      }}
      footer={
        <>
          <button type="button" className="secondary" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className={danger ? "danger" : ""} disabled={busy} onClick={handleConfirm}>
            {busy ? "Working..." : confirmLabel}
          </button>
        </>
      }
    >
      {description}
    </Modal>
  );
}
