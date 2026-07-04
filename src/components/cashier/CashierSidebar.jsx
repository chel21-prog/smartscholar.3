import { NavLink } from "react-router-dom";
import styles from "./CashierSidebar.module.css";

export default function CashierSidebar({
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
        <h2 className={styles.title}>Cashier</h2>
      
    
      <nav className={styles.nav}>
        <NavLink to="/cashier/dashboard" onClick={() => setOpen(false)}>Dashboard</NavLink>
        <NavLink to="/cashier/grantees" onClick={() => setOpen(false)}>Grantees</NavLink>
        <NavLink to="/cashier/settings" onClick={() => setOpen(false)}>Settings</NavLink>
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