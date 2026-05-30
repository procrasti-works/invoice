"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import {
  Bell,
  FileText,
  LogOut,
  CircleHelp,
  ReceiptText,
  Settings,
  Users,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";

const navItems = [
  {
    label: "Invoices",
    href: "/dashboard#invoices",
    sectionId: "invoices",
    icon: FileText,
    tone: "bg-[#a8b4ff] text-[#3042a6]",
  },
  {
    label: "Clients",
    href: "/dashboard#clients",
    sectionId: "clients",
    icon: Users,
    tone: "bg-[#5ce0a5] text-[#006b4a]",
  },
  {
    label: "Reminders",
    href: "/dashboard#reminders",
    sectionId: "reminders",
    icon: Bell,
    tone: "bg-[#ffd13a] text-[#876600]",
  },
] as const;

type DashboardSectionId = (typeof navItems)[number]["sectionId"];

function isDashboardSectionId(value: string): value is DashboardSectionId {
  return navItems.some((item) => item.sectionId === value);
}

const settingsItem = {
  label: "Settings",
  href: "/dashboard/settings",
  icon: Settings,
  tone: "bg-[#c49aff] text-[#6833b0]",
};

export function DashboardShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [activeSection, setActiveSection] =
    useState<DashboardSectionId>("invoices");
  const { signOut } = useAuthActions();
  const user = useQuery(api.users.current);
  const workspace = useQuery(api.invoices.workspace);
  const SettingsIcon = settingsItem.icon;

  useEffect(() => {
    if (pathname !== "/dashboard") {
      return;
    }

    function syncActiveSection() {
      const hash = window.location.hash.slice(1);
      setActiveSection(isDashboardSectionId(hash) ? hash : "invoices");
    }

    syncActiveSection();
    window.addEventListener("hashchange", syncActiveSection);

    return () => window.removeEventListener("hashchange", syncActiveSection);
  }, [pathname]);

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  return (
    <main className="internal-app min-h-dvh bg-[#f0f5fb] p-2 text-[#050505] sm:p-4">
      <div className="grid min-h-[calc(100dvh-1rem)] gap-3 lg:grid-cols-[240px_minmax(0,1fr)] lg:min-h-[calc(100dvh-2rem)]">

        {/* ── Sidebar ── */}
        <aside className="flex min-w-0 flex-col rounded-2xl bg-[#0b1d3a] px-3 py-4 shadow-lg lg:h-[calc(100dvh-2rem)]">

          {/* Logo */}
          <Link
            href="/dashboard"
            className="flex min-w-0 items-center gap-2 rounded-xl px-2 py-2 transition-colors hover:bg-white/10"
          >
            <img
              src="/payvio-logo.svg"
              alt="Payvio"
              style={{ height: "51px" }}
              className="w-auto"
            />
          </Link>

          {/* Nav label */}
          <p className="mt-8 px-3 text-[11px] font-bold uppercase tracking-widest text-white/50">
            Menu
          </p>

          {/* Main nav */}
          <nav className="mt-2 grid gap-1" aria-label="Invoice workspace">
            {navItems.map((item) => {
              const isActive =
                pathname === "/dashboard" && activeSection === item.sectionId;
              const Icon = item.icon;

              return (
                <Link
                  key={item.label}
                  className={cn(
                    "flex min-h-[46px] w-full items-center gap-3 rounded-xl px-3 text-[15px] font-semibold text-white/80 transition-all hover:bg-white/10 hover:text-white",
                    isActive && "bg-white/15 text-white shadow-sm ring-1 ring-white/20 hover:bg-white/10 hover:text-white",
                  )}
                  href={item.href}
                  onClick={() => setActiveSection(item.sectionId)}
                >
                  <span
                    className={cn(
                      "flex size-[30px] shrink-0 items-center justify-center rounded-[9px]",
                      isActive ? item.tone : "bg-white/15 text-white",
                    )}
                  >
                    <Icon className="size-4 stroke-[1.9]" />
                  </span>
                  <span className="min-w-0 truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Bottom section */}
          <div className="mt-auto grid gap-1">
            <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-widest text-white/50">
              Support
            </p>

            <Link
              href="/dashboard#reminders"
              className="flex min-h-[46px] w-full items-center gap-3 rounded-xl px-3 text-[15px] font-semibold text-white/80 transition-all hover:bg-white/10 hover:text-white"
            >
              <span className="flex size-[30px] shrink-0 items-center justify-center rounded-[9px] bg-white/15 text-white">
                <CircleHelp className="size-4 stroke-[1.9]" />
              </span>
              <span className="min-w-0 truncate">Help</span>
            </Link>

            <Link
              href={settingsItem.href}
              className={cn(
                "flex min-h-[46px] w-full items-center gap-3 rounded-xl px-3 text-[15px] font-semibold text-white/80 transition-all hover:bg-white/10 hover:text-white",
                pathname === settingsItem.href &&
                  "bg-white/15 text-white shadow-sm ring-1 ring-white/20 hover:bg-white/10 hover:text-white",
              )}
            >
              <span
                className={cn(
                  "flex size-[30px] shrink-0 items-center justify-center rounded-[9px]",
                  pathname === settingsItem.href ? settingsItem.tone : "bg-white/15 text-white",
                )}
              >
                <SettingsIcon className="size-4 stroke-[1.9]" />
              </span>
              <span className="min-w-0 truncate">{settingsItem.label}</span>
            </Link>

            <Separator className="my-3 bg-white/15" />

            {/* User profile */}
            <div className="hidden lg:block">
              <div className="flex min-w-0 items-center gap-3 rounded-xl px-3 py-2">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/15 text-sm font-bold text-white">
                  {(workspace?.name ?? user?.email ?? "P").slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">
                    {workspace?.name ?? "Payvio workspace"}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-white/60">
                    {user?.email ?? "Loading account"}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                className="mt-1 h-9 w-full justify-start rounded-xl px-3 text-sm font-semibold text-white/70 hover:bg-white/10 hover:text-white"
                size="sm"
                onClick={handleSignOut}
              >
                <LogOut className="size-4" />
                Sign out
              </Button>
            </div>
          </div>
        </aside>

        {/* ── Main content ── */}
        <section className="min-w-0 overflow-hidden rounded-2xl bg-white shadow-sm">
          {children}
        </section>
      </div>
    </main>
  );
}
