import { describe, expect, it } from "vitest";
import { buildNeighbors, buildSeats, newRoom } from "./room";
import { arrange, evaluate, seededRng } from "./seating";
import {
  capacityOf, distribute, minSessions, planCounts, sameUnitNeighbors, slotName, suggestSeat, swapSeats,
} from "./sessions";

function makeUnits(sizes: number[]) {
  const out: number[] = [];
  sizes.forEach((n, u) => { for (let i = 0; i < n; i++) out.push(u); });
  return out;
}
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

describe("số ca và số người mỗi phòng", () => {
  it("số ca ít nhất", () => {
    expect(minSessions(750, [48, 48, 48, 48])).toBe(4);
    expect(minSessions(192, [48, 48, 48, 48])).toBe(1);
    expect(minSessions(193, [48, 48, 48, 48])).toBe(2);
    expect(minSessions(10, [0, 0])).toBe(Infinity);
    expect(minSessions(0, [5])).toBe(1);
  });

  it("máy dự phòng trừ vào sức chứa", () => {
    expect(capacityOf(50, 2)).toBe(48);
    expect(capacityOf(50)).toBe(50);
    expect(capacityOf(3, 5)).toBe(0);
  });

  it("các ca đông gần bằng nhau, trong ca chia theo sức chứa, không phòng nào quá sức chứa", () => {
    const caps = [50, 50, 50, 42];
    const counts = planCounts(750, caps, 4);
    expect(counts.map(sum)).toEqual([188, 188, 187, 187]);
    expect(sum(counts.map(sum))).toBe(750);
    for (const row of counts) row.forEach((n, r) => expect(n).toBeLessThanOrEqual(caps[r]));
    // Phòng nhỏ nhận ít người hơn phòng lớn.
    for (const row of counts) expect(row[3]).toBeLessThan(row[0]);
  });

  it("vừa khít sức chứa thì phòng nào cũng đầy", () => {
    expect(planCounts(150, [50, 30, 70], 1)).toEqual([[50, 30, 70]]);
  });

  it("phòng không còn chỗ (toàn máy dự phòng) thì không nhận ai", () => {
    expect(planCounts(20, [0, 30], 1)).toEqual([[0, 20]]);
  });

  it("báo lỗi khi số ca không đủ chỗ", () => {
    expect(() => planCounts(750, [50, 50], 3)).toThrow();
  });
});

describe("chia người vào ca và phòng", () => {
  const sizes = [200, 150, 100, 80, 60, 50, 40, 30, 20, 10, 5, 3, 2];
  const unitOf = makeUnits(sizes);
  const counts = planCounts(unitOf.length, [48, 48, 48, 48], 4);
  const groups = distribute(unitOf, counts);

  it("ai cũng có đúng một chỗ, số người mỗi ô đúng như đã chia", () => {
    const all = groups.flat(2).sort((a, b) => a - b);
    expect(all).toEqual(unitOf.map((_, i) => i));
    groups.forEach((row, s) => row.forEach((g, r) => expect(g).toHaveLength(counts[s][r])));
  });

  it("mỗi ĐV rải đều khắp các ô (lệch không quá 1 người so với tỉ lệ)", () => {
    groups.flat().forEach((g) => {
      sizes.forEach((size, u) => {
        const expected = (size * g.length) / unitOf.length;
        const got = g.filter((p) => unitOf[p] === u).length;
        expect(Math.abs(got - expected)).toBeLessThan(1.5);
      });
    });
  });

  it("chia lại vẫn ra đúng như cũ (ai thuộc ca nào không đổi khi bấm Xếp lại)", () => {
    expect(distribute(unitOf, counts)).toEqual(groups);
  });

  it("báo lỗi khi tổng chỗ không khớp số người", () => {
    expect(() => distribute([0, 0, 1], [[1, 1]])).toThrow();
  });
});

