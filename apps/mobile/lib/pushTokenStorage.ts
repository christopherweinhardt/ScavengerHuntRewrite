import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "scavenger_expo_push_token";

export async function setStoredExpoPushToken(token: string): Promise<void> {
  await AsyncStorage.setItem(KEY, token);
}

export async function getStoredExpoPushToken(): Promise<string | null> {
  return AsyncStorage.getItem(KEY);
}

export async function clearStoredExpoPushToken(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
