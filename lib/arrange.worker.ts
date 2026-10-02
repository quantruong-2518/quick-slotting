import { buildNeighbors, buildSeats } from "./room";
import { arrange } from "./seating";
import type { Adjacency, CapacityIssue, RoomConfig, SpareMode } from "./types";

export interface ArrangeRequest {
  rooms: RoomConfig[];
  /** ĐV của từng người trong cả danh sách. */
  unitOf: number[];
  /** groups[ca][phòng] = chỉ số những người ngồi phòng đó trong ca đó. */
  groups: number[][][];
  adj: Adjacency;
  spare: SpareMode;
}

/** Kết quả một phòng trong một ca; `Set` đổi thành mảng để gửi qua postMessage. */
export interface SlotMessage {
  items: number[];
  conflictPairs: number;
  conflictSeats: number[];
  capacityIssues: CapacityIssue[];
}

export type ArrangeMessage =
  | { type: "progress"; done: number; total: number }
  | { type: "done"; slots: SlotMessage[][] };

/** Tổng thời gian cho cả lần xếp; phòng xếp xong sớm thì phần dư dồn cho phòng sau. */
const TOTAL_BUDGET_MS = 12_000;

// Chạy thuật toán ngoài luồng giao diện để trang không bị đứng khi xếp phòng lớn.
self.onmessage = (e: MessageEvent<ArrangeRequest>) => {
  const { rooms, unitOf, groups, adj, spare } = e.data;
  const built = rooms.map((room) => {
    const seats = buildSeats(room);
    return { seats, nb: buildNeighbors(room, seats, adj) };
  });
  const total = groups.length * rooms.length;
  const start = performance.now();
  let done = 0;
  const post = (m: ArrangeMessage) => self.postMessage(m);
  const slots = groups.map((row) =>
    row.map((members, r): SlotMessage => {
      const { seats, nb } = built[r];
      const left = TOTAL_BUDGET_MS - (performance.now() - start);
      const res = arrange({
        unitOfPerson: members.map((p) => unitOf[p]),
        seatCount: seats.length,
        nb,
        spare,
        exactPathBound: adj === "lr",
        bipartite: adj === "lrfb" ? (i) => ((seats[i].row + seats[i].gcol) % 2) as 0 | 1 : undefined,
        maxTimeMs: Math.max(300, left / (total - done)),
      });
      post({ type: "progress", done: ++done, total });
      return {
        items: res.items.map((k) => (k >= 0 ? members[k] : -1)),
        conflictPairs: res.conflictPairs,
        conflictSeats: [...res.conflictSeats],
        capacityIssues: res.capacityIssues,
      };
    }),
  );
  post({ type: "done", slots });
};
