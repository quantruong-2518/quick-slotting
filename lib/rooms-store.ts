"use client";

import { useSyncExternalStore } from "react";
import type { RoomConfig } from "./types";

// Sơ đồ đã lưu nằm trong localStorage của trình duyệt: không cần tài khoản, không lên máy chủ.
const KEY = "xcn.rooms.v1";
const EMPTY: RoomConfig[] = [];
const listeners = new Set<() => void>();
let cacheRaw: string | null = null;
let cache: RoomConfig[] = EMPTY;

function read(): RoomConfig[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return EMPTY;
  }
  if (raw === cacheRaw) return cache;
  cacheRaw = raw;
  try {
    const parsed = raw ? (JSON.parse(raw) as RoomConfig[]) : EMPTY;
    cache = Array.isArray(parsed) ? parsed : EMPTY;
  } catch {
    cache = EMPTY;
  }
  return cache;
}

function write(rooms: RoomConfig[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(rooms));
  } catch {
    /* bộ nhớ đầy hoặc bị chặn: bỏ qua */
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => e.key === KEY && l();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

export function useSavedRooms() {
  const rooms = useSyncExternalStore(subscribe, read, () => EMPTY);
  return {
    rooms,
    save(room: RoomConfig) {
      const list = read().filter((r) => r.id !== room.id);
      write([...list, room].sort((a, b) => a.name.localeCompare(b.name, "vi")));
    },
  };
}
