import { describe, expect, it } from "vitest";
import {
  ID_ALPHABET, buildSharePayload, findPerson, generateRoomId, generateToken, hashToken,
  parseRoomId, parseStored, toStored, validatePayload,
} from "./room-share";
import { buildSeats, newRoom, roomDims } from "./room";
import type { Person, Unit } from "./types";

const room = { name: "P1", blocks: 2, rows: 2, cols: 2, style: "snake", start: 1, off: ["0-1"] };
/** Khoang 1: 2 hàng × 2 cột, khoang 2: 1 hàng × 3 cột. */
const oddRoom = { ...room, name: "P3", rows: 2, cols: 3, sizes: [{ rows: 2, cols: 2 }, { rows: 1, cols: 3 }], off: ["0-4"] };
const good = () => ({
  title: "Kỳ thi",
  rooms: [{ ...room, off: [...room.off] }, { ...room, name: "P2", off: [] }],
  people: [["CC001", 1, 0, 1, "An", "Sở A", "Kế toán"], ["cc 002", 2, 1, 1, "Bình", "Sở B", ""]],
});
/** Dạng cũ một phòng, máy khách bản trước còn gửi lên. */
const legacy = () => ({ title: "Kỳ thi", room: { ...room, off: [...room.off] }, people: [["CC001", 1, "An", "Sở A"], ["cc 002", 2, "Bình", "Sở B"]] });

