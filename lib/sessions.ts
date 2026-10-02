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
 * nhận vé của mọi ô theo đúng tỉ lệ (chênh không quá 1 người mỗi ô).
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

/** Tên một ô cho người đọc: "Ca 2 · Phòng máy 1"; chỉ có một ca thì chỉ còn tên phòng. */
export const slotName = (s: number, roomName: string, sessions: number) =>
  sessions > 1 ? `Ca ${s + 1} · ${roomName}` : roomName;
