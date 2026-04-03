import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
} from "expo-camera";
import { apiMeState } from "@/lib/api";
import { copyToBackup } from "@/lib/backup";
import { enqueueUpload } from "@/lib/uploadQueue";
import { uploadProofAndComplete } from "@/lib/upload";

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

export default function CaptureScreen() {
  const { challengeId } = useLocalSearchParams<{ challengeId: string }>();
  const qc = useQueryClient();
  const camRef = useRef<CameraView>(null);
  const recordWaitRef = useRef<Promise<{ uri: string } | undefined> | null>(null);

  const [camPerm, reqCam] = useCameraPermissions();
  const [micPerm, reqMic] = useMicrophonePermissions();

  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);

  const q = useQuery({
    queryKey: ["huntState"],
    queryFn: apiMeState,
  });

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
      await qc.invalidateQueries({ queryKey: ["huntState"] });
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
      if (shot?.uri) await onSubmit(shot.uri, "photo");
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
      if (result?.uri) await onSubmit(result.uri, "video");
    } catch (e) {
      setRecording(false);
      Alert.alert("Recording error", e instanceof Error ? e.message : "Unknown");
    }
  }

  if (!challengeId || !q.data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#e94560" />
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

  const mode = challenge.type === "video" ? "video" : "picture";

  if (busy) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#e94560" />
        <Text style={styles.muted}>Uploading…</Text>
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
              <Text style={styles.btnText}>Stop & upload</Text>
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

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#000" },
  camera: { flex: 1 },
  title: {
    color: "#fff",
    padding: 12,
    fontSize: 16,
    fontWeight: "700",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  actions: { padding: 16, backgroundColor: "#1a1a2e", gap: 12 },
  btn: {
    backgroundColor: "#e94560",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  stop: { backgroundColor: "#533483" },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  secondary: { alignItems: "center", padding: 8 },
  secondaryText: { color: "#6c9cff" },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1a1a2e",
    padding: 24,
    gap: 12,
  },
  muted: { color: "#888", textAlign: "center" },
});
