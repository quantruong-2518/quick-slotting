"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Logo } from "./ui/card";
import { SeatZones } from "./seat-zones";
import { buildSeats, seatPosition } from "@/lib/room";
import { normalizeCode } from "@/lib/people";
import { parseRoomId } from "@/lib/room-share";
import type { RoomConfig } from "@/lib/types";

const NOT_FOUND = "Không tìm thấy phòng thi (mã sai hoặc đã hết hạn).";

interface Found {
  title: string;
  /** Tổng số ca của kỳ thi; 1 thì không cần ghi "Ca …". */
  sessions: number;
  room: Omit<RoomConfig, "id">;
  person: { code: string; session: number; seat: number; name: string; unit: string; field: string };
}
type Meta = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; title: string };

export default function Lookup({ roomId }: { roomId: string | null }) {
  const [meta, setMeta] = useState<Meta>(roomId ? { state: "loading" } : { state: "ready", title: "" });
  const [roomInput, setRoomInput] = useState("");
  const [code, setCode] = useState("");
  const [found, setFound] = useState<Found | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
    if (!roomId) return;
    let alive = true;
    fetch(`/api/phong/${encodeURIComponent(roomId)}`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!alive) return;
        setMeta(r.ok ? { state: "ready", title: d.title } : { state: "error", message: d.error ?? NOT_FOUND });
      })
      .catch(() => alive && setMeta({ state: "error", message: "Không kết nối được mạng. Kiểm tra lại rồi thử lại." }));
    return () => { alive = false; };
  }, [roomId]);

  const seats = useMemo(() => (found ? buildSeats({ id: "share", ...found.room }) : []), [found]);
  const seat = found ? seats.find((s) => s.number === found.person.seat) ?? null : null;
  const pos = seat ? seatPosition(seat) : null;
  const showPlace = !!found && (found.sessions > 1 || found.title !== found.room.name);
  const typedCode = normalizeCode(code);

  async function find() {
    const id = roomId ?? parseRoomId(roomInput);
    if (!id) return setError("Mã phòng gồm 6 ký tự, ví dụ K7M2QX. Kiểm tra lại mã trên giấy hoặc mã QR.");
    if (!typedCode) return setError("Hãy nhập Mã CC của bạn.");
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/phong/${encodeURIComponent(id)}?ma=${encodeURIComponent(typedCode)}`, { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { setFound(d); setShowMap(false); }
      else setError(d.error ?? "Có lỗi xảy ra, hãy thử lại sau.");
    } catch {
      setError("Không kết nối được mạng. Kiểm tra lại rồi thử lại.");
    } finally {
      setBusy(false);
    }
  }

  if (meta.state !== "ready") {
    return (
      <Shell>
        <main className="flex flex-1 flex-col gap-3 px-6 py-10">
          {meta.state === "loading" ? (
            <p className="text-muted">Đang mở phòng thi…</p>
          ) : (
            <>
              <h1 className="text-2xl font-bold">Không mở được phòng thi</h1>
              <p className="text-muted">{meta.message}</p>
              <Link href="/tra-cuu" className="mt-2 inline-flex h-12 items-center self-start rounded-control bg-control px-5 font-semibold">
                Nhập mã phòng khác
              </Link>
            </>
          )}
        </main>
      </Shell>
    );
  }

  if (!found || !seat || !pos) {
    const title = meta.title;
    return (
      <Shell>
        <section className="flex flex-col gap-7 bg-brand px-6 pt-6 pb-9 text-white">
          <Brand title={title} />
          <div className="flex flex-col gap-2">
            <h1 className="text-[34px] leading-10 font-bold tracking-tight">Tìm chỗ ngồi</h1>
            <p className="text-white/90">
              {roomId ? "Nhập Mã CC để biết khoang, hàng và ghế của bạn." : "Nhập mã phòng và Mã CC để biết khoang, hàng và ghế của bạn."}
            </p>
          </div>
        </section>
        <form
          className="flex flex-1 flex-col"
          onSubmit={(e) => { e.preventDefault(); if (!busy) void find(); }}
        >
          <div className="flex flex-1 flex-col gap-2.5 px-6 py-8">
            {!roomId && (
              <>
                <label htmlFor="phong" className="text-body font-semibold">Mã phòng</label>
                <input
                  id="phong"
                  autoComplete="off"
                  autoCapitalize="characters"
                  placeholder="K7M2QX"
                  maxLength={12}
                  value={roomInput}
                  onChange={(e) => { setRoomInput(e.target.value); setError(null); }}
                  className="h-16 rounded-control bg-page px-4 font-mono text-2xl tracking-wider outline-none ring-2 ring-line-strong focus:ring-brand"
                />
                <p className="mb-4 text-sm text-faint">Mã phòng gồm 6 ký tự, có trên giấy hoặc mã QR.</p>
              </>
            )}
            <label htmlFor="ma" className="text-body font-semibold">Mã CC</label>
            <input
              id="ma"
              autoComplete="off"
              autoCapitalize="characters"
              placeholder="CC1038"
              value={code}
              onChange={(e) => { setCode(e.target.value); setError(null); }}
              className={`h-16 rounded-control bg-page px-4 font-mono text-2xl tracking-wider outline-none ring-2 ${error ? "ring-danger" : "ring-line-strong focus:ring-brand"}`}
            />
            {error && <p role="alert" className="text-body text-danger">{error}</p>}
            <p className="text-sm text-faint">Mã CC có trên giấy báo dự thi.</p>
          </div>
          <button type="submit" disabled={busy} className="h-17 shrink-0 bg-brand pb-safe text-lg font-semibold text-white disabled:opacity-60">
            {busy ? "Đang tìm…" : "Xem chỗ ngồi"}
          </button>
        </form>
      </Shell>
    );
  }

  return (
    <Shell>
      <section className="flex flex-col gap-3.5 bg-brand px-6 pt-3 pb-6 text-white">
        <button type="button" onClick={() => { setFound(null); setCode(""); }} className="-ml-1.5 inline-flex h-11 items-center gap-1.5 self-start px-1.5 text-body font-medium">
          <svg viewBox="0 0 18 18" fill="none" aria-hidden="true" className="size-4.5">
            <path d="M11 3.5L5.5 9l5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Tra mã khác
        </button>
        <div className="flex items-end justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <span className="text-title leading-7 font-semibold">{found.person.name}</span>
            <span className="text-sm text-white/90">{found.person.code}</span>
            <span className="text-sm text-white/90">{found.person.unit}</span>
            {found.person.field && <span className="text-sm text-white/90">Lĩnh vực: {found.person.field}</span>}
          </div>
          <div className="flex shrink-0 flex-col items-end">
            <span className="text-sm text-white/90">Máy số</span>
            <span className="text-[88px] leading-21 font-bold tracking-tighter tabular-nums">{seat.number}</span>
          </div>
        </div>
      </section>
      {showPlace && (
        <div className="flex flex-wrap items-baseline justify-center gap-x-3 border-b border-line bg-brand-soft px-6 py-3.5 text-2xl font-bold text-brand-ink">
          {found.sessions > 1 && (
            <>
              <span>Ca {found.person.session}</span>
              <span aria-hidden="true" className="opacity-50">·</span>
            </>
          )}
          <span>{found.room.name}</span>
        </div>
      )}
      <div className="grid grid-cols-3 divide-x divide-line border-b border-line">
        {[["Khoang", pos.block], ["Hàng", pos.row], ["Ghế", pos.chair]].map(([label, v]) => (
          <div key={label} className="flex flex-col items-center py-4">
            <span className="text-sm text-muted">{label}</span>
            <span className="text-[44px] leading-12.5 font-bold tabular-nums">{v}</span>
          </div>
        ))}
      </div>
      <p className="bg-page px-6 py-4 leading-6">
        Vào {showPlace ? found.room.name : "phòng"}, đi tới khoang thứ {pos.block} (tính từ trái), đếm tới hàng {pos.row}, ngồi ghế thứ {pos.chair} từ trái sang.
      </p>
      <div className="flex flex-1 flex-col items-center justify-center py-4">
        {showMap ? (
          <div className="flex flex-col items-center gap-2.5 px-3">
            <SeatZones
              room={{ id: "share", ...found.room }}
              seats={seats}
              gap="gap-0.75"
              zoneGap="gap-2"
              zoneClass={(b) => (b === seat.block ? "!p-1 bg-brand-soft ring-2 ring-brand" : "!p-1 bg-page")}
              renderSeat={(s) => (
                <span
                  className={`block size-4.75 rounded-chip ${
                    !s ? "" : s.key === seat.key ? "bg-brand ring-3 ring-brand/30" : "bg-seat-off"
                  }`}
                />
              )}
            />
            <span className="inline-flex items-center gap-2 text-sm text-muted">
              <span className="size-3.5 rounded-chip bg-brand" /> Chỗ của bạn
            </span>
          </div>
        ) : (
          <span className="text-sm text-faint">Bấm nút bên dưới để xem vị trí trên sơ đồ.</span>
        )}
      </div>
      <button
        type="button"
        onClick={() => setShowMap((v) => !v)}
        className={`h-17 shrink-0 pb-safe text-lg font-semibold ${showMap ? "bg-control text-ink" : "bg-brand text-white"}`}
      >
        {showMap ? "Ẩn sơ đồ" : "Xem trên sơ đồ phòng"}
      </button>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-white md:shadow-card">{children}</div>;
}

function Brand({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <Logo className="size-6 shrink-0" />
      <span className="shrink-0 text-body font-semibold">Xếp chỗ nhanh</span>
      <span className="ml-auto min-w-0 truncate text-sm text-white/85">{title}</span>
    </div>
  );
}
