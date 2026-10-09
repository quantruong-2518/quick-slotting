"use client";

import { DndContext, DragOverlay, PointerSensor, pointerWithin, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { snapCenterToCursor } from "@dnd-kit/modifiers";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Button } from "./ui/button";
import { Card, CheckIcon, ChevronIcon, DownloadIcon, Notice, Pill, SearchIcon, SlidersIcon, WarnIcon } from "./ui/card";
import { NumberStepper } from "./ui/number-stepper";
import { Segmented } from "./ui/segmented";
import { SeatZones } from "./seat-zones";
import { EditableName } from "./ui/editable-name";
import { ExportDialog } from "./export-dialog";
import { MoveDialog } from "./move-dialog";
import { SwapDialog } from "./swap-dialog";
import { DraggableSeat, SeatGhost } from "./draggable-seat";
import { ShareDialog } from "./share-dialog";
import { unitColor } from "@/lib/colors";
import { downloadBlob, excelFiles, resultXlsx, type ExcelFile } from "@/lib/excel";
import { norm, normalizeCode } from "@/lib/people";
import { seatRanges } from "@/lib/room";
import { buildSharePayload } from "@/lib/room-share";
import { MAX_SESSIONS, moveField, nextConflictSlot, slotName, type FieldInfo } from "@/lib/sessions";
import { fingerprint, loadShare, publishRoom, shareKey, type SavedShare } from "@/lib/share-client";
import type { Adjacency, FillMode, Person, RoomConfig, Seat, SeatRef, SlotResult, SpareMode, Unit } from "@/lib/types";

/** Kết quả xếp: slots[ca][phòng]. edited = đã đổi chỗ bằng tay sau lần xếp gần nhất. */
export interface Plan {
  slots: SlotResult[][];
  edited: boolean;
}

const MAX_HITS = 50;
/** Tới chừng này lựa chọn thì ca/phòng còn hiện thành thanh chọn; nhiều hơn thì dùng ô chọn thả xuống. */
const MAX_TABS = 6;
const TH = "bg-subtle px-3 font-medium first:rounded-l-control last:rounded-r-control";
/** Lời cho trình đọc màn hình khi kéo thả (mặc định của dnd-kit là tiếng Anh). */
const DRAG_A11Y = {
  screenReaderInstructions: { draggable: "Kéo số máy này thả vào số máy khác để hai người đổi chỗ, hoặc dùng nút Đổi chỗ trong danh sách." },
  announcements: {
    onDragStart: () => "Đang kéo một số máy.",
    onDragOver: ({ over }: { over: unknown }) => (over ? "Đang ở trên một máy có người, thả ra để đổi chỗ." : "Chưa ở trên máy nào."),
    onDragEnd: ({ over }: { over: unknown }) => (over ? "Đã thả, chờ xác nhận đổi chỗ." : "Đã bỏ, không đổi chỗ."),
    onDragCancel: () => "Đã bỏ, không đổi chỗ.",
  },
};

/** Chọn ca hoặc phòng đang xem. alert = ô sẽ tới còn cặp cùng ĐV ngồi cạnh nhau. */
function SlotPicker({
  label, value, options, onChange,
}: {
  label: string;
  value: number;
  options: { label: string; alert: boolean }[];
  onChange: (v: number) => void;
}) {
  if (options.length <= MAX_TABS) {
    return (
      <Segmented
        label={label}
        value={String(value)}
        onChange={(v) => onChange(Number(v))}
        options={options.map((o, i) => ({ value: String(i), label: o.label, alert: o.alert ? "có cặp trùng" : undefined }))}
      />
    );
  }
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(Number(e.target.value))} className="field h-10 px-3 text-body">
      {options.map((o, i) => (
        <option key={i} value={i}>{o.label}{o.alert ? " (có cặp trùng)" : ""}</option>
      ))}
    </select>
  );
}

