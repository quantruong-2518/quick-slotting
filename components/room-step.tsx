"use client";

import { useMemo, useState } from "react";
import { Button } from "./ui/button";
import { Card, CheckIcon } from "./ui/card";
import { EditableName } from "./ui/editable-name";
import { NumberStepper } from "./ui/number-stepper";
import { Segmented } from "./ui/segmented";
import { SeatZones } from "./seat-zones";
import { LIMITS, blockLayout, buildSeats, cellCount, newRoom, roomDims } from "@/lib/room";
import { useSavedRooms } from "@/lib/rooms-store";
import { MAX_ROOMS } from "@/lib/sessions";
import type { BlockSize, NumberingOrder, NumberingStyle, RoomConfig } from "@/lib/types";

type DraftSize = { rows: number | null; cols: number | null };

export interface Draft {
  blocks: number | null;
  rows: number | null;
  cols: number | null;
  /** Số hàng, số cột riêng từng khoang; null khi các khoang giống nhau (dùng `rows`, `cols`). */
  sizes: DraftSize[] | null;
  style: NumberingStyle;
  order: NumberingOrder;
  start: number;
}

/** Kích thước từng khoang theo các ô đang nhập; null khi còn thiếu số. */
function draftSizes(d: Draft): BlockSize[] | null {
  if (!d.blocks) return null;
  const list: DraftSize[] = d.sizes ?? Array.from({ length: d.blocks }, () => ({ rows: d.rows, cols: d.cols }));
  const filled = (b: DraftSize): b is BlockSize => !!b.rows && !!b.cols;
  return list.length === d.blocks && list.every(filled) ? list : null;
}

/** Một phòng thi đang soạn: ô nhập kích thước và sơ đồ đã tạo (null khi chưa bấm Tạo sơ đồ). */
export interface RoomEntry {
  key: string;
  draft: Draft;
  room: RoomConfig | null;
}

let seq = 0;
export const newEntry = (): RoomEntry => ({
  key: `p${++seq}`,
  draft: { blocks: null, rows: null, cols: null, sizes: null, style: "snake", order: "room", start: 1 },
  room: null,
});

