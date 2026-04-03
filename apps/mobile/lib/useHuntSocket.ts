import type { Challenge, HuntPublic } from "@scavenger/types";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { getApiBaseUrl } from "./config";
import { getToken } from "./session";
import type { HuntStateResponse } from "./api";

function mergeUpsert(
  list: Challenge[],
  next: Challenge
): Challenge[] {
  const i = list.findIndex((c) => c.id === next.id);
  if (i === -1) return [...list, next].sort((a, b) => a.sortOrder - b.sortOrder);
  const copy = [...list];
  copy[i] = next;
  return copy.sort((a, b) => a.sortOrder - b.sortOrder);
}

export function useHuntSocket(enabled: boolean): void {
  const qc = useQueryClient();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    void (async () => {
      const token = await getToken();
      if (!token || cancelled) return;

      const socket = io(getApiBaseUrl(), {
        auth: { token },
        transports: ["polling", "websocket"],
        timeout: 15000,
      });
      socketRef.current = socket;

      socket.on("challenge:upsert", (c: Challenge) => {
        qc.setQueryData<HuntStateResponse>(["huntState"], (old) => {
          if (!old) return old;
          const challenges = c.active
            ? mergeUpsert(
                old.challenges.filter((x) => x.id !== c.id),
                c
              )
            : old.challenges.filter((x) => x.id !== c.id);
          return { ...old, challenges };
        });
      });

      socket.on(
        "challenge:remove",
        (payload: { id: string }) => {
          qc.setQueryData<HuntStateResponse>(["huntState"], (old) => {
            if (!old) return old;
            return {
              ...old,
              challenges: old.challenges.filter((x) => x.id !== payload.id),
            };
          });
        }
      );

      socket.on("hunt:meta", (h: HuntPublic) => {
        qc.setQueryData<HuntStateResponse>(["huntState"], (old) =>
          old ? { ...old, hunt: h } : old
        );
      });
    })();

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [enabled, qc]);
}
