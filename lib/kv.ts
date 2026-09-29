/**
 * Kho khoá-giá trị qua REST của Upstash Redis (không dùng SDK).
 * Chỉ import từ route handler. Thiếu biến môi trường: dev/test dùng bộ nhớ trong, production báo lỗi.
 */
export interface Kv {
  get(key: string): Promise<string | null>;
  /** Trả false nếu `nx` mà khoá đã tồn tại. */
  set(key: string, value: string, opts: { ex: number; nx?: boolean }): Promise<boolean>;
  /** Tăng bộ đếm; đặt hạn khi kết quả là 1. */
  incr(key: string, exSeconds: number): Promise<number>;
}

export class KvUnavailableError extends Error {}
export const KV_MISSING_MESSAGE = "Chưa kết nối kho lưu trữ (Upstash Redis) trên Vercel.";

function upstash(url: string, token: string): Kv {
  async function cmd(args: (string | number)[]): Promise<unknown> {
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(args),
        cache: "no-store",
      });
    } catch {
      throw new KvUnavailableError("Không kết nối được kho lưu trữ.");
    }
    if (!res.ok) throw new KvUnavailableError("Kho lưu trữ báo lỗi.");
    return ((await res.json()) as { result: unknown }).result;
  }
  return {
    async get(key) {
      const r = await cmd(["GET", key]);
      return typeof r === "string" ? r : null;
    },
    async set(key, value, { ex, nx }) {
      const r = await cmd(nx ? ["SET", key, value, "EX", ex, "NX"] : ["SET", key, value, "EX", ex]);
      return r === "OK";
    },
    async incr(key, exSeconds) {
      const n = Number(await cmd(["INCR", key]));
      if (n === 1) await cmd(["EXPIRE", key, exSeconds]);
      return n;
    },
  };
}

function memory(): Kv {
  const g = globalThis as { __xcnMem?: Map<string, { v: string; exp: number }> };
  const store = (g.__xcnMem ??= new Map());
  const live = (key: string) => {
    const e = store.get(key);
    if (e && e.exp <= Date.now()) store.delete(key);
    return store.get(key);
  };
  return {
    async get(key) {
      return live(key)?.v ?? null;
    },
    async set(key, value, { ex, nx }) {
      if (nx && live(key)) return false;
      store.set(key, { v: value, exp: Date.now() + ex * 1000 });
      return true;
    },
    async incr(key, exSeconds) {
      const e = live(key);
      const n = (e ? Number(e.v) : 0) + 1;
      store.set(key, { v: String(n), exp: e ? e.exp : Date.now() + exSeconds * 1000 });
      return n;
    },
  };
}

export function getKv(): Kv {
  const env = process.env;
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return upstash(url, token);
  if (process.env.NODE_ENV !== "production") return memory();
  throw new KvUnavailableError(KV_MISSING_MESSAGE);
}
