import { useState } from "react";
import Modal from "./Modal";
import Button from "./Button";

/**
 * Shared confirm dialog. Renders on top of the existing accessible Modal
 * (Escape key, focus trap, backdrop click already handled there).
 *
 * onConfirm may be async — the confirm button shows a loading spinner and
 * disables both buttons for the duration, which also closes the multi-tap
 * race we hit earlier (a bespoke confirm popup without this guard let a
 * fast double/triple-tap fire the same save handler more than once).
 *
 * Prefer using this via the `useConfirm()` hook rather than directly.
 */
export default function ConfirmDialog({
  open,
  title = "Please confirm",
  message,
  confirmLabel = "Yes",
  cancelLabel = "No",
  variant = "primary", // "danger" for destructive actions (delete, cancel application, etc.)
  onConfirm,
  onCancel,
}) {
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onCancel}
      closeOnBackdrop={!busy}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={handleConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p>{message}</p>
    </Modal>
  );
}
