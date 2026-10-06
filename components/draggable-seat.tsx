"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";

/** Ô số máy trong sơ đồ: người ngồi ở đó thì kéo được và là đích thả; ô trống thì không. */
export function DraggableSeat({
  id, number, color, title, bad, busy, canDrag, elRef,
}: {
  /** Chỉ số ghế trong phòng. */
  id: number;
  number: number;
  /** Màu ĐV của người ngồi, null nếu ghế trống. */
  color: string | null;
  title: string;
  bad: boolean;
  /** Đang có ô nào được kéo. */
  busy: boolean;
  canDrag: boolean;
  elRef: (el: HTMLElement | null) => void;
}) {
  const filled = color !== null;
  const drag = useDraggable({ id, disabled: !canDrag });
  const drop = useDroppable({ id, disabled: !filled });
  const isSource = drag.isDragging;
  const isOver = drop.isOver && !isSource;
  // Đang kéo: ô trống không thả vào được nên vẽ nét đứt.
  const blocked = busy && !filled;
  return (
    <span
      ref={(el) => { drag.setNodeRef(el); drop.setNodeRef(el); elRef(el); }}
      {...drag.listeners}
      title={filled ? `${title}\nKéo thả vào máy khác để đổi chỗ` : `Máy ${number}: trống`}
      className={`grid h-10 w-11 place-items-center rounded-control text-sm font-semibold tabular-nums transition duration-150 select-none ${
        filled ? "text-ink" : "bg-subtle text-faint"
      } ${bad && !busy ? "ring-2 ring-danger" : ""} ${canDrag ? "touch-none cursor-grab" : ""} ${
        isSource ? "scale-90 opacity-30" : ""
      } ${isOver ? "z-10 scale-125 shadow-lifted ring-2 ring-brand animate-hover-target" : ""} ${
        busy && filled && !isSource && !isOver ? "ring-2 ring-brand-line" : ""
      } ${blocked ? "border-2 border-dashed border-line-strong bg-transparent" : ""}`}
      style={filled && !blocked ? { background: color } : undefined}
    >
      {number}
    </span>
  );
}

/** Bản sao đi theo con trỏ khi đang kéo. */
export function SeatGhost({ number, color }: { number: number; color: string }) {
  return (
    <span
      className="grid h-10 w-11 animate-pickup scale-130 cursor-grabbing place-items-center rounded-control text-sm font-semibold text-ink shadow-lifted ring-2 ring-brand tabular-nums"
      style={{ background: color }}
    >
      {number}
    </span>
  );
}
