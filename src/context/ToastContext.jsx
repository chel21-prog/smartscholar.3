import { createContext, useCallback, useContext, useRef, useState } from "react";

const ToastContext = createContext(null);

let idCounter = 0;

/**
 * App-wide toast notifications. Mounted once in main.jsx alongside
 * ThemeProvider/SessionProvider.
 *
 * Usage:
 *   const toast = useToast();
 *   toast.success("Scholarship saved.");
 *   toast.error("Failed to save remarks: " + error.message);
 *   toast.info("Loading the next batch…");
 *
 * Replaces native alert()/console.error-only error handling so failures
 * are actually visible to the person using the app, not just swallowed
 * or dumped to a devtools console nobody's looking at.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timeouts = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    clearTimeout(timeouts.current.get(id));
    timeouts.current.delete(id);
  }, []);

  const push = useCallback((message, variant = "info", duration = 4500) => {
    const id = ++idCounter;
    setToasts((prev) => [...prev, { id, message, variant }]);
    const timeoutId = setTimeout(() => dismiss(id), duration);
    timeouts.current.set(id, timeoutId);
    return id;
  }, [dismiss]);

  const api = {
    success: (msg, duration) => push(msg, "success", duration),
    error:   (msg, duration) => push(msg, "error", duration ?? 6500), // errors linger longer
    info:    (msg, duration) => push(msg, "info", duration),
    dismiss,
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

function ToastViewport({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: "var(--space-5)",
        right: "var(--space-5)",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        zIndex: 2000,
        maxWidth: "360px",
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => onDismiss(t.id)}
          style={{
            cursor: "pointer",
            padding: "12px 16px",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-lg)",
            color: "#fff",
            fontSize: "var(--text-sm)",
            lineHeight: 1.4,
            background:
              t.variant === "error"   ? "var(--danger-600)"  :
              t.variant === "success" ? "var(--success-600)" :
              "var(--navy-700)",
          }}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
