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
 *  - color:  optional CSS color for the value text
 *  - tone:   optional preset tone ("success" | "warning" | "danger" | "info")
 */
export default function StatCard({ label, value, explain, color, tone }) {
  const toneClass = tone ? st[`tone-${tone}`] : "";

  return (
    <div className={st.card}>
      <div className={st.top}>
        <p className={st.label}>{label}</p>
        {explain && <InfoTooltip label={label}>{explain}</InfoTooltip>}
      </div>
      <h2 className={`${st.value} ${toneClass}`} style={color ? { color } : undefined}>
        {value}
      </h2>
    </div>
  );
}
