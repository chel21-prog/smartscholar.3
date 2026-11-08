/**
 * Reads a grantee masterlist from a Word (.docx) file.
 *
 * No dependency: a .docx is a zip, so we read word/document.xml with the
 * browser's own DecompressionStream and walk the table with DOMParser.
 *
 * It does not rely on fixed column positions. Each column's role is worked
 * out from its header text (which can span several rows and merged cells),
 * so minor differences ("Name of Grantee" vs "Grantee", "Program" vs "Course",
 * one Name column vs Last/First/MI columns) are all fine.
 */

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

/* ───────────── zip (just enough to pull one file out) ───────────── */
async function readZipEntry(buf, wanted) {
  const dv = new DataView(buf);
  const u8 = new Uint8Array(buf);
  // end-of-central-directory record
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 66000); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("That doesn't look like a Word (.docx) file.");
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nameLen));
    if (name === wanted) {
      const lNameLen = dv.getUint16(local + 26, true);
      const lExtraLen = dv.getUint16(local + 28, true);
      const start = local + 30 + lNameLen + lExtraLen;
      const data = u8.subarray(start, start + csize);
      if (method === 0) return new TextDecoder().decode(data);
      if (method === 8) {
        const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
        return new TextDecoder().decode(await new Response(stream).arrayBuffer());
      }
      throw new Error("Unsupported compression in this Word file.");
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error("Couldn't find the document text inside that file.");
}

/* ───────────── tables ───────────── */
const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();
const kids = (el, tag) => Array.from(el.childNodes).filter((n) => n.localName === tag && n.namespaceURI === W);
const paraText = (p) => Array.from(p.getElementsByTagNameNS(W, "t")).map((t) => t.textContent).join("");
const cellText = (tc) => clean(kids(tc, "p").map(paraText).join(" "));

/** one table → grid of strings, merged cells expanded so columns line up */
function tableGrid(tbl) {
  const grid = [];
  const carry = []; // vertical merges: column -> text
  for (const tr of kids(tbl, "tr")) {
    const row = [];
    for (const tc of kids(tr, "tc")) {
      const pr = kids(tc, "tcPr")[0];
      const span = Number(pr && kids(pr, "gridSpan")[0]?.getAttributeNS(W, "val")) || 1;
      const vm = pr && kids(pr, "vMerge")[0];
      const vmVal = vm ? vm.getAttributeNS(W, "val") : null;
      let text = cellText(tc);
      const col = row.length;
      if (vm && vmVal !== "restart") text = carry[col] ?? "";   // continuation of a merged cell
      else if (vm) carry[col] = text;
      else carry[col] = undefined;
      for (let k = 0; k < span; k++) row.push(text);
    }
    grid.push(row);
  }
  return grid;
}

