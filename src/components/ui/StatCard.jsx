import st from "./StatCard.module.css";
import InfoTooltip from "./InfoTooltip";

/**
 * A single dashboard metric card. Hover (or focus, for keyboard users) the
 * info icon to see exactly how the number was calculated — every dashboard
 * uses this same component so the explanation always looks and behaves
 * the same way.
 *
 * Props:
 *  - label:  short metric name, e.g. "Acceptance Rate"
 *  - value:  the number/string to display big
 *  - explain: plain-language description of how `value` was derived
 *
 * Every card renders identically on purpose — one value color, one
 * label color — so the KPI rows look the same on every page. (There is
 * intentionally no per-card color/tone prop.)
 */
export default function StatCard({ label, value, explain }) {
  return (
    <div className={st.card}>
      <h2 className={st.value}>{value}</h2>
      <div className={st.top}>
        <p className={st.label}>{label}</p>
        {explain && <InfoTooltip label={label}>{explain}</InfoTooltip>}
      </div>
    </div>
  );
}
