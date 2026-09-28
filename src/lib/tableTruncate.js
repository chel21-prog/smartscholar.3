/**
 * Long cell text is cut off with an ellipsis by styles/tables.css
 * (single line, compact rows). This adds the other half: when the
 * pointer reaches a cell whose text is actually clipped, its full text
 * becomes the native tooltip — so nothing is ever unreadable.
 *
 * One delegated listener covers every table in the app. Cells that
 * aren't clipped (or already carry their own title) are left alone.
 */
export function initTableTruncate() {
  document.addEventListener(
    "mouseover",
    (e) => {
      const el = e.target;
      if (!(el instanceof Element)) return;

      const cell = el.closest("table:not([data-plain]) td, table:not([data-plain]) th");
      if (!cell || cell.hasAttribute("colspan")) return;

      const clipped = cell.scrollWidth > cell.clientWidth + 1;
      if (clipped) {
        if (!cell.title || cell.dataset.autoTitle) {
          cell.title = cell.textContent.replace(/\s+/g, " ").trim();
          cell.dataset.autoTitle = "1";
        }
      } else if (cell.dataset.autoTitle) {
        cell.removeAttribute("title"); // content changed / widened since
        delete cell.dataset.autoTitle;
      }
    },
    { passive: true }
  );
}
