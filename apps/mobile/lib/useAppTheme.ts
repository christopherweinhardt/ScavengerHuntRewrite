import { useColorScheme } from "@/components/useColorScheme";
import { darkTheme, lightTheme, type AppThemeColors } from "@/constants/Colors";

export function useAppTheme(): { isDark: boolean; colors: AppThemeColors } {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  return { isDark, colors: isDark ? darkTheme : lightTheme };
}
