import { Outlet } from "react-router-dom";
import StudentSidebar from "@/components/student/StudentSidebar";
import NotificationBell from "@/components/student/NotificationBell";

export default function StudentLayout() {
  return (
    <div style={styles.container}>
      <StudentSidebar />

      <main className="app-main" style={styles.main}>
        <div style={styles.topBar}>
          <div />
          <NotificationBell />
        </div>

        <div style={styles.content}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    minHeight: "100vh",
  },

  // marginLeft reads from the same --sidebar-width token the sidebar's
  // own CSS module uses, so the two can never drift out of sync again
  // (they previously hard-coded 230px here vs 200px in the sidebar,
  // leaving an unexplained 30px gap).
  main: {
    flex: 1,
    marginLeft: "var(--sidebar-width)",
    minHeight: "100vh",
    background: "var(--ink-50)",
    display: "flex",
    flexDirection: "column",
    transition: "margin-left 0.2s ease",
  },

  topBar: {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    height: "var(--topbar-height)",
    padding: "0 var(--space-6)",
    background: "var(--surface)",
    borderBottom: "1px solid var(--border)",
    flexShrink: 0,
    position: "sticky",
    top: 0,
    zIndex: 40,
  },

  content: {
    flex: 1,
    padding: "var(--space-6)",
    width: "100%",
    maxWidth: "1280px",
    margin: "0 auto",
    boxSizing: "border-box",
  },
};