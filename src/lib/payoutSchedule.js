// Shared by cashier/Funds.jsx and cashier/Grantees.jsx — both pages let a
// cashier release scholarship payouts, so the schedule-building logic
// lives here once instead of being copy-pasted (and drifting) between them.

// How many "semester slots" each duration is worth. Used to derive how many
// total payouts a grantee is entitled to, combined with payout_frequency.
export const DURATION_TO_SEMESTERS = {
  "1 Semester": 1,
  "1 Academic Year": 2,
  "2 Academic Years": 4,
  "3 Academic Years": 6,
  "4 Academic Years": 8,
  "Until Graduation": Infinity,
};

// Assumed academic calendar length. Adjust here if your school year runs
// differently — everything else derives from this one constant.
export const MONTHS_PER_SEMESTER = 5;

export const MONTHS = [
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
export function totalPayoutsAllowed(scholarship, grantee = null) {
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
export function periodKey({ academic_year, semester, payout_period }) {
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
export function buildSchedule(grantee, scholarship) {
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

/** Is this grantee cleared to receive money at all right now? */
export function isEligible(grantee) {
  return grantee.status === "Active" && grantee.verification_result === "Verified";
}

export function isFullyPaidOut(grantee, scholarship) {
  const cap = totalPayoutsAllowed(scholarship, grantee);
  return cap !== Infinity && (grantee.fund_releases?.length || 0) >= cap;
}

export function payoutProgressLabel(grantee, scholarship) {
  const cap = totalPayoutsAllowed(scholarship, grantee);
  const releases = grantee.fund_releases || [];
  const released = releases.filter((r) => r.status !== "Skipped").length;
  const skipped = releases.filter((r) => r.status === "Skipped").length;
  const skippedNote = skipped > 0 ? ` (${skipped} skipped)` : "";
  return cap === Infinity
    ? `${released} released${skippedNote} · ongoing`
    : `${released} / ${cap} released${skippedNote}`;
}

export function latestRelease(grantee) {
  if (!grantee.fund_releases?.length) return null;
  return [...grantee.fund_releases].sort(
    (a, b) => new Date(b.release_date) - new Date(a.release_date)
  )[0];
}
