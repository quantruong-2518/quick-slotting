"use client";

import { useMemo, useState } from "react";
import { Button } from "./ui/button";
import { Card, CheckIcon, DownloadIcon, Notice, Pill } from "./ui/card";
import { NumberStepper } from "./ui/number-stepper";
import { Segmented } from "./ui/segmented";
import { SeatZones } from "./seat-zones";
import { EditableName } from "./ui/editable-name";
import { ExportDialog } from "./export-dialog";
import { MoveDialog } from "./move-dialog";
import { ShareDialog } from "./share-dialog";
import { unitColor } from "@/lib/colors";
import { downloadBlob, excelFiles, resultXlsx, type ExcelFile } from "@/lib/excel";
import { norm, normalizeCode } from "@/lib/people";
import { buildSharePayload } from "@/lib/room-share";
import { MAX_SESSIONS, capacityOf, slotName } from "@/lib/sessions";
import { fingerprint, loadShare, publishRoom, shareKey, type SavedShare } from "@/lib/share-client";
import type { Adjacency, Person, RoomConfig, Seat, SeatRef, SlotResult, SpareMode, Unit } from "@/lib/types";

/** Kết quả xếp: slots[ca][phòng]. edited = đã đổi chỗ bằng tay sau lần xếp gần nhất. */
export interface Plan {
  slots: SlotResult[][];
  edited: boolean;
}

const MAX_HITS = 50;

