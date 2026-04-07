import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useMemo, useRef, useState } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
} from "expo-camera";
import { apiMeState } from "@/lib/api";
import { canSubmitChallenge, useNow } from "@/lib/huntTimer";
import { syncCompletionIntoHuntState } from "@/lib/huntStateCache";
import { copyToBackup } from "@/lib/backup";
import { enqueueUpload } from "@/lib/uploadQueue";
import { uploadProofAndComplete } from "@/lib/upload";
import { useRedirectOnHuntLoadFailure } from "@/lib/useRedirectOnHuntLoadFailure";
import type { AppThemeColors } from "@/constants/Colors";
import { useAppTheme } from "@/lib/useAppTheme";

function guessMime(uri: string, kind: "photo" | "video"): { ext: string; contentType: string } {
  const lower = uri.toLowerCase();
  if (kind === "photo") {
    if (lower.includes(".png")) return { ext: "png", contentType: "image/png" };
    return { ext: "jpg", contentType: "image/jpeg" };
  }
  if (lower.endsWith(".mov") || lower.includes(".mov"))
    return { ext: "mov", contentType: "video/quicktime" };
  return { ext: "mp4", contentType: "video/mp4" };
}

type Preview = { uri: string; kind: "photo" | "video" };

/** Mounted with `key={uri}` so each recording gets a fresh player. */
function LocalVideoPreview({ uri, style }: { uri: string; style: StyleProp<ViewStyle> }) {
  const player = useVideoPlayer({ uri }, (p) => {
    p.play();
  });
  return (
    <VideoView style={style} player={player} nativeControls contentFit="contain" />
  );
}

