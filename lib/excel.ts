import type { RawRow } from "./people";
import type { Person, RoomConfig, Seat } from "./types";
import { unitColorHex } from "./colors";

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
  ];
  const thin = { style: "thin" as const, color: { argb: "FF9FB0D6" } };
  const border = { top: thin, left: thin, bottom: thin, right: thin };
  for (let c = 1; c <= 3; c++) {
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
    for (let c = 1; c <= 3; c++) row.getCell(c).border = border;
  }
  ws.views = [{ state: "frozen", ySplit: 1 }];

  const guide = wb.addWorksheet("Hướng dẫn");
  guide.columns = [{ width: 95 }];
  guide.addRow(["Cách điền file này"]).font = { bold: true, size: 13 };
  guide.addRow([""]);
  [
    "1. Vào trang \"Danh sách\", mỗi người điền một dòng, bắt đầu từ dòng 2.",
    "2. Giữ nguyên dòng tiêu đề (Họ tên, Mã CC, Đơn vị), đừng xoá hay đổi tên cột.",
    "3. Mã CC gõ đúng như trên giấy báo dự thi, kể cả số 0 ở đầu (vd 001234).",
    "4. Tên đơn vị viết khác nhau chút (hoa/thường, có dấu/không dấu) sẽ được tự gộp lại, không cần sửa cho giống hệt nhau.",
    "5. Điền xong, lưu lại đúng định dạng .xlsx rồi tải file này lên ứng dụng.",
  ].forEach((line) => guide.addRow([line]));
  guide.addRow([""]);
  guide.addRow(["Ví dụ (trang \"Danh sách\" sẽ có dạng như dưới đây):"]);
  const exHeader = guide.addRow(["Họ tên", "Mã CC", "Đơn vị"]);
  exHeader.font = { bold: true };
  guide.addRow(["Nguyễn Văn A", "001234", "Sở Nội vụ"]);

  return new Blob([await wb.xlsx.writeBuffer()], { type: XLSX_TYPE });
}

export async function resultXlsx(room: RoomConfig, seats: Seat[], items: number[], people: Person[]): Promise<Blob> {
  const ExcelJS = await loadExcel();
  const wb = new ExcelJS.Workbook();
  const map = wb.addWorksheet("Sơ đồ");
  const thin = { style: "thin" as const, color: { argb: "FF9FB0D6" } };
  const bySeatKey = new Map(seats.map((s, i) => [s.key, i]));
  const width = room.blocks * room.cols + (room.blocks - 1);
  for (let c = 1; c <= width; c++) map.getColumn(c).width = c % (room.cols + 1) === 0 ? 3 : 20;
  for (let r = 0; r < room.rows; r++) {
    const row = map.getRow(r + 1);
    row.height = 60;
    for (let g = 0; g < room.blocks * room.cols; g++) {
      const i = bySeatKey.get(`${r}-${g}`);
      if (i === undefined) continue;
      const block = Math.floor(g / room.cols);
      const cell = row.getCell(g + block + 1);
      cell.alignment = { wrapText: true, vertical: "middle", horizontal: "center" };
      cell.border = { top: thin, left: thin, bottom: thin, right: thin };
      const pi = items[i];
      const num = String(seats[i].number);
      if (pi < 0) {
        cell.value = { richText: [{ text: num + "\n", font: { bold: true } }, { text: "(trống)", font: { italic: true, size: 9 } }] };
        continue;
      }
      const p = people[pi];
      cell.value = {
        richText: [
          { text: num + "\n", font: { bold: true, size: 12 } },
          { text: p.name + "\n", font: { bold: true, size: 10 } },
          { text: `${p.code} · ${p.unit}`, font: { size: 8 } },
        ],
      };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + unitColorHex(p.unitId) } };
    }
  }
  map.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };

  const list = wb.addWorksheet("Danh sách");
  list.columns = [
    { header: "Số máy", key: "n", width: 10 },
    { header: "Khoang", key: "k", width: 9 },
    { header: "Hàng", key: "h", width: 8 },
    { header: "Ghế", key: "g", width: 8 },
    { header: "Họ tên", key: "name", width: 30 },
    { header: "Mã CC", key: "code", width: 14 },
    { header: "Đơn vị", key: "unit", width: 40 },
  ];
  list.getRow(1).font = { bold: true };
  list.views = [{ state: "frozen", ySplit: 1 }];
  seats.forEach((s, i) => {
    const p = items[i] >= 0 ? people[items[i]] : null;
    list.addRow({ n: s.number, k: s.block + 1, h: s.row + 1, g: s.col + 1, name: p?.name ?? "(trống)", code: p?.code ?? "", unit: p?.unit ?? "" });
  });
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
