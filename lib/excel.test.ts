import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { readXlsx, resultXlsx, templateXlsx } from "./excel";
import { analyzeRows } from "./people";
import { buildSeats, newRoom, roomDims } from "./room";
import type { Person } from "./types";

describe("file mẫu (.xlsx)", () => {
  it("file mẫu chưa điền gì -> đọc ra 0 người, không lỗi, không trùng", async () => {
    const blob = await templateXlsx();
    const file = new File([await blob.arrayBuffer()], "mau-danh-sach.xlsx", { type: blob.type });
    const rows = await readXlsx(file);
    const a = analyzeRows(rows);
    expect(a.people).toHaveLength(0);
    expect(a.missing).toHaveLength(0);
    expect(a.duplicates).toHaveLength(0);
  });

  it("điền người dùng vào file mẫu rồi tải lên lại đọc đúng dữ liệu", async () => {
    const blob = await templateXlsx();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await blob.arrayBuffer());
    const ws = wb.getWorksheet("Danh sách");
    if (!ws) throw new Error("thiếu trang Danh sách");

    // Mã CC ghi dạng chuỗi để giữ số 0 ở đầu, như người dùng gõ tay trong Excel.
    ws.getCell(2, 1).value = "Phạm Văn D";
    ws.getCell(2, 2).value = "001234";
    ws.getCell(2, 3).value = "Sở Y tế";
    ws.getCell(2, 4).value = "Kế toán";
    ws.getCell(3, 1).value = "Trần Thị E";
    ws.getCell(3, 2).value = "CC0002";
    ws.getCell(3, 3).value = "sở y tế";
    ws.getCell(4, 1).value = "Lê Văn F";
    ws.getCell(4, 2).value = "CC0003";
    ws.getCell(4, 3).value = "Sở Nội vụ";

    const buf = await wb.xlsx.writeBuffer();
    const file = new File([buf], "danh-sach.xlsx", { type: blob.type });
    const rows = await readXlsx(file);
    const a = analyzeRows(rows);

    expect(a.people).toHaveLength(3);
    expect(a.people.find((p) => p.name === "Phạm Văn D")).toMatchObject({ code: "001234", field: "Kế toán" });
    expect(a.people.find((p) => p.name === "Lê Văn F")?.field).toBe("");
    expect(a.units).toHaveLength(2);
    const merged = a.units.find((u) => u.variants.length > 1);
    expect(merged?.variants.slice().sort()).toEqual(["Sở Y tế", "sở y tế"]);
    // Không lẫn dữ liệu ví dụ từ trang "Hướng dẫn".
    expect(a.people.some((p) => p.name === "Nguyễn Văn A")).toBe(false);
  });

  it("tiêu đề chỉ tô ở A1:D1, cột Mã CC ở các dòng dữ liệu là định dạng văn bản", async () => {
    const blob = await templateXlsx();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await blob.arrayBuffer());
    const ws = wb.getWorksheet("Danh sách");
    if (!ws) throw new Error("thiếu trang Danh sách");

    for (const col of [1, 2, 3, 4]) {
      const cell = ws.getRow(1).getCell(col);
      expect(cell.fill).toBeTruthy();
      expect(cell.font?.bold).toBe(true);
    }
    expect(ws.getRow(1).getCell(4).value).toBe("Lĩnh vực dự kiểm tra");
    const e1 = ws.getRow(1).getCell(5);
    expect(e1.fill).toBeFalsy();

    for (const r of [2, 50, 301]) {
      expect(ws.getRow(r).getCell(2).numFmt).toBe("@");
    }
  });
});

