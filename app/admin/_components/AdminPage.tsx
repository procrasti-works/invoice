"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import {
  Building2,
  CreditCard,
  FileText,
  LayoutDashboard,
  Loader2,
  LogOut,
  Search,
  ShieldCheck,
  Users,
} from "@/app/_components/IconPack";
import { useMemo, useState, type ComponentType, type ReactNode } from "react";

import { PayvioMark } from "@/app/_components/PayvioMark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

type AdminView = "users" | "organizations";
type PlatformRole = "user" | "admin";
type SubscriptionPlan = "trial" | "starter" | "business" | "professional" | "enterprise";
type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled";

type UserSummary = {
  _id: Id<"users">;
  createdAt: number;
  email: string;
  image: string;
  name: string;
  role: PlatformRole;
};

type UserRow = UserSummary & {
  organizationCount: number;
};

type SubscriptionSummary = {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodEnd?: number;
};

type OrganizationRow = {
  organization: {
    _id: Id<"organizations">;
    createdAt: number;
    defaultCurrency: string;
    deletedAt: number | null;
    name: string;
    region: string;
    updatedAt: number;
    vatRegistered: boolean;
  };
  memberCount: number;
  owner: UserSummary | null;
  subscription: SubscriptionSummary | null;
};

type MetricCard = {
  barClassName: string;
  caption: string;
  icon: ComponentType<{ className?: string }>;
  iconClassName: string;
  label: string;
  progress: number;
  value: ReactNode;
};

const planOptions: SubscriptionPlan[] = [
  "trial",
  "starter",
  "business",
  "professional",
  "enterprise",
];

const statusOptions: SubscriptionStatus[] = [
  "trialing",
  "active",
  "past_due",
  "canceled",
];

