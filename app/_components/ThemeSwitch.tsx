"use client";

import type { ComponentType } from "react";

import { Monitor, Moon, Sun } from "@/app/_components/IconPack";
import { useTheme } from "@/app/_components/ThemeProvider";
import { cn } from "@/lib/utils";
import type { ThemePreference } from "@/lib/theme";

const themeOptions: Array<{
  value: ThemePreference;
  label: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

export function ThemeSegmentedControl({
  className,
  buttonClassName,
  iconOnly = false,
}: {
  className?: string;
  buttonClassName?: string;
  iconOnly?: boolean;
}) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn("grid grid-cols-3 gap-1 rounded-lg bg-muted p-1", className)}
    >
      {themeOptions.map((option) => {
        const Icon = option.icon;
        const active = theme === option.value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={option.label}
            title={option.label}
            className={cn(
              "inline-flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
              iconOnly && "h-10 px-0",
              active && "bg-background text-foreground shadow-sm",
              buttonClassName,
            )}
            onClick={() => setTheme(option.value)}
          >
            <Icon className="size-4 shrink-0" />
            <span className={cn("truncate", iconOnly && "sr-only")}>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function useThemeLabel() {
  const { theme, resolvedTheme } = useTheme();

  if (theme === "system") {
    return `System (${resolvedTheme})`;
  }

  return theme === "dark" ? "Dark" : "Light";
}
