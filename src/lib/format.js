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


// jsPDF's built-in fonts have no peso sign (₱ prints as "±" with odd letter
// spacing), so PDFs use these instead: plain figures like the printed forms
// ("1,357,500.00") or an explicit "PHP" prefix.
export function formatMoneyPlain(amount) {
  const n = Number(amount);
  const v = amount === null || amount === undefined || amount === "" || isNaN(n) ? 0 : n;
  return v.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function formatPesoPdf(amount) {
  return "PHP " + formatMoneyPlain(amount);
}
