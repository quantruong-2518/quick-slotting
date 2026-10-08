export type NumberingStyle = "snake" | "ltr";
/** Đánh số theo hàng ngang cả phòng, hay hết khoang này mới sang khoang kia. */
export type NumberingOrder = "room" | "block";
export type Adjacency = "lr" | "lrfb" | "all";
export type SpareMode = "tail" | "spread";
/** Cách chia người vào ca và phòng: đều khắp, hay dồn từng lĩnh vực cho đầy phòng này rồi mới sang phòng khác. */
export type FillMode = "even" | "field";

export interface BlockSize {
  rows: number;
  cols: number;
}

/** Cấu hình một phòng thi. Đọc kích thước khoang qua `blockLayout`, đừng đọc thẳng `rows`/`cols`. */
export interface RoomConfig {
  id: string;
  name: string;
  blocks: number;
  /** Số hàng, số cột của mỗi khoang khi các khoang giống nhau; có `sizes` thì là số lớn nhất. */
  rows: number;
  cols: number;
  /** Kích thước riêng từng khoang (từ trái sang, đủ `blocks` phần tử). Không có thì khoang nào cũng `rows` × `cols`. */
  sizes?: BlockSize[];
  style: NumberingStyle;
  /** Sơ đồ cũ không có thì là "room". */
  order?: NumberingOrder;
  start: number;
  /** Các ô bị bỏ máy, khoá dạng "hàng-cộtToànPhòng". */
  off: string[];
  /** Số máy dự phòng: mỗi ca luôn để trống ít nhất chừng này máy. Sơ đồ cũ không có thì là 0. */
  reserve?: number;
}

export interface Seat {
  key: string;
  row: number;
  /** Cột tính trên toàn phòng (0 .. tổng số cột của các khoang - 1). */
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
  /** Lĩnh vực dự kiểm tra; rỗng nếu danh sách không có cột này. */
  field: string;
  unitId: number;
}

export interface Unit {
  id: number;
  name: string;
  count: number;
  variants: string[];
}

export interface CapacityIssue {
  unitId: number;
  count: number;
  max: number;
}

export interface ArrangeResult {
  /** items[i] = chỉ số người ngồi ở ghế seats[i], hoặc -1 nếu để trống. */
  items: number[];
  conflictPairs: number;
  conflictSeats: Set<number>;
  capacityIssues: CapacityIssue[];
}

/** Kết quả của một phòng trong một ca. items[i] = chỉ số người trong cả danh sách, hoặc -1. */
export type SlotResult = ArrangeResult;

/** Vị trí một ghế: ca s, phòng r (theo thứ tự các phòng), ghế i (chỉ số trong buildSeats). */
export interface SeatRef {
  s: number;
  r: number;
  i: number;
}
