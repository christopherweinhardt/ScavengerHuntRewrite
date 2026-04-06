export type AppThemeColors = {
  background: string;
  surface: string;
  border: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  label: string;
  accent: string;
  link: string;
  badgeBg: string;
  badgeText: string;
  headerBg: string;
  headerTint: string;
  stickyBorder: string;
  onAccent: string;
  rowPendingBorder: string;
  rowBonusBorder: string;
  stopButton: string;
  captureTitleBg: string;
  captureActionsBg: string;
  cameraBg: string;
  inputBg: string;
  inputBorder: string;
  placeholder: string;
};

export const lightTheme: AppThemeColors = {
  background: "#dae5e6",
  surface: "#ecf4f5",
  border: "#9eb8be",
  text: "#213547",
  textSecondary: "#3d5666",
  textMuted: "#5c7582",
  label: "#4a6270",
  accent: "#213547",
  link: "#1a5f8a",
  badgeBg: "#b8d0d6",
  badgeText: "#213547",
  headerBg: "#c8dde1",
  headerTint: "#213547",
  stickyBorder: "#9eb8be",
  onAccent: "#ffffff",
  rowPendingBorder: "#b45309",
  rowBonusBorder: "#6b4a8f",
  stopButton: "#533483",
  captureTitleBg: "rgba(0,0,0,0.55)",
  captureActionsBg: "#ecf4f5",
  cameraBg: "#000000",
  inputBg: "#f5fafb",
  inputBorder: "#9eb8be",
  placeholder: "#6c858f",
};

export const darkTheme: AppThemeColors = {
  background: "#1a1a2e",
  surface: "#16213e",
  border: "#0f3460",
  text: "#ffffff",
  textSecondary: "#aaaaaa",
  textMuted: "#888888",
  label: "#cccccc",
  accent: "#e94560",
  link: "#6c9cff",
  badgeBg: "#0f3460",
  badgeText: "#8ecfff",
  headerBg: "#16213e",
  headerTint: "#eaeaea",
  stickyBorder: "#0f3460",
  onAccent: "#ffffff",
  rowPendingBorder: "#ca8a04",
  rowBonusBorder: "#533483",
  stopButton: "#533483",
  captureTitleBg: "rgba(0,0,0,0.55)",
  captureActionsBg: "#1a1a2e",
  cameraBg: "#000000",
  inputBg: "#16213e",
  inputBorder: "#0f3460",
  placeholder: "#666666",
};

export default {
  light: {
    text: lightTheme.text,
    background: lightTheme.background,
    tint: lightTheme.accent,
    tabIconDefault: "#9eb8be",
    tabIconSelected: lightTheme.accent,
  },
  dark: {
    text: darkTheme.text,
    background: darkTheme.background,
    tint: darkTheme.accent,
    tabIconDefault: "#cccccc",
    tabIconSelected: darkTheme.accent,
  },
};
