import styles from "./ui.module.css";

/**
 * Shared button primitive.
 *
 * variant: "primary" | "secondary" | "ghost" | "danger" | "success"
 * size: "sm" | "md"
 */
export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  type = "button",
  className = "",
  children,
  ...rest
}) {
  const classes = [
    styles.btn,
    styles[`btn-${variant}`],
    styles[`btn-${size}`],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <span className={styles.spinner} aria-hidden="true" />}
      <span className={styles.btnLabel}>{children}</span>
    </button>
  );
}
