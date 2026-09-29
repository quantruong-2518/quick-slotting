import type { SharePayload } from "./room-share";

const KEY = "xcn.share.v1";

/** Mã phòng đã chia sẻ của một sơ đồ: giữ nguyên để QR đã in vẫn dùng được. */
export interface SavedShare {
  id: string;
  token: string;
  expiresAt: number;
  /** Dấu vân tay của dữ liệu đã đăng, để biết kết quả có bị đổi sau đó không. */
  fp: string;
}

function readAll(): Record<string, SavedShare> {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return d && typeof d === "object" ? d : {};
  } catch {
    return {};
  }
}

export const loadShare = (roomId: string): SavedShare | null => readAll()[roomId] ?? null;

function saveShare(roomId: string, s: SavedShare) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...readAll(), [roomId]: s }));
  } catch {
    /* bộ nhớ đầy hoặc bị chặn: bỏ qua, lần sau sẽ tạo mã mới */
  }
}

export function fingerprint(payload: SharePayload): string {
  const s = JSON.stringify(payload);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return `${s.length}.${h.toString(36)}`;
}

async function call(url: string, method: string, payload: SharePayload, token?: string) {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error("Không kết nối được mạng. Kiểm tra lại rồi thử lại.");
  }
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data: data as { id?: string; token?: string; expiresAt?: number; error?: string } };
}

/** Đăng (hoặc cập nhật) phòng thi. Đã có mã cho sơ đồ này thì cập nhật đúng mã đó. */
export async function publishRoom(localRoomId: string, payload: SharePayload): Promise<SavedShare> {
  const fp = fingerprint(payload);
  const saved = loadShare(localRoomId);
  if (saved) {
    const r = await call(`/api/phong/${saved.id}`, "PUT", payload, saved.token);
    if (r.ok) {
      const next = { ...saved, expiresAt: r.data.expiresAt ?? saved.expiresAt, fp };
      saveShare(localRoomId, next);
      return next;
    }
    if (r.status !== 404) throw new Error(r.data.error ?? "Không cập nhật được phòng thi.");
  }
  const r = await call("/api/phong", "POST", payload);
  if (!r.ok || !r.data.id || !r.data.token) throw new Error(r.data.error ?? "Không tạo được phòng thi.");
  const next = { id: r.data.id, token: r.data.token, expiresAt: r.data.expiresAt ?? 0, fp };
  saveShare(localRoomId, next);
  return next;
}
