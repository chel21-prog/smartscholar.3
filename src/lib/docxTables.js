/**
 * Reads the paragraphs and tables out of a .docx file, in the browser.
 *
 * A .docx is a zip whose word/document.xml holds the body. Merged cells are
 * expanded so the result is a plain grid: a horizontally merged cell
 * (gridSpan) repeats its text across the columns it spans, and a vertically
 * merged cell (vMerge) repeats the text of the cell above it. That is how
 * "one scholarship name spanning 180 rows" becomes a value on every row.
 *
 * Returns { paragraphs: string[], tables: string[][][] }
 *
 * No dependency: a .docx is a zip, so the one file we need (word/document.xml)
 * is pulled out with the browser's own DecompressionStream.
 */
const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

const kids = (el, name) => Array.from(el.childNodes).filter((n) => n.nodeType === 1 && n.localName === name && n.namespaceURI === W);
const clean = (s) => s.replace(/[ \t ]+/g, " ").replace(/ *\n */g, "\n").trim();

function paragraphText(p) {
  let out = "";
  const walk = (n) => {
    for (const c of Array.from(n.childNodes)) {
      if (c.nodeType !== 1) continue;
      if (c.localName === "t") out += c.textContent;
      else if (c.localName === "tab") out += "\t";
      else if (c.localName === "br" || c.localName === "cr") out += "\n";
      else walk(c);
    }
  };
  walk(p);
  return out;
}

function cellText(tc) {
  return clean(kids(tc, "p").map(paragraphText).join("\n"));
}

function readTable(tbl) {
  const grid = [];
  const above = []; // text of the last cell seen in each grid column (for vMerge)
  for (const tr of kids(tbl, "tr")) {
    const row = [];
    for (const tc of kids(tr, "tc")) {
      const pr = kids(tc, "tcPr")[0];
      const span = Number(kids(pr || tc, "gridSpan")[0]?.getAttribute("w:val") || 1) || 1;
      const vm = pr ? kids(pr, "vMerge")[0] : null;
      const isContinue = vm && vm.getAttribute("w:val") !== "restart";
      const col = row.length;
      const text = isContinue ? (above[col] ?? "") : cellText(tc);
      for (let i = 0; i < span; i++) { row.push(text); above[col + i] = text; }
    }
    grid.push(row);
  }
  return grid;
}

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

export async function readDocx(buffer) {
  const xml = await readZipEntry(buffer, "word/document.xml");
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("Couldn't read the Word file's contents.");
  const body = doc.getElementsByTagNameNS(W, "body")[0];
  const paragraphs = [];
  const tables = [];
  for (const n of Array.from(body?.childNodes || [])) {
    if (n.nodeType !== 1 || n.namespaceURI !== W) continue;
    if (n.localName === "p") { const t = clean(paragraphText(n)); if (t) paragraphs.push(t); }
    else if (n.localName === "tbl") tables.push(readTable(n));
  }
  return { paragraphs, tables };
}
