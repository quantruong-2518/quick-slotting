"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CheckIcon, DownloadIcon, Notice, Pill } from "./ui/card";
import { Segmented } from "./ui/segmented";
import { SeatZones } from "./seat-zones";
import { unitColor } from "@/lib/colors";
import { downloadBlob, resultXlsx } from "@/lib/excel";
import { encodeShare } from "@/lib/share";
import type { Adjacency, Person, RoomConfig, Seat, SpareMode, Unit } from "@/lib/types";

export interface ResultState {
  items: number[];
  conflictPairs: number;
  conflictSeats: Set<number>;
  capacityIssues: { unitId: number; count: number; max: number }[];
}

export function ResultStep({
  room, seats, people, units, result, running, adj, spare, onAdj, onSpare, onRerun, onBack,
}: {
  room: RoomConfig;
  seats: Seat[];
  people: Person[];
  units: Unit[];
  result: ResultState | null;
  running: boolean;
  adj: Adjacency;
  spare: SpareMode;
  onAdj: (a: Adjacency) => void;
  onSpare: (s: SpareMode) => void;
  onRerun: () => void;
  onBack: () => void;
}) {
  const [zone, setZone] = useState(0);
  const [copied, setCopied] = useState(false);
  const indexOf = new Map(seats.map((s, i) => [s.key, i]));
  const empty = seats.length - people.length;

  const zoneItems = result
    ? seats
        .map((s, i) => ({ s, p: result.items[i] >= 0 ? people[result.items[i]] : null }))
        .filter((x) => x.s.block === zone)
    : [];

  async function copyLink() {
    if (!result) return;
    const data = encodeShare({
      v: 1,
      title: room.name,
      room: { name: room.name, blocks: room.blocks, rows: room.rows, cols: room.cols, style: room.style, start: room.start, off: room.off },
      rows: seats.flatMap((s, i) => {
        const p = result.items[i] >= 0 ? people[result.items[i]] : null;
        return p ? [[p.code, s.number, p.name, units[p.unitId].name] as [string, number, string, string]] : [];
      }),
    });
    await navigator.clipboard.writeText(`${location.origin}/tra-cuu#${data}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <>
      <Card className="flex flex-1 flex-col gap-4" aria-label="Kết quả xếp chỗ">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="mr-2 text-lg font-semibold">Kết quả</h2>
          <Pill><b className="font-semibold">{people.length}/{seats.length}</b> máy</Pill>
          {result && !running &&
            (result.conflictPairs === 0 ? (
              <Pill tone="ok"><CheckIcon className="size-3.5" /> 0 cặp cùng ĐV ngồi cạnh</Pill>
            ) : (
              <Pill tone="warn">Còn {result.conflictPairs} cặp cùng ĐV ngồi cạnh</Pill>
            ))}
          {running && <Pill>Đang xếp…</Pill>}
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
          {empty > 0 && (
            <Segmented
              label="Máy dư"
              value={spare}
              onChange={onSpare}
              options={[
                { value: "tail", label: "Trống cuối", hint: "Để trống các máy số lớn nhất" },
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

        {result && result.capacityIssues.length > 0 && (
          <Notice tone="warn">
            {result.capacityIssues.map((c) => `${units[c.unitId].name} có ${c.count} người, phòng chỉ cho tối đa ${c.max} người không ngồi cạnh nhau`).join(". ")}.
            Hãy bỏ bớt máy, chọn &quot;Trống rải&quot; hoặc tính cạnh nhau lỏng hơn.
          </Notice>
        )}

        <div className="flex flex-wrap gap-1.5">
          {units.map((u) => (
            <span key={u.id} className="inline-flex h-8 items-center gap-2 rounded-chip bg-subtle px-2.5 text-sm">
              <span className="size-3 rounded-sm" style={{ background: unitColor(u.id) }} />
              {u.name}
              <b className="font-semibold tabular-nums">{u.count}</b>
            </span>
          ))}
        </div>

        <div className="flex min-h-0 flex-1 gap-4">
          <div className={`shrink-0 overflow-auto rounded-card bg-subtle p-5 ${running ? "opacity-50" : ""}`}>
            {result && (
              <SeatZones
                room={room}
                seats={seats}
                onZone={setZone}
                zoneClass={(b) => (b === zone ? "bg-zone-active ring-2 ring-brand" : "bg-zone hover:bg-zone-hover")}
                renderSeat={(seat) => {
                  if (!seat) return <span className="block h-10 w-11" />;
                  const i = indexOf.get(seat.key)!;
                  const p = result.items[i] >= 0 ? people[result.items[i]] : null;
                  const bad = result.conflictSeats.has(i);
                  return (
                    <span
                      title={p ? `Máy ${seat.number}: ${p.name} (${p.code}), ${units[p.unitId].name}` : `Máy ${seat.number}: trống`}
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
            )}
            <p className="mt-3 text-center text-caption text-faint">Bấm vào một khoang để xem đủ họ tên</p>
          </div>
          <aside aria-label="Chi tiết khoang" className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-card bg-subtle">
            <div className="flex items-baseline justify-between border-b border-line px-4 py-3.5">
              <span className="font-semibold">Khoang {zone + 1}</span>
              <span className="text-caption text-muted">
                {zoneItems.filter((x) => x.p).length} người / {zoneItems.length} máy
              </span>
            </div>
            <ol className="max-h-130 flex-1 overflow-auto px-2">
              {zoneItems.map(({ s, p }) => (
                <li key={s.key} className="flex items-center gap-2.5 border-b border-line/60 px-2 py-2">
                  <span className="w-9 shrink-0 text-sm font-semibold text-muted tabular-nums">{s.number}</span>
                  <span className={`size-2.5 shrink-0 rounded-sm ${p ? "" : "bg-zone"}`} style={p ? { background: unitColor(p.unitId) } : undefined} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-semibold">{p?.name ?? "Trống"}</span>
                    <span className="truncate text-xs text-muted">{p ? units[p.unitId].name : "Để trống"}</span>
                  </span>
                  <span className="font-mono text-xs text-muted">{p?.code}</span>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      </Card>
      <div className="flex items-center justify-between">
        <Button size="lg" onClick={onBack}>Quay lại</Button>
        <div className="flex gap-3">
          <Button size="lg" disabled={!result || running} onClick={copyLink}>
            {copied ? <><CheckIcon /> Đã sao chép</> : "Sao chép link tra cứu"}
          </Button>
          <Button
            variant="primary"
            size="lg"
            disabled={!result || running}
            onClick={async () => result && downloadBlob(await resultXlsx(room, seats, result.items, people), `xep-cho-${room.name}.xlsx`)}
          >
            <DownloadIcon /> Tải Excel
          </Button>
        </div>
      </div>
    </>
  );
}
