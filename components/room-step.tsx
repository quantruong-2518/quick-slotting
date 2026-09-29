"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CheckIcon } from "./ui/card";
import { NumberStepper } from "./ui/number-stepper";
import { Segmented } from "./ui/segmented";
import { SeatZones } from "./seat-zones";
import { LIMITS, newRoom } from "@/lib/room";
import { useSavedRooms } from "@/lib/rooms-store";
import type { NumberingStyle, RoomConfig, Seat } from "@/lib/types";

export interface Draft {
  blocks: number | null;
  rows: number | null;
  cols: number | null;
  style: NumberingStyle;
  start: number;
}

export function RoomStep({
  draft, setDraft, room, setRoom, seats, onNext,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  room: RoomConfig | null;
  setRoom: (r: RoomConfig | null) => void;
  seats: Seat[];
  onNext: () => void;
}) {
  const saved = useSavedRooms();
  const [savedFlag, setSavedFlag] = useState(false);
  const ready = !!(draft.blocks && draft.rows && draft.cols);
  const total = ready ? draft.blocks! * draft.rows! * draft.cols! : 0;
  const same = !!room && ready && room.blocks === draft.blocks && room.rows === draft.rows && room.cols === draft.cols;

  const update = (r: RoomConfig) => { setRoom(r); setSavedFlag(false); };
  const patch = (p: Partial<Draft>) => {
    const d = { ...draft, ...p };
    setDraft(d);
    if (room && ("style" in p || "start" in p)) update({ ...room, style: d.style, start: d.start });
  };

  function generate() {
    if (!ready) return;
    update(newRoom({
      id: room?.id, name: room?.name ?? `Phòng máy ${saved.rooms.length + 1}`,
      blocks: draft.blocks!, rows: draft.rows!, cols: draft.cols!, style: draft.style, start: draft.start, off: [],
    }));
  }

  function pickSaved(id: string) {
    const r = saved.rooms.find((x) => x.id === id);
    if (!r) return;
    setDraft({ blocks: r.blocks, rows: r.rows, cols: r.cols, style: r.style, start: r.start });
    setRoom(r);
    setSavedFlag(true);
  }

  function toggleSeat(key: string) {
    if (!room) return;
    const off = room.off.includes(key) ? room.off.filter((k) => k !== key) : [...room.off, key];
    update({ ...room, off });
  }

  return (
    <>
      <div className="flex flex-1 gap-4">
        <Card className="flex w-75 shrink-0 flex-col gap-3.5" aria-label="Kích thước phòng">
          <h2 className="mb-1 text-lg font-semibold">Kích thước phòng</h2>
          <NumberStepper id="blocks" label="Số khoang" value={draft.blocks} max={LIMITS.blocks} onChange={(v) => patch({ blocks: v })} />
          <NumberStepper id="rows" label="Số hàng" value={draft.rows} max={LIMITS.rows} onChange={(v) => patch({ rows: v })} />
          <NumberStepper id="cols" label="Số cột / khoang" value={draft.cols} max={LIMITS.cols} onChange={(v) => patch({ cols: v })} />
          {ready ? (
            <>
              <div className="mt-1.5 flex items-baseline justify-between tabular-nums">
                <span className="text-sm text-muted">{draft.blocks} × {draft.rows} × {draft.cols} =</span>
                <span className="text-title font-semibold">{total} máy</span>
              </div>
              <Button variant={same ? "secondary" : "primary"} className="h-11" onClick={generate}>
                {same ? "Tạo lại" : room ? "Cập nhật sơ đồ" : "Tạo sơ đồ"}
              </Button>
            </>
          ) : (
            <>
              <p className="mt-1.5 text-sm text-warn">Nhập đủ 3 số để tạo sơ đồ.</p>
              <Button className="h-11" disabled>Tạo sơ đồ</Button>
            </>
          )}
          <hr className="my-1.5 border-line" />
          <div className="flex items-center justify-between gap-3">
            <span className="text-body font-medium">Đánh số</span>
            <Segmented
              label="Kiểu đánh số"
              value={draft.style}
              onChange={(v) => patch({ style: v })}
              options={[
                { value: "snake", label: "Rắn", hint: "Hàng lẻ trái sang phải, hàng chẵn ngược lại" },
                { value: "ltr", label: "Thẳng", hint: "Hàng nào cũng trái sang phải" },
              ]}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="start" className="text-body font-medium">Bắt đầu từ số</label>
            <input
              id="start"
              inputMode="numeric"
              value={draft.start}
              onChange={(e) => patch({ start: parseInt(e.target.value.replace(/\D/g, "").slice(0, 4) || "1", 10) })}
              className="field h-10 w-16 text-center text-lg font-semibold"
            />
          </div>
        </Card>

        <Card className="flex min-w-0 flex-1 flex-col gap-4" aria-label="Sơ đồ phòng">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-baseline gap-2">
              {room ? (
                <input
                  aria-label="Tên sơ đồ"
                  value={room.name}
                  onChange={(e) => update({ ...room, name: e.target.value })}
                  className="w-44 rounded-chip bg-transparent text-lg font-semibold outline-none hover:bg-subtle focus:bg-subtle"
                />
              ) : (
                <h2 className="text-lg font-semibold">Sơ đồ phòng</h2>
              )}
              {room && <span className="text-muted">{seats.length} máy</span>}
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="saved" className="text-sm text-muted">Sơ đồ đã lưu</label>
              <select
                id="saved"
                value={room && saved.rooms.some((r) => r.id === room.id) ? room.id : ""}
                onChange={(e) => pickSaved(e.target.value)}
                className="h-10 min-w-52 rounded-control bg-control px-3 text-body"
              >
                <option value="">{saved.rooms.length ? "Chọn sơ đồ…" : "Chưa có sơ đồ nào"}</option>
                {saved.rooms.map((r) => (
                  <option key={r.id} value={r.id}>{r.name} ({r.blocks * r.rows * r.cols - r.off.length} máy)</option>
                ))}
              </select>
              {room && (
                <Button
                  className={savedFlag ? "bg-ok-bg text-ok hover:bg-ok-bg" : ""}
                  onClick={() => { saved.save(room); setSavedFlag(true); }}
                >
                  {savedFlag ? <><CheckIcon /> Đã lưu</> : "Lưu sơ đồ"}
                </Button>
              )}
            </div>
          </div>

          {room ? (
            <div className="flex flex-1 flex-col items-center gap-3 overflow-auto rounded-card bg-subtle p-5">
              <SeatZones
                room={room}
                seats={seats}
                zoneClass={() => "bg-brand-soft"}
                renderSeat={(seat, r, g) =>
                  seat ? (
                    <button
                      type="button"
                      onClick={() => toggleSeat(seat.key)}
                      aria-label={`Máy ${seat.number}, bấm để bỏ`}
                      className="grid h-9 w-10.5 place-items-center rounded-control bg-white text-sm font-semibold text-brand-ink tabular-nums hover:ring-2 hover:ring-brand"
                    >
                      {seat.number}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleSeat(`${r}-${g}`)}
                      aria-label="Chỗ trống, bấm để thêm máy"
                      className="h-9 w-10.5 rounded-control border-[1.5px] border-dashed border-brand-line hover:bg-white/60"
                    />
                  )
                }
              />
              <span className="text-caption text-faint">Bấm vào ô để bỏ hoặc thêm máy</span>
            </div>
          ) : (
            <div className="grid flex-1 place-items-center rounded-card bg-subtle px-12 text-center text-muted">
              Nhập số khoang, số hàng, số cột rồi bấm Tạo sơ đồ, hoặc chọn một sơ đồ đã lưu.
            </div>
          )}
        </Card>
      </div>
      <div className="flex justify-end">
        <Button variant="primary" size="lg" disabled={!room} onClick={onNext}>Tiếp tục</Button>
      </div>
    </>
  );
}
