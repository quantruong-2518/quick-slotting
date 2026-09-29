import { getKv, KvUnavailableError, type Kv } from "./kv";
import {
  CREATES_PER_HOUR, LOOKUPS_PER_MINUTE, MAX_BODY_BYTES, ROOM_TTL_SECONDS,
  findPerson, generateRoomId, generateToken, hashToken, parseRoomId, parseStored,
  timingSafeEqual, toStored, validatePayload, type SharePayload,
} from "./room-share";

/** Logic của /api/phong (chỉ chạy trên máy chủ). Route handler chỉ gọi lại các hàm này. */

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const err = (status: number, error: string) => json({ error }, status);
const NOT_FOUND_ROOM = "Không tìm thấy phòng thi (mã sai hoặc đã hết hạn).";

async function guarded(fn: (kv: Kv) => Promise<Response>): Promise<Response> {
  try {
    return await fn(getKv());
  } catch (e) {
    if (e instanceof KvUnavailableError) return err(503, e.message);
    return err(500, "Có lỗi xảy ra, hãy thử lại sau.");
  }
}

async function readPayload(req: Request): Promise<{ value: SharePayload } | { res: Response }> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return { res: err(413, "Dữ liệu quá lớn.") };
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) return { res: err(413, "Dữ liệu quá lớn.") };
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return { res: err(400, "Dữ liệu không hợp lệ.") };
  }
  const v = validatePayload(body);
  return v.ok ? { value: v.value } : { res: err(400, v.error) };
}

export function createRoom(req: Request) {
  return guarded(async (kv) => {
    const hour = Math.floor(Date.now() / 3_600_000);
    if ((await kv.incr(`rlc:${clientIp(req)}:${hour}`, 7200)) > CREATES_PER_HOUR)
      return err(429, "Bạn tạo quá nhiều phòng thi. Hãy đợi một lúc rồi thử lại.");
    const p = await readPayload(req);
    if ("res" in p) return p.res;
    const token = generateToken();
    const stored = toStored(p.value, await hashToken(token));
    const value = JSON.stringify(stored);
    for (let i = 0; i < 8; i++) {
      const id = generateRoomId();
      if (await kv.set(`phong:${id}`, value, { ex: ROOM_TTL_SECONDS, nx: true }))
        return json({ id, token, expiresAt: stored.expiresAt }, 201);
    }
    return err(503, "Không tạo được mã phòng, hãy thử lại.");
  });
}

export function updateRoom(req: Request, rawId: string) {
  return guarded(async (kv) => {
    const id = parseRoomId(rawId);
    if (!id) return err(404, NOT_FOUND_ROOM);
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    const p = await readPayload(req);
    if ("res" in p) return p.res;
    const old = parseStored(await kv.get(`phong:${id}`));
    if (!old) return err(404, NOT_FOUND_ROOM);
    if (!token || !timingSafeEqual(await hashToken(token), old.tokenHash)) return err(403, "Không có quyền cập nhật phòng thi này.");
    const stored = toStored(p.value, old.tokenHash);
    await kv.set(`phong:${id}`, JSON.stringify(stored), { ex: ROOM_TTL_SECONDS });
    return json({ id, expiresAt: stored.expiresAt });
  });
}

function clientIp(req: Request) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

/** Không bao giờ trả cả danh sách: chỉ tên phòng, sơ đồ và (nếu có ?ma=) một người. */
export function getRoom(req: Request, rawId: string) {
  return guarded(async (kv) => {
    const id = parseRoomId(rawId);
    if (!id) return err(404, NOT_FOUND_ROOM);
    const ma = new URL(req.url).searchParams.get("ma");
    if (ma !== null) {
      const minute = Math.floor(Date.now() / 60_000);
      const n = await kv.incr(`rl:${clientIp(req)}:${id}:${minute}`, 120);
      if (n > LOOKUPS_PER_MINUTE) return err(429, "Bạn tra cứu quá nhiều lần. Hãy đợi một phút rồi thử lại.");
    }
    const room = parseStored(await kv.get(`phong:${id}`));
    if (!room) return err(404, NOT_FOUND_ROOM);
    const base = { title: room.title, room: room.room, expiresAt: room.expiresAt };
    if (ma === null) return json(base);
    const person = findPerson(room.people, ma.slice(0, 100));
    if (!person) return json({ error: "Không tìm thấy mã này. Kiểm tra lại hoặc hỏi giám thị.", code: "person" }, 404);
    return json({ ...base, person });
  });
}
