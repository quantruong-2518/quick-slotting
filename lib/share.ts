import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import type { RoomConfig } from "./types";

/** Dữ liệu tra cứu gói gọn trong phần # của link, không bao giờ gửi lên máy chủ. */
export interface ShareData {
  v: 1;
  title: string;
  room: Omit<RoomConfig, "id">;
  /** [mã CC, số máy, họ tên, đơn vị] */
  rows: [string, number, string, string][];
}

export const encodeShare = (d: ShareData) => compressToEncodedURIComponent(JSON.stringify(d));

export function decodeShare(hash: string): ShareData | null {
  try {
    const raw = decompressFromEncodedURIComponent(hash.replace(/^#/, ""));
    if (!raw) return null;
    const d = JSON.parse(raw) as ShareData;
    return d && d.v === 1 && Array.isArray(d.rows) ? d : null;
  } catch {
    return null;
  }
}
