"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowUpRight,
  BarChart3,
  Bell,
  ChevronDown,
  EllipsisVertical,
  FileText,
  HelpCircle,
  Lock,
  LogOut,
  Menu,
  Plus,
  ReceiptText,
  ScanLine,
  Search,
  Settings,
  Shield,
  Users,
} from "@/app/_components/IconPack";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";

import { DashboardSpeedWarmup } from "./DashboardSpeedWarmup";
import { PayvioMark } from "@/app/_components/PayvioMark";
import { ThemeSegmentedControl, useThemeLabel } from "@/app/_components/ThemeSwitch";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PlanProvider, PLAN_LABELS, usePlan, type Feature } from "@/lib/plan";

type NavItem = {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  feature: Feature;
};

const billingNav: NavItem[] = [
  { label: "Invoices", href: "/dashboard", icon: FileText, feature: "invoices" },
  { label: "Clients", href: "/dashboard/clients", icon: Users, feature: "clients" },
  { label: "Reminders", href: "/dashboard/reminders", icon: Bell, feature: "reminders" },
];

const accountingNav: NavItem[] = [
  { label: "Reports", href: "/dashboard/reports", icon: BarChart3, feature: "reports" },
  { label: "Supplier invoices", href: "/dashboard/scan", icon: ScanLine, feature: "scan" },
  { label: "VAT", href: "/dashboard/vat", icon: Shield, feature: "vat" },
];

const settingsItem: NavItem = { label: "Settings", href: "/dashboard/settings", icon: Settings, feature: "settings" };
const supportItem: NavItem = { label: "Get Help", href: "/dashboard/support", icon: HelpCircle, feature: "settings" };
const accountItem: NavItem = { label: "Account settings", href: "/dashboard/account", icon: Settings, feature: "settings" };

const mobileNav = [billingNav[0], billingNav[1], billingNav[2], accountingNav[0], settingsItem];
const allNav = [...billingNav, ...accountingNav, settingsItem, supportItem];
const workspaceNav = [settingsItem];

type OrganizationWithImage = Doc<"organizations"> & { imageUrl?: string | null };
type DashboardShellState =
  | {
      user: (Doc<"users"> & { role: "user" | "admin" }) | null;
      organization: OrganizationWithImage | null;
      subscription: Doc<"subscriptions"> | null;
    }
  | undefined;

function isActive(pathname: string | null, href: string) {
  if (href === "/dashboard") {
    return pathname === href || pathname?.startsWith("/dashboard/invoices");
  }

  return pathname?.startsWith(href);
}

function WorkspaceAvatar({
  imageUrl,
  name,
  className,
  textClassName,
}: {
  imageUrl?: string | null;
  name: string;
  className: string;
  textClassName: string;
}) {
  const initial = name.trim().slice(0, 1).toUpperCase() || "W";

  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt=""
        className={cn("shrink-0 rounded-lg object-cover", className)}
      />
    );
  }

  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-lg bg-primary font-semibold text-primary-foreground",
        className,
        textClassName,
      )}
    >
      {initial}
    </span>
  );
}

