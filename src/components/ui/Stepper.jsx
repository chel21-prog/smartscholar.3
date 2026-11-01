import styles from "./Stepper.module.css";

/**
 * Shared step indicator for multi-step forms (Add Scholarship, Profile,
 * Apply). Presentation only: the page owns the current step and the
 * validation, and passes `canVisit(i)` so steps can't be skipped past an
 * incomplete one.
 *
 *   <Stepper steps={[{ id, label, count? }]} current="info" onStep={setStep} canVisit={(i) => true} />
 */
export default function Stepper({ steps, current, onStep, canVisit = () => true }) {
  const idx = Math.max(0, steps.findIndex((s) => s.id === current));
  const pct = steps.length > 1 ? Math.round((idx / (steps.length - 1)) * 100) : 100;
  return (
    <div className={styles.wrap}>
      <div className={styles.bar} role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={idx + 1}
        aria-label={`Step ${idx + 1} of ${steps.length}`}>
        <div className={styles.fill} style={{ width: `${pct}%` }} />
      </div>
      <ol className={styles.steps}>
        {steps.map((st, i) => {
          const state = i < idx ? "done" : i === idx ? "current" : "todo";
          const ok = i === idx || canVisit(i);
          return (
            <li key={st.id} className={styles.item}>
              <button type="button" className={`${styles.step} ${styles["s_" + state]}`} disabled={!ok}
                aria-current={i === idx ? "step" : undefined} onClick={() => onStep(st.id)}>
                <span className={styles.dot} aria-hidden="true">{state === "done" ? "✓" : i + 1}</span>
                <span className={styles.label}>{st.label}</span>
                {st.count > 0 && <span className={styles.count}>{st.count}</span>}
              </button>
            </li>
          );
        })}
      </ol>
      <span className={styles.meta}>Step {idx + 1} of {steps.length}</span>
    </div>
  );
}
