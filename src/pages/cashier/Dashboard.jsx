import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function CashierDashboard() {
  const [grantees, setGrantees] = useState([]);
  const [releases, setReleases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);

    // GRANTEES
    const { data: g } = await supabase
      .from("grantees")
      .select("grantee_id, status");

    // FUND RELEASES
    const { data: r } = await supabase
      .from("fund_releases")
      .select(`
        release_id,
        amount_released,
        status,
        release_date
      `);

    setGrantees(g || []);
    setReleases(r || []);
    setLoading(false);
  };

  if (loading) return <p style={{ padding: 20 }}>Loading...</p>;

  // =========================
  // 📊 ANALYTICS CALCULATIONS
  // =========================

  const totalGrantees = grantees.length;

  const totalReleased = releases
    .filter((r) => r.status === "Released")
    .reduce((sum, r) => sum + Number(r.amount_released || 0), 0);

  const pending = releases.filter(
    (r) => r.status === "Pending"
  ).length;

  const releasedCount = releases.filter(
    (r) => r.status === "Released"
  ).length;

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Cashier Dashboard</h1>

      {/* KPI CARDS */}
      <div style={styles.kpiGrid}>
        <div style={styles.card}>
          <h3>Total Grantees</h3>
          <p style={styles.number}>{totalGrantees}</p>
        </div>

        <div style={styles.card}>
          <h3>Total Released Funds</h3>
          <p style={styles.number}>
            ₱{totalReleased.toLocaleString()}
          </p>
        </div>

        <div style={styles.card}>
          <h3>Pending Releases</h3>
          <p style={styles.number}>{pending}</p>
        </div>

        <div style={styles.card}>
          <h3>Completed Releases</h3>
          <p style={styles.number}>{releasedCount}</p>
        </div>
      </div>

      {/* SIMPLE CHART (NO LIBRARY) */}
      <div style={styles.chartBox}>
        <h3>Release Status Overview</h3>

        <div style={styles.barRow}>
          <div style={styles.barLabel}>Released</div>
          <div style={styles.barBg}>
            <div
              style={{
                ...styles.barFill,
                width: `${(releasedCount / (releasedCount + pending || 1)) * 100}%`,
                background: "#16a34a",
              }}
            />
          </div>
        </div>

        <div style={styles.barRow}>
          <div style={styles.barLabel}>Pending</div>
          <div style={styles.barBg}>
            <div
              style={{
                ...styles.barFill,
                width: `${(pending / (releasedCount + pending || 1)) * 100}%`,
                background: "#f59e0b",
              }}
            />
          </div>
        </div>
      </div>

      {/* RECENT TRANSACTIONS */}
      <div style={styles.tableBox}>
        <h3 style={{ marginBottom: 10 }}>Recent Fund Releases</h3>

        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Date</th>
              <th style={styles.th}>Amount</th>
              <th style={styles.th}>Status</th>
            </tr>
          </thead>

          <tbody>
            {releases.slice(0, 8).map((r) => (
              <tr key={r.release_id}>
                <td style={styles.td}>
                  {r.release_date}
                </td>

                <td style={styles.td}>
                  ₱{r.amount_released}
                </td>

                <td style={styles.td}>
                  <span
                    style={{
                      ...styles.badge,
                      background:
                        r.status === "Released"
                          ? "#dcfce7"
                          : "#fef3c7",
                      color:
                        r.status === "Released"
                          ? "#166534"
                          : "#92400e",
                    }}
                  >
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================= STYLES ================= */
const styles = {
  page: {
    padding: 30,
    background: "#f8fafc",
    minHeight: "100vh",
  },

  title: {
    fontSize: 28,
    fontWeight: 700,
    marginBottom: 20,
  },

  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 15,
    marginBottom: 20,
  },

  card: {
    background: "#fff",
    padding: 15,
    borderRadius: 12,
    boxShadow: "0 4px 15px rgba(0,0,0,0.08)",
  },

  number: {
    fontSize: 26,
    fontWeight: "bold",
    marginTop: 10,
  },

  chartBox: {
    background: "#fff",
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
    boxShadow: "0 4px 15px rgba(0,0,0,0.08)",
  },

  barRow: {
    display: "flex",
    alignItems: "center",
    marginBottom: 10,
  },

  barLabel: {
    width: 80,
    fontSize: 13,
  },

  barBg: {
    flex: 1,
    height: 10,
    background: "#e5e7eb",
    borderRadius: 10,
    overflow: "hidden",
  },

  barFill: {
    height: "100%",
  },

  tableBox: {
    background: "#fff",
    padding: 15,
    borderRadius: 12,
    boxShadow: "0 4px 15px rgba(0,0,0,0.08)",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
  },

  th: {
    textAlign: "left",
    padding: 10,
    background: "#111",
    color: "#fff",
    fontSize: 13,
  },

  td: {
    padding: 10,
    borderBottom: "1px solid #eee",
    fontSize: 13,
  },

  badge: {
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    display: "inline-block",
  },
};