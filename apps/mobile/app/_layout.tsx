import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { HuntSocketBridge } from "@/lib/useHuntSocket";
import { usePushRegistration } from "@/lib/usePushRegistration";
import { useAppTheme } from "@/lib/useAppTheme";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 2 },
  },
});

export { ErrorBoundary } from "expo-router";

export const unstable_settings = {
  initialRouteName: "index",
};

function ThemedStack() {
  usePushRegistration();
  const { colors, isDark } = useAppTheme();

  return (
    <>
      <HuntSocketBridge />
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.headerBg },
          headerTintColor: colors.headerTint,
          headerTitleStyle: { color: colors.text },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ title: "Join hunt" }} />
        <Stack.Screen name="lobby" options={{ title: "Lobby", headerBackVisible: true }} />
        <Stack.Screen name="hunt" options={{ title: "Tasks", headerBackVisible: true, headerBackButtonDisplayMode: "minimal" }} />
        <Stack.Screen
          name="capture/[challengeId]"
          options={{ title: "Capture", presentation: "fullScreenModal" }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemedStack />
    </QueryClientProvider>
  );
}
