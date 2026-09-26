import styles from "./LegalNotice.module.css";

/**
 * Single source of truth for SmartScholar's legal text — the same
 * Terms & Data Privacy Policy content shown at Signup/Login, plus the
 * cookies/local storage explanation from the site-wide notice (SiteNotice.jsx).
 * Rendered inside a Modal wherever it's needed (Settings, SiteNotice) so the
 * wording never drifts between the two.
 */
export default function LegalNotice() {
  return (
    <div className={styles.legal}>
      <section className={styles.section}>
        <h3 className={styles.heading}>Terms & Data Privacy Policy</h3>
        <p className={styles.text}>
          By using SmartScholar, you agree that your personal data (name,
          email, academic records, and uploaded files) will be stored
          securely and used only for scholarship processing.
        </p>
        <p className={styles.text}>
          We comply with the Data Privacy Act of the Philippines (RA 10173).
          Your information will not be shared without authorization.
        </p>
        <p className={styles.text}>
          You are responsible for ensuring all submitted information is
          accurate.
        </p>
      </section>

      <section className={styles.section}>
        <h3 className={styles.heading}>Cookies & Local Storage</h3>
        <p className={styles.text}>
          SmartScholar sets a small number of essential cookies and local
          storage entries to keep you signed in, remember your theme
          preference, and speed up pages you've already loaded. These are
          required for the system to work and can't be turned off
          individually.
        </p>
        <p className={styles.text}>
          We don't use cookies for advertising or third-party tracking.
        </p>
      </section>
    </div>
  );
}
