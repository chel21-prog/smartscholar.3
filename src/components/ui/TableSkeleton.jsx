import sk from "./TableSkeleton.module.css";

/**
 * Shimmering placeholder rows for a table's first-ever load. Used instead
 * of a blank page or a spinner that hides the whole layout — the header
 * and toolbar stay visible, only the row area shows this.
 */
export default function TableSkeleton({ columns = 6, rows = 6 }) {
  return (
    <div className={sk.wrap} aria-hidden="true">
      {Array.from({ length: rows }).map((_, r) => (
        <div className={sk.row} key={r}>
          {Array.from({ length: columns }).map((__, c) => (
            <div className={sk.cell} key={c} style={{ animationDelay: `${(r * columns + c) * 0.02}s` }} />
          ))}
        </div>
      ))}
    </div>
  );
}
