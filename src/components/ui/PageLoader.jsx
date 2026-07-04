import styles from "./ui.module.css";

/**
 * Full-area loading indicator. Used in place of the bare
 * `<p>Loading...</p>` that was repeated across every page - gives
 * a visible spinner instead of a flash of plain unstyled text, and
 * fills the content area so the layout doesn't jump when real
 * content swaps in.
 */
export default function PageLoader({ label = "Loading…" }) {
  return (
    <div className={styles.pageLoader} role="status" aria-live="polite">
      <span className={styles.pageLoaderSpinner} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