export function ResultStep({
  rooms, seatsOf, nbOf, people, units, result, progress, adj, spare, sessions, minSessions, byField, fields,
  onFill, onFieldOrder, onAdj, onSpare, onSessions, onRerun, onMove, onRename, onBack,
}: {
  rooms: RoomConfig[];
  seatsOf: Seat[][];
  nbOf: number[][][];
  people: Person[];
  units: Unit[];
  result: Plan | null;
  progress: { done: number; total: number } | null;
  adj: Adjacency;
  spare: SpareMode;
  sessions: number;
  minSessions: number;
  byField: boolean;
  /** Các lĩnh vực theo thứ tự đang xếp. */
  fields: FieldInfo[];
  onFill: (f: FillMode) => void;
  onFieldOrder: (keys: string[]) => void;
  onAdj: (a: Adjacency) => void;
  onSpare: (s: SpareMode) => void;
  onSessions: (n: number) => void;
  onRerun: () => void;
  onMove: (a: SeatRef, b: SeatRef) => void;
  /** Đổi tên phòng thứ r (không làm mất kết quả). */
  onRename: (r: number, name: string) => void;
  onBack: () => void;
}) {
  const running = progress !== null;
  const [sel, setSel] = useState({ s: 0, r: 0 });
  const [zoneSel, setZone] = useState(0);
  const [query, setQuery] = useState("");
  const [moving, setMoving] = useState<SeatRef | null>(null);
  const [swap, setSwap] = useState<[SeatRef, SeatRef] | null>(null);
  const key = shareKey(rooms.map((r) => r.id));
  const [share, setShare] = useState<SavedShare | null>(() => loadShare(key));
  const [dialog, setDialog] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [options, setOptions] = useState(false);

  const S = result?.slots.length ?? sessions;
  const R = rooms.length;
  const cur = { s: Math.min(sel.s, S - 1), r: Math.min(sel.r, R - 1) };
  const room = rooms[cur.r];
  const seats = seatsOf[cur.r];
  const zone = Math.min(zoneSel, room.blocks - 1);
  const slot = result?.slots[cur.s]?.[cur.r] ?? null;
  const [activeSeat, setActiveSeat] = useState<number | null>(null);
  // Ô đang rê tới; giữ nguyên sau khi thả để biết là thả vào ô khác hay thả ra ngoài.
  const [overSeat, setOverSeat] = useState<number | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  function dragEnd({ active, over }: DragEndEvent) {
    setActiveSeat(null);
    if (over && over.id !== active.id) setSwap([{ ...cur, i: Number(active.id) }, { ...cur, i: Number(over.id) }]);
  }
  // Hai ô đổi chỗ thì trượt về vị trí của nhau (FLIP): ghi vị trí lúc xác nhận, trượt sau khi sơ đồ đã đổi.
  const seatEls = useRef(new Map<number, HTMLElement>());
  const flip = useRef<{ i: number; dx: number; dy: number }[] | null>(null);
  function confirmSwap([a, b]: [SeatRef, SeatRef]) {
    const ra = seatEls.current.get(a.i)?.getBoundingClientRect();
    const rb = seatEls.current.get(b.i)?.getBoundingClientRect();
    if (ra && rb) {
      flip.current = [
        { i: a.i, dx: rb.left - ra.left, dy: rb.top - ra.top },
        { i: b.i, dx: ra.left - rb.left, dy: ra.top - rb.top },
      ];
    }
    onMove(a, b);
    setSwap(null);
  }
  useLayoutEffect(() => {
    const moves = flip.current;
    flip.current = null;
    if (!moves || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    for (const { i, dx, dy } of moves) {
      const el = seatEls.current.get(i);
      if (!el) continue;
      el.style.zIndex = "20";
      el.animate(
        [{ transform: `translate(${dx}px, ${dy}px) scale(1.2)` }, { transform: "translate(0, 0) scale(1)" }],
        { duration: 380, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
      ).finished.then(() => { el.style.zIndex = ""; }, () => { el.style.zIndex = ""; });
    }
  }, [result]);
  const indexOf = useMemo(() => new Map(seats.map((s, i) => [s.key, i])), [seats]);
  const hasField = people.some((p) => p.field);
  const totalSeats = seatsOf.reduce((n, x) => n + x.length, 0);
  const conflicts = result ? result.slots.flat().reduce((n, x) => n + x.conflictPairs, 0) : 0;
  const items = useMemo(() => result?.slots.map((row) => row.map((x) => x.items)) ?? null, [result]);

  // Người nào đang ngồi ở đâu, để tìm kiếm trên mọi ca, mọi phòng.
  const where = useMemo(() => {
    const m = new Map<number, SeatRef>();
    items?.forEach((row, s) => row.forEach((its, r) => its.forEach((p, i) => p >= 0 && m.set(p, { s, r, i }))));
    return m;
  }, [items]);

  const q = query.trim();
  const hits = useMemo(() => {
    if (!q) return null;
    const qn = norm(q);
    const qc = normalizeCode(q);
    const out: { p: number; at: SeatRef }[] = [];
    for (let p = 0; p < people.length && out.length < MAX_HITS; p++) {
      const at = where.get(p);
      if (at && (norm(people[p].name).includes(qn) || normalizeCode(people[p].code).includes(qc))) out.push({ p, at });
    }
    return out;
  }, [q, people, where]);

  const zoneRows = slot ? seats.flatMap((s, i) => (s.block === zone ? [{ at: { ...cur, i }, p: slot.items[i] }] : [])) : [];
  const zonePeople = zoneRows.filter((x) => x.p >= 0);
  const zoneEmpty = zoneRows.filter((x) => x.p < 0).map((x) => seats[x.at.i].number);
  const filled = slot ? slot.items.filter((x) => x >= 0).length : 0;
  const reserve = room.reserve ?? 0;

  const payload = useMemo(
    () => (items ? buildSharePayload(rooms, seatsOf, items, people, units) : null),
    [rooms, seatsOf, items, people, units],
  );
  const outdated = !!share && !!payload && fingerprint(payload) !== share.fp;

  async function publish() {
    if (!payload) return;
    setSharing(true);
    setShareError(null);
    try {
      setShare(await publishRoom(key, payload));
    } catch (e) {
      setShareError(e instanceof Error ? e.message : "Không chia sẻ được, hãy thử lại.");
    } finally {
      setSharing(false);
    }
  }

  function openShare() {
    setDialog(true);
    if (!share || share.expiresAt <= Date.now()) void publish(); // mã hết hạn thì tạo mã mới
  }

  async function download(files: ExcelFile[]) {
    if (!items) return;
    for (const [k, f] of files.entries()) {
      // Cách nhau một nhịp để trình duyệt không bỏ sót file khi tải nhiều file liền nhau.
      if (k) await new Promise((done) => setTimeout(done, 300));
      downloadBlob(await resultXlsx(rooms, seatsOf, items, people, f), f.name);
    }
  }

  function show(at: SeatRef) {
    setSel({ s: at.s, r: at.r });
    setZone(seatsOf[at.r][at.i].block);
    setQuery("");
  }

  /** Nhảy tới ô (ca, phòng) kế tiếp còn cặp trùng và mở khoang có ghế trùng đầu tiên. */
  function showConflict() {
    if (!result) return;
    const next = nextConflictSlot(result.slots.map((row) => row.map((x) => x.conflictPairs)), cur);
    if (!next) return;
    const first = Math.min(...result.slots[next.s][next.r].conflictSeats);
    setSel(next);
    if (Number.isFinite(first)) setZone(seatsOf[next.r][first].block);
    setQuery("");
  }

  const place = (at: SeatRef) => `${slotName(at.s, rooms[at.r].name, S)} · Máy ${seatsOf[at.r][at.i].number}`;

  return (
    <>
      <Card className="flex flex-1 flex-col gap-6" aria-label="Kết quả xếp chỗ">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold">Kết quả xếp chỗ</h2>
            {result && !running &&
              (conflicts === 0 ? (
                <Pill tone="ok"><CheckIcon className="size-3.5" /> Không ai ngồi cạnh người cùng ĐV</Pill>
              ) : (
                <button
                  type="button"
                  title="Tới chỗ còn cặp cùng ĐV ngồi cạnh nhau"
                  onClick={showConflict}
                  className="inline-flex h-10 items-center gap-2 rounded-control bg-warn-bg px-3 text-body font-medium text-warn hover:brightness-95"
                >
                  <WarnIcon />
                  Còn {conflicts} cặp cùng ĐV ngồi cạnh nhau
                  <span className="font-semibold underline">Xem</span>
                </button>
              ))}
            {running && <Pill>Đang xếp…{progress.total > 1 ? ` ${progress.done}/${progress.total} phòng` : ""}</Pill>}
            <span className="flex-1" />
            <div className="flex flex-wrap gap-2">
              <Button
                aria-expanded={options}
                aria-controls="tuy-chon-xep"
                onClick={() => setOptions(!options)}
                className="aria-expanded:bg-brand-soft aria-expanded:text-brand-ink"
              >
                <SlidersIcon />
                Tuỳ chọn xếp
                <ChevronIcon className={`size-4 transition-transform ${options ? "rotate-180" : ""}`} />
              </Button>
              <Button onClick={onRerun} disabled={running}>
                <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-4">
                  <path d="M13.5 8a5.5 5.5 0 11-1.6-3.9M13.5 2.5v3h-3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Xếp lại
              </Button>
            </div>
          </div>

          {options && (
            <div id="tuy-chon-xep" className="flex flex-wrap items-end gap-x-6 gap-y-4 rounded-card bg-subtle p-4">
              {hasField && (
                <div className="flex flex-col gap-2">
                  <span className="text-caption font-medium text-muted">Cách chia người vào ca, phòng</span>
                  <Segmented
                    label="Cách chia người vào ca, phòng"
                    value={byField ? "field" : "even"}
                    onChange={(f) => !running && onFill(f)}
                    options={[
                      { value: "even", label: "Chia đều", hint: "Mỗi ca, mỗi phòng đông gần bằng nhau, đơn vị rải đều" },
                      { value: "field", label: "Theo lĩnh vực", hint: "Xếp lĩnh vực này trước rồi mới sang lĩnh vực kế; các đơn vị trong một lĩnh vực được trộn vào nhau" },
                    ]}
                  />
                </div>
              )}
              {byField && fields.length > 1 && (
                <div className="flex w-full flex-col gap-2">
                  <span className="text-caption font-medium text-muted">Thứ tự xếp các lĩnh vực (trên xếp trước)</span>
                  <ol className="flex max-w-md flex-col gap-1">
                    {fields.map((f, i) => (
                      <li key={f.key} className="flex items-center gap-2">
                        <span className="w-6 text-right text-body text-muted tabular-nums">{i + 1}.</span>
                        <span className="min-w-0 flex-1 truncate text-body">
                          <span className="font-semibold">{f.name}</span> <span className="text-muted">· {f.count} người</span>
                        </span>
                        <Button
                          aria-label={`Đưa ${f.name} lên trước`}
                          title="Lên trước"
                          disabled={running || i === 0}
                          onClick={() => onFieldOrder(moveField(fields.map((x) => x.key), i, -1))}
                        >
                          <ChevronIcon className="size-4 rotate-180" />
                        </Button>
                        <Button
                          aria-label={`Đưa ${f.name} xuống sau`}
                          title="Xuống sau"
                          disabled={running || i === fields.length - 1}
                          onClick={() => onFieldOrder(moveField(fields.map((x) => x.key), i, 1))}
                        >
                          <ChevronIcon className="size-4" />
                        </Button>
                      </li>
                    ))}
                  </ol>
                  <p className="max-w-md text-caption text-muted">
                    Nếu một đơn vị quá đông thì phòng đó nhận thêm người lĩnh vực kế, hoặc xếp thêm ca, để không ai ngồi cạnh người cùng ĐV.
                  </p>
                </div>
              )}
              {!byField && <div
                className="flex items-end gap-3"
                title={minSessions > 1 ? `Cần ít nhất ${minSessions} ca mới đủ chỗ` : "Tăng số ca nếu muốn mỗi phòng đỡ đông"}
              >
                <NumberStepper
                  stacked
                  id="sessions"
                  label="Số ca thi"
                  value={sessions}
                  min={minSessions}
                  max={MAX_SESSIONS}
                  readOnly
                  onChange={(v) => v && v !== sessions && !running && onSessions(v)}
                />
                {minSessions > 1 && <span className="pb-2.5 text-caption text-muted">tối thiểu {minSessions}</span>}
              </div>}
              <div className="flex flex-col gap-2">
                <span className="text-caption font-medium text-muted">Tính là ngồi cạnh nhau</span>
                <Segmented
                  label="Tính là ngồi cạnh nhau"
                  value={adj}
                  onChange={onAdj}
                  options={[
                    { value: "lr", label: "Trái - phải", hint: "Chỉ tính hai người liền nhau trong cùng hàng, cùng khoang" },
                    { value: "lrfb", label: "Thêm trước - sau", hint: "Tính cả người ngồi ngay trước và ngay sau" },
                    { value: "all", label: "Thêm chéo", hint: "Tính cả người ngồi chéo" },
                  ]}
                />
              </div>
              {S * totalSeats > people.length && (
                <div className="flex flex-col gap-2">
                  <span className="text-caption font-medium text-muted">Máy để trống</span>
                  <Segmented
                    label="Máy để trống"
                    value={spare}
                    onChange={onSpare}
                    options={[
                      { value: "tail", label: "Dồn cuối phòng", hint: "Để trống các máy số lớn nhất (máy dự phòng nằm ở cuối)" },
                      { value: "spread", label: "Rải xen kẽ", hint: "Chỗ trống xen kẽ giữa các máy, dễ xếp hơn khi có đơn vị đông" },
                    ]}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {S > 1 && (
              <SlotPicker
                label="Chọn ca"
                value={cur.s}
                onChange={(s) => setSel({ ...cur, s })}
                options={Array.from({ length: S }, (_, s) => ({
                  label: `Ca ${s + 1}`,
                  alert: !!result?.slots[s]?.some((x) => x.conflictPairs > 0),
                }))}
              />
            )}
            {R > 1 ? (
              <div className="flex flex-wrap items-center gap-1">
                <SlotPicker
                  label="Chọn phòng"
                  value={cur.r}
                  onChange={(r) => setSel({ ...cur, r })}
                  options={rooms.map((rm, r) => ({ label: rm.name, alert: !!result?.slots[cur.s]?.[r]?.conflictPairs }))}
                />
                <EditableName key={room.id} iconOnly value={room.name} label="Đổi tên phòng" onChange={(name) => onRename(cur.r, name)} />
              </div>
            ) : (
              <h3 className="flex min-w-0 items-center text-body font-semibold">
                <EditableName key={room.id} value={room.name} label="Đổi tên phòng" onChange={(name) => onRename(cur.r, name)} />
              </h3>
            )}
            {slot && (
              <span className="text-caption text-muted tabular-nums">
                {filled} người · {seats.length > filled ? `${seats.length - filled} máy trống` : "kín chỗ"}
                {reserve ? ` (giữ ${reserve} dự phòng)` : ""}
              </span>
            )}
          </div>

          {slot && slot.conflictPairs > 0 && slot.capacityIssues.length > 0 && (
            <Notice tone="warn" className="flex items-start gap-3">
              <WarnIcon className="mt-1 size-4" />
              <span>
                {slot.capacityIssues.map((c) => `${units[c.unitId].name} có ${c.count} người trong phòng này, chỉ xếp được tối đa ${c.max} người không ngồi cạnh nhau`).join(". ")}.
                Hãy thêm ca, bỏ bớt máy dự phòng, chọn &quot;Rải xen kẽ&quot; hoặc tính ngồi cạnh nhau lỏng hơn.
              </span>
            </Notice>
          )}

          <div className={`overflow-auto rounded-card bg-subtle p-4 ${running ? "opacity-50" : ""}`}>
            {slot ? (
              <>
                <DndContext
                  sensors={sensors}
                  accessibility={DRAG_A11Y}
                  collisionDetection={pointerWithin}
                  onDragStart={(e) => { setActiveSeat(Number(e.active.id)); setOverSeat(null); }}
                  onDragOver={(e) => setOverSeat(e.over ? Number(e.over.id) : null)}
                  onDragEnd={dragEnd}
                  onDragCancel={() => setActiveSeat(null)}
                >
                  <div className="mx-auto w-fit">
                    <SeatZones
                      room={room}
                      seats={seats}
                      onZone={setZone}
                      // Khoang đang xem chỉ viền nhạt; viền xanh đậm dành cho ô đích khi kéo thả.
                      zoneClass={(b) => (room.blocks > 1 && b === zone ? "bg-zone-active ring-2 ring-brand-line" : "bg-zone hover:bg-zone-hover")}
                      renderSeat={(seat) => {
                        if (!seat) return <span className="block h-10 w-11" />;
                        const i = indexOf.get(seat.key)!;
                        const p = slot.items[i] >= 0 ? people[slot.items[i]] : null;
                        const bad = slot.conflictSeats.has(i);
                        return (
                          <DraggableSeat
                            id={i}
                            number={seat.number}
                            color={p ? unitColor(p.unitId) : null}
                            title={p ? `Máy ${seat.number}: ${p.name} (${p.code}), ${units[p.unitId].name}${p.field ? `, ${p.field}` : ""}` : ""}
                            bad={bad}
                            busy={activeSeat !== null}
                            canDrag={!!p && !running}
                            elRef={(el) => { if (el) seatEls.current.set(i, el); else seatEls.current.delete(i); }}
                          />
                        );
                      }}
                    />
                  </div>
                  {/* Thả vào ô khác thì hộp xác nhận hiện ngay; thả ra ngoài hay Esc thì ô bay về chỗ cũ. */}
                  <DragOverlay modifiers={[snapCenterToCursor]} dropAnimation={overSeat !== null ? null : undefined}>
                    {activeSeat !== null && slot.items[activeSeat] >= 0 && (
                      <SeatGhost number={seats[activeSeat].number} color={unitColor(people[slot.items[activeSeat]].unitId)} />
                    )}
                  </DragOverlay>
                </DndContext>
                <p className="mt-3 text-center text-caption text-muted">
                  {slot.conflictPairs > 0 && "Ô viền đỏ là người đang ngồi cạnh người cùng ĐV. "}
                  Kéo số máy này thả vào số máy kia để hai người đổi chỗ.
                  {slot.conflictPairs === 0 && room.blocks > 1 && " Bấm một khoang để xem danh sách của khoang đó."}
                </p>
              </>
            ) : (
              <p className="py-16 text-center text-muted">Đang xếp…</p>
            )}
          </div>

          <ul aria-label="Màu theo đơn vị" className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted">
            {units.map((u) => (
              <li key={u.id} className="inline-flex items-center gap-2">
                <span className="size-3 shrink-0 rounded-sm" style={{ background: unitColor(u.id) }} />
                <span className="italic-note">{u.name}</span>
                <span className="font-medium text-ink tabular-nums">{u.count}</span>
              </li>
            ))}
          </ul>
        </div>

        <section aria-label="Danh sách chỗ ngồi" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h3 className="text-body font-semibold">
              {hits
                ? `Tìm thấy ${hits.length}${hits.length === MAX_HITS ? "+" : ""} người`
                : room.blocks > 1 ? `Danh sách khoang ${zone + 1}` : "Danh sách chỗ ngồi"}
            </h3>
            {!hits && (
              <span className="text-caption text-muted tabular-nums">
                {zonePeople.length} người{zoneEmpty.length ? ` · ${zoneEmpty.length} máy trống` : ""}
              </span>
            )}
            <span className="flex-1" />
            <label className="relative block w-90 max-w-full">
              <span className="sr-only">Tìm theo họ tên hoặc Mã CC</span>
              <SearchIcon className="pointer-events-none absolute top-3 left-3 size-4 text-faint" />
              <input
                type="search"
                placeholder="Tìm họ tên hoặc Mã CC"
                title={R * S > 1 ? "Tìm trong mọi ca, mọi phòng" : undefined}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="field h-10 w-full pr-3 pl-9 text-body"
              />
            </label>
          </div>
          <div className="max-h-130 overflow-auto">
            <table className="w-full border-collapse text-body">
              <thead className="sticky top-0 text-left text-caption text-muted">
                <tr className="h-9">
                  {hits && <th className={TH}>Ca · Phòng</th>}
                  <th className={`w-16 ${TH}`}>Máy</th>
                  <th className={TH}>Họ tên</th>
                  <th className={TH}>Mã CC</th>
                  <th className={TH}>Đơn vị</th>
                  {hasField && <th className={TH}>Lĩnh vực</th>}
                  <th className={`w-26 ${TH}`}><span className="sr-only">Thao tác</span></th>
                </tr>
              </thead>
              <tbody>
                {(hits ?? zonePeople).map(({ at, p: pi }) => {
                  const p = people[pi];
                  const bad = !!result?.slots[at.s][at.r].conflictSeats.has(at.i);
                  return (
                    <tr key={`${at.s}-${at.r}-${at.i}`} className={`h-12 border-b border-line ${bad ? "bg-danger-bg" : ""}`}>
                      {hits && (
                        <td className="px-3">
                          <button type="button" onClick={() => show(at)} className="text-left font-medium text-brand-ink hover:underline">
                            {slotName(at.s, rooms[at.r].name, S)}
                          </button>
                        </td>
                      )}
                      <td className={`px-3 tabular-nums ${bad ? "font-semibold text-danger" : "text-muted"}`}>{seatsOf[at.r][at.i].number}</td>
                      <td className="px-3 font-semibold">
                        <span className="inline-flex items-center gap-2">
                          <span className="size-3 shrink-0 rounded-sm" style={{ background: unitColor(p.unitId) }} />
                          {p.name}
                        </span>
                      </td>
                      <td className="px-3 font-mono text-caption">{p.code}</td>
                      <td className="px-3">{units[p.unitId].name}</td>
                      {hasField && <td className="px-3">{p.field}</td>}
                      <td className="px-1 text-right">
                        <Button variant="ghost" className="whitespace-nowrap" disabled={running} onClick={() => setMoving(at)}>Đổi chỗ</Button>
                      </td>
                    </tr>
                  );
                })}
                {!hits && zoneEmpty.length > 0 && (
                  <tr className="h-12">
                    <td colSpan={hasField ? 6 : 5} className="px-3 text-faint tabular-nums">
                      {zoneEmpty.length} máy trống: {seatRanges(zoneEmpty)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {hits && hits.length === 0 && <p className="py-6 text-center text-muted">Không có ai khớp &quot;{q}&quot;.</p>}
          </div>
        </section>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button size="lg" onClick={onBack}>Quay lại</Button>
        <div className="flex flex-wrap items-center gap-3">
          {outdated && !dialog && <Pill tone="warn">Bản chia sẻ chưa cập nhật</Pill>}
          <Button size="lg" disabled={!result || running || sharing} onClick={openShare}>
            {sharing ? "Đang chia sẻ…" : "Chia sẻ phòng thi"}
          </Button>
          <Button
            variant="primary"
            size="lg"
            disabled={!items || running}
            onClick={() =>
              R * S > 1
                ? setExporting(true)
                : void download(excelFiles(rooms.map((x) => x.name), S, { session: null, room: null, split: "one" }))
            }
          >
            <DownloadIcon /> Tải Excel
          </Button>
        </div>
      </div>

      {moving && items && (
        <MoveDialog
          from={moving}
          rooms={rooms}
          seatsOf={seatsOf}
          nbOf={nbOf}
          items={items}
          people={people}
          units={units}
          place={place}
          onMove={(to) => { onMove(moving, to); setMoving(null); show(to); }}
          onClose={() => setMoving(null)}
        />
      )}
      {swap && items && (
        <SwapDialog
          a={swap[0]}
          b={swap[1]}
          items={items}
          nbOf={nbOf}
          people={people}
          units={units}
          seatNo={(at) => seatsOf[at.r][at.i].number}
          place={place}
          onConfirm={() => confirmSwap(swap)}
          onClose={() => setSwap(null)}
        />
      )}
      {exporting && (
        <ExportDialog
          roomNames={rooms.map((x) => x.name)}
          sessions={S}
          onDownload={download}
          onClose={() => setExporting(false)}
        />
      )}
      {dialog && (
        <ShareDialog
          roomName={R > 1 ? `${R} phòng${S > 1 ? ` · ${S} ca` : ""}: một mã dùng chung` : room.name}
          id={share?.id ?? ""}
          outdated={outdated}
          busy={sharing}
          error={shareError}
          onUpdate={publish}
          onClose={() => setDialog(false)}
        />
      )}
    </>
  );
}
