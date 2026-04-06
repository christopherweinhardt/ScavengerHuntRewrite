import { HeaderBackButton } from "@react-navigation/elements";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useFocusEffect, useNavigation } from "expo-router";
import type { ComponentProps } from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
} from "react-native";
import { apiMeState } from "@/lib/api";
import { useHuntTimer, useNow } from "@/lib/huntTimer";
import { flushUploadQueue } from "@/lib/uploadQueue";
import { useRedirectOnHuntLoadFailure } from "@/lib/useRedirectOnHuntLoadFailure";
import * as Session from "@/lib/session";
import type { AppThemeColors } from "@/constants/Colors";
import { useAppTheme } from "@/lib/useAppTheme";

export default function HuntScreen() {
  const navigation = useNavigation();
  const { colors } = useAppTheme();
  const { width: windowWidth } = useWindowDimensions();

  const scoreBoxWidth = useMemo(
    () => Math.max(52, Math.round(windowWidth / 6)),
    [windowWidth]
  );
  const styles = useMemo(
    () => createStyles(colors, scoreBoxWidth),
    [colors, scoreBoxWidth]
  );
  const qc = useQueryClient();
  const now = useNow();

  useEffect(() => {
    void (async () => {
      if (!(await Session.getToken())) router.replace("/");
    })();
  }, []);

  useFocusEffect(
    useCallback(() => {
      void qc.refetchQueries({ queryKey: ["huntState"], type: "active" });
      void flushUploadQueue().then(({ ok, failed }) => {
        if (ok > 0) void qc.invalidateQueries({ queryKey: ["huntState"] });
        if (failed > 0) {
          /* silent retry next focus */
        }
      });
    }, [qc])
  );

  const q = useQuery({
    queryKey: ["huntState"],
    queryFn: ({ signal }) => apiMeState(signal),
  });

  useRedirectOnHuntLoadFailure(q);

  const timer = useHuntTimer(q.data?.hunt, now);

  const approvedScore = useMemo(() => {
    if (!q.data) return 0;
    const { challenges, completedChallengeIds } = q.data;
    const done = new Set(completedChallengeIds);
    return challenges.reduce((sum, c) => (done.has(c.id) ? sum + (c.points ?? 1) : sum), 0);
  }, [q.data]);

  if (q.isError && q.data == null) {
    return <View style={styles.centered} />;
  }

  if (q.isLoading || !q.data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const { hunt, challenges, completedChallengeIds, pendingChallengeIds = [] } = q.data;
  const approved = new Set(completedChallengeIds);
  const pending = new Set(pendingChallengeIds);
  const pendingOnlyCount = pendingChallengeIds.filter((id) => !approved.has(id)).length;
  const regular = challenges.filter((c) => !c.isBonus);
  const bonus = challenges.filter((c) => c.isBonus);

  return (
    <ScrollView
      style={styles.scroll}
      stickyHeaderIndices={[0]}
      refreshControl={
        <RefreshControl
          refreshing={q.isRefetching}
          onRefresh={() => void q.refetch()}
          tintColor={colors.accent}
          colors={[colors.accent]}
        />
      }
    >
      <View style={styles.stickyTimer}>
        <View style={[styles.timerColumn, { paddingRight: scoreBoxWidth + 12 }]}>
          {timer && timer.kind !== "ended" && (
            <>
              <Text style={styles.timerLabel}>
                {timer.kind === "untilStart" ? "Hunt starts in" : "Time left"}
              </Text>
              <Text style={styles.timer}>{timer.label}</Text>
            </>
          )}
          {timer?.kind === "ended" && (
            <>
              <Text style={styles.timerLabel}>Hunt window</Text>
              <Text style={styles.timer}>{timer.label}</Text>
            </>
          )}
        </View>
        <View style={styles.scoreBox}>
          <Text style={styles.scoreLabel}>Score</Text>
          <Text style={styles.scoreValue}>{approvedScore}</Text>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.huntName}>{hunt.name}</Text>
        <Text style={styles.progress}>
          {completedChallengeIds.length} / {challenges.length} completed
          {pendingOnlyCount > 0
            ? ` · ${pendingOnlyCount} pending review`
            : ""}
        </Text>

        {bonus.length > 0 && (
          <>
            <Text style={styles.section}>Bonus</Text>
            {bonus.map((c) => (
              <TaskRow
                key={c.id}
                title={c.title}
                subtitle={c.description}
                type={c.type}
                points={c.points ?? 1}
                approved={approved.has(c.id)}
                pendingReview={pending.has(c.id) && !approved.has(c.id)}
                onPress={() => router.push(`/capture/${c.id}`)}
                bonus
              />
            ))}
          </>
        )}

        <Text style={styles.section}>Tasks</Text>
        {regular.map((c) => (
          <TaskRow
            key={c.id}
            title={c.title}
            subtitle={c.description}
            type={c.type}
            points={c.points ?? 1}
            approved={approved.has(c.id)}
            pendingReview={pending.has(c.id) && !approved.has(c.id)}
            onPress={() => router.push(`/capture/${c.id}`)}
          />
        ))}
      </View>
    </ScrollView>
  );
}