describe("file kết quả (.xlsx)", () => {
  const people: Person[] = [
    { line: 2, name: "An", code: "CC1", unit: "Sở A", field: "Kế toán", unitId: 0 },
    { line: 3, name: "Bình", code: "CC2", unit: "Sở B", field: "Thuế", unitId: 1 },
    { line: 4, name: "Chi", code: "CC3", unit: "Sở A", field: "", unitId: 0 },
  ];

  async function open(blob: Blob) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await blob.arrayBuffer());
    return wb;
  }

  it("mỗi phòng mỗi ca một trang sơ đồ, ô ghi cả Mã CC và lĩnh vực; trang Danh sách có Ca, Phòng, Lĩnh vực", async () => {
    const rooms = [
      newRoom({ id: "a", name: "Phòng 1", blocks: 1, rows: 1, cols: 2 }),
      newRoom({ id: "b", name: "Phòng 2", blocks: 1, rows: 1, cols: 2 }),
    ];
    const seatsOf = rooms.map((r) => buildSeats(r));
    const wb = await open(await resultXlsx(rooms, seatsOf, [[[0, -1], [1, -1]], [[-1, 2], [-1, -1]]], people));
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      "Ca 1 · Phòng 1", "Ca 1 · Phòng 2", "Ca 2 · Phòng 1", "Ca 2 · Phòng 2", "Danh sách",
    ]);
    const map = wb.getWorksheet("Ca 1 · Phòng 1")!;
    expect(String(map.getCell(1, 1).value)).toContain("Ca 1 · Phòng 1");
    const seat = map.getCell(3, 1).value as { richText: { text: string }[] };
    expect(seat.richText.map((t) => t.text).join("")).toBe("1\nAn\nCC1\nSở A\nKế toán");

    const list = wb.getWorksheet("Danh sách")!;
    expect(list.getRow(1).values).toEqual([undefined, "Ca", "Phòng", "Số máy", "Khoang", "Hàng", "Ghế", "Họ tên", "Mã CC", "Đơn vị", "Lĩnh vực dự kiểm tra"]);
    expect(list.rowCount).toBe(1 + 2 * 2 * 2);
    expect(list.getRow(2).values).toEqual([undefined, 1, "Phòng 1", 1, 1, 1, 1, "An", "CC1", "Sở A", "Kế toán"]);
  });

  it("khoang khác nhau: mỗi khoang đúng số hàng số cột, cách nhau một cột hẹp", async () => {
    // Khoang 1: 2 hàng × 1 cột (cột A), lối đi (cột B), khoang 2: 1 hàng × 2 cột (cột C, D).
    const room = newRoom({ id: "a", name: "P", style: "ltr", ...roomDims([{ rows: 2, cols: 1 }, { rows: 1, cols: 2 }]) });
    const wb = await open(await resultXlsx([room], [buildSeats(room)], [[[0, 1, -1, 2]]], people));
    const map = wb.getWorksheet("Sơ đồ")!;
    const text = (r: number, c: number) => {
      const v = map.getCell(r, c).value as { richText: { text: string }[] } | null;
      return v ? v.richText.map((t) => t.text).join("") : null;
    };
    expect(text(3, 1)).toContain("An");
    expect(text(3, 2)).toBeNull();
    expect(text(3, 3)).toContain("Bình");
    expect(text(3, 4)).toBe("3\n(trống)");
    expect(text(4, 1)).toContain("Chi");
    expect(text(4, 3)).toBeNull();
    expect(map.getColumn(2).width).toBe(3);
    expect(map.getColumn(4).width).toBe(22);
    expect(wb.getWorksheet("Danh sách")!.getRow(5).values).toEqual([undefined, 4, 1, 2, 1, "Chi", "CC3", "Sở A", ""]);
  });

  it("một phòng, một ca, không có lĩnh vực: giữ trang Sơ đồ và bỏ các cột thừa", async () => {
    const room = newRoom({ id: "a", name: "P", blocks: 1, rows: 1, cols: 3 });
    const plain = people.map((p) => ({ ...p, field: "" }));
    const wb = await open(await resultXlsx([room], [buildSeats(room)], [[[0, 1, 2]]], plain));
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Sơ đồ", "Danh sách"]);
    expect(wb.getWorksheet("Danh sách")!.getRow(1).values).toEqual([undefined, "Số máy", "Khoang", "Hàng", "Ghế", "Họ tên", "Mã CC", "Đơn vị"]);
  });
});
