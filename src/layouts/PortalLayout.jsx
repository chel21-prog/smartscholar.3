import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "@/components/ui/Sidebar";
import ThemeToggle from "@/components/ui/ThemeToggle";
import HelpGuide from "@/components/ui/HelpGuide";
import NotificationBell from "@/components/student/NotificationBell";
import styles from "./PortalLayout.module.css";

export default function PortalLayout({ role, roleLabel, links, showNotifications = false }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Reflects the browser's actual network connection, not the app's own
  // server reachability — it can still say "Online" while Supabase itself
  // is unreachable (e.g. the API is down but Wi-Fi is fine).
  const [isOnline, setIsOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine
  );

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

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

    <span
      className={styles.onlineBadge}
      data-state={isOnline ? "online" : "offline"}
      title={isOnline ? "Connected to the internet" : "No internet connection"}
    >
      <span className={styles.onlineDot} aria-hidden="true" />
      <span className={styles.onlineLabel}>{isOnline ? "Online" : "Offline"}</span>
    </span>

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
