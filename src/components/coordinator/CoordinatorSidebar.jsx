import { useState } from "react";
import { NavLink } from "react-router-dom";
import styles from "./CoordinatorSidebar.module.css";

export default function CoordinatorSidebar() {
const [open, setOpen] = useState(false);

  return (
    <>
      {/* FLOATING BUTTON (ONLY MOBILE + CLOSED) */}
      
<button
  className={styles.floatingBtn}
  onClick={() => setOpen(true)}
  style={{ display: open ? "none" : undefined }}
>
  ☰
</button>

{/* SIDEBAR */}
<aside
  className={`${styles.sidebar} ${open ? styles.show : ""}`}
>
  {/* CLOSE BUTTON (ONLY MOBILE + OPEN) */}
  <button
    className={styles.closeBtn}
    onClick={() => setOpen(false)}
  >
    ✕
  </button>

      <div className={styles.logoBox}>
        <img
          src="/logo.png"
          alt="Logo"
          className={styles.logo}
        />
        <div className={styles.title}>Coordinator</div>
      
           

      

      <nav className={styles.nav}>
        <NavLink to="/coordinator/dashboard">Dashboard</NavLink>
        <NavLink to="/coordinator/scholarships">Scholarships</NavLink>
        <NavLink to="/coordinator/students">Students</NavLink>
        <NavLink to="/coordinator/grantees">Grantees</NavLink>
        <NavLink to="/coordinator/applications">Applications</NavLink>
        <NavLink to="/coordinator/requirements">Requirements</NavLink>
        <NavLink to="/coordinator/settings">Settings</NavLink>
      </nav>
      </div>
    </aside>

          {/* BACKDROP */}
          {open && (
            <div
              className={styles.backdrop}
              onClick={() => setOpen(false)}
            />
          )}
        </>
  );
}