describe("750 người, 4 phòng 50 máy, mỗi phòng giữ 2 máy dự phòng", () => {
  it("chia 4 ca, ai cũng có chỗ, không ai ngồi cạnh người cùng ĐV, phòng nào cũng trống ít nhất 2 máy", () => {
    const rooms = [1, 2, 3, 4].map((n) => newRoom({ id: `p${n}`, name: `Phòng ${n}`, blocks: 2, rows: 5, cols: 5, reserve: 2 }));
    const seatsOf = rooms.map((r) => buildSeats(r));
    const nbOf = rooms.map((r, k) => buildNeighbors(r, seatsOf[k], "lr"));
    const unitOf = makeUnits([200, 150, 100, 80, 60, 50, 40, 30, 20, 10, 5, 3, 2]);
    const caps = rooms.map((r, k) => capacityOf(seatsOf[k].length, r.reserve));
    const sessions = minSessions(unitOf.length, caps);
    expect(sessions).toBe(4);

    const groups = distribute(unitOf, planCounts(unitOf.length, caps, sessions));
    const seen = new Set<number>();
    groups.forEach((row, s) =>
      row.forEach((members, r) => {
        const res = arrange({
          unitOfPerson: members.map((p) => unitOf[p]), seatCount: seatsOf[r].length, nb: nbOf[r], spare: "tail",
          rng: seededRng(s * 10 + r), timeBudgetMs: 2000,
        });
        expect(res.conflictPairs, `ca ${s + 1} phòng ${r + 1}`).toBe(0);
        const items = res.items.map((k) => (k >= 0 ? members[k] : -1));
        expect(items.filter((x) => x < 0).length).toBeGreaterThanOrEqual(2);
        // "Trống cuối": các máy số lớn nhất để trống làm dự phòng.
        expect(items.slice(-2)).toEqual([-1, -1]);
        items.forEach((p) => p >= 0 && seen.add(p));
      }),
    );
    expect(seen.size).toBe(750);
  });
});

describe("đổi chỗ bằng tay", () => {
  const unitOf = [0, 0, 1, 1];
  // Ca 1: phòng A [0, 1, -1], phòng B [2, -1]; ca 2: phòng A [-1, -1, -1], phòng B [3, -1].
  const items = [[[0, 1, -1], [2, -1]], [[-1, -1, -1], [3, -1]]];

  it("đổi hai người khác ca, khác phòng; không sửa mảng cũ", () => {
    const next = swapSeats(items, { s: 0, r: 0, i: 1 }, { s: 1, r: 1, i: 0 });
    expect(next).toEqual([[[0, 3, -1], [2, -1]], [[-1, -1, -1], [1, -1]]]);
    expect(items[0][0]).toEqual([0, 1, -1]);
    expect(next[0][1]).toBe(items[0][1]); // ô không đụng tới giữ nguyên
  });

  it("chuyển vào máy trống", () => {
    const next = swapSeats(items, { s: 0, r: 0, i: 0 }, { s: 1, r: 0, i: 2 });
    expect(next[0][0]).toEqual([-1, 1, -1]);
    expect(next[1][0]).toEqual([-1, -1, 0]);
  });

  it("đổi trong cùng một phòng", () => {
    expect(swapSeats(items, { s: 0, r: 0, i: 0 }, { s: 0, r: 0, i: 2 })[0][0]).toEqual([-1, 1, 0]);
  });

  it("đếm người cùng ĐV ngồi kề và gợi ý máy trống không sát ai cùng ĐV", () => {
    const room = newRoom({ id: "x", blocks: 1, rows: 1, cols: 5, style: "ltr" });
    const seats = buildSeats(room);
    const nb = buildNeighbors(room, seats, "lr");
    const row = [0, -1, -1, 2, -1]; // người 0 (ĐV 0) ở máy 1, người 2 (ĐV 1) ở máy 4
    expect(sameUnitNeighbors([0, 1, -1, -1, -1], nb, unitOf, 0)).toBe(1);
    expect(sameUnitNeighbors(row, nb, unitOf, 0)).toBe(0);
    // Người 1 (ĐV 0): máy 2 sát người 0 cùng ĐV, máy 3 thì không.
    expect(suggestSeat(row, nb, unitOf, 1)).toBe(2);
    expect(suggestSeat([0, 1, 2, 3, 0], nb, unitOf, 1)).toBe(-1);
    expect(evaluate([0, 1, -1, -1, -1], nb, unitOf).conflictPairs).toBe(1);
  });
});

it("tên ô: có nhiều ca thì ghi Ca", () => {
  expect(slotName(1, "Phòng máy 1", 3)).toBe("Ca 2 · Phòng máy 1");
  expect(slotName(0, "Phòng máy 1", 1)).toBe("Phòng máy 1");
});
