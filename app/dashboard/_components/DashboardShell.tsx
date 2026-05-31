"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import {
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  ChevronDown,
  FileText,
  HelpCircle,
  Lock,
  LogOut,
  Receipt,
  Search,
  Settings,
  Shield,
  Users,
  X,
  KeyRound,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { PlanProvider, usePlan, PLAN_LABELS, PLAN_COLORS, type Feature } from "@/lib/plan";

type NavItem = {
  label: string;
  href: string;
  icon: typeof FileText;
  feature: Feature;
  description: string;
};

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Main",
    items: [
      { label: "Invoices", href: "/dashboard", icon: FileText, feature: "invoices", description: "Create & track invoices" },
      { label: "Clients", href: "/dashboard/clients", icon: Users, feature: "clients", description: "Manage client records" },
      { label: "Reminders", href: "/dashboard/reminders", icon: Bell, feature: "reminders", description: "Payment follow-ups" },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Reports & Analytics", href: "/dashboard/reports", icon: BarChart3, feature: "reports", description: "Revenue & cash flow" },
      { label: "Invoice Ledger", href: "/dashboard/ledger", icon: BookOpen, feature: "ledger", description: "Full invoice history" },
    ],
  },
  {
    label: "Compliance",
    items: [
      { label: "VAT & NamRA", href: "/dashboard/vat", icon: Shield, feature: "vat", description: "Tax & e-invoicing" },
    ],
  },
];

