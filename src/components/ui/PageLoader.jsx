import styles from "./ui.module.css";

/**
 * Full-area loading indicator: a graduation cap that gets tossed up and
 * catches itself, tassel swinging. Pure SVG + CSS (no images, themes with
 * the navy/gold tokens, and it settles to a soft pulse for people who
 * prefer reduced motion). Fills the content area so the layout doesn't
 * jump when real content swaps in.
 *
 * size: "md" (default, full pages) | "sm" (inside modals / cards)
 */
export default function PageLoader({ label = "Loading…", size = "md" }) {
  return (
    <div
      className={`${styles.pageLoader} ${size === "sm" ? styles.pageLoaderSm : ""}`}
      role="status"
      aria-live="polite"
    >
      <svg
        className={styles.scholar}
        viewBox="0 0 64 64"
        aria-hidden="true"
        focusable="false"
      >
        <ellipse className={styles.scholarShadow} cx="32" cy="57" rx="15" ry="3" />
        <g className={styles.scholarCap}>
          {/* skull cap under the board */}
          <path d="M18 29v10c0 6 28 6 28 0V29z" fill="var(--navy-700)" />
          {/* the mortarboard */}
          <polygon points="32,11 58,23 32,35 6,23" fill="var(--navy-600)" />
          <polygon
            points="32,11 58,23 32,35 6,23"
            fill="none"
            stroke="var(--navy-500)"
            strokeWidth="1"
            strokeLinejoin="round"
          />
          {/* tassel */}
          <g className={styles.scholarTassel}>
            <path
              d="M32 23 L51 27 L51 37"
              fill="none"
              stroke="var(--gold-500)"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <rect x="48.6" y="36" width="4.8" height="8" rx="2.2" fill="var(--gold-500)" />
          </g>
          <circle cx="32" cy="23" r="2.4" fill="var(--gold-500)" />
        </g>
      </svg>
      <span className={styles.pageLoaderLabel}>{label}</span>
    </div>
  );
}