function ShellInner({
  children,
  shellState,
}: {
  children: ReactNode;
  shellState: DashboardShellState;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuthActions();
  const user = shellState?.user;
  const workspace = shellState?.organization;
  const switchOrganization = useMutation(api.organizations.switchOrganization);
  const acceptInvitation = useMutation(api.organizations.acceptInvitationById);
  const markNotificationsSeen = useMutation(api.dashboard.markNotificationsSeen);
  const { plan, daysLeftInTrial, canAccess } = usePlan();
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const switcherState = useQuery(api.organizations.switcherState, workspaceMenuOpen ? {} : "skip");
  const notifications = useQuery(api.dashboard.notifications, notificationsOpen ? {} : "skip");
  const [pendingOrganizationId, setPendingOrganizationId] =
    useState<Id<"organizations"> | null>(null);
  const [pendingInvitationId, setPendingInvitationId] =
    useState<Id<"organizationInvitations"> | null>(null);
  const [menuError, setMenuError] = useState("");
  const [navSearch, setNavSearch] = useState("");
  const [intentRoute, setIntentRoute] = useState<string | null>(null);
  const shellLoaded = shellState !== undefined;

  useEffect(() => {
    if (shellLoaded && workspace === null) {
      const next = pathname?.startsWith("/dashboard") ? pathname : "/dashboard";
      router.replace(`/onboarding?next=${encodeURIComponent(next)}`);
    }
  }, [pathname, router, shellLoaded, workspace]);

  function warmDashboardRoute(href: string) {
    setIntentRoute(href);
    router.prefetch(href);
  }

  function warmLinkProps(href: string) {
    return {
      href,
      onFocus: () => warmDashboardRoute(href),
      onPointerEnter: () => warmDashboardRoute(href),
      onTouchStart: () => warmDashboardRoute(href),
      prefetch: true as const,
    };
  }

  const activeItem = isActive(pathname, accountItem.href)
    ? accountItem
    : allNav.find((item) => isActive(pathname, item.href)) ?? allNav[0];
  const workspaceName = workspace?.name ?? "Workspace";
  const workspaceImageUrl = workspace?.imageUrl ?? "";
  const userName = user?.name || user?.email?.split("@")[0] || "Payvio user";
  const userEmail = user?.email ?? "No email";
  const userInitial = userName.trim().slice(0, 1).toUpperCase() || "P";
  const themeLabel = useThemeLabel();
  const planLabel =
    plan === "trial" && daysLeftInTrial !== null
      ? `Trial, ${daysLeftInTrial} days left`
      : PLAN_LABELS[plan];
  const trialEnded = plan === "trial" && daysLeftInTrial !== null && daysLeftInTrial <= 0;
  const upgradePrompt =
    plan === "trial"
      ? trialEnded
        ? {
            eyebrow: "Action needed",
            title: "Trial ended",
            body: "Choose a plan to keep Payvio active.",
            cta: "Choose plan",
            href: "/#pricing",
            state: "trial-ended" as const,
          }
        : {
            eyebrow: "Trial workspace",
            title: "Grab Pro Now",
            body:
              daysLeftInTrial === null
                ? "Start with the plan that fits your team."
                : `${daysLeftInTrial} days left in your trial`,
            cta: "Get Premium",
            href: "/#pricing",
            state: "trial" as const,
          }
      : null;
  const unreadCount = notifications?.unreadCount ?? 0;
  const searchedNav = navSearch.trim()
    ? allNav.filter((item) => item.label.toLowerCase().includes(navSearch.trim().toLowerCase()))
    : allNav;

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  async function handleSwitchOrganization(organizationId: Id<"organizations">) {
    if (workspace?._id === organizationId || pendingOrganizationId) {
      return;
    }

    setMenuError("");
    setPendingOrganizationId(organizationId);
    try {
      await switchOrganization({ organizationId });
    } catch (error) {
      setMenuError(error instanceof Error ? error.message : "Unable to switch workspace.");
    } finally {
      setPendingOrganizationId(null);
    }
  }

  async function handleJoinInvitation(invitationId: Id<"organizationInvitations">) {
    setMenuError("");
    setPendingInvitationId(invitationId);
    try {
      await acceptInvitation({ invitationId });
    } catch (error) {
      setMenuError(error instanceof Error ? error.message : "Unable to join workspace.");
    } finally {
      setPendingInvitationId(null);
    }
  }

  function renderSearchContent() {
    return (
      <>
        <div className="p-2">
          <Input
            value={navSearch}
            onChange={(event) => setNavSearch(event.target.value)}
            placeholder="Search pages"
            className="h-10 bg-background"
          />
        </div>
        <DropdownMenuSeparator />
        {searchedNav.length > 0 ? (
          searchedNav.map((item) => {
            const Icon = item.icon;
            const locked = !canAccess(item.feature);

            return (
              <DropdownMenuItem key={item.href} asChild={!locked} disabled={locked}>
                {locked ? (
                  <span>
                    <Icon className="size-4" />
                    {item.label}
                    <Lock className="ml-auto size-3" />
                  </span>
                ) : (
                  <Link {...warmLinkProps(item.href)}>
                    <Icon className="size-4" />
                    {item.label}
                  </Link>
                )}
              </DropdownMenuItem>
            );
          })
        ) : (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">No pages</p>
        )}
      </>
    );
  }

  function renderNavItem(item: NavItem, compact = false) {
    const active = isActive(pathname, item.href);
    const locked = !canAccess(item.feature);
    const Icon = item.icon;

    if (compact) {
      const compactClassName = cn(
        "group flex h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[10px] font-medium leading-none text-muted-foreground transition active:scale-[0.98]",
        active && "text-foreground",
        locked && "cursor-not-allowed opacity-55",
      );
      const content = (
        <>
          <span
            className={cn(
              "relative grid size-8 place-items-center rounded-lg transition",
              active
                ? "bg-foreground text-background"
                : "text-muted-foreground group-hover:bg-muted group-hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {locked ? (
              <Lock className="absolute -right-1 -top-1 size-3 rounded-full bg-background text-muted-foreground" />
            ) : null}
          </span>
          <span className="max-w-full truncate">{item.label}</span>
        </>
      );

      if (locked) {
        return (
          <button
            key={item.href}
            type="button"
            className={compactClassName}
            disabled
            title={`Upgrade to use ${item.label}`}
          >
            {content}
          </button>
        );
      }

      return (
        <Link
          key={item.href}
          {...warmLinkProps(item.href)}
          aria-current={active ? "page" : undefined}
          className={compactClassName}
          title={item.label}
        >
          {content}
        </Link>
      );
    }

    return (
      <Button
        key={item.href}
        asChild={!locked}
        variant="ghost"
        className={cn(
          "h-9 w-full justify-start gap-3 rounded-lg border-0 px-3 text-[14px] font-medium text-foreground hover:bg-muted hover:text-foreground",
          active &&
            "bg-background text-foreground shadow-sm ring-1 ring-border hover:bg-background hover:text-foreground",
          locked && "cursor-not-allowed opacity-60",
        )}
        disabled={locked}
        title={locked ? `Upgrade to use ${item.label}` : item.label}
      >
        {locked ? (
          <span className={cn("inline-flex min-w-0 items-center", compact ? "flex-col gap-1" : "w-full gap-3")}>
            <Icon className="size-4" />
            <span className="truncate">{item.label}</span>
            <Lock className={cn("size-3", !compact && "ml-auto")} />
          </span>
        ) : (
          <Link {...warmLinkProps(item.href)} aria-current={active ? "page" : undefined}>
            <Icon className="size-4" />
            <span className="truncate">{item.label}</span>
          </Link>
        )}
      </Button>
    );
  }

  if (shellLoaded && (workspace === null || user === null)) {
    return (
      <main className="internal-app grid min-h-svh place-items-center bg-[var(--dashboard-frame)] p-6 text-foreground">
        <Card className="w-full max-w-sm gap-0 py-0">
          <CardContent className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
            <PayvioMark className="size-8 text-foreground" />
            Opening workspace
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <div className="internal-app fixed inset-0 h-dvh overflow-hidden bg-[var(--dashboard-frame)] text-foreground">
      <div className="flex h-full min-h-0 w-full">
        <aside className="z-30 hidden h-full min-h-0 w-[240px] shrink-0 flex-col overflow-hidden bg-[var(--dashboard-sidebar)] px-3.5 py-4 lg:flex">
          <Link {...warmLinkProps("/dashboard")} className="flex min-w-0 items-center gap-3">
            <PayvioMark className="size-11 shrink-0 text-foreground" />
            <span className="truncate text-[22px] font-semibold leading-none tracking-normal">Payvio.</span>
          </Link>

          <div className="mt-4">
            <DropdownMenu onOpenChange={setWorkspaceMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-11 w-full justify-between gap-3 rounded-lg border-0 bg-transparent px-2.5 text-foreground shadow-none hover:bg-muted hover:text-foreground"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <WorkspaceAvatar
                      imageUrl={workspaceImageUrl}
                      name={workspaceName}
                      className="size-8"
                      textClassName="text-xs"
                    />
                    <span className="block min-w-0 text-left">
                      <span className="block truncate text-sm font-semibold">{workspaceName}</span>
                      <span className="block truncate text-xs text-muted-foreground">{planLabel}</span>
                    </span>
                  </span>
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                sideOffset={8}
                className="w-64 rounded-lg border-0 bg-muted p-2 text-foreground shadow-lg ring-0"
              >
                <DropdownMenuLabel className="flex items-center justify-between gap-2 rounded-lg bg-muted p-2.5 text-foreground">
                  <span className="text-sm font-semibold">Workspace</span>
                  <Badge variant="secondary" className="border-0 bg-muted text-muted-foreground">
                    {planLabel}
                  </Badge>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="my-2 bg-border" />
                {(switcherState?.organizations ?? []).map((item) => (
                  <DropdownMenuItem
                    key={item.organization._id}
                    disabled={item.active || pendingOrganizationId === item.organization._id}
                    onSelect={() => void handleSwitchOrganization(item.organization._id)}
                    className="h-9 rounded-lg px-2.5 text-sm font-medium text-foreground focus:bg-muted focus:text-foreground"
                  >
                    <WorkspaceAvatar
                      imageUrl={item.organization.imageUrl}
                      name={item.organization.name}
                      className="size-6"
                      textClassName="text-[10px]"
                    />
                    <span className="min-w-0 flex-1 truncate">{item.organization.name}</span>
                    <span className="text-xs font-normal text-muted-foreground">{item.membership.role}</span>
                  </DropdownMenuItem>
                ))}
                {(switcherState?.pendingInvitations ?? []).map((invitation) => (
                  <DropdownMenuItem
                    key={invitation._id}
                    disabled={invitation.expired || pendingInvitationId === invitation._id}
                    onSelect={() => void handleJoinInvitation(invitation._id)}
                    className="h-9 rounded-lg px-2.5 text-sm font-medium text-foreground focus:bg-muted focus:text-foreground"
                  >
                    <Plus className="size-4" />
                    <span className="min-w-0 flex-1 truncate">{invitation.organizationName}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {invitation.expired ? "Expired" : "Join"}
                    </span>
                  </DropdownMenuItem>
                ))}
                {menuError ? (
                  <>
                    <DropdownMenuSeparator className="my-2 bg-border" />
                    <p className="px-2.5 py-1 text-xs text-destructive">{menuError}</p>
                  </>
                ) : null}
                <DropdownMenuSeparator className="my-2 bg-border" />
                <DropdownMenuItem
                  asChild
                  className="h-9 rounded-lg px-2.5 text-sm font-medium text-foreground focus:bg-muted focus:text-foreground"
                >
                  <Link {...warmLinkProps("/dashboard/settings")}>
                    <Settings className="size-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  asChild
                  className="h-9 rounded-lg px-2.5 text-sm font-medium text-foreground focus:bg-muted focus:text-foreground"
                >
                  <Link href="/onboarding?mode=create">
                    <Plus className="size-4" />
                    New workspace
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => void handleSignOut()}
                  variant="destructive"
                  className="h-9 rounded-lg px-2.5 text-sm font-medium text-destructive focus:bg-[var(--danger-soft)] focus:text-destructive"
                >
                  <LogOut className="size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <nav
            className="mt-3 shrink-0 space-y-2.5 overflow-visible pr-1"
            aria-label="Dashboard"
          >
            <div className="space-y-1.5">
              <p className="px-3 text-[11px] font-semibold uppercase tracking-normal text-muted-foreground">
                Dashboard
              </p>
              <div className="space-y-1">{billingNav.map((item) => renderNavItem(item))}</div>
            </div>

            <div className="space-y-1.5">
              <p className="px-3 text-[11px] font-semibold uppercase tracking-normal text-muted-foreground">
                Accounting
              </p>
              <div className="space-y-1">{accountingNav.map((item) => renderNavItem(item))}</div>
            </div>

            <div className="space-y-1.5">
              <p className="px-3 text-[11px] font-semibold uppercase tracking-normal text-muted-foreground">
                Workspace
              </p>
              <div className="space-y-1">
                {workspaceNav.map((item) => renderNavItem(item))}
              </div>
            </div>
          </nav>

          <div className="mt-auto space-y-2 pt-2">
            {upgradePrompt ? (
              <div
                className={cn(
                  "dashboard-upgrade-card rounded-lg text-center",
                  upgradePrompt.state === "trial-ended" && "dashboard-upgrade-card-alert",
                )}
              >
                <div>
                  <div className="dashboard-upgrade-visual mx-auto grid w-full place-items-center rounded-lg bg-muted">
                    <div className="dashboard-upgrade-illustration relative">
                      <span className="dashboard-upgrade-paper dashboard-upgrade-paper-left absolute rotate-[-8deg] rounded-md border border-border bg-background" />
                      <span className="dashboard-upgrade-paper dashboard-upgrade-paper-right absolute rotate-[10deg] rounded-md border border-border bg-muted" />
                      <span className="dashboard-upgrade-box absolute bottom-0 left-1/2 grid -translate-x-1/2 place-items-center rounded-lg border border-border bg-muted-foreground/20 text-foreground shadow-sm">
                        <ReceiptText className="size-6" />
                      </span>
                    </div>
                  </div>
                  <p className="dashboard-upgrade-eyebrow truncate">{upgradePrompt.eyebrow}</p>
                  <p className="dashboard-upgrade-title truncate font-semibold">{upgradePrompt.title}</p>
                  <p className="dashboard-upgrade-body truncate">{upgradePrompt.body}</p>
                </div>
                <Button asChild className="dashboard-upgrade-button w-full bg-primary text-primary-foreground hover:bg-primary/90">
                  <Link href={upgradePrompt.href}>
                    {upgradePrompt.cta}
                    <ArrowUpRight className="size-4" />
                  </Link>
                </Button>
              </div>
            ) : null}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-12 w-full justify-start gap-3 rounded-lg border-0 px-2 py-1.5 text-left text-foreground hover:bg-muted hover:text-foreground"
                >
                  {user?.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.image}
                      alt=""
                      className="size-10 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
                      {userInitial}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{userName}</span>
                    <span className="block truncate text-xs text-muted-foreground">{userEmail}</span>
                  </span>
                  <EllipsisVertical className="size-4 shrink-0 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                side="top"
                sideOffset={8}
                className="w-64 rounded-lg border-0 bg-muted p-2 text-foreground shadow-lg ring-0"
              >
                <DropdownMenuLabel className="flex items-center gap-3 rounded-lg bg-background p-2.5 text-foreground">
                  {user?.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.image}
                      alt=""
                      className="size-9 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
                      {userInitial}
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-foreground">{userName}</span>
                    <span className="block truncate text-xs font-normal text-muted-foreground">{userEmail}</span>
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="my-2 bg-border" />
                <DropdownMenuItem
                  asChild
                  className="h-9 rounded-lg px-2.5 text-sm font-medium text-foreground focus:bg-muted focus:text-foreground"
                >
                    <Link {...warmLinkProps("/dashboard/support")}>
                    <HelpCircle className="size-4" />
                    Get Help
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  asChild
                  className="h-9 rounded-lg px-2.5 text-sm font-medium text-foreground focus:bg-muted focus:text-foreground"
                >
                  <Link {...warmLinkProps("/dashboard/account")}>
                    <Settings className="size-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <div className="px-2 py-2">
                  <div className="mb-2 flex items-center justify-between gap-2 px-1 text-xs font-semibold text-muted-foreground">
                    <span>Theme</span>
                    <span className="truncate font-normal">{themeLabel}</span>
                  </div>
                  <ThemeSegmentedControl iconOnly />
                </div>
                <DropdownMenuSeparator className="my-2 bg-border" />
                <DropdownMenuItem
                  onSelect={() => void handleSignOut()}
                  variant="destructive"
                  className="h-9 rounded-lg px-2.5 text-sm font-medium text-destructive focus:bg-[var(--danger-soft)] focus:text-destructive"
                >
                  <LogOut className="size-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </aside>

        {/* Keep this gray wrapper outside the rounded work panel so the sidebar color frames the content view. */}
        <div className="min-h-0 min-w-0 flex-1 bg-[var(--dashboard-frame)] p-0 lg:p-3">
          <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-0 bg-[var(--dashboard-panel)] shadow-none lg:rounded-lg lg:border lg:border-border lg:shadow-sm">
            <header className="z-20 flex h-[calc(3.5rem+env(safe-area-inset-top))] shrink-0 items-center justify-between gap-2 border-b border-border bg-[var(--dashboard-panel)] px-3 pt-[env(safe-area-inset-top)] lg:h-16 lg:gap-3 lg:px-6 lg:pt-0">
            <div className="flex min-w-0 items-center gap-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="size-9 border-border lg:hidden" aria-label="Open menu">
                    <Menu className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  <DropdownMenuLabel>{workspaceName}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {allNav.map((item) => {
                    const Icon = item.icon;
                    const locked = !canAccess(item.feature);
                    return (
                      <DropdownMenuItem key={item.href} asChild={!locked} disabled={locked}>
                        {locked ? (
                          <span>
                            <Icon className="size-4" />
                            {item.label}
                            <Lock className="ml-auto size-3" />
                          </span>
                        ) : (
                          <Link {...warmLinkProps(item.href)}>
                            <Icon className="size-4" />
                            {item.label}
                          </Link>
                        )}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold tracking-normal lg:text-base">{activeItem.label}</p>
                <p className="hidden truncate text-xs text-muted-foreground sm:block">{workspaceName}</p>
              </div>
            </div>

            <div className="hidden min-w-0 flex-1 justify-center px-3 md:flex">
              <DropdownMenu onOpenChange={(open) => !open && setNavSearch("")}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-11 w-full max-w-[400px] justify-start gap-3 border-border bg-background px-4 text-muted-foreground hover:bg-background hover:text-foreground"
                  >
                    <Search className="size-4" />
                    <span className="truncate font-normal">Search...</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[360px]">
                  {renderSearchContent()}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Button asChild variant="outline" size="sm" className="hidden border-border sm:inline-flex">
                  <Link {...warmLinkProps("/dashboard/invoices/create")}>
                  <FileText className="size-4" />
                  New invoice
                </Link>
              </Button>
              <Button asChild variant="outline" size="icon" className="size-9 border-border sm:hidden" aria-label="New invoice">
                  <Link {...warmLinkProps("/dashboard/invoices/create")}>
                  <Plus className="size-4" />
                </Link>
              </Button>
              <DropdownMenu
                onOpenChange={(open) => {
                  setNotificationsOpen(open);
                  if (open) {
                    void markNotificationsSeen({});
                  }
                }}
              >
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Notifications" className="relative size-9 border-border">
                    <Bell className="size-4" />
                    {unreadCount > 0 ? (
                      <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] leading-4 text-primary-foreground">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    ) : null}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <DropdownMenuLabel className="flex items-center justify-between">
                    Notifications
                    <Badge variant="outline">{notifications?.items?.length ?? 0}</Badge>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {(notifications?.items ?? []).length > 0 ? (
                    notifications?.items.slice(0, 6).map((item) => (
                      <DropdownMenuItem key={item.id} asChild>
                        <Link href={item.href} className="flex-col items-start gap-1">
                          <span className="text-sm font-medium">{item.title}</span>
                          <span className="line-clamp-2 text-xs text-muted-foreground">{item.body}</span>
                        </Link>
                      </DropdownMenuItem>
                    ))
                  ) : (
                    <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                      No notifications
                    </p>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            </header>

            <main className="min-h-0 flex-1 overflow-y-auto bg-[var(--dashboard-content)] px-3 py-3 pb-[calc(5.75rem+env(safe-area-inset-bottom))] [scrollbar-color:color-mix(in_oklch,var(--muted-foreground)_30%,transparent)_transparent] [scrollbar-width:thin] sm:px-6 lg:py-6 lg:pb-6 [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/25 hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40">
              <div className="mx-auto w-full max-w-[96rem]">
                {children}
              </div>
            </main>
          </div>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-background/95 px-2 pb-[calc(0.45rem+env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-10px_24px_color-mix(in_oklch,var(--foreground)_8%,transparent)] backdrop-blur lg:hidden" aria-label="Mobile dashboard">
        {mobileNav.map((item) => renderNavItem(item, true))}
      </nav>
      <DashboardSpeedWarmup
        active={shellLoaded && Boolean(user && workspace)}
        intentRoute={intentRoute}
      />
    </div>
  );
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const shellState = useQuery(api.dashboard.shellState) as DashboardShellState;

  return (
    <PlanProvider subscription={shellState?.subscription ?? null}>
      <ShellInner shellState={shellState}>{children}</ShellInner>
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
    <div className="grid min-h-[60vh] place-items-center">
      <div className="w-full max-w-md rounded-lg border bg-card p-6 text-center">
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-lg bg-muted">
          <Lock className="size-5" />
        </div>
        <h2 className="text-lg font-semibold">Upgrade to use {feature}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This is available on the {requiredPlan} plan and above.
        </p>
        <Button asChild className="mt-5 hover:bg-primary/90">
          <Link href="/#pricing">View plans</Link>
        </Button>
      </div>
    </div>
  );
}
