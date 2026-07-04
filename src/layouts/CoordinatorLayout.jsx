import { Outlet } from "react-router-dom";
import Sidebar from "@/components/coordinator/CoordinatorSidebar";

export default function CoordinatorLayout() {
  return (
    <div style={styles.wrapper}>
      <Sidebar />

      <main style={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    minHeight: "100vh",
  },

  main: {
    flex: 1,
    marginLeft: "230px",
    padding: 20,
    background: "#f4f6f8",
    minHeight: "100vh",
    overflowY: "auto",
    transition: "all 0.3s ease",
  },
};