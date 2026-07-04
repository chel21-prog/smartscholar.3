import styles from "./ui.module.css";

/**
 * Lightweight styled wrapper around a native <table>.
 * Callers still write their own <thead>/<tbody> markup (keeps this
 * flexible for the grouped/nested rows some pages need) but get
 * consistent header styling, zebra striping, and horizontal scroll
 * on narrow viewports for free.
 */
export function TableWrap({ children }) {
  return <div className={styles.tableWrap}>{children}</div>;
}

export function Table({ children, ...rest }) {
  return (
    <table className={styles.table} {...rest}>
      {children}
    </table>
  );
}
