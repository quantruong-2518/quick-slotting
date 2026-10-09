import { unitKey } from "./people";
import type { SeatRef } from "./types";

/** Nhiều phòng × nhiều ca: chia người vào từng (ca, phòng) trước, rồi mới xếp ghế trong từng phòng. */

export const MAX_ROOMS = 12;
export const MAX_SESSIONS = 30;

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

/** Số người tối đa một phòng nhận trong một ca: số máy trừ máy dự phòng. */
export const capacityOf = (seatCount: number, reserve = 0) => Math.max(0, seatCount - reserve);

/** Số ca ít nhất để đủ chỗ cho mọi người; Infinity nếu các phòng không còn chỗ nào. */
export function minSessions(people: number, capacities: number[]): number {
  const total = sum(capacities);
  if (people <= 0) return 1;
  return total > 0 ? Math.ceil(people / total) : Infinity;
}

/** Chia n thành k phần chênh nhau không quá 1, phần lớn đứng trước. */
function splitEven(n: number, k: number): number[] {
  return Array.from({ length: k }, (_, i) => Math.floor(n / k) + (i < n % k ? 1 : 0));
}

/** Chia n người cho các phòng theo tỉ lệ sức chứa (dư lớn nhất được thêm trước), không phòng nào vượt sức chứa. */
function byCapacity(n: number, caps: number[]): number[] {
  const total = sum(caps);
  if (n === 0) return caps.map(() => 0);
  const out = caps.map((c) => Math.floor((n * c) / total));
  const rest = caps.map((c) => (n * c) % total);
  const order = caps.map((_, r) => r).sort((a, b) => rest[b] - rest[a] || caps[b] - caps[a] || a - b);
  for (let k = 0, left = n - sum(out); k < left; k++) out[order[k]]++;
  return out;
}

/**
 * Số người của từng phòng trong từng ca: counts[ca][phòng].
 * Các ca đông gần bằng nhau (chênh tối đa 1 người), trong một ca chia theo sức chứa từng phòng.
 */
export function planCounts(people: number, capacities: number[], sessions: number): number[][] {
  if (sessions < minSessions(people, capacities)) throw new Error("Không đủ chỗ cho số ca này");
  return splitEven(people, sessions).map((n) => byCapacity(n, capacities));
}

/**
 * Chia người vào các ô (ca, phòng) theo counts, rải mỗi đơn vị đều khắp các ô
 * để không phòng nào dồn quá nhiều người cùng ĐV. Trả groups[ca][phòng] = chỉ số người.
 *
 * Cách làm: mỗi ô có n "vé" đặt cách đều trên đoạn [0, 1); xếp mọi vé theo vị trí,
 * rồi phát lần lượt cho danh sách đã gom theo ĐV. Một ĐV chiếm một đoạn liền nên
 * nhận vé của mọi ô gần đúng tỉ lệ: các phòng cỡ gần nhau thì lệch dưới 1 người,
 * phòng to nhỏ chênh nhiều thì có thể lệch 2–3 người.
 */
export function distribute(unitOf: number[], counts: number[][]): number[][][] {
  const tickets: { t: number; s: number; r: number }[] = [];
  counts.forEach((row, s) =>
    row.forEach((n, r) => {
      for (let k = 0; k < n; k++) tickets.push({ t: (k + 0.5) / n, s, r });
    }),
  );
  if (tickets.length !== unitOf.length) throw new Error("Số chỗ không khớp số người");
  tickets.sort((a, b) => a.t - b.t || a.s - b.s || a.r - b.r);
  const order = unitOf.map((_, i) => i).sort((a, b) => unitOf[a] - unitOf[b] || a - b);
  const groups = counts.map((row) => row.map(() => [] as number[]));
  tickets.forEach((tk, k) => groups[tk.s][tk.r].push(order[k]));
  return groups;
}

/** Một lĩnh vực trong danh sách: key để so khớp (bỏ hoa/thường/dấu), name để hiển thị, count = số người. */
export interface FieldInfo { key: string; name: string; count: number }

/**
 * Các lĩnh vực theo thứ tự sẽ xếp: `order` (key) đứng trước, lĩnh vực chưa có trong `order` theo lần xuất hiện đầu
 * tiên trong danh sách. Người không ghi lĩnh vực không tính ở đây, luôn xếp sau cùng.
 */
