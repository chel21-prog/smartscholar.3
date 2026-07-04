import styles from "./ui.module.css";

export function Card({ className = "", children, ...rest }) {
  return (
    <div className={[styles.card, className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, className = "" }) {
  return (
    <div className={[styles.cardHeader, className].filter(Boolean).join(" ")}>
      <div>
        <h2 className={styles.cardTitle}>{title}</h2>
        {subtitle && <p className={styles.cardSubtitle}>{subtitle}</p>}
      </div>
      {action && <div className={styles.cardAction}>{action}</div>}
    </div>
  );
}

/**
 * Status badge. `tone` maps to a semantic color, falling back to a
 * deterministic lookup from common status strings so callers can just
 * pass the raw status value most of the time.
 */
const STATUS_TONE_MAP = {
  pending: "warning",
  "in review": "warning",
  submitted: "info",
  approved: "success",
  compliant: "success",
  active: "success",
  enrolled: "success",
  rejected: "danger",
  denied: "danger",
  "non-compliant": "danger",
  cancelled: "neutral",
  canceled: "neutral",
  missing: "danger",
};

export function Badge({ tone, status, children, className = "" }) {
  const resolvedTone =
    tone || STATUS_TONE_MAP[(status || "").toLowerCase()] || "neutral";

  return (
    <span
      className={[styles.badge, styles[`badge-${resolvedTone}`], className]
        .filter(Boolean)
        .join(" ")}
    >
      {children ?? status}
    </span>
  );
}

export function EmptyState({ icon, title, description, action }) {
  return (
    <div className={styles.emptyState}>
      {icon && <div className={styles.emptyIcon}>{icon}</div>}
      <h3 className={styles.emptyTitle}>{title}</h3>
      {description && <p className={styles.emptyDescription}>{description}</p>}
      {action && <div className={styles.emptyAction}>{action}</div>}
    </div>
  );
}