function ShellInner({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { signOut } = useAuthActions();
  const user = useQuery(api.users.current);
  const workspace = useQuery(api.invoices.workspace);
  const { plan, daysLeftInTrial, applyCode, canAccess } = usePlan();

  const [showCodeInput, setShowCodeInput] = useState(false);
  const [codeValue, setCodeValue] = useState("");
  const [codeError, setCodeError] = useState(false);
  const [codeSuccess, setCodeSuccess] = useState(false);
  const [showWorkspaceDrop, setShowWorkspaceDrop] = useState(false);

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  function handleApplyCode() {
    const ok = applyCode(codeValue);
    if (ok) {
      setCodeSuccess(true);
      setCodeError(false);
      setTimeout(() => { setShowCodeInput(false); setCodeSuccess(false); setCodeValue(""); }, 1500);
    } else {
      setCodeError(true);
      setCodeSuccess(false);
    }
  }

  const planColor = PLAN_COLORS[plan];
  const planLabel = PLAN_LABELS[plan];

  return (
    <main className="db-root">
      {/* ── Sidebar ── */}
      <aside className="db-sidebar">

        {/* Logo */}
        <div className="db-sidebar-logo">
          <img src="/payvio-logo.svg" alt="Payvio" className="db-logo-img" />
        </div>

        {/* Workspace switcher */}
        <div className="db-workspace" onClick={() => setShowWorkspaceDrop(!showWorkspaceDrop)}>
          <span className="db-workspace-avatar" style={{ background: planColor }}>
            {(workspace?.name ?? user?.email ?? "P").slice(0, 1).toUpperCase()}
          </span>
          <div className="db-workspace-info">
            <p className="db-workspace-name">{workspace?.name ?? "Payvio workspace"}</p>
            <p className="db-workspace-email">{user?.email ?? "Loading..."}</p>
          </div>
          <ChevronDown className="db-workspace-chevron" />
        </div>

        {/* Plan badge */}
        <div className="db-plan-badge" style={{ borderColor: planColor + "33", background: planColor + "11", color: planColor }}>
          {plan === "trial" && daysLeftInTrial !== null ? (
            <span>🕐 {daysLeftInTrial} days left in trial</span>
          ) : (
            <span>{planLabel}</span>
          )}
        </div>

        {/* Nav groups */}
        <nav className="db-nav">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="db-nav-group">
              <p className="db-nav-group-label">{group.label}</p>
              {group.items.map((item) => {
                const locked = !canAccess(item.feature);
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    href={locked ? "#" : item.href}
                    onClick={locked ? (e) => e.preventDefault() : undefined}
                    className={cn(
                      "db-nav-item",
                      active && "db-nav-item-active",
                      locked && "db-nav-item-locked",
                    )}
                    title={locked ? `Upgrade to access ${item.label}` : item.description}
                  >
                    <Icon className="db-nav-icon" />
                    <span className="db-nav-label">{item.label}</span>
                    {locked && <Lock className="db-nav-lock" />}
                  </Link>
                );
              })}
            </div>
          ))}

          {/* Settings always visible */}
          <div className="db-nav-group">
            <p className="db-nav-group-label">Account</p>
            <Link
              href="/dashboard/settings"
              className={cn("db-nav-item", pathname === "/dashboard/settings" && "db-nav-item-active")}
            >
              <Settings className="db-nav-icon" />
              <span className="db-nav-label">Settings</span>
            </Link>
            <a href="#" className="db-nav-item" onClick={(e) => { e.preventDefault(); handleSignOut(); }}>
              <LogOut className="db-nav-icon" />
              <span className="db-nav-label">Sign out</span>
            </a>
          </div>
        </nav>

        {/* Access code entry */}
        <div className="db-code-section">
          {!showCodeInput ? (
            <button className="db-code-btn" onClick={() => setShowCodeInput(true)}>
              <KeyRound className="size-3.5" />
              Enter access code
            </button>
          ) : (
            <div className="db-code-form">
              <div className="db-code-input-row">
                <input
                  className={cn("db-code-input", codeError && "db-code-input-error")}
                  placeholder="e.g. XXXX-0000"
                  value={codeValue}
                  onChange={(e) => { setCodeValue(e.target.value); setCodeError(false); }}
                  onKeyDown={(e) => e.key === "Enter" && handleApplyCode()}
                  autoFocus
                />
                <button className="db-code-apply" onClick={handleApplyCode}>Apply</button>
                <button className="db-code-close" onClick={() => { setShowCodeInput(false); setCodeError(false); setCodeValue(""); }}>
                  <X className="size-3" />
                </button>
              </div>
              {codeError && (
                <p className="db-code-msg db-code-msg-error">
                  <AlertCircle className="size-3" /> Invalid code
                </p>
              )}
              {codeSuccess && (
                <p className="db-code-msg db-code-msg-success">
                  <CheckCircle2 className="size-3" /> Access granted!
                </p>
              )}
            </div>
          )}
        </div>

        {/* Help */}
        <a href="#" className="db-help-link">
          <HelpCircle className="size-3.5" />
          Help & Support
        </a>
      </aside>

      {/* ── Main content ── */}
      <div className="db-main">
        {/* Top bar */}
        <div className="db-topbar">
          <div className="db-topbar-left">
            <Building2 className="size-4 text-[#9ca3af]" />
            <span className="db-topbar-workspace">{workspace?.name ?? "Payvio"}</span>
          </div>
          <div className="db-topbar-center">
            <div className="db-search">
              <Search className="db-search-icon" />
              <input className="db-search-input" placeholder="Search invoices, clients..." />
            </div>
          </div>
          <div className="db-topbar-right">
            <button className="db-topbar-btn" title="Notifications">
              <Bell className="size-4" />
            </button>
            <a href="#" className="db-topbar-support">
              <HelpCircle className="size-4" />
              Support
            </a>
          </div>
        </div>

        {/* Page content */}
        <div className="db-content">
          {children}
        </div>
      </div>
    </main>
  );
}

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <PlanProvider>
      <ShellInner>{children}</ShellInner>
    </PlanProvider>
  );
}

/* ── Locked page overlay (used by feature pages) ── */
export function LockedPage({ feature, requiredPlan }: { feature: string; requiredPlan: string }) {
  return (
    <div className="db-locked-page">
      <div className="db-locked-card">
        <div className="db-locked-icon">
          <Lock className="size-8 text-[#9ca3af]" />
        </div>
        <h2>Upgrade to access {feature}</h2>
        <p>This feature is available on the <strong>{requiredPlan}</strong> plan and above.</p>
        <Link href="/#pricing" className="db-locked-cta">View Plans & Pricing</Link>
      </div>
    </div>
  );
}
