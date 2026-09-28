import { Link } from "react-router-dom";
import st from "./StatCard.module.css";
import InfoTooltip from "./InfoTooltip";

/**
 * A single dashboard metric card. Hover (or focus, for keyboard users) the
 * info icon to see exactly how the number was calculated — every dashboard
 * uses this same component so the explanation always looks and behaves
 * the same way.
 *
 * Props:
 *  - label:   short metric name, e.g. "Acceptance Rate"
 *  - value:   the number/string to display big
 *  - explain: plain-language description of how `value` was derived
 *  - to:      optional route — makes the whole card a link to that page
 *  - onClick: optional handler (for in-page actions); ignored when `to` is set
 *  - hint:    short "where this goes" text, e.g. "Grantees" (shown next to the arrow)
 *
 * Every card renders identically on purpose — one value color, one
 * label color — so the KPI rows look the same on every page. (There is
 * intentionally no per-card color/tone prop.)
 */
export default function StatCard({ label, value, explain, to, onClick, hint }) {
  const clickable = Boolean(to || onClick);
  const aria = hint ? `${label} — go to ${hint}` : `${label} — view details`;

  return (
    <div className={`${st.card} ${clickable ? st.clickable : ""}`}>
      {to && <Link to={to} className={st.cardLink} aria-label={aria} />}
      {!to && onClick && (
        <span
          role="link"
          tabIndex={0}
          className={st.cardLink}
          aria-label={aria}
          onClick={onClick}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(e); }
          }}
        />
      )}

      <h2 className={st.value}>{value}</h2>
      <div className={st.top}>
        <p className={st.label}>{label}</p>
        {explain && (
          <span className={st.infoSlot}>
            <InfoTooltip label={label}>{explain}</InfoTooltip>
          </span>
        )}
      </div>

      {clickable && (
        <span className={st.goHint} aria-hidden="true">
          {hint && <span className={st.goText}>{hint}</span>}
          <span className={st.goArrow}>→</span>
        </span>
      )}
    </div>
  );
}
