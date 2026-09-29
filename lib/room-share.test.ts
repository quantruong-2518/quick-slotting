import { describe, expect, it } from "vitest";
import {
  ID_ALPHABET, buildSharePayload, findPerson, generateRoomId, generateToken, hashToken,
  parseRoomId, toStored, validatePayload,
} from "./room-share";
import { buildSeats, newRoom } from "./room";
import type { Person, Unit } from "./types";

const room = { name: "P1", blocks: 2, rows: 2, cols: 2, style: "snake", start: 1, off: ["0-1"] };
const good = () => ({ title: "Kỳ thi", room: { ...room, off: [...room.off] }, people: [["CC001", 1, "An", "Sở A"], ["cc 002", 2, "Bình", "Sở B"]] });

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
  it.each([
    ["không phải object", null],
    ["thiếu người", { ...good(), people: [] }],
    ["phòng quá lớn", { ...good(), room: { ...room, rows: 31, off: [] } }],
    ["kiểu đánh số lạ", { ...good(), room: { ...room, style: "x" } }],
    ["ô bỏ ngoài phòng", { ...good(), room: { ...room, off: ["9-9"] } }],
    ["ô bỏ sai dạng", { ...good(), room: { ...room, off: ["a"] } }],
    ["dòng thiếu cột", { ...good(), people: [["CC1", 1, "An"]] }],
    ["số máy không phải số", { ...good(), people: [["CC1", "1", "An", "A"]] }],
    ["tên quá dài", { ...good(), people: [["CC1", 1, "x".repeat(201), "A"]] }],
    ["mã trùng sau chuẩn hoá", { ...good(), people: [["CC1", 1, "An", "A"], ["cc 1", 2, "B", "B"]] }],
    ["quá 2000 người", { ...good(), people: Array.from({ length: 2001 }, (_, i) => [`M${i}`, i, "n", "u"]) }],
  ])("từ chối: %s", (_n, body) => {
    expect(validatePayload(body).ok).toBe(false);
  });
});

describe("buildSharePayload / toStored", () => {
  it("chỉ lấy người đã ngồi, kèm số máy và tên ĐV", () => {
    const r = newRoom({ id: "x", name: "Phòng 1", blocks: 1, rows: 1, cols: 3 });
    const seats = buildSeats(r);
    const people: Person[] = [
      { line: 1, name: "An", code: "CC1", unit: "A", unitId: 0 },
      { line: 2, name: "Bình", code: "CC2", unit: "B", unitId: 1 },
    ];
    const units: Unit[] = [
      { id: 0, name: "Sở A", count: 1, variants: [] },
      { id: 1, name: "Sở B", count: 1, variants: [] },
    ];
    const p = buildSharePayload(r, seats, [1, -1, 0], people, units);
    expect(p.title).toBe("Phòng 1");
    expect(p.people).toEqual([["CC2", 1, "Bình", "Sở B"], ["CC1", 3, "An", "Sở A"]]);
    expect(validatePayload(p).ok).toBe(true);
    const s = toStored(p, "h", 1000);
    expect(s.people["CC1"]).toEqual([3, "An", "Sở A"]);
    expect(s.expiresAt).toBe(1000 + 30 * 86400 * 1000);
  });
});

describe("findPerson", () => {
  const people = { CC1038: [5, "An", "A"], "2001": [6, "Bình", "B"] } as Record<string, [number, string, string]>;
  it("khớp đúng mã, bỏ khoảng trắng và hoa thường", () => {
    expect(findPerson(people, " cc 1038 ")?.seat).toBe(5);
  });
  it("khớp khi thiếu hoặc thừa tiền tố CC", () => {
    expect(findPerson(people, "1038")?.name).toBe("An");
    expect(findPerson(people, "1038")?.code).toBe("CC1038");
    expect(findPerson(people, "CC2001")?.name).toBe("Bình");
  });
  it("không khớp thì null", () => {
    expect(findPerson(people, "9999")).toBeNull();
    expect(findPerson(people, "  ")).toBeNull();
    expect(findPerson(people, "CC")).toBeNull();
  });
});
