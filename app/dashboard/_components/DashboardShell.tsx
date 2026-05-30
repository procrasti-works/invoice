"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import {
  BarChart3,
  Building2,
  CircleDollarSign,
  FileSignature,
  FileText,
  HelpCircle,
  Inbox,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  Plus,
  ReceiptText,
  Search,
  Settings,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";

const workspaceNav = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Invoices", href: "/dashboard#invoices", icon: FileText },
  { label: "eSign", href: "/dashboard#esign", icon: FileSignature },
  { label: "Clients", href: "/dashboard#clients", icon: Users },
  { label: "Collections", href: "/dashboard#collections", icon: CircleDollarSign },
  { label: "Analytics", href: "/dashboard#analytics", icon: BarChart3 },
];

const documentNav = [
  { label: "Approval library", href: "/dashboard#approvals", icon: Inbox },
  { label: "Reports", href: "/dashboard#reports", icon: ReceiptText },
  { label: "Company", href: "/dashboard#company", icon: Building2 },
  { label: "More", href: "/dashboard#more", icon: MoreHorizontal },
];

const supportNav = [
  { label: "Settings", href: "/dashboard#settings", icon: Settings },
  { label: "Get help", href: "/dashboard#help", icon: HelpCircle },
  { label: "Search", href: "/dashboard#search", icon: Search },
];

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuthActions();
  const user = useQuery(api.users.current);

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  return (
    <main className="min-h-dvh bg-white p-2 text-[#151515]">
      <div className="grid min-h-[calc(100dvh-1rem)] overflow-hidden rounded-lg border border-[#dfe6e3] bg-white shadow-[0_20px_60px_rgb(17_17_17_/_0.08)] lg:grid-cols-[242px_minmax(0,1fr)]">
        <aside className="flex min-w-0 flex-col border-b border-[#dfe6e3] bg-[#f7faf9] p-3 lg:h-[calc(100dvh-1rem)] lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-3 px-2 py-2">
            <Link href="/dashboard" className="flex min-w-0 items-center gap-2">
              <img
                src="/payvio-logo.png"
                alt="Payvio"
                className="h-8 w-auto shrink-0"
              />
            </Link>
            <Link
              href="/"
              className="flex size-8 shrink-0 items-center justify-center rounded-md border border-[#dfe6e3] bg-white text-[#4a5653] transition-colors hover:bg-[#ccfbf2] hover:text-[#052b26]"
              aria-label="Open Payvio landing page"
            >
              <MoreHorizontal className="size-4" />
            </Link>
          </div>

          <Button
            asChild
            size="sm"
            className="mt-3 h-8 justify-start rounded-md bg-[#08dfc2] text-[#001f1b] hover:bg-[#111] hover:text-white"
          >
            <Link href="/dashboard#quick-create">
              <Plus />
              Quick Create
            </Link>
          </Button>

          <nav className="mt-3 grid gap-1" aria-label="Workspace navigation">
            {workspaceNav.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Button
                  key={item.label}
                  asChild
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-8 justify-start rounded-md border border-transparent px-2 text-xs font-semibold text-[#4a5653] hover:bg-white hover:text-[#151515]",
                    isActive &&
                      "border-[#dfe6e3] bg-white text-[#151515] shadow-sm",
                  )}
                >
                  <Link href={item.href}>
                    <item.icon />
                    {item.label}
                  </Link>
                </Button>
              );
            })}
          </nav>

          <p className="mb-2 mt-8 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7a8683]">
            Documents
          </p>
          <nav className="grid gap-1" aria-label="Document navigation">
            {documentNav.map((item) => (
              <Button
                key={item.label}
                asChild
                variant="ghost"
                size="sm"
                className="h-8 justify-start rounded-md px-2 text-xs font-semibold text-[#4a5653] hover:bg-white hover:text-[#151515]"
              >
                <Link href={item.href}>
                  <item.icon />
                  {item.label}
                </Link>
              </Button>
            ))}
          </nav>

          <div className="mt-auto hidden lg:block">
            <nav className="grid gap-1" aria-label="Support navigation">
              {supportNav.map((item) => (
                <Button
                  key={item.label}
                  asChild
                  variant="ghost"
                  size="sm"
                  className="h-8 justify-start rounded-md px-2 text-xs font-semibold text-[#4a5653] hover:bg-white hover:text-[#151515]"
                >
                  <Link href={item.href}>
                    <item.icon />
                    {item.label}
                  </Link>
                </Button>
              ))}
            </nav>

            <Separator className="my-4 bg-[#dfe6e3]" />

            <div className="flex items-center gap-3 px-2 py-2">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#08dfc2] text-sm font-bold text-black">
                {user?.name?.slice(0, 1).toUpperCase() ??
                  user?.email?.slice(0, 1).toUpperCase() ??
                  "I"}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-[#151515]">
                  {user?.name ?? "Invoice user"}
                </p>
                <p className="truncate text-[11px] text-[#64736f]">
                  {user?.email ?? "Loading account"}
                </p>
              </div>
            </div>

            <Button
              variant="ghost"
              className="mt-1 h-8 w-full justify-start rounded-md px-2 text-xs font-semibold text-[#4a5653] hover:bg-white hover:text-[#151515]"
              size="sm"
              onClick={handleSignOut}
            >
              <LogOut />
              Sign out
            </Button>
          </div>
        </aside>

        <section className="min-w-0 overflow-hidden bg-white">
          {children}
        </section>
      </div>
    </main>
  );
}
