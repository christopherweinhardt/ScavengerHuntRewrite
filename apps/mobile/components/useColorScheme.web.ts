import { useEffect, useState } from "react";
import { Appearance } from "react-native";

type Scheme = "light" | "dark";

function normalize(name: string | null | undefined): Scheme {
  return name === "dark" ? "dark" : "light";
}

export function useColorScheme(): Scheme {
  const [scheme, setScheme] = useState<Scheme>(() => normalize(Appearance.getColorScheme()));

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setScheme(normalize(colorScheme));
    });
    return () => sub.remove();
  }, []);

  return scheme;
}
