"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CheckIcon, DownloadIcon, Notice, Pill } from "./ui/card";
import { analyzeRows, parseDelimited, type Analysis, type RawRow } from "@/lib/people";
import { downloadBlob, readXlsx, templateXlsx } from "@/lib/excel";
import { unitColor } from "@/lib/colors";
import { MAX_SESSIONS, minSessions } from "@/lib/sessions";

export interface ListState { analysis: Analysis; source: string }

const HEADER: RawRow = { line: 0, cells: ["Họ tên", "Mã CC", "Đơn vị", "Lĩnh vực dự kiểm tra"] };

export function ListStep({
  list, setList, capacity, roomCount, canNext, onBack, onNext,
}: {
  list: ListState | null;
  setList: (l: ListState | null) => void;
  /** Tổng số chỗ xếp người của mọi phòng trong một ca (đã trừ máy dự phòng). */
  capacity: number;
  roomCount: number;
  canNext: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [paste, setPaste] = useState("");
  const [tab, setTab] = useState<"list" | "unit">("list");

  async function readFile(file: File) {
    setError("");
    try {
      const name = file.name.toLowerCase();
      if (name.endsWith(".xlsx")) {
        setList({ analysis: analyzeRows(await readXlsx(file)), source: file.name });
      } else if (/\.(csv|tsv|txt)$/.test(name)) {
        setList({ analysis: analyzeRows(parseDelimited(await file.text())), source: file.name });
      } else {
        setError("Chỉ nhận file .xlsx hoặc .csv. File .xls cũ hãy mở bằng Excel rồi lưu lại thành .xlsx.");
      }
    } catch {
      setError("Không đọc được file này. Hãy mở bằng Excel, lưu lại rồi thử lần nữa.");
    }
  }

  function readPaste() {
    if (!paste.trim()) return;
    setList({ analysis: analyzeRows(parseDelimited(paste)), source: "Dán từ Excel" });
    setPasteOpen(false);
  }

  function dropBadRows() {
    if (!list) return;
    const good = list.analysis.entries.filter((e) => !e.problem).map((e) => ({ line: e.line, cells: [e.name, e.code, e.unit, e.field] }));
    setList({ ...list, analysis: analyzeRows([HEADER, ...good]) });
  }

  const a = list?.analysis;
  const problems = a ? a.missing.length + a.duplicates.length : 0;
  const sessions = a ? minSessions(a.people.length, [capacity]) : 1;
  const empty = !!a && a.people.length === 0 && problems === 0;
  const noField = a?.hasField ? a.people.filter((p) => !p.field) : [];
  const where = roomCount > 1 ? `${roomCount} phòng có tổng ${capacity} chỗ` : `phòng có ${capacity} chỗ`;

  return (
    <>
      <div className="flex flex-1 gap-4">
        <Card className="flex w-75 shrink-0 flex-col gap-4" aria-label="File danh sách">
          <h2 className="text-lg font-semibold">File danh sách</h2>
          <label
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) readFile(f);
            }}
            className={`flex cursor-pointer flex-col items-center gap-2 rounded-card border-2 border-dashed px-4 py-6 text-center transition-colors ${
              dragging ? "border-brand bg-brand-soft" : "border-brand-line bg-brand-wash"
            }`}
          >
            <svg viewBox="0 0 36 36" fill="none" aria-hidden="true" className="size-9 text-brand">
              <path d="M18 24V8M11 15l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M6 24v4a2 2 0 002 2h20a2 2 0 002-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span className="text-body font-semibold">Kéo thả file vào đây</span>
            <span className="text-caption text-muted">hoặc</span>
            <span className="inline-flex h-10 items-center rounded-control bg-brand px-4 text-body font-semibold text-white">Chọn file từ máy</span>
            <span className="text-caption text-faint">.xlsx hoặc .csv</span>
            <input
              type="file"
              accept=".xlsx,.csv,.tsv,.txt"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) readFile(f);
              }}
            />
          </label>
          <button type="button" onClick={() => setPasteOpen((v) => !v)} className="self-start text-sm font-semibold text-brand-ink hover:underline">
            {pasteOpen ? "Đóng ô dán" : "Hoặc dán thẳng từ Excel"}
          </button>
          {pasteOpen && (
            <div className="flex flex-col gap-2">
              <textarea
                aria-label="Dán danh sách từ Excel"
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                rows={5}
                placeholder={"Nguyễn Văn A\tCC0001\tSở Nội vụ\tKế toán"}
                className="field p-3 text-sm"
              />
              <Button onClick={readPaste}>Đọc danh sách</Button>
            </div>
          )}
          {error && <Notice tone="danger">{error}</Notice>}
          {list && (
            <div className="flex items-center gap-3 rounded-card bg-subtle px-3.5 py-3">
              <svg viewBox="0 0 36 36" fill="none" aria-hidden="true" className="size-8 shrink-0">
                <rect x="6" y="3" width="24" height="30" rx="3" className="fill-ok-bg" />
                <path d="M12 13h12M12 18h12M12 23h7" className="stroke-ok" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
              <div className="min-w-0">
                <p className="truncate text-body font-semibold">{list.source}</p>
                <p className="text-caption text-ok">Đã đọc {list.analysis.entries.length} dòng</p>
              </div>
            </div>
          )}
          <hr className="border-line" />
          <p className="text-sm leading-relaxed text-muted">
            Chưa có file? Tải file mẫu 4 cột <b className="font-semibold text-ink">Họ tên, Mã CC, Đơn vị, Lĩnh vực dự kiểm tra</b>, điền rồi tải lên.
          </p>
          <Button onClick={async () => downloadBlob(await templateXlsx(), "mau-danh-sach.xlsx")}>
            <DownloadIcon /> Tải file mẫu (.xlsx)
          </Button>
          <p className="mt-auto text-caption text-faint">Dữ liệu chỉ xử lý trên máy của bạn.</p>
        </Card>

        <Card className="flex min-w-0 flex-1 flex-col gap-4" aria-label="Kiểm tra danh sách">
          {!a ? (
            <div className="grid flex-1 place-items-center px-12 text-center text-muted">Chọn hoặc kéo thả file danh sách để bắt đầu kiểm tra.</div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="mr-2 text-lg font-semibold">Kiểm tra DS</h2>
                <Pill><b className="font-semibold">{a.people.length}</b> người</Pill>
                <Pill><b className="font-semibold">{a.units.length}</b> đơn vị</Pill>
                {problems === 0 && !empty && <Pill tone="ok"><CheckIcon className="size-3.5" /> Không lỗi, không trùng mã</Pill>}
              </div>
              <p className="text-xs text-faint">{a.columnNote}</p>
              {empty && (
                <Notice tone="warn">File chưa có ai. Điền danh sách vào file mẫu rồi tải lên lại.</Notice>
              )}
              {problems > 0 && (
                <Notice tone="danger" className="flex items-start justify-between gap-4">
                  <ul className="list-disc pl-5">
                    {a.missing.slice(0, 4).map((m) => (
                      <li key={`m${m.entry.line}`}>Dòng {m.entry.line}: thiếu {m.fields.join(", ")}</li>
                    ))}
                    {a.duplicates.slice(0, 4).map((d) => (
                      <li key={`d${d.entry.line}`}>Mã {d.entry.code} trùng ở dòng {d.first.line} và {d.entry.line}</li>
                    ))}
                    {problems > 8 && <li>và {problems - 8} dòng khác</li>}
                  </ul>
                  <Button className="shrink-0 bg-white" onClick={dropBadRows}>Bỏ {problems} dòng lỗi</Button>
                </Notice>
              )}
              {a.merged.length > 0 && (
                <Notice tone="warn">
                  Đã gộp {a.merged.map((u) => u.variants.map((v) => `"${v}"`).join(" và ")).join("; ")} thành 1 đơn vị.
                </Notice>
              )}
              {noField.length > 0 && (
                <Notice tone="warn">
                  {noField.length} người chưa có lĩnh vực dự kiểm tra (dòng {noField.slice(0, 6).map((p) => p.line).join(", ")}
                  {noField.length > 6 ? "…" : ""}). Vẫn xếp được, chỉ là chỗ lĩnh vực sẽ để trống.
                </Notice>
              )}
              {capacity === 0 ? (
                <Notice tone="danger">Các phòng không còn chỗ nào sau khi trừ máy dự phòng. Quay lại bước 1 để sửa.</Notice>
              ) : sessions > MAX_SESSIONS ? (
                <Notice tone="danger">
                  Có {a.people.length} người, {where} mỗi ca, phải chia tới {sessions} ca. Quay lại bước 1 để thêm phòng hoặc thêm máy.
                </Notice>
              ) : (
                sessions > 1 && (
                  <Notice tone="info">
                    Có {a.people.length} người, {where} mỗi ca (đã trừ máy dự phòng), nên sẽ chia thành{" "}
                    <b className="font-semibold">{sessions} ca</b>. Mỗi ĐV được rải đều qua các ca và các phòng.
                  </Notice>
                )
              )}
              <div role="tablist" aria-label="Cách xem" className="flex gap-6 border-b border-line">
                {([["list", "Danh sách", a.people.length], ["unit", "Theo đơn vị", a.units.length]] as const).map(([k, label, n]) => (
                  <button
                    key={k}
                    role="tab"
                    type="button"
                    aria-selected={tab === k}
                    onClick={() => setTab(k)}
                    className={`-mb-px h-11 border-b-2 text-body ${tab === k ? "border-brand font-semibold" : "border-transparent font-medium text-muted"}`}
                  >
                    {label} <span className="font-medium text-faint">{n}</span>
                  </button>
                ))}
              </div>
              <div className="max-h-105 overflow-auto">
                {tab === "list" ? (
                  <table className="w-full border-collapse text-body">
                    <thead className="sticky top-0 bg-subtle text-left text-caption text-muted">
                      <tr className="h-9">
                        <th className="w-14 px-3 font-medium">STT</th>
                        <th className="px-3 font-medium">Họ tên</th>
                        <th className="w-32 px-3 font-medium">Mã CC</th>
                        <th className="px-3 font-medium">Đơn vị</th>
                        {a.hasField && <th className="px-3 font-medium">Lĩnh vực</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {a.people.map((p, i) => (
                        <tr key={p.code} className="h-10 border-b border-line">
                          <td className="px-3 text-faint tabular-nums">{i + 1}</td>
                          <td className="px-3 font-medium">{p.name}</td>
                          <td className="px-3 font-mono text-caption">{p.code}</td>
                          <td className="px-3">
                            <span className="inline-flex items-center gap-2">
                              <span className="size-2.5 rounded-sm" style={{ background: unitColor(p.unitId) }} />
                              {a.units[p.unitId].name}
                            </span>
                          </td>
                          {a.hasField && <td className="px-3">{p.field || <span className="text-faint">Chưa có</span>}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <ul className="grid grid-cols-2 gap-x-8">
                    {a.units.map((u) => (
                      <li key={u.id} className="flex h-11 items-center gap-3 border-b border-line text-body">
                        <span className="size-3 shrink-0 rounded-chip" style={{ background: unitColor(u.id) }} />
                        <span className="min-w-0 flex-1 truncate">{u.name}</span>
                        <span className="h-1.5 w-24 shrink-0 overflow-hidden rounded bg-control">
                          <span className="block h-full rounded bg-brand/50" style={{ width: `${(u.count / a.units[0].count) * 100}%` }} />
                        </span>
                        <span className="w-16 text-right font-semibold tabular-nums">{u.count} người</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </Card>
      </div>
      <div className="flex justify-between">
        <Button size="lg" onClick={onBack}>Quay lại</Button>
        <Button variant="primary" size="lg" disabled={!canNext} onClick={onNext}>Tiếp tục</Button>
      </div>
    </>
  );
}
