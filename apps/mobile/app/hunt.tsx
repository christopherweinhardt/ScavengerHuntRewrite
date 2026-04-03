import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { apiMeState } from "@/lib/api";
import { flushUploadQueue } from "@/lib/uploadQueue";
import { useHuntSocket } from "@/lib/useHuntSocket";
import * as Session from "@/lib/session";

export default function HuntScreen() {
  const qc = useQueryClient();
  useHuntSocket(true);

  useEffect(() => {
    void (async () => {
      if (!(await Session.getToken())) router.replace("/");
    })();
  }, []);

  useFocusEffect(
    useCallback(() => {
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
    queryFn: apiMeState,
  });

  if (q.isLoading || !q.data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#e94560" />
      </View>
    );
  }

  const { hunt, challenges, completedChallengeIds } = q.data;
  const done = new Set(completedChallengeIds);
  const regular = challenges.filter((c) => !c.isBonus);
  const bonus = challenges.filter((c) => c.isBonus);

  return (
    <ScrollView
      style={styles.scroll}
      refreshControl={
        <RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} />
      }
    >
      <Text style={styles.huntName}>{hunt.name}</Text>
      <Text style={styles.progress}>
        {completedChallengeIds.length} / {challenges.length} completed
      </Text>

      <Text style={styles.section}>Tasks</Text>
      {regular.map((c) => (
        <TaskRow
          key={c.id}
          title={c.title}
          subtitle={c.description}
          type={c.type}
          points={c.points ?? 1}
          done={done.has(c.id)}
          onPress={() => router.push(`/capture/${c.id}`)}
        />
      ))}

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
              done={done.has(c.id)}
              onPress={() => router.push(`/capture/${c.id}`)}
              bonus
            />
          ))}
        </>
      )}
    </ScrollView>
  );
}

function TaskRow(props: {
  title: string;
  subtitle: string;
  type: string;
  points: number;
  done: boolean;
  onPress: () => void;
  bonus?: boolean;
}) {
  return (
    <Pressable
      style={[styles.row, props.done && styles.rowDone, props.bonus && styles.rowBonus]}
      onPress={props.onPress}
      disabled={props.done}
    >
      <View style={styles.rowTop}>
        <Text style={styles.rowTitle}>{props.title}</Text>
        <Text style={styles.badge}>{props.type === "video" ? "Video" : "Photo"}</Text>
      </View>
      <Text style={styles.rowSub} numberOfLines={2}>
        {props.subtitle}
      </Text>
      <Text style={styles.points}>{props.points} pts {props.done ? "· done" : ""}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1a1a2e",
  },
  scroll: { flex: 1, backgroundColor: "#1a1a2e", padding: 16 },
  huntName: { fontSize: 22, fontWeight: "800", color: "#fff", marginBottom: 4 },
  progress: { color: "#888", marginBottom: 20 },
  section: {
    color: "#e94560",
    fontWeight: "700",
    marginTop: 8,
    marginBottom: 10,
    fontSize: 13,
    letterSpacing: 0.5,
  },
  row: {
    backgroundColor: "#16213e",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#0f3460",
  },
  rowDone: { opacity: 0.55 },
  rowBonus: { borderColor: "#533483" },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowTitle: { color: "#fff", fontSize: 17, fontWeight: "700", flex: 1, marginRight: 8 },
  badge: {
    backgroundColor: "#0f3460",
    color: "#8ecfff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    fontSize: 11,
    fontWeight: "600",
    overflow: "hidden",
  },
  rowSub: { color: "#aaa", marginTop: 6, fontSize: 14 },
  points: { color: "#6c9cff", marginTop: 8, fontSize: 12 },
});
