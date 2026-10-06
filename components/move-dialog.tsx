"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "./ui/button";
import { Notice } from "./ui/card";
import { unitColor } from "@/lib/colors";
import { capacityOf, sameUnitNeighbors, suggestSeat, swapSeats } from "@/lib/sessions";
import type { Person, RoomConfig, Seat, SeatRef, Unit } from "@/lib/types";

/** Hộp đổi chỗ một người: chọn ca, phòng, máy. Máy có người thì hai người đổi chỗ cho nhau. */
export function MoveDialog({
  from, rooms, seatsOf, nbOf, items, people, units, place, onMove, onClose,
}: {
  from: SeatRef;
  rooms: RoomConfig[];
  seatsOf: Seat[][];
  nbOf: number[][][];
  /** items[ca][phòng][ghế] = chỉ số người hoặc -1. */
  items: number[][][];
  people: Person[];
  units: Unit[];
  place: (at: SeatRef) => string;
  onMove: (to: SeatRef) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const unitOf = useMemo(() => people.map((p) => p.unitId), [people]);
  // Giữ người lúc mở hộp: sau khi chuyển, ghế cũ đã đổi người.
  const [pi] = useState(() => items[from.s][from.r][from.i]);
  const person = people[pi];
  const sessions = items.length;

  /** Máy gợi ý khi đổi sang ca/phòng khác: máy trống hợp nhất, hết máy trống thì người đầu tiên khác chính mình. */
  const pick = (s: number, r: number): SeatRef => {
    const free = suggestSeat(items[s][r], nbOf[r], unitOf, pi);
    const i = free >= 0 ? free : items[s][r].findIndex((_, k) => !(s === from.s && r === from.r && k === from.i));
    return { s, r, i };
  };
  const [to, setTo] = useState<SeatRef>(() => pick(from.s, from.r));

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const slotItems = items[to.s][to.r];
  const other = to.i >= 0 ? slotItems[to.i] : -1;
  const same = to.s === from.s && to.r === from.r && to.i === from.i;
  const valid = to.i >= 0 && !same;
  const after = valid ? swapSeats(items, from, to) : items;
  const meConflicts = valid ? sameUnitNeighbors(after[to.s][to.r], nbOf[to.r], unitOf, to.i) : 0;
  const otherConflicts = valid && other >= 0 ? sameUnitNeighbors(after[from.s][from.r], nbOf[from.r], unitOf, from.i) : 0;
  const movesIn = valid && other < 0 && (to.s !== from.s || to.r !== from.r);
  const room = rooms[to.r];
  const usesReserve = movesIn && slotItems.filter((x) => x >= 0).length + 1 > capacityOf(seatsOf[to.r].length, room.reserve);
  const select = "h-11 w-full rounded-control bg-control px-3 text-body";

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label={`Đổi chỗ ${person.name}`}
      className="m-auto w-full max-w-lg rounded-card bg-white p-0 text-ink shadow-card backdrop:bg-ink/40"
    >
      <form
        method="dialog"
        className="flex flex-col gap-4 p-7"
        onSubmit={() => valid && onMove(to)}
      >
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Đổi chỗ</h2>
          <p className="inline-flex items-center gap-2 text-body font-semibold">
            <span className="size-3 shrink-0 rounded-sm" style={{ background: unitColor(person.unitId) }} />
            {person.name} <span className="font-mono text-caption font-normal text-muted">{person.code}</span>
          </p>
          <p className="text-caption text-muted">
            {units[person.unitId].name}
            {person.field ? ` · ${person.field}` : ""}
          </p>
          <p className="text-body">Đang ngồi: <b className="font-semibold">{place(from)}</b></p>
        </div>

        <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2.5">
          {sessions > 1 && (
            <>
              <label htmlFor="move-ca" className="text-body font-medium">Ca</label>
              <select id="move-ca" value={to.s} onChange={(e) => setTo(pick(Number(e.target.value), to.r))} className={select}>
                {items.map((_, s) => <option key={s} value={s}>Ca {s + 1}</option>)}
              </select>
            </>
          )}
          {rooms.length > 1 && (
            <>
              <label htmlFor="move-phong" className="text-body font-medium">Phòng</label>
              <select id="move-phong" value={to.r} onChange={(e) => setTo(pick(to.s, Number(e.target.value)))} className={select}>
                {rooms.map((rm, r) => (
                  <option key={rm.id} value={r}>
                    {rm.name} ({items[to.s][r].filter((x) => x >= 0).length} người / {seatsOf[r].length} máy)
                  </option>
                ))}
              </select>
            </>
          )}
          <label htmlFor="move-may" className="text-body font-medium">Máy</label>
          <select id="move-may" value={to.i} onChange={(e) => setTo({ ...to, i: Number(e.target.value) })} className={select}>
            {seatsOf[to.r].map((seat, i) => {
              if (to.s === from.s && to.r === from.r && i === from.i) return null;
              const x = slotItems[i];
              return (
                <option key={seat.key} value={i}>
                  Máy {seat.number}: {x >= 0 ? `${people[x].name} (${units[people[x].unitId].name})` : "trống"}
                </option>
              );
            })}
          </select>
        </div>

        {valid && (
          <div className="flex flex-col gap-2">
            <p className="text-body">
              {other >= 0 ? (
                <>
                  Đổi chỗ với <b className="font-semibold">{people[other].name}</b>; người này về {place(from)}.
                </>
              ) : (
                "Chuyển vào máy trống."
              )}
            </p>
            {usesReserve && (
              <Notice tone="warn">
                {room.name} ca này đã đủ người, chuyển vào sẽ dùng mất 1 máy dự phòng.
              </Notice>
            )}
            {meConflicts > 0 && (
              <Notice tone="warn">{person.name} sẽ ngồi cạnh {meConflicts} người cùng ĐV.</Notice>
            )}
            {otherConflicts > 0 && (
              <Notice tone="warn">{people[other].name} sẽ ngồi cạnh {otherConflicts} người cùng ĐV.</Notice>
            )}
            {!meConflicts && !otherConflicts && <p className="text-body font-medium text-ok">Không ai ngồi cạnh người cùng ĐV.</p>}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button onClick={() => ref.current?.close()}>Huỷ</Button>
          <Button type="submit" variant="primary" disabled={!valid}>
            {other >= 0 ? "Đổi chỗ" : "Chuyển"}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
