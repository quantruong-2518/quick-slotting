import { LIMITS } from "./room";
import { normalizeCode } from "./people";
import { MAX_ROOMS, MAX_SESSIONS } from "./sessions";
import type { RoomConfig, Seat, Unit, Person } from "./types";

/** Phòng thi chia sẻ: chỉ chứa dữ liệu cần để tra chỗ, không có id cục bộ. */
export type SharedRoom = Omit<RoomConfig, "id" | "reserve">;
/** [mã CC, ca (từ 1), phòng (vị trí trong `rooms`), số máy, họ tên, đơn vị, lĩnh vực] */
export type PersonRow = [string, number, number, number, string, string, string];
export interface SharePayload {
  title: string;
  rooms: SharedRoom[];
  people: PersonRow[];
}
export interface FoundPerson {
  /** Mã CC đã chuẩn hoá như lúc lưu (không phải chữ người dùng gõ). */
  code: string;
  /** Ca, tính từ 1. */
  session: number;
  /** Vị trí phòng trong `rooms`. */
  room: number;
  seat: number;
  name: string;
  unit: string;
  field: string;
}
/** Bản ghi lưu trên máy chủ (khoá `phong:{ID}`). */
export interface StoredRoom {
  v: 2;
  title: string;
  rooms: SharedRoom[];
  sessions: number;
  /** Khoá là mã CC đã chuẩn hoá: [ca, phòng, số máy, họ tên, đơn vị, lĩnh vực]. */
  people: Record<string, [number, number, number, string, string, string]>;
  tokenHash: string;
  expiresAt: number;
}
/** Bản ghi cũ: một phòng, một ca, chưa có lĩnh vực. */
interface StoredRoomV1 {
  v: 1;
  title: string;
  room: SharedRoom;
  people: Record<string, [number, string, string]>;
  tokenHash: string;
  expiresAt: number;
}

export const ROOM_TTL_SECONDS = 30 * 24 * 60 * 60;
export const MAX_BODY_BYTES = 500_000;
export const MAX_PEOPLE = 2000;
export const LOOKUPS_PER_MINUTE = 30;
/** Chặn spam tạo phòng làm đầy kho lưu trữ. */
export const CREATES_PER_HOUR = 30;
export const ID_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // bỏ 0 O 1 I L cho khỏi nhầm
export const ID_LENGTH = 6;
const ID_RE = new RegExp(`^[${ID_ALPHABET}]{${ID_LENGTH}}$`);

function randomBytes(n: number) {
  return crypto.getRandomValues(new Uint8Array(n));
}

export function generateRoomId(): string {
  let id = "";
  const limit = 256 - (256 % ID_ALPHABET.length); // bỏ giá trị lệch để mỗi ký tự đều xác suất
  while (id.length < ID_LENGTH) {
    for (const b of randomBytes(16)) {
      if (b < limit && id.length < ID_LENGTH) id += ID_ALPHABET[b % ID_ALPHABET.length];
    }
  }
  return id;
}

/** Chuẩn hoá mã phòng người dùng gõ; trả về null nếu sai dạng. */
export function parseRoomId(s: string): string | null {
  const id = s.replace(/\s+/g, "").toUpperCase();
  return ID_RE.test(id) ? id : null;
}

