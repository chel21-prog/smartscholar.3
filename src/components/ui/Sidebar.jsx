import { NavLink } from "react-router-dom";
import NavIcon from "./NavIcon";
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
      <aside className={`${styles.sidebar} ${open ? styles.show : ""}`}>
        <button className={styles.closeBtn} onClick={close} aria-label="Close navigation menu">
          ✕
        </button>

        <div className={styles.logoBox}>
          <span className={styles.logoRing} aria-hidden="true" />
          <img src="/logo.png" className={styles.logo} alt="SmartScholar logo" />
          <span className={styles.roleLabel}>{roleLabel}</span>
        </div>

        <nav className={styles.nav} aria-label="Main navigation">
          {links.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={close}
              className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ""}`}
            >
              <NavIcon label={label} className={styles.navIcon} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      {open && <div className={styles.backdrop} onClick={close} />}
    </>
  );
}
