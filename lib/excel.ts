import type { RawRow } from "./people";
import type { Person, RoomConfig, Seat } from "./types";
import { unitColorHex } from "./colors";
import { blockLayout } from "./room";
import { slotName } from "./sessions";

// exceljs nặng (~1MB) nên chỉ tải khi người dùng thật sự cần.
const loadExcel = () => import("exceljs").then((m) => m.default ?? m);

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function cellText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
  if (v instanceof Date) return v.toLocaleDateString("vi-VN");
  if (typeof v === "object") {
    const o = v as { richText?: { text: string }[]; result?: unknown; text?: unknown };
    if (o.richText) return o.richText.map((t) => t.text).join("");
    if ("result" in o) return cellText(o.result);
    if ("text" in o) return cellText(o.text);
  }
  return "";
}

export async function readXlsx(file: File): Promise<RawRow[]> {
  const ExcelJS = await loadExcel();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const named = wb.getWorksheet("Danh sách");
  const ws = named && named.actualRowCount > 0 ? named : wb.worksheets.find((w) => w.rowCount > 0);
  if (!ws) throw new Error("File Excel không có dữ liệu");
  const rows: RawRow[] = [];
  ws.eachRow({ includeEmpty: false }, (row, line) => {
    const cells: string[] = [];
    for (let c = 1; c <= row.cellCount; c++) cells.push(cellText(row.getCell(c).value));
    rows.push({ line, cells });
  });
  return rows;
}

export async function templateXlsx(): Promise<Blob> {
  const ExcelJS = await loadExcel();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Danh sách");
  ws.columns = [
    { header: "Họ tên", key: "name", width: 32 },
    { header: "Mã CC", key: "code", width: 16 },
    { header: "Đơn vị", key: "unit", width: 40 },
    { header: "Lĩnh vực dự kiểm tra", key: "field", width: 30 },
  ];
  const thin = { style: "thin" as const, color: { argb: "FF9FB0D6" } };
  const border = { top: thin, left: thin, bottom: thin, right: thin };
  for (let c = 1; c <= 4; c++) {
    const cell = ws.getRow(1).getCell(c);
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDDE6FB" } };
    cell.border = border;
  }
  // Mã CC phải là văn bản để không mất số 0 ở đầu (vd 001234).
  ws.getColumn(2).numFmt = "@";
  // Kẻ sẵn một khối dòng trống để trông giống một mẫu đơn cần điền.
  const EMPTY_ROWS = 300;
  for (let r = 2; r <= 1 + EMPTY_ROWS; r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= 4; c++) row.getCell(c).border = border;
  }
  ws.views = [{ state: "frozen", ySplit: 1 }];

  const guide = wb.addWorksheet("Hướng dẫn");
  guide.columns = [{ width: 95 }];
  guide.addRow(["Cách điền file này"]).font = { bold: true, size: 13 };
  guide.addRow([""]);
  [
    "1. Vào trang \"Danh sách\", mỗi người điền một dòng, bắt đầu từ dòng 2.",
    "2. Giữ nguyên dòng tiêu đề (Họ tên, Mã CC, Đơn vị, Lĩnh vực dự kiểm tra), đừng xoá hay đổi tên cột.",
    "3. Mã CC gõ đúng như trên giấy báo dự thi, kể cả số 0 ở đầu (vd 001234).",
    "4. Tên đơn vị viết khác nhau chút (hoa/thường, có dấu/không dấu) sẽ được tự gộp lại, không cần sửa cho giống hệt nhau.",
    "5. Cột Lĩnh vực dự kiểm tra để trống cũng được; điền thì lĩnh vực hiện trên sơ đồ và khi tra cứu.",
    "6. Điền xong, lưu lại đúng định dạng .xlsx rồi tải file này lên ứng dụng.",
  ].forEach((line) => guide.addRow([line]));
  guide.addRow([""]);
  guide.addRow(["Ví dụ (trang \"Danh sách\" sẽ có dạng như dưới đây):"]);
  const exHeader = guide.addRow(["Họ tên", "Mã CC", "Đơn vị", "Lĩnh vực dự kiểm tra"]);
  exHeader.font = { bold: true };
  guide.addRow(["Nguyễn Văn A", "001234", "Sở Nội vụ", "Kế toán"]);

  return new Blob([await wb.xlsx.writeBuffer()], { type: XLSX_TYPE });
}

