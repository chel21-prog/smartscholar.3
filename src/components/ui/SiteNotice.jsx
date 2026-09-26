import { useState } from "react";
import Modal from "@/components/ui/Modal";
import LegalNotice from "@/components/ui/LegalNotice";
import styles from "./SiteNotice.module.css";

const STORAGE_KEY = "smartscholar_cookie_consent";

/**
 * Site-wide cookie / data-privacy notice.
 * - Shows once per browser until the user accepts.
 * - "Learn more" opens a short explainer covering the Data Privacy Act
 *   of the Philippines (RA 10173), matching the language already used
 *   in the Terms & Data Privacy Policy shown at signup/login.
 */
function hasConsented() {
  try {
    return !!localStorage.getItem(STORAGE_KEY);
  } catch {
    // localStorage unavailable (e.g. private browsing) — treat as already
    // consented so we don't show a notice with no way to dismiss it.
    return true;
  }
}

export default function SiteNotice() {
  const [visible, setVisible] = useState(() => !hasConsented());
  const [showDetails, setShowDetails] = useState(false);

  const accept = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "accepted");
    } catch {
      // ignore — nothing to persist to
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <>
      <div className={styles.banner} role="dialog" aria-label="Cookie notice">
        <p className={styles.text}>
          SmartScholar uses essential cookies and local storage to keep you
          signed in and remember your settings. We don't use these for
          advertising.{" "}
          <button
            type="button"
            className={styles.link}
            onClick={() => setShowDetails(true)}
          >
            Learn more
          </button>
        </p>
        <button type="button" className={styles.accept} onClick={accept}>
          Got it
        </button>
      </div>

      <Modal
        open={showDetails}
        onClose={() => setShowDetails(false)}
        title="Cookies & Data Privacy"
        footer={
          <button type="button" className={styles.accept} onClick={() => setShowDetails(false)}>
            Close
          </button>
        }
      >
        <LegalNotice />
      </Modal>
    </>
  );
}
