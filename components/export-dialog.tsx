"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";
import { DownloadIcon, Notice } from "./ui/card";
import { Segmented } from "./ui/segmented";
import { excelFiles, type ExcelFile, type ExcelSplit } from "@/lib/excel";

/** Hộp tải Excel khi có nhiều ca hoặc nhiều phòng: chia file theo ca, theo phòng hay gộp; lấy hết hoặc chỉ một ca, một phòng. */
export function ExportDialog({
  roomNames, sessions, onDownload, onClose,
}: {
  roomNames: string[];
  sessions: number;
  onDownload: (files: ExcelFile[]) => Promise<void>;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [split, setSplit] = useState<ExcelSplit>(sessions > 1 ? "session" : "one");
  const [session, setSession] = useState<number | null>(null);
  const [room, setRoom] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const files = excelFiles(roomNames, sessions, { session, room, split });
  const first = files[0];
  const pages = first.sessions.length * first.rooms.length;
  // Mỗi trang sơ đồ trong file là gì: một phòng (file của một ca) hay một ca (file của một phòng).
  const per = pages === 1 ? "" : first.sessions.length === 1 ? " (mỗi phòng một trang)" : first.rooms.length === 1 ? " (mỗi ca một trang)" : " (mỗi ca, mỗi phòng một trang)";
  const select = "h-11 min-w-0 flex-1 rounded-control bg-control px-3 text-body";
  const pick = (v: string) => (v === "" ? null : Number(v));

  async function submit() {
    setBusy(true);
    setError(false);
    try {
      await onDownload(files);
      ref.current?.close();
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label="Tải Excel"
      className="m-auto w-full max-w-lg rounded-card bg-white p-0 text-ink shadow-card backdrop:bg-ink/40"
    >
      <form className="flex flex-col gap-4 p-7" onSubmit={(e) => { e.preventDefault(); if (!busy) void submit(); }}>
        <h2 className="text-lg font-semibold">Tải Excel</h2>

        <div className="flex flex-col gap-2.5">
          <div className="flex flex-col gap-1.5">
            <span className="text-body font-medium">Chia file</span>
            <Segmented
              label="Chia file"
              value={split}
              onChange={setSplit}
              options={[
                ...(sessions > 1 ? [{ value: "session" as const, label: "Mỗi ca một file", hint: "Mỗi ca một file, trong file mỗi phòng một trang" }] : []),
                ...(roomNames.length > 1 ? [{ value: "room" as const, label: "Mỗi phòng một file", hint: "Mỗi phòng một file, trong file mỗi ca một trang" }] : []),
                { value: "one" as const, label: "Một file", hint: "Tất cả nằm trong một file" },
              ]}
            />
          </div>
          {sessions > 1 && (
            <div className="flex items-center gap-3">
              <label htmlFor="export-ca" className="w-20 shrink-0 text-body font-medium">Ca</label>
              <select id="export-ca" value={session ?? ""} onChange={(e) => setSession(pick(e.target.value))} className={select}>
                <option value="">Tất cả {sessions} ca</option>
                {Array.from({ length: sessions }, (_, s) => <option key={s} value={s}>Chỉ ca {s + 1}</option>)}
              </select>
            </div>
          )}
          {roomNames.length > 1 && (
            <div className="flex items-center gap-3">
              <label htmlFor="export-phong" className="w-20 shrink-0 text-body font-medium">Phòng</label>
              <select id="export-phong" value={room ?? ""} onChange={(e) => setRoom(pick(e.target.value))} className={select}>
                <option value="">Tất cả {roomNames.length} phòng</option>
                {roomNames.map((name, r) => <option key={r} value={r}>Chỉ {name}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1 rounded-control bg-subtle px-4 py-3 text-sm">
          <p>
            <b className="font-semibold">{files.length} file</b>
            {files.length > 1 ? ", mỗi file " : ": "}
            {pages} trang sơ đồ{per} và trang Danh sách.
          </p>
          <p className="text-caption text-muted">
            {files.slice(0, 3).map((f) => f.name).join(", ")}
            {files.length > 3 ? ` và ${files.length - 3} file nữa` : ""}
          </p>
        </div>
        {files.length > 1 && (
          <p className="text-caption text-faint">Nếu trình duyệt hỏi có cho tải nhiều file không, hãy bấm Cho phép (Allow).</p>
        )}
        {error && <Notice tone="danger">Không tạo được file Excel. Hãy thử lại.</Notice>}

        <div className="flex justify-end gap-3">
          <Button onClick={() => ref.current?.close()}>Huỷ</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            <DownloadIcon /> {busy ? "Đang tạo file…" : files.length > 1 ? `Tải ${files.length} file` : "Tải file"}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