/** Tên trang tính hợp lệ (tối đa 31 ký tự, bỏ các ký tự Excel cấm) và không trùng. */
function sheetName(name: string, used: Set<string>): string {
  const base = name.replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 31) || "Sơ đồ";
  let out = base;
  for (let k = 2; used.has(out.toLowerCase()); k++) out = base.slice(0, 31 - ` (${k})`.length) + ` (${k})`;
  used.add(out.toLowerCase());
  return out;
}

export type ExcelSplit = "one" | "session" | "room";
/** Một file kết quả: tên file và các ca, các phòng (chỉ số) nằm trong file đó. */
export interface ExcelFile {
  name: string;
  sessions: number[];
  rooms: number[];
}

const fileSafe = (s: string) => s.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim() || "phong";

/**
 * Các file sẽ tải: chọn ca và phòng (null = tất cả), rồi gộp một file, mỗi ca một file hoặc mỗi phòng một file.
 * Tên file ghi ca hoặc phòng khi file chỉ có một ca, một phòng.
 */
export function excelFiles(
  roomNames: string[],
  sessionCount: number,
  pick: { session: number | null; room: number | null; split: ExcelSplit },
): ExcelFile[] {
  const ss = pick.session === null ? Array.from({ length: sessionCount }, (_, s) => s) : [pick.session];
  const rs = pick.room === null ? roomNames.map((_, r) => r) : [pick.room];
  const parts =
    pick.split === "session" ? ss.map((s) => ({ sessions: [s], rooms: rs }))
    : pick.split === "room" ? rs.map((r) => ({ sessions: ss, rooms: [r] }))
    : [{ sessions: ss, rooms: rs }];
  const used = new Set<string>();
  return parts.map((p) => {
    const ca = p.sessions.length === 1 && sessionCount > 1 ? `-ca-${p.sessions[0] + 1}` : "";
    const phong = p.rooms.length === 1 ? `-${fileSafe(roomNames[p.rooms[0]])}` : "";
    const base = `xep-cho${ca}${phong || (ca ? "" : `-${p.rooms.length}-phong-${p.sessions.length}-ca`)}`;
    let name = base;
    for (let k = 2; used.has(name.toLowerCase()); k++) name = `${base} (${k})`;
    used.add(name.toLowerCase());
    return { ...p, name: `${name}.xlsx` };
  });
}

/**
 * File kết quả: mỗi phòng của mỗi ca một trang sơ đồ (ô tô màu theo ĐV, ghi số máy, họ tên, Mã CC, ĐV, lĩnh vực),
 * cuối cùng là trang "Danh sách" theo ca, phòng, số máy. items[ca][phòng][ghế] = chỉ số người hoặc -1.
 * `only` giới hạn file ở một số ca, một số phòng (mặc định là tất cả); số ca ghi trong file vẫn là số ca thật.
 */
