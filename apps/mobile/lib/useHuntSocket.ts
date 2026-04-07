import type { Challenge, HuntPublic } from "@scavenger/types";
import { useQueryClient } from "@tanstack/react-query";
import { router, usePathname } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { Alert } from "react-native";
import { getApiBaseUrl } from "./config";
import { syncCompletionIntoHuntState } from "./huntStateCache";
import { showSubmissionRejectedAlert } from "./rejectionNotify";
import { unregisterDevicePushToken } from "./api";
import * as Session from "./session";
import { getTeamId, getToken, parseTeamIdFromJwt } from "./session";
import type { HuntStateResponse } from "./api";

type CompletionStatusPayload = {
  teamId: string;
  challengeId: string;
  status: "approved" | "pending" | "none";
  challengeTitle?: string;
};

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
          return {
            ...old,
            challenges,
            pendingChallengeIds: old.pendingChallengeIds ?? [],
          };
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
              pendingChallengeIds: old.pendingChallengeIds ?? [],
            };
          });
        }
      );

      socket.on("hunt:meta", (h: HuntPublic) => {
        qc.setQueryData<HuntStateResponse>(["huntState"], (old) =>
          old
            ? { ...old, hunt: h, pendingChallengeIds: old.pendingChallengeIds ?? [] }
            : old
        );
      });

      socket.on("team:kicked", () => {
        void (async () => {
          await unregisterDevicePushToken();
          await Session.clearSession();
          Alert.alert("Removed from hunt", "An admin removed your team from this hunt.");
          router.replace("/");
        })();
      });

      const myTeamIdFromJwt = parseTeamIdFromJwt(token);
      socket.on("completion:status", (payload: CompletionStatusPayload) => {
        const challengeId = String(payload.challengeId);
        void (async () => {
          const storedTeamId = await getTeamId();
          const mine = storedTeamId ?? myTeamIdFromJwt;
          if (!mine) return;
          if (payload.teamId.toLowerCase() !== mine.toLowerCase()) return;
          await syncCompletionIntoHuntState(qc, challengeId, payload.status);
          if (payload.status === "none") {
            const task = payload.challengeTitle ?? "this task";
            showSubmissionRejectedAlert(
              challengeId,
              `Your submission for "${task}" was rejected. You can submit a new one.`
            );
          }
        })();
      });
    })();

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [enabled, qc]);
}

/** Single socket while signed in (any hunt screen); avoids missing events on capture, etc. */
export function HuntSocketBridge(): null {
  const pathname = usePathname();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    void (async () => {
      const token = await getToken();
      // Do not treat missing pathname as join — Expo Router can report null/undefined briefly,
      // which would keep the socket off and drop all completion:status events.
      const onJoin =
        pathname === "/" ||
        pathname === "/index" ||
        pathname === "index";
      setEnabled(!!token && !onJoin);
    })();
  }, [pathname]);

  useHuntSocket(enabled);
  return null;
}