function formatDate(value: number | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-NA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function toDateInput(value: number | undefined) {
  if (!value) {
    return "";
  }

  return new Date(value).toISOString().slice(0, 10);
}

function label(value: string) {
  return value
    .split("_")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function metricPercent(value: number, max: number) {
  if (max <= 0 || value <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round((value / max) * 100)));
}

function userDisplayName(user: { email?: string; name?: string } | null | undefined) {
  return user?.name || user?.email?.split("@")[0] || "Payvio admin";
}

function userEmail(user: { email?: string } | null | undefined) {
  return user?.email || "No email";
}

export function AdminPage() {
  const router = useRouter();
  const { signOut } = useAuthActions();
  const state = useQuery(api.admin.platformState);
  const setUserRole = useMutation(api.admin.setUserRole);
  const setOrganizationDeleted = useMutation(api.admin.setOrganizationDeleted);
  const [activeView, setActiveView] = useState<AdminView>("users");
  const [adminSearch, setAdminSearch] = useState("");
  const [pendingKey, setPendingKey] = useState("");
  const [notice, setNotice] = useState("");

  const users = useMemo(() => (state?.users ?? []) as UserRow[], [state]);
  const organizations = useMemo(
    () => (state?.organizations ?? []) as OrganizationRow[],
    [state],
  );
  const searchTerm = adminSearch.trim().toLowerCase();

  const filteredUsers = useMemo(() => {
    if (!searchTerm) {
      return users;
    }

    return users.filter((user) =>
      [
        user.name,
        user.email,
        user.role,
        user.organizationCount.toString(),
        formatDate(user.createdAt),
      ]
        .join(" ")
        .toLowerCase()
        .includes(searchTerm),
    );
  }, [searchTerm, users]);

  const filteredOrganizations = useMemo(() => {
    if (!searchTerm) {
      return organizations;
    }

    return organizations.filter((row) => {
      const organization = row.organization;
      const owner = row.owner;

      return [
        organization.name,
        organization.defaultCurrency,
        organization.region,
        organization.deletedAt ? "suspended" : "active",
        owner?.name,
        owner?.email,
        row.subscription?.plan,
        row.subscription?.status,
        row.memberCount.toString(),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(searchTerm);
    });
  }, [organizations, searchTerm]);

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  async function handleUserRole(userId: Id<"users">, role: PlatformRole) {
    setNotice("");
    setPendingKey(`user:${userId}`);

    try {
      await setUserRole({ userId, role });
      setNotice("User role updated.");
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Unable to update user role.");
    } finally {
      setPendingKey("");
    }
  }

  async function handleOrganizationDeleted(
    organizationId: Id<"organizations">,
    deleted: boolean,
  ) {
    setNotice("");
    setPendingKey(`org-delete:${organizationId}`);

    try {
      await setOrganizationDeleted({ organizationId, deleted });
      setNotice(deleted ? "Organization suspended." : "Organization restored.");
    } catch (caught) {
      setNotice(
        caught instanceof Error ? caught.message : "Unable to update organization.",
      );
    } finally {
      setPendingKey("");
    }
  }

  if (state === undefined) {
    return (
      <AdminCenteredState>
        <PayvioMark className="size-10 text-foreground" />
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </AdminCenteredState>
    );
  }

  if (!state.authorized) {
    return (
      <AdminCenteredState>
        <span className="grid size-12 place-items-center rounded-lg bg-muted text-foreground">
          <ShieldCheck className="size-6" />
        </span>
        <div className="space-y-2 text-center">
          <h1 className="text-lg font-semibold leading-tight">Admin access required</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Your account is signed in without platform admin access.
          </p>
        </div>
        <Button asChild className="h-10 rounded-lg bg-neutral-950 px-4 text-white hover:bg-neutral-800 hover:text-white">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </AdminCenteredState>
    );
  }

  const loadedUsers = state.stats?.loadedUsers ?? users.length;
  const loadedAdmins = state.stats?.loadedAdmins ?? users.filter((user) => user.role === "admin").length;
  const loadedOrganizations = state.stats?.loadedOrganizations ?? organizations.length;
  const activeOrganizations =
    state.stats?.activeOrganizations ??
    organizations.filter((row) => row.organization.deletedAt === null).length;
  const deletedOrganizations =
    state.stats?.deletedOrganizations ??
    organizations.filter((row) => row.organization.deletedAt !== null).length;
  const organizationBase = Math.max(loadedOrganizations, 1);
  const userBase = Math.max(loadedUsers, 1);
  const viewerName = userDisplayName(state.viewer);
  const viewerEmail = userEmail(state.viewer);

  const metricCards: MetricCard[] = [
    {
      label: "Loaded users",
      value: loadedUsers,
      caption: "Recent accounts",
      icon: Users,
      iconClassName: "bg-neutral-100 text-neutral-700",
      barClassName: "bg-neutral-900",
      progress: loadedUsers > 0 ? 100 : 0,
    },
    {
      label: "Admins",
      value: loadedAdmins,
      caption: "Platform access",
      icon: ShieldCheck,
      iconClassName: "bg-teal-50 text-teal-600",
      barClassName: "bg-teal-600",
      progress: metricPercent(loadedAdmins, userBase),
    },
    {
      label: "Active orgs",
      value: activeOrganizations,
      caption: `${loadedOrganizations} loaded`,
      icon: Building2,
      iconClassName: "bg-amber-50 text-amber-600",
      barClassName: "bg-amber-400",
      progress: metricPercent(activeOrganizations, organizationBase),
    },
    {
      label: "Suspended orgs",
      value: deletedOrganizations,
      caption: "Restricted workspaces",
      icon: CreditCard,
      iconClassName: "bg-red-50 text-red-600",
      barClassName: "bg-red-600",
      progress: metricPercent(deletedOrganizations, organizationBase),
    },
  ];

  const tabs: { count: number; id: AdminView; label: string; tone: string }[] = [
    {
      id: "users",
      label: "Users",
      count: users.length,
      tone: "bg-muted text-foreground",
    },
    {
      id: "organizations",
      label: "Organizations",
      count: organizations.length,
      tone: "bg-teal-100 text-teal-700",
    },
  ];

  return (
    <div className="internal-app fixed inset-0 h-dvh overflow-hidden bg-[var(--dashboard-frame)] text-foreground">
      <div className="flex h-full min-h-0 w-full">
        <AdminSidebar
          viewerEmail={viewerEmail}
          viewerName={viewerName}
          onSignOut={() => void handleSignOut()}
        />

        <div className="min-h-0 min-w-0 flex-1 bg-[var(--dashboard-frame)] p-0 lg:p-3">
          <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-0 bg-[var(--dashboard-panel)] shadow-none lg:rounded-lg lg:border lg:border-border lg:shadow-sm">
            <header className="z-20 flex h-[calc(3.5rem+env(safe-area-inset-top))] shrink-0 items-center justify-between gap-2 border-b border-border bg-[var(--dashboard-panel)] px-3 pt-[env(safe-area-inset-top)] lg:h-16 lg:gap-3 lg:px-6 lg:pt-0">
              <div className="flex min-w-0 items-center gap-3">
                <Link href="/dashboard" className="grid size-9 shrink-0 place-items-center lg:hidden" aria-label="Payvio dashboard">
                  <PayvioMark className="size-9 text-foreground" />
                </Link>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold tracking-normal lg:text-base">Platform admin</p>
                  <p className="hidden truncate text-xs text-muted-foreground sm:block">{viewerEmail}</p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Button asChild variant="outline" size="sm" className="hidden h-9 rounded-lg border-border sm:inline-flex">
                  <Link href="/dashboard">
                    <LayoutDashboard className="size-4" />
                    Dashboard
                  </Link>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Sign out"
                  onClick={() => void handleSignOut()}
                  className="size-9 rounded-lg border-border"
                >
                  <LogOut className="size-4" />
                </Button>
              </div>
            </header>

            <main className="min-h-0 flex-1 overflow-y-auto bg-[var(--dashboard-content)] px-3 py-3 pb-[calc(1rem+env(safe-area-inset-bottom))] [scrollbar-color:color-mix(in_oklch,var(--muted-foreground)_30%,transparent)_transparent] [scrollbar-width:thin] sm:px-6 lg:py-6 lg:pb-6 [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/25 hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40">
              <div className="mx-auto w-full max-w-[96rem] space-y-4 sm:space-y-[30px]">
                <section className="grid grid-cols-2 gap-3 sm:gap-6 xl:grid-cols-4">
                  {metricCards.map((metric) => {
                    const Icon = metric.icon;

                    return (
                      <article
                        key={metric.label}
                        className="min-h-[112px] rounded-lg border border-border bg-card p-3.5 shadow-none sm:min-h-[156px] sm:p-[30px] xl:h-[156px]"
                      >
                        <div className="flex items-start justify-between gap-3 sm:gap-6">
                          <div className="min-w-0">
                            <p className="truncate text-lg font-semibold leading-tight tracking-normal text-foreground sm:text-[30px] sm:leading-none">
                              {metric.value}
                            </p>
                            <p className="mt-1 truncate text-xs leading-4 text-muted-foreground sm:mt-2 sm:text-[20px] sm:leading-6">
                              {metric.label}
                            </p>
                          </div>
                          <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg sm:size-[60px]", metric.iconClassName)}>
                            <Icon className="size-5 sm:size-7" />
                          </span>
                        </div>
                        <div className="mt-3 h-1 rounded-full bg-muted sm:mt-[27px]">
                          <div
                            className={cn("h-full rounded-full", metric.barClassName)}
                            style={{ width: `${metric.progress}%` }}
                          />
                        </div>
                        <p className="mt-2 truncate text-xs text-muted-foreground sm:hidden">{metric.caption}</p>
                      </article>
                    );
                  })}
                </section>

                {notice ? (
                  <p className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground" role="status">
                    {notice}
                  </p>
                ) : null}

                <section className="rounded-none border-0 bg-transparent p-0 shadow-none sm:min-h-[560px] sm:rounded-lg sm:border sm:border-border sm:bg-card sm:p-[30px]">
                  <div className="flex flex-col gap-4 sm:gap-5 xl:flex-row xl:items-center xl:justify-between">
                    <Tabs value={activeView} onValueChange={(value) => setActiveView(value as AdminView)} className="min-w-0">
                      <TabsList className="flex h-auto w-full max-w-full flex-nowrap items-center justify-start gap-2 overflow-x-auto rounded-none bg-transparent p-0 pb-1 [scrollbar-width:none] sm:flex-wrap sm:gap-x-9 sm:gap-y-3 sm:overflow-visible sm:pb-0 [&::-webkit-scrollbar]:hidden">
                        {tabs.map((tab) => (
                          <TabsTrigger
                            key={tab.id}
                            value={tab.id}
                            className="h-10 min-w-fit flex-none gap-2 rounded-lg px-3 text-sm text-muted-foreground after:hidden data-active:bg-muted data-active:text-foreground data-active:shadow-none sm:h-12 sm:gap-3 sm:px-4 sm:text-base"
                          >
                            <span className="whitespace-nowrap">{tab.label}</span>
                            <span className={cn("grid size-7 shrink-0 place-items-center rounded-full text-sm font-semibold sm:size-9 sm:text-base", tab.tone)}>
                              {tab.count}
                            </span>
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </Tabs>
                    <Badge variant="outline" className="h-8 rounded-full border-border px-3 text-sm text-muted-foreground">
                      {activeView === "users" ? `${filteredUsers.length} users` : `${filteredOrganizations.length} organizations`}
                    </Badge>
                  </div>

                  <div className="mt-4 grid gap-2 sm:mt-[30px] lg:max-w-[360px]">
                    <label className="relative w-full" htmlFor="admin-search">
                      <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="admin-search"
                        value={adminSearch}
                        onChange={(event) => setAdminSearch(event.target.value)}
                        placeholder={activeView === "users" ? "Search users..." : "Search organizations..."}
                        className="h-11 rounded-lg border-border bg-background pl-12 text-sm shadow-sm sm:text-base"
                      />
                    </label>
                  </div>

                  <div className="mt-4 [scrollbar-color:color-mix(in_oklch,var(--foreground)_35%,transparent)_transparent] [scrollbar-width:thin] lg:mt-8 lg:max-h-[560px] lg:overflow-y-auto lg:pr-1">
                    {activeView === "users" ? (
                      <UsersPanel
                        pendingKey={pendingKey}
                        users={filteredUsers}
                        onRoleChange={handleUserRole}
                      />
                    ) : (
                      <OrganizationsPanel
                        organizations={filteredOrganizations}
                        pendingKey={pendingKey}
                        onDeletedChange={handleOrganizationDeleted}
                        onNotice={setNotice}
                        onPendingChange={setPendingKey}
                      />
                    )}
                  </div>
                </section>
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminCenteredState({ children }: { children: ReactNode }) {
  return (
    <main className="internal-app grid min-h-svh place-items-center bg-[var(--dashboard-frame)] p-6 text-foreground">
      <section className="flex w-full max-w-sm flex-col items-center gap-4 rounded-lg border border-border bg-card p-6 text-center shadow-sm">
        {children}
      </section>
    </main>
  );
}

function AdminSidebar({
  viewerEmail,
  viewerName,
  onSignOut,
}: {
  viewerEmail: string;
  viewerName: string;
  onSignOut: () => void;
}) {
  const viewerInitial = viewerName.trim().slice(0, 1).toUpperCase() || "A";

  return (
    <aside className="z-30 hidden h-full min-h-0 w-[240px] shrink-0 flex-col overflow-hidden bg-[var(--dashboard-sidebar)] px-3.5 py-4 lg:flex">
      <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
        <PayvioMark className="size-11 shrink-0 text-foreground" />
        <span className="truncate text-[22px] font-semibold leading-none tracking-normal">Payvio.</span>
      </Link>

      <div className="mt-4 rounded-lg bg-background p-2.5 ring-1 ring-border">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
            {viewerInitial}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{viewerName}</span>
            <span className="block truncate text-xs text-muted-foreground">{viewerEmail}</span>
          </span>
        </div>
      </div>

      <nav className="mt-4 space-y-2.5 pr-1" aria-label="Admin">
        <div className="space-y-1.5">
          <p className="px-3 text-[11px] font-semibold uppercase tracking-normal text-muted-foreground">
            Platform
          </p>
          <div className="space-y-1">
            <Button
              type="button"
              variant="ghost"
              className="h-9 w-full justify-start gap-3 rounded-lg bg-background px-3 text-[14px] font-medium text-foreground shadow-sm ring-1 ring-border hover:bg-background hover:text-foreground"
            >
              <ShieldCheck className="size-4" />
              <span className="truncate">Admin</span>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="h-9 w-full justify-start gap-3 rounded-lg border-0 px-3 text-[14px] font-medium text-foreground hover:bg-muted hover:text-foreground"
            >
              <Link href="/dashboard">
                <LayoutDashboard className="size-4" />
                <span className="truncate">Dashboard</span>
              </Link>
            </Button>
          </div>
        </div>
      </nav>

      <div className="mt-auto pt-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onSignOut}
          className="h-12 w-full justify-start gap-3 rounded-lg border-0 px-2 py-1.5 text-left text-foreground hover:bg-muted hover:text-foreground"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-foreground">
            <LogOut className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">Sign out</span>
            <span className="block truncate text-xs text-muted-foreground">Leave admin</span>
          </span>
        </Button>
      </div>
    </aside>
  );
}

function UsersPanel({
  pendingKey,
  users,
  onRoleChange,
}: {
  pendingKey: string;
  users: UserRow[];
  onRoleChange: (userId: Id<"users">, role: PlatformRole) => void;
}) {
  if (users.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No users found"
        body="Try a different search."
      />
    );
  }

  return (
    <>
      <div className="grid gap-3 lg:hidden">
        {users.map((user) => (
          <UserMobileCard
            key={user._id}
            pending={pendingKey === `user:${user._id}`}
            user={user}
            onRoleChange={onRoleChange}
          />
        ))}
      </div>

      <Table className="hidden table-fixed text-base lg:table">
        <colgroup>
          <col className="w-[36%]" />
          <col className="w-[18%]" />
          <col className="w-[18%]" />
          <col className="w-[18%]" />
          <col className="w-[10%]" />
        </colgroup>
        <TableHeader className="sticky top-0 z-10 bg-card">
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="h-14 overflow-hidden px-3 font-semibold text-foreground">User</TableHead>
            <TableHead className="h-14 overflow-hidden px-3 font-semibold text-foreground">Role</TableHead>
            <TableHead className="h-14 overflow-hidden px-3 font-semibold text-foreground">Organizations</TableHead>
            <TableHead className="h-14 overflow-hidden px-3 font-semibold text-foreground">Created</TableHead>
            <TableHead className="h-14 px-3 text-right font-semibold text-foreground">State</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user._id} className="h-[71px] border-border hover:bg-muted/40">
              <TableCell className="overflow-hidden px-3">
                <UserIdentity user={user} />
              </TableCell>
              <TableCell className="overflow-hidden px-3">
                <RoleSelect
                  disabled={pendingKey === `user:${user._id}`}
                  user={user}
                  onRoleChange={onRoleChange}
                />
              </TableCell>
              <TableCell className="overflow-hidden px-3 text-foreground">
                {user.organizationCount}
              </TableCell>
              <TableCell className="overflow-hidden px-3 text-foreground">
                <span className="block truncate">{formatDate(user.createdAt)}</span>
              </TableCell>
              <TableCell className="px-3 text-right">
                {pendingKey === `user:${user._id}` ? (
                  <Loader2 className="ml-auto size-4 animate-spin text-muted-foreground" />
                ) : (
                  <RoleBadge role={user.role} />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}

function UserMobileCard({
  pending,
  user,
  onRoleChange,
}: {
  pending: boolean;
  user: UserRow;
  onRoleChange: (userId: Id<"users">, role: PlatformRole) => void;
}) {
  return (
    <article className="rounded-lg border border-border bg-card p-4 shadow-none">
      <div className="flex items-start justify-between gap-3">
        <UserIdentity user={user} />
        {pending ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : (
          <RoleBadge role={user.role} />
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg bg-muted/60 p-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Organizations</p>
          <p className="mt-1 truncate text-sm font-semibold text-foreground">{user.organizationCount}</p>
        </div>
        <div className="min-w-0 text-right">
          <p className="text-xs text-muted-foreground">Created</p>
          <p className="mt-1 truncate text-sm text-foreground">{formatDate(user.createdAt)}</p>
        </div>
      </div>

      <div className="mt-4">
        <RoleSelect disabled={pending} user={user} onRoleChange={onRoleChange} />
      </div>
    </article>
  );
}

function UserIdentity({ user }: { user: UserSummary }) {
  const initial = userDisplayName(user).trim().slice(0, 1).toUpperCase() || "U";

  return (
    <div className="flex min-w-0 items-center gap-3">
      {user.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          src={user.image}
          className="size-10 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-sm font-semibold text-foreground">
          {initial}
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-foreground">{userDisplayName(user)}</span>
        <span className="block truncate text-xs text-muted-foreground">{userEmail(user)}</span>
      </span>
    </div>
  );
}

function RoleSelect({
  disabled,
  user,
  onRoleChange,
}: {
  disabled: boolean;
  user: UserRow;
  onRoleChange: (userId: Id<"users">, role: PlatformRole) => void;
}) {
  return (
    <Select
      value={user.role}
      disabled={disabled}
      onValueChange={(value) => onRoleChange(user._id, value as PlatformRole)}
    >
      <SelectTrigger className="h-10 w-full rounded-lg border-border bg-background text-sm shadow-none lg:max-w-[150px]" aria-label="Platform role">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="user">User</SelectItem>
        <SelectItem value="admin">Admin</SelectItem>
      </SelectContent>
    </Select>
  );
}

function RoleBadge({ role }: { role: PlatformRole }) {
  return (
    <Badge
      className={cn(
        "h-6 rounded-full border-0 px-3 text-sm font-semibold",
        role === "admin" ? "bg-teal-50 text-teal-700" : "bg-neutral-100 text-neutral-600",
      )}
    >
      {label(role)}
    </Badge>
  );
}

function OrganizationsPanel({
  organizations,
  pendingKey,
  onDeletedChange,
  onNotice,
  onPendingChange,
}: {
  organizations: OrganizationRow[];
  pendingKey: string;
  onDeletedChange: (organizationId: Id<"organizations">, deleted: boolean) => void;
  onNotice: (notice: string) => void;
  onPendingChange: (key: string) => void;
}) {
  if (organizations.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        title="No organizations found"
        body="Try a different search."
      />
    );
  }

  return (
    <div className="grid gap-3">
      {organizations.map((row) => (
        <OrganizationCard
          key={row.organization._id}
          row={row}
          pendingDelete={pendingKey === `org-delete:${row.organization._id}`}
          pendingSubscription={pendingKey === `org-sub:${row.organization._id}`}
          onDeletedChange={onDeletedChange}
          onNotice={onNotice}
          onPendingChange={onPendingChange}
        />
      ))}
    </div>
  );
}

function OrganizationCard({
  row,
  pendingDelete,
  pendingSubscription,
  onDeletedChange,
  onNotice,
  onPendingChange,
}: {
  row: OrganizationRow;
  pendingDelete: boolean;
  pendingSubscription: boolean;
  onDeletedChange: (organizationId: Id<"organizations">, deleted: boolean) => void;
  onNotice: (notice: string) => void;
  onPendingChange: (key: string) => void;
}) {
  const organization = row.organization;
  const deleted = organization.deletedAt !== null;
  const ownerName = row.owner?.email || row.owner?.name || "Unknown owner";

  return (
    <article className={cn("rounded-lg border border-border bg-card p-4 shadow-none", deleted && "bg-muted/40")}>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(580px,1.45fr)_auto] xl:items-end">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-foreground">{organization.name}</h3>
            <OrganizationStatusBadge deleted={deleted} />
          </div>
          <div className="mt-3 grid gap-1 text-sm text-muted-foreground">
            <p className="truncate">Owner: {ownerName}</p>
            <p className="truncate">
              {row.memberCount} members / {organization.defaultCurrency}
              {organization.region ? ` / ${organization.region}` : ""}
            </p>
            <p className="truncate">Created {formatDate(organization.createdAt)}</p>
          </div>
        </div>

        <SubscriptionControls
          key={[
            organization._id,
            row.subscription?.plan ?? "trial",
            row.subscription?.status ?? "trialing",
            row.subscription?.currentPeriodEnd ?? "",
          ].join(":")}
          organizationId={organization._id}
          pending={pendingSubscription}
          subscription={row.subscription}
          onNotice={onNotice}
          onPendingChange={onPendingChange}
        />

        <Button
          type="button"
          variant={deleted ? "outline" : "destructive"}
          disabled={pendingDelete}
          onClick={() => onDeletedChange(organization._id, !deleted)}
          className={cn(
            "h-10 w-full rounded-lg px-4 xl:w-[116px]",
            deleted
              ? "border-border bg-background text-foreground hover:bg-muted"
              : "bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700",
          )}
        >
          {pendingDelete ? <Loader2 className="size-4 animate-spin" /> : null}
          {deleted ? "Restore" : "Suspend"}
        </Button>
      </div>
    </article>
  );
}

function OrganizationStatusBadge({ deleted }: { deleted: boolean }) {
  return (
    <Badge
      className={cn(
        "h-6 rounded-full border-0 px-3 text-sm font-semibold",
        deleted ? "bg-red-50 text-red-600" : "bg-teal-50 text-teal-700",
      )}
    >
      {deleted ? "Suspended" : "Active"}
    </Badge>
  );
}

function SubscriptionControls({
  organizationId,
  subscription,
  pending,
  onPendingChange,
  onNotice,
}: {
  organizationId: Id<"organizations">;
  subscription: SubscriptionSummary | null;
  pending: boolean;
  onPendingChange: (key: string) => void;
  onNotice: (notice: string) => void;
}) {
  const updateSubscription = useMutation(api.admin.updateOrganizationSubscription);
  const [plan, setPlan] = useState<SubscriptionPlan>(subscription?.plan ?? "trial");
  const [status, setStatus] = useState<SubscriptionStatus>(
    subscription?.status ?? "trialing",
  );
  const [periodEnd, setPeriodEnd] = useState(
    toDateInput(subscription?.currentPeriodEnd),
  );

  async function handleSave() {
    onNotice("");
    onPendingChange(`org-sub:${organizationId}`);

    try {
      const currentPeriodEnd = periodEnd
        ? Date.parse(`${periodEnd}T00:00:00.000Z`)
        : undefined;

      await updateSubscription(
        currentPeriodEnd === undefined
          ? { organizationId, plan, status }
          : { organizationId, plan, status, currentPeriodEnd },
      );
      onNotice("Subscription updated.");
    } catch (caught) {
      onNotice(
        caught instanceof Error ? caught.message : "Unable to update subscription.",
      );
    } finally {
      onPendingChange("");
    }
  }

  return (
    <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,145px)_minmax(0,145px)_minmax(0,165px)_auto] xl:items-end">
      <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
        Plan
        <Select
          value={plan}
          disabled={pending}
          onValueChange={(value) => setPlan(value as SubscriptionPlan)}
        >
          <SelectTrigger className="h-10 rounded-lg border-border bg-background text-sm shadow-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {planOptions.map((option) => (
              <SelectItem key={option} value={option}>
                {label(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
        Status
        <Select
          value={status}
          disabled={pending}
          onValueChange={(value) => setStatus(value as SubscriptionStatus)}
        >
          <SelectTrigger className="h-10 rounded-lg border-border bg-background text-sm shadow-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((option) => (
              <SelectItem key={option} value={option}>
                {label(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
        Period end
        <Input
          type="date"
          value={periodEnd}
          disabled={pending}
          onChange={(event) => setPeriodEnd(event.target.value)}
          className="h-10 rounded-lg border-border bg-background text-sm shadow-none"
        />
      </label>

      <Button
        type="button"
        onClick={handleSave}
        disabled={pending}
        className="h-10 rounded-lg bg-neutral-950 px-4 text-white hover:bg-neutral-800 hover:text-white"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        Save
      </Button>
    </div>
  );
}

function EmptyState({
  body,
  icon: Icon,
  title,
}: {
  body: string;
  icon: ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <div className="grid min-h-52 place-items-center rounded-lg border border-dashed p-6 text-center sm:p-8">
      <div>
        <Icon className="mx-auto mb-3 size-8 text-muted-foreground" />
        <h3 className="font-medium">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}
