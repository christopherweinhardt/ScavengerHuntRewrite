import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useMemo } from "react";
import * as Session from "@/lib/session";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { apiMeState, unregisterDevicePushToken } from "@/lib/api";
import { useHuntTimer, useNow } from "@/lib/huntTimer";
import { useRedirectOnHuntLoadFailure } from "@/lib/useRedirectOnHuntLoadFailure";
import type { AppThemeColors } from "@/constants/Colors";
import { useAppTheme } from "@/lib/useAppTheme";

export default function LobbyScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const now = useNow();

  useEffect(() => {
    void (async () => {
      if (!(await Session.getToken())) router.replace("/");
    })();
  }, []);

  const q = useQuery({
    queryKey: ["huntState"],
    queryFn: ({ signal }) => apiMeState(signal),
  });

  useRedirectOnHuntLoadFailure(q);

  const timer = useHuntTimer(q.data?.hunt, now);

  if (q.isError && q.data == null) {
    return <View style={styles.centered} />;
  }

  if (q.isLoading || !q.data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
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
        onPress={() => router.push("/hunt")}
      >
        <Text style={styles.btnText}>{canEnter ? "Enter hunt" : "Wait for start"}</Text>
      </Pressable>
      <Pressable
        style={styles.secondary}
        onPress={async () => {
          await unregisterDevicePushToken();
          await Session.clearSession();
          router.replace("/");
        }}
      >
        <Text style={styles.secondaryText}>Leave / switch team</Text>
      </Pressable>
    </ScrollView>
  );
}

function createStyles(c: AppThemeColors) {
  return StyleSheet.create({
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: c.background,
      gap: 12,
    },
    muted: { color: c.textMuted },
    scroll: {
      padding: 24,
      backgroundColor: c.background,
      flexGrow: 1,
    },
    title: { fontSize: 26, fontWeight: "800", color: c.text, marginBottom: 8 },
    status: { color: c.textSecondary, marginBottom: 20 },
    timerBox: {
      backgroundColor: c.surface,
      padding: 20,
      borderRadius: 12,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: c.border,
    },
    timerLabel: { color: c.textSecondary, fontSize: 13, marginBottom: 6 },
    timer: { fontSize: 32, fontWeight: "700", color: c.accent, fontVariant: ["tabular-nums"] },
    meta: { color: c.textMuted, marginBottom: 24 },
    btn: {
      backgroundColor: c.accent,
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: "center",
    },
    btnDisabled: { opacity: 0.45 },
    btnText: { color: c.onAccent, fontSize: 17, fontWeight: "700" },
    secondary: { marginTop: 20, alignItems: "center" },
    secondaryText: { color: c.link },
  });
}
