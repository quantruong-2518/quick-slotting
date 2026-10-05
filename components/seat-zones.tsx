import type { ReactNode } from "react";
import { blockLayout, seatKey } from "@/lib/room";
import type { RoomConfig, Seat } from "@/lib/types";

/**
 * Vẽ sơ đồ theo khoang: mỗi khoang là một vùng nền màu, các ghế xếp theo hàng bên trong.
 * Khoang ít hàng hơn thì ngắn hơn, các khoang thẳng hàng ở phía giám thị.
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
  const range = (n: number) => Array.from({ length: n }, (_, k) => k);
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="grid h-7 w-full place-items-center rounded-control bg-control text-caption font-medium text-muted">Giám thị</div>
      <div className={`flex items-start ${zoneGap}`}>
        {blockLayout(room).map((block, b) => {
          const Zone = onZone ? "button" : "div";
          return (
            <Zone
              key={b}
              {...(onZone ? { type: "button" as const, onClick: () => onZone(b), "aria-label": `Khoang ${b + 1}` } : {})}
              className={`flex flex-col rounded-card p-2 ${gap} ${zoneClass(b)}`}
            >
              {range(block.rows).map((r) => (
                <span key={r} className={`flex ${gap}`}>
                  {range(block.cols).map((c) => {
                    const g = block.start + c;
                    return <span key={c}>{renderSeat(byKey.get(seatKey(r, g)) ?? null, r, g)}</span>;
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
