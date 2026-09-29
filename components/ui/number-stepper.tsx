"use client";

export function NumberStepper({
  id,
  label,
  value,
  max,
  onChange,
}: {
  id: string;
  label: string;
  value: number | null;
  max: number;
  onChange: (v: number | null) => void;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(1, n));
  const btn = "grid size-10 place-items-center rounded-control bg-control text-xl leading-none hover:bg-control-hover";
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="text-body font-medium">
        {label}
      </label>
      <div className="flex gap-1">
        <button type="button" aria-label={`Bớt ${label.toLowerCase()}`} className={btn} onClick={() => onChange(clamp((value ?? 1) - 1))}>
          −
        </button>
        <input
          id={id}
          inputMode="numeric"
          placeholder="–"
          value={value ?? ""}
          onChange={(e) => {
            const raw = e.target.value.replace(/\D/g, "");
            onChange(raw ? clamp(parseInt(raw, 10)) : null);
          }}
          className="field h-10 w-14 text-center text-lg font-semibold"
        />
        <button type="button" aria-label={`Thêm ${label.toLowerCase()}`} className={btn} onClick={() => onChange(clamp((value ?? 0) + 1))}>
          +
        </button>
      </div>
    </div>
  );
}
