import type { ReactNode } from "react";
import type { RoomConfig, Seat } from "@/lib/types";

/**
 * Vẽ sơ đồ theo khoang: mỗi khoang là một vùng nền màu, các ghế xếp theo hàng bên trong.
 * renderSeat nhận ghế (hoặc null nếu ô bị bỏ máy) và toạ độ.
 */
export function SeatZones({
  room,
  seats,
  renderSeat,
  zoneClass,
  gap = "gap-1.5",
  zoneGap = "gap-4",
  onZone,
}: {
  room: RoomConfig;
  seats: Seat[];
  renderSeat: (seat: Seat | null, row: number, gcol: number) => ReactNode;
  zoneClass: (block: number) => string;
  gap?: string;
  zoneGap?: string;
  onZone?: (block: number) => void;
}) {
  const byKey = new Map(seats.map((s) => [s.key, s]));
  const blocks = Array.from({ length: room.blocks }, (_, b) => b);
  const rows = Array.from({ length: room.rows }, (_, r) => r);
  const cols = Array.from({ length: room.cols }, (_, c) => c);
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="grid h-7 w-full place-items-center rounded-control bg-control text-caption font-medium text-muted">Giám thị</div>
      <div className={`flex items-start ${zoneGap}`}>
        {blocks.map((b) => {
          const Zone = onZone ? "button" : "div";
          return (
            <Zone
              key={b}
              {...(onZone ? { type: "button" as const, onClick: () => onZone(b), "aria-label": `Khoang ${b + 1}` } : {})}
              className={`flex flex-col rounded-card p-2 ${gap} ${zoneClass(b)}`}
            >
              {rows.map((r) => (
                <span key={r} className={`flex ${gap}`}>
                  {cols.map((c) => {
                    const g = b * room.cols + c;
                    return <span key={c}>{renderSeat(byKey.get(`${r}-${g}`) ?? null, r, g)}</span>;
                  })}
                </span>
              ))}
            </Zone>
          );
        })}
      </div>
    </div>
  );
}
