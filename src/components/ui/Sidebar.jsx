
import { NavLink } from "react-router-dom";
import styles from "./Sidebar.module.css";

/**
 * Unified sidebar used by all three portals.
 * Pass a `links` array of { to, label } objects.
 */
export default function Sidebar({
  roleLabel,
  links,
  open,
  setOpen,
}) {
  const close = () => setOpen(false);

  return (
    <>
      {/* Mobile hamburger — only visible when sidebar is closed */}
      

      <aside className={`${styles.sidebar} ${open ? styles.show : ""}`}>
        <button className={styles.closeBtn} onClick={close} aria-label="Close navigation menu">
          ✕
        </button>

        <div className={styles.logoBox}>
          <img src="/logo.png" className={styles.logo} alt="SmartScholar logo" />
          <span className={styles.roleLabel}>{roleLabel}</span>
        </div>

        <nav className={styles.nav} aria-label="Main navigation">
          {links.map(({ to, label }) => (
            <NavLink key={to} to={to} onClick={close}>
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {open && <div className={styles.backdrop} onClick={close} />}
    </>
  );
}
