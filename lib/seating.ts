import type { ArrangeResult, SpareMode } from "./types";

export type Rng = () => number;

/** Bộ sinh số ngẫu nhiên có hạt giống, dùng cho kiểm thử. */
export function seededRng(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function shuffle<T>(a: T[], rng: Rng): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Số người tối đa của một đơn vị có thể ngồi mà không ai kề nhau,
 * trên đồ thị con gồm các ghế 0..usable-1. Trả null khi không tính nhanh được.
 */
export function maxIndependent(nb: number[][], usable: number, bipartiteColor?: (i: number) => 0 | 1): number | null {
  const isPath = nb.slice(0, usable).every((n) => n.filter((j) => j < usable).length <= 2);
  if (isPath && !bipartiteColor) {
    const seen = new Uint8Array(usable);
    let total = 0;
    for (let k = 0; k < usable; k++) {
      if (seen[k]) continue;
      let size = 0;
      const stack = [k];
      seen[k] = 1;
      while (stack.length) {
        const x = stack.pop()!;
        size++;
        for (const y of nb[x]) if (y < usable && !seen[y]) { seen[y] = 1; stack.push(y); }
      }
      total += Math.ceil(size / 2);
    }
    return total;
  }
  if (!bipartiteColor) return null;
  // Đồ thị hai phía: tập độc lập lớn nhất = số đỉnh - cặp ghép lớn nhất (định lý Kőnig).
  const matchR = new Int32Array(usable).fill(-1);
  const tryKuhn = (u: number, vis: Uint8Array): boolean => {
    for (const v of nb[u]) {
      if (v >= usable || vis[v]) continue;
      vis[v] = 1;
      if (matchR[v] < 0 || tryKuhn(matchR[v], vis)) { matchR[v] = u; return true; }
    }
    return false;
  };
  let match = 0;
  for (let k = 0; k < usable; k++) if (bipartiteColor(k) === 0 && tryKuhn(k, new Uint8Array(usable))) match++;
  return usable - match;
}

interface ArrangeInput {
  unitOfPerson: number[];
  seatCount: number;
  nb: number[][];
  spare: SpareMode;
  /** Màu hai phía của ghế (chẵn/lẻ theo hàng+cột), để tính giới hạn chính xác khi tính cả trước-sau. */
  bipartite?: (seatIndex: number) => 0 | 1;
  exactPathBound?: boolean;
  rng?: Rng;
  timeBudgetMs?: number;
  now?: () => number;
}

/**
 * Xếp chỗ: xáo trộn ngẫu nhiên rồi tìm kiếm cục bộ (hoán đổi ghế đang vi phạm)
 * cho tới khi không còn cặp cùng đơn vị ngồi kề hoặc hết thời gian.
 */
export function arrange(input: ArrangeInput): ArrangeResult {
  const { unitOfPerson, seatCount: s, nb, spare } = input;
  const rng = input.rng ?? Math.random;
  const now = input.now ?? (() => performance.now());
  const p = unitOfPerson.length;
  if (p > s) throw new Error("Số người nhiều hơn số máy");

  const usable = spare === "tail" || s === p ? p : s;
  const movable = Array.from({ length: usable }, (_, k) => k);

  const counts = new Map<number, number>();
  unitOfPerson.forEach((u) => counts.set(u, (counts.get(u) ?? 0) + 1));
  const bound = input.exactPathBound || input.bipartite ? maxIndependent(nb, usable, input.bipartite) : null;
  const capacityIssues: ArrangeResult["capacityIssues"] = [];
  if (bound !== null) counts.forEach((c, u) => { if (c > bound) capacityIssues.push({ unitId: u, count: c, max: bound }); });

  const deadline = now() + (input.timeBudgetMs ?? (capacityIssues.length ? 1200 : 4000));
  let best: number[] | null = null;
  let bestTotal = Infinity;

  while (true) {
    const pool: number[] = [];
    for (let i = 0; i < p; i++) pool.push(i);
    for (let t = 0; t < usable - p; t++) pool.push(-1);
    shuffle(pool, rng);
    const items = new Array<number>(s).fill(-1);
    movable.forEach((k, i) => { items[k] = pool[i]; });
    const r = localSearch(items, movable, nb, unitOfPerson, deadline, rng, now);
    if (r.total < bestTotal) { bestTotal = r.total; best = r.items; }
    if (bestTotal === 0 || now() > deadline) break;
  }

  const items = best!;
  const conflictSeats = new Set<number>();
  let pairs = 0;
  for (let k = 0; k < s; k++) {
    if (items[k] < 0) continue;
    const uk = unitOfPerson[items[k]];
    for (const j of nb[k]) {
      if (j > k && items[j] >= 0 && unitOfPerson[items[j]] === uk) {
        pairs++;
        conflictSeats.add(k);
        conflictSeats.add(j);
      }
    }
  }
  return { items, conflictPairs: pairs, conflictSeats, capacityIssues };
}

function localSearch(
  items: number[], movable: number[], nb: number[][], unitOf: number[],
  deadline: number, rng: Rng, now: () => number,
) {
  const s = items.length;
  const m = movable.length;
  const u = new Int32Array(s);
  for (let i = 0; i < s; i++) u[i] = items[i] >= 0 ? unitOf[items[i]] : -1;
  const confAt = (i: number) => {
    const ui = u[i];
    if (ui < 0) return 0;
    let c = 0;
    for (const j of nb[i]) if (u[j] === ui) c++;
    return c;
  };
  const pairCost = (a: number, b: number) => {
    let c = confAt(a) + confAt(b);
    if (u[a] >= 0 && u[a] === u[b] && nb[a].includes(b)) c--;
    return c;
  };
  const list: number[] = [];
  const idx = new Int32Array(s).fill(-1);
  const add = (i: number) => { if (idx[i] < 0) { idx[i] = list.length; list.push(i); } };
  const rem = (i: number) => {
    const k = idx[i];
    if (k < 0) return;
    const last = list.pop()!;
    if (last !== i) { list[k] = last; idx[last] = k; }
    idx[i] = -1;
  };
  const refresh = (i: number) => (confAt(i) > 0 ? add(i) : rem(i));
  const swap = (a: number, b: number) => {
    [u[a], u[b]] = [u[b], u[a]];
    [items[a], items[b]] = [items[b], items[a]];
  };

  let total = 0;
  for (let i = 0; i < s; i++) { refresh(i); total += confAt(i); }
  total /= 2;
  let best = items.slice();
  let bestTotal = total;
  let iter = 0;

  while (list.length > 0 && iter < 400_000) {
    iter++;
    if ((iter & 1023) === 0 && now() > deadline) break;
    const a = list[Math.floor(rng() * list.length)];
    let bb = -1;
    let bd = Infinity;
    for (let t = 0; t < 6; t++) {
      const b = movable[Math.floor(rng() * m)];
      if (b === a || u[a] === u[b]) continue;
      const before = pairCost(a, b);
      swap(a, b);
      const d = pairCost(a, b) - before;
      swap(a, b);
      if (d < bd || (d === bd && rng() < 0.5)) { bd = d; bb = b; }
    }
    if (bb < 0) continue;
    if (bd <= 0 || rng() < 0.03) {
      swap(a, bb);
      total += bd;
      refresh(a); refresh(bb);
      for (const x of nb[a]) refresh(x);
      for (const x of nb[bb]) refresh(x);
      if (total < bestTotal) { bestTotal = total; best = items.slice(); }
    }
  }
  return { items: best, total: bestTotal };
}
