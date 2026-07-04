import { NavLink } from "react-router-dom";
import styles from "./CashierSidebar.module.css";
import { useState } from "react";

export default function CashierSidebar() {
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
        <h2 className={styles.title}>Cashier</h2>
      
    
      <nav className={styles.nav}>
        <NavLink to="/cashier/dashboard">Dashboard</NavLink>
        <NavLink to="/cashier/grantees">Grantees</NavLink>
        <NavLink to="/cashier/settings">Settings</NavLink>
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