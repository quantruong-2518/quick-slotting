import { LIMITS } from "./room";
import { normalizeCode } from "./people";
import type { RoomConfig, Seat, Unit, Person } from "./types";

/** Phòng thi chia sẻ: chỉ chứa dữ liệu cần để tra chỗ, không có id cục bộ. */
export type SharedRoom = Omit<RoomConfig, "id">;
/** [mã CC, số máy, họ tên, đơn vị] */
export type PersonRow = [string, number, string, string];
export interface SharePayload {
  title: string;
  room: SharedRoom;
  people: PersonRow[];
}
export interface FoundPerson {
  /** Mã CC đã chuẩn hoá như lúc lưu (không phải chữ người dùng gõ). */
  code: string;
  seat: number;
  name: string;
  unit: string;
}
/** Bản ghi lưu trên máy chủ (khoá `phong:{ID}`). */
export interface StoredRoom {
  v: 1;
  title: string;
  room: SharedRoom;
  /** Khoá là mã CC đã chuẩn hoá: [số máy, họ tên, đơn vị]. */
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

/** Kiểm tra chặt dữ liệu do máy khách gửi lên. */
export function validatePayload(input: unknown): Validated {
  if (!isObj(input)) return bad("Dữ liệu không hợp lệ.");
  const { title, room, people } = input;
  if (!isStr(title, 200)) return bad("Tên phòng thi không hợp lệ.");
  if (!isObj(room)) return bad("Sơ đồ phòng không hợp lệ.");
  const { name, blocks, rows, cols, style, start, off } = room;
  if (!isStr(name, 200)) return bad("Tên phòng không hợp lệ.");
  if (!isInt(blocks, 1, LIMITS.blocks) || !isInt(rows, 1, LIMITS.rows) || !isInt(cols, 1, LIMITS.cols))
    return bad("Kích thước phòng vượt giới hạn.");
  if (style !== "snake" && style !== "ltr") return bad("Kiểu đánh số không hợp lệ.");
  if (!isInt(start, 0, 100_000)) return bad("Số máy bắt đầu không hợp lệ.");
  if (!Array.isArray(off) || off.length > blocks * cols * rows) return bad("Danh sách máy bỏ không hợp lệ.");
  for (const k of off) {
    if (!isStr(k, 12, 3) || !/^\d+-\d+$/.test(k)) return bad("Danh sách máy bỏ không hợp lệ.");
    const [r, c] = k.split("-").map(Number);
    if (r >= rows || c >= blocks * cols) return bad("Danh sách máy bỏ không hợp lệ.");
  }
  if (!Array.isArray(people) || people.length === 0) return bad("Danh sách người dự thi trống.");
  if (people.length > MAX_PEOPLE) return bad(`Tối đa ${MAX_PEOPLE} người dự thi.`);
  const seen = new Set<string>();
  const rowsOut: PersonRow[] = [];
  for (const p of people) {
    if (!Array.isArray(p) || p.length !== 4) return bad("Dòng người dự thi không hợp lệ.");
    const [code, seat, pname, unit] = p;
    if (!isStr(code, 50, 1) || !isInt(seat, 0, 1_000_000) || !isStr(pname, 200) || !isStr(unit, 200))
      return bad("Dòng người dự thi không hợp lệ.");
    const key = normalizeCode(code);
    if (!key) return bad("Có mã CC bị trống.");
    if (seen.has(key)) return bad(`Mã CC bị trùng: ${key}.`);
    seen.add(key);
    rowsOut.push([code, seat, pname, unit]);
  }
  return {
    ok: true,
    value: {
      title,
      room: { name, blocks, rows, cols, style, start, off: [...(off as string[])] },
      people: rowsOut,
    },
  };
}

/** Dựng dữ liệu chia sẻ từ kết quả xếp chỗ (items[i] = chỉ số người ở ghế i, hoặc -1). */
export function buildSharePayload(
  room: RoomConfig,
  seats: Seat[],
  items: number[],
  people: Person[],
  units: Unit[],
): SharePayload {
  return {
    title: room.name,
    room: { name: room.name, blocks: room.blocks, rows: room.rows, cols: room.cols, style: room.style, start: room.start, off: [...room.off] },
    people: seats.flatMap((s, i) => {
      const p = items[i] >= 0 ? people[items[i]] : null;
      return p ? [[p.code, s.number, p.name, units[p.unitId].name] as PersonRow] : [];
    }),
  };
}

export function toStored(payload: SharePayload, tokenHash: string, now = Date.now()): StoredRoom {
  const people: StoredRoom["people"] = {};
  for (const [code, seat, name, unit] of payload.people) people[normalizeCode(code)] = [seat, name, unit];
  return {
    v: 1,
    title: payload.title,
    room: payload.room,
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
  return key && hit ? { code: key, seat: hit[0], name: hit[1], unit: hit[2] } : null;
}

export function parseStored(raw: string | null): StoredRoom | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as StoredRoom;
    return d && d.v === 1 && isObj(d.people) && isObj(d.room) ? d : null;
  } catch {
    return null;
  }
}
