import { describe, expect, it } from "vitest";
import { buildNeighbors, buildSeats, newRoom } from "./room";
import { arrange, seededRng } from "./seating";
import { analyzeRows, parseDelimited } from "./people";

const room = newRoom({ id: "t", blocks: 3, rows: 8, cols: 5 });

function makeUnits(sizes: number[]) {
  const out: number[] = [];
  sizes.forEach((n, u) => { for (let i = 0; i < n; i++) out.push(u); });
  return out;
}

describe("sơ đồ phòng", () => {
  it("đánh số kiểu rắn", () => {
    const seats = buildSeats(room);
    expect(seats).toHaveLength(120);
    expect(seats[14].gcol).toBe(14);
    expect(seats[15].gcol).toBe(14); // hàng 2 đi ngược lại
    expect(seats[15].number).toBe(16);
  });

  it("lối đi giữa các khoang cắt quan hệ kề", () => {
    const seats = buildSeats(room);
    const nb = buildNeighbors(room, seats, "lr");
    const i = seats.findIndex((s) => s.row === 0 && s.gcol === 4);
    const j = seats.findIndex((s) => s.row === 0 && s.gcol === 5);
    expect(nb[i]).not.toContain(j);
  });
});

describe("xếp chỗ", () => {
  it("không để hai người cùng đơn vị ngồi cạnh nhau", () => {
    const seats = buildSeats(room);
    for (const adj of ["lr", "lrfb", "all"] as const) {
      const nb = buildNeighbors(room, seats, adj);
      const units = makeUnits([16, 14, 12, 11, 10, 9, 8, 7, 6, 5, 4, 4, 3, 3]);
      const r = arrange({
        unitOfPerson: units, seatCount: seats.length, nb, spare: "tail",
        rng: seededRng(42), timeBudgetMs: 3000,
      });
      expect(r.conflictPairs, adj).toBe(0);
      expect(r.items.filter((x) => x >= 0)).toHaveLength(units.length);
    }
  });

  it("báo trước khi một đơn vị quá đông", () => {
    const seats = buildSeats(room);
    const nb = buildNeighbors(room, seats, "lr");
    const r = arrange({
      unitOfPerson: makeUnits([80, 20]), seatCount: seats.length, nb, spare: "tail",
      exactPathBound: true, rng: seededRng(1), timeBudgetMs: 300,
    });
    expect(r.capacityIssues[0]).toMatchObject({ unitId: 0, count: 80 });
    expect(r.conflictPairs).toBeGreaterThan(0);
  });
});

describe("đọc danh sách", () => {
  it("nhận cột, gộp tên đơn vị, báo trùng mã", () => {
    const text = "Họ tên\tMã CC\tĐơn vị\nA\tCC1\tSở Y tế\nB\tCC2\tSở y tế \nC\tCC1\tSở Nội vụ\nD\tCC4\t";
    const a = analyzeRows(parseDelimited(text));
    expect(a.people).toHaveLength(2);
    expect(a.units).toHaveLength(1);
    expect(a.merged).toHaveLength(1);
    expect(a.duplicates).toHaveLength(1);
    expect(a.missing).toHaveLength(1);
  });

  it("bỏ qua dòng tựa đề phía trên dòng tiêu đề cột", () => {
    const text = "DANH SÁCH NGƯỜI DỰ THI\nHọ tên\tMã CC\tĐơn vị\nA\tCC1\tSở Y tế\nB\tCC2\tSở Nội vụ";
    const a = analyzeRows(parseDelimited(text));
    expect(a.people).toHaveLength(2);
    expect(a.people.map((p) => p.name)).toEqual(["A", "B"]);
    // Số dòng báo cho người dùng phải là số dòng thật trong file (dòng 1 là tựa đề, dòng 2 là tiêu đề).
    expect(a.people[0].line).toBe(3);
    expect(a.people[1].line).toBe(4);
    expect(a.columnNote).toContain('"Họ tên"');
  });

  it("dán không có tiêu đề: tên/đơn vị trùng từ khoá tiêu đề không bị hiểu nhầm thành dòng tiêu đề", () => {
    const text = [
      "A\tCC1\tSở Y tế",
      "B\tCC2\tSở Nội vụ",
      "Ma Văn Kháng\tCC3\tSở Giáo dục",
      "C\tCC4\tCơ quan Thường trực",
    ].join("\n");
    const a = analyzeRows(parseDelimited(text));
    expect(a.people).toHaveLength(4);
    expect(a.people.map((p) => p.name)).toEqual(["A", "B", "Ma Văn Kháng", "C"]);
    expect(a.people[2].name).toBe("Ma Văn Kháng");
    expect(a.people[3].unit).toBe("Cơ quan Thường trực");
  });

  it("tiêu đề dạng STT | Họ và tên | Mã công chức | Đơn vị công tác vẫn nhận đúng cột", () => {
    const text = "STT\tHọ và tên\tMã công chức\tĐơn vị công tác\n1\tNguyễn Văn A\tCC0001\tSở Nội vụ";
    const a = analyzeRows(parseDelimited(text));
    expect(a.people).toHaveLength(1);
    expect(a.people[0]).toMatchObject({ name: "Nguyễn Văn A", code: "CC0001", unit: "Sở Nội vụ" });
    expect(a.columnNote).toContain('"Họ và tên"');
  });
});
