import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import AnnouncementModal from "@/components/ui/AnnouncementModal";
import PageLoader from "@/components/ui/PageLoader";
import StatCard from "@/components/ui/StatCard";
import InfoTooltip from "@/components/ui/InfoTooltip";
import { getCached, setCached } from "@/lib/dataCache";
import { buildSchedule, isEligible } from "@/lib/payoutSchedule";
import { formatPeso } from "@/lib/format";

const CACHE_KEY = "cashier-dashboard";

export default function CashierDashboard() {
  const cached = getCached(CACHE_KEY);
  const [grantees,          setGrantees]          = useState(cached?.grantees || []);
  const [releases,          setReleases]          = useState(cached?.releases || []);
  const [pendingCount,      setPendingCount]      = useState(cached?.pendingCount ?? 0);
  const [loading,           setLoading]           = useState(!cached);
  const [showAnnouncement,  setShowAnnouncement]  = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    if (!getCached(CACHE_KEY)) setLoading(true);

    // "Pending" needs its own query: fund_releases rows only ever get
    // written as "Released" or "Skipped" (see cashier/Funds.jsx) — a
    // scheduled-but-not-yet-paid release has NO row at all, only a
    // computed "Due" period from buildSchedule(). Counting
    // fund_releases.status === "Pending" (as this page used to) always
    // returns 0, regardless of how many payouts are actually due.
    const [{ data: g }, { data: r }, { data: scheduleData }] = await Promise.all([
      supabase.from("grantees").select("grantee_id,status"),
      supabase.from("fund_releases").select("release_id,amount_released,status,release_date"),
      supabase
        .from("grantees")
        .select(`
          grantee_id, status, verification_result, academic_year, semester,
          date_awarded, duration_extension_semesters, scholarship_id,
          scholarships(amount, payout_frequency, duration_type),
          fund_releases(status, release_date, academic_year, semester, payout_period)
        `)
        .eq("status", "Active"),
    ]);

    const due = (scheduleData || []).filter(gr => {
      if (!isEligible(gr)) return false;
      const schedule = buildSchedule(gr, gr.scholarships || {});
      return schedule.some(p => p.status === "Due");
    });

    setGrantees(g || []);
    setReleases(r || []);
    setPendingCount(due.length);
    setCached(CACHE_KEY, { grantees: g || [], releases: r || [], pendingCount: due.length });
    setLoading(false);
  };

  if (loading) return <PageLoader label="Loading dashboard…" />;

  const totalGrantees  = grantees.length;
  const totalReleased  = releases.filter(r => r.status === "Released").reduce((sum, r) => sum + Number(r.amount_released || 0), 0);
  const releasedCount  = releases.filter(r => r.status === "Released").length;

  const stats = [
    {
      label: "Total Grantees", value: totalGrantees, to: "/cashier/grantees", hint: "Grantees",
      explain: "Total number of rows in the grantees table, regardless of status.",
    },
    {
      label: "Total Released", value: formatPeso(totalReleased), to: "/cashier/funds", hint: "Funds",
      explain: "Sum of amount_released for every fund release whose status is \"Released\".",
    },
    {
      label: "Pending Releases", value: pendingCount, to: "/cashier/funds", hint: "Funds",
      explain: "Active, verified grantees whose next payout period is due but hasn't been released yet — computed from each grantee's schedule, not a stored status.",
    },
    {
      label: "Completed Releases", value: releasedCount, to: "/cashier/funds", hint: "Funds",
      explain: "Count of fund releases whose status is \"Released\".",
    },
  ];


  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h1 className="page-title">Cashier Dashboard</h1>
          <p className="page-subtitle">
            Overview of grantees and fund releases.
          </p>
        </div>
        <button style={s.announceBtn} onClick={() => setShowAnnouncement(true)}>
          Announcements
        </button>
      </div>

      {/* KPI cards */}
      <div style={s.grid}>
        {stats.map(({label, value, explain, to, hint}) => (
          <StatCard key={label} label={label} value={value} explain={explain} to={to} hint={hint} />
        ))}
      </div>

      {/* Recent releases table */}
      <div style={s.tableBox}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <h3 style={{margin:0,fontSize:16,fontWeight:700,color:"var(--text-primary)"}}>Recent Fund Releases</h3>
          <InfoTooltip label="Recent Fund Releases">
            The first 8 fund release records, in the order they were returned from the database.
          </InfoTooltip>
        </div>
        <div style={{overflowX:"auto"}}>
          <table>
            <thead>
              <tr>
                {["Date","Amount","Status"].map(h => <th key={h}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {releases.slice(0, 8).map((r) => (
                <tr key={r.release_id}>
                  <td>{r.release_date || "—"}</td>
                  <td style={{fontWeight:600}}>{formatPeso(r.amount_released)}</td>
                  <td>
                    <span style={{fontSize:12,fontWeight:700,color:r.status==="Released"?"var(--status-success)":"var(--status-warning)"}}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnnouncementModal
        open={showAnnouncement}
        onClose={() => setShowAnnouncement(false)}
        types={["Finance", "General"]}
      />
    </div>
  );
}

const s = {
  page:        { display:"flex",flexDirection:"column",gap:"var(--space-5)" },
  header:      { display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:14 },
  announceBtn: { padding:"10px 18px",background:"var(--navy-700)",color:"#fff",border:"none",borderRadius:10,fontWeight:700,fontSize:14,cursor:"pointer",whiteSpace:"nowrap" },
  grid:        { display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:14 },
  card:        { background:"var(--surface)",border:"1px solid var(--border)",borderRadius:14,padding:"var(--space-5)",boxShadow:"var(--shadow-sm)" },
  tableBox:    { background:"var(--surface)",border:"1px solid var(--border)",borderRadius:14,padding:"var(--space-5)",boxShadow:"var(--shadow-sm)" },
};
