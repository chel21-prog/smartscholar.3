import styles from "./ui.module.css";

/**
 * Full-area loading indicator: SmartScholar's own scholar, sprinting
 * across the screen in a navy gown with a teal stole, round glasses and
 * a gold-tassel mortarboard, a rolled diploma in one hand, teal sneakers
 * on, while requirement sheets flutter off behind them.
 *
 * Pure SVG + CSS: no images, drawn only from theme tokens (navy / teal /
 * gold) so it works in light and dark mode, and it stands still (mid-
 * stride) for people who prefer reduced motion. Fills the content area so
 * the layout doesn't jump when real content swaps in.
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
        viewBox="0 0 120 84"
        aria-hidden="true"
        focusable="false"
      >
        {/* ground: dashes stream past under the runner's feet */}
        <line className={styles.runGround} x1="4" y1="72.5" x2="116" y2="72.5" />
        <ellipse className={styles.runShadow} cx="60" cy="73.4" rx="13" ry="2" />

        {/* requirement sheets fluttering off behind */}
        <g className={`${styles.runSheet} ${styles.runSheet1}`}>
          <rect x="40" y="30" width="6" height="7.6" rx="1" />
          <path d="M41.8 32.6h2.6M41.8 34.6h2.6" />
        </g>
        <g className={`${styles.runSheet} ${styles.runSheet2}`}>
          <rect x="38" y="42" width="6" height="7.6" rx="1" />
          <path d="M39.8 44.6h2.6M39.8 46.6h2.6" />
        </g>
        <g className={`${styles.runSheet} ${styles.runSheet3}`}>
          <rect x="41" y="52" width="6" height="7.6" rx="1" />
          <path d="M42.8 54.6h2.6M42.8 56.6h2.6" />
        </g>

        {/* dust kicked up at the heels */}
        <circle className={`${styles.runPuff} ${styles.runPuff1}`} cx="47" cy="70.4" r="2.2" />
        <circle className={`${styles.runPuff} ${styles.runPuff2}`} cx="47" cy="70.4" r="2.2" />

        <g className={styles.runBob}>
          <g transform="rotate(7 60 72)">
            {/* far arm + far leg (drawn first so the near side overlaps them) */}
            <g className={`${styles.runArm} ${styles.runArmB}`}>
              <path className={styles.runLimb} d="M61 31 L61 39" />
              <g className={`${styles.runFore} ${styles.runForeB}`}>
                <path className={styles.runLimb} d="M61 39 L61 46" />
                <circle className={styles.runHand} cx="61" cy="46.4" r="2.1" />
              </g>
            </g>
            <g className={`${styles.runThigh} ${styles.runLegB}`}>
              <path className={`${styles.runLimb} ${styles.runLegFar}`} d="M60 50 L60 60" />
              <g className={`${styles.runShin} ${styles.runLegB}`}>
                <path className={`${styles.runLimb} ${styles.runLegFar}`} d="M60 60 L60 69.6" />
                <path className={styles.runShoe} d="M60 70.4 L65 70.4" />
              </g>
            </g>

            {/* gown tail streaming behind */}
            <path className={styles.runFlap} d="M53.5 33 Q44 34.6 36.5 45 Q44.5 46.4 52 46.2 Z" />

            {/* near leg */}
            <g className={`${styles.runThigh} ${styles.runLegA}`}>
              <path className={styles.runLimb} d="M60 50 L60 60" />
              <g className={`${styles.runShin} ${styles.runLegA}`}>
                <path className={styles.runLimb} d="M60 60 L60 69.6" />
                <path className={styles.runShoe} d="M60 70.4 L65 70.4" />
              </g>
            </g>

            {/* gown + teal scholarship stole */}
            <path className={styles.runGown} d="M55 29 Q61 26 67 29 L70.5 50.5 Q60 53.5 49.5 50.5 Z" />
            <path className={styles.runStole} d="M59 28.2 L63.6 28.2 L64.6 51.6 L58 51.8 Z" />
            <path className={styles.runStoleTrim} d="M58.1 47.6 L64.5 47.4" />

            {/* head: hair, face, round glasses */}
            <circle className={styles.runSkin} cx="61" cy="20" r="6.3" />
            <path className={styles.runHair} d="M54.8 19.4 Q54.6 13.4 61 13.6 Q67.4 13.6 67.2 19.4 Q64.6 16.2 61 16.2 Q57.4 16.2 54.8 19.4 Z" />
            <circle className={styles.runGlasses} cx="64.4" cy="20.4" r="2.1" />
            <path className={styles.runGlasses} d="M62.3 20.2 L60.2 19.6" />
            <circle className={styles.runEye} cx="64.7" cy="20.4" r=".8" />

            {/* mortarboard with swinging gold tassel */}
            <path className={styles.runCapBand} d="M54.4 16.4 V19.6 Q61 22.4 67.6 19.6 V16.4 Z" />
            <polygon className={styles.runCapTop} points="45,14 61,8.4 77,14 61,19.4" />
            <circle className={styles.runGold} cx="61" cy="13.9" r="1.6" />
            <path className={styles.runCord} d="M61 13.9 L75 14.6" />
            <g className={styles.runTassel}>
              <path className={styles.runCord} d="M75 14.6 L75.4 20.6" />
              <rect className={styles.runGold} x="73.9" y="20" width="3" height="4.6" rx="1.4" />
            </g>

            {/* near arm carrying the diploma */}
            <g className={`${styles.runArm} ${styles.runArmA}`}>
              <path className={styles.runLimb} d="M61 31 L61 39" />
              <g className={`${styles.runFore} ${styles.runForeA}`}>
                <path className={styles.runLimb} d="M61 39 L61 46" />
                <g transform="rotate(-22 61 46.4)">
                  <rect className={styles.runScroll} x="54.5" y="44.4" width="13" height="4" rx="2" />
                  <rect className={styles.runRibbon} x="59.4" y="44.4" width="2.2" height="4" />
                </g>
                <circle className={styles.runHand} cx="61" cy="46.4" r="2.1" />
              </g>
            </g>
          </g>
        </g>
      </svg>
      <span className={styles.pageLoaderLabel}>{label}</span>
    </div>
  );
}
