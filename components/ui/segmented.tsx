"use client";

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  /** alert: lời báo ngắn (vd "có cặp trùng"); có thì hiện chấm đỏ cạnh nhãn. */
  options: { value: T; label: string; hint?: string; alert?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex gap-0.5 rounded-control bg-control p-0.75">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            title={o.hint ?? o.alert}
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={`inline-flex h-8.5 flex-1 items-center justify-center gap-2 rounded-chip px-4 text-body whitespace-nowrap transition-colors ${
              on ? "bg-white font-semibold text-ink shadow-raised" : "font-medium text-muted hover:text-ink"
            }`}
          >
            {o.label}
            {o.alert && (
              <>
                <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-danger" />
                <span className="sr-only">, {o.alert}</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
