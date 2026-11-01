import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import AnnouncementModal from "@/components/ui/AnnouncementModal";
import PageLoader from "@/components/ui/PageLoader";
import StatCard from "@/components/ui/StatCard";
import InfoTooltip from "@/components/ui/InfoTooltip";
import { getCached, setCached } from "@/lib/dataCache";
import { buildSchedule, isEligible } from "@/lib/payoutSchedule";
import { formatPeso, formatDate } from "@/lib/format";
import { Panel, BarChart, HBarList, Gauge, StatusPill, EmptyHint, TONE } from "@/components/ui/DashCharts";
import dash from "@/components/ui/DashCharts.module.css";

const CACHE_KEY = "cashier-dashboard-v2";

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
      supabase
        .from("fund_releases")
        .select(`
          release_id, amount_released, status, release_date,
          academic_year, semester, payout_period,
          grantees(
            grantee_id,
            students(
              school_id,
              users(first_name, last_name)
            ),
            scholarships(scholarship_name)
          )
        `)
        .order("release_date", { ascending: false, nullsFirst: false }),
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
  const releasedRows   = releases.filter(r => r.status === "Released");
  const skippedCount   = releases.filter(r => r.status === "Skipped").length;
  const totalReleased  = releasedRows.reduce((sum, r) => sum + Number(r.amount_released || 0), 0);
  const releasedCount  = releasedRows.length;
  const releaseRate    = releasedCount + skippedCount ? Math.round((releasedCount / (releasedCount + skippedCount)) * 100) : 0;

  // releases per month, last 6 calendar months (by release date)
  const monthlyReleases = (() => {
    const now = new Date();
    const out = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      out.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString("en", { month: "short" }), value: 0 });
    }
    releasedRows.forEach(r => {
      if (!r.release_date) return;
      const d = new Date(r.release_date);
      const m = out.find(x => x.key === `${d.getFullYear()}-${d.getMonth()}`);
      if (m) m.value += 1;
    });
    return out;
  })();

  // pesos released per scholarship (top 6)
  const releasedByScholarship = (() => {
    const m = {};
    releasedRows.forEach(r => {
      const n = r.grantees?.scholarships?.scholarship_name;
      if (n) m[n] = (m[n] || 0) + Number(r.amount_released || 0);
    });
    return Object.entries(m).map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value).slice(0, 6);
  })();

  const recentRows = releases.slice(0, 5).map(r => {
    const u = r.grantees?.students?.users;
    return {
      id: r.release_id,
      name: u ? `${u.first_name || ""} ${u.last_name || ""}`.trim() : "",
      scholarship: r.grantees?.scholarships?.scholarship_name || "",
      amount: formatPeso(r.amount_released),
      date: r.release_date ? formatDate(r.release_date, { month: "short", day: "numeric" }) : "—",
      status: r.status,
    };
  });

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
  ];

  return (
    <div className="page-shell">
      <div className="page-header">
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
      <div className="stats-grid">
        {stats.map(({label, value, explain, to, hint}) => (
          <StatCard key={label} label={label} value={value} explain={explain} to={to} hint={hint} />
        ))}
      </div>

      <div className={dash.rowC}>
        <Panel title="Releases per month" to="/cashier/funds" hint="View funds"
          action={<InfoTooltip label="Releases per month">Number of fund releases with status "Released" in each of the last 6 calendar months, by release date. The busiest month is highlighted.</InfoTooltip>}>
          {releasedCount ? <BarChart data={monthlyReleases} /> : <EmptyHint>No fund releases yet.</EmptyHint>}
        </Panel>

        <Panel title="Release rate" to="/cashier/funds" hint="View funds"
          action={<InfoTooltip label="Release rate">Releases with status "Released" ÷ all release records that were either released or skipped × 100, rounded to the nearest whole percent. Due releases that have no record yet are not counted.</InfoTooltip>}>
          <Gauge value={releaseRate} caption="released, not skipped"
            outcomes={[
              { label: "Released", value: releasedCount, color: TONE.blue },
              { label: "Skipped",  value: skippedCount,  color: TONE.coral },
            ]} />
        </Panel>
      </div>

      <div className={dash.rowC}>
        <Panel bodyClass={dash.listBody} title="Recent fund releases" to="/cashier/funds" hint="View funds"
          action={<InfoTooltip label="Recent fund releases">The five most recent fund release records, newest first, showing who received it, for which scholarship and the amount.</InfoTooltip>}>
          {recentRows.length === 0 ? <EmptyHint>No fund releases yet.</EmptyHint> : (
            <div className={dash.rows}>
              <div className={`${dash.row} ${dash.rowAmt} ${dash.rowHead}`}>
                <span>Recipient</span><span className={dash.cellMuted}>Scholarship</span>
                <span className={dash.cellDate}>Date</span><span>Amount</span><span>Status</span>
              </div>
              {recentRows.map(r => (
                <div key={r.id} className={`${dash.row} ${dash.rowAmt}`}>
                  <span className={dash.cellStrong} title={r.name}>{r.name || "—"}</span>
                  <span className={dash.cellMuted} title={r.scholarship}>{r.scholarship || "—"}</span>
                  <span className={dash.cellDate}>{r.date}</span>
                  <span className={dash.cellStrong}>{r.amount}</span>
                  <StatusPill status={r.status} />
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel bodyClass={dash.listBody} title="Released by scholarship" to="/cashier/funds" hint="View funds"
          action={<InfoTooltip label="Released by scholarship">Total pesos released per scholarship program (status "Released" only), with each program's share of everything released. The largest is highlighted.</InfoTooltip>}>
          <HBarList rows={releasedByScholarship} format={formatPeso} empty="No fund releases yet." />
        </Panel>
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
  announceBtn: { padding:"10px 18px",background:"var(--navy-700)",color:"var(--paper)",border:"none",borderRadius:10,fontWeight:700,fontSize:14,cursor:"pointer",whiteSpace:"nowrap" },
  card:        { background:"var(--surface)",border:"1px solid var(--border)",borderRadius:14,padding:"var(--space-5)",boxShadow:"var(--shadow-sm)" },
};
