"use client";

import { useMemo, useRef, useState } from "react";
import { AppHeader, type Step } from "./app-header";
import { RoomStep, newEntry, type RoomEntry } from "./room-step";
import { ListStep, type ListState } from "./list-step";
import { ResultStep, type Plan } from "./result-step";
import { buildNeighbors, buildSeats, sameExceptName } from "@/lib/room";
import { evaluate } from "@/lib/seating";
import { MAX_SESSIONS, capacityOf, distribute, distributeByField, fieldRanks, minSessions, planCounts, swapSeats } from "@/lib/sessions";
import type { Adjacency, FillMode, SeatRef, SpareMode } from "@/lib/types";
import type { ArrangeMessage, ArrangeRequest } from "@/lib/arrange.worker";

export default function Wizard() {
  const [step, setStep] = useState<Step>(1);
  const [entries, setEntries] = useState<RoomEntry[]>(() => [newEntry()]);
  const [active, setActive] = useState(0);
  const [list, setListState] = useState<ListState | null>(null);
  const [adj, setAdj] = useState<Adjacency>("lr");
  const [spare, setSpare] = useState<SpareMode>("tail");
  const [fill, setFill] = useState<FillMode>("even");
  /** Số ca người dùng chọn; null = ít nhất có thể. */
  const [sessionsPick, setSessionsPick] = useState<number | null>(null);
  const [result, setResult] = useState<Plan | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const running = progress !== null;

  const rooms = useMemo(() => entries.flatMap((e) => (e.room ? [e.room] : [])), [entries]);
  const seatsOf = useMemo(() => rooms.map((r) => buildSeats(r)), [rooms]);
  const nbOf = useMemo(() => rooms.map((r, k) => buildNeighbors(r, seatsOf[k], adj)), [rooms, seatsOf, adj]);
  const capacities = rooms.map((r, k) => capacityOf(seatsOf[k].length, r.reserve));
  const people = useMemo(() => list?.analysis.people ?? [], [list]);
  const unitOf = useMemo(() => people.map((p) => p.unitId), [people]);
  const listOk = !!list && people.length > 0 && !list.analysis.missing.length && !list.analysis.duplicates.length;
  const minS = minSessions(people.length, capacities);
  const hasField = !!list?.analysis.hasField && people.some((p) => p.field);
  const byField = fill === "field" && hasField;
  // Xếp theo lĩnh vực thì dồn đầy từng phòng nên chỉ dùng đúng số ca ít nhất.
  const sessions = byField ? minS : Math.max(minS, sessionsPick ?? 0);
  const canArrange = rooms.length > 0 && listOk && minS <= MAX_SESSIONS;

  // Mọi thay đổi đầu vào đều làm kết quả cũ hết hiệu lực.
  function reset() {
    workerRef.current?.terminate();
    setProgress(null);
    setResult(null);
    setSessionsPick(null);
  }
  const setList = (l: ListState | null) => { setListState(l); reset(); };
  function updateEntry(patch: Partial<Omit<RoomEntry, "key">>) {
    const old = entries[active].room;
    setEntries((es) => es.map((e, i) => (i === active ? { ...e, ...patch } : e)));
    // Chỉ đổi tên phòng thì kết quả đã xếp vẫn dùng được.
    if ("room" in patch && !(old && patch.room && sameExceptName(old, patch.room))) reset();
  }
  function renameRoom(r: number, name: string) {
    const id = rooms[r].id;
    setEntries((es) => es.map((e) => (e.room?.id === id ? { ...e, room: { ...e.room, name } } : e)));
  }
  function addEntry() {
    setEntries((es) => [...es, newEntry()]);
    setActive(entries.length);
  }
  function removeEntry(i: number) {
    const hadRoom = !!entries[i].room;
    setEntries((es) => es.filter((_, k) => k !== i));
    setActive((a) => (a > i ? a - 1 : Math.min(a, entries.length - 2)));
    if (hadRoom) reset();
  }

  const canGo = (s: Step) => s === 1 || (s === 2 && rooms.length > 0) || (s === 3 && canArrange);

  /** keep: giữ nguyên ai ở ca nào, phòng nào (kể cả người đã chuyển tay), chỉ xếp lại ghế trong từng phòng. */
  function run({ nextAdj = adj, nextSpare = spare, nextSessions = sessions, nextByField = byField, keep = true } = {}) {
    if (!canArrange) return;
    workerRef.current?.terminate();
    const groups =
      keep && result && result.slots.length === nextSessions
        ? result.slots.map((row) => row.map((x) => x.items.filter((p) => p >= 0)))
        : nextByField
          ? distributeByField(fieldRanks(people.map((p) => p.field)), capacities, nextSessions)
          : distribute(unitOf, planCounts(people.length, capacities, nextSessions));
    const worker = new Worker(new URL("../lib/arrange.worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    setProgress({ done: 0, total: groups.length * rooms.length });
    worker.onmessage = (e: MessageEvent<ArrangeMessage>) => {
      const d = e.data;
      if (d.type === "progress") return setProgress({ done: d.done, total: d.total });
      setResult({
        slots: d.slots.map((row) => row.map((x) => ({ ...x, conflictSeats: new Set(x.conflictSeats) }))),
        edited: false,
      });
      setProgress(null);
      worker.terminate();
    };
    worker.onerror = () => { setProgress(null); worker.terminate(); };
    const req: ArrangeRequest = { rooms, unitOf, groups, adj: nextAdj, spare: nextSpare };
    worker.postMessage(req);
  }

  /** Hỏi trước khi bỏ các chỗ đã đổi tay. */
  const keepEdits = (message: string) => !!result?.edited && !confirm(message);
  const RESEAT = "Xếp lại sẽ đổi chỗ ngồi trong từng phòng, kể cả chỗ bạn đã đổi tay (ai vẫn ở đúng ca, đúng phòng đó). Tiếp tục?";

  function move(a: SeatRef, b: SeatRef) {
    if (!result || running) return;
    const items = swapSeats(result.slots.map((row) => row.map((x) => x.items)), a, b);
    setResult({
      edited: true,
      slots: result.slots.map((row, s) =>
        row.map((slot, r) => (items[s][r] === slot.items ? slot : { ...slot, items: items[s][r], ...evaluate(items[s][r], nbOf[r], unitOf) })),
      ),
    });
  }

  function go(s: Step) {
    if (!canGo(s)) return;
    setStep(s);
    if (s === 3 && !result && !running) run({ keep: false });
    window.scrollTo({ top: 0 });
  }

  const totalSeats = seatsOf.reduce((n, x) => n + x.length, 0);
  const conflicts = result ? result.slots.flat().reduce((n, x) => n + x.conflictPairs, 0) : 0;
  const statuses: [string, string, string] = [
    rooms.length > 1 ? `${rooms.length} phòng · ${totalSeats} máy` : rooms.length ? `${totalSeats} máy` : "Chưa có",
    listOk ? `${people.length} người` : list ? "Cần sửa" : "Chưa có",
    running ? "Đang xếp…" : result ? (conflicts ? "Còn chỗ trùng" : result.slots.length > 1 ? `Đã xếp ${result.slots.length} ca` : "Đã xếp") : "Chưa xếp",
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader step={step} statuses={statuses} canGo={canGo} onGo={go} />
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-10 pt-8 pb-10">
        {step === 1 && (
          <RoomStep
            entries={entries}
            active={active}
            onSelect={setActive}
            onAdd={addEntry}
            onRemove={removeEntry}
            onChange={updateEntry}
            onNext={() => go(2)}
          />
        )}
        {step === 2 && (
          <ListStep
            list={list}
            setList={setList}
            capacity={capacities.reduce((n, c) => n + c, 0)}
            roomCount={rooms.length}
            canNext={canGo(3)}
            onBack={() => go(1)}
            onNext={() => go(3)}
          />
        )}
        {step === 3 && rooms.length > 0 && list && (
          <ResultStep
            rooms={rooms}
            seatsOf={seatsOf}
            nbOf={nbOf}
            people={people}
            units={list.analysis.units}
            result={result}
            progress={progress}
            adj={adj}
            spare={spare}
            sessions={sessions}
            minSessions={minS}
            byField={byField}
            onFill={(f) => {
              if (keepEdits("Đổi cách chia sẽ chia lại người vào các ca và các phòng; những chỗ bạn đã đổi tay sẽ mất. Tiếp tục?")) return;
              setFill(f);
              run({ nextByField: f === "field", nextSessions: f === "field" ? minS : sessions, keep: false });
            }}
            onAdj={(a) => { if (keepEdits(RESEAT)) return; setAdj(a); run({ nextAdj: a }); }}
            onSpare={(s) => { if (keepEdits(RESEAT)) return; setSpare(s); run({ nextSpare: s }); }}
            onSessions={(n) => {
              if (keepEdits("Đổi số ca sẽ chia lại người vào các ca và các phòng; những chỗ bạn đã đổi tay sẽ mất. Tiếp tục?")) return;
              setSessionsPick(n);
              run({ nextSessions: n, keep: false });
            }}
            onRerun={() => { if (!keepEdits(RESEAT)) run(); }}
            onMove={move}
            onRename={renameRoom}
            onBack={() => go(2)}
          />
        )}
      </main>
    </div>
  );
}
