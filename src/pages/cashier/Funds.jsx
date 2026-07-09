import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import s from "./Funds.module.css";

const PAGE_SIZE = 8;

// How many "semester slots" each duration is worth. Used to derive how many
// total payouts a grantee is entitled to, combined with payout_frequency.
const DURATION_TO_SEMESTERS = {
  "1 Semester": 1,
  "1 Academic Year": 2,
  "2 Academic Years": 4,
  "3 Academic Years": 6,
  "4 Academic Years": 8,
  "Until Graduation": Infinity,
};

// Assumed academic calendar length. Adjust here if your school year runs
// differently — everything else derives from this one constant.
const MONTHS_PER_SEMESTER = 5;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * How many payouts is this scholarship entitled to release, in total,
 * for one grantee — given its duration and how often it pays out.
 * Returns Infinity for "Until Graduation" (ends only when the grantee's
 * status/verification says the scholarship should stop).
 *
 * `grantee.duration_extension_semesters` (granted by a coordinator for
 * things like "took a 5th year to graduate") adds extra semester-slots
 * before converting to the scholarship's payout frequency.
 */
function totalPayoutsAllowed(scholarship, grantee = null) {
  const base = DURATION_TO_SEMESTERS[scholarship.duration_type] ?? 1;
  if (base === Infinity) return Infinity;

  const extension = Number(grantee?.duration_extension_semesters || 0);
  const semesters = base + extension;

  switch (scholarship.payout_frequency) {
    case "One-time":
      return 1;
    case "Annual":
      return Math.max(1, Math.round(semesters / 2));
    case "Monthly":
      return semesters * MONTHS_PER_SEMESTER;
    case "Semester":
    default:
      return semesters;
  }
}

/** Unique key for a payout period, used to block duplicate releases. */
function periodKey({ academic_year, semester, payout_period }) {
  return [academic_year || "", semester || "", payout_period || ""].join("|");
}

// ── academic-year / date sequencing helpers ───────────────
// These let us AUTO-GENERATE the expected schedule of periods for a grantee
// (instead of the cashier typing AY/semester from scratch every time).

function parseAY(ay) {
  const m = /^(\d{4})\D+(\d{4})$/.exec((ay || "").trim());
  if (!m) return null;
  return [Number(m[1]), Number(m[2])];
}

function nextAY(ay) {
  const parsed = parseAY(ay);
  if (!parsed) return ay; // can't parse — leave as-is, cashier can fix manually
  return `${parsed[0] + 1}-${parsed[1] + 1}`;
}

