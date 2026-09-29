import { buildNeighbors, buildSeats } from "./room";
import { arrange } from "./seating";
import type { Adjacency, RoomConfig, SpareMode } from "./types";

export interface ArrangeRequest {
  room: RoomConfig;
  unitOfPerson: number[];
  adj: Adjacency;
  spare: SpareMode;
}

// Chạy thuật toán ngoài luồng giao diện để trang không bị đứng khi xếp phòng lớn.
self.onmessage = (e: MessageEvent<ArrangeRequest>) => {
  const { room, unitOfPerson, adj, spare } = e.data;
  const seats = buildSeats(room);
  const nb = buildNeighbors(room, seats, adj);
  const r = arrange({
    unitOfPerson,
    seatCount: seats.length,
    nb,
    spare,
    exactPathBound: adj === "lr",
    bipartite: adj === "lrfb" ? (i) => ((seats[i].row + seats[i].gcol) % 2) as 0 | 1 : undefined,
  });
  self.postMessage({
    items: r.items,
    conflictPairs: r.conflictPairs,
    conflictSeats: [...r.conflictSeats],
    capacityIssues: r.capacityIssues,
  });
};