export async function resultXlsx(
  rooms: RoomConfig[],
  seatsOf: Seat[][],
  items: number[][][],
  people: Person[],
  only: { sessions?: number[]; rooms?: number[] } = {},
): Promise<Blob> {
  const ExcelJS = await loadExcel();
  const wb = new ExcelJS.Workbook();
  const thin = { style: "thin" as const, color: { argb: "FF9FB0D6" } };
  const sessions = items.length;
  const ss = only.sessions ?? items.map((_, s) => s);
  const rs = only.rooms ?? rooms.map((_, r) => r);
  const hasField = people.some((p) => p.field);
  const used = new Set(["danh sách"]);
  // Tên trang ghi thứ thay đổi trong file: cùng một ca thì là tên phòng, cùng một phòng thì là ca.
  const tab = (s: number, r: number) =>
    ss.length * rs.length === 1 ? "Sơ đồ"
    : rs.length === 1 ? `Ca ${s + 1}`
    : ss.length === 1 ? rooms[r].name
    : slotName(s, rooms[r].name, sessions);

  ss.forEach((s) =>
    rs.forEach((r) => {
      const its = items[s][r];
      const room = rooms[r];
      const seats = seatsOf[r];
      const title = slotName(s, room.name, sessions);
      const map = wb.addWorksheet(sheetName(tab(s, r), used));
      const filled = its.filter((x) => x >= 0).length;
      const head = map.getCell(1, 1);
      head.value = `${title}: ${filled} người / ${seats.length} máy`;
      head.font = { bold: true, size: 14 };
      // Giữa hai khoang chừa một cột hẹp làm lối đi.
      const layout = blockLayout(room);
      layout.forEach((b, k) => {
        for (let c = 0; c < b.cols; c++) map.getColumn(b.start + c + k + 1).width = 22;
        if (k < layout.length - 1) map.getColumn(b.start + b.cols + k + 1).width = 3;
      });
      const rowCount = Math.max(0, ...layout.map((b) => b.rows));
      for (let y = 0; y < rowCount; y++) map.getRow(y + 3).height = hasField ? 80 : 66;
      seats.forEach((seat, i) => {
        const cell = map.getCell(seat.row + 3, seat.gcol + seat.block + 1);
        cell.alignment = { wrapText: true, vertical: "middle", horizontal: "center" };
        cell.border = { top: thin, left: thin, bottom: thin, right: thin };
        const num = String(seat.number);
        if (its[i] < 0) {
          cell.value = { richText: [{ text: num + "\n", font: { bold: true } }, { text: "(trống)", font: { italic: true, size: 9 } }] };
          return;
        }
        const p = people[its[i]];
        cell.value = {
          richText: [
            { text: num + "\n", font: { bold: true, size: 12 } },
            { text: p.name + "\n", font: { bold: true, size: 10 } },
            { text: p.code + "\n", font: { size: 9 } },
            { text: p.unit + (p.field ? "\n" : ""), font: { size: 8 } },
            ...(p.field ? [{ text: p.field, font: { italic: true, size: 8 } }] : []),
          ],
        };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + unitColorHex(p.unitId) } };
      });
      map.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
    }),
  );

  const list = wb.addWorksheet("Danh sách");
  list.columns = [
    ...(sessions > 1 ? [{ header: "Ca", key: "ca", width: 6 }] : []),
    ...(rooms.length > 1 ? [{ header: "Phòng", key: "phong", width: 18 }] : []),
    { header: "Số máy", key: "n", width: 10 },
    { header: "Khoang", key: "k", width: 9 },
    { header: "Hàng", key: "h", width: 8 },
    { header: "Ghế", key: "g", width: 8 },
    { header: "Họ tên", key: "name", width: 30 },
    { header: "Mã CC", key: "code", width: 14 },
    { header: "Đơn vị", key: "unit", width: 40 },
    ...(hasField ? [{ header: "Lĩnh vực dự kiểm tra", key: "field", width: 28 }] : []),
  ];
  list.getRow(1).font = { bold: true };
  list.views = [{ state: "frozen", ySplit: 1 }];
  ss.forEach((s) =>
    rs.forEach((r) =>
      seatsOf[r].forEach((x, i) => {
        const its = items[s][r];
        const p = its[i] >= 0 ? people[its[i]] : null;
        list.addRow({
          ca: s + 1, phong: rooms[r].name, n: x.number, k: x.block + 1, h: x.row + 1, g: x.col + 1,
          name: p?.name ?? "(trống)", code: p?.code ?? "", unit: p?.unit ?? "", field: p?.field ?? "",
        });
      }),
    ),
  );
  return new Blob([await wb.xlsx.writeBuffer()], { type: XLSX_TYPE });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
