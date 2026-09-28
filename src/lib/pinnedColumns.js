/**
 * Marks a horizontally-scrolled table container with `data-scrolled`
 * once it has actually been scrolled away from the left edge, so the
 * pinned-column shadow (styles/tables.css) only appears when content
 * is sliding underneath it — never while the table is at rest.
 *
 * One capture-phase listener covers every table in the app (scroll
 * events don't bubble, but they can be captured on the document).
 */
export function initPinnedColumns() {
  document.addEventListener(
    "scroll",
    (e) => {
      const el = e.target;
      if (!(el instanceof Element)) return;

      const scrolled = el.scrollLeft > 0;
      if (el.hasAttribute("data-scrolled") === scrolled) return; // no change

      // Only touch containers that actually hold a pinned column.
      if (scrolled && !el.querySelector("table [data-pin]")) return;
      el.toggleAttribute("data-scrolled", scrolled);
    },
    true
  );
}
