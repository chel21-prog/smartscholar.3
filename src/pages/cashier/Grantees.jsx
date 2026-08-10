import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import SearchFilterBar from "@/components/ui/SearchFilterBar";
import StatCard from "@/components/ui/StatCard";
import TableSkeleton from "@/components/ui/TableSkeleton";
import { getCached, setCached } from "@/lib/dataCache";
import {
  buildSchedule, periodKey, isEligible, isFullyPaidOut,
  payoutProgressLabel, latestRelease,
} from "@/lib/payoutSchedule";
import s from "./Grantees.module.css";
// Payout-schedule / release / skip modals reuse the same look as the
// Funds page — importing its module here keeps the two visually and
// behaviorally identical instead of drifting into two different designs.
import f from "./Funds.module.css";

const PAGE_SIZE = 10;
const CACHE_KEY = "cashier-grantees";

export default function Grantees() {
  const cachedRows = getCached(CACHE_KEY);
  const [loading, setLoading] = useState(!cachedRows);
  const [rows, setRows] = useState(cachedRows || []);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [scholarshipFilter, setScholarshipFilter] = useState("All");
  const [page, setPage] = useState(1);

  // ── payout schedule / release / skip modals ───────────────
  const [selectedGrantee, setSelectedGrantee] = useState(null);
  const [scheduleModal, setScheduleModal] = useState(false);

  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [releaseModal, setReleaseModal] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);

  const [skipModal, setSkipModal] = useState(false);
  const [skipPeriodTarget, setSkipPeriodTarget] = useState(null);
  const [skipReason, setSkipReason] = useState("");
  const [skipping, setSkipping] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    if (!getCached(CACHE_KEY)) setLoading(true);

    const { data, error } = await supabase
      .from("grantees")
      .select(`
        *,
        students(
          student_id,
          school_id,
          course,
          year_level,
          users(
            user_id,
            first_name,
            last_name
          )
        ),
        scholarships(
          scholarship_id,
          scholarship_name,
          sponsor,
          amount,
          total_budget,
          payout_frequency,
          duration_type
        ),
        fund_releases(
          release_id,
          amount_released,
          release_date,
          status,
          remarks,
          academic_year,
          semester,
          payout_period
        )
      `)
      .order("grantee_id", { ascending: false });

    if (error) {
      console.log(error);
      setRows([]);
    } else {
      setRows(data || []);
      setCached(CACHE_KEY, data || []);
    }

    setLoading(false);
    return data || [];
  }

  // ── budget helpers ──────────────────────────────────────────
  // Each grantee row only carries its OWN fund_releases, so "remaining
  // budget for this scholarship" has to be summed across every grantee
  // currently loaded that shares the same scholarship_id.
  function totalReleasedForScholarship(scholarshipId) {
    return rows
      .filter((r) => r.scholarship_id === scholarshipId)
      .reduce((total, r) => total + (r.fund_releases || []).reduce(
        (sum, fr) => sum + Number(fr.amount_released || 0), 0
      ), 0);
  }

  function remainingBudgetFor(grantee) {
    const budget = Number(grantee.scholarships?.total_budget || 0);
    return budget - totalReleasedForScholarship(grantee.scholarship_id);
  }

  const scholarshipOptions = useMemo(() => {
    return ["All", ...new Set(rows.map((r) => r.scholarships?.scholarship_name).filter(Boolean))];
  }, [rows]);

  const filtered = rows.filter((row) => {
    const fullname = `${row.students?.users?.first_name || ""} ${row.students?.users?.last_name || ""}`.toLowerCase();
    const keyword = search.toLowerCase();
    const latest = latestRelease(row);

    const matchesSearch =
      fullname.includes(keyword) ||
      row.students?.school_id?.toLowerCase().includes(keyword) ||
      row.scholarships?.scholarship_name?.toLowerCase().includes(keyword) ||
      String(row.scholarships?.amount || "").includes(keyword) ||
      payoutProgressLabel(row, row.scholarships || {}).toLowerCase().includes(keyword) ||
      (latest?.release_date || "").toLowerCase().includes(keyword);

    const matchesStatus = statusFilter === "All" || row.status === statusFilter;
    const matchesScholarship = scholarshipFilter === "All" || row.scholarships?.scholarship_name === scholarshipFilter;

    return matchesSearch && matchesStatus && matchesScholarship;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── release flow — always opened with a concrete period picked from
  //    the Payout Schedule table, never blank/guessed ──────────────────
  function openReleaseModal(grantee, period) {
    setSelectedGrantee(grantee);
    setSelectedPeriod(period);
    setRemarks("");
    setReleaseModal(true);
  }

  function closeReleaseModal() {
    setReleaseModal(false);
    setSelectedGrantee(null);
    setSelectedPeriod(null);
  }

  async function releaseFunds() {
    if (!selectedGrantee || !selectedPeriod) return;
    const scholarship = selectedGrantee.scholarships || {};
    const amount = Number(scholarship.amount || 0);
    const remaining = remainingBudgetFor(selectedGrantee);

    if (remaining < amount) {
      alert("Insufficient scholarship budget for this payout.");
      return;
    }
    if (isFullyPaidOut(selectedGrantee, scholarship)) {
      alert("This grantee has already received every payout this scholarship allows.");
      return;
    }

    const payload = {
      grantee_id: selectedGrantee.grantee_id,
      amount_released: amount,
      release_date: new Date().toISOString().split("T")[0],
      status: "Released",
      remarks,
      academic_year: selectedPeriod.academic_year,
      semester: selectedPeriod.semester,
      payout_period: selectedPeriod.payout_period,
    };

    // Block releasing twice for the exact same period (defensive — the
    // schedule already hides Paid rows, but covers races/stale data).
    const existingKeys = new Set((selectedGrantee.fund_releases || []).map(periodKey));
    if (existingKeys.has(periodKey(payload))) {
      alert("A payout for this exact period has already been released. Refresh and pick another period.");
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("fund_releases").insert(payload);

    if (error) {
      setSaving(false);
      alert(error.message);
      return;
    }

    const studentUserId = selectedGrantee.students?.users?.user_id;
    if (studentUserId) {
      await supabase.from("notifications").insert({
        user_id: studentUserId,
        title: "Scholarship Released",
        message: `Your scholarship payout of ₱${amount.toLocaleString()} has been released.`,
        notification_type: "Fund Release",
      });
    }

    setSaving(false);
    const updatedRows = await load();
    const updated = updatedRows.find((r) => r.grantee_id === selectedGrantee.grantee_id);
    if (updated) setSelectedGrantee(updated);

    closeReleaseModal();
  }

  // ── skip period flow ─────────────────────────────────────
  function openSkipModal(grantee, period) {
    setSelectedGrantee(grantee);
    setSkipPeriodTarget(period);
    setSkipReason("");
    setSkipModal(true);
  }

  function closeSkipModal() {
    setSkipModal(false);
    setSkipPeriodTarget(null);
  }

  async function submitSkip() {
    if (!selectedGrantee || !skipPeriodTarget) return;
    if (!skipReason.trim()) {
      alert("Enter a reason (e.g. leave of absence, did not enroll that term).");
      return;
    }

    const payload = {
      grantee_id: selectedGrantee.grantee_id,
      amount_released: 0,
      release_date: new Date().toISOString().split("T")[0],
      status: "Skipped",
      remarks: skipReason,
      academic_year: skipPeriodTarget.academic_year,
      semester: skipPeriodTarget.semester,
      payout_period: skipPeriodTarget.payout_period,
    };

    setSkipping(true);
    const { error } = await supabase.from("fund_releases").insert(payload);
    setSkipping(false);

    if (error) {
      alert(error.message);
      return;
    }

    const updatedRows = await load();
    const updated = updatedRows.find((r) => r.grantee_id === selectedGrantee.grantee_id);
    if (updated) setSelectedGrantee(updated);

    closeSkipModal();
  }

  const releasedCount = rows.filter((g) => (g.fund_releases || []).some((fr) => fr.status === "Released")).length;
  const pendingCount = rows.length - releasedCount;

  return (
    <div className={s.page}>
      <div className={s.header}>
        <div>
          <h1>Grantees</h1>
          <p>Manage scholarship payouts and monitor released funds.</p>
        </div>
      </div>

      <div className={s.summaryGrid}>
        <StatCard
          label="Total Grantees"
          value={rows.length}
          explain="Total number of grantee records currently loaded."
        />
        <StatCard
          label="Released"
          value={releasedCount}
          tone="success"
          explain="Grantees who have received at least one fund release."
        />
        <StatCard
          label="Pending"
          value={pendingCount}
          tone="warning"
          explain="Total Grantees minus Released — grantees who haven't had a fund release yet."
        />
      </div>

      <SearchFilterBar
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search by student, school ID, scholarship, amount, status, date..."
        resultCount={filtered.length}
        totalCount={rows.length}
        filters={[
          {
            label: "Status",
            value: statusFilter,
            onChange: (v) => { setStatusFilter(v); setPage(1); },
            options: [
              { value: "All", label: "All Status" },
              { value: "Active", label: "Active" },
              { value: "Inactive", label: "Inactive" },
              { value: "Pending", label: "Pending" },
            ],
          },
          {
            label: "Scholarship",
            value: scholarshipFilter,
            onChange: (v) => { setScholarshipFilter(v); setPage(1); },
            options: scholarshipOptions.map((o) => ({ value: o, label: o === "All" ? "All Scholarships" : o })),
            width: 220,
          },
        ]}
      />

      <div className={s.tableContainer}>
        <table className={s.table}>
          <thead className={s.thead}>
            <tr>
              <th>Student</th>
              <th>School ID</th>
              <th>Scholarship</th>
              <th>Amount</th>
              <th>Payouts</th>
              <th>Last Release</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ padding: "14px 16px" }}>
                  <TableSkeleton columns={7} rows={6} />
                </td>
              </tr>
            ) : currentRows.length === 0 ? (
              <tr><td colSpan={7} className={f.emptyState}>No grantees found.</td></tr>
            ) : currentRows.map((grantee) => {
              const scholarship = grantee.scholarships || {};
              const latest = latestRelease(grantee);
              const eligible = isEligible(grantee);
              const fullyPaid = isFullyPaidOut(grantee, scholarship);

              return (
                <tr key={grantee.grantee_id}>
                  <td>{grantee.students?.users?.first_name} {grantee.students?.users?.last_name}</td>
                  <td>{grantee.students?.school_id}</td>
                  <td>{scholarship.scholarship_name || "—"}</td>
                  <td>₱{Number(scholarship.amount || 0).toLocaleString()}</td>
                  <td>{payoutProgressLabel(grantee, scholarship)}</td>
                  <td>
                    {latest
                      ? `${latest.release_date} (${latest.academic_year || "—"}${latest.semester ? ` · ${latest.semester}` : ""}${latest.payout_period && latest.payout_period !== "One-time" ? ` · ${latest.payout_period}` : ""})`
                      : "—"}
                  </td>
                  <td>
                    {!eligible ? (
                      <button className={f.btnReleased} disabled>Not Verified</button>
                    ) : (
                      <button
                        className={fullyPaid ? f.viewBtn : s.releaseBtn}
                        onClick={() => { setSelectedGrantee(grantee); setScheduleModal(true); }}
                      >
                        {fullyPaid ? "View Schedule (Fully Paid)" : "Payout Schedule"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className={s.pagination}>
        <button disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
        <span>Page {page} of {totalPages || 1}</span>
        <button disabled={page === totalPages || totalPages === 0} onClick={() => setPage(page + 1)}>Next</button>
      </div>

      {/* ================= PAYOUT SCHEDULE MODAL ================= */}
      {scheduleModal && selectedGrantee && (
        <div className={f.overlay} onClick={(e) => e.target === e.currentTarget && (setScheduleModal(false), setSelectedGrantee(null))}>
          <div className={f.modalLarge}>
            <div className={f.modalHeader}>
              <div>
                <h2 className={f.modalTitle}>Payout Schedule</h2>
                <p className={f.modalSubtitle}>
                  {selectedGrantee.students?.users?.first_name} {selectedGrantee.students?.users?.last_name}
                  {" "}· {selectedGrantee.scholarships?.scholarship_name || "—"}
                  {" "}· {payoutProgressLabel(selectedGrantee, selectedGrantee.scholarships || {})}
                </p>
              </div>
              <button className={f.closeBtn} onClick={() => { setScheduleModal(false); setSelectedGrantee(null); }}>
                Close
              </button>
            </div>

            <div className={f.modalBody}>
              {selectedGrantee.status === "Inactive" && selectedGrantee.termination_reason && (
                <p className={f.periodHint}>
                  This grantee's scholarship was discontinued — <strong>{selectedGrantee.termination_reason}</strong>.
                  Remaining periods below are marked Discontinued and can't be released.
                </p>
              )}
              {Number(selectedGrantee.duration_extension_semesters) > 0 && (
                <p className={f.periodHint}>
                  This grantee has an approved extension of {selectedGrantee.duration_extension_semesters} extra semester
                  {Number(selectedGrantee.duration_extension_semesters) === 1 ? "" : "s"}
                  {selectedGrantee.extension_reason ? ` — ${selectedGrantee.extension_reason}` : ""}.
                </p>
              )}

              <div className={f.tableWrap}>
                <table className={f.table}>
                  <thead className={f.thead}>
                    <tr>
                      <th className={f.th}>Period</th>
                      <th className={f.th}>Status</th>
                      <th className={`${f.th} ${f.colOptional}`}>Release Date</th>
                      <th className={f.th}>Amount</th>
                      <th className={`${f.th} ${f.colOptional}`}>Remarks</th>
                      <th className={f.th}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buildSchedule(selectedGrantee, selectedGrantee.scholarships || {}).map((period, idx) => {
                      const scholarship = selectedGrantee.scholarships || {};
                      const noBudget = remainingBudgetFor(selectedGrantee) < Number(scholarship.amount || 0);
                      const actionable = (period.status === "Due" || period.status === "Upcoming") && isEligible(selectedGrantee);
                      return (
                        <tr key={idx}>
                          <td className={f.td}>{period.label}</td>
                          <td className={f.td}>
                            <span
                              className={
                                period.status === "Paid" ? f.badgeSuccess
                                : period.status === "Due" ? f.badgeWarning
                                : period.status === "Skipped" ? f.badgeNeutral
                                : period.status === "Discontinued" ? f.badgeDanger
                                : f.badgeNeutral
                              }
                            >
                              {period.status}
                            </span>
                          </td>
                          <td className={`${f.td} ${f.colOptional}`}>{period.release?.release_date || "—"}</td>
                          <td className={f.money}>
                            {period.status === "Paid" ? `₱${Number(period.release.amount_released).toLocaleString()}` : "—"}
                          </td>
                          <td className={`${f.td} ${f.colOptional}`}>{period.release?.remarks || "—"}</td>
                          <td className={f.actionCell}>
                            {actionable && (
                              <div className={f.actionRow}>
                                <button
                                  className={f.viewBtn}
                                  disabled={noBudget}
                                  onClick={() => {
                                    setScheduleModal(false);
                                    openReleaseModal(selectedGrantee, period);
                                  }}
                                >
                                  {noBudget ? "No Budget" : "Release"}
                                </button>
                                <button
                                  className={f.historyBtn}
                                  onClick={() => openSkipModal(selectedGrantee, period)}
                                >
                                  Skip
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= RELEASE FUND MODAL ================= */}
      {releaseModal && selectedGrantee && selectedPeriod && (
        <div className={f.overlay} onClick={(e) => e.target === e.currentTarget && closeReleaseModal()}>
          <div className={f.modal}>
            <div className={f.modalHeader}>
              <div>
                <h2 className={f.modalTitle}>Confirm Release</h2>
                <p className={f.modalSubtitle}>{payoutProgressLabel(selectedGrantee, selectedGrantee.scholarships || {})}</p>
              </div>
              <button className={f.closeBtn} onClick={closeReleaseModal}>Close</button>
            </div>

            <div className={f.modalBody}>
              <div className={f.infoGrid}>
                <div>
                  <label>Student</label>
                  <strong>{selectedGrantee.students?.users?.first_name} {selectedGrantee.students?.users?.last_name}</strong>
                </div>
                <div>
                  <label>School ID</label>
                  <strong>{selectedGrantee.students?.school_id}</strong>
                </div>
                <div>
                  <label>Scholarship</label>
                  <strong>{selectedGrantee.scholarships?.scholarship_name}</strong>
                </div>
                <div>
                  <label>Amount</label>
                  <strong className={f.moneyReleased}>
                    ₱{Number(selectedGrantee.scholarships?.amount || 0).toLocaleString()}
                  </strong>
                </div>
              </div>

              <p className={f.periodHint}>
                Releasing for: <strong>{selectedPeriod.label}</strong> — picked from the payout schedule, so it's
                locked to that exact period. Go back to the schedule if this is the wrong one.
              </p>

              <div className={f.field}>
                <label>Remarks (Optional)</label>
                <textarea
                  className={f.textarea}
                  rows={3}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Enter remarks..."
                />
              </div>
            </div>

            <div className={f.modalFooter}>
              <button className={f.btnSecondary} onClick={closeReleaseModal}>Cancel</button>
              <button className={f.btnPrimary} disabled={saving} onClick={releaseFunds}>
                {saving ? "Releasing…" : "Confirm Release"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= SKIP PERIOD MODAL ================= */}
      {skipModal && selectedGrantee && skipPeriodTarget && (
        <div className={f.overlay} onClick={(e) => e.target === e.currentTarget && closeSkipModal()}>
          <div className={f.modal}>
            <div className={f.modalHeader}>
              <div>
                <h2 className={f.modalTitle}>Skip Period</h2>
                <p className={f.modalSubtitle}>{skipPeriodTarget.label}</p>
              </div>
              <button className={f.closeBtn} onClick={closeSkipModal}>Close</button>
            </div>

            <div className={f.modalBody}>
              <p className={f.periodHint}>
                Use this when the grantee legitimately isn't owed this period — a leave of absence, a term they
                didn't enroll in, etc. It records ₱0 for this period so the schedule moves on to the next one
                instead of staying stuck here.
              </p>
              <div className={f.field}>
                <label>Reason (required)</label>
                <textarea
                  className={f.textarea}
                  rows={3}
                  value={skipReason}
                  onChange={(e) => setSkipReason(e.target.value)}
                  placeholder="e.g. Approved leave of absence for AY 2025-2026, 2nd Semester"
                />
              </div>
            </div>

            <div className={f.modalFooter}>
              <button className={f.btnSecondary} onClick={closeSkipModal}>Cancel</button>
              <button className={f.btnPrimary} disabled={skipping} onClick={submitSkip}>
                {skipping ? "Saving…" : "Confirm Skip"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
