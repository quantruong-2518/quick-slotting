"use client";

import { useEffect, useMemo, useRef } from "react";
import { Button } from "./ui/button";
import { Notice } from "./ui/card";
import { unitColor } from "@/lib/colors";
import { sameUnitNeighbors, swapSeats } from "@/lib/sessions";
import type { Person, SeatRef, Unit } from "@/lib/types";

/** Hộp xác nhận khi kéo thả hai máy trong sơ đồ: hai người đổi chỗ cho nhau. */
export function SwapDialog({
  a, b, items, nbOf, people, units, seatNo, place, onConfirm, onClose,
}: {
  a: SeatRef;
  b: SeatRef;
  items: number[][][];
  nbOf: number[][][];
  people: Person[];
  units: Unit[];
  seatNo: (at: SeatRef) => number;
  place: (at: SeatRef) => string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const unitOf = useMemo(() => people.map((p) => p.unitId), [people]);
  useEffect(() => { ref.current?.showModal(); }, []);

  const pa = items[a.s][a.r][a.i];
  const pb = items[b.s][b.r][b.i];
  const after = swapSeats(items, a, b);
  const conflictsA = sameUnitNeighbors(after[b.s][b.r], nbOf[b.r], unitOf, b.i);
  const conflictsB = sameUnitNeighbors(after[a.s][a.r], nbOf[a.r], unitOf, a.i);

  const card = (p: Person, at: SeatRef, to: SeatRef) => (
    <div className="flex min-w-0 flex-1 flex-col gap-1 rounded-control bg-subtle p-3">
      <span className="inline-flex items-center gap-2 text-body font-semibold">
        <span className="size-3 shrink-0 rounded-sm" style={{ background: unitColor(p.unitId) }} />
        <span className="truncate">{p.name}</span>
      </span>
      <span className="text-caption text-muted">{units[p.unitId].name}</span>
      <span className="text-body tabular-nums">
        Máy <b className="font-semibold">{seatNo(at)}</b> → Máy <b className="font-semibold text-brand-ink">{seatNo(to)}</b>
      </span>
    </div>
  );

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label="Xác nhận đổi chỗ"
      className="m-auto w-full max-w-lg rounded-card bg-white p-0 text-ink shadow-card backdrop:bg-ink/40"
    >
      <form method="dialog" className="flex flex-col gap-4 p-7" onSubmit={onConfirm}>
        <h2 className="text-lg font-semibold">Đổi chỗ hai người này?</h2>
        <div className="flex items-stretch gap-3">
          {card(people[pa], a, b)}
          <span aria-hidden="true" className="self-center text-xl text-muted">⇄</span>
          {card(people[pb], b, a)}
        </div>
        {(a.s !== b.s || a.r !== b.r) && <p className="text-caption text-muted">{place(a)} ⇄ {place(b)}</p>}
        {conflictsA > 0 && <Notice tone="warn">{people[pa].name} sẽ ngồi cạnh {conflictsA} người cùng ĐV.</Notice>}
        {conflictsB > 0 && <Notice tone="warn">{people[pb].name} sẽ ngồi cạnh {conflictsB} người cùng ĐV.</Notice>}
        {!conflictsA && !conflictsB && <p className="text-body font-medium text-ok">Không ai ngồi cạnh người cùng ĐV.</p>}
        <div className="flex justify-end gap-3">
          <Button onClick={() => ref.current?.close()}>Huỷ</Button>
          <Button type="submit" variant="primary">Xác nhận đổi chỗ</Button>
        </div>
      </form>
    </dialog>
  );
}
