"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import {
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  ChevronDown,
  Check,
  Circle,
  FileText,
  HelpCircle,
  Inbox,
  Link2,
  Loader2,
  Lock,
  LogOut,
  MoreHorizontal,
  Plus,
  ScanLine,
  Search,
  Settings,
  Shield,
  Star,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { PlanProvider, usePlan, PLAN_LABELS, type Feature } from "@/lib/plan";
import { DashboardWarmup } from "./DashboardWarmup";

type NavItem = {
  label: string;
  href: string;
  icon: typeof FileText;
  feature: Feature;
  description: string;
  key: string;
};

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Billing",
    items: [
      {
        label: "Invoices",
        href: "/dashboard",
        icon: Inbox,
        feature: "invoices",
        description: "Create, send, and close client invoices",
        key: "PV-0101",
      },
      {
        label: "Clients",
        href: "/dashboard/clients",
        icon: Users,
        feature: "clients",
        description: "Keep client billing profiles ready",
        key: "PV-0102",
      },
      {
        label: "Reminders",
        href: "/dashboard/reminders",
        icon: Bell,
        feature: "reminders",
        description: "Follow up on sent and overdue invoices",
        key: "PV-0103",
      },
    ],
  },
  {
    label: "Accounting",
    items: [
      {
        label: "Reports",
        href: "/dashboard/reports",
        icon: BarChart3,
        feature: "reports",
        description: "Revenue, cash flow, and VAT position",
        key: "PV-0201",
      },
      {
        label: "Ledger",
        href: "/dashboard/ledger",
        icon: BookOpen,
        feature: "ledger",
        description: "Issued invoice and supplier records",
        key: "PV-0202",
      },
      {
        label: "Scan",
        href: "/dashboard/scan",
        icon: ScanLine,
        feature: "scan",
        description: "Capture supplier invoices and purchase records",
        key: "PV-0203",
      },
      {
        label: "VAT",
        href: "/dashboard/vat",
        icon: Shield,
        feature: "vat",
        description: "VAT-ready settings and records",
        key: "PV-0204",
      },
    ],
  },
];

const SETTINGS_ITEM: NavItem = {
  label: "Settings",
  href: "/dashboard/settings",
  icon: Settings,
  feature: "settings",
  description: "Business profile, bank details, and team access",
  key: "PV-0301",
};

const ALL_NAV_ITEMS = [...NAV_GROUPS.flatMap((group) => group.items), SETTINGS_ITEM];

function PayvioGlyph() {
  return <Image src="/payvio-logo.svg" alt="Payvio" width={100} height={40} style={{ objectFit: "contain" }} />;
}

