import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import st from "./StatCard.module.css";

/**
 * Small "i" icon that reveals an explanation on hover/focus. Used next to
 * dashboard numbers and section headers so people can see exactly how a
 * figure was derived, without cluttering the layout.
 *
 * The bubble is rendered in a portal on <body> and positioned against the
 * viewport, so it can never be clipped or covered by the sidebar, the
 * search/filter bar, or a card's own stacking context. It also stays
 * inside the screen (and to the right of the sidebar) automatically.
 */
export default function InfoTooltip({ label, children, align = "right" }) {
  const wrapRef = useRef(null);
  const tipRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, arrow: 12, above: false, ready: false });

  const place = useCallback(() => {
    const wrap = wrapRef.current;
    const tip = tipRef.current;
    if (!wrap || !tip) return;

    const r = wrap.getBoundingClientRect();
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    const margin = 8;

    // keep clear of the desktop sidebar (on mobile it sits off-screen, so right <= 0)
    const side = document.querySelector("aside")?.getBoundingClientRect();
    const minLeft = side && side.width > 0 && side.right > 0 ? side.right + margin : margin;

    let left = align === "left" ? r.left - 6 : r.right + 6 - tw;
    left = Math.max(minLeft, Math.min(left, window.innerWidth - tw - margin));

    let top = r.bottom + 8;
    let above = false;
    if (top + th > window.innerHeight - margin && r.top - 8 - th > margin) {
      top = r.top - 8 - th;
      above = true;
    }

    const arrow = Math.max(10, Math.min(r.left + r.width / 2 - left - 6, tw - 22));
    setPos({ top, left, arrow, above, ready: true });
  }, [align]);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return undefined;
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  const show = () => setOpen(true);
  const hide = () => { setOpen(false); setPos((p) => ({ ...p, ready: false })); };

  return (
    <span
      ref={wrapRef}
      className={st.infoWrap}
      tabIndex={0}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      <span className={st.infoIcon} aria-label={label ? `How ${label} is calculated` : "How this is calculated"}>i</span>
      {open && createPortal(
        <span
          ref={tipRef}
          className={`${st.tooltip} ${pos.above ? st.tooltipAbove : ""}`}
          role="tooltip"
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            right: "auto",
            zIndex: 2000,
            opacity: pos.ready ? 1 : 0,
            transform: "none",
            "--arrow-left": `${pos.arrow}px`,
          }}
        >
          <span className={st.tooltipHead}>How this is calculated</span>
          {children}
        </span>,
        document.body
      )}
    </span>
  );
}