export default function CaptureScreen() {
  const { challengeId } = useLocalSearchParams<{ challengeId: string }>();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const qc = useQueryClient();
  const now = useNow();
  const camRef = useRef<CameraView>(null);
  const recordWaitRef = useRef<Promise<{ uri: string } | undefined> | null>(null);

  const [camPerm, reqCam] = useCameraPermissions();
  const [micPerm, reqMic] = useMicrophonePermissions();

  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);

  const q = useQuery({
    queryKey: ["huntState"],
    queryFn: ({ signal }) => apiMeState(signal),
  });

  useRedirectOnHuntLoadFailure(q);

  const challenge = q.data?.challenges.find((c) => c.id === challengeId);

  async function ensurePerms(forVideo: boolean) {
    if (!camPerm?.granted) {
      const r = await reqCam();
      if (!r.granted) throw new Error("Camera permission denied");
    }
    if (forVideo) {
      if (!micPerm?.granted) {
        const r = await reqMic();
        if (!r.granted) throw new Error("Microphone permission denied");
      }
    }
  }

  async function onSubmit(uri: string, kind: "photo" | "video") {
    if (!challenge || !q.data) return;
    if (!canSubmitChallenge(q.data.hunt, now)) {
      Alert.alert("Submissions closed", "This hunt is not accepting submissions right now.");
      router.back();
      return;
    }
    const { ext, contentType } = guessMime(uri, kind);
    const huntId = q.data.hunt.id;
    setBusy(true);
    try {
      await copyToBackup({
        huntId,
        challengeId: challenge.id,
        fromUri: uri,
        ext,
      });
      await uploadProofAndComplete({
        challengeId: challenge.id,
        localUri: uri,
        contentType,
        ext,
      });
      await syncCompletionIntoHuntState(qc, challenge.id, "pending");
      await qc.refetchQueries({ queryKey: ["huntState"], type: "active" });
      router.back();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      await enqueueUpload({
        challengeId: challenge.id,
        localUri: uri,
        contentType,
        ext,
      });
      Alert.alert(
        "Queued for retry",
        `${msg}\nYour file was saved locally and will retry uploading from the task list.`
      );
      router.back();
    } finally {
      setBusy(false);
    }
  }

  async function takePhoto() {
    const c = camRef.current;
    if (!c || !challenge) return;
    try {
      await ensurePerms(false);
      const shot = await c.takePictureAsync({ quality: 0.85 });
      if (shot?.uri) setPreview({ uri: shot.uri, kind: "photo" });
    } catch (e) {
      Alert.alert("Capture error", e instanceof Error ? e.message : "Unknown");
    }
  }

  async function startVideo() {
    const c = camRef.current;
    if (!c || !challenge) return;
    try {
      await ensurePerms(true);
      setRecording(true);
      recordWaitRef.current = c.recordAsync({
        maxDuration: 120,
        ...(Platform.OS === "ios" ? { codec: "avc1" as const } : {}),
      });
    } catch (e) {
      setRecording(false);
      Alert.alert("Recording error", e instanceof Error ? e.message : "Unknown");
    }
  }

  async function stopVideo() {
    const c = camRef.current;
    if (!c) return;
    try {
      c.stopRecording();
      const p = recordWaitRef.current;
      recordWaitRef.current = null;
      setRecording(false);
      const result = p ? await p : undefined;
      if (result?.uri) setPreview({ uri: result.uri, kind: "video" });
    } catch (e) {
      setRecording(false);
      Alert.alert("Recording error", e instanceof Error ? e.message : "Unknown");
    }
  }

  if (!challengeId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Invalid task.</Text>
        <Pressable style={styles.btn} onPress={() => router.back()}>
          <Text style={styles.btnText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  if (q.isError && q.data == null) {
    return <View style={styles.centered} />;
  }

  if (!q.data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!challenge) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Task not found (refresh task list).</Text>
        <Pressable style={styles.btn} onPress={() => router.back()}>
          <Text style={styles.btnText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  if (q.data.completedChallengeIds.includes(challenge.id)) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>
          This task is approved. No need to submit again.
        </Text>
        <Pressable style={styles.btn} onPress={() => router.back()}>
          <Text style={styles.btnText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  if (busy) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.muted}>Uploading…</Text>
      </View>
    );
  }

  const mode = challenge.type === "video" ? "video" : "picture";

  if (preview) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>{challenge.title}</Text>
        {preview.kind === "photo" ? (
          <Image
            source={{ uri: preview.uri }}
            style={styles.preview}
            contentFit="contain"
          />
        ) : (
          <LocalVideoPreview key={preview.uri} uri={preview.uri} style={styles.preview} />
        )}
        <View style={styles.actions}>
          <Pressable
            style={styles.btn}
            onPress={() => void onSubmit(preview.uri, preview.kind)}
          >
            <Text style={styles.btnText}>Submit</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={() => setPreview(null)}>
            <Text style={styles.secondaryText}>Retake</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={() => router.back()}>
            <Text style={styles.secondaryText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{challenge.title}</Text>
      <CameraView
        ref={camRef}
        style={styles.camera}
        facing="back"
        mode={mode}
      />
      <View style={styles.actions}>
        {challenge.type === "video" ? (
          !recording ? (
            <Pressable style={styles.btn} onPress={() => void startVideo()}>
              <Text style={styles.btnText}>Record</Text>
            </Pressable>
          ) : (
            <Pressable style={[styles.btn, styles.stop]} onPress={() => void stopVideo()}>
              <Text style={styles.btnText}>Stop</Text>
            </Pressable>
          )
        ) : (
          <Pressable style={styles.btn} onPress={() => void takePhoto()}>
            <Text style={styles.btnText}>Take photo</Text>
          </Pressable>
        )}
        <Pressable style={styles.secondary} onPress={() => router.back()}>
          <Text style={styles.secondaryText}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(c: AppThemeColors) {
  return StyleSheet.create({
    wrap: { flex: 1, backgroundColor: c.cameraBg },
    camera: { flex: 1 },
    preview: { flex: 1, backgroundColor: c.cameraBg },
    title: {
      color: "#fff",
      padding: 12,
      fontSize: 16,
      fontWeight: "700",
      backgroundColor: c.captureTitleBg,
    },
    actions: { padding: 16, backgroundColor: c.captureActionsBg, gap: 12 },
    btn: {
      backgroundColor: c.accent,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: "center",
    },
    stop: { backgroundColor: c.stopButton },
    btnText: { color: c.onAccent, fontWeight: "700", fontSize: 16 },
    secondary: { alignItems: "center", padding: 8 },
    secondaryText: { color: c.link },
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: c.background,
      padding: 24,
      gap: 12,
    },
    muted: { color: c.textMuted, textAlign: "center" },
  });
}
