import type { HuntPublic } from "@scavenger/types";
import { useEffect, useMemo, useState } from "react";

export function useNow(intervalMs = 1000): number {
  const [t, setT] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setT(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return t;
}

export type HuntTimerState =
  | null
  | { kind: "ended"; label: string }
  | {
      kind: "untilStart" | "running";
      label: string;
      start: number;
      end: number;
    };

export function useHuntTimer(hunt: HuntPublic | undefined, now: number): HuntTimerState {
  return useMemo(() => {
    if (!hunt) return null;
    const start = new Date(hunt.startsAt).getTime();
    const end = start + hunt.durationSeconds * 1000;
    const fmt = (secRaw: number) => {
      const sec = Math.max(0, secRaw);
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = sec % 60;
      return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    };
    if (now >= end) return { kind: "ended", label: "Time up" };
    if (now < start) {
      return {
        kind: "untilStart",
        label: fmt(Math.floor((start - now) / 1000)),
        start,
        end,
      };
    }
    return {
      kind: "running",
      label: fmt(Math.floor((end - now) / 1000)),
      start,
      end,
    };
  }, [hunt, now]);
}
