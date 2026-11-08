/**
 * Turns a Word/spreadsheet-style masterlist (a grid of text) into grantee rows,
 * recognising the columns by what their headers say rather than by position,
 * so small differences between lists ("Surname" vs "Last", "Course" vs
 * "Program", one Name column vs Last/First/MI) still work.
 *
 * Pure functions, no DOM: easy to test.
 */

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
const oneLine = (s) => String(s || "").replace(/\s+/g, " ").trim();

/** Which field does a header text describe? (null = not a recognised header) */
export function fieldForHeader(text) {
  const t = oneLine(text).toLowerCase();
  if (!t) return null;
  if (/\b(school|student)\s*(id|no|number)\b|\bid\s*(no|number)\b/.test(t)) return "school_id";
  if (/\bamount\b|\bstipend\b|\ballowance\b/.test(t)) return "amount";
  if (/\bsemester\b|^sem$/.test(t)) return "semester";
  if (/\b(m\.?i\.?|middle)\b/.test(t)) return "middle_name";
  if (/\b(last|surname|family)\b/.test(t)) return "last_name";
  if (/\b(first|given)\b/.test(t)) return "first_name";
  if (/\bscholarship\b|\bgrant\b|\bsponsor\b/.test(t)) return "scholarship";
  if (/\bprogram\b|\bcourse\b|\bdegree\b/.test(t)) return "course";
  if (/\byear\b|\byr\b/.test(t)) return "year_level";
  if (/^(seq|no|#|item)\.?$|^(seq|no)\b/.test(t)) return "seq";
  if (/\bname\b/.test(t)) return "full_name";
  return null;
}

const isHeaderRow = (row) => row.filter((c) => fieldForHeader(c)).length >= 3;

/** Strip list numbering and line breaks from a scholarship label: "4. NCIP\nProgram" -> "NCIP Program" */
export const cleanLabel = (s) => oneLine(s).replace(/^\(?\d+[.)]\s*/, "");

function splitFullName(raw) {
  const s = oneLine(raw);
  if (!s) return { last: "", first: "", mi: "" };
  if (s.includes(",")) {
    const [last, rest] = s.split(/,(.*)/s);
    const parts = oneLine(rest).split(" ");
    const mi = parts.length > 1 && /^[A-Za-z]\.?$/.test(parts[parts.length - 1]) ? parts.pop().replace(".", "") : "";
    return { last: oneLine(last), first: parts.join(" "), mi };
  }
  const parts = s.split(" ");
  const last = parts.pop();
  const mi = parts.length > 1 && /^[A-Za-z]\.?$/.test(parts[parts.length - 1]) ? parts.pop().replace(".", "") : "";
  return { last, first: parts.join(" "), mi };
}

function editDistance(a, b) {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 3) return 9;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}

/** Make spelling variants of the same program one spelling (the most common one). */
function unifyPrograms(values) {
  const count = new Map();
  values.forEach((v) => v && count.set(v, (count.get(v) || 0) + 1));
  const variants = [...count.keys()].sort((a, b) => count.get(b) - count.get(a));
  const canon = new Map(); // variant -> canonical
  const canonical = [];
  for (const v of variants) {
    const k = norm(v);
    const hit = canonical.find((c) => norm(c) === k || (k.length > 8 && norm(c).length > 8 && editDistance(norm(c), k) <= 2));
    if (hit) canon.set(v, hit); else { canonical.push(v); canon.set(v, v); }
  }
  return (v) => canon.get(v) || v;
}

export function detectAcademicYear(texts) {
  for (const t of texts) {
    const m = String(t).match(/(\d{4})\s*[-–/]\s*(\d{4}|\d{2})\b/);
    if (m) {
      const end = m[2].length === 2 ? m[1].slice(0, 2) + m[2] : m[2];
      return `${m[1]}-${end}`;
    }
  }
  return "";
}

export function detectSemester(texts) {
  for (const t of texts) {
    if (/\b(1st|first)\s*sem/i.test(t)) return "1st Semester";
    if (/\b(2nd|second)\s*sem/i.test(t)) return "2nd Semester";
  }
  return "";
}

/**
 * @param tables      string[][][]  every table found in the document
 * @param paragraphs  string[]      text outside tables (title, "SY 2022-2023", ...)
 * @param extraHints  string[]      e.g. the file name
 */
export function parseGranteeList(tables, paragraphs = [], extraHints = []) {
  let best = null;
  for (const grid of tables) {
    // header rows = the leading run of header-looking rows
    let h = 0;
    while (h < Math.min(grid.length, 4) && isHeaderRow(grid[h])) h++;
    if (!h) continue;
    const cols = grid[0].map((_, c) => {
      const parts = [];
      for (let r = 0; r < h; r++) { const t = oneLine(grid[r][c]); if (t && !parts.includes(t)) parts.push(t); }
      return parts.join(" ");
    });
    const map = {};
    cols.forEach((text, c) => {
      const f = fieldForHeader(text);
      if (f && map[f] === undefined) map[f] = c;
    });
    const hasName = (map.last_name !== undefined && map.first_name !== undefined) || map.full_name !== undefined;
    if (!hasName) continue;
    const score = grid.length;
    if (!best || score > best.score) best = { grid, h, map, score };
  }
  if (!best) return null;

  const { grid, h, map } = best;
  const cell = (row, f) => (map[f] === undefined ? "" : oneLine(row[map[f]]));
  const raw = [];
  let skipped = 0;
  for (const row of grid.slice(h)) {
    if (isHeaderRow(row)) continue; // header repeated on a new page
    let last = cell(row, "last_name"), first = cell(row, "first_name"), mi = cell(row, "middle_name");
    if (map.last_name === undefined || map.first_name === undefined) {
      ({ last, first, mi } = splitFullName(cell(row, "full_name")));
    }
    if (!last || !first) { if (row.some((c) => oneLine(c))) skipped++; continue; }
    const yr = cell(row, "year_level").match(/\d/);
    raw.push({
      last_name: last, first_name: first, middle_name: mi.replace(/\./g, ""),
      course: cell(row, "course"), year_level: yr ? yr[0] : "",
      amount: cell(row, "amount"), school_id: cell(row, "school_id"),
      scholarship_label: cleanLabel(cell(row, "scholarship")),
    });
  }

  const fixProgram = unifyPrograms(raw.map((r) => r.course));
  raw.forEach((r) => { r.course = fixProgram(r.course); });

  const hints = [...paragraphs, ...extraHints];
  return {
    rows: raw,
    skipped,
    academic_year: detectAcademicYear(hints),
    semester: detectSemester(hints),
    columns: Object.keys(map),
    hasScholarshipColumn: map.scholarship !== undefined,
    hasSchoolId: map.school_id !== undefined,
  };
}

/** Best system scholarship for a label in the file (null if nothing close). */
export function guessScholarship(label, scholarships) {
  const a = norm(label);
  if (!a) return null;
  const ta = new Set(oneLine(label).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1));
  let best = null, bestScore = 0;
  for (const s of scholarships) {
    const b = norm(s.scholarship_name);
    if (!b) continue;
    let score = 0;
    if (a === b) score = 1;
    else if (a.includes(b) || b.includes(a)) score = 0.9;
    else {
      const tb = new Set(oneLine(s.scholarship_name).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1));
      const inter = [...ta].filter((w) => tb.has(w)).length;
      const union = new Set([...ta, ...tb]).size || 1;
      score = inter / union;
    }
    if (score > bestScore) { best = s; bestScore = score; }
  }
  return bestScore >= 0.5 ? best : null;
}
