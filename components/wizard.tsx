"use client";

import { useMemo, useRef, useState } from "react";
import { AppHeader, type Step } from "./app-header";
import { RoomStep, type Draft } from "./room-step";
import { ListStep, type ListState } from "./list-step";
import { ResultStep, type ResultState } from "./result-step";
import { buildSeats } from "@/lib/room";
import type { Adjacency, RoomConfig, SpareMode } from "@/lib/types";
import type { ArrangeRequest } from "@/lib/arrange.worker";

export default function Wizard() {
  const [step, setStep] = useState<Step>(1);
  const [draft, setDraft] = useState<Draft>({ blocks: null, rows: null, cols: null, style: "snake", start: 1 });
  const [room, setRoomState] = useState<RoomConfig | null>(null);
  const [list, setListState] = useState<ListState | null>(null);
  const [adj, setAdj] = useState<Adjacency>("lr");
  const [spare, setSpare] = useState<SpareMode>("tail");
  const [result, setResult] = useState<ResultState | null>(null);
  const [running, setRunning] = useState(false);
  const workerRef = useRef<Worker | null>(null);

  const seats = useMemo(() => (room ? buildSeats(room) : []), [room]);
  const people = list?.analysis.people ?? [];
  const listOk = !!list && people.length > 0 && !list.analysis.missing.length && !list.analysis.duplicates.length;

  // Mọi thay đổi đầu vào đều làm kết quả cũ hết hiệu lực.
  const setRoom = (r: RoomConfig | null) => { setRoomState(r); setResult(null); };
  const setList = (l: ListState | null) => { setListState(l); setResult(null); };

  const canGo = (s: Step) => s === 1 || (s === 2 && !!room) || (s === 3 && !!room && listOk && people.length <= seats.length);

  function run(nextAdj = adj, nextSpare = spare) {
    if (!room || !list) return;
    workerRef.current?.terminate();
    const worker = new Worker(new URL("../lib/arrange.worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    setRunning(true);
    worker.onmessage = (e) => {
      const d = e.data;
      setResult({
        items: d.items,
        conflictPairs: d.conflictPairs,
        conflictSeats: new Set(d.conflictSeats),
        capacityIssues: d.capacityIssues,
      });
      setRunning(false);
      worker.terminate();
    };
    worker.onerror = () => { setRunning(false); worker.terminate(); };
    const req: ArrangeRequest = { room, unitOfPerson: list.analysis.people.map((p) => p.unitId), adj: nextAdj, spare: nextSpare };
    worker.postMessage(req);
  }

  function go(s: Step) {
    if (!canGo(s)) return;
    setStep(s);
    if (s === 3 && !result && !running) run();
    window.scrollTo({ top: 0 });
  }

  const statuses: [string, string, string] = [
    room ? `${seats.length} máy` : "Chưa có",
    listOk ? `${people.length} người` : list ? "Cần sửa" : "Chưa có",
    running ? "Đang xếp…" : result ? (result.conflictPairs ? "Còn chỗ trùng" : "Đã xếp") : "Chưa xếp",
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader step={step} statuses={statuses} canGo={canGo} onGo={go} />
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-10 pt-8 pb-10">
        {step === 1 && (
          <RoomStep draft={draft} setDraft={setDraft} room={room} setRoom={setRoom} seats={seats} onNext={() => go(2)} />
        )}
        {step === 2 && (
          <ListStep list={list} setList={setList} seatCount={seats.length} canNext={canGo(3)} onBack={() => go(1)} onNext={() => go(3)} />
        )}
        {step === 3 && room && list && (
          <ResultStep
            room={room}
            seats={seats}
            people={people}
            units={list.analysis.units}
            result={result}
            running={running}
            adj={adj}
            spare={spare}
            onAdj={(a) => { setAdj(a); run(a, spare); }}
            onSpare={(s) => { setSpare(s); run(adj, s); }}
            onRerun={() => run()}
            onBack={() => go(2)}
          />
        )}
      </main>
    </div>
  );
}
