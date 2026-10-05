import type { Adjacency, BlockSize, RoomConfig, Seat } from "./types";

export const LIMITS = { blocks: 6, rows: 30, cols: 10 } as const;

export const seatKey = (row: number, gcol: number) => `${row}-${gcol}`;

type Dims = Pick<RoomConfig, "blocks" | "rows" | "cols" | "sizes">;

/** Kích thước từng khoang từ trái sang; `start` là gcol của cột đầu tiên trong khoang. */
export function blockLayout(room: Dims): (BlockSize & { start: number })[] {
  const sizes = room.sizes ?? Array.from({ length: room.blocks }, () => ({ rows: room.rows, cols: room.cols }));
  let start = 0;
  return sizes.map(({ rows, cols }) => {
    const block = { rows, cols, start };
    start += cols;
    return block;
  });
}

/** Đổi kích thước các khoang thành các trường của RoomConfig; các khoang giống hệt nhau thì không cần `sizes`. */
export function roomDims(sizes: BlockSize[]): Dims {
  const rows = Math.max(...sizes.map((b) => b.rows));
  const cols = Math.max(...sizes.map((b) => b.cols));
  const uniform = sizes.every((b) => b.rows === rows && b.cols === cols);
  return { blocks: sizes.length, rows, cols, ...(uniform ? {} : { sizes: sizes.map((b) => ({ rows: b.rows, cols: b.cols })) }) };
}

/** Số ô của phòng khi chưa bỏ máy nào. */
export const cellCount = (room: Dims) => blockLayout(room).reduce((n, b) => n + b.rows * b.cols, 0);

export function newRoom(partial: Partial<RoomConfig> = {}): RoomConfig {
  return {
    id: partial.id ?? crypto.randomUUID(),
    name: partial.name ?? "Phòng máy",
    blocks: partial.blocks ?? 3,
    rows: partial.rows ?? 8,
    cols: partial.cols ?? 5,
    ...(partial.sizes ? { sizes: partial.sizes } : {}),
    style: partial.style ?? "snake",
    order: partial.order ?? "room",
    start: partial.start ?? 1,
    off: partial.off ?? [],
    reserve: partial.reserve ?? 0,
  };
}

/**
 * Danh sách máy theo thứ tự số máy tăng dần.
 * `order: "room"` đánh số theo hàng ngang cả phòng (khoang ít hàng hơn thì hết sớm);
 * `"block"` đánh hết khoang này mới sang khoang kia. Kiểu rắn thì hàng chẵn đi ngược lại.
 */
export function buildSeats(room: RoomConfig): Seat[] {
  const off = new Set(room.off);
  const columns = blockLayout(room).flatMap((b, block) =>
    Array.from({ length: b.cols }, (_, col) => ({ block, col, gcol: b.start + col, rows: b.rows })),
  );
  // Mỗi nhóm cột được đánh số xong mới tới nhóm sau: cả phòng là một nhóm, hoặc mỗi khoang một nhóm.
  const groups = room.order === "block" ? blockLayout(room).map((_, b) => columns.filter((c) => c.block === b)) : [columns];
  const seats: Seat[] = [];
  let n = room.start;
  for (const group of groups) {
    const rows = Math.max(0, ...group.map((c) => c.rows));
    for (let r = 0; r < rows; r++) {
      for (let i = 0; i < group.length; i++) {
        const { block, col, gcol, rows: blockRows } = group[room.style === "snake" && r % 2 === 1 ? group.length - 1 - i : i];
        if (r >= blockRows) continue;
        const key = seatKey(r, gcol);
        if (off.has(key)) continue;
        seats.push({ key, row: r, gcol, block, col, number: n++ });
      }
    }
  }
  return seats;
}

/** Danh sách kề theo chỉ số ghế. Lối đi giữa các khoang cắt quan hệ kề. */
export function buildNeighbors(room: RoomConfig, seats: Seat[], adj: Adjacency): number[][] {
  const index = new Map(seats.map((s, i) => [s.key, i]));
  const layout = blockLayout(room);
  const dirs: [number, number][] =
    adj === "lr" ? [[0, 1]] : adj === "lrfb" ? [[0, 1], [1, 0]] : [[0, 1], [1, 0], [1, 1], [1, -1]];
  const nb: number[][] = seats.map(() => []);
  seats.forEach((s, i) => {
    const b = layout[s.block];
    for (const [dr, dc] of dirs) {
      const c2 = s.gcol + dc;
      if (c2 < b.start || c2 >= b.start + b.cols) continue;
      const j = index.get(seatKey(s.row + dr, c2));
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