describe("id và token", () => {
  it("id dài 6 ký tự, chỉ dùng bảng chữ rõ ràng", () => {
    expect(ID_ALPHABET).not.toMatch(/[01OIL]/);
    for (let i = 0; i < 200; i++) expect(generateRoomId()).toMatch(new RegExp(`^[${ID_ALPHABET}]{6}$`));
  });
  it("parseRoomId chuẩn hoá và từ chối mã sai", () => {
    expect(parseRoomId(" k7m 2qx ")).toBe("K7M2QX");
    expect(parseRoomId("K7M2Q0")).toBeNull();
    expect(parseRoomId("K7M2Q")).toBeNull();
  });
  it("token base64url 24 byte, băm SHA-256 hex", async () => {
    const t = generateToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(await hashToken("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("validatePayload", () => {
  it("nhận dữ liệu đúng", () => {
    const r = validatePayload(good());
    expect(r.ok).toBe(true);
  });
  it("nhận dạng cũ một phòng, đổi sang ca 1, phòng đầu tiên", () => {
    const r = validatePayload(legacy());
    expect(r.ok && r.value.rooms).toHaveLength(1);
    expect(r.ok && r.value.people[0]).toEqual(["CC001", 1, 0, 1, "An", "Sở A", ""]);
  });
  it.each([
    ["không phải object", null],
    ["thiếu người", { ...good(), people: [] }],
    ["không có phòng", { ...good(), rooms: [] }],
    ["quá nhiều phòng", { ...good(), rooms: Array.from({ length: 13 }, () => room) }],
    ["phòng quá lớn", { ...good(), rooms: [{ ...room, rows: 31, off: [] }] }],
    ["kiểu đánh số lạ", { ...good(), rooms: [{ ...room, style: "x" }] }],
    ["thứ tự đánh số lạ", { ...good(), rooms: [{ ...room, order: "x" }] }],
    ["ô bỏ ngoài phòng", { ...good(), rooms: [{ ...room, off: ["9-9"] }] }],
    ["ô bỏ sai dạng", { ...good(), rooms: [{ ...room, off: ["a"] }] }],
    ["số khoang riêng không khớp số khoang", { ...good(), rooms: [{ ...oddRoom, sizes: [{ rows: 2, cols: 2 }] }] }],
    ["khoang riêng quá lớn", { ...good(), rooms: [{ ...oddRoom, sizes: [{ rows: 2, cols: 2 }, { rows: 1, cols: 11 }] }] }],
    ["khoang riêng sai dạng", { ...good(), rooms: [{ ...oddRoom, sizes: [{ rows: 2, cols: 2 }, [1, 3]] }] }],
    ["ô bỏ nằm dưới khoang ngắn hơn", { ...good(), rooms: [{ ...oddRoom, off: ["1-2"] }] }],
    ["dòng thiếu cột", { ...good(), people: [["CC1", 1, 0, 1, "An", "A"]] }],
    ["số máy không phải số", { ...good(), people: [["CC1", 1, 0, "1", "An", "A", ""]] }],
    ["ca bằng 0", { ...good(), people: [["CC1", 0, 0, 1, "An", "A", ""]] }],
    ["phòng không tồn tại", { ...good(), people: [["CC1", 1, 2, 1, "An", "A", ""]] }],
    ["tên quá dài", { ...good(), people: [["CC1", 1, 0, 1, "x".repeat(201), "A", ""]] }],
    ["mã trùng sau chuẩn hoá", { ...good(), people: [["CC1", 1, 0, 1, "An", "A", ""], ["cc 1", 1, 0, 2, "B", "B", ""]] }],
    ["hai người một máy cùng ca", { ...good(), people: [["CC1", 1, 0, 1, "An", "A", ""], ["CC2", 1, 0, 1, "B", "B", ""]] }],
    ["dạng cũ thiếu cột", { ...legacy(), people: [["CC1", 1, "An"]] }],
    ["dạng cũ số máy không phải số", { ...legacy(), people: [["CC1", "1", "An", "A"]] }],
    ["quá 2000 người", { ...good(), people: Array.from({ length: 2001 }, (_, i) => [`M${i}`, 1, 0, i, "n", "u", ""]) }],
  ])("từ chối: %s", (_n, body) => {
    expect(validatePayload(body).ok).toBe(false);
  });
  it("nhận phòng có khoang khác nhau, giữ nguyên sizes", () => {
    const one = [["CC1", 1, 0, 1, "An", "A", ""]];
    const r = validatePayload({ title: "T", rooms: [oddRoom], people: one });
    expect(r.ok && r.value.rooms[0].sizes).toEqual(oddRoom.sizes);
    // Ô 1-1 có trong khoang 1 (2 hàng) nên bỏ được, dù khoang 2 chỉ có 1 hàng.
    expect(validatePayload({ title: "T", rooms: [{ ...oddRoom, off: ["1-1"] }], people: one }).ok).toBe(true);
    // Phòng thường thì không thêm sizes.
    const plain = validatePayload(good());
    expect(plain.ok && plain.value.rooms[0]).not.toHaveProperty("sizes");
  });
  it("đánh số từng khoang thì giữ order; theo cả phòng là mặc định nên bỏ đi", () => {
    const one = [["CC1", 1, 0, 1, "An", "A", ""]];
    const block = validatePayload({ title: "T", rooms: [{ ...room, order: "block" }], people: one });
    expect(block.ok && block.value.rooms[0].order).toBe("block");
    const whole = validatePayload({ title: "T", rooms: [{ ...room, order: "room" }], people: one });
    expect(whole.ok && whole.value.rooms[0]).not.toHaveProperty("order");
  });
  it("cùng số máy nhưng khác ca thì hợp lệ", () => {
    expect(validatePayload({ ...good(), people: [["CC1", 1, 0, 1, "An", "A", ""], ["CC2", 2, 0, 1, "B", "B", ""]] }).ok).toBe(true);
  });
});

describe("buildSharePayload / toStored", () => {
  const people: Person[] = [
    { line: 1, name: "An", code: "CC1", unit: "A", field: "Kế toán", unitId: 0 },
    { line: 2, name: "Bình", code: "CC2", unit: "B", field: "", unitId: 1 },
    { line: 3, name: "Chi", code: "CC3", unit: "A", field: "Thuế", unitId: 0 },
  ];
  const units: Unit[] = [
    { id: 0, name: "Sở A", count: 2, variants: [] },
    { id: 1, name: "Sở B", count: 1, variants: [] },
  ];

  it("chỉ lấy người đã ngồi, kèm ca, phòng, số máy, tên ĐV và lĩnh vực", () => {
    const r1 = newRoom({ id: "x", name: "Phòng 1", blocks: 1, rows: 1, cols: 3 });
    const r2 = newRoom({ id: "y", name: "Phòng 2", blocks: 1, rows: 1, cols: 2, start: 10 });
    const seatsOf = [buildSeats(r1), buildSeats(r2)];
    // Ca 1: phòng 1 có Bình ở máy 1, An ở máy 3; phòng 2 trống. Ca 2: Chi ở máy 11 phòng 2.
    const items = [[[1, -1, 0], [-1, -1]], [[-1, -1, -1], [-1, 2]]];
    const p = buildSharePayload([r1, r2], seatsOf, items, people, units);
    expect(p.title).toBe("Phòng 1, Phòng 2");
    expect(p.rooms.map((r) => r.name)).toEqual(["Phòng 1", "Phòng 2"]);
    expect(p.rooms[0]).not.toHaveProperty("id");
    expect(p.rooms[0]).not.toHaveProperty("reserve");
    expect(p.people).toEqual([
      ["CC2", 1, 0, 1, "Bình", "Sở B", ""],
      ["CC1", 1, 0, 3, "An", "Sở A", "Kế toán"],
      ["CC3", 2, 1, 11, "Chi", "Sở A", "Thuế"],
    ]);
    expect(validatePayload(p).ok).toBe(true);
    const s = toStored(p, "h", 1000);
    expect(s.v).toBe(3);
    expect(s.sessions).toBe(2);
    expect(s.people["CC1"]).toEqual([1, 0, 3, "An", "Sở A", "Kế toán"]);
    expect(s.expiresAt).toBe(1000 + 30 * 86400 * 1000);
  });

  it("phòng có khoang khác nhau: gửi kèm sizes, số máy tính theo sơ đồ đó", () => {
    const r1 = newRoom({ id: "x", name: "Phòng 1", ...roomDims([{ rows: 2, cols: 1 }, { rows: 1, cols: 2 }]) });
    const seats = buildSeats(r1);
    // Máy 1..3 ở hàng 1, máy 4 ở hàng 2 khoang 1.
    const p = buildSharePayload([r1], [seats], [[[-1, -1, 0, 1]]], people, units);
    expect(p.rooms[0].sizes).toEqual([{ rows: 2, cols: 1 }, { rows: 1, cols: 2 }]);
    expect(p.people.map((x) => x[3])).toEqual([3, 4]);
    expect(p.rooms[0]).not.toHaveProperty("order");
    expect(validatePayload(p).ok).toBe(true);
  });

  it("đánh số từng khoang: gửi kèm order", () => {
    const r1 = newRoom({ id: "x", name: "Phòng 1", blocks: 2, rows: 2, cols: 1, order: "block", style: "ltr" });
    const seats = buildSeats(r1);
    // Máy 1, 2 ở khoang 1; máy 3, 4 ở khoang 2. An ngồi hàng 2 khoang 1, Bình ngồi hàng 1 khoang 2.
    expect(seats.map((s) => s.key)).toEqual(["0-0", "1-0", "0-1", "1-1"]);
    const p = buildSharePayload([r1], [seats], [[[-1, 0, 1, -1]]], people, units);
    expect(p.rooms[0].order).toBe("block");
    expect(p.people.map((x) => x[3])).toEqual([2, 3]);
    expect(validatePayload(p).ok).toBe(true);
  });

  it("một phòng thì tên kỳ thi là tên phòng", () => {
    const r1 = newRoom({ id: "x", name: "Phòng 1", blocks: 1, rows: 1, cols: 3 });
    expect(buildSharePayload([r1], [buildSeats(r1)], [[[0, -1, 1]]], people, units).title).toBe("Phòng 1");
  });
});

describe("parseStored", () => {
  it("đọc bản v1 (một phòng) thành ca 1, phòng đầu tiên", () => {
    const v1 = { v: 1, title: "P1", room, people: { CC1: [5, "An", "Sở A"] }, tokenHash: "h", expiresAt: 9 };
    const s = parseStored(JSON.stringify(v1));
    expect(s).toMatchObject({ v: 3, title: "P1", rooms: [room], sessions: 1, tokenHash: "h", expiresAt: 9 });
    expect(s?.people["CC1"]).toEqual([1, 0, 5, "An", "Sở A", ""]);
  });
  it("đọc bản v2 (chưa có khoang riêng) y nguyên", () => {
    const v2 = { v: 2, title: "Kỳ thi", rooms: [room], sessions: 2, people: { CC1: [2, 0, 5, "An", "Sở A", "Thuế"] }, tokenHash: "h", expiresAt: 9 };
    expect(parseStored(JSON.stringify(v2))).toEqual({ ...v2, v: 3 });
  });
  it("bản v3 giữ sizes của phòng", () => {
    const r = validatePayload({ title: "T", rooms: [oddRoom], people: [["CC1", 1, 0, 1, "An", "A", ""]] });
    if (!r.ok) throw new Error(r.error);
    expect(parseStored(JSON.stringify(toStored(r.value, "h", 1000)))?.rooms[0].sizes).toEqual(oddRoom.sizes);
  });
  it("bỏ qua dữ liệu hỏng", () => {
    expect(parseStored("{")).toBeNull();
    expect(parseStored(JSON.stringify({ v: 2, people: {}, rooms: [] }))).toBeNull();
    expect(parseStored(JSON.stringify({ v: 3, people: {} }))).toBeNull();
    expect(parseStored(JSON.stringify({ v: 4, people: {}, rooms: [room] }))).toBeNull();
  });
});

describe("findPerson", () => {
  const people = {
    CC1038: [1, 0, 5, "An", "A", "Kế toán"],
    "2001": [2, 1, 6, "Bình", "B", ""],
  } as Record<string, [number, number, number, string, string, string]>;
  it("khớp đúng mã, bỏ khoảng trắng và hoa thường", () => {
    expect(findPerson(people, " cc 1038 ")).toEqual({ code: "CC1038", session: 1, room: 0, seat: 5, name: "An", unit: "A", field: "Kế toán" });
  });
  it("khớp khi thiếu hoặc thừa tiền tố CC", () => {
    expect(findPerson(people, "1038")?.name).toBe("An");
    expect(findPerson(people, "1038")?.code).toBe("CC1038");
    expect(findPerson(people, "CC2001")).toMatchObject({ name: "Bình", session: 2, room: 1 });
  });
  it("không khớp thì null", () => {
    expect(findPerson(people, "9999")).toBeNull();
    expect(findPerson(people, "  ")).toBeNull();
    expect(findPerson(people, "CC")).toBeNull();
  });
});
