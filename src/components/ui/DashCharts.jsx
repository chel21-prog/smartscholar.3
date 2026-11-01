import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import styles from "./DashCharts.module.css";

/**
 * Small, dependency-free SVG charts for the dashboards. Every color is a
 * theme token (see styles/tokens.css) so light + dark mode both work.
 *
 * Palette roles (from the Orbit reference): periwinkle = primary series,
 * coral = highlight / attention, peach = in-between, ink = tracks.
 */

export const TONE = {
  blue:  "var(--teal-600)",
  deep:  "var(--navy-600)",
  coral: "var(--coral-500)",
  peach: "var(--gold-500)",
  sage:  "var(--success-600)",
  track: "var(--border-strong)",
};

/* ───────────── Panel shell ─────────────
   Pass `to` to make the whole panel a link (same pattern as StatCard): a
   stretched <Link> sits over the card, the info tooltip stays above it, and
   a "view" footer shows where it goes. */
export function Panel({ title, action, children, className = "", bodyClass = "", to, hint }) {
  return (
    <section className={`${styles.panel} ${to ? styles.clickable : ""} ${className}`}>
      {to && <Link to={to} className={styles.cardLink} aria-label={`${title}: ${hint || "view details"}`} />}
      <header className={styles.panelHead}>
        <h3 className={styles.panelTitle}>{title}</h3>
        {action && <span className={styles.actionSlot}>{action}</span>}
      </header>
      <div className={`${styles.panelBody} ${bodyClass}`}>{children}</div>
      {to && (
        <span className={styles.goFoot} aria-hidden="true">
          {hint || "View"} <span className={styles.goArrow}>→</span>
        </span>
      )}
    </section>
  );
}

/* ───────────── Bars (e.g. applications per month) ───────────── */
export function BarChart({ data, height = 240 }) {
  // Measure the container so the viewBox is 1:1 with real pixels: text stays a
  // true 11-12px at every width instead of shrinking on phones.
  const boxRef = useRef(null);
  const [W, setW] = useState(560);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const set = () => setW(Math.max(260, Math.round(el.clientWidth)));
    set();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const padL = 30, padR = 8, padT = 22, padB = 26;
  const H = height;
  const max = Math.max(1, ...data.map((d) => d.value));
  // round the axis up to a "nice" number so gridlines read cleanly
  const step = Math.max(1, Math.ceil(max / 4));
  const top = step * 4;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const slot = innerW / Math.max(1, data.length);
  const bw = Math.min(26, slot * 0.46);
  const peakIdx = data.reduce((b, d, i, a) => (d.value > a[b].value ? i : b), 0);

  return (
    <div ref={boxRef} style={{ width: "100%" }}>
    <svg className={styles.svg} width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={`Bar chart: ${data.map((d) => `${d.label} ${d.value}`).join(", ")}`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const y = padT + innerH - (innerH * i) / 4;
        return (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y} y2={y} className={styles.grid} />
            <text x={padL - 8} y={y + 3.5} textAnchor="end" className={styles.axis}>{step * i}</text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const h = (innerH * d.value) / top;
        const x = padL + slot * i + (slot - bw) / 2;
        const y = padT + innerH - h;
        const isPeak = i === peakIdx && d.value > 0;
        return (
          <g key={d.label + i}>
            <rect x={x} y={d.value ? y : padT + innerH - 2} width={bw} height={d.value ? h : 2}
              rx={bw / 2.6} fill={isPeak ? TONE.coral : TONE.blue} opacity={isPeak ? 1 : 0.9} />
            {d.value > 0 && (
              <text x={x + bw / 2} y={y - 7} textAnchor="middle"
                className={isPeak ? styles.valueStrong : styles.value}>{d.value}</text>
            )}
            <text x={x + bw / 2} y={H - 8} textAnchor="middle" className={styles.axis}>{d.label}</text>
          </g>
        );
      })}
    </svg>
    </div>
  );
}

/* ───────────── Semicircle gauge + outcome counts ─────────────
   One card for the acceptance rate AND the counts behind it, so the same
   numbers are never repeated in a second card. */