export function ResultStep({
  rooms, seatsOf, nbOf, people, units, result, progress, adj, spare, sessions, minSessions,
  onAdj, onSpare, onSessions, onRerun, onMove, onRename, onBack,
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
  const key = shareKey(rooms.map((r) => r.id));
  const [share, setShare] = useState<SavedShare | null>(() => loadShare(key));
  const [dialog, setDialog] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const S = result?.slots.length ?? sessions;
  const R = rooms.length;
  const cur = { s: Math.min(sel.s, S - 1), r: Math.min(sel.r, R - 1) };
  const room = rooms[cur.r];
  const seats = seatsOf[cur.r];
  const zone = Math.min(zoneSel, room.blocks - 1);
  const slot = result?.slots[cur.s]?.[cur.r] ?? null;
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

  const place = (at: SeatRef) => `${slotName(at.s, rooms[at.r].name, S)} · Máy ${seatsOf[at.r][at.i].number}`;

  return (
    <>
      <Card className="flex flex-1 flex-col gap-4" aria-label="Kết quả xếp chỗ">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="mr-2 text-lg font-semibold">Kết quả</h2>
          <Pill><b className="font-semibold">{people.length}</b> người</Pill>
          {R > 1 || S > 1 ? (
            <Pill><b className="font-semibold">{S}</b> ca × <b className="font-semibold">{R}</b> phòng</Pill>
          ) : (
            <Pill><b className="font-semibold">{people.length}/{totalSeats}</b> máy</Pill>
          )}
          {result && !running &&
            (conflicts === 0 ? (
              <Pill tone="ok"><CheckIcon className="size-3.5" /> 0 cặp cùng ĐV ngồi cạnh</Pill>
            ) : (
              <Pill tone="warn">Còn {conflicts} cặp cùng ĐV ngồi cạnh</Pill>
            ))}
          {running && <Pill>Đang xếp…{progress.total > 1 ? ` ${progress.done}/${progress.total} phòng` : ""}</Pill>}
          <span className="flex-1" />
          <Segmented
            label="Tính ngồi cạnh nhau"
            value={adj}
            onChange={onAdj}
            options={[
              { value: "lr", label: "Cạnh: Trái-phải", hint: "Chỉ tính hai người liền nhau trong cùng hàng, cùng khoang" },
              { value: "lrfb", label: "+ Trước-sau" },
              { value: "all", label: "+ Chéo" },
            ]}
          />
          {S * totalSeats > people.length && (
            <Segmented
              label="Máy trống"
              value={spare}
              onChange={onSpare}
              options={[
                { value: "tail", label: "Trống cuối", hint: "Để trống các máy số lớn nhất (máy dự phòng nằm ở cuối)" },
                { value: "spread", label: "Trống rải", hint: "Chỗ trống xen kẽ, dễ xếp hơn khi có đơn vị đông" },
              ]}
            />
          )}
          <Button onClick={onRerun} disabled={running}>
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-4">
              <path d="M13.5 8a5.5 5.5 0 11-1.6-3.9M13.5 2.5v3h-3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Xếp lại
          </Button>
        </div>

        <div className={`flex items-start gap-6 rounded-card bg-subtle p-4 ${result && S * R > 1 ? "" : "self-start"}`}>
          <div className="flex w-60 shrink-0 flex-col gap-2">
            <NumberStepper
              id="sessions"
              label="Số ca"
              value={sessions}
              min={minSessions}
              max={MAX_SESSIONS}
              readOnly
              onChange={(v) => v && v !== sessions && !running && onSessions(v)}
            />
            <p className="text-caption text-muted">
              {minSessions > 1
                ? `Cần ít nhất ${minSessions} ca. Người được chia đều các ca, mỗi ĐV rải đều các phòng.`
                : "Thêm ca nếu muốn mỗi phòng ít người hơn."}
            </p>
          </div>
          {result && S * R > 1 && (
            <div className="min-w-0 flex-1 overflow-x-auto">
              <table className="border-separate border-spacing-1.5 text-body">
                <thead>
                  <tr>
                    <th />
                    {rooms.map((rm, r) => (
                      <th key={rm.id} className="px-1 text-left align-bottom font-medium">
                        <span className="block font-semibold">{rm.name}</span>
                        <span className="block text-caption font-normal text-muted">
                          {capacityOf(seatsOf[r].length, rm.reserve)} chỗ{rm.reserve ? ` + ${rm.reserve} dự phòng` : ""}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.slots.map((row, s) => (
                    <tr key={s}>
                      <th scope="row" className="pr-2 text-left font-semibold whitespace-nowrap">Ca {s + 1}</th>
                      {row.map((x, r) => {
                        const on = s === cur.s && r === cur.r;
                        return (
                          <td key={r}>
                            <button
                              type="button"
                              aria-pressed={on}
                              aria-label={`${slotName(s, rooms[r].name, S)}: ${x.items.filter((p) => p >= 0).length} người`}
                              onClick={() => setSel({ s, r })}
                              className={`flex h-11 w-full min-w-32 items-center justify-between gap-3 rounded-control px-3 ${
                                on ? "bg-white font-semibold ring-2 ring-brand" : "bg-white/60 hover:bg-white"
                              }`}
                            >
                              <span className="tabular-nums">{x.items.filter((p) => p >= 0).length} người</span>
                              {x.conflictPairs ? (
                                <span className="text-caption font-semibold text-warn">{x.conflictPairs} cặp</span>
                              ) : (
                                <CheckIcon className="size-4 text-ok" />
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {units.map((u) => (
            <span key={u.id} className="inline-flex h-8 items-center gap-2 rounded-chip bg-subtle px-2.5 text-sm">
              <span className="size-3 rounded-sm" style={{ background: unitColor(u.id) }} />
              {u.name}
              <b className="font-semibold tabular-nums">{u.count}</b>
            </span>
          ))}
        </div>

        <div className="flex items-baseline justify-between gap-4">
          <h3 className="flex min-w-0 items-center gap-1.5 text-lg font-semibold">
            {S > 1 && <span className="shrink-0">Ca {cur.s + 1} ·</span>}
            <EditableName key={room.id} value={room.name} label="Đổi tên phòng" onChange={(name) => onRename(cur.r, name)} />
          </h3>
          {slot && (
            <span className="text-body text-muted tabular-nums">
              {filled} người / {seats.length} máy
              {seats.length > filled ? ` · ${seats.length - filled} máy trống` : ""}
              {reserve ? ` (giữ ${reserve} dự phòng)` : ""}
            </span>
          )}
        </div>

        {slot && slot.conflictPairs > 0 && slot.capacityIssues.length > 0 && (
          <Notice tone="warn">
            {slot.capacityIssues.map((c) => `${units[c.unitId].name} có ${c.count} người trong phòng này, chỉ xếp được tối đa ${c.max} người không ngồi cạnh nhau`).join(". ")}.
            Hãy thêm ca, bỏ bớt máy dự phòng, chọn &quot;Trống rải&quot; hoặc tính cạnh nhau lỏng hơn.
          </Notice>
        )}

        <div className={`overflow-auto rounded-card bg-subtle p-5 ${running ? "opacity-50" : ""}`}>
          {slot ? (
            <div className="mx-auto w-fit">
              <SeatZones
                room={room}
                seats={seats}
                onZone={setZone}
                zoneClass={(b) => (b === zone ? "bg-zone-active ring-2 ring-brand" : "bg-zone hover:bg-zone-hover")}
                renderSeat={(seat) => {
                  if (!seat) return <span className="block h-10 w-11" />;
                  const i = indexOf.get(seat.key)!;
                  const p = slot.items[i] >= 0 ? people[slot.items[i]] : null;
                  const bad = slot.conflictSeats.has(i);
                  return (
                    <span
                      title={
                        p
                          ? `Máy ${seat.number}: ${p.name} (${p.code}), ${units[p.unitId].name}${p.field ? `, ${p.field}` : ""}`
                          : `Máy ${seat.number}: trống`
                      }
                      className={`grid h-10 w-11 place-items-center rounded-control text-sm font-semibold tabular-nums ${
                        p ? "text-ink" : "bg-subtle text-faint"
                      } ${bad ? "ring-2 ring-danger" : ""}`}
                      style={p ? { background: unitColor(p.unitId) } : undefined}
                    >
                      {seat.number}
                    </span>
                  );
                }}
              />
              <p className="mt-3 text-center text-caption text-faint">Bấm vào một khoang để xem danh sách bên dưới</p>
            </div>
          ) : (
            <p className="py-16 text-center text-muted">Đang xếp…</p>
          )}
        </div>

        <section aria-label="Danh sách chỗ ngồi" className="flex flex-col overflow-hidden rounded-card bg-subtle">
          <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
            <span className="font-semibold">{hits ? `Tìm thấy ${hits.length}${hits.length === MAX_HITS ? "+" : ""} người` : `Khoang ${zone + 1}`}</span>
            {!hits && (
              <span className="text-caption text-muted">
                {zoneRows.filter((x) => x.p >= 0).length} người / {zoneRows.length} máy
              </span>
            )}
            <span className="flex-1" />
            <input
              type="search"
              aria-label="Tìm theo họ tên hoặc Mã CC"
              placeholder="Tìm họ tên hoặc Mã CC (mọi ca, mọi phòng)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="field h-10 w-96 bg-white px-3 text-body"
            />
          </div>
          <div className="max-h-130 overflow-auto px-2">
            <table className="w-full border-collapse text-body">
              <thead className="sticky top-0 bg-subtle text-left text-caption text-muted">
                <tr className="h-9">
                  {hits && <th className="px-2 font-medium">Ca · Phòng</th>}
                  <th className="w-14 px-2 font-medium">Máy</th>
                  <th className="px-2 font-medium">Họ tên</th>
                  <th className="px-2 font-medium">Mã CC</th>
                  <th className="px-2 font-medium">Đơn vị</th>
                  {hasField && <th className="px-2 font-medium">Lĩnh vực</th>}
                  <th className="w-24 px-2" />
                </tr>
              </thead>
              <tbody>
                {(hits ?? zoneRows).map(({ at, p: pi }) => {
                  const p = pi >= 0 ? people[pi] : null;
                  const bad = !!result?.slots[at.s][at.r].conflictSeats.has(at.i);
                  return (
                    <tr key={`${at.s}-${at.r}-${at.i}`} className={`h-11 border-b border-line ${bad ? "bg-danger-bg" : ""}`}>
                      {hits && (
                        <td className="px-2">
                          <button type="button" onClick={() => show(at)} className="text-left font-medium text-brand-ink hover:underline">
                            {slotName(at.s, rooms[at.r].name, S)}
                          </button>
                        </td>
                      )}
                      <td className={`px-2 font-semibold tabular-nums ${bad ? "text-danger" : "text-muted"}`}>{seatsOf[at.r][at.i].number}</td>
                      {p ? (
                        <>
                          <td className="px-2 font-semibold">
                            <span className="inline-flex items-center gap-2">
                              <span className="size-2.5 shrink-0 rounded-sm" style={{ background: unitColor(p.unitId) }} />
                              {p.name}
                            </span>
                          </td>
                          <td className="px-2 font-mono text-caption">{p.code}</td>
                          <td className="px-2">{units[p.unitId].name}</td>
                          {hasField && <td className="px-2">{p.field}</td>}
                          <td className="px-2 text-right">
                            <Button className="h-8 px-3 text-sm whitespace-nowrap" disabled={running} onClick={() => setMoving(at)}>Đổi chỗ</Button>
                          </td>
                        </>
                      ) : (
                        <td colSpan={hasField ? 5 : 4} className="px-2 text-faint">Trống</td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {hits && hits.length === 0 && <p className="py-6 text-center text-muted">Không có ai khớp &quot;{q}&quot;.</p>}
          </div>
        </section>
      </Card>

      <div className="flex items-center justify-between">
        <Button size="lg" onClick={onBack}>Quay lại</Button>
        <div className="flex items-center gap-3">
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
