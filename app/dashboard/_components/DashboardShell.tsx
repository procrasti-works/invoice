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
        <main className="internal-app min-h-dvh bg-[#f3f3f1] p-2 text-[#050505] sm:p-4">
      <div className="grid min-h-[calc(100dvh-1rem)] gap-3 lg:grid-cols-[228px_minmax(0,1fr)] lg:min-h-[calc(100dvh-2rem)]">
        <aside className="flex min-w-0 flex-col bg-[#f7f7f5] px-2 py-2 lg:h-[calc(100dvh-2rem)]">
          <Link
            href="/dashboard"
            className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-[#efefec]"
          >
            <img src="/payvio-logo.png" alt="Payvio" className="h-12 w-auto" />
          </Link>

          <nav className="mt-7 grid gap-2" aria-label="Invoice workspace">
            {navItems.map((item) => {
              const isActive =
                pathname === "/dashboard" && activeSection === item.sectionId;
              const Icon = item.icon;

              return (
                <Link
                  key={item.label}
                  className={cn(
                    "flex min-h-[45px] w-full items-center gap-3 rounded-lg px-2.5 text-[16px] font-semibold text-black transition-colors hover:bg-[#efefec]",
                    isActive &&
                      "bg-[#efefec] text-[#050505] hover:bg-[#efefec]",
                  )}
                  href={item.href}
                  onClick={() => setActiveSection(item.sectionId)}
                >
                  <span
                    className={cn(
                      "flex size-[30px] shrink-0 items-center justify-center rounded-[9px]",
                      item.tone,
                    )}
                  >
                    <Icon className="size-4 stroke-[1.9]" />
                  </span>
                  <span className="min-w-0 truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-7 grid gap-2 lg:mt-auto">
            <Link
              href="/dashboard#reminders"
              className="flex min-h-[45px] w-full items-center gap-3 rounded-lg px-2.5 text-[16px] font-semibold text-black transition-colors hover:bg-[#efefec]"
            >
              <span className="flex size-[30px] shrink-0 items-center justify-center rounded-[9px] bg-[#e3edf7] text-[#536272]">
                <CircleHelp className="size-4 stroke-[1.9]" />
              </span>
              <span className="min-w-0 truncate">Help</span>
            </Link>
            <Link
              href={settingsItem.href}
              className={cn(
                "flex min-h-[45px] w-full items-center gap-3 rounded-lg px-2.5 text-[16px] font-semibold text-black transition-colors hover:bg-[#efefec]",
                pathname === settingsItem.href &&
                  "bg-[#efefec] text-[#050505] hover:bg-[#efefec]",
              )}
            >
              <span
                className={cn(
                  "flex size-[30px] shrink-0 items-center justify-center rounded-[9px]",
                  settingsItem.tone,
                )}
              >
                <SettingsIcon className="size-4 stroke-[1.9]" />
              </span>
              <span className="min-w-0 truncate">{settingsItem.label}</span>
            </Link>

            <Separator className="my-4 bg-[#e8e8e4]" />
            <div className="hidden lg:block">
              <div className="flex min-w-0 items-center gap-3 px-2 py-2">
                <span className="size-9 shrink-0 rounded-lg bg-[#050505]" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#050505]">
                    {workspace?.name ?? "Invoice workspace"}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-[#686b70]">
                    {user?.email ?? "Loading account"}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                className="mt-2 h-9 w-full justify-start rounded-lg px-2.5 text-sm font-semibold text-[#505258] hover:bg-[#efefec] hover:text-[#050505]"
                size="sm"
                onClick={handleSignOut}
              >
                <LogOut />
                Sign out
              </Button>
            </div>
          </div>
        </aside>

        <section className="min-w-0 overflow-hidden rounded-[18px] bg-[#f5f5f3]">
          {children}
        </section>
      </div>
    </main>
  );
}
