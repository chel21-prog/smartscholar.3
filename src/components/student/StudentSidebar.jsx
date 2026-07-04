
import { NavLink } from "react-router-dom";
import styles from "./StudentSidebar.module.css";

export default function StudentSidebar({
  open,
  setOpen,
}) {

  return (
    <>
   

      {/* SIDEBAR */}
      <aside className={`${styles.sidebar} ${open ? styles.show : ""}`}>
        {/* CLOSE BUTTON (ONLY MOBILE + OPEN) */}
        <button
          className={styles.closeBtn}
          onClick={() => setOpen(false)}
          aria-label="Close navigation menu"
        >
          ✕
        </button>

        {/* LOGO */}
        <div className={styles.logoBox}>
          <img src="/logo.png" className={styles.logo} alt="SmartScholar logo" />
          <span className={styles.title}>Student Portal</span>
        </div>

        {/* NAV */}
        <nav className={styles.nav}>
          <NavLink onClick={() => setOpen(false)} to="/student/dashboard">
            Dashboard
          </NavLink>
          <NavLink onClick={() => setOpen(false)} to="/student/profile">
            Profile
          </NavLink>
          <NavLink onClick={() => setOpen(false)} to="/student/applications">
            Applications
          </NavLink>
          <NavLink onClick={() => setOpen(false)} to="/student/compliance">
            Compliance
          </NavLink>
          <NavLink onClick={() => setOpen(false)} to="/student/settings">
            Settings
          </NavLink>
        </nav>
      </aside>

      {/* BACKDROP */}
      {open && <div className={styles.backdrop} onClick={() => setOpen(false)} />}
    </>
  );
}