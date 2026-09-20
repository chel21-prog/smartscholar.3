// Shared formatting helpers. Centralized so peso amounts and dates look
// identical everywhere in the app instead of each page hand-rolling its
// own version (which is how the same "generic fallback text" class of bug
// has crept in more than once already).

export function formatPeso(amount) {
  const n = Number(amount);
  if (amount === null || amount === undefined || amount === "" || isNaN(n)) return "₱0.00";
  return "₱" + n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDate(value, opts) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString("en-PH", opts || { year: "numeric", month: "long", day: "numeric" });
}

export function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d)) return "—";
  return d.toLocaleString("en-PH");
}