function guessCurrentAY() {
  const now = new Date();
  const y = now.getFullYear();
  // PH academic year runs roughly June → March.
  return now.getMonth() >= 5 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

function addMonths(date, n) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

function academicYearForMonth(date) {
  const y = date.getFullYear();
  return date.getMonth() >= 5 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

/**
 * Builds the full expected payout schedule for a grantee: every period they
 * should receive money for, in order, each marked Paid / Due / Upcoming.
 * "Due" = the earliest unpaid period — this is what auto-fills the release
 * form, so a backlogged grantee always gets caught up on the OLDEST missing
 * period first, never accidentally on "today's" period.
 */
function buildSchedule(grantee, scholarship) {
  const frequency = scholarship.payout_frequency || "Semester";
  const cap = totalPayoutsAllowed(scholarship, grantee);
  const releases = grantee.fund_releases || [];
  const terminated = grantee.status === "Inactive" && grantee.verification_result === "Ineligible";

  let rawPeriods = [];

  if (frequency === "One-time") {
    rawPeriods = [{ academic_year: null, semester: null, payout_period: "One-time", label: "One-time payout" }];
  } else if (frequency === "Semester") {
    let ay = grantee.academic_year || guessCurrentAY();
    let semester = grantee.semester === "2nd Semester" ? "2nd Semester" : "1st Semester";
    const count = cap === Infinity ? Math.max(releases.length + 4, 4) : cap;
    for (let i = 0; i < count; i++) {
      rawPeriods.push({ academic_year: ay, semester, payout_period: null, label: `${ay} · ${semester}` });
      if (semester === "1st Semester") {
        semester = "2nd Semester";
      } else {
        semester = "1st Semester";
        ay = nextAY(ay);
      }
    }
  } else if (frequency === "Annual") {
    let ay = grantee.academic_year || guessCurrentAY();
    const count = cap === Infinity ? Math.max(releases.length + 4, 4) : cap;
    for (let i = 0; i < count; i++) {
      rawPeriods.push({ academic_year: ay, semester: null, payout_period: null, label: `AY ${ay}` });
      ay = nextAY(ay);
    }
  } else if (frequency === "Monthly") {
    const start = grantee.date_awarded ? new Date(grantee.date_awarded) : new Date();
    const count = cap === Infinity ? Math.max(releases.length + 4, 4) : cap;
    for (let i = 0; i < count; i++) {
      const d = addMonths(start, i);
      const month = MONTHS[d.getMonth()];
      const ay = academicYearForMonth(d);
      rawPeriods.push({ academic_year: ay, semester: null, payout_period: month, label: `${month} ${d.getFullYear()} (AY ${ay})` });
    }
  }

  const releaseMap = new Map(releases.map((r) => [periodKey(r), r]));
  let dueAssigned = false;

  return rawPeriods.map((period) => {
    const release = releaseMap.get(periodKey(period));
    let status;
    if (release?.status === "Skipped") {
      status = "Skipped";
    } else if (release) {
      status = "Paid";
    } else if (terminated) {
      // The grantee's scholarship ended — any period that never got paid
      // never will, and that's expected, not a gap to chase.
      status = "Discontinued";
    } else if (!dueAssigned) {
      status = "Due";
      dueAssigned = true;
    } else {
      status = "Upcoming";
    }
    return { ...period, status, release };
  });
}

export default function Funds() {
  const [loading, setLoading] = useState(true);
  const [scholarships, setScholarships] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [page, setPage] = useState(1);

  const [selectedScholarship, setSelectedScholarship] = useState(null);
  const [selectedGrantee, setSelectedGrantee] = useState(null);
  const [releaseModal, setReleaseModal] = useState(false);
  const [scheduleModal, setScheduleModal] = useState(false);

  // ── release form ──────────────────────────────────────────
  const [selectedPeriod, setSelectedPeriod] = useState(null); // period row chosen from the schedule
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);

  // ── skip period ───────────────────────────────────────────
  const [skipModal, setSkipModal] = useState(false);
  const [skipPeriodTarget, setSkipPeriodTarget] = useState(null);
  const [skipReason, setSkipReason] = useState("");
  const [skipping, setSkipping] = useState(false);

  useEffect(() => { loadScholarships(); }, []);

  async function loadScholarships() {
    setLoading(true);
    const { data, error } = await supabase
      .from("scholarships")
      .select(`
        scholarship_id,
        scholarship_name,
        sponsor,
        amount,
        total_budget,
        payout_frequency,
        duration_type,

        grantees(
          grantee_id,
          student_id,
          academic_year,
          semester,
          status,
          verification_result,
          termination_reason,
          date_awarded,
          duration_extension_semesters,
          extension_reason,

          students(
            student_id,
            school_id,
            users(user_id, first_name, last_name)
          ),

          fund_releases(
            release_id,
            amount_released,
            academic_year,
            semester,
            payout_period,
            release_date,
            status,
            remarks
          )
        )
      `)
      .order("scholarship_name");

    if (error) {
      console.error(error);
      setScholarships([]);
      setLoading(false);
      return [];
    }

    setScholarships(data || []);
    setLoading(false);
    return data || [];
  }

  // ── money helpers ────────────────────────────────────────
  function releasedAmount(scholarship) {
    if (!scholarship.grantees) return 0;
    return scholarship.grantees.reduce((total, grantee) => {
      const releases = grantee.fund_releases || [];
      return total + releases.reduce((sum, r) => sum + Number(r.amount_released || 0), 0);
    }, 0);
  }

  function remainingBudget(scholarship) {
    return Number(scholarship.total_budget || 0) - releasedAmount(scholarship);
  }

  function progress(scholarship) {
    const budget = Number(scholarship.total_budget || 0);
    if (budget === 0) return 0;
    return Math.min((releasedAmount(scholarship) / budget) * 100, 100);
  }

  // ── payout status helpers ────────────────────────────────
  function releasedCount(grantee) {
    return grantee.fund_releases?.length || 0;
  }

  function latestRelease(grantee) {
    if (!grantee.fund_releases?.length) return null;
    return [...grantee.fund_releases].sort(
      (a, b) => new Date(b.release_date) - new Date(a.release_date)
    )[0];
  }

  /** Is this grantee cleared to receive money at all right now? */
  function isEligible(grantee) {
    return grantee.status === "Active" && grantee.verification_result === "Verified";
  }

  function isFullyPaidOut(grantee, scholarship) {
    const cap = totalPayoutsAllowed(scholarship, grantee);
    return cap !== Infinity && releasedCount(grantee) >= cap;
  }

  function payoutProgressLabel(grantee, scholarship) {
    const cap = totalPayoutsAllowed(scholarship, grantee);
    const releases = grantee.fund_releases || [];
    const released = releases.filter((r) => r.status !== "Skipped").length;
    const skipped = releases.filter((r) => r.status === "Skipped").length;
    const skippedNote = skipped > 0 ? ` (${skipped} skipped)` : "";
    return cap === Infinity
      ? `${released} released${skippedNote} · ongoing`
      : `${released} / ${cap} released${skippedNote}`;
  }

  // ── release flow ─────────────────────────────────────────
  // Always opened with a concrete period the cashier picked from the
  // Payout Schedule table — never blank, never guessed silently.
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
    if (!selectedGrantee || !selectedScholarship || !selectedPeriod) return;

    const amount = Number(selectedScholarship.amount || 0);
    const remaining = remainingBudget(selectedScholarship);

    if (remaining < amount) {
      alert("Insufficient scholarship budget for this payout.");
      return;
    }
    if (isFullyPaidOut(selectedGrantee, selectedScholarship)) {
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
    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    const updatedScholarships = await loadScholarships();
    const updated = updatedScholarships.find(
      (sch) => sch.scholarship_id === selectedScholarship.scholarship_id
    );
    if (updated) setSelectedScholarship(updated);

    closeReleaseModal();
    alert("Payout released successfully.");
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

    const updatedScholarships = await loadScholarships();
    const updated = updatedScholarships.find(
      (sch) => sch.scholarship_id === selectedScholarship.scholarship_id
    );
    if (updated) setSelectedScholarship(updated);

    closeSkipModal();
  }

  // ── filtering / pagination ───────────────────────────────
  const filtered = useMemo(() => {
    return scholarships.filter((scholarship) => {
      const keyword = search.toLowerCase();
      const matchesSearch =
        scholarship.scholarship_name?.toLowerCase().includes(keyword) ||
        scholarship.sponsor?.toLowerCase().includes(keyword);

      let matchesFilter = true;
      if (filter === "With Budget") matchesFilter = remainingBudget(scholarship) > 0;
      if (filter === "Fully Released") matchesFilter = remainingBudget(scholarship) <= 0;

      return matchesSearch && matchesFilter;
    });
  }, [scholarships, search, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentScholarships = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalBudget = scholarships.reduce((sum, sch) => sum + Number(sch.total_budget || 0), 0);
  const totalReleased = scholarships.reduce((sum, sch) => sum + releasedAmount(sch), 0);
  const totalRemaining = totalBudget - totalReleased;

  if (loading) {
    return <div className={s.loading}>Loading scholarship funds...</div>;
  }

  return (
    <div className={s.page}>
      {/* ================= HEADER ================= */}
      <div className={s.pageHeader}>
        <div>
          <h1 className={s.pageTitle}>Funds Management</h1>
          <p className={s.pageSubtitle}>
            Release payouts by academic period, respecting each scholarship's frequency and duration.
          </p>
        </div>
      </div>

      {/* ================= SUMMARY ================= */}
      <div className={s.statsGrid}>
        <div className={s.statCard}>
          <span>Total Budget</span>
          <strong>₱{totalBudget.toLocaleString()}</strong>
        </div>
        <div className={s.statCard}>
          <span>Total Released</span>
          <strong className={s.successText}>₱{totalReleased.toLocaleString()}</strong>
        </div>
        <div className={s.statCard}>
          <span>Remaining Budget</span>
          <strong className={s.primaryText}>₱{totalRemaining.toLocaleString()}</strong>
        </div>
        <div className={s.statCard}>
          <span>Scholarships</span>
          <strong>{scholarships.length}</strong>
        </div>
      </div>

      {/* ================= FILTER BAR ================= */}
      <div className={s.filterBar}>
        <input
          className={s.searchInput}
          type="text"
          placeholder="Search scholarship or sponsor..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select
          className={s.filterSelect}
          value={filter}
          onChange={(e) => { setFilter(e.target.value); setPage(1); }}
        >
          <option value="All">All</option>
          <option value="With Budget">With Budget</option>
          <option value="Fully Released">Fully Released</option>
        </select>
      </div>

      {/* ================= SCHOLARSHIP TABLE ================= */}
      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead className={s.thead}>
            <tr>
              <th className={s.th}>Scholarship</th>
              <th className={s.th}>Sponsor</th>
              <th className={s.th}>Frequency</th>
              <th className={s.th}>Duration</th>
              <th className={s.th}>Budget</th>
              <th className={s.th}>Released</th>
              <th className={s.th}>Remaining</th>
              <th className={s.th}>Grantees</th>
              <th className={s.th}>Progress</th>
              <th className={s.th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {currentScholarships.length === 0 ? (
              <tr><td colSpan={10} className={s.emptyState}>No scholarship funds found.</td></tr>
            ) : (
              currentScholarships.map((scholarship) => {
                const remaining = remainingBudget(scholarship);
                return (
                  <tr key={scholarship.scholarship_id}>
                    <td className={s.nameCell}><strong>{scholarship.scholarship_name}</strong></td>
                    <td className={s.td}>{scholarship.sponsor}</td>
                    <td className={s.td}>{scholarship.payout_frequency || "—"}</td>
                    <td className={s.td}>{scholarship.duration_type || "—"}</td>
                    <td className={s.money}>₱{Number(scholarship.total_budget || 0).toLocaleString()}</td>
                    <td className={s.moneyReleased}>₱{releasedAmount(scholarship).toLocaleString()}</td>
                    <td className={remaining <= 0 ? s.moneyDanger : s.moneyRemaining}>
                      ₱{remaining.toLocaleString()}
                    </td>
                    <td className={s.td}>{scholarship.grantees?.length || 0}</td>
                    <td className={s.td}>
                      <div className={s.progressMini}>
                        <div className={s.progressMiniFill} style={{ width: `${progress(scholarship)}%` }} />
                      </div>
                    </td>
                    <td className={s.td}>
                      <button className={s.viewBtn} onClick={() => setSelectedScholarship(scholarship)}>
                        View
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ================= PAGINATION ================= */}
      <div className={s.pagination}>
        <span className={s.pageInfo}>Page {page} of {totalPages}</span>
        <div className={s.pageButtons}>
          <button className={s.pageBtn} disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <button className={s.pageBtn} disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      </div>

      {/* ================= SCHOLARSHIP DETAILS MODAL ================= */}
      {selectedScholarship && (
        <div className={s.overlay} onClick={(e) => e.target === e.currentTarget && setSelectedScholarship(null)}>
          <div className={s.modalLarge}>
            <div className={s.modalHeader}>
              <div>
                <h2 className={s.modalTitle}>{selectedScholarship.scholarship_name}</h2>
                <p className={s.modalSubtitle}>
                  Sponsored by {selectedScholarship.sponsor} · {selectedScholarship.payout_frequency || "—"} payouts,
                  {" "}{selectedScholarship.duration_type || "—"}
                </p>
              </div>
              <button className={s.closeBtn} onClick={() => setSelectedScholarship(null)}>Close</button>
            </div>

            <div className={s.modalBody}>
              <div className={s.modalStats}>
                <div className={s.statMini}>
                  <span>Budget</span>
                  <strong>₱{Number(selectedScholarship.total_budget || 0).toLocaleString()}</strong>
                </div>
                <div className={s.statMini}>
                  <span>Released</span>
                  <strong className={s.successText}>₱{releasedAmount(selectedScholarship).toLocaleString()}</strong>
                </div>
                <div className={s.statMini}>
                  <span>Remaining</span>
                  <strong className={s.primaryText}>₱{remainingBudget(selectedScholarship).toLocaleString()}</strong>
                </div>
                <div className={s.statMini}>
                  <span>Recipients</span>
                  <strong>{selectedScholarship.grantees?.length || 0}</strong>
                </div>
              </div>

              <div className={s.progressSection}>
                <div className={s.progressHeader}>
                  <span>Budget Utilization</span>
                  <strong>{progress(selectedScholarship).toFixed(1)}%</strong>
                </div>
                <div className={s.progressBar}>
                  <div className={s.progressFill} style={{ width: `${progress(selectedScholarship)}%` }} />
                </div>
              </div>

              <div className={s.tableWrap}>
                <table className={s.table}>
                  <thead className={s.thead}>
                    <tr>
                      <th className={s.th}>Student</th>
                      <th className={s.th}>School ID</th>
                      <th className={s.th}>Verification</th>
                      <th className={s.th}>Payouts</th>
                      <th className={s.th}>Last Release</th>
                      <th className={s.th}>Amount</th>
                      <th className={s.th}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedScholarship.grantees?.length === 0 ? (
                      <tr><td colSpan={7} className={s.emptyState}>No grantees assigned.</td></tr>
                    ) : (
                      selectedScholarship.grantees.map((grantee) => {
                        const latest = latestRelease(grantee);
                        const eligible = isEligible(grantee);
                        const fullyPaid = isFullyPaidOut(grantee, selectedScholarship);
                        const amount = Number(selectedScholarship.amount || 0);

                        return (
                          <tr key={grantee.grantee_id}>
                            <td className={s.studentCell}>
                              <div className={s.studentName}>
                                {grantee.students?.users?.first_name} {grantee.students?.users?.last_name}
                              </div>
                            </td>
                            <td className={s.td}>{grantee.students?.school_id}</td>
                            <td className={s.td}>
                              <span className={grantee.verification_result === "Verified" ? s.badgeSuccess : s.badgeWarning}>
                                {grantee.verification_result || "Pending Review"}
                              </span>
                            </td>
                            <td className={s.td}>{payoutProgressLabel(grantee, selectedScholarship)}</td>
                            <td className={s.td}>
                              {latest ? `${latest.release_date} (${latest.academic_year || "—"}${latest.semester ? ` · ${latest.semester}` : ""}${latest.payout_period && latest.payout_period !== "One-time" ? ` · ${latest.payout_period}` : ""})` : "—"}
                            </td>
                            <td className={s.money}>₱{amount.toLocaleString()}</td>
                            <td className={s.actionCell}>
                              <div className={s.actionRow}>
                                {!eligible ? (
                                  <button className={s.btnReleased} disabled>Not Verified</button>
                                ) : (
                                  <button
                                    className={fullyPaid ? s.viewBtn : s.btnPrimary}
                                    onClick={() => { setSelectedGrantee(grantee); setScheduleModal(true); }}
                                  >
                                    {fullyPaid ? "View Schedule (Fully Paid)" : "Payout Schedule"}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= RELEASE FUND MODAL ================= */}
      {releaseModal && selectedGrantee && selectedScholarship && selectedPeriod && (
        <div className={s.overlay} onClick={(e) => e.target === e.currentTarget && closeReleaseModal()}>
          <div className={s.modal}>
            <div className={s.modalHeader}>
              <div>
                <h2 className={s.modalTitle}>Confirm Release</h2>
                <p className={s.modalSubtitle}>{payoutProgressLabel(selectedGrantee, selectedScholarship)}</p>
              </div>
              <button className={s.closeBtn} onClick={closeReleaseModal}>Close</button>
            </div>

            <div className={s.modalBody}>
              <div className={s.infoGrid}>
                <div>
                  <label>Student</label>
                  <strong>
                    {selectedGrantee.students?.users?.first_name} {selectedGrantee.students?.users?.last_name}
                  </strong>
                </div>
                <div>
                  <label>School ID</label>
                  <strong>{selectedGrantee.students?.school_id}</strong>
                </div>
                <div>
                  <label>Scholarship</label>
                  <strong>{selectedScholarship.scholarship_name}</strong>
                </div>
                <div>
                  <label>Amount</label>
                  <strong className={s.successText}>
                    ₱{Number(selectedScholarship.amount || 0).toLocaleString()}
                  </strong>
                </div>
              </div>

              <p className={s.periodHint}>
                Releasing for: <strong>{selectedPeriod.label}</strong> — picked from the payout schedule, so it's
                locked to that exact period. Go back to the schedule if this is the wrong one.
              </p>

              <div className={s.field}>
                <label>Remarks (Optional)</label>
                <textarea
                  className={s.textarea}
                  rows={3}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Enter remarks..."
                />
              </div>
            </div>

            <div className={s.modalFooter}>
              <button className={s.btnSecondary} onClick={closeReleaseModal}>Cancel</button>
              <button className={s.btnPrimary} disabled={saving} onClick={releaseFunds}>
                {saving ? "Releasing…" : "Confirm Release"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= PAYOUT SCHEDULE MODAL ================= */}
      {scheduleModal && selectedGrantee && selectedScholarship && (
        <div className={s.overlay} onClick={(e) => e.target === e.currentTarget && (setScheduleModal(false), setSelectedGrantee(null))}>
          <div className={s.modalLarge}>
            <div className={s.modalHeader}>
              <div>
                <h2 className={s.modalTitle}>Payout Schedule</h2>
                <p className={s.modalSubtitle}>
                  {selectedGrantee.students?.users?.first_name} {selectedGrantee.students?.users?.last_name} · {selectedScholarship.scholarship_name}
                  {" "}· {payoutProgressLabel(selectedGrantee, selectedScholarship)}
                </p>
              </div>
              <button className={s.closeBtn} onClick={() => { setScheduleModal(false); setSelectedGrantee(null); }}>
                Close
              </button>
            </div>

            <div className={s.modalBody}>
              {selectedGrantee.status === "Inactive" && selectedGrantee.termination_reason && (
                <p className={s.periodHint}>
                  This grantee's scholarship was discontinued — <strong>{selectedGrantee.termination_reason}</strong>.
                  Remaining periods below are marked Discontinued and can't be released.
                </p>
              )}
              {Number(selectedGrantee.duration_extension_semesters) > 0 && (
                <p className={s.periodHint}>
                  This grantee has an approved extension of {selectedGrantee.duration_extension_semesters} extra semester
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
                      <th className={s.th}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buildSchedule(selectedGrantee, selectedScholarship).map((period, idx) => {
                      const noBudget = remainingBudget(selectedScholarship) < Number(selectedScholarship.amount || 0);
                      const actionable = (period.status === "Due" || period.status === "Upcoming") && isEligible(selectedGrantee);
                      return (
                        <tr key={idx}>
                          <td className={s.td}>{period.label}</td>
                          <td className={s.td}>
                            <span
                              className={
                                period.status === "Paid" ? s.badgeSuccess
                                : period.status === "Due" ? s.badgeWarning
                                : period.status === "Skipped" ? s.badgeNeutral
                                : period.status === "Discontinued" ? s.badgeDanger
                                : s.badgeNeutral
                              }
                            >
                              {period.status}
                            </span>
                          </td>
                          <td className={s.td}>{period.release?.release_date || "—"}</td>
                          <td className={s.money}>
                            {period.status === "Paid" ? `₱${Number(period.release.amount_released).toLocaleString()}` : "—"}
                          </td>
                          <td className={s.td}>{period.release?.remarks || "—"}</td>
                          <td className={s.actionCell}>
                            {actionable && (
                              <div className={s.actionRow}>
                                <button
                                  className={s.viewBtn}
                                  disabled={noBudget}
                                  onClick={() => {
                                    setScheduleModal(false);
                                    openReleaseModal(selectedGrantee, period);
                                  }}
                                >
                                  {noBudget ? "No Budget" : "Release"}
                                </button>
                                <button
                                  className={s.historyBtn}
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

      {/* ================= SKIP PERIOD MODAL ================= */}
      {skipModal && selectedGrantee && skipPeriodTarget && (
        <div className={s.overlay} onClick={(e) => e.target === e.currentTarget && closeSkipModal()}>
          <div className={s.modal}>
            <div className={s.modalHeader}>
              <div>
                <h2 className={s.modalTitle}>Skip Period</h2>
                <p className={s.modalSubtitle}>{skipPeriodTarget.label}</p>
              </div>
              <button className={s.closeBtn} onClick={closeSkipModal}>Close</button>
            </div>

            <div className={s.modalBody}>
              <p className={s.periodHint}>
                Use this when the grantee legitimately isn't owed this period — a leave of absence, a term they
                didn't enroll in, etc. It records ₱0 for this period so the schedule moves on to the next one
                instead of staying stuck here.
              </p>
              <div className={s.field}>
                <label>Reason (required)</label>
                <textarea
                  className={s.textarea}
                  rows={3}
                  value={skipReason}
                  onChange={(e) => setSkipReason(e.target.value)}
                  placeholder="e.g. Approved leave of absence for AY 2025-2026, 2nd Semester"
                />
              </div>
            </div>

            <div className={s.modalFooter}>
              <button className={s.btnSecondary} onClick={closeSkipModal}>Cancel</button>
              <button className={s.btnPrimary} disabled={skipping} onClick={submitSkip}>
                {skipping ? "Saving…" : "Confirm Skip"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
