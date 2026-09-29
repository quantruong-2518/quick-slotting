import { CheckIcon, Logo } from "./ui/card";

export type Step = 1 | 2 | 3;
const NAMES = ["Sơ đồ phòng", "Danh sách", "Xếp chỗ"];

export function AppHeader({
  step,
  statuses,
  canGo,
  onGo,
}: {
  step: Step;
  statuses: [string, string, string];
  canGo: (s: Step) => boolean;
  onGo: (s: Step) => void;
}) {
  return (
    <header className="bg-brand text-white">
      <div className="mx-auto flex h-21 max-w-7xl items-center gap-14 px-10">
        <div className="flex shrink-0 items-center gap-3">
          <Logo />
          <span className="text-xl font-semibold tracking-tight">Xếp chỗ nhanh</span>
        </div>
        <nav aria-label="Các bước" className="flex-1">
          <ol className="flex items-center">
            {NAMES.map((name, i) => {
              const n = (i + 1) as Step;
              const done = n < step;
              const cur = n === step;
              return (
                <li key={name} className={`flex items-center ${n < 3 ? "flex-1" : ""}`}>
                  <button
                    type="button"
                    disabled={!canGo(n)}
                    aria-current={cur ? "step" : undefined}
                    onClick={() => onGo(n)}
                    className={`flex shrink-0 items-center gap-3 text-left disabled:cursor-not-allowed ${cur ? "" : done ? "opacity-90" : "opacity-75"}`}
                  >
                    <span
                      className={`grid size-8 place-items-center rounded-full text-body ${
                        cur
                          ? "bg-white font-bold text-brand ring-4 ring-white/30"
                          : done
                            ? "bg-white/90 text-brand"
                            : "border-[1.5px] border-white/55 font-semibold text-white/80"
                      }`}
                    >
                      {done ? <CheckIcon /> : n}
                    </span>
                    <span className="flex flex-col">
                      <span className={`text-body leading-5 ${cur ? "font-semibold" : "font-medium"}`}>{name}</span>
                      <span className="text-caption leading-4.5 opacity-80">{statuses[i]}</span>
                    </span>
                  </button>
                  {n < 3 && <span aria-hidden="true" className={`mx-5 h-0.5 flex-1 rounded ${done ? "bg-white/90" : "bg-white/30"}`} />}
                </li>
              );
            })}
          </ol>
        </nav>
      </div>
    </header>
  );
}