export function fieldList(fields: string[], order: string[] = []): FieldInfo[] {
  const found = new Map<string, FieldInfo>();
  for (const f of fields) {
    const key = unitKey(f);
    if (!key) continue;
    const info = found.get(key);
    if (info) info.count++;
    else found.set(key, { key, name: f.trim(), count: 1 });
  }
  const first = order.flatMap((k) => (found.has(k) ? [found.get(k)!] : []));
  const used = new Set(first.map((x) => x.key));
  return [...first, ...[...found.values()].filter((x) => !used.has(x.key))];
}

/** Rank của từng người theo thứ tự `fieldList`; người không ghi lĩnh vực xếp sau cùng. */
export function fieldRanks(fields: string[], order: string[] = []): number[] {
  const rank = new Map(fieldList(fields, order).map((f, i) => [f.key, i]));
  const blank = rank.size;
  return fields.map((f) => rank.get(unitKey(f)) ?? blank);
}

/** Đổi chỗ lĩnh vực thứ i với lĩnh vực kế bên (dir -1 = lên trước, 1 = xuống sau); trả danh sách key mới. */
export function moveField(keys: string[], i: number, dir: -1 | 1): string[] {
  const j = i + dir;
  if (i < 0 || i >= keys.length || j < 0 || j >= keys.length) return keys;
  const next = keys.slice();
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** Một phòng khi chia theo lĩnh vực: sức chứa, và limit[p] = số người tối đa của một ĐV khi phòng có p người (`unitLimits`). */
export interface FieldCell { capacity: number; limit: number[] }

/** Ô không ràng buộc ĐV: chỉ dồn đầy theo sức chứa. */
const looseCell = (c: FieldCell): FieldCell => ({ capacity: c.capacity, limit: c.limit.map(() => c.capacity) });

/** Chọn người cho một ô từ hàng đợi `left` (theo thứ tự ưu tiên) rồi bỏ họ khỏi hàng đợi. */
function fillCell(left: number[], unitOf: number[], cell: FieldCell): number[] {
  const { capacity, limit } = cell;
  const count = new Map<number, number>();
  const chosen: number[] = []; // vị trí trong left
  for (let k = 0; k < left.length && chosen.length < capacity; k++) {
    const u = unitOf[left[k]];
    if ((count.get(u) ?? 0) >= limit[capacity]) continue; // ĐV này đã đủ số người tối đa của phòng đầy, để dành ô sau
    count.set(u, (count.get(u) ?? 0) + 1);
    chosen.push(k);
  }
  // Phòng không đầy thì giới hạn thấp hơn: bớt người của ĐV còn vượt (người chọn sau cùng đi trước).
  for (;;) {
    const over = [...count].find(([, c]) => c > limit[chosen.length])?.[0];
    if (over === undefined) break;
    const at = chosen.findLastIndex((k) => unitOf[left[k]] === over);
    chosen.splice(at, 1);
    count.set(over, count.get(over)! - 1);
  }
  const people = chosen.map((k) => left[k]);
  const gone = new Set(chosen);
  left.splice(0, left.length, ...left.filter((_, k) => !gone.has(k)));
  return people;
}

/**
 * Xếp theo lĩnh vực: lần lượt từng lĩnh vực (theo rank) vào ca 1 – phòng 1 cho đầy, hết chỗ thì sang phòng kế,
 * hết các phòng của ca thì sang ca kế. Trong một lĩnh vực các ĐV được trộn đều (người thứ k của ĐV có k/số người
 * làm khoá, nên đầu hàng đợi luôn có đủ các ĐV theo tỉ lệ). Để không ai phải ngồi cạnh người cùng ĐV, một ĐV không
 * được quá `limit` người trong một phòng: người vượt để dành cho phòng sau, ô còn chỗ thì lấy người lĩnh vực kế
 * (trộn khác lĩnh vực) và nếu vẫn không đủ thì để trống chỗ, nên có thể cần nhiều ca hơn số ca ít nhất.
 * Quá `maxSessions` ca thì bỏ giới hạn, dồn đầy theo sức chứa. Trả groups[ca][phòng] = chỉ số người.
 */
export function planByField(rank: number[], unitOf: number[], rooms: FieldCell[], maxSessions: number): number[][][] {
  const capacity = sum(rooms.map((r) => r.capacity));
  if (rank.length > capacity * maxSessions) throw new Error("Không đủ chỗ cho số ca này");
  const queue: number[] = [];
  for (const k of [...new Set(rank)].sort((a, b) => a - b)) {
    const members = rank.flatMap((x, i) => (x === k ? [i] : []));
    const size = new Map<number, number>();
    members.forEach((p) => size.set(unitOf[p], (size.get(unitOf[p]) ?? 0) + 1));
    const seen = new Map<number, number>();
    const key = new Map(members.map((p) => {
      const j = seen.get(unitOf[p]) ?? 0;
      seen.set(unitOf[p], j + 1);
      return [p, (j + 0.5) / size.get(unitOf[p])!];
    }));
    queue.push(...members.sort((a, b) => key.get(a)! - key.get(b)! || unitOf[a] - unitOf[b] || a - b));
  }
  const place = (cells: FieldCell[], max: number) => {
    const left = queue.slice();
    const groups: number[][][] = [];
    // Còn lại toàn người của một ĐV mà phòng không thể nhận nổi (vd. máy dự phòng dồn cuối thì một ĐV đứng riêng
    // không bao giờ ngồi cách nhau được): thêm ca cũng vô ích, từ đó dồn đầy như cũ, chỗ trùng sẽ được báo sau khi xếp.
    let strict = true;
    while (left.length && groups.length < max) {
      const row = cells.map((cell) => {
        if (strict) {
          const before = left.slice();
          const got = fillCell(left, unitOf, cell);
          if (!(got.length < Math.min(cell.capacity, before.length) && got.length * 4 < cell.capacity)) return got;
          left.splice(0, left.length, ...before);
          strict = false;
        }
        return fillCell(left, unitOf, looseCell(cell));
      });
      if (row.every((x) => !x.length)) break;
      groups.push(row);
    }
    return left.length ? null : groups;
  };
  return place(rooms, maxSessions) ?? place(rooms.map(looseCell), maxSessions)!;
}

/** Đổi chỗ hai ghế, có thể khác ca, khác phòng; ghế đích trống thì là chuyển sang. Trả bản sao mới. */
export function swapSeats(items: number[][][], a: SeatRef, b: SeatRef): number[][][] {
  const next = items.map((row) => row.slice());
  const ra = (next[a.s][a.r] = next[a.s][a.r].slice());
  const rb = a.s === b.s && a.r === b.r ? ra : (next[b.s][b.r] = next[b.s][b.r].slice());
  [ra[a.i], rb[b.i]] = [rb[b.i], ra[a.i]];
  return next;
}

/** Số người cùng ĐV ngồi kề ghế i (không tính chính người ở ghế i). */
export function sameUnitNeighbors(items: number[], nb: number[][], unitOf: number[], i: number): number {
  const p = items[i];
  if (p < 0) return 0;
  return nb[i].filter((j) => items[j] >= 0 && unitOf[items[j]] === unitOf[p]).length;
}

/** Máy trống hợp nhất cho người p trong một phòng: ít người cùng ĐV kề nhất, rồi số máy nhỏ nhất. -1 nếu hết máy trống. */
export function suggestSeat(items: number[], nb: number[][], unitOf: number[], p: number): number {
  let best = -1;
  let bestCost = Infinity;
  items.forEach((x, i) => {
    if (x >= 0) return;
    const cost = nb[i].filter((j) => items[j] >= 0 && items[j] !== p && unitOf[items[j]] === unitOf[p]).length;
    if (cost < bestCost) { bestCost = cost; best = i; }
  });
  return best;
}

/**
 * Ô (ca, phòng) kế tiếp còn cặp cùng ĐV ngồi cạnh nhau: tìm từ ngay sau ô đang xem, hết thì quay vòng
 * (có thể về chính ô đang xem); null nếu không ô nào còn. pairs[ca][phòng] = số cặp.
 */
export function nextConflictSlot(pairs: number[][], cur: { s: number; r: number }): { s: number; r: number } | null {
  const R = pairs[0]?.length ?? 0;
  const total = pairs.length * R;
  const start = cur.s * R + cur.r;
  for (let k = 1; k <= total; k++) {
    const at = (start + k) % total;
    const s = Math.floor(at / R);
    const r = at % R;
    if (pairs[s][r] > 0) return { s, r };
  }
  return null;
}

/** Tên một ô cho người đọc: "Ca 2 · Phòng máy 1"; chỉ có một ca thì chỉ còn tên phòng. */
export const slotName = (s: number, roomName: string, sessions: number) =>
  sessions > 1 ? `Ca ${s + 1} · ${roomName}` : roomName;
