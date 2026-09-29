export type NumberingStyle = "snake" | "ltr";
export type Adjacency = "lr" | "lrfb" | "all";
export type SpareMode = "tail" | "spread";

/** Cấu hình một phòng thi: các khoang cùng số hàng, số cột. */
export interface RoomConfig {
  id: string;
  name: string;
  blocks: number;
  rows: number;
  cols: number;
  style: NumberingStyle;
  start: number;
  /** Các ô bị bỏ máy, khoá dạng "hàng-cộtToànPhòng". */
  off: string[];
}

export interface Seat {
  key: string;
  row: number;
  /** Cột tính trên toàn phòng (0 .. blocks*cols-1). */
  gcol: number;
  block: number;
  col: number;
  number: number;
}

export interface Person {
  line: number;
  name: string;
  code: string;
  unit: string;
  unitId: number;
}

export interface Unit {
  id: number;
  name: string;
  count: number;
  variants: string[];
}

export interface ArrangeResult {
  /** items[i] = chỉ số người ngồi ở ghế seats[i], hoặc -1 nếu để trống. */
  items: number[];
  conflictPairs: number;
  conflictSeats: Set<number>;
  capacityIssues: { unitId: number; count: number; max: number }[];
}
