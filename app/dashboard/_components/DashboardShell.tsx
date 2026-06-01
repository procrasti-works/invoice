"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  ChevronDown,
  Check,
  CheckCircle2,
  Circle,
  Clock,
  CreditCard,
  FileSearch,
  FileText,
  HelpCircle,
  Inbox,
  Link2,
  Loader2,
  Lock,
  LogOut,
  MoreHorizontal,
  Plus,
  Receipt,
  ReceiptText,
  ScanLine,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { PayvioMark } from "@/app/_components/PayvioMark";
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
        label: "Receipts",
        href: "/dashboard/receipts",
        icon: Receipt,
        feature: "scan",
        description: "Capture expense receipts and track VAT input automatically",
        key: "PV-0205",
      },
      {
        label: "VAT",
        href: "/dashboard/vat",
        icon: Shield,
        feature: "vat",
        description: "VAT returns, settings, and ITAS exports",
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

const SUPPORT_ITEM: NavItem = {
  label: "Support",
  href: "/dashboard/support",
  icon: HelpCircle,
  feature: "settings",
  description: "Help, contact details, and workspace administrators",
  key: "PV-0401",
};

const ALL_NAV_ITEMS = [
  ...NAV_GROUPS.flatMap((group) => group.items),
  SETTINGS_ITEM,
  SUPPORT_ITEM,
];
const MOBILE_NAV_ITEMS = ALL_NAV_ITEMS.filter((item) =>
  ["Invoices", "Reports", "Ledger", "Scan", "Settings"].includes(item.label),
);

const SEARCH_TYPE_LABELS: Record<string, string> = {
  invoice: "Invoice",
  client: "Client",
  purchase: "Purchase",
  supplier: "Supplier",
  scan: "Scan",
};

function searchIconFor(type: string): typeof FileText {
  switch (type) {
    case "client":
      return Users;
    case "purchase":
      return ReceiptText;
    case "supplier":
      return Building2;
    case "scan":
      return ScanLine;
    case "invoice":
      return FileText;
    default:
      return FileSearch;
  }
}

function notificationIconFor(type: string, tone: string): typeof Bell {
  if (type === "payment") {
    return CreditCard;
  }

  if (type === "overdue" || tone === "danger") {
    return AlertTriangle;
  }

  if (type === "reminder") {
    return Clock;
  }

  if (type === "scan") {
    return ScanLine;
  }

  if (tone === "success") {
    return CheckCircle2;
  }

  return Bell;
}

function formatNotificationTime(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(value);
}

function ShellInner({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { signOut } = useAuthActions();
  const user = useQuery(api.users.current);
  const workspace = useQuery(api.invoices.workspace);
  const switcherState = useQuery(api.organizations.switcherState);
  const notificationState = useQuery(api.dashboard.notifications);
  const switchOrganization = useMutation(api.organizations.switchOrganization);
  const acceptInvitation = useMutation(api.organizations.acceptInvitationById);
  const markNotificationsSeen = useMutation(api.dashboard.markNotificationsSeen);
  const { plan, daysLeftInTrial, canAccess } = usePlan();
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [workspaceMenuError, setWorkspaceMenuError] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [switchingOrganizationId, setSwitchingOrganizationId] =
    useState<Id<"organizations"> | null>(null);
  const [joiningInvitationId, setJoiningInvitationId] =
    useState<Id<"organizationInvitations"> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const searchQuery = searchTerm.trim();
  const searchState = useQuery(
    api.dashboard.globalSearch,
    searchOpen && searchQuery.length >= 2 ? { query: searchQuery } : "skip",
  );
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

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setNotificationsOpen(false);
        setSearchOpen(true);
      }

      if (event.key === "Escape") {
        setSearchOpen(false);
        setNotificationsOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!searchOpen) {
      return;
    }

    window.setTimeout(() => searchInputRef.current?.focus(), 0);
  }, [searchOpen]);

  useEffect(() => {
    if (!notificationsOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (
        target instanceof Node &&
        notificationsRef.current &&
        !notificationsRef.current.contains(target)
      ) {
        setNotificationsOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [notificationsOpen]);

  if (workspace === undefined || user === undefined || workspace === null) {
    return (
      <main className="db-root db-root-loading">
        <div className="db-loading-card">
          <PayvioMark className="db-payvio-loading-mark" />
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

  function openSearch() {
    setNotificationsOpen(false);
    setSearchOpen(true);
  }

  function handleNotificationsToggle() {
    setNotificationsOpen((open) => {
      const nextOpen = !open;

      if (nextOpen) {
        setSearchOpen(false);
        void markNotificationsSeen({}).catch(() => undefined);
      }

      return nextOpen;
    });
  }

  const planLabel = PLAN_LABELS[plan];
  const organizationOptions = switcherState?.organizations ?? [];
  const pendingInvitations = switcherState?.pendingInvitations ?? [];
  const searchResults = searchState?.results ?? [];
  const searchLoading = searchOpen && searchQuery.length >= 2 && searchState === undefined;
  const notificationItems = notificationState?.items ?? [];
  const unreadCount = notificationState?.unreadCount ?? 0;
  const visibleUnreadCount = unreadCount > 9 ? "9+" : String(unreadCount);
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
            <PayvioMark className="db-payvio-sidebar-mark" />
            <span className="db-brand-wordmark">Payvio</span>
          </Link>
          <div className="db-sidebar-actions">
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
          {user?.role === "admin" ? (
            <Link
              href="/admin"
              className="db-help-link"
              onFocus={() => prefetchRoute("/admin")}
              onPointerEnter={() => prefetchRoute("/admin")}
            >
              <ShieldCheck className="size-3.5" />
              Admin
            </Link>
          ) : null}
          <Link
            href="/dashboard/support"
            className={cn(
              "db-help-link",
              pathname?.startsWith("/dashboard/support") && "db-help-link-active",
            )}
            onFocus={() => prefetchRoute("/dashboard/support")}
            onPointerEnter={() => prefetchRoute("/dashboard/support")}
          >
            <HelpCircle className="size-3.5" />
            Support
          </Link>
        </div>
      </aside>

      <div className="db-main">
        <header className="db-topbar">
          <div className="db-topbar-left">
            <PayvioMark className="db-mobile-topbar-mark" aria-hidden="true" />
            <span className="db-topbar-title">{activeItem.label}</span>
          </div>
          <div className="db-topbar-center">
            <button
              type="button"
              className="db-global-search-trigger"
              aria-label={`Search ${workspace.name}`}
              aria-expanded={searchOpen}
              aria-haspopup="dialog"
              onClick={openSearch}
            >
              <Search className="size-4" />
              <span>Search {workspace.name}</span>
            </button>
          </div>
          <div className="db-topbar-right">
            <div className="db-topbar-action-wrap" ref={notificationsRef}>
              <button
                type="button"
                className={cn("db-topbar-btn", notificationsOpen && "db-topbar-btn-active")}
                title="Notifications"
                aria-label={unreadCount > 0 ? `${visibleUnreadCount} unread notifications` : "Notifications"}
                aria-expanded={notificationsOpen}
                aria-haspopup="dialog"
                onClick={handleNotificationsToggle}
              >
                <Bell className="size-4" />
                {unreadCount > 0 ? (
                  <span className="db-notification-badge">{visibleUnreadCount}</span>
                ) : null}
              </button>

              {notificationsOpen ? (
                <div className="db-notification-panel" role="dialog" aria-label="Notifications">
                  <div className="db-notification-header">
                    <span>{notificationState?.organizationName ?? workspace.name}</span>
                    <strong>{notificationItems.length}</strong>
                  </div>

                  <div className="db-notification-list">
                    {notificationState === undefined ? (
                      <div className="db-notification-empty">
                        <Loader2 className="size-4 animate-spin" />
                        Loading notifications
                      </div>
                    ) : notificationItems.length > 0 ? (
                      notificationItems.map((item) => {
                        const Icon = notificationIconFor(item.type, item.tone);

                        return (
                          <Link
                            key={item.id}
                            href={item.href}
                            className={cn(
                              "db-notification-item",
                              !item.read && "db-notification-item-unread",
                              `db-notification-item-${item.tone}`,
                            )}
                            onClick={() => setNotificationsOpen(false)}
                          >
                            <span className="db-notification-icon">
                              <Icon className="size-4" />
                            </span>
                            <span className="db-notification-main">
                              <span className="db-notification-title">{item.title}</span>
                              <span className="db-notification-body">{item.body}</span>
                              <span className="db-notification-meta">
                                {item.cta} - {formatNotificationTime(item.createdAt)}
                              </span>
                            </span>
                          </Link>
                        );
                      })
                    ) : (
                      <div className="db-notification-empty">No notifications</div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <div className="db-content">{children}</div>
      </div>

      {searchOpen ? (
        <div className="db-search-overlay" role="dialog" aria-modal="true" aria-label="Search">
          <button
            type="button"
            className="db-search-backdrop"
            aria-label="Close search"
            onClick={() => setSearchOpen(false)}
          />
          <section className="db-search-panel">
            <div className="db-search-panel-field">
              <Search className="db-search-panel-icon" />
              <input
                ref={searchInputRef}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={`Search ${workspace.name}`}
                className="db-search-panel-input"
              />
              <button type="button" className="db-search-panel-close" onClick={() => setSearchOpen(false)}>
                <X className="size-4" />
              </button>
            </div>

            <div className="db-search-panel-meta">
              <span>{workspace.name}</span>
              {searchQuery.length >= 2 ? <strong>{searchResults.length}</strong> : null}
            </div>

            <div className="db-search-results">
              {searchQuery.length < 2 ? (
                <div className="db-search-quick-list">
                  {ALL_NAV_ITEMS.filter((item) => canAccess(item.feature)).map((item) => {
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="db-search-quick-item"
                        onClick={() => setSearchOpen(false)}
                        onFocus={() => prefetchRoute(item.href)}
                        onPointerEnter={() => prefetchRoute(item.href)}
                      >
                        <Icon className="size-4" />
                        <span>
                          <strong>{item.label}</strong>
                          <small>{item.description}</small>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              ) : searchLoading ? (
                <div className="db-search-empty">
                  <Loader2 className="size-4 animate-spin" />
                  Searching {workspace.name}
                </div>
              ) : searchResults.length > 0 ? (
                searchResults.map((item) => {
                  const Icon = searchIconFor(item.type);

                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      className="db-search-result"
                      onClick={() => setSearchOpen(false)}
                    >
                      <span className="db-search-result-icon">
                        <Icon className="size-4" />
                      </span>
                      <span className="db-search-result-main">
                        <span className="db-search-result-title">{item.title}</span>
                        <span className="db-search-result-subtitle">{item.subtitle}</span>
                      </span>
                      <span className="db-search-result-meta">
                        <strong>{SEARCH_TYPE_LABELS[item.type] ?? item.type}</strong>
                        <small>{item.meta}</small>
                      </span>
                    </Link>
                  );
                })
              ) : (
                <div className="db-search-empty">No matches in {workspace.name}</div>
              )}
            </div>
          </section>
        </div>
      ) : null}

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

      <nav className="db-mobile-tabbar" aria-label="Dashboard">
        {MOBILE_NAV_ITEMS.map((item) => {
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
              aria-current={active ? "page" : undefined}
              onClick={locked ? (event) => event.preventDefault() : undefined}
              onFocus={() => {
                if (!locked) {
                  prefetchRoute(item.href);
                }
              }}
              className={cn(
                "db-mobile-tab-item",
                active && "db-mobile-tab-item-active",
                locked && "db-mobile-tab-item-locked",
              )}
            >
              <span className="db-mobile-tab-icon">
                <Icon className="size-5" />
                {locked ? <Lock className="db-mobile-tab-lock" /> : null}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
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
