import sk from "./Skeleton.module.css";
import TableSkeleton from "./TableSkeleton";

/**
 * Skeleton building blocks. Every loading state in the app is made from these
 * so first loads show the shape of the page instead of a spinner or "Loading…".
 */

/** A single shimmering block. width/height take any CSS size. */
export function Skeleton({ width = "100%", height = 14, circle = false, style, className = "" }) {
  return (
    <span
      className={`${sk.block} ${circle ? sk.circle : ""} ${className}`}
      style={{ width, height, ...style }}
      aria-hidden="true"
    />
  );
}

/** A few lines of text; the last line is shorter. */
export function SkeletonText({ lines = 3, gap }) {
  return (
    <div className={sk.stack} style={gap ? { gap } : undefined} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height={12} width={i === lines - 1 && lines > 1 ? "60%" : "100%"} />
      ))}
    </div>
  );
}

/** Placeholder for a row of stat cards (4 by default, matching the real pages). */
export function SkeletonStats({ count = 4 }) {
  return (
    <div className={sk.statGrid} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div className={sk.statCard} key={i}>
          <Skeleton width="55%" height={12} />
          <Skeleton width="40%" height={30} />
        </div>
      ))}
    </div>
  );
}

/** Placeholder for a grid of content cards (scholarships, concerns…). */
export function SkeletonCards({ count = 6 }) {
  return (
    <div className={sk.cardGrid} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div className={sk.panel} key={i}>
          <div className={sk.row}>
            <Skeleton width={38} height={38} circle />
            <div className={sk.stack} style={{ flex: 1 }}>
              <Skeleton width="70%" height={14} />
              <Skeleton width="45%" height={11} />
            </div>
          </div>
          <SkeletonText lines={3} />
          <Skeleton width="100%" height={36} style={{ borderRadius: "var(--radius-md)" }} />
        </div>
      ))}
    </div>
  );
}

/** Placeholder for a form (label + field pairs). */
export function SkeletonForm({ fields = 4 }) {
  return (
    <div className={sk.stack} style={{ gap: "var(--space-4)" }} aria-hidden="true">
      {Array.from({ length: fields }).map((_, i) => (
        <div className={sk.stack} key={i} style={{ gap: 6 }}>
          <Skeleton width="30%" height={11} />
          <Skeleton width="100%" height={38} style={{ borderRadius: "var(--radius-md)" }} />
        </div>
      ))}
    </div>
  );
}

/**
 * A whole page: title, optional stat cards, then a table or card grid.
 * variant: "table" (default) | "cards" | "form"
 */
export function SkeletonPage({ variant = "table", stats = 4 }) {
  return (
    <div className={sk.page} aria-hidden="true">
      <div className={sk.header}>
        <div className={sk.stack} style={{ width: "min(360px, 70%)" }}>
          <Skeleton width="60%" height={28} />
          <Skeleton width="90%" height={12} />
        </div>
        <Skeleton width={130} height={36} style={{ borderRadius: "var(--radius-md)" }} />
      </div>

      {stats > 0 && <SkeletonStats count={stats} />}

      {variant === "cards" && <SkeletonCards count={6} />}

      {variant === "form" && (
        <div className={sk.panel}>
          <SkeletonForm fields={5} />
        </div>
      )}

      {variant === "table" && (
        <div className={sk.panel}>
          <div className={sk.row}>
            <Skeleton width="min(320px, 60%)" height={38} style={{ borderRadius: "var(--radius-md)" }} />
            <Skeleton width={110} height={38} style={{ borderRadius: "var(--radius-md)" }} />
          </div>
          <TableSkeleton columns={6} rows={7} />
        </div>
      )}
    </div>
  );
}

/** The app frame (sidebar + page) — used while the session itself is loading. */
export function SkeletonShell({ variant = "table" }) {
  return (
    <div className={sk.shell} aria-hidden="true">
      <div className={sk.shellSide}>
        <Skeleton width={110} height={30} />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} width="100%" height={34} style={{ borderRadius: "var(--radius-md)" }} />
        ))}
      </div>
      <div className={sk.shellMain}>
        <SkeletonPage variant={variant} />
      </div>
    </div>
  );
}

export { sk as skeletonStyles };
