import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { apiJoin } from "@/lib/api";
import * as Session from "@/lib/session";

export default function JoinScreen() {
  const [slug, setSlug] = useState("demo");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const existing = await Session.getToken();
      if (existing) router.replace("/lobby");
    })();
  }, []);

  async function onJoin() {
    if (!slug.trim() || !code.trim()) {
      Alert.alert("Missing info", "Enter hunt id and team join code.");
      return;
    }
    setBusy(true);
    try {
      const data = await apiJoin(slug.trim(), code.trim().toUpperCase());
      await Session.setToken(data.token);
      await Session.setSlug(slug.trim());
      router.replace("/lobby");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Join failed";
      Alert.alert("Could not join", msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.wrap}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.head}>Scavenger hunt</Text>
      <Text style={styles.sub}>Enter your hunt id and team code from the organizer.</Text>
      <Text style={styles.label}>Hunt id</Text>
      <TextInput
        value={slug}
        onChangeText={setSlug}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="e.g. demo"
        placeholderTextColor="#666"
        style={styles.input}
      />
      <Text style={styles.label}>Team join code</Text>
      <TextInput
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        placeholder="From your captain"
        placeholderTextColor="#666"
        style={styles.input}
      />
      <Pressable
        style={[styles.btn, busy && styles.btnDisabled]}
        onPress={() => void onJoin()}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>Join team</Text>
        )}
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    backgroundColor: "#1a1a2e",
  },
  head: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
  },
  sub: {
    fontSize: 15,
    color: "#aaa",
    marginBottom: 28,
  },
  label: {
    color: "#ccc",
    marginBottom: 6,
    fontSize: 13,
    fontWeight: "600",
  },
  input: {
    backgroundColor: "#16213e",
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: "#fff",
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#0f3460",
  },
  btn: {
    backgroundColor: "#e94560",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontSize: 17, fontWeight: "700" },
});
