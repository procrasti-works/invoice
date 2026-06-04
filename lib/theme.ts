export const THEME_STORAGE_KEY = "payvio.theme";

export const themePreferences = ["system", "light", "dark"] as const;

export type ThemePreference = (typeof themePreferences)[number];
export type ResolvedTheme = Exclude<ThemePreference, "system">;

export const themeBootstrapScript = `
(function() {
  try {
    var stored = window.localStorage.getItem("${THEME_STORAGE_KEY}");
    var theme = stored === "light" || stored === "dark" ? stored : "system";
    var systemDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    var resolved = theme === "dark" || (theme === "system" && systemDark) ? "dark" : "light";
    var root = document.documentElement;
    root.classList.toggle("dark", resolved === "dark");
    root.dataset.theme = theme;
    root.dataset.resolvedTheme = resolved;
    root.style.colorScheme = resolved;
  } catch (error) {
  }
})();
`;
