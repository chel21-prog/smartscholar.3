import { Link } from "react-router-dom";
import styles from "./ScholarshipStatus.module.css";

/**
 * "Your scholarship" banner, shown at the very top of the student dashboard
 * when the student holds a scholarship or has one in progress.
 *
 *   items: [{ kind: "active" | "application", scholarship, application? }]
 *
 * Each item is one card that links to the student's Applications page.
 * Nothing renders when the list is empty (no scholarship yet).
 */

const peso = (n) => `₱${Number(n || 0).toLocaleString()}`;

function formatDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
}

// Submitted → In review → Decision. `step` is the index currently in progress.
function stepsFor(status) {
  const s = (status || "").toLowerCase();
  if (s === "approved") return { done: 3, label: "Approved" };
  if (s === "submitted") return { done: 1, label: "Submitted" };
  return { done: 1, label: status || "Pending" }; // pending / in review: submitted, now being reviewed
}

function Steps({ status }) {
  const { done } = stepsFor(status);
  const labels = ["Submitted", "In review", "Decision"];
  return (
    <ol className={styles.steps} aria-label="Application progress">
      {labels.map((l, i) => {
        const state = i < done ? "done" : i === done ? "current" : "todo";
        return (
          <li key={l} className={`${styles.step} ${styles["step_" + state]}`}>
            <span className={styles.stepDot} aria-hidden="true">{state === "done" ? "✓" : i + 1}</span>
            <span className={styles.stepLabel}>{l}</span>
          </li>
        );
      })}
    </ol>
  );
}

export default function ScholarshipStatus({ items }) {
  if (!items?.length) return null;
  return (
    <section className={styles.wrap} aria-label="Your scholarship">
      {items.map((it, i) => {
        const sc = it.scholarship || {};
        const isActive = it.kind === "active";
        const status = isActive ? "Active scholar" : it.application?.status || "Pending";
        const tone = isActive || (status || "").toLowerCase() === "approved" ? "ok" : "warn";
        const applied = formatDate(it.application?.application_date);
        return (
          <article key={(sc.scholarship_id || "x") + "-" + i} className={`${styles.card} ${styles["card_" + tone]}`}>
            <Link to="/student/applications" className={styles.cardLink}
              aria-label={`${sc.scholarship_name || "Scholarship"} — ${status}. View my applications`} />
            <div className={styles.top}>
              <span className={styles.eyebrow}>Your scholarship</span>
              <span className={`${styles.pill} ${styles["pill_" + tone]}`}><i />{status}</span>
            </div>

            <h2 className={styles.name}>{sc.scholarship_name || "Scholarship"}</h2>
            {!isActive && applied && <p className={styles.sub}>Applied {applied}</p>}
            {isActive && sc.description && <p className={styles.sub}>{sc.description}</p>}

            <div className={styles.facts}>
              {sc.amount != null && (
                <div className={styles.fact}><span className={styles.factVal}>{peso(sc.amount)}</span><span className={styles.factLbl}>Amount</span></div>
              )}
              <div className={styles.fact}><span className={styles.factVal}>{sc.payout_frequency || "—"}</span><span className={styles.factLbl}>Payout</span></div>
              <div className={styles.fact}><span className={styles.factVal}>{sc.duration_type || "—"}</span><span className={styles.factLbl}>Duration</span></div>
            </div>

            {!isActive && <Steps status={status} />}

            <span className={styles.go} aria-hidden="true">View my applications <span className={styles.arrow}>→</span></span>
          </article>
        );
      })}
    </section>
  );
}
