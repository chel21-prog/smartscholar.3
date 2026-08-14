import st from "./StatCard.module.css";

/**
 * Small "i" icon that reveals an explanation on hover/focus. Used next to
 * dashboard numbers and section headers so people can see exactly how a
 * figure was derived, without cluttering the layout.
 */
export default function InfoTooltip({ label, children, align = "right" }) {
  return (
    <span className={st.infoWrap} tabIndex={0}>
      <span className={st.infoIcon} aria-label={label ? `How ${label} is calculated` : "How this is calculated"}>i</span>
      <span className={st.tooltip} role="tooltip" style={align === "left" ? { right: "auto", left: -6 } : undefined}>
        <span className={st.tooltipHead}>How this is calculated</span>
        {children}
      </span>
    </span>
  );
}
