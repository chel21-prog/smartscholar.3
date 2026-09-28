/**
 * "Expand on hover" for clipped text — app-wide, one delegated listener.
 *
 * Anything the UI cuts short (table cells, one-line ellipsis labels,
 * 2-line clamped previews, sidebar names…) shows its FULL text in a
 * styled popover when the pointer rests on it. Text that isn't actually
 * clipped never triggers anything.
 *
 * For table cells the popover is headed with the column name
 * (e.g. REMARKS), so it's clear what is being read.
 *
 * Opt out on any element with data-no-expand.
 * Styling lives in index.css (.expand-pop).
 */
const DELAY_MS = 220;
const MAX_HOPS = 6;

let pop = null;
let current = null;
let timer = null;

function isClipped(el) {
  const cs = getComputedStyle(el);
  if (cs.overflowX === "visible" && cs.overflowY === "visible") return false;

  // multi-line clamp (-webkit-line-clamp)
  const clamp = cs.getPropertyValue("-webkit-line-clamp");
  if (clamp && clamp !== "none") return el.scrollHeight > el.clientHeight + 1;

  // single-line ellipsis / hard clip
  return el.scrollWidth > el.clientWidth + 1;
}

function findClipped(start) {
  let el = start;
  for (let i = 0; el && el !== document.body && i < MAX_HOPS; i++, el = el.parentElement) {
    if (el.closest("[data-no-expand]")) return null;
    if (/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(el.tagName)) return null;
    if (el.hasAttribute("colspan")) return null; // skeleton / empty-state rows
    if (isClipped(el)) return el;
    if (el.tagName === "TD" || el.tagName === "TH") return null; // stop at the cell
  }
  return null;
}

function columnLabel(el) {
  const cell = el.closest("td");
  if (!cell) return "";
  const table = cell.closest("table");
  const th = table?.tHead?.rows?.[0]?.cells?.[cell.cellIndex];
  return th ? th.textContent.replace(/\s+/g, " ").trim() : "";
}

function ensurePop() {
  if (pop) return pop;
  pop = document.createElement("div");
  pop.className = "expand-pop";
  pop.setAttribute("role", "tooltip");
  pop.innerHTML = '<span class="expand-pop__label"></span><span class="expand-pop__text"></span>';
  document.body.appendChild(pop);
  return pop;
}

function place(el) {
  const p = ensurePop();
  const r = el.getBoundingClientRect();
  const margin = 8;

  const pw = p.offsetWidth;
  const ph = p.offsetHeight;

  let left = r.left;
  left = Math.max(margin, Math.min(left, window.innerWidth - pw - margin));

  let top = r.bottom + 8;
  let above = false;
  if (top + ph > window.innerHeight - margin && r.top - 8 - ph > margin) {
    top = r.top - 8 - ph;
    above = true;
  }

  const arrow = Math.max(12, Math.min(r.left + Math.min(r.width, 60) / 2 - left, pw - 22));
  p.style.top = `${top}px`;
  p.style.left = `${left}px`;
  p.style.setProperty("--arrow-left", `${arrow}px`);
  p.classList.toggle("expand-pop--above", above);
}

function show(el) {
  const text = el.textContent.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) return;

  const p = ensurePop();
  const label = columnLabel(el);
  const labelEl = p.firstChild;
  labelEl.textContent = label;
  labelEl.style.display = label ? "block" : "none";
  p.lastChild.textContent = text;

  p.classList.remove("expand-pop--in");
  p.style.visibility = "hidden";
  p.style.display = "block";
  place(el);
  p.style.visibility = "";
  // next frame → fade/slide in
  requestAnimationFrame(() => p.classList.add("expand-pop--in"));
}

function hide() {
  clearTimeout(timer);
  timer = null;
  current = null;
  if (pop) {
    pop.classList.remove("expand-pop--in");
    pop.style.display = "none";
  }
}

export function initExpandOnHover() {
  document.addEventListener(
    "mouseover",
    (e) => {
      if (!(e.target instanceof Element)) return;
      const el = findClipped(e.target);
      if (el === current) return;

      hide();
      if (!el) return;

      current = el;
      timer = setTimeout(() => {
        // still clipped? (layout may have changed during the delay)
        if (current === el && el.isConnected && isClipped(el)) show(el);
      }, DELAY_MS);
    },
    { passive: true }
  );

  document.addEventListener(
    "mouseout",
    (e) => {
      if (!current) return;
      const to = e.relatedTarget;
      if (to instanceof Node && current.contains(to)) return;
      hide();
    },
    { passive: true }
  );

  window.addEventListener("scroll", hide, true);
  window.addEventListener("resize", hide);
  document.addEventListener("mousedown", hide, true);
  document.addEventListener("keydown", hide, true);
}