export function Gauge({ value, caption, tone = TONE.coral, outcomes = [] }) {
  const pct = Math.max(0, Math.min(100, value));
  const R = 84, cx = 110, cy = 104, SW = 18;
  const pt = (p, r = R) => {
    const a = Math.PI * (1 - p / 100);
    return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
  };
  const [ex, ey] = pt(pct);
  const ticks = Array.from({ length: 21 }, (_, i) => i * 5);
  return (
    <div className={styles.gaugeCard}>
      <div className={styles.gaugeWrap}>
        <svg className={styles.gauge} viewBox="0 0 220 124" role="img" aria-label={`${pct}% ${caption || ""}`}>
          {ticks.map((t) => {
            const [x1, y1] = pt(t, R + SW / 2 + 5);
            const [x2, y2] = pt(t, R + SW / 2 + (t % 25 === 0 ? 11 : 8));
            return <line key={t} x1={x1} y1={y1} x2={x2} y2={y2} className={styles.tick} />;
          })}
          <path d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`} fill="none"
            stroke={TONE.track} strokeWidth={SW} strokeLinecap="round" />
          {pct > 0 && (
            <path d={`M ${cx - R} ${cy} A ${R} ${R} 0 ${pct > 50 ? 1 : 0} 1 ${ex} ${ey}`} fill="none"
              stroke={tone} strokeWidth={SW} strokeLinecap="round" />
          )}
        </svg>
        <div className={styles.gaugeCenter}>
          <span className={styles.gaugeValue}>{pct}%</span>
          {caption && <span className={styles.gaugeCaption}>{caption}</span>}
        </div>
      </div>
      {outcomes.length > 0 && (
        <ul className={styles.outcomes}>
          {outcomes.map((o) => (
            <li key={o.label} className={styles.outcome}>
              <span className={styles.outcomeNum}><i className={styles.dot} style={{ background: o.color }} />{o.value}</span>
              <span className={styles.outcomeLabel}>{o.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ───────────── Donut with legend ───────────── */
export function Donut({ segments, centerValue, centerLabel }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const R = 52, SW = 20, C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className={styles.donutWrap}>
      <div className={styles.donutBox}>
        <svg className={styles.donut} viewBox="0 0 140 140" role="img"
          aria-label={segments.map((s) => `${s.label} ${s.value}`).join(", ")}>
          <circle cx="70" cy="70" r={R} fill="none" stroke={TONE.track} strokeWidth={SW} />
          {total > 0 && segments.map((s) => {
            const len = (s.value / total) * C;
            const el = s.value > 0 && (
              <circle key={s.label} cx="70" cy="70" r={R} fill="none" stroke={s.color} strokeWidth={SW}
                strokeDasharray={`${Math.max(len - 3, 0.5)} ${C}`} strokeDashoffset={-acc}
                transform="rotate(-90 70 70)" strokeLinecap="butt" />
            );
            acc += len;
            return el;
          })}
        </svg>
        <div className={styles.donutCenter}>
          <span className={styles.donutValue}>{centerValue}</span>
          <span className={styles.donutLabel}>{centerLabel}</span>
        </div>
      </div>
      <ul className={styles.legend}>
        {segments.map((s) => (
          <li key={s.label} className={styles.legendRow}>
            <span className={styles.dot} style={{ background: s.color }} />
            <span className={styles.legendLabel}>{s.label}</span>
            <strong className={styles.legendValue}>{s.value}</strong>
            <span className={styles.legendPct}>{total ? Math.round((s.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ───────────── Labelled progress rows (slot usage) ───────────── */
export function MeterRow({ label, value, max }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const color = value >= max && max > 0 ? TONE.coral : pct >= 80 ? TONE.peach : TONE.blue;
  return (
    <div className={styles.meter}>
      <div className={styles.meterTop}>
        <span className={styles.meterLabel} title={label}>{label}</span>
        <span className={styles.meterNums}>{value}<span className={styles.meterMax}>/{max}</span></span>
      </div>
      <div className={styles.meterTrack} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label}>
        <div className={styles.meterFill} style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

/* ───────────── Status pill ───────────── */
export function StatusPill({ status }) {
  const tone =
    status === "Approved" ? "ok" :
    status === "Rejected" ? "bad" :
    status === "Pending"  ? "warn" : "neutral";
  return <span className={`${styles.pill} ${styles["pill_" + tone]}`}><i />{status}</span>;
}

/* ───────────── Recent-activity table ───────────── */
export function ActivityTable({ rows }) {
  if (!rows.length) return <p className={styles.empty}>No applications yet.</p>;
  return (
    <div className={styles.rows}>
      <div className={`${styles.row} ${styles.rowHead}`}>
        <span>Student</span><span className={styles.cellMuted}>Scholarship</span>
        <span className={styles.cellDate}>Date</span><span>Status</span>
      </div>
      {rows.map((r) => (
        <div key={r.id} className={styles.row}>
          <span className={styles.cellStrong} title={r.name}>{r.name || "—"}</span>
          <span className={styles.cellMuted} title={r.scholarship}>{r.scholarship || "—"}</span>
          <span className={styles.cellDate}>{r.date}</span>
          <StatusPill status={r.status} />
        </div>
      ))}
    </div>
  );
}

/* ───────────── Upcoming deadlines ───────────── */
export function DeadlineList({ items }) {
  if (!items.length) return <p className={styles.empty}>No upcoming deadlines.</p>;
  return (
    <div className={styles.rows}>
      {items.map((d, i) => (
        <div key={i} className={styles.deadline}>
          <span className={styles.deadlineName} title={d.name}>
            {d.name}
            <span className={styles.deadlineSub}>{d.dateLabel}</span>
          </span>
          <span className={`${styles.pill} ${styles["pill_" + d.tone]}`}><i />{d.left}</span>
        </div>
      ))}
    </div>
  );
}

/* ───────────── Compact empty hint for charts ───────────── */
export function EmptyHint({ children }) {
  return <p className={styles.empty}>{children}</p>;
}
