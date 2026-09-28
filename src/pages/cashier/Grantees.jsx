import Icon from "@/components/ui/Icon";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import SearchFilterBar from "@/components/ui/SearchFilterBar";
import StatCard from "@/components/ui/StatCard";
import TableSkeleton from "@/components/ui/TableSkeleton";
import Button from "@/components/ui/Button";
import { getCached, setCached } from "@/lib/dataCache";
import { useToast } from "@/context/ToastContext";
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
  const toast = useToast();
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
      console.error(error);
      toast.error("Failed to load grantees: " + error.message);
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

  // Payouts are allowed for any grantee, but when the grantee isn't cleared
  // (not Active / not Verified) we tell the cashier why so they can decide.
  function eligibilityWarning(grantee) {
    if (!grantee || isEligible(grantee)) return null;
    const parts = [];
    if (grantee.verification_result !== "Verified") {
      parts.push(`verification is "${grantee.verification_result || "Pending Review"}"`);
    }
    if (grantee.status !== "Active") {
      parts.push(`status is "${grantee.status || "Unknown"}"`);
    }
    return parts.join(" and ");
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
      toast.error("Insufficient scholarship budget for this payout.");
      return;
    }
    if (isFullyPaidOut(selectedGrantee, scholarship)) {
      toast.error("This grantee has already received every payout this scholarship allows.");
      return;
    }

    const warn = eligibilityWarning(selectedGrantee);
    const unverifiedNote = warn ? `Released while ${warn}` : "";

    const payload = {
      grantee_id: selectedGrantee.grantee_id,
      amount_released: amount,
      release_date: new Date().toISOString().split("T")[0],
      status: "Released",
      remarks: unverifiedNote ? `${remarks ? remarks + " " : ""}[${unverifiedNote}]` : remarks,
      academic_year: selectedPeriod.academic_year,
      semester: selectedPeriod.semester,
      payout_period: selectedPeriod.payout_period,
    };

    // Block releasing twice for the exact same period (defensive — the
    // schedule already hides Paid rows, but covers races/stale data).
    const existingKeys = new Set((selectedGrantee.fund_releases || []).map(periodKey));
    if (existingKeys.has(periodKey(payload))) {
      toast.error("A payout for this exact period has already been released. Refresh and pick another period.");
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("fund_releases").insert(payload);

    if (error) {
      setSaving(false);
      toast.error(error.message);
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

    toast.success("Payout recorded.");
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
      toast.error("Enter a reason (e.g. leave of absence, did not enroll that term).");
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
      toast.error(error.message);
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
    <div className={`page-shell ${s.page}`}>
      <div className={`page-header ${s.header}`}>
        <div>
          <h1 className="page-title">Grantees</h1>
          <p className="page-subtitle">Track scholarship payouts. Payments are made outside the system — record them here once released.</p>
        </div>
      </div>

      <div className={`stats-grid ${s.summaryGrid}`}>
        <StatCard
          label="Total Grantees"
          value={rows.length}
          explain="Total number of grantee records currently loaded."
        />
        <StatCard
          label="Released"
          value={releasedCount}
          explain="Grantees who have received at least one fund release."
        />
        <StatCard
          label="Pending"
          value={pendingCount}
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
              <th data-pin>Student</th>
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
              const fullyPaid = isFullyPaidOut(grantee, scholarship);

              return (
                <tr key={grantee.grantee_id}>
                  <td data-pin>{grantee.students?.users?.first_name} {grantee.students?.users?.last_name}</td>
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
                    <div className={f.actionRow}>
                      <Button size="sm" variant={fullyPaid ? "secondary" : "primary"} onClick={() => { setSelectedGrantee(grantee); setScheduleModal(true); }}>
                        {fullyPaid ? "View Schedule (Fully Paid)" : "Payout Schedule"}
                      </Button>
                    </div>
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
              <button className={f.closeBtn} onClick={() => { setScheduleModal(false); setSelectedGrantee(null); }} aria-label="Close"><Icon name="close" size={14} /></button>
            </div>

            <div className={f.modalBody}>
              <p className={f.periodHint}>
                <strong>Tracking only.</strong> SmartScholar records payouts — no money is released through the system.
                Use "Record payout" after the funds have been given to the student.
              </p>
              {eligibilityWarning(selectedGrantee) && !(selectedGrantee.status === "Inactive" && selectedGrantee.termination_reason) && (
                <p className={f.warnBanner} role="alert">
                  <strong><Icon name="alert" size={14} /> Not cleared for payout.</strong> This grantee's {eligibilityWarning(selectedGrantee)}.
                  You can still record a payout, but please confirm with the scholarship coordinator first.
                </p>
              )}
              {selectedGrantee.status === "Inactive" && selectedGrantee.termination_reason && (
                <p className={f.periodHint}>
                  This grantee's scholarship was discontinued — <strong>{selectedGrantee.termination_reason}</strong>.
                  Remaining periods below are marked Discontinued and can't be recorded.
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
                      <th data-pin className={f.th}>Period</th>
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
                      const actionable = (period.status === "Due" || period.status === "Upcoming");
                      return (
                        <tr key={idx}>
                          <td data-pin className={f.td}>{period.label}</td>
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
                          <td className={`${f.td} ${f.money}`}>
                            {period.status === "Paid" ? `₱${Number(period.release.amount_released).toLocaleString()}` : "—"}
                          </td>
                          <td className={`${f.td} ${f.colOptional}`}>{period.release?.remarks || "—"}</td>
                          <td className={f.actionCell}>
                            {actionable && (
                              <div className={f.actionRow}>
                                <Button size="sm" variant="primary" disabled={noBudget}
                                  onClick={() => {
                                    setScheduleModal(false);
                                    openReleaseModal(selectedGrantee, period);
                                  }}
                                >
                                  {noBudget ? "No Budget" : "Record payout"}
                                </Button>
                                <Button size="sm" variant="secondary"
                                  onClick={() => openSkipModal(selectedGrantee, period)}
                                >
                                  Skip
                                </Button>
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
                <h2 className={f.modalTitle}>Record Payout</h2>
                <p className={f.modalSubtitle}>{payoutProgressLabel(selectedGrantee, selectedGrantee.scholarships || {})}</p>
              </div>
              <button className={f.closeBtn} onClick={closeReleaseModal} aria-label="Close"><Icon name="close" size={14} /></button>
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

              {eligibilityWarning(selectedGrantee) && (
                <p className={f.warnBanner} role="alert">
                  <strong><Icon name="alert" size={14} /> Heads up:</strong> this grantee's {eligibilityWarning(selectedGrantee)}. Recording it now is allowed, and a
                  note will be added to the payout remarks.
                </p>
              )}

              <p className={f.periodHint}>
                <strong>Tracking only.</strong> This records the payout in SmartScholar — no money is sent through the
                system. Confirm only after the funds have actually been handed over to the student.
              </p>

              <p className={f.periodHint}>
                Recording payout for: <strong>{selectedPeriod.label}</strong> — picked from the payout schedule, so it's
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
                {saving ? "Saving…" : "Record Payout"}
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
              <button className={f.closeBtn} onClick={closeSkipModal} aria-label="Close"><Icon name="close" size={14} /></button>
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
