import { Outlet } from "react-router-dom";
import Sidebar from "@/components/ui/Sidebar";
import ThemeToggle from "@/components/ui/ThemeToggle";
import NotificationBell from "@/components/student/NotificationBell";
import styles from "./PortalLayout.module.css";

export default function PortalLayout({ roleLabel, links, showNotifications = false }) {
  return (
    <div className={styles.container}>
      <Sidebar roleLabel={roleLabel} links={links} />

      <main className={`${styles.main} app-main`}>
        <header className={styles.topBar}>
          <div />
          <div className={styles.topBarRight}>
            {showNotifications && <NotificationBell />}
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