/* ───────────── column roles from header text ───────────── */
const ROLES = [
  ["school_id", /school\s*id|student\s*(id|no|number)|id\s*(no|number)/],
  ["last",      /\b(last|surname|family)\b/],
  ["first",     /\b(first|given)\b/],
  ["mi",        /\bm\.?i\.?\b|middle/],
  ["scholarship", /scholarship|grant\s*type|grant\b(?!.*amount)/],
  ["amount",    /amount|allowance|stipend|grant\s*\/|php|₱/],
  ["course",    /program|course|degree/],
  ["year",      /\byear\b|yr\b|year\s*level/],
  ["seq",       /^(seq|no\.?|#|item)$/],
  ["name",      /name|grantee|scholar|student/],
];

function roleFor(headerText) {
  const h = headerText.toLowerCase();
  for (const [role, re] of ROLES) if (re.test(h)) return role;
  return null;
}

const toNumber = (s) => {
  const n = Number(String(s || "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** "Dela Cruz, Juan A." or "Juan A. Dela Cruz" -> { last, first, mi } */
function splitFullName(full) {
  const s = clean(full);
  if (s.includes(",")) {
    const [last, rest = ""] = s.split(",").map(clean);
    const parts = rest.split(" ");
    const mi = parts.length > 1 && /^[A-Za-z]\.?$/.test(parts[parts.length - 1]) ? parts.pop().replace(".", "") : "";
    return { last, first: parts.join(" "), mi };
  }
  const parts = s.split(" ");
  const last = parts.pop() || "";
  const mi = parts.length > 1 && /^[A-Za-z]\.?$/.test(parts[parts.length - 1]) ? parts.pop().replace(".", "") : "";
  return { last, first: parts.join(" "), mi };
}

/**
 * Parse a .docx File.
 * Returns { title, academicYear, groups: [{ label, count }], people: [...], columns }
 * where each person = { group, last, first, mi, course, year, amount, school_id }.
 */
export async function parseGranteesDocx(file) {
  const xml = await readZipEntry(await file.arrayBuffer(), "word/document.xml");
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("That Word file couldn't be read.");

  const body = doc.getElementsByTagNameNS(W, "body")[0];
  const tables = Array.from(body.getElementsByTagNameNS(W, "tbl"));
  if (!tables.length) throw new Error("No table found in that Word file. The list of grantees needs to be in a table.");

  // text outside tables: school year + title
  const outside = Array.from(body.childNodes)
    .filter((n) => n.localName === "p")
    .map(paraText).join(" ");
  const ay = clean(outside).match(/S\.?\s*Y\.?\s*:?\s*(\d{4})\s*[-–—]\s*(\d{4})/i)
    || clean(outside).match(/(\d{4})\s*[-–—]\s*(\d{4})/);
  const academicYear = ay ? `${ay[1]}-${ay[2]}` : "";

  // biggest table wins
  const grid = tables.map(tableGrid).sort((a, b) => b.length - a.length)[0].filter((r) => r.some(Boolean));
  const width = Math.max(...grid.map((r) => r.length));
  grid.forEach((r) => { while (r.length < width) r.push(""); });

  // header = rows before the first row that starts with a sequence number or a name-ish data pattern
  const isDataRow = (r) => r.some((c, i) => /^\d{1,4}$/.test(c) && i < width - 2)
    && r.filter((c) => /[A-Za-z]{2,}/.test(c)).length >= 2;
  let firstData = grid.findIndex(isDataRow);
  if (firstData < 0) throw new Error("Couldn't find any grantee rows in that table.");
  const headerRows = grid.slice(0, firstData);

  // role per column from all header rows stacked
  const roles = [];
  for (let c = 0; c < width; c++) {
    const stacked = headerRows.map((r) => r[c]).filter(Boolean);
    // try the most specific (last) header row first, then the combined text
    let role = null;
    for (const t of [...stacked].reverse()) { role = roleFor(t); if (role && role !== "name") break; }
    if (!role) role = roleFor(stacked.join(" "));
    roles[c] = role;
  }
  // the first column is the group label when it's sparse text and nothing claimed it
  const groupCol = roles.findIndex((r) => r === "scholarship");
  const col = (r) => roles.indexOf(r);

  const hasSplitName = col("last") >= 0 && col("first") >= 0;
  const people = [];
  let group = "";
  for (const r of grid.slice(firstData)) {
    if (groupCol >= 0 && r[groupCol] && !/^\d+$/.test(r[groupCol])) group = clean(r[groupCol]);
    let last, first, mi;
    if (hasSplitName) {
      last = clean(r[col("last")]); first = clean(r[col("first")]); mi = col("mi") >= 0 ? clean(r[col("mi")]) : "";
    } else {
      ({ last, first, mi } = splitFullName(r[col("name")] ?? ""));
    }
    if (!last || !first) continue; // blank spacer rows and footers
    people.push({
      group,
      last, first, mi: mi.replace(".", ""),
      course: col("course") >= 0 ? clean(r[col("course")]) : "",
      year: col("year") >= 0 ? clean(r[col("year")]) : "",
      amount: col("amount") >= 0 ? toNumber(r[col("amount")]) : null,
      school_id: col("school_id") >= 0 ? clean(r[col("school_id")]) : "",
    });
  }
  if (!people.length) throw new Error("Found the table but no grantee names in it.");

  const counts = new Map();
  people.forEach((p) => counts.set(p.group, (counts.get(p.group) || 0) + 1));
  return {
    academicYear,
    groups: [...counts].map(([label, count]) => ({ label, count })),
    people,
    detected: Object.fromEntries(["last", "first", "mi", "course", "year", "amount", "school_id", "scholarship"].map((k) => [k, col(k) >= 0])),
  };
}

/* ───────────── matching helpers ───────────── */
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");

/** best system scholarship for a Word group label like "TDP-TES" (or null) */
export function guessScholarship(label, scholarships) {
  const t = norm(label);
  if (!t) return null;
  let best = null, bestScore = 0;
  for (const s of scholarships) {
    const n = norm(s.scholarship_name);
    let score = 0;
    if (n === t) score = 100;
    else if (n.includes(t) || t.includes(n)) score = 60 + Math.min(n.length, t.length);
    else {
      // shared word tokens ("TDP", "TES")
      const a = new Set(String(label).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1));
      const b = String(s.scholarship_name).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1);
      score = b.filter((w) => a.has(w)).length * 20;
    }
    if (score > bestScore) { best = s; bestScore = score; }
  }
  return bestScore >= 20 ? best : null;
}

export const nameKey = (last, first) => `${norm(last)}|${norm(first)}`;
