"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import {
  THEME_STORAGE_KEY,
  themePreferences,
  type ResolvedTheme,
  type ThemePreference,
} from "@/lib/theme";

type ThemeContextValue = {
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
};

const THEME_CHANGE_EVENT = "payvio-theme-change";

function isThemePreference(value: string | null): value is ThemePreference {
  return themePreferences.some((theme) => theme === value);
}

function readStoredTheme(): ThemePreference {
  if (typeof window === "undefined") {
    return "system";
  }

  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(storedTheme) ? storedTheme : "system";
  } catch {
    return "system";
  }
}

function getSystemTheme(): ResolvedTheme {
  if (!window.matchMedia) {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveTheme(theme: ThemePreference): ResolvedTheme {
  if (theme === "system") {
    return getSystemTheme();
  }

  return theme;
}

function applyTheme(theme: ThemePreference): ResolvedTheme {
  const resolvedTheme = resolveTheme(theme);
  const root = document.documentElement;

  root.classList.toggle("dark", resolvedTheme === "dark");
  root.dataset.theme = theme;
  root.dataset.resolvedTheme = resolvedTheme;
  root.style.colorScheme = resolvedTheme;

  return resolvedTheme;
}

function applyCurrentTheme() {
  return applyTheme(readStoredTheme());
}

function getThemeSnapshot(): ThemePreference {
  return readStoredTheme();
}

function getServerThemeSnapshot(): ThemePreference {
  return "system";
}

function getResolvedThemeSnapshot(): ResolvedTheme {
  if (typeof window === "undefined") {
    return "light";
  }

  return resolveTheme(readStoredTheme());
}

function getServerResolvedThemeSnapshot(): ResolvedTheme {
  return "light";
}

function subscribeToTheme(callback: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const media = window.matchMedia?.("(prefers-color-scheme: dark)");
  const handleChange = () => {
    applyCurrentTheme();
    callback();
  };

  window.addEventListener(THEME_CHANGE_EVENT, handleChange);
  window.addEventListener("storage", handleChange);

  if (media?.addEventListener) {
    media.addEventListener("change", handleChange);
  } else {
    media?.addListener(handleChange);
  }

  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, handleChange);
    window.removeEventListener("storage", handleChange);

    if (media?.removeEventListener) {
      media.removeEventListener("change", handleChange);
    } else {
      media?.removeListener(handleChange);
    }
  };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    applyCurrentTheme();
  }, []);

  return <>{children}</>;
}

export function useTheme(): ThemeContextValue {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );
  const resolvedTheme = useSyncExternalStore(
    subscribeToTheme,
    getResolvedThemeSnapshot,
    getServerResolvedThemeSnapshot,
  );

  const setTheme = useCallback((nextTheme: ThemePreference) => {
    try {
      if (nextTheme === "system") {
        window.localStorage.removeItem(THEME_STORAGE_KEY);
      } else {
        window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
      }
    } catch {
    }

    applyTheme(nextTheme);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }, []);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [resolvedTheme, setTheme, theme],
  );

  return value;
}
