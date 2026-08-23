import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/context/ToastContext";
import SearchFilterBar from "@/components/ui/SearchFilterBar";
import StatCard from "@/components/ui/StatCard";
import TableSkeleton from "@/components/ui/TableSkeleton";
import { getCached, setCached } from "@/lib/dataCache";
import {
  buildSchedule, isEligible, isFullyPaidOut, payoutProgressLabel, latestRelease,
} from "@/lib/payoutSchedule";
import s from "./Payouts.module.css";

const CACHE_KEY = "coordinator-payouts";
const PAGE_SIZE = 10;

// This page is READ-ONLY on purpose — releasing or skipping a payout stays
// a cashier action (cashier/Funds.jsx, cashier/Grantees.jsx). Coordinators
// get full visibility into schedules and what's already gone out, without
// a control that lets them move money.

export default function Payouts() {
  const toast = useToast();
  const cached = getCached(CACHE_KEY);
  const [rows, setRows] = useState(cached || []);
  const [loading, setLoading] = useState(!cached);

  const [tab, setTab] = useState("schedules"); // "schedules" | "history"
  const [search, setSearch] = useState("");
  const [scholarshipFilter, setScholarshipFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [page, setPage] = useState(1);

  const [selectedGrantee, setSelectedGrantee] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    if (!getCached(CACHE_KEY)) setLoading(true);

    const { data, error } = await supabase
      .from("grantees")
      .select(`
        *,
        students(
          student_id, school_id, course, year_level,
          users(user_id, first_name, last_name)
        ),
        scholarships(
          scholarship_id, scholarship_name, sponsor, amount,
          total_budget, payout_frequency, duration_type
        ),
        fund_releases(
          release_id, amount_released, release_date, status,
          remarks, academic_year, semester, payout_period
        )
      `)
      .order("grantee_id", { ascending: false });

    if (error) {
      console.error(error);
      toast.error("Failed to load payout data: " + error.message);
      setRows([]);
    } else {
      setRows(data || []);
      setCached(CACHE_KEY, data || []);
    }
    setLoading(false);
  }

  const scholarshipOptions = useMemo(
    () => ["All", ...new Set(rows.map(r => r.scholarships?.scholarship_name).filter(Boolean))],
    [rows]
  );

  // ── Schedules tab: one row per grantee ──────────────────────────────
  const scheduleRows = rows.filter(g => {
    const fullname = `${g.students?.users?.first_name || ""} ${g.students?.users?.last_name || ""}`.toLowerCase();
    const keyword = search.toLowerCase();
    const matchesSearch =
      fullname.includes(keyword) ||
      g.students?.school_id?.toLowerCase().includes(keyword) ||
      g.scholarships?.scholarship_name?.toLowerCase().includes(keyword);
    const matchesScholarship = scholarshipFilter === "All" || g.scholarships?.scholarship_name === scholarshipFilter;
    const matchesStatus = statusFilter === "All" || g.status === statusFilter;
    return matchesSearch && matchesScholarship && matchesStatus;
  });

  // ── History tab: one row per actual release ─────────────────────────
  const releaseHistory = useMemo(() => {
    return rows
      .flatMap(g => (g.fund_releases || [])
        .filter(fr => fr.status === "Released")
        .map(fr => ({
          ...fr,
          student: `${g.students?.users?.first_name || ""} ${g.students?.users?.last_name || ""}`.trim(),
          schoolId: g.students?.school_id,
          scholarship: g.scholarships?.scholarship_name,
        })))
      .sort((a, b) => new Date(b.release_date) - new Date(a.release_date));
  }, [rows]);

  const historyRows = releaseHistory.filter(r => {
    const keyword = search.toLowerCase();
    const matchesSearch =
      r.student.toLowerCase().includes(keyword) ||
      (r.schoolId || "").toLowerCase().includes(keyword) ||
      (r.scholarship || "").toLowerCase().includes(keyword);
    const matchesScholarship = scholarshipFilter === "All" || r.scholarship === scholarshipFilter;
    return matchesSearch && matchesScholarship;
  });

  const activeRows = tab === "schedules" ? scheduleRows : historyRows;
  const totalPages = Math.max(1, Math.ceil(activeRows.length / PAGE_SIZE));
  const currentRows = activeRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── summary stats ────────────────────────────────────────────────────
  const totalReleased = releaseHistory.reduce((sum, r) => sum + Number(r.amount_released || 0), 0);
  const dueCount = rows.filter(g => {
    if (!isEligible(g)) return false;
    return buildSchedule(g, g.scholarships || {}).some(p => p.status === "Due");
  }).length;
  const activeScholarshipCount = new Set(rows.map(g => g.scholarships?.scholarship_name).filter(Boolean)).size;

  return (
    <div className={s.page}>
      <div className={s.header}>
        <div>
          <h1>Payouts</h1>
          <p>View-only — payout schedules for every grantee and the full release history. To release or skip a payout, use the Cashier portal.</p>
        </div>
      </div>

      <div className={s.summaryGrid}>
        <StatCard
          label="Total Released"
          value={`₱${totalReleased.toLocaleString()}`}
          tone="success"
          explain="Sum of amount_released across every fund_releases row with status Released."
        />
        <StatCard
          label="Releases Logged"
          value={releaseHistory.length}
          explain="Total number of Released fund_releases rows."
        />
        <StatCard
          label="Awaiting Release"
          value={dueCount}
          tone="warning"
          explain="Active, verified grantees whose next payout period is Due but hasn't been released yet."
        />
        <StatCard
          label="Scholarships with Grantees"
          value={activeScholarshipCount}
          explain="Distinct scholarships that currently have at least one grantee."
        />
      </div>

      <div className={s.tabRow}>
        <button
          className={tab === "schedules" ? s.tabActive : s.tab}
          onClick={() => { setTab("schedules"); setPage(1); }}
        >
          Payout Schedules
        </button>
        <button
          className={tab === "history" ? s.tabActive : s.tab}
          onClick={() => { setTab("history"); setPage(1); }}
        >
          Release History
        </button>
      </div>

      <SearchFilterBar
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder={tab === "schedules" ? "Search by student, school ID, or scholarship…" : "Search released payouts…"}
        resultCount={activeRows.length}
        totalCount={tab === "schedules" ? rows.length : releaseHistory.length}
        filters={[
          {
            label: "Scholarship",
            value: scholarshipFilter,
            onChange: (v) => { setScholarshipFilter(v); setPage(1); },
            options: scholarshipOptions.map(o => ({ value: o, label: o === "All" ? "All Scholarships" : o })),
            width: 220,
          },
          ...(tab === "schedules" ? [{
            label: "Status",
            value: statusFilter,
            onChange: (v) => { setStatusFilter(v); setPage(1); },
            options: [
              { value: "All", label: "All Status" },
              { value: "Active", label: "Active" },
              { value: "Inactive", label: "Inactive" },
              { value: "Pending", label: "Pending" },
            ],
          }] : []),
        ]}
      />

      {tab === "schedules" ? (
        <div className={s.tableContainer}>
          <table className={s.table}>
            <thead className={s.thead}>
              <tr>
                <th className={s.th}>Student</th>
                <th className={s.th}>School ID</th>
                <th className={s.th}>Scholarship</th>
                <th className={s.th}>Progress</th>
                <th className={s.th}>Last Release</th>
                <th className={s.th}>Status</th>
                <th className={s.th}>Schedule</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding: "14px 16px" }}><TableSkeleton columns={7} rows={6} /></td></tr>
              ) : currentRows.length === 0 ? (
                <tr><td colSpan={7} className={s.emptyState}>No grantees found.</td></tr>
              ) : currentRows.map(g => {
                const scholarship = g.scholarships || {};
                const latest = latestRelease(g);
                const fullyPaid = isFullyPaidOut(g, scholarship);
                const eligible = isEligible(g);
                const dueNow = eligible && buildSchedule(g, scholarship).some(p => p.status === "Due");

                return (
                  <tr key={g.grantee_id}>
                    <td className={s.td}>{g.students?.users?.first_name} {g.students?.users?.last_name}</td>
                    <td className={s.td}>{g.students?.school_id || "—"}</td>
                    <td className={s.td}>{scholarship.scholarship_name || "—"}</td>
                    <td className={s.td}>{payoutProgressLabel(g, scholarship)}</td>
                    <td className={s.td}>{latest ? latest.release_date : "—"}</td>
                    <td className={s.td}>
                      <span className={
                        !eligible ? s.badgeNeutral
                        : fullyPaid ? s.badgeSuccess
                        : dueNow ? s.badgeWarning
                        : s.badgeNeutral
                      }>
                        {!eligible ? g.verification_result : fullyPaid ? "Fully Paid" : dueNow ? "Due" : "On Schedule"}
                      </span>
                    </td>
                    <td className={s.td}>
                      <button className={s.viewBtn} onClick={() => setSelectedGrantee(g)}>View</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={s.tableContainer}>
          <table className={s.table}>
            <thead className={s.thead}>
              <tr>
                <th className={s.th}>Student</th>
                <th className={s.th}>School ID</th>
                <th className={s.th}>Scholarship</th>
                <th className={s.th}>Period</th>
                <th className={s.th}>Amount</th>
                <th className={s.th}>Release Date</th>
                <th className={s.th}>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding: "14px 16px" }}><TableSkeleton columns={7} rows={6} /></td></tr>
              ) : currentRows.length === 0 ? (
                <tr><td colSpan={7} className={s.emptyState}>No releases logged yet.</td></tr>
              ) : currentRows.map(r => (
                <tr key={r.release_id}>
                  <td className={s.td}>{r.student || "—"}</td>
                  <td className={s.td}>{r.schoolId || "—"}</td>
                  <td className={s.td}>{r.scholarship || "—"}</td>
                  <td className={s.td}>
                    {r.academic_year || "—"}{r.semester ? ` · ${r.semester}` : ""}{r.payout_period && r.payout_period !== "One-time" ? ` · ${r.payout_period}` : ""}
                  </td>
                  <td className={s.money}>₱{Number(r.amount_released || 0).toLocaleString()}</td>
                  <td className={s.td}>{r.release_date || "—"}</td>
                  <td className={s.td}>{r.remarks || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className={s.pagination}>
        <button disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
        <span>Page {page} of {totalPages || 1}</span>
        <button disabled={page === totalPages || totalPages === 0} onClick={() => setPage(page + 1)}>Next</button>
      </div>

      {/* ================= READ-ONLY SCHEDULE MODAL ================= */}
      {selectedGrantee && (
        <div className={s.overlay} onClick={(e) => e.target === e.currentTarget && setSelectedGrantee(null)}>
          <div className={s.modalLarge}>
            <div className={s.modalHeader}>
              <div>
                <h2 className={s.modalTitle}>Payout Schedule</h2>
                <p className={s.modalSubtitle}>
                  {selectedGrantee.students?.users?.first_name} {selectedGrantee.students?.users?.last_name}
                  {" "}· {selectedGrantee.scholarships?.scholarship_name || "—"}
                  {" "}· {payoutProgressLabel(selectedGrantee, selectedGrantee.scholarships || {})}
                </p>
              </div>
              <button className={s.closeBtn} onClick={() => setSelectedGrantee(null)}>Close</button>
            </div>

            <div className={s.modalBody}>
              {selectedGrantee.status === "Inactive" && selectedGrantee.termination_reason && (
                <p className={s.periodHint}>
                  This grantee's scholarship was discontinued — <strong>{selectedGrantee.termination_reason}</strong>.
                </p>
              )}
              {Number(selectedGrantee.duration_extension_semesters) > 0 && (
                <p className={s.periodHint}>
                  Approved extension of {selectedGrantee.duration_extension_semesters} extra semester
                  {Number(selectedGrantee.duration_extension_semesters) === 1 ? "" : "s"}
                  {selectedGrantee.extension_reason ? ` — ${selectedGrantee.extension_reason}` : ""}.
                </p>
              )}

              <div className={s.tableWrap}>
                <table className={s.table}>
                  <thead className={s.thead}>
                    <tr>
                      <th className={s.th}>Period</th>
                      <th className={s.th}>Status</th>
                      <th className={s.th}>Release Date</th>
                      <th className={s.th}>Amount</th>
                      <th className={s.th}>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buildSchedule(selectedGrantee, selectedGrantee.scholarships || {}).map((period, idx) => (
                      <tr key={idx}>
                        <td className={s.td}>{period.label}</td>
                        <td className={s.td}>
                          <span className={
                            period.status === "Paid" ? s.badgeSuccess
                            : period.status === "Due" ? s.badgeWarning
                            : period.status === "Skipped" ? s.badgeNeutral
                            : period.status === "Discontinued" ? s.badgeDanger
                            : s.badgeNeutral
                          }>
                            {period.status}
                          </span>
                        </td>
                        <td className={s.td}>{period.release?.release_date || "—"}</td>
                        <td className={s.money}>
                          {period.release ? `₱${Number(period.release.amount_released || 0).toLocaleString()}` : "—"}
                        </td>
                        <td className={s.td}>{period.release?.remarks || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
