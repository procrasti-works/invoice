"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import {
  Building2,
  LayoutDashboard,
  Loader2,
  LogOut,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { PayvioMark } from "@/app/_components/PayvioMark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

type PlatformRole = "user" | "admin";
type SubscriptionPlan = "trial" | "starter" | "business" | "professional" | "enterprise";
type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled";

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
    year: "numeric",
    month: "short",
    day: "numeric",
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

export function AdminPage() {
  const router = useRouter();
  const { signOut } = useAuthActions();
  const state = useQuery(api.admin.platformState);
  const setUserRole = useMutation(api.admin.setUserRole);
  const setOrganizationDeleted = useMutation(api.admin.setOrganizationDeleted);
  const [pendingKey, setPendingKey] = useState("");
  const [notice, setNotice] = useState("");

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
      <main className="admin-shell admin-shell-center">
        <div className="admin-loading-card">
          <PayvioMark className="h-9 w-auto" />
          <Loader2 className="admin-spinner" />
        </div>
      </main>
    );
  }

  if (!state.authorized) {
    return (
      <main className="admin-shell admin-shell-center">
        <section className="admin-access-card">
          <span className="admin-access-icon">
            <ShieldCheck className="size-6" />
          </span>
          <div>
            <h1>Admin access required</h1>
            <p>
              Your account is signed in without platform admin access.
            </p>
          </div>
          <Button asChild className="admin-primary-btn">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div className="admin-header-inner">
          <div className="admin-brand">
            <Link href="/dashboard" aria-label="Payvio dashboard">
              <PayvioMark className="h-8 w-auto" />
            </Link>
            <div>
              <div className="admin-title-row">
                <h1>Platform admin</h1>
                <Badge className="admin-role-badge">
                  Admin
                </Badge>
              </div>
              <p>
                {state.viewer?.email || state.viewer?.name || "Payvio admin"}
              </p>
            </div>
          </div>
          <div className="admin-header-actions">
            <Button asChild variant="outline" className="admin-outline-btn">
              <Link href="/dashboard">
                <LayoutDashboard className="size-4" />
                Dashboard
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleSignOut}
              className="admin-outline-btn"
            >
              <LogOut className="size-4" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className="admin-workspace">
        {notice ? (
          <p
            className="admin-notice"
            role="status"
          >
            {notice}
          </p>
        ) : null}

        <section className="admin-metric-grid">
          <StatCard
            icon={<Users className="size-5" />}
            label="Loaded users"
            value={state.stats?.loadedUsers ?? 0}
          />
          <StatCard
            icon={<ShieldCheck className="size-5" />}
            label="Admins"
            value={state.stats?.loadedAdmins ?? 0}
          />
          <StatCard
            icon={<Building2 className="size-5" />}
            label="Active orgs"
            value={state.stats?.activeOrganizations ?? 0}
          />
          <StatCard
            icon={<Building2 className="size-5" />}
            label="Suspended orgs"
            value={state.stats?.deletedOrganizations ?? 0}
          />
        </section>

        <section className="admin-section">
          <div className="admin-section-head">
            <div>
              <p className="admin-kicker">Accounts</p>
              <h2>Users</h2>
            </div>
            <span>{state.users.length} shown</span>
          </div>

          <div className="admin-table-card">
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Organizations</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {state.users.map((user) => (
                    <tr key={user._id}>
                      <td>
                        <div className="admin-table-primary">
                          <p>
                            {user.name || user.email || "User"}
                          </p>
                          <small>
                            {user.email || "No email"}
                          </small>
                        </div>
                      </td>
                      <td>
                        <div className="admin-inline-control">
                          <select
                            value={user.role}
                            disabled={pendingKey === `user:${user._id}`}
                            onChange={(event) =>
                              handleUserRole(
                                user._id,
                                event.target.value as PlatformRole,
                              )
                            }
                            className="admin-select"
                            aria-label="Platform role"
                          >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                          </select>
                          {pendingKey === `user:${user._id}` ? (
                            <Loader2 className="admin-inline-spinner" />
                          ) : null}
                        </div>
                      </td>
                      <td>
                        {user.organizationCount}
                      </td>
                      <td>
                        {formatDate(user.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="admin-section">
          <div className="admin-section-head">
            <div>
              <p className="admin-kicker">Platform</p>
              <h2>Organizations</h2>
            </div>
            <span>
              {state.organizations.length} shown
            </span>
          </div>

          <div className="admin-org-list">
            {state.organizations.map((row) => {
              const organization = row.organization;
              const deleted = organization.deletedAt !== null;

              return (
                <article
                  key={organization._id}
                  className={`admin-org-card${deleted ? " admin-org-card-muted" : ""}`}
                >
                  <div className="admin-org-main">
                    <div className="admin-org-title-row">
                      <h3>
                        {organization.name}
                      </h3>
                      <Badge
                        variant={deleted ? "destructive" : "secondary"}
                        className={deleted ? "admin-status-badge admin-status-danger" : "admin-status-badge"}
                      >
                        {deleted ? "Suspended" : "Active"}
                      </Badge>
                    </div>
                    <div className="admin-org-meta">
                      <span>Owner: {row.owner?.email || row.owner?.name || "Unknown"}</span>
                      <span>
                        {row.memberCount} members / {organization.defaultCurrency}
                        {organization.region ? ` / ${organization.region}` : ""}
                      </span>
                      <span>Created {formatDate(organization.createdAt)}</span>
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
                    subscription={row.subscription}
                    pending={pendingKey === `org-sub:${organization._id}`}
                    onPendingChange={setPendingKey}
                    onNotice={setNotice}
                  />

                  <Button
                    type="button"
                    variant={deleted ? "outline" : "destructive"}
                    disabled={pendingKey === `org-delete:${organization._id}`}
                    onClick={() =>
                      handleOrganizationDeleted(organization._id, !deleted)
                    }
                    className={deleted ? "admin-restore-btn" : "admin-suspend-btn"}
                  >
                    {pendingKey === `org-delete:${organization._id}` ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : null}
                    {deleted ? "Restore" : "Suspend"}
                  </Button>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({
  icon,
  label: statLabel,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="admin-stat-card">
      <span className="admin-stat-icon">
        {icon}
      </span>
      <div>
        <p>{statLabel}</p>
        <strong>{value}</strong>
      </div>
    </div>
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
  subscription: {
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    currentPeriodEnd?: number;
  } | null;
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
    <div className="admin-subscription-controls">
      <label className="admin-field">
        Plan
        <select
          value={plan}
          onChange={(event) => setPlan(event.target.value as SubscriptionPlan)}
          className="admin-select"
        >
          {planOptions.map((option) => (
            <option key={option} value={option}>
              {label(option)}
            </option>
          ))}
        </select>
      </label>

      <label className="admin-field">
        Status
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as SubscriptionStatus)}
          className="admin-select"
        >
          {statusOptions.map((option) => (
            <option key={option} value={option}>
              {label(option)}
            </option>
          ))}
        </select>
      </label>

      <label className="admin-field">
        Period end
        <input
          type="date"
          value={periodEnd}
          onChange={(event) => setPeriodEnd(event.target.value)}
          className="admin-input"
        />
      </label>

      <Button
        type="button"
        onClick={handleSave}
        disabled={pending}
        className="admin-save-btn"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        Save
      </Button>
    </div>
  );
}