function TaskRow(props: {
  title: string;
  subtitle: string;
  type: string;
  points: number;
  approved: boolean;
  pendingReview: boolean;
  onPress: () => void;
  bonus?: boolean;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createTaskRowStyles(colors), [colors]);
  const statusLabel = props.approved
    ? "· approved"
    : props.pendingReview
      ? "· pending review"
      : "";
  return (
    <Pressable
      style={[
        styles.row,
        props.approved && styles.rowDone,
        props.pendingReview && styles.rowPending,
        props.bonus && styles.rowBonus,
      ]}
      onPress={props.onPress}
      disabled={props.approved}
    >
      <View style={styles.rowTop}>
        <Text style={styles.rowTitle}>{props.title}</Text>
        <Text style={styles.badge}>{props.type === "video" ? "Video" : "Photo"}</Text>
      </View>
      <Text style={styles.rowSub} numberOfLines={2}>
        {props.subtitle}
      </Text>
      <Text style={styles.points}>
        {props.points} pts {statusLabel}
      </Text>
    </Pressable>
  );
}

function createStyles(c: AppThemeColors, scoreBoxWidth: number) {
  return StyleSheet.create({
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: c.background,
    },
    scroll: { flex: 1, backgroundColor: c.background },
    stickyTimer: {
      position: "relative",
      backgroundColor: c.background,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.stickyBorder,
    },
    timerColumn: { minWidth: 0 },
    scoreBox: {
      position: "absolute",
      right: 16,
      top: 0,
      bottom: 0,
      width: scoreBoxWidth,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      paddingHorizontal: 6,
      alignItems: "center",
      justifyContent: "center",
    },
    scoreLabel: { color: c.textSecondary, fontSize: 10, marginBottom: 1 },
    scoreValue: {
      fontSize: 18,
      fontWeight: "700",
      color: c.accent,
      fontVariant: ["tabular-nums"],
    },
    timerLabel: { color: c.textSecondary, fontSize: 12, marginBottom: 4 },
    timer: { fontSize: 26, fontWeight: "700", color: c.accent, fontVariant: ["tabular-nums"] },
    body: { padding: 16, paddingTop: 8 },
    huntName: { fontSize: 22, fontWeight: "800", color: c.text, marginBottom: 4 },
    progress: { color: c.textMuted, marginBottom: 20 },
    section: {
      color: c.accent,
      fontWeight: "700",
      marginTop: 8,
      marginBottom: 10,
      fontSize: 13,
      letterSpacing: 0.5,
    },
  });
}

function createTaskRowStyles(c: AppThemeColors) {
  return StyleSheet.create({
    row: {
      backgroundColor: c.surface,
      borderRadius: 12,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: c.border,
    },
    rowDone: { opacity: 0.55 },
    rowPending: { borderColor: c.rowPendingBorder, borderWidth: 1 },
    rowBonus: { borderColor: c.rowBonusBorder },
    rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    rowTitle: { color: c.text, fontSize: 17, fontWeight: "700", flex: 1, marginRight: 8 },
    badge: {
      backgroundColor: c.badgeBg,
      color: c.badgeText,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      fontSize: 11,
      fontWeight: "600",
      overflow: "hidden",
    },
    rowSub: { color: c.textSecondary, marginTop: 6, fontSize: 14 },
    points: { color: c.link, marginTop: 8, fontSize: 12 },
  });
}
