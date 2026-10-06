"use client";

import { useRef, useState } from "react";
import { EditIcon } from "./card";

/**
 * Tên sửa được: bấm vào tên hoặc biểu tượng bút để gõ tên mới.
 * Enter hoặc bấm ra ngoài để lưu, Esc để bỏ. Cỡ chữ lấy theo phần tử bao ngoài.
 * iconOnly: chỉ hiện biểu tượng bút (khi tên đã hiện ở chỗ khác, vd trên thanh chọn phòng).
 */
export function EditableName({
  value, label, iconOnly = false, onChange,
}: {
  value: string;
  label: string;
  iconOnly?: boolean;
  onChange: (name: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const cancelled = useRef(false);

  if (draft === null) {
    return (
      <button
        type="button"
        title={label}
        aria-label={`${label} (${value})`}
        onClick={() => { cancelled.current = false; setDraft(value); }}
        className="group inline-flex min-w-0 items-center gap-2 rounded-chip text-left"
      >
        {!iconOnly && <span className="truncate">{value}</span>}
        <span className="grid size-8 shrink-0 place-items-center rounded-chip bg-control text-muted group-hover:bg-control-hover group-hover:text-ink">
          <EditIcon />
        </span>
      </button>
    );
  }

  function finish() {
    const name = draft!.trim();
    if (!cancelled.current && name && name !== value) onChange(name);
    setDraft(null);
  }

  return (
    <input
      autoFocus
      aria-label={label}
      value={draft}
      maxLength={60}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={finish}
      onKeyDown={(e) => {
        if (e.key === "Escape") cancelled.current = true;
        if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
      }}
      className="field h-10 w-64 px-3 text-body font-normal"
    />
  );
}
