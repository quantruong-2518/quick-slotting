import { describe, expect, it } from "vitest";
import { blockLayout, buildNeighbors, buildSeats, cellCount, newRoom, roomDims, sameExceptName } from "./room";
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

  it("sameExceptName: đổi tên thì vẫn coi là cùng sơ đồ, đổi thứ khác thì không", () => {
    expect(sameExceptName(room, { ...room, name: "Phòng 201" })).toBe(true);
    expect(sameExceptName(room, { ...room, off: ["0-0"] })).toBe(false);
    expect(sameExceptName(room, { ...room, reserve: 2 })).toBe(false);
    expect(sameExceptName(room, { ...room, start: 101 })).toBe(false);
    expect(sameExceptName(room, { ...room, id: "khác" })).toBe(false);
  });

  it("lối đi giữa các khoang cắt quan hệ kề", () => {
    const seats = buildSeats(room);
    const nb = buildNeighbors(room, seats, "lr");
    const i = seats.findIndex((s) => s.row === 0 && s.gcol === 4);
    const j = seats.findIndex((s) => s.row === 0 && s.gcol === 5);
    expect(nb[i]).not.toContain(j);
  });
});

describe("khoang không giống nhau", () => {
  // Khoang 1: 3 hàng × 2 cột, khoang 2: 2 hàng × 3 cột, khoang 3: 1 hàng × 1 cột.
  const sizes = [{ rows: 3, cols: 2 }, { rows: 2, cols: 3 }, { rows: 1, cols: 1 }];
  const odd = newRoom({ id: "o", ...roomDims(sizes) });

  it("roomDims: giống hệt nhau thì bỏ sizes, khác nhau thì giữ", () => {
    expect(roomDims([{ rows: 4, cols: 3 }, { rows: 4, cols: 3 }])).toEqual({ blocks: 2, rows: 4, cols: 3 });
    expect(roomDims(sizes)).toEqual({ blocks: 3, rows: 3, cols: 3, sizes });
    expect(cellCount(odd)).toBe(13);
    expect(blockLayout(odd).map((b) => b.start)).toEqual([0, 2, 5]);
  });

  it("phòng cũ không có sizes vẫn ra đúng sơ đồ như trước", () => {
    const same = newRoom({ id: "t", blocks: 3, rows: 8, cols: 5, sizes: Array.from({ length: 3 }, () => ({ rows: 8, cols: 5 })) });
    expect(buildSeats(same)).toEqual(buildSeats(room));
    expect(buildNeighbors(same, buildSeats(same), "all")).toEqual(buildNeighbors(room, buildSeats(room), "all"));
  });

  it("đánh số theo hàng ngang cả phòng, khoang hết hàng thì bỏ qua", () => {
    const seats = buildSeats(odd);
    expect(seats).toHaveLength(13);
    expect(seats.map((s) => s.number)).toEqual(Array.from({ length: 13 }, (_, i) => i + 1));
    // Hàng 1: đủ 6 cột. Hàng 2 (đi ngược): khoang 3 đã hết. Hàng 3: chỉ còn khoang 1.
    expect(seats.map((s) => s.key)).toEqual([
      "0-0", "0-1", "0-2", "0-3", "0-4", "0-5",
      "1-4", "1-3", "1-2", "1-1", "1-0",
      "2-0", "2-1",
    ]);
    expect(seats.find((s) => s.key === "1-4")).toMatchObject({ block: 1, col: 2, row: 1 });
    expect(seats.find((s) => s.key === "0-5")).toMatchObject({ block: 2, col: 0 });
    const ltr = buildSeats({ ...odd, style: "ltr" });
    expect(ltr.slice(6, 11).map((s) => s.key)).toEqual(["1-0", "1-1", "1-2", "1-3", "1-4"]);
  });

  it("đánh số từng khoang: hết khoang này mới sang khoang kia", () => {
    const snake = buildSeats({ ...odd, order: "block" });
    expect(snake.map((s) => s.number)).toEqual(Array.from({ length: 13 }, (_, i) => i + 1));
    expect(snake.map((s) => s.key)).toEqual([
      "0-0", "0-1", "1-1", "1-0", "2-0", "2-1", // khoang 1, hàng 2 đi ngược lại
      "0-2", "0-3", "0-4", "1-4", "1-3", "1-2", // khoang 2
      "0-5", // khoang 3
    ]);
    expect(snake.map((s) => s.block)).toEqual([0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 2]);
    const ltr = buildSeats({ ...odd, order: "block", style: "ltr" });
    expect(ltr.map((s) => s.key)).toEqual([
      "0-0", "0-1", "1-0", "1-1", "2-0", "2-1",
      "0-2", "0-3", "0-4", "1-2", "1-3", "1-4",
      "0-5",
    ]);
    // Phòng các khoang giống nhau cũng đánh được theo từng khoang.
    const even = buildSeats({ ...room, order: "block" });
    expect(even[40]).toMatchObject({ number: 41, key: "0-5", block: 1, col: 0 });
    expect(even[45]).toMatchObject({ number: 46, key: "1-9" });
  });

  it("đổi thứ tự đánh số không đổi ai kề ai", () => {
    const pairs = (r: typeof odd) => {
      const seats = buildSeats(r);
      return buildNeighbors(r, seats, "all").flatMap((list, i) => list.map((j) => `${seats[i].key}~${seats[j].key}`)).sort();
    };
    expect(pairs({ ...odd, order: "block" })).toEqual(pairs(odd));
  });

  it("bỏ máy vẫn theo khoá hàng-cột cả phòng", () => {
    const seats = buildSeats({ ...odd, off: ["0-2", "2-1"] });
    expect(seats).toHaveLength(11);
    expect(seats.some((s) => s.key === "0-2" || s.key === "2-1")).toBe(false);
  });

  it("kề nhau chỉ trong cùng khoang, không vượt quá số hàng của khoang", () => {
    const seats = buildSeats(odd);
    const at = (key: string) => seats.findIndex((s) => s.key === key);
    const keysOf = (nb: number[][], key: string) => nb[at(key)].map((j) => seats[j].key).sort();
    const lr = buildNeighbors(odd, seats, "lr");
    expect(keysOf(lr, "0-1")).toEqual(["0-0"]); // 0-2 thuộc khoang 2
    expect(keysOf(lr, "0-3")).toEqual(["0-2", "0-4"]);
    expect(keysOf(lr, "0-5")).toEqual([]); // khoang 3 chỉ có một máy
    const all = buildNeighbors(odd, seats, "all");
    expect(keysOf(all, "1-2")).toEqual(["0-2", "0-3", "1-3"]); // không kề 2-x vì khoang 2 chỉ có 2 hàng
    expect(keysOf(all, "2-0")).toEqual(["1-0", "1-1", "2-1"]);
  });

  it("tính cả trước-sau: hai ghế kề luôn khác màu chẵn/lẻ (worker dựa vào điều này)", () => {
    const seats = buildSeats(odd);
    const nb = buildNeighbors(odd, seats, "lrfb");
    const color = (i: number) => (seats[i].row + seats[i].gcol) % 2;
    nb.forEach((list, i) => list.forEach((j) => expect(color(j)).not.toBe(color(i))));
  });

  it("xếp được phòng có khoang khác nhau", () => {
    const big = newRoom({ id: "b", ...roomDims([{ rows: 8, cols: 5 }, { rows: 6, cols: 4 }, { rows: 8, cols: 3 }]) });
    const seats = buildSeats(big);
    const units = makeUnits([14, 12, 11, 10, 9, 8, 7, 6, 5, 4]);
    const r = arrange({
      unitOfPerson: units, seatCount: seats.length, nb: buildNeighbors(big, seats, "lrfb"), spare: "tail",
      rng: seededRng(7), timeBudgetMs: 3000,
    });
    expect(seats).toHaveLength(88);
    expect(r.conflictPairs).toBe(0);
    expect(r.items.filter((x) => x >= 0)).toHaveLength(units.length);
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

  it("cột Lĩnh vực dự kiểm tra sau cột Đơn vị", () => {
    const text = "Họ tên\tMã CC\tĐơn vị\tLĩnh vực dự kiểm tra\nA\tCC1\tSở Y tế\tKế toán\nB\tCC2\tSở Nội vụ\t";
    const a = analyzeRows(parseDelimited(text));
    expect(a.hasField).toBe(true);
    expect(a.people.map((p) => p.field)).toEqual(["Kế toán", ""]);
    // Lĩnh vực trống không phải lỗi.
    expect(a.missing).toHaveLength(0);
    expect(a.columnNote).toContain('Lĩnh vực: "Lĩnh vực dự kiểm tra"');
  });

  it("cột Lĩnh vực đứng trước Đơn vị vẫn nhận đúng, không lẫn với Đơn vị", () => {
    const text = "STT\tHọ và tên\tMã CC\tLĩnh vực\tĐơn vị công tác\n1\tA\tCC1\tThuế\tSở Tài chính";
    const a = analyzeRows(parseDelimited(text));
    expect(a.people[0]).toMatchObject({ name: "A", code: "CC1", unit: "Sở Tài chính", field: "Thuế" });
  });

  it("không có cột Lĩnh vực thì để trống", () => {
    const a = analyzeRows(parseDelimited("Họ tên\tMã CC\tĐơn vị\nA\tCC1\tSở Y tế"));
    expect(a.hasField).toBe(false);
    expect(a.people[0].field).toBe("");
    expect(a.columnNote).not.toContain("Lĩnh vực");
  });

  it("dán không có tiêu đề: cột thứ 4 là lĩnh vực như file mẫu", () => {
    const a = analyzeRows(parseDelimited("A\tCC1\tSở Y tế\tKế toán\nB\tCC2\tSở Nội vụ\tThuế"));
    expect(a.people.map((p) => p.field)).toEqual(["Kế toán", "Thuế"]);
    expect(a.hasField).toBe(true);
    expect(analyzeRows(parseDelimited("A\tCC1\tSở Y tế")).hasField).toBe(false);
  });

  it("tiêu đề dạng STT | Họ và tên | Mã công chức | Đơn vị công tác vẫn nhận đúng cột", () => {
    const text = "STT\tHọ và tên\tMã công chức\tĐơn vị công tác\n1\tNguyễn Văn A\tCC0001\tSở Nội vụ";
    const a = analyzeRows(parseDelimited(text));
    expect(a.people).toHaveLength(1);
    expect(a.people[0]).toMatchObject({ name: "Nguyễn Văn A", code: "CC0001", unit: "Sở Nội vụ" });
    expect(a.columnNote).toContain('"Họ và tên"');
  });
});
