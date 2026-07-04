import { useId } from "react";
import styles from "./ui.module.css";

/**
 * Labeled text/email/password/number input with optional error message.
 * Always renders a real <label htmlFor> for accessibility, even when
 * the visual label is omitted.
 */
export function Field({
  label,
  hideLabel = false,
  error,
  hint,
  required = false,
  children,
  id: idProp,
}) {
  const generatedId = useId();
  const id = idProp || generatedId;

  return (
    <div className={styles.field}>
      {label && (
        <label
          htmlFor={id}
          className={hideLabel ? styles.srOnly : styles.fieldLabel}
        >
          {label}
          {required && <span className={styles.requiredMark}> *</span>}
        </label>
      )}
      {typeof children === "function" ? children({ id }) : children}
      {hint && !error && <span className={styles.fieldHint}>{hint}</span>}
      {error && (
        <span className={styles.fieldError} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

export function Input({ invalid = false, className = "", ...rest }) {
  const classes = [styles.input, invalid ? styles.inputInvalid : "", className]
    .filter(Boolean)
    .join(" ");
  return <input className={classes} {...rest} />;
}

export function Select({ invalid = false, className = "", children, ...rest }) {
  const classes = [styles.input, styles.select, invalid ? styles.inputInvalid : "", className]
    .filter(Boolean)
    .join(" ");
  return (
    <select className={classes} {...rest}>
      {children}
    </select>
  );
}

export function Textarea({ invalid = false, className = "", ...rest }) {
  const classes = [styles.input, styles.textarea, invalid ? styles.inputInvalid : "", className]
    .filter(Boolean)
    .join(" ");
  return <textarea className={classes} {...rest} />;
}
