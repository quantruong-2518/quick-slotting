"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";
import { CheckIcon, DownloadIcon, Notice } from "./ui/card";
import { downloadBlob } from "@/lib/excel";

/** Hộp chia sẻ phòng thi: mã phòng, link, mã QR. */
export function ShareDialog({
  roomName, id, outdated, busy, error, onUpdate, onClose,
}: {
  roomName: string;
  id: string;
  outdated: boolean;
  busy: boolean;
  error: string | null;
  onUpdate: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [svg, setSvg] = useState("");
  const [copied, setCopied] = useState(false);
  const [link, setLink] = useState("");

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  useEffect(() => {
    if (!id) return;
    const url = `${location.origin}/tra-cuu/${id}`;
    let alive = true;
    import("uqr").then(({ renderSVG }) => {
      if (!alive) return;
      setLink(url);
      setSvg(renderSVG(url, { border: 2 }));
    });
    return () => { alive = false; };
  }, [id]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* trình duyệt chặn: người dùng vẫn chép tay được từ ô link */
    }
  }

  async function downloadPng() {
    const { encode } = await import("uqr");
    const { data, size } = encode(link);
    const cell = 12;
    const pad = 3 * cell;
    const side = size * cell + pad * 2;
    const canvas = document.createElement("canvas");
    canvas.width = side;
    canvas.height = side + 72;
    const g = canvas.getContext("2d");
    if (!g) return;
    g.fillStyle = "white";
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.fillStyle = "black";
    data.forEach((row, y) => row.forEach((on, x) => on && g.fillRect(pad + x * cell, pad + y * cell, cell, cell)));
    g.textAlign = "center";
    g.font = "bold 44px monospace";
    g.fillText(id, side / 2, side + 30);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
    if (blob) downloadBlob(blob, `ma-qr-${id}.png`);
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label="Chia sẻ phòng thi"
      className="m-auto w-full max-w-md rounded-card bg-white p-0 text-ink shadow-card backdrop:bg-ink/40"
    >
      <div className="flex flex-col gap-4 p-7">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Chia sẻ phòng thi</h2>
          <p className="text-sm text-muted">{roomName}</p>
        </div>

        {outdated && (
          <Notice tone="warn" className="flex items-center justify-between gap-3">
            <span>Bạn đã xếp lại chỗ. Người dự thi vẫn đang thấy bản cũ.</span>
            <Button variant="primary" disabled={busy} onClick={onUpdate}>{busy ? "Đang cập nhật…" : "Cập nhật"}</Button>
          </Notice>
        )}
        {error && <Notice tone="danger">{error}</Notice>}

        {!id ? (
          <>
            {!error && <p className="py-6 text-center text-muted">Đang tạo mã phòng…</p>}
            <div className="flex justify-end gap-3">
              {error && <Button variant="primary" disabled={busy} onClick={onUpdate}>Thử lại</Button>}
              <Button onClick={() => ref.current?.close()}>Đóng</Button>
            </div>
          </>
        ) : (
        <>
        <div className="flex flex-col items-center gap-1 rounded-card bg-subtle py-4">
          <span className="text-sm text-muted">Mã phòng</span>
          <span className="font-mono text-4xl font-bold tracking-widest">{id}</span>
        </div>

        <div
          className="mx-auto size-56 rounded-card bg-white p-1 shadow-card [&>svg]:size-full"
          role="img"
          aria-label={`Mã QR của phòng ${id}`}
          dangerouslySetInnerHTML={{ __html: svg }}
        />

        <input readOnly value={link} aria-label="Link tra cứu" onFocus={(e) => e.currentTarget.select()} className="field h-10 px-3 text-sm" />

        <div className="flex flex-wrap gap-3">
          <Button onClick={copy} disabled={!link}>
            {copied ? <><CheckIcon /> Đã sao chép</> : "Sao chép link"}
          </Button>
          <Button onClick={downloadPng} disabled={!link}><DownloadIcon /> Tải mã QR</Button>
          <span className="flex-1" />
          <Button onClick={() => ref.current?.close()}>Đóng</Button>
        </div>

        <p className="text-sm text-muted">
          Người dự thi quét mã hoặc mở link, nhập Mã CC để xem chỗ ngồi. Link dùng được 30 ngày.
        </p>
        </>
        )}
      </div>
    </dialog>
  );
}
