import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useSession } from "@/context/SessionContext";
import { signOutCurrentAccount } from "@/lib/authSync";
import { useConfirm } from "@/hooks/useConfirm";
import NavIcon from "./NavIcon";
import styles from "./Sidebar.module.css";

/**
 * Unified sidebar used by all three portals.
 *
 * `links` accepts two shapes:
 *   - flat:    [{ to, label }, ...]                       (Student, Cashier)
 *   - grouped: [{ label, items: [{ to, label }] }, ...]    (Coordinator)
 * Both render through the same markup, so a portal can switch between the
 * two just by changing what it passes in — nothing else has to change.
 */
export default function Sidebar({ roleLabel, links, open, setOpen }) {
  const navigate = useNavigate();
  const { profile } = useSession();
  const { askConfirm, confirmDialog } = useConfirm();
  const close = () => setOpen(false);

  const grouped = Array.isArray(links) && links.length > 0 && Array.isArray(links[0]?.items);
  const groups = grouped ? links : [{ label: null, items: links }];

  const [collapsed, setCollapsed] = useState({});
  const toggleGroup = (label) =>
    setCollapsed((c) => ({ ...c, [label]: !c[label] }));

  const initials =
    ((profile?.first_name?.[0] || "") + (profile?.last_name?.[0] || "")).toUpperCase() || "?";
  const fullName = profile
    ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim()
    : "";

  const handleLogout = async () => {
    await signOutCurrentAccount();
    navigate("/Login");
  };

  const confirmLogout = () =>
    askConfirm(
      "You'll need to log in again to access your account.",
      handleLogout,
      { title: "Sign out?", confirmLabel: "Sign out", variant: "danger" }
    );

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
          <span className={styles.subLabel}>Batanes State College</span>
        </div>

        <nav className={styles.nav} aria-label="Main navigation">
          {groups.map((group, gi) => {
            const isCollapsed = !!collapsed[group.label];
            return (
              <div className={styles.navGroup} key={group.label || gi}>
                {group.label && (
                  <button
                    type="button"
                    className={styles.groupHeader}
                    onClick={() => toggleGroup(group.label)}
                    aria-expanded={!isCollapsed}
                  >
                    <span>{group.label}</span>
                    <svg
                      className={styles.groupChevron}
                      style={{ transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)" }}
                      width="12" height="12" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                )}

                {!isCollapsed && group.items.map(({ to, label }) => (
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
              </div>
            );
          })}
        </nav>

        <div className={styles.footer}>
          <div className={styles.footerAvatar} aria-hidden="true">{initials}</div>
          <div className={styles.footerInfo}>
            <span className={styles.footerName}>{fullName || "\u00A0"}</span>
            <span className={styles.footerRole}>{roleLabel}</span>
          </div>
          <button
            type="button"
            className={styles.logoutBtn}
            onClick={confirmLogout}
            aria-label="Sign out"
            title="Sign out"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <path d="M16 17l5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
          </button>
        </div>
      </aside>

      {open && <div className={styles.backdrop} onClick={close} />}

      {confirmDialog}
    </>
  );
}
