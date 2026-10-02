import type { HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={`rounded-card bg-white p-7 shadow-card ${className}`} {...props} />;
}

export function Pill({ tone = "neutral", children }: { tone?: "neutral" | "ok" | "warn"; children: React.ReactNode }) {
  const t = {
    neutral: "bg-subtle text-ink",
    ok: "bg-ok-bg text-ok font-semibold",
    warn: "bg-warn-bg text-warn",
  }[tone];
  return <span className={`inline-flex h-8 items-center gap-1.5 rounded-chip px-3 text-sm ${t}`}>{children}</span>;
}

/** Hộp báo lỗi / cảnh báo nằm trong card. */
export function Notice({ tone, className = "", children }: { tone: "info" | "warn" | "danger"; className?: string; children: React.ReactNode }) {
  const t = { info: "bg-brand-soft text-brand-ink", warn: "bg-warn-bg text-warn", danger: "bg-danger-bg text-danger" }[tone];
  return <div className={`rounded-control px-4 py-2.5 text-sm ${t} ${className}`}>{children}</div>;
}

export const CheckIcon = ({ className = "size-4" }: { className?: string }) => (
  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
    <path d="M4 10.5l4 4 8-9" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const DownloadIcon = () => (
  <svg viewBox="0 0 18 18" fill="none" aria-hidden="true" className="size-4">
    <path d="M9 2.5v9M5 8l4 4 4-4M3 15.5h12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Logo = ({ className = "size-8" }: { className?: string }) => (
  <svg viewBox="0 0 40 40" aria-hidden="true" className={className}>
    <rect width="40" height="40" rx="8" fill="#fff" />
    {[
      [8, 9, 1], [17, 9, 1], [26, 9, 0.45], [8, 17, 0.45], [17, 17, 1], [26, 17, 1], [8, 25, 1], [17, 25, 0.45], [26, 25, 1],
    ].map(([x, y, o]) => (
      <rect key={`${x}-${y}`} x={x} y={y} width="6" height="6" rx="1.5" className="fill-brand" opacity={o} />
    ))}
  </svg>
);
