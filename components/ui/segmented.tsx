"use client";

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; hint?: string }[];
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
            title={o.hint}
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={`h-9 flex-1 rounded-chip px-3.5 text-body whitespace-nowrap transition-colors ${
              on ? "bg-white font-semibold text-ink shadow-raised" : "font-medium text-muted hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
