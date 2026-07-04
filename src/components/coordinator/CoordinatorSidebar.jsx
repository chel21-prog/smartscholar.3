
import { NavLink } from "react-router-dom";
import styles from "./CoordinatorSidebar.module.css";

export default function CoordinatorSidebar({
  open,
  setOpen,
}) {
  return (
    <>


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
        <NavLink to="/coordinator/dashboard" onClick={() => setOpen(false)}>Dashboard</NavLink>
        <NavLink to="/coordinator/scholarships" onClick={() => setOpen(false)}>Scholarships</NavLink>
        <NavLink to="/coordinator/students" onClick={() => setOpen(false)}>Students</NavLink>
        <NavLink to="/coordinator/grantees" onClick={() => setOpen(false)}>Grantees</NavLink>
        <NavLink to="/coordinator/applications" onClick={() => setOpen(false)}>Applications</NavLink>
        <NavLink to="/coordinator/requirements" onClick={() => setOpen(false)}>Requirements</NavLink>
        <NavLink to="/coordinator/settings" onClick={() => setOpen(false)}>Settings</NavLink>
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