function ShellInner({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { signOut } = useAuthActions();
  const user = useQuery(api.users.current);
  const workspace = useQuery(api.invoices.workspace);
  const switcherState = useQuery(api.organizations.switcherState);
  const switchOrganization = useMutation(api.organizations.switchOrganization);
  const acceptInvitation = useMutation(api.organizations.acceptInvitationById);
  const { plan, daysLeftInTrial, canAccess } = usePlan();
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [workspaceMenuError, setWorkspaceMenuError] = useState("");
  const [switchingOrganizationId, setSwitchingOrganizationId] =
    useState<Id<"organizations"> | null>(null);
  const [joiningInvitationId, setJoiningInvitationId] =
    useState<Id<"organizationInvitations"> | null>(null);
  const warmupRoutes = useMemo(
    () => ALL_NAV_ITEMS.filter((item) => canAccess(item.feature)).map((item) => item.href),
    [canAccess],
  );

  useEffect(() => {
    if (workspace === null) {
      const next = pathname && pathname.startsWith("/dashboard") ? pathname : "/dashboard";
      router.replace(`/onboarding?next=${encodeURIComponent(next)}`);
    }
  }, [pathname, router, workspace]);

  if (workspace === undefined || user === undefined || workspace === null) {
    return (
      <main className="db-root db-root-loading">
        <div className="db-loading-card">
          <PayvioGlyph />
          <p>Loading Payvio workspace...</p>
        </div>
      </main>
    );
  }

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  async function handleSwitchOrganization(organizationId: Id<"organizations">) {
    if (organizationId === workspace?._id || switchingOrganizationId) {
      return;
    }

    setWorkspaceMenuError("");
    setSwitchingOrganizationId(organizationId);

    try {
      await switchOrganization({ organizationId });
      setWorkspaceMenuOpen(false);
    } catch (caught) {
      setWorkspaceMenuError(
        caught instanceof Error ? caught.message : "Unable to switch organization.",
      );
    } finally {
      setSwitchingOrganizationId(null);
    }
  }

  async function handleJoinInvitation(invitationId: Id<"organizationInvitations">) {
    setWorkspaceMenuError("");
    setJoiningInvitationId(invitationId);

    try {
      await acceptInvitation({ invitationId });
      setWorkspaceMenuOpen(false);
    } catch (caught) {
      setWorkspaceMenuError(
        caught instanceof Error ? caught.message : "Unable to join organization.",
      );
    } finally {
      setJoiningInvitationId(null);
    }
  }

  const planLabel = PLAN_LABELS[plan];
  const organizationOptions = switcherState?.organizations ?? [];
  const pendingInvitations = switcherState?.pendingInvitations ?? [];
  const createOrganizationHref = `/onboarding?mode=create&next=${encodeURIComponent(
    pathname && pathname.startsWith("/dashboard") ? pathname : "/dashboard",
  )}`;
  const activeItem =
    ALL_NAV_ITEMS.find((item) =>
      item.href === "/dashboard"
        ? pathname === item.href
        : pathname?.startsWith(item.href),
    ) ?? ALL_NAV_ITEMS[0];
  const workspaceInitial = (workspace?.name ?? user?.email ?? "P").slice(0, 1).toUpperCase();
  const trialCopy =
    plan === "trial" && daysLeftInTrial !== null
      ? `${daysLeftInTrial} days left`
      : planLabel;

  function prefetchRoute(href: string) {
    if (href !== pathname) {
      router.prefetch(href);
    }
  }

  return (
    <main className="db-root">
      <DashboardWarmup routes={warmupRoutes} />
      <aside className="db-sidebar">
        <div className="db-sidebar-top">
          <Link
            href="/dashboard"
            className="db-brand"
            aria-label="Payvio dashboard"
            onFocus={() => prefetchRoute("/dashboard")}
            onPointerEnter={() => prefetchRoute("/dashboard")}
          >
            <PayvioGlyph />
            <span>Payvio</span>
          </Link>
          <div className="db-sidebar-actions">
            <button type="button" aria-label="Search">
              <Search className="size-4" />
            </button>
            <Link
              href="/dashboard#new-invoice"
              aria-label="New invoice"
              onFocus={() => prefetchRoute("/dashboard")}
              onPointerEnter={() => prefetchRoute("/dashboard")}
            >
              <FileText className="size-4" />
            </Link>
          </div>
        </div>

        <div className="db-workspace-wrap">
          <button
            type="button"
            className="db-workspace"
            aria-expanded={workspaceMenuOpen}
            onClick={() => setWorkspaceMenuOpen((open) => !open)}
          >
            <span className="db-workspace-avatar">{workspaceInitial}</span>
            <span className="db-workspace-info">
              <span className="db-workspace-name">{workspace?.name ?? "Payvio workspace"}</span>
              <span className="db-workspace-email">{user?.email ?? "Loading..."}</span>
            </span>
            <ChevronDown className="db-workspace-chevron" />
          </button>

              {workspaceMenuOpen ? (
            <div className="db-workspace-menu">
              <div className="db-workspace-menu-meta">
                <span>{trialCopy}</span>
                <strong>{workspace?.defaultCurrency ?? "NAD"}</strong>
              </div>

              <div className="db-workspace-menu-section">
                <p className="db-workspace-menu-label">Organizations</p>
                {switcherState === undefined ? (
                  <span className="db-workspace-menu-empty">Loading organizations...</span>
                ) : organizationOptions.length > 0 ? (
                  organizationOptions.map((item) => {
                    const organization = item.organization;
                    const isActive = item.active;
                    const isSwitching = switchingOrganizationId === organization._id;

                    return (
                      <button
                        key={organization._id}
                        type="button"
                        className={cn(
                          "db-workspace-option",
                          isActive && "db-workspace-option-active",
                        )}
                        disabled={isActive || isSwitching}
                        onClick={() => handleSwitchOrganization(organization._id)}
                      >
                        <span className="db-workspace-option-avatar">
                          {organization.name.slice(0, 1).toUpperCase()}
                        </span>
                        <span className="db-workspace-option-main">
                          <span>{organization.name}</span>
                          <small>{item.membership.role}</small>
                        </span>
                        {isSwitching ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : isActive ? (
                          <Check className="size-4" />
                        ) : null}
                      </button>
                    );
                  })
                ) : (
                  <span className="db-workspace-menu-empty">No organizations yet.</span>
                )}
              </div>

              {pendingInvitations.length > 0 ? (
                <div className="db-workspace-menu-section">
                  <p className="db-workspace-menu-label">Invites</p>
                  {pendingInvitations.map((invitation) => {
                    const isJoining = joiningInvitationId === invitation._id;
                    return (
                      <button
                        key={invitation._id}
                        type="button"
                        className="db-workspace-invite"
                        disabled={invitation.expired || isJoining}
                        onClick={() => handleJoinInvitation(invitation._id)}
                      >
                        <span>
                          <strong>{invitation.organizationName}</strong>
                          <small>{invitation.role}</small>
                        </span>
                        {isJoining ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <span>{invitation.expired ? "Expired" : "Join"}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {workspaceMenuError ? (
                <p className="db-workspace-menu-error" role="alert">
                  {workspaceMenuError}
                </p>
              ) : null}

              <Link
                href={createOrganizationHref}
                className="db-workspace-menu-item"
                onClick={() => setWorkspaceMenuOpen(false)}
              >
                <Plus className="size-4" />
                New organization
              </Link>

              <Link
                href="/dashboard/settings"
                className="db-workspace-menu-item"
                onClick={() => setWorkspaceMenuOpen(false)}
                onFocus={() => prefetchRoute("/dashboard/settings")}
                onPointerEnter={() => prefetchRoute("/dashboard/settings")}
              >
                <Settings className="size-4" />
                Settings
              </Link>
              <button type="button" className="db-workspace-menu-item" onClick={handleSignOut}>
                <LogOut className="size-4" />
                Sign out
              </button>
            </div>
          ) : null}
        </div>

        <nav className="db-nav">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="db-nav-group">
              <p className="db-nav-group-label">{group.label}</p>
              {group.items.map((item) => {
                const locked = !canAccess(item.feature);
                const active =
                  item.href === "/dashboard"
                    ? pathname === item.href
                    : pathname?.startsWith(item.href);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.label}
                    href={locked ? "#" : item.href}
                    onClick={locked ? (event) => event.preventDefault() : undefined}
                    onFocus={() => {
                      if (!locked) {
                        prefetchRoute(item.href);
                      }
                    }}
                    onPointerEnter={() => {
                      if (!locked) {
                        prefetchRoute(item.href);
                      }
                    }}
                    className={cn(
                      "db-nav-item",
                      active && "db-nav-item-active",
                      locked && "db-nav-item-locked",
                    )}
                    title={locked ? `Upgrade to access ${item.label}` : item.description}
                  >
                    <Icon className="db-nav-icon" />
                    <span className="db-nav-label">{item.label}</span>
                    <span className="db-nav-key">{item.key.replace("PV-", "")}</span>
                    {locked && <Lock className="db-nav-lock" />}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="db-sidebar-footer">
          <a href="#" className="db-help-link">
            <HelpCircle className="size-3.5" />
            Support
          </a>
        </div>
      </aside>

      <div className="db-main">
        <header className="db-topbar">
          <div className="db-topbar-left">
            <span className="db-topbar-title">{activeItem.label}</span>
            <Star className="db-star" />
            <MoreHorizontal className="size-4" />
          </div>
          <div className="db-topbar-right">
            <button className="db-topbar-btn" title="Copy page link">
              <Link2 className="size-4" />
            </button>
            <button className="db-topbar-btn" title="Notifications">
              <Bell className="size-4" />
            </button>
          </div>
        </header>

        <div className="db-content">{children}</div>
      </div>

      <aside className="db-inspector">
        <div className="db-inspector-toolbar">
          <button type="button" aria-label="Page links">
            <Link2 className="size-4" />
          </button>
          <button type="button" aria-label="More">
            <MoreHorizontal className="size-4" />
          </button>
        </div>

        <div className="db-inspector-section">
          <div className="db-inspector-row">
            <span>Status</span>
            <strong>
              <Circle className="size-3" /> In progress
            </strong>
          </div>
          <div className="db-inspector-row">
            <span>Priority</span>
            <strong>High</strong>
          </div>
          <div className="db-inspector-row">
            <span>Owner</span>
            <strong>{user?.email ?? "Payvio user"}</strong>
          </div>
          <div className="db-inspector-row">
            <span>Plan</span>
            <strong>{planLabel}</strong>
          </div>
          <div className="db-inspector-row">
            <span>Currency</span>
            <strong>{workspace?.defaultCurrency ?? "NAD"}</strong>
          </div>
        </div>

        <div className="db-inspector-section">
          <p className="db-inspector-label">Page</p>
          <div className="db-agent-card">
            <div className="db-agent-title">
              <Building2 className="size-4" />
              {activeItem.label}
            </div>
            <p>{activeItem.description}</p>
            <span>Payvio workspace</span>
          </div>
        </div>

        <div className="db-inspector-section">
          <p className="db-inspector-label">Labels</p>
          <div className="db-label-list">
            <span>Client links</span>
            <span>VAT-ready</span>
            <span>Receivables</span>
          </div>
        </div>
      </aside>
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

export function LockedPage({
  feature,
  requiredPlan,
}: {
  feature: string;
  requiredPlan: string;
}) {
  return (
    <div className="db-locked-page">
      <div className="db-locked-card">
        <div className="db-locked-icon">
          <Lock className="size-8" />
        </div>
        <h2>Upgrade to access {feature}</h2>
        <p>This feature is available on the <strong>{requiredPlan}</strong> plan and above.</p>
        <Link href="/#pricing" className="db-locked-cta">View plans</Link>
      </div>
    </div>
  );
}
