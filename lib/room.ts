import type { Adjacency, RoomConfig, Seat } from "./types";

export const LIMITS = { blocks: 6, rows: 30, cols: 10 } as const;

export const seatKey = (row: number, gcol: number) => `${row}-${gcol}`;

export function newRoom(partial: Partial<RoomConfig> = {}): RoomConfig {
  return {
    id: partial.id ?? crypto.randomUUID(),
    name: partial.name ?? "Phòng máy",
    blocks: partial.blocks ?? 3,
    rows: partial.rows ?? 8,
    cols: partial.cols ?? 5,
    style: partial.style ?? "snake",
    start: partial.start ?? 1,
    off: partial.off ?? [],
    reserve: partial.reserve ?? 0,
  };
}

/** Danh sách máy theo thứ tự số máy tăng dần. */
export function buildSeats(room: RoomConfig): Seat[] {
  const off = new Set(room.off);
  const total = room.blocks * room.cols;
  const seats: Seat[] = [];
  let n = room.start;
  for (let r = 0; r < room.rows; r++) {
    for (let i = 0; i < total; i++) {
      const gcol = room.style === "snake" && r % 2 === 1 ? total - 1 - i : i;
      const key = seatKey(r, gcol);
      if (off.has(key)) continue;
      seats.push({
        key,
        row: r,
        gcol,
        block: Math.floor(gcol / room.cols),
        col: gcol % room.cols,
        number: n++,
      });
    }
  }
  return seats;
}

/** Danh sách kề theo chỉ số ghế. Lối đi giữa các khoang cắt quan hệ kề. */
export function buildNeighbors(room: RoomConfig, seats: Seat[], adj: Adjacency): number[][] {
  const index = new Map(seats.map((s, i) => [s.key, i]));
  const dirs: [number, number][] =
    adj === "lr" ? [[0, 1]] : adj === "lrfb" ? [[0, 1], [1, 0]] : [[0, 1], [1, 0], [1, 1], [1, -1]];
  const nb: number[][] = seats.map(() => []);
  seats.forEach((s, i) => {
    for (const [dr, dc] of dirs) {
      const r2 = s.row + dr;
      const c2 = s.gcol + dc;
      if (r2 >= room.rows || c2 < 0 || c2 >= room.blocks * room.cols) continue;
      if (Math.floor(c2 / room.cols) !== s.block) continue;
      const j = index.get(seatKey(r2, c2));
      if (j === undefined) continue;
      nb[i].push(j);
      nb[j].push(i);
    }
  });
  return nb;
}

/** Hướng dẫn vị trí dễ hiểu: khoang, hàng, ghế (đều tính từ 1). */
export function seatPosition(seat: Seat) {
  return { block: seat.block + 1, row: seat.row + 1, chair: seat.col + 1 };
}
