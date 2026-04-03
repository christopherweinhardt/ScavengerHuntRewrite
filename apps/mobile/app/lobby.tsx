import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import * as Session from "@/lib/session";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { apiMeState } from "@/lib/api";
import { useHuntSocket } from "@/lib/useHuntSocket";

function useNow(): number {
  const [t, setT] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setT(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return t;
}

export default function LobbyScreen() {
  const now = useNow();
  useHuntSocket(true);

  useEffect(() => {
    void (async () => {
      if (!(await Session.getToken())) router.replace("/");
    })();
  }, []);

  const q = useQuery({
    queryKey: ["huntState"],
    queryFn: apiMeState,
  });

  const timer = useMemo(() => {
    if (!q.data) return null;
    const start = new Date(q.data.hunt.startsAt).getTime();
    const end = start + q.data.hunt.durationSeconds * 1000;
    const fmt = (secRaw: number) => {
      const sec = Math.max(0, secRaw);
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = sec % 60;
      return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    };
    if (now >= end) return { kind: "ended" as const, label: "Time up" };
    if (now < start) {
      return {
        kind: "untilStart" as const,
        label: fmt(Math.floor((start - now) / 1000)),
        start,
        end,
      };
    }
    return {
      kind: "running" as const,
      label: fmt(Math.floor((end - now) / 1000)),
      start,
      end,
    };
  }, [q.data, now]);

  if (q.isLoading || !q.data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#e94560" />
        <Text style={styles.muted}>Loading hunt…</Text>
      </View>
    );
  }

  const { hunt, challenges } = q.data;
  const canEnter =
    hunt.status === "active" &&
    timer != null &&
    timer.kind !== "ended" &&
    timer.kind === "running";

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.title}>{hunt.name}</Text>
      <Text style={styles.status}>Status: {hunt.status}</Text>
      {timer && timer.kind !== "ended" && (
        <View style={styles.timerBox}>
          <Text style={styles.timerLabel}>
            {timer.kind === "untilStart" ? "Hunt starts in" : "Time remaining in hunt"}
          </Text>
          <Text style={styles.timer}>{timer.label}</Text>
        </View>
      )}
      {timer?.kind === "ended" && (
        <View style={styles.timerBox}>
          <Text style={styles.timerLabel}>Hunt window</Text>
          <Text style={styles.timer}>{timer.label}</Text>
        </View>
      )}
      <Text style={styles.meta}>
        {challenges.length} active tasks · server clock synced
      </Text>
      <Pressable
        style={[styles.btn, !canEnter && styles.btnDisabled]}
        disabled={!canEnter}
        onPress={() => router.replace("/hunt")}
      >
        <Text style={styles.btnText}>{canEnter ? "Enter hunt" : "Wait for start"}</Text>
      </Pressable>
      <Pressable
        style={styles.secondary}
        onPress={async () => {
          await Session.clearSession();
          router.replace("/");
        }}
      >
        <Text style={styles.secondaryText}>Leave / switch team</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1a1a2e",
    gap: 12,
  },
  muted: { color: "#888" },
  scroll: {
    padding: 24,
    backgroundColor: "#1a1a2e",
    flexGrow: 1,
  },
  title: { fontSize: 26, fontWeight: "800", color: "#fff", marginBottom: 8 },
  status: { color: "#aaa", marginBottom: 20 },
  timerBox: {
    backgroundColor: "#16213e",
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#0f3460",
  },
  timerLabel: { color: "#aaa", fontSize: 13, marginBottom: 6 },
  timer: { fontSize: 32, fontWeight: "700", color: "#e94560", fontVariant: ["tabular-nums"] },
  meta: { color: "#888", marginBottom: 24 },
  btn: {
    backgroundColor: "#e94560",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.45 },
  btnText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  secondary: { marginTop: 20, alignItems: "center" },
  secondaryText: { color: "#6c9cff" },
});
