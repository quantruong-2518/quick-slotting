"use client";

export function NumberStepper({
  id,
  label,
  value,
  min = 1,
  max,
  readOnly = false,
  onChange,
}: {
  id: string;
  label: string;
  value: number | null;
  min?: number;
  max: number;
  /** Chỉ đổi bằng nút −/+ (dùng khi mỗi lần đổi là chạy lại việc nặng). */
  readOnly?: boolean;
  onChange: (v: number | null) => void;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const btn = "grid size-10 place-items-center rounded-control bg-control text-xl leading-none hover:bg-control-hover";
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="text-body font-medium">
        {label}
      </label>
      <div className="flex gap-1">
        <button
          type="button"
          aria-label={`Bớt ${label.toLowerCase()}`}
          disabled={value !== null && value <= min}
          className={`${btn} disabled:cursor-not-allowed disabled:opacity-40`}
          onClick={() => onChange(clamp((value ?? min) - 1))}
        >
          −
        </button>
        <input
          id={id}
          inputMode="numeric"
          placeholder="–"
          value={value ?? ""}
          readOnly={readOnly}
          onChange={(e) => {
            const raw = e.target.value.replace(/\D/g, "");
            onChange(raw ? clamp(parseInt(raw, 10)) : null);
          }}
          className="field h-10 w-14 text-center text-lg font-semibold"
        />
        <button
          type="button"
          aria-label={`Thêm ${label.toLowerCase()}`}
          disabled={value !== null && value >= max}
          className={`${btn} disabled:cursor-not-allowed disabled:opacity-40`}
          onClick={() => onChange(clamp((value ?? min - 1) + 1))}
        >
          +
        </button>
      </div>
    </div>
  );
}
