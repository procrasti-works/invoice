"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

/* Payvio's own Mint dark-mode toggle. Stores the choice in localStorage and
   toggles `html.pv-dark`. Pairs with the inline bootstrap in layout.tsx that
   applies the class before first paint (no flash). Self-contained — no
   external theme provider. */

export const PV_THEME_KEY = "payvio.pv-theme";

function currentIsDark(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("pv-dark");
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setDark(currentIsDark());
    setMounted(true);
  }, []);

  const toggle = () => {
    const next = !document.documentElement.classList.contains("pv-dark");
    document.documentElement.classList.toggle("pv-dark", next);
    try {
      localStorage.setItem(PV_THEME_KEY, next ? "dark" : "light");
    } catch {
      // storage unavailable (private mode) — the class still applies this session
    }
    setDark(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className={`pv-theme-toggle ${className}`}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      aria-pressed={mounted ? dark : undefined}
      title={dark ? "Light" : "Dark"}
    >
      {dark ? (
        <Sun aria-hidden="true" className="size-4" strokeWidth={1.8} />
      ) : (
        <Moon aria-hidden="true" className="size-4" strokeWidth={1.8} />
      )}
    </button>
  );
}

/** Inline script string: applies the saved theme before paint to avoid a flash. */
export const pvThemeBootstrap = `(function(){try{var t=localStorage.getItem("${PV_THEME_KEY}");if(t==="dark"){document.documentElement.classList.add("pv-dark");}}catch(e){}})();`;
