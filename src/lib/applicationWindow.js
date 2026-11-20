/**
 * Is a scholarship taking applications right now?
 *
 * Open = status "Active" AND (no deadline OR the deadline hasn't passed).
 * A scholarship with no submission_deadline stays open until the coordinator
 * closes it. The deadline day itself still counts as open; it closes the
 * next day. Nothing is written to the database when a deadline passes, so
 * this never needs a scheduled job: reopening is just setting a new
 * deadline (or clearing it for "no deadline").
 */

/** Today as YYYY-MM-DD in the user's own timezone (string compare is safe for ISO dates). */
export function todayISO(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isPastDeadline(scholarship, now = new Date()) {
  const dl = scholarship?.submission_deadline;
  return Boolean(dl) && String(dl).slice(0, 10) < todayISO(now);
}

/** { open, reason: null | "deadline" | "status", label } */
export function applicationWindow(scholarship, now = new Date()) {
  if (!scholarship) return { open: false, reason: "status", label: "Not available" };
  if (scholarship.status && scholarship.status !== "Active") {
    return { open: false, reason: "status", label: "Not accepting applications" };
  }
  if (isPastDeadline(scholarship, now)) {
    return { open: false, reason: "deadline", label: `Closed on ${String(scholarship.submission_deadline).slice(0, 10)}` };
  }
  return { open: true, reason: null, label: scholarship.submission_deadline ? `Due ${String(scholarship.submission_deadline).slice(0, 10)}` : "No deadline" };
}