export function RoomStep({
  entries, active, onSelect, onAdd, onRemove, onChange, onNext,
}: {
  entries: RoomEntry[];
  active: number;
  onSelect: (i: number) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
  onChange: (patch: Partial<Omit<RoomEntry, "key">>) => void;
  onNext: () => void;
}) {
  const entry = entries[active];
  const counts = useMemo(() => entries.map((e) => (e.room ? buildSeats(e.room).length : 0)), [entries]);
  const made = entries.filter((e) => e.room).length;
  const perSession = entries.reduce((n, e, i) => n + Math.max(0, counts[i] - (e.room?.reserve ?? 0)), 0);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Các phòng thi">
        {entries.map((e, i) => {
          const on = i === active;
          const name = e.room?.name ?? `Phòng ${i + 1}`;
          const reserve = e.room?.reserve ?? 0;
          return (
            <div
              key={e.key}
              className={`flex h-14 items-center rounded-card ${on ? "bg-white shadow-card ring-2 ring-brand" : "bg-control hover:bg-control-hover"}`}
            >
              <button
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => onSelect(i)}
                className={`flex h-full flex-col justify-center pl-4 text-left ${entries.length > 1 ? "pr-1" : "pr-4"}`}
              >
                <span className="text-body leading-5 font-semibold">{name}</span>
                <span className={`text-caption leading-4.5 ${e.room ? "text-muted" : "text-warn"}`}>
                  {e.room ? `${counts[i]} máy${reserve ? ` · ${reserve} dự phòng` : ""}` : "Chưa tạo sơ đồ"}
                </span>
              </button>
              {entries.length > 1 && (
                <button
                  type="button"
                  aria-label={`Bỏ ${name}`}
                  title="Bỏ phòng này"
                  onClick={() => (!e.room || confirm(`Bỏ ${name} khỏi kỳ thi này?`)) && onRemove(i)}
                  className="mx-1.5 grid size-8 place-items-center rounded-chip text-xl leading-none text-faint hover:bg-white/70 hover:text-danger"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
        {entries.length < MAX_ROOMS && (
          <Button className="h-14" onClick={onAdd}>
            <span aria-hidden="true" className="text-xl leading-none">+</span> Thêm phòng
          </Button>
        )}
        <span className="flex-1" />
        {made > 1 && (
          <span className="text-body text-muted">
            {made} phòng · <b className="font-semibold text-ink tabular-nums">{perSession}</b> chỗ mỗi ca
          </span>
        )}
      </div>

      <RoomEditor key={entry.key} entry={entry} others={entries.filter((_, i) => i !== active)} onChange={onChange} />

      <div className="flex justify-end">
        <Button variant="primary" size="lg" disabled={!made} onClick={onNext}>Tiếp tục</Button>
      </div>
    </>
  );
}

function RoomEditor({
  entry, others, onChange,
}: {
  entry: RoomEntry;
  others: RoomEntry[];
  onChange: (patch: Partial<Omit<RoomEntry, "key">>) => void;
}) {
  const { draft, room } = entry;
  const seats = useMemo(() => (room ? buildSeats(room) : []), [room]);
  const saved = useSavedRooms();
  const [savedFlag, setSavedFlag] = useState(false);
  const sizes = draftSizes(draft);
  const total = sizes ? sizes.reduce((n, b) => n + b.rows * b.cols, 0) : 0;
  const now = room ? blockLayout(room) : [];
  const same = !!sizes && now.length === sizes.length && now.every((b, i) => b.rows === sizes[i].rows && b.cols === sizes[i].cols);
  const otherRooms = others.flatMap((e) => (e.room ? [e.room] : []));
  const usedIds = new Set(otherRooms.map((r) => r.id));
  const reserve = room?.reserve ?? 0;

  const update = (r: RoomConfig) => { onChange({ room: r }); setSavedFlag(false); };
  const patch = (p: Partial<Draft>) => {
    const d = { ...draft, ...p };
    // Đổi cách đánh số thì sơ đồ đổi theo ngay, không cần tạo lại.
    const renumber = !!room && ("style" in p || "order" in p || "start" in p);
    onChange(renumber ? { draft: d, room: { ...room, style: d.style, order: d.order, start: d.start } } : { draft: d });
    if (renumber) setSavedFlag(false);
  };

  // Tên mặc định chưa trùng với sơ đồ đã lưu hay phòng khác trong kỳ thi.
  function defaultName() {
    const taken = new Set([...saved.rooms, ...otherRooms].map((r) => r.name));
    let n = 1;
    while (taken.has(`Phòng máy ${n}`)) n++;
    return `Phòng máy ${n}`;
  }

  function generate() {
    if (!sizes) return;
    update(newRoom({
      id: room?.id, name: room?.name ?? defaultName(),
      ...roomDims(sizes), style: draft.style, order: draft.order, start: draft.start, off: [],
      reserve: Math.min(reserve, Math.max(0, total - 1)),
    }));
  }

  // Đổi số khoang khi đang nhập riêng từng khoang: khoang mới lấy số của khoang cuối; còn 1 khoang thì hết "khác nhau".
  function setBlocks(v: number | null) {
    const old = draft.sizes;
    if (!old || v === null) return patch({ blocks: v });
    patch({ blocks: v, sizes: v < 2 ? null : Array.from({ length: v }, (_, i) => old[i] ?? old[old.length - 1]) });
  }

  function setCustom(on: boolean) {
    patch({ sizes: on ? Array.from({ length: draft.blocks ?? 0 }, () => ({ rows: draft.rows, cols: draft.cols })) : null });
  }

  const setSize = (i: number, p: Partial<DraftSize>) =>
    patch({ sizes: draft.sizes!.map((b, k) => (k === i ? { ...b, ...p } : b)) });

  function pickSaved(id: string) {
    const r = saved.rooms.find((x) => x.id === id);
    if (!r) return;
    const own = r.sizes ? r.sizes.map((b) => ({ ...b })) : null;
    onChange({ draft: { blocks: r.blocks, rows: r.rows, cols: r.cols, sizes: own, style: r.style, order: r.order ?? "room", start: r.start }, room: r });
    setSavedFlag(true);
  }

  function toggleSeat(key: string) {
    if (!room) return;
    const off = room.off.includes(key) ? room.off.filter((k) => k !== key) : [...room.off, key];
    update({ ...room, off });
  }

  return (
    <div className="flex flex-1 gap-4">
      <Card className="flex w-75 shrink-0 flex-col gap-3.5" aria-label="Kích thước phòng">
        <h2 className="mb-1 text-lg font-semibold">Kích thước phòng</h2>
        <NumberStepper id="blocks" label="Số khoang" value={draft.blocks} max={LIMITS.blocks} onChange={setBlocks} />
        {(draft.sizes || (draft.blocks ?? 0) > 1) && (
          <div className="flex flex-col gap-1.5">
            <span className="text-body font-medium">Số hàng, số cột các khoang</span>
            <Segmented
              label="Số hàng, số cột các khoang"
              value={draft.sizes ? "own" : "same"}
              onChange={(v) => setCustom(v === "own")}
              options={[
                { value: "same", label: "Giống nhau" },
                { value: "own", label: "Khác nhau", hint: "Nhập số hàng, số cột riêng cho từng khoang" },
              ]}
            />
          </div>
        )}
        {draft.sizes ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-caption text-muted">
              <span className="flex-1" />
              <span className="w-14 text-center">Số hàng</span>
              <span className="w-14 text-center">Số cột</span>
            </div>
            {draft.sizes.map((b, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="flex-1 text-body font-medium">Khoang {i + 1}</span>
                <SizeInput label={`Số hàng khoang ${i + 1}`} value={b.rows} max={LIMITS.rows} onChange={(v) => setSize(i, { rows: v })} />
                <SizeInput label={`Số cột khoang ${i + 1}`} value={b.cols} max={LIMITS.cols} onChange={(v) => setSize(i, { cols: v })} />
              </div>
            ))}
            <p className="text-caption text-faint">Khoang 1 là khoang ngoài cùng bên trái.</p>
          </div>
        ) : (
          <>
            <NumberStepper id="rows" label="Số hàng" value={draft.rows} max={LIMITS.rows} onChange={(v) => patch({ rows: v })} />
            <NumberStepper id="cols" label="Số cột / khoang" value={draft.cols} max={LIMITS.cols} onChange={(v) => patch({ cols: v })} />
          </>
        )}
        {sizes ? (
          <>
            <div className="mt-1.5 flex items-baseline justify-between tabular-nums">
              <span className="text-sm text-muted">
                {draft.sizes ? "Tổng cộng" : `${draft.blocks} × ${draft.rows} × ${draft.cols} =`}
              </span>
              <span className="text-title font-semibold">{total} máy</span>
            </div>
            <Button variant={same ? "secondary" : "primary"} className="h-11" onClick={generate}>
              {same ? "Tạo lại" : room ? "Cập nhật sơ đồ" : "Tạo sơ đồ"}
            </Button>
          </>
        ) : (
          <>
            <p className="mt-1.5 text-sm text-warn">
              {!draft.sizes ? "Nhập đủ 3 số để tạo sơ đồ." : draft.blocks ? "Nhập đủ số hàng, số cột của từng khoang." : "Nhập số khoang để tạo sơ đồ."}
            </p>
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
        {(draft.blocks ?? 0) > 1 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-body font-medium">Đánh số theo</span>
            <Segmented
              label="Đánh số theo"
              value={draft.order}
              onChange={(v) => patch({ order: v })}
              options={[
                { value: "room", label: "Cả phòng", hint: "Đánh số theo hàng ngang, qua hết các khoang rồi mới xuống hàng" },
                { value: "block", label: "Từng khoang", hint: "Đánh số hết khoang này mới sang khoang kia" },
              ]}
            />
          </div>
        )}
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
        {room && (
          <>
            <hr className="my-1.5 border-line" />
            <NumberStepper
              id="reserve"
              label="Máy dự phòng"
              min={0}
              max={Math.max(0, seats.length - 1)}
              value={reserve}
              onChange={(v) => update({ ...room, reserve: v ?? 0 })}
            />
            <p className="-mt-1.5 text-caption text-faint">
              Mỗi ca luôn để trống chừng này máy, phòng khi máy hỏng. Còn {Math.max(0, seats.length - reserve)} chỗ xếp người.
            </p>
          </>
        )}
      </Card>

      <Card className="flex min-w-0 flex-1 flex-col gap-4" aria-label="Sơ đồ phòng">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-baseline gap-2">
            <h2 className="flex min-w-0 text-lg font-semibold">
              {room ? (
                <EditableName value={room.name} label="Đổi tên phòng" onChange={(name) => update({ ...room, name })} />
              ) : (
                "Sơ đồ phòng"
              )}
            </h2>
            {room && <span className="text-muted">{seats.length} máy{reserve ? ` · ${reserve} dự phòng` : ""}</span>}
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
                <option key={r.id} value={r.id} disabled={usedIds.has(r.id)}>
                  {r.name} ({cellCount(r) - r.off.length} máy){usedIds.has(r.id) ? " · đã chọn" : ""}
                </option>
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
  );
}

/** Ô số gọn cho bảng kích thước từng khoang (không có nút −/+ vì hai ô nằm cạnh nhau). */
function SizeInput({
  label, value, max, onChange,
}: {
  label: string;
  value: number | null;
  max: number;
  onChange: (v: number | null) => void;
}) {
  return (
    <input
      aria-label={label}
      inputMode="numeric"
      placeholder="–"
      value={value ?? ""}
      onChange={(e) => {
        const raw = e.target.value.replace(/\D/g, "");
        onChange(raw ? Math.min(max, Math.max(1, parseInt(raw, 10))) : null);
      }}
      className="field h-10 w-14 text-center text-lg font-semibold"
    />
  );
}
