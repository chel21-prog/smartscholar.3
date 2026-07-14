import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import GUIDES from "./guideContent";
import styles from "./HelpGuide.module.css";

export default function HelpGuide({ role }) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const boxRef = useRef();
  const btnRef = useRef();

  const guide = GUIDES[role];
  const page = guide?.pages?.[location.pathname];

  // Same viewport-clamped positioning as the notification bell — fixed
  // positioning computed from the button's real screen position, so this
  // can never be clipped by an ancestor's overflow:hidden or run off the
  // edge of the screen.
  const updatePosition = () => {
    const btn = btnRef.current;
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    const margin = 16;
    const width = Math.min(340, window.innerWidth - margin * 2);

    let left = rect.right - width;
    left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));

    let top = rect.bottom + 8;
    const maxHeight = 420;
    if (top + maxHeight > window.innerHeight - margin) {
      const spaceAbove = rect.top - margin;
      if (spaceAbove > window.innerHeight - top) {
        top = Math.max(margin, rect.top - 8 - Math.min(maxHeight, spaceAbove));
      }
    }

    setPos({ top, left, width });
  };

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();

    const onViewportChange = () => updatePosition();
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
    return () => {
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
    };
  }, [open]);

  // Close on click-outside.
  useEffect(() => {
    const handleClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target) &&
          btnRef.current && !btnRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  // Re-open freshly (don't carry an old position) whenever the page changes.
  useEffect(() => { setOpen(false); }, [location.pathname]);

  if (!guide) return null;

  return (
    <div ref={boxRef} className={styles.wrapper}>
      <button
        ref={btnRef}
        className={styles.btn}
        onClick={() => setOpen((v) => !v)}
        aria-label="Help guide for this page"
        aria-expanded={open}
      >
        ?
      </button>

      {open && pos && (
        <div
          className={styles.panel}
          role="region"
          aria-label="Help guide"
          style={{ top: pos.top, left: pos.left, width: pos.width }}
        >
          <div className={styles.panelHeader}>
            <span className={styles.roleTag}>{role} Portal</span>
            <button className={styles.closeBtn} onClick={() => setOpen(false)} aria-label="Close guide">✕</button>
          </div>

          <p className={styles.overview}>{guide.overview}</p>

          {page ? (
            <div className={styles.pageSection}>
              <h4 className={styles.pageTitle}>On this page — {page.title}</h4>
              <ul className={styles.tipList}>
                {page.tips.map((tip, i) => <li key={i}>{tip}</li>)}
              </ul>
            </div>
          ) : (
            <p className={styles.noPage}>
              No page-specific tips here yet — the overview above still applies.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
