"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { Logo } from "./ui/card";
import { SeatZones } from "./seat-zones";
import { buildSeats, seatPosition } from "@/lib/room";
import { decodeShare } from "@/lib/share";
import { normalizeCode } from "@/lib/people";

const subscribeHash = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};

export default function Lookup() {
  const hash = useSyncExternalStore(subscribeHash, () => location.hash, () => "");
  const data = useMemo(() => (hash ? decodeShare(hash) : null), [hash]);
  const seats = useMemo(() => (data ? buildSeats({ id: "share", ...data.room }) : []), [data]);

  const [code, setCode] = useState("");
  const [found, setFound] = useState<number | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [showMap, setShowMap] = useState(false);

  if (!hash) return null;
  if (!data) {
    return (
      <Shell>
        <main className="flex flex-1 flex-col gap-3 px-6 py-10">
          <h1 className="text-2xl font-bold">Link không hợp lệ</h1>
          <p className="text-muted">Link tra cứu bị thiếu hoặc hỏng. Hãy xin lại link từ người tổ chức kỳ thi.</p>
        </main>
      </Shell>
    );
  }

  const row = found !== null ? data.rows[found] : null;
  const seat = row ? seats.find((s) => s.number === row[1]) ?? null : null;
  const pos = seat ? seatPosition(seat) : null;

  function find() {
    const c = normalizeCode(code);
    const i = data!.rows.findIndex(([cc]) => normalizeCode(cc) === c || normalizeCode(cc).replace(/^CC/, "") === c.replace(/^CC/, ""));
    if (i >= 0) { setFound(i); setNotFound(false); setShowMap(false); }
    else setNotFound(true);
  }

  if (!row || !seat || !pos) {
    return (
      <Shell>
        <section className="flex flex-col gap-7 bg-brand px-6 pt-6 pb-9 text-white">
          <Brand title={data.title} />
          <div className="flex flex-col gap-2">
            <h1 className="text-[34px] leading-10 font-bold tracking-tight">Tìm chỗ ngồi</h1>
            <p className="text-white/90">Nhập mã công chức để biết khoang, hàng và ghế của bạn.</p>
          </div>
        </section>
        <form
          className="flex flex-1 flex-col"
          onSubmit={(e) => { e.preventDefault(); find(); }}
        >
          <div className="flex flex-1 flex-col gap-2.5 px-6 py-8">
            <label htmlFor="ma" className="text-body font-semibold">Mã công chức</label>
            <input
              id="ma"
              autoComplete="off"
              autoCapitalize="characters"
              placeholder="CC1038"
              value={code}
              onChange={(e) => { setCode(e.target.value); setNotFound(false); }}
              className={`h-16 rounded-control bg-page px-4 font-mono text-2xl tracking-wider outline-none ring-2 ${notFound ? "ring-danger" : "ring-line-strong focus:ring-brand"}`}
            />
            {notFound && <p className="text-body text-danger">Không tìm thấy mã này. Kiểm tra lại hoặc hỏi giám thị.</p>}
            <p className="text-sm text-faint">Mã có trên giấy báo dự thi.</p>
          </div>
          <button type="submit" className="h-17 shrink-0 bg-brand pb-safe text-lg font-semibold text-white">
            Xem chỗ ngồi
          </button>
        </form>
      </Shell>
    );
  }

  return (
    <Shell>
      <section className="flex flex-col gap-3.5 bg-brand px-6 pt-3 pb-6 text-white">
        <button type="button" onClick={() => setFound(null)} className="-ml-1.5 inline-flex h-11 items-center gap-1.5 self-start px-1.5 text-body font-medium">
          <svg viewBox="0 0 18 18" fill="none" aria-hidden="true" className="size-4.5">
            <path d="M11 3.5L5.5 9l5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Tra mã khác
        </button>
        <div className="flex items-end justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <span className="text-title leading-7 font-semibold">{row[2]}</span>
            <span className="text-sm text-white/90">{row[0]}</span>
            <span className="text-sm text-white/90">{row[3]}</span>
          </div>
          <div className="flex shrink-0 flex-col items-end">
            <span className="text-sm text-white/90">Máy số</span>
            <span className="text-[88px] leading-21 font-bold tracking-tighter tabular-nums">{seat.number}</span>
          </div>
        </div>
      </section>
      <div className="grid grid-cols-3 divide-x divide-line border-b border-line">
        {[["Khoang", pos.block], ["Hàng", pos.row], ["Ghế", pos.chair]].map(([label, v]) => (
          <div key={label} className="flex flex-col items-center py-4">
            <span className="text-sm text-muted">{label}</span>
            <span className="text-[44px] leading-12.5 font-bold tabular-nums">{v}</span>
          </div>
        ))}
      </div>
      <p className="bg-page px-6 py-4 leading-6">
        Vào phòng, đi tới khoang thứ {pos.block} (tính từ trái), đếm tới hàng {pos.row}, ngồi ghế thứ {pos.chair} từ trái sang.
      </p>
      <div className="flex flex-1 flex-col items-center justify-center py-4">
        {showMap ? (
          <div className="flex flex-col items-center gap-2.5 px-3">
            <SeatZones
              room={{ id: "share", ...data.room }}
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
      <Logo className="size-6" />
      <span className="text-body font-semibold">Xếp chỗ nhanh</span>
      <span className="ml-auto text-sm text-white/85">{title}</span>
    </div>
  );
}
