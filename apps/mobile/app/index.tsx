import { useEffect, useMemo, useState } from "react";
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
import type { AppThemeColors } from "@/constants/Colors";
import { apiJoin } from "@/lib/api";
import { requestPushRegistrationSync } from "@/lib/usePushRegistration";
import * as Session from "@/lib/session";
import { useAppTheme } from "@/lib/useAppTheme";

export default function JoinScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [slug, setSlug] = useState("cfg2026");
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
      await Session.setTeamId(data.team.id);
      await Session.setSlug(slug.trim());
      requestPushRegistrationSync();
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
        placeholderTextColor={colors.placeholder}
        style={styles.input}
      />
      <Text style={styles.label}>Team join code</Text>
      <TextInput
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        placeholder="From your captain"
        placeholderTextColor={colors.placeholder}
        style={styles.input}
      />
      <Pressable
        style={[styles.btn, busy && styles.btnDisabled]}
        onPress={() => void onJoin()}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color={colors.onAccent} />
        ) : (
          <Text style={styles.btnText}>Join team</Text>
        )}
      </Pressable>
    </KeyboardAvoidingView>
  );
}

function createStyles(c: AppThemeColors) {
  return StyleSheet.create({
    wrap: {
      flex: 1,
      padding: 24,
      justifyContent: "center",
      backgroundColor: c.background,
    },
    head: {
      fontSize: 28,
      fontWeight: "700",
      color: c.text,
      marginBottom: 8,
    },
    sub: {
      fontSize: 15,
      color: c.textSecondary,
      marginBottom: 28,
    },
    label: {
      color: c.label,
      marginBottom: 6,
      fontSize: 13,
      fontWeight: "600",
    },
    input: {
      backgroundColor: c.inputBg,
      borderRadius: 10,
      padding: 14,
      fontSize: 16,
      color: c.text,
      marginBottom: 18,
      borderWidth: 1,
      borderColor: c.inputBorder,
    },
    btn: {
      backgroundColor: c.accent,
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: "center",
      marginTop: 8,
    },
    btnDisabled: { opacity: 0.6 },
    btnText: { color: c.onAccent, fontSize: 17, fontWeight: "700" },
  });
}
