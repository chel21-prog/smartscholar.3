import { useEffect, useRef } from "react";
import styles from "./ui.module.css";

/**
 * Accessible modal dialog.
 * - Closes on Escape and on backdrop click (unless closeOnBackdrop=false)
 * - Scrolls internally instead of clipping when content is tall
 * - Traps initial focus on the dialog so keyboard users land inside it
 *
 * size: "sm" | "md" | "lg"
 */
export default function Modal({
  open,
  onClose,
  title,
  size = "md",
  closeOnBackdrop = true,
  children,
  footer,
}) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    const handleKey = (e) => {
      if (e.key === "Escape" && onClose) onClose();
    };
    window.addEventListener("keydown", handleKey);

    // Move focus into the dialog for keyboard/screen-reader users.
    const prevActive = document.activeElement;
    dialogRef.current?.focus();

    // Lock background scroll while the modal is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prevOverflow;
      if (prevActive instanceof HTMLElement) prevActive.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={styles.overlay}
      onMouseDown={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget && onClose) {
          onClose();
        }
      }}
    >
      <div
        className={[styles.modal, styles[`modal-${size}`]].join(" ")}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={dialogRef}
        tabIndex={-1}
      >
        {title && (
          <div className={styles.modalHeader}>
            <h2 className={styles.modalTitle}>{title}</h2>
            {onClose && (
              <button
                type="button"
                className={styles.modalClose}
                onClick={onClose}
                aria-label="Close dialog"
              >
                ✕
              </button>
            )}
          </div>
        )}

        <div className={styles.modalBody}>{children}</div>

        {footer && <div className={styles.modalFooter}>{footer}</div>}
      </div>
    </div>
  );
}
