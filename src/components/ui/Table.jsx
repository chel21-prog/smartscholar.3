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

/**
 * Row of action buttons for an "Action" cell. Use with the shared
 * <Button size="sm"> so every table's actions look identical:
 *   primary   — the main forward action (Approve, Release, Apply, Verify)
 *   secondary — view/edit style actions (View, Edit, Export, Skip)
 *   danger    — destructive actions (Reject)
 *   ghost     — disabled/informational (Inactive, Not Verified)
 */
export function TableActions({ children }) {
  return <div className={styles.tableActions}>{children}</div>;
}