export function generateToken(): string {
  return btoa(String.fromCharCode(...randomBytes(24)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function hashToken(token: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const isInt = (x: unknown, min: number, max: number): x is number =>
  typeof x === "number" && Number.isInteger(x) && x >= min && x <= max;
const isStr = (x: unknown, max: number, min = 0): x is string => typeof x === "string" && x.length >= min && x.length <= max;

export type Validated = { ok: true; value: SharePayload } | { ok: false; error: string };
const bad = (error: string): Validated => ({ ok: false, error });

function validateRoom(room: unknown): SharedRoom | string {
  if (!isObj(room)) return "Sơ đồ phòng không hợp lệ.";
  const { name, blocks, rows, cols, style, start, off } = room;
  if (!isStr(name, 200)) return "Tên phòng không hợp lệ.";
  if (!isInt(blocks, 1, LIMITS.blocks) || !isInt(rows, 1, LIMITS.rows) || !isInt(cols, 1, LIMITS.cols))
    return "Kích thước phòng vượt giới hạn.";
  if (style !== "snake" && style !== "ltr") return "Kiểu đánh số không hợp lệ.";
  if (!isInt(start, 0, 100_000)) return "Số máy bắt đầu không hợp lệ.";
  if (!Array.isArray(off) || off.length > blocks * cols * rows) return "Danh sách máy bỏ không hợp lệ.";
  for (const k of off) {
    if (!isStr(k, 12, 3) || !/^\d+-\d+$/.test(k)) return "Danh sách máy bỏ không hợp lệ.";
    const [r, c] = k.split("-").map(Number);
    if (r >= rows || c >= blocks * cols) return "Danh sách máy bỏ không hợp lệ.";
  }
  return { name, blocks, rows, cols, style, start, off: [...(off as string[])] };
}

/** Kiểm tra chặt dữ liệu do máy khách gửi lên. Vẫn nhận dạng cũ một phòng `{ room, people: [mã, máy, tên, ĐV] }`. */
export function validatePayload(input: unknown): Validated {
  if (!isObj(input)) return bad("Dữ liệu không hợp lệ.");
  const { title, people } = input;
  const legacy = !("rooms" in input) && "room" in input;
  const rooms = legacy ? [input.room] : input.rooms;
  if (!isStr(title, 200)) return bad("Tên phòng thi không hợp lệ.");
  if (!Array.isArray(rooms) || rooms.length === 0 || rooms.length > MAX_ROOMS) return bad("Danh sách phòng không hợp lệ.");
  const roomsOut: SharedRoom[] = [];
  for (const room of rooms) {
    const r = validateRoom(room);
    if (typeof r === "string") return bad(r);
    roomsOut.push(r);
  }
  if (!Array.isArray(people) || people.length === 0) return bad("Danh sách người dự thi trống.");
  if (people.length > MAX_PEOPLE) return bad(`Tối đa ${MAX_PEOPLE} người dự thi.`);
  const seen = new Set<string>();
  const taken = new Set<string>();
  const rowsOut: PersonRow[] = [];
  for (const p of people) {
    const row: unknown = legacy && Array.isArray(p) && p.length === 4 ? [p[0], 1, 0, p[1], p[2], p[3], ""] : p;
    if (!Array.isArray(row) || row.length !== 7) return bad("Dòng người dự thi không hợp lệ.");
    const [code, session, room, seat, pname, unit, field] = row;
    if (
      !isStr(code, 50, 1) || !isInt(session, 1, MAX_SESSIONS) || !isInt(room, 0, roomsOut.length - 1) ||
      !isInt(seat, 0, 1_000_000) || !isStr(pname, 200) || !isStr(unit, 200) || !isStr(field, 200)
    )
      return bad("Dòng người dự thi không hợp lệ.");
    const key = normalizeCode(code);
    if (!key) return bad("Có mã CC bị trống.");
    if (seen.has(key)) return bad(`Mã CC bị trùng: ${key}.`);
    seen.add(key);
    const at = `${session}-${room}-${seat}`;
    if (taken.has(at)) return bad(`Hai người cùng ngồi máy ${seat} (ca ${session}).`);
    taken.add(at);
    rowsOut.push([code, session, room, seat, pname, unit, field]);
  }
  return { ok: true, value: { title, rooms: roomsOut, people: rowsOut } };
}

const toShared = (r: RoomConfig): SharedRoom => ({
  name: r.name, blocks: r.blocks, rows: r.rows, cols: r.cols, style: r.style, start: r.start, off: [...r.off],
});

/** Dựng dữ liệu chia sẻ từ kết quả xếp chỗ: items[ca][phòng][ghế] = chỉ số người, hoặc -1. */
export function buildSharePayload(
  rooms: RoomConfig[],
  seatsOf: Seat[][],
  items: number[][][],
  people: Person[],
  units: Unit[],
): SharePayload {
  const rows: PersonRow[] = [];
  items.forEach((row, s) =>
    row.forEach((its, r) =>
      seatsOf[r].forEach((seat, i) => {
        const p = its[i] >= 0 ? people[its[i]] : null;
        if (p) rows.push([p.code, s + 1, r, seat.number, p.name, units[p.unitId].name, p.field]);
      }),
    ),
  );
  return { title: rooms.map((r) => r.name).join(", ").slice(0, 200), rooms: rooms.map(toShared), people: rows };
}

export function toStored(payload: SharePayload, tokenHash: string, now = Date.now()): StoredRoom {
  const people: StoredRoom["people"] = {};
  let sessions = 1;
  for (const [code, session, room, seat, name, unit, field] of payload.people) {
    people[normalizeCode(code)] = [session, room, seat, name, unit, field];
    sessions = Math.max(sessions, session);
  }
  return {
    v: 2,
    title: payload.title,
    rooms: payload.rooms,
    sessions,
    people,
    tokenHash,
    expiresAt: now + ROOM_TTL_SECONDS * 1000,
  };
}

const stripCC = (s: string) => s.replace(/^CC/, "");

/** Khớp đúng mã trước; không có thì bỏ tiền tố "CC" ở cả hai phía. */
export function findPerson(people: StoredRoom["people"], input: string): FoundPerson | null {
  const c = normalizeCode(input);
  if (!c) return null;
  let key: string | undefined = people[c] ? c : undefined;
  if (!key) {
    const bare = stripCC(c);
    if (bare) key = Object.keys(people).find((k) => stripCC(k) === bare);
  }
  const hit = key ? people[key] : undefined;
  if (!key || !hit) return null;
  const [session, room, seat, name, unit, field] = hit;
  return { code: key, session, room, seat, name, unit, field };
}

/** Đọc bản ghi đã lưu; bản v1 (một phòng) được đổi sang v2 với ca 1, phòng đầu tiên. */
export function parseStored(raw: string | null): StoredRoom | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as StoredRoom | StoredRoomV1;
    if (!d || !isObj(d.people)) return null;
    if (d.v === 2) return Array.isArray(d.rooms) && d.rooms.length > 0 ? d : null;
    if (d.v !== 1 || !isObj(d.room)) return null;
    const people: StoredRoom["people"] = {};
    for (const [k, [seat, name, unit]] of Object.entries(d.people)) people[k] = [1, 0, seat, name, unit, ""];
    return { v: 2, title: d.title, rooms: [d.room], sessions: 1, people, tokenHash: d.tokenHash, expiresAt: d.expiresAt };
  } catch {
    return null;
  }
}
