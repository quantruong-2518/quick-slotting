import type { Person, Unit } from "./types";

export const stripVN = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
export const norm = (s: string) => stripVN(s).toLowerCase().replace(/\s+/g, " ").trim();
export const unitKey = (s: string) => stripVN(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const clean = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();

export interface RawRow { line: number; cells: string[] }
export interface Entry { line: number; name: string; code: string; unit: string; field: string; problem?: "missing" | "duplicate" }
export interface Analysis {
  entries: Entry[];
  people: Person[];
  units: Unit[];
  columnNote: string;
  /** Danh sách có cột Lĩnh vực dự kiểm tra. */
  hasField: boolean;
  missing: { entry: Entry; fields: string[] }[];
  duplicates: { entry: Entry; first: Entry }[];
  merged: Unit[];
}

export function detectDelimiter(text: string): string {
  if (text.includes("\t")) return "\t";
  const first = text.split(/\r?\n/).find((l) => l.trim()) ?? "";
  return (first.match(/;/g) ?? []).length > (first.match(/,/g) ?? []).length ? ";" : ",";
}

/** Đọc CSV/TSV có hỗ trợ dấu ngoặc kép. */
export function parseDelimited(text: string, d = detectDelimiter(text)): RawRow[] {
  text = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"' && cell === "") q = true;
    else if (ch === d) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.map((cells, i) => ({ line: i + 1, cells }));
}

// So khớp CẢ ô (không phải chứa một phần), để tránh nhận nhầm tên người ("Ma Văn Kháng")
// hay tên đơn vị ("Cơ quan Thường trực…", "Đơn vị 3") thành tiêu đề cột.
const HEADER_LABEL_RE =
  /^(stt|so tt|tt|ho va ten|ho ten|ten|ma|ma cc|ma cong chuc|ma so|ma du thi|don vi|don vi cong tac|co quan|noi cong tac|phong ban|linh vuc(?: du)?(?: kiem tra| thi)?)$/;
const isHeaderLabel = (x: string) => HEADER_LABEL_RE.test(x.replace(/[.:]+$/, ""));

/** Nhận diện cột, kiểm tra thiếu và trùng mã, gộp tên đơn vị viết khác nhau. */
export function analyzeRows(raw: RawRow[]): Analysis {
  const rows = raw.map((r) => ({ line: r.line, cells: r.cells.map(clean) })).filter((r) => r.cells.some(Boolean));
  if (!rows.length) {
    return { entries: [], people: [], units: [], columnNote: "", hasField: false, missing: [], duplicates: [], merged: [] };
  }
  // Cho phép có dòng tiêu đề văn bản (vd "DANH SÁCH NGƯỜI DỰ THI") phía trên dòng tiêu đề cột thật.
  // Một dòng chỉ được coi là tiêu đề khi có ít nhất 2 ô khớp nguyên ô với nhãn cột quen thuộc,
  // để danh sách không có tiêu đề (dán từ Excel) không bị hiểu nhầm hàng dữ liệu là tiêu đề.
  const searchLimit = Math.min(rows.length, 10);
  let headerIdx = -1;
  for (let i = 0; i < searchLimit; i++) {
    if (rows[i].cells.map(norm).filter(isHeaderLabel).length >= 2) { headerIdx = i; break; }
  }
  const hasHeader = headerIdx >= 0;
  const headerRow = hasHeader ? rows[headerIdx] : rows[0];
  const head = headerRow.cells.map(norm);
  // Không có tiêu đề thì theo thứ tự file mẫu: Họ tên, Mã CC, Đơn vị, Lĩnh vực.
  const idx = { name: 0, code: 1, unit: 2, field: 3 };
  let data = rows;
  if (hasHeader) {
    data = rows.slice(headerIdx + 1);
    const field = head.findIndex((x) => /(^|\s)linh vuc(\s|$)/.test(x));
    const unit = head.findIndex((x, i) => i !== field && /don vi|co quan|noi cong tac|phong ban/.test(x));
    const code = head.findIndex((x, i) => i !== field && i !== unit && /(^|\s)ma(\s|$)/.test(x));
    const name = head.findIndex((x, i) => i !== field && i !== unit && i !== code && /(^|\s)(ho va ten|ho ten|ten)(\s|$)/.test(x));
    const used = new Set([name, code, unit, field].filter((v) => v >= 0));
    const free = head.map((_, i) => i).filter((i) => !used.has(i) && !/^stt$/.test(head[i]));
    idx.name = name >= 0 ? name : free.shift() ?? 0;
    idx.code = code >= 0 ? code : free.shift() ?? 1;
    idx.unit = unit >= 0 ? unit : free.shift() ?? 2;
    idx.field = field; // lĩnh vực là cột thêm: chỉ nhận khi có tiêu đề rõ ràng
  }

  const entries: Entry[] = data.map((r) => ({
    line: r.line, name: r.cells[idx.name] ?? "", code: r.cells[idx.code] ?? "", unit: r.cells[idx.unit] ?? "",
    field: idx.field >= 0 ? r.cells[idx.field] ?? "" : "",
  }));
  const hasField = idx.field >= 0 && (hasHeader || entries.some((e) => e.field));
  const label = (i: number) => (hasHeader && headerRow.cells[i] ? `"${headerRow.cells[i]}"` : `cột ${String.fromCharCode(65 + i)}`);
  const columnNote =
    `Họ tên: ${label(idx.name)} · Mã CC: ${label(idx.code)} · Đơn vị: ${label(idx.unit)}` +
    (hasField ? ` · Lĩnh vực: ${label(idx.field)}` : "");
  const missing: Analysis["missing"] = [];
  const duplicates: Analysis["duplicates"] = [];
  const good: Entry[] = [];
  const seen = new Map<string, Entry>();
  for (const e of entries) {
    const fields = [!e.name && "Họ tên", !e.code && "Mã CC", !e.unit && "Đơn vị"].filter(Boolean) as string[];
    if (fields.length) { e.problem = "missing"; missing.push({ entry: e, fields }); continue; }
    const k = e.code.replace(/\s+/g, "").toUpperCase();
    const first = seen.get(k);
    if (first) { e.problem = "duplicate"; duplicates.push({ entry: e, first }); continue; }
    seen.set(k, e);
    good.push(e);
  }

  const groups = new Map<string, { variants: Map<string, number>; count: number }>();
  for (const e of good) {
    const k = unitKey(e.unit) || e.unit;
    const g = groups.get(k) ?? { variants: new Map(), count: 0 };
    g.count++;
    g.variants.set(e.unit, (g.variants.get(e.unit) ?? 0) + 1);
    groups.set(k, g);
  }
  const keyed = [...groups.entries()]
    .map(([key, g]) => {
      const name = [...g.variants.entries()].sort((a, b) => b[1] - a[1])[0][0];
      return { key, name, count: g.count, variants: [...g.variants.keys()] };
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "vi"));
  const idOf = new Map(keyed.map((u, i) => [u.key, i]));
  const units: Unit[] = keyed.map((u, i) => ({ id: i, name: u.name, count: u.count, variants: u.variants }));
  const people: Person[] = good.map((e) => ({ ...e, unitId: idOf.get(unitKey(e.unit) || e.unit)! }));

  return { entries, people, units, columnNote, hasField, missing, duplicates, merged: units.filter((u) => u.variants.length > 1) };
}

/** Chuẩn hoá mã CC người dùng gõ khi tra cứu. */
export const normalizeCode = (s: string) => s.replace(/\s+/g, "").toUpperCase();
