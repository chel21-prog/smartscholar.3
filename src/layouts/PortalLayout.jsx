import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "@/components/ui/Sidebar";
import ThemeToggle from "@/components/ui/ThemeToggle";
import HelpGuide from "@/components/ui/HelpGuide";
import NotificationBell from "@/components/student/NotificationBell";
import styles from "./PortalLayout.module.css";

export default function PortalLayout({ role, roleLabel, links, showNotifications = false }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className={styles.container}>
      <Sidebar
  roleLabel={roleLabel}
  links={links}
  open={sidebarOpen}
  setOpen={setSidebarOpen}
/>

      <main className={`${styles.main} app-main`}>
        <header className={styles.topBar}>

  <div className={styles.topBarLeft}>

    <button
      className={styles.menuButton}
      onClick={() => setSidebarOpen(true)}
      aria-label="Open navigation menu"
    >
      ☰
    </button>

  </div>
          <div className={styles.topBarRight}>
            {showNotifications && <NotificationBell />}
            <HelpGuide role={role} />
            <ThemeToggle />
          </div>
        </header>

        <div className={styles.content}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
