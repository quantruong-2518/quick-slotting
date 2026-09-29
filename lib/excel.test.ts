import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { readXlsx, templateXlsx } from "./excel";
import { analyzeRows } from "./people";

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
    expect(a.people.find((p) => p.name === "Phạm Văn D")?.code).toBe("001234");
    expect(a.units).toHaveLength(2);
    const merged = a.units.find((u) => u.variants.length > 1);
    expect(merged?.variants.slice().sort()).toEqual(["Sở Y tế", "sở y tế"]);
    // Không lẫn dữ liệu ví dụ từ trang "Hướng dẫn".
    expect(a.people.some((p) => p.name === "Nguyễn Văn A")).toBe(false);
  });

  it("tiêu đề chỉ tô ở A1:C1, cột Mã CC ở các dòng dữ liệu là định dạng văn bản", async () => {
    const blob = await templateXlsx();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await blob.arrayBuffer());
    const ws = wb.getWorksheet("Danh sách");
    if (!ws) throw new Error("thiếu trang Danh sách");

    for (const col of [1, 2, 3]) {
      const cell = ws.getRow(1).getCell(col);
      expect(cell.fill).toBeTruthy();
      expect(cell.font?.bold).toBe(true);
    }
    const d1 = ws.getRow(1).getCell(4);
    expect(d1.fill).toBeFalsy();

    for (const r of [2, 50, 301]) {
      expect(ws.getRow(r).getCell(2).numFmt).toBe("@");
    }
  });
});
