import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 2 },
  },
});

export { ErrorBoundary } from "expo-router";

export const unstable_settings = {
  initialRouteName: "index",
};

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#16213e" },
          headerTintColor: "#eaeaea",
          contentStyle: { backgroundColor: "#1a1a2e" },
        }}
      >
        <Stack.Screen name="index" options={{ title: "Join hunt" }} />
        <Stack.Screen name="lobby" options={{ title: "Lobby", headerBackVisible: true }} />
        <Stack.Screen name="hunt" options={{ title: "Tasks", headerLeft: () => null }} />
        <Stack.Screen
          name="capture/[challengeId]"
          options={{ title: "Capture", presentation: "fullScreenModal" }}
        />
      </Stack>
    </QueryClientProvider>
  );
}
