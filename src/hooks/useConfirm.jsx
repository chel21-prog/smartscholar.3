import { useCallback, useState } from "react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

/**
 * Usage:
 *   const { askConfirm, confirmDialog } = useConfirm();
 *
 *   askConfirm("Save changes to this scholarship?", doUpdateScholarship);
 *   // or with options:
 *   askConfirm("Cancel this application? This can't be undone.", doCancel, {
 *     variant: "danger",
 *     confirmLabel: "Cancel application",
 *   });
 *
 *   return (
 *     <>
 *       ...rest of the component
 *       {confirmDialog}
 *     </>
 *   );
 *
 * `action` may be sync or async. While it runs, the dialog's confirm button
 * shows a loading state and both buttons are disabled, so a fast repeated
 * tap can't fire the action twice.
 */
export function useConfirm() {
  const [dialog, setDialog] = useState(null); // { message, action, title?, variant?, confirmLabel?, cancelLabel? }

  const askConfirm = useCallback((message, action, opts = {}) => {
    setDialog({ message, action, ...opts });
  }, []);

  const handleConfirm = async () => {
    await dialog?.action?.();
    setDialog(null);
  };

  const handleCancel = () => setDialog(null);

  const confirmDialog = dialog ? (
    <ConfirmDialog
      open
      title={dialog.title}
      message={dialog.message}
      confirmLabel={dialog.confirmLabel}
      cancelLabel={dialog.cancelLabel}
      variant={dialog.variant}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  ) : null;

  return { askConfirm, confirmDialog };
}
