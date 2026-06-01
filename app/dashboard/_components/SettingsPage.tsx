"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  AlertTriangle,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Copy,
  CreditCard,
  KeyRound,
  Loader2,
  MailPlus,
  Save,
  ShieldCheck,
  Trash2,
  UserCog,
  UserMinus,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { PLAN_LABELS, PLAN_COLORS, type PlanLevel } from "@/lib/plan";

type Workspace = Doc<"organizations">;
type MemberRole = Doc<"memberships">["role"];
type AssignableRole = Exclude<MemberRole, "owner">;
type PermissionKey =
  | "manageSettings"
  | "manageMembers"
  | "manageRoles"
  | "createInvoices"
  | "sendInvoices"
  | "voidInvoices"
  | "manageClients"
  | "recordPayments"
  | "managePurchases"
  | "manageVat"
  | "exportReports"
  | "deleteOrganization";
type PermissionPolicy = Omit<Record<PermissionKey, MemberRole>, "deleteOrganization"> & {
  deleteOrganization: Extract<MemberRole, "owner" | "admin">;
};
type SettingsState = {
  user: { name: string; email: string };
  membership: Doc<"memberships">;
  organization: Workspace;
  permissionPolicy: PermissionPolicy;
  permissions: {
    canManageSettings: boolean;
    canManageMembers: boolean;
    canManageRoles: boolean;
    canDeleteOrganization: boolean;
  };
  members: Array<{
    membership: Doc<"memberships">;
    current: boolean;
    user: { name: string; email: string };
  }>;
  pendingInvitations: Array<
    Doc<"organizationInvitations"> & { expired: boolean; token: string }
  >;
};
type SettingsForm = {
  name: string;
  legalName: string;
  tradingName: string;
  entityType: "sole_proprietor" | "close_corporation" | "private_company" | "partnership" | "ngo" | "other";
  region: string;
  address: string;
  phone: string;
  taxId: string;
  vatNumber: string;
  vatRegistered: boolean;
  vatRegistrationType: "not_registered" | "voluntary" | "mandatory";
  vatFilingFrequency: "monthly" | "bi_monthly";
  vatReturnDueDay: string;
  vatRecordRetentionYears: string;
  vatDefaultTaxMode: "no_vat" | "vat_15" | "zero_rated" | "exempt";
  vedEnabled: boolean;
  vedTransmissionMode: "manual_export" | "near_real_time" | "real_time";
  itasRegistered: boolean;
  defaultCurrency: string;
  defaultTerms: string;
  invoicePrefix: string;
  paymentInstructions: string;
  paymentLink: string;
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  branchCode: string;
  swiftCode: string;
};

const roleOptions: Array<{ value: MemberRole; label: string }> = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "finance", label: "Finance" },
  { value: "member", label: "Member" },
  { value: "viewer", label: "Viewer" },
];

const assignableRoleOptions: Array<{ value: AssignableRole; label: string }> = [
  { value: "admin", label: "Admin" },
  { value: "finance", label: "Finance" },
  { value: "member", label: "Member" },
  { value: "viewer", label: "Viewer" },
];

const permissionRows: Array<{
  key: PermissionKey;
  label: string;
  description: string;
  destructive?: boolean;
}> = [
  {
    key: "manageSettings",
    label: "Organization profile",
    description: "Business details, VAT setup, bank details.",
  },
  {
    key: "manageMembers",
    label: "Team access",
    description: "Invite people and remove members.",
  },
  {
    key: "manageRoles",
    label: "Roles and rules",
    description: "Change member roles and permission levels.",
  },
  {
    key: "createInvoices",
    label: "Create invoices",
    description: "Draft and edit client invoices.",
  },
  {
    key: "sendInvoices",
    label: "Issue invoices",
    description: "Prepare links, mark sent, and schedule reminders.",
  },
  {
    key: "voidInvoices",
    label: "Void invoices",
    description: "Close invoices without payment.",
  },
  {
    key: "manageClients",
    label: "Clients",
    description: "Create and update client records.",
  },
  {
    key: "recordPayments",
    label: "Payments",
    description: "Mark paid and review payment proof.",
  },
  {
    key: "managePurchases",
    label: "Purchases",
    description: "Scan, review, and post supplier invoices.",
  },
  {
    key: "manageVat",
    label: "VAT settings",
    description: "Change VAT filing and export setup.",
  },
  {
    key: "exportReports",
    label: "Report exports",
    description: "Export ledger and accounting records.",
  },
  {
    key: "deleteOrganization",
    label: "Delete organization",
    description: "Remove this workspace from active use.",
    destructive: true,
  },
];

const defaultSettings: SettingsForm = {
  name: "My company",
  legalName: "",
  tradingName: "",
  entityType: "sole_proprietor",
  region: "",
  address: "",
  phone: "",
  taxId: "",
  vatNumber: "",
  vatRegistered: false,
  vatRegistrationType: "not_registered",
  vatFilingFrequency: "monthly",
  vatReturnDueDay: "25",
  vatRecordRetentionYears: "5",
  vatDefaultTaxMode: "no_vat",
  vedEnabled: false,
  vedTransmissionMode: "manual_export",
  itasRegistered: false,
  defaultCurrency: "NAD",
  defaultTerms: "Payment due within 7 days unless otherwise agreed.",
  invoicePrefix: "INV",
  paymentInstructions:
    "Pay by EFT or bank transfer using the invoice number as reference.",
  paymentLink: "",
  bankName: "",
  bankAccountName: "",
  bankAccountNumber: "",
  branchCode: "",
  swiftCode: "",
};

function settingsFromWorkspace(workspace: Workspace | null): SettingsForm {
  if (!workspace) {
    return defaultSettings;
  }

  return {
    name: workspace.name,
    legalName: workspace.legalName ?? "",
    tradingName: workspace.tradingName ?? "",
    entityType: workspace.entityType ?? "sole_proprietor",
    region: workspace.region ?? "",
    address: workspace.address ?? "",
    phone: workspace.phone ?? "",
    taxId: workspace.taxId ?? "",
    vatNumber: workspace.vatNumber ?? "",
    vatRegistered: workspace.vatRegistered ?? false,
    vatRegistrationType:
      workspace.vatRegistrationType ??
      (workspace.vatRegistered ? "mandatory" : "not_registered"),
    vatFilingFrequency: workspace.vatFilingFrequency ?? "monthly",
    vatReturnDueDay: String(workspace.vatReturnDueDay ?? 25),
    vatRecordRetentionYears: String(workspace.vatRecordRetentionYears ?? 5),
    vatDefaultTaxMode:
      workspace.vatDefaultTaxMode ??
      (workspace.vatRegistered ? "vat_15" : "no_vat"),
    vedEnabled: workspace.vedEnabled ?? Boolean(workspace.vatRegistered),
    vedTransmissionMode: workspace.vedTransmissionMode ?? "manual_export",
    itasRegistered: workspace.itasRegistered ?? false,
    defaultCurrency: workspace.defaultCurrency,
    defaultTerms: workspace.defaultTerms ?? defaultSettings.defaultTerms,
    invoicePrefix: workspace.invoicePrefix ?? "INV",
    paymentInstructions: workspace.paymentInstructions,
    paymentLink: workspace.paymentLink ?? "",
    bankName: workspace.bankName ?? "",
    bankAccountName: workspace.bankAccountName ?? "",
    bankAccountNumber: workspace.bankAccountNumber ?? "",
    branchCode: workspace.branchCode ?? "",
    swiftCode: workspace.swiftCode ?? "",
  };
}

export function SettingsPage() {
  const state = useQuery(api.organizations.settingsState);
  const workspace = state?.organization ?? null;

  const workspaceVersion = workspace
    ? `${workspace._id}:${workspace.updatedAt}:${state?.membership.role}`
    : "new";

  return (
    <div className="db-page db-dashboard-page db-settings-page">
      <section className="db-workview">
        <div className="db-workview-head">
          <div>
            <p className="db-breadcrumb">
              Payvio <span>/</span> Settings
            </p>
            <h1 className="db-workview-title">Settings</h1>
          </div>
          <Link href="/dashboard" className="db-outline-btn db-settings-back-link">
            <ArrowLeft className="size-4" />
            Dashboard
          </Link>
        </div>

        {state === undefined ? null : state && workspace ? (
          <div className="db-settings-layout">
            <OrganizationSummaryPanel state={state} />
            <div className="db-settings-main">
              <SettingsEditor
                key={workspaceVersion}
                workspace={workspace}
                initialForm={settingsFromWorkspace(workspace)}
                canManageSettings={state.permissions.canManageSettings}
              />
              <RoleRulesPanel key={`rules:${workspaceVersion}`} state={state} />
              <MembersPanel key={`members:${workspaceVersion}`} state={state} />
              <TeamInvitationsPanel key={`invites:${workspaceVersion}`} state={state} />
              <BillingPanel key={`billing:${workspaceVersion}`} state={state} />
              <DangerZonePanel key={`danger:${workspaceVersion}`} state={state} />
            </div>
          </div>
        ) : (
          <section className="db-card db-settings-empty">
            <h2>Workspace setup required</h2>
            <p>Create or join an organization before editing settings.</p>
            <Link href="/onboarding" className="db-primary-btn">Open setup</Link>
          </section>
        )}
      </section>
    </div>
  );
}

function OrganizationSummaryPanel({ state }: { state: SettingsState }) {
  const policy = state.permissionPolicy;
  const adminCount = state.members.filter(
    (member) =>
      member.membership.role === "owner" || member.membership.role === "admin",
  ).length;

  return (
    <aside className="db-settings-sidebar">
      <section className="db-settings-card db-settings-org-card">
        <div className="db-settings-mark">
          <Building2 className="size-5" />
        </div>
        <p className="db-settings-kicker">Active organization</p>
        <h2>{state.organization.name}</h2>
        <div className="db-settings-meta-list">
          <span>{state.organization.defaultCurrency}</span>
          <span>{roleLabel(state.membership.role)}</span>
          <span>{state.members.length} members</span>
        </div>
      </section>

      <section className="db-settings-card">
        <div className="db-settings-card-head">
          <div>
            <p className="db-settings-kicker">Access</p>
            <h2>Control scope</h2>
          </div>
          <ShieldCheck className="size-4" />
        </div>
        <div className="db-settings-scope-list">
          <div>
            <span>Admins</span>
            <strong>{adminCount}</strong>
          </div>
          <div>
            <span>Invoice create</span>
            <strong>{roleLabel(policy.createInvoices)}+</strong>
          </div>
          <div>
            <span>Delete org</span>
            <strong>{policy.deleteOrganization === "admin" ? "Admins" : "Owner"}</strong>
          </div>
        </div>
      </section>
    </aside>
  );
}

function RoleRulesPanel({ state }: { state: SettingsState }) {
  const updatePermissionPolicy = useMutation(api.organizations.updatePermissionPolicy);
  const [policy, setPolicy] = useState<PermissionPolicy>(state.permissionPolicy);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canManageRules = state.permissions.canManageRoles;

  async function handleSave() {
    setNotice(null);
    setError(null);
    setPending(true);

    try {
      await updatePermissionPolicy({ permissionPolicy: policy });
      setNotice("Role rules saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save role rules.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="db-settings-card">
      <div className="db-settings-card-head">
        <div>
          <p className="db-settings-kicker">Roles and rules</p>
          <h2>Scoped organization access</h2>
        </div>
        <KeyRound className="size-4" />
      </div>

      {notice ? (
        <p className="db-settings-success">
          <CheckCircle2 className="size-4" />
          {notice}
        </p>
      ) : null}

      {error ? <p className="db-settings-error">{error}</p> : null}

      {!canManageRules ? (
        <p className="db-settings-warning">
          <AlertTriangle className="size-4" />
          Your role cannot change permission rules.
        </p>
      ) : null}

      <div className="db-settings-role-grid">
        {roleOptions.map((role) => (
          <div key={role.value} className="db-settings-role-cell">
            <strong>{role.label}</strong>
            <span>{roleDescription(role.value)}</span>
          </div>
        ))}
      </div>

      <div className="db-settings-rule-list">
        {permissionRows.map((row) => {
          const options =
            row.key === "deleteOrganization"
              ? roleOptions.filter(
                  (role) => role.value === "owner" || role.value === "admin",
                )
              : roleOptions;

          return (
            <div key={row.key} className="db-settings-rule-row">
              <div>
                <span className={row.destructive ? "db-settings-danger-text" : ""}>
                  {row.label}
                </span>
                <small>{row.description}</small>
              </div>
              <select
                value={policy[row.key]}
                onChange={(event) =>
                  setPolicy((current) => ({
                    ...current,
                    [row.key]: event.target.value as PermissionPolicy[typeof row.key],
                  }))
                }
                disabled={!canManageRules || pending}
                className="db-settings-select"
                aria-label={`${row.label} minimum role`}
              >
                {options.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.value === "owner" ? "Owner only" : `${role.label}+`}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      <Button
        type="button"
        disabled={!canManageRules || pending}
        onClick={handleSave}
        className="db-settings-action"
      >
        {pending ? <Loader2 className="animate-spin" /> : <Save />}
        Save role rules
      </Button>
    </section>
  );
}

function MembersPanel({ state }: { state: SettingsState }) {
  const updateMemberRole = useMutation(api.organizations.updateMemberRole);
  const removeMember = useMutation(api.organizations.removeMember);
  const [changingId, setChangingId] = useState<Id<"memberships"> | null>(null);
  const [removingId, setRemovingId] = useState<Id<"memberships"> | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRoleChange(
    membershipId: Id<"memberships">,
    role: AssignableRole,
  ) {
    setNotice(null);
    setError(null);
    setChangingId(membershipId);

    try {
      await updateMemberRole({ membershipId, role });
      setNotice("Member role updated.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update role.");
    } finally {
      setChangingId(null);
    }
  }

  async function handleRemove(membershipId: Id<"memberships">) {
    setNotice(null);
    setError(null);
    setRemovingId(membershipId);

    try {
      await removeMember({ membershipId });
      setNotice("Member removed.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to remove member.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <section className="db-settings-card">
      <div className="db-settings-card-head">
        <div>
          <p className="db-settings-kicker">Members</p>
          <h2>Organization roles</h2>
        </div>
        <UserCog className="size-4" />
      </div>

      {notice ? (
        <p className="db-settings-success">
          <CheckCircle2 className="size-4" />
          {notice}
        </p>
      ) : null}

      {error ? <p className="db-settings-error">{error}</p> : null}

      <div className="db-settings-member-list">
        {state.members.map((member) => {
          const role = member.membership.role;
          const canChangeRole =
            state.permissions.canManageRoles && role !== "owner" && !member.current;
          const canRemove =
            state.permissions.canManageMembers && role !== "owner" && !member.current;

          return (
            <div key={member.membership._id} className="db-settings-member-row">
              <div className="db-settings-member-main">
                <span className="db-settings-avatar">
                  {memberInitial(member.user.email || member.user.name)}
                </span>
                <div>
                  <strong>{member.user.name || member.user.email || "Team member"}</strong>
                  <small>
                    {member.user.email || "No email"}{member.current ? " - you" : ""}
                  </small>
                </div>
              </div>
              <div className="db-settings-member-actions">
                {canChangeRole ? (
                  <select
                    value={role}
                    onChange={(event) =>
                      handleRoleChange(
                        member.membership._id,
                        event.target.value as AssignableRole,
                      )
                    }
                    disabled={changingId === member.membership._id}
                    className="db-settings-select"
                    aria-label="Member role"
                  >
                    {assignableRoleOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Badge variant="secondary">{roleLabel(role)}</Badge>
                )}

                {canRemove ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="db-settings-remove-btn"
                    onClick={() => handleRemove(member.membership._id)}
                    disabled={removingId === member.membership._id}
                  >
                    {removingId === member.membership._id ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <UserMinus />
                    )}
                    Remove
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TeamInvitationsPanel({ state }: { state: SettingsState }) {
  const invitations = state.pendingInvitations;
  const createInvitation = useMutation(api.organizations.createInvitation);
  const revokeInvitation = useMutation(api.organizations.revokeInvitation);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AssignableRole>("finance");
  const [pending, setPending] = useState(false);
  const [revokingId, setRevokingId] =
    useState<Id<"organizationInvitations"> | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canManageTeam = state.permissions.canManageMembers;

  async function copyInviteUrl(token: string) {
    const url = inviteUrl(token);

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      setNotice("Invite link copied. Share it with the invited user.");
      return;
    }

    setNotice(url);
  }

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setError(null);
    setPending(true);

    try {
      const invitation = await createInvitation({ email, role });
      await copyInviteUrl(invitation.token);
      setEmail("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create invite.");
    } finally {
      setPending(false);
    }
  }

  async function handleRevoke(invitationId: Id<"organizationInvitations">) {
    setNotice(null);
    setError(null);
    setRevokingId(invitationId);

    try {
      await revokeInvitation({ invitationId });
      setNotice("Invitation revoked.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to revoke invite.");
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <section className="db-settings-card db-settings-invitations-card">
      <div className="db-settings-card-head">
        <div>
          <p className="db-settings-kicker">Team access</p>
          <h2>Invite links</h2>
          <p className="db-settings-card-copy">Create invite links for this organization.</p>
        </div>
        <Users className="size-4" />
        <Badge variant={canManageTeam ? "success" : "warning"}>
          {canManageTeam ? "Can invite" : "Restricted"}
        </Badge>
      </div>

      {notice ? (
        <p className="db-settings-success">
          <CheckCircle2 className="size-4 shrink-0" />
          {notice}
        </p>
      ) : null}

      {error ? <p className="db-settings-error">{error}</p> : null}

      {canManageTeam ? (
        <form onSubmit={handleInvite} className="db-settings-invite-form">
          <div className="grid gap-3 sm:grid-cols-[1fr_160px_auto]">
            <SettingsField label="Email" htmlFor="invite-email">
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-10 border-[#d7d7d1] bg-[#f6f6f4] text-[13px]"
                required
              />
            </SettingsField>
            <SettingsField label="Role" htmlFor="invite-role">
              <select
                id="invite-role"
                value={role}
                onChange={(event) => setRole(event.target.value as AssignableRole)}
                className="h-10 rounded-lg border border-[#d7d7d1] bg-[#f6f6f4] px-3 text-[13px] outline-none"
              >
                <option value="admin">Admin</option>
                <option value="finance">Finance</option>
                <option value="viewer">Viewer</option>
                <option value="member">Member</option>
              </select>
            </SettingsField>
            <Button
              type="submit"
              disabled={pending}
              className="db-primary-btn db-settings-invite-btn"
            >
              {pending ? <Loader2 className="animate-spin" /> : <MailPlus />}
              Create link
            </Button>
          </div>
        </form>
      ) : (
        <p className="db-settings-warning">
          Your current role cannot invite teammates.
        </p>
      )}

      <div className="db-settings-pending-list">
        <p className="db-settings-section-title">Pending invites</p>
        {invitations.length === 0 ? (
          <p className="db-settings-empty-row">
            No pending invites.
          </p>
        ) : (
          invitations.map((invitation) => (
            <div
              key={invitation._id}
              className="db-settings-invite-row"
            >
              <div>
                <p className="db-settings-invite-email">{invitation.email}</p>
                <p className="db-settings-invite-meta">
                  {roleLabel(invitation.role)} access
                  {invitation.expired ? " - expired" : ""}
                </p>
              </div>
              {canManageTeam ? (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="db-settings-copy-btn"
                    onClick={() => copyInviteUrl(invitation.token)}
                    disabled={!invitation.token || invitation.expired}
                  >
                    <Copy />
                    Copy
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="db-settings-delete-btn"
                    onClick={() => handleRevoke(invitation._id)}
                    disabled={revokingId === invitation._id}
                  >
                    {revokingId === invitation._id ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Trash2 />
                    )}
                    Revoke
                  </Button>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

type BillingPlan = "trial" | "starter" | "business" | "professional" | "enterprise";

const ACCESS_CODES: Record<string, BillingPlan> = {
  "PAYVIO-ADMIN-2026": "enterprise",
  "ENT-2026": "enterprise",
  "PRO-2026": "professional",
  "BIZ-2026": "business",
  "START-2026": "starter",
};

function BillingPanel({ state }: { state: SettingsState }) {
  const subscription = useQuery(api.subscriptions.current);
  const upsertSubscription = useMutation(api.subscriptions.upsertForOrganization);
  const isOwner = state.membership.role === "owner" || state.membership.role === "admin";

  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentPlan = (subscription?.plan ?? "trial") as PlanLevel;
  const planColor = PLAN_COLORS[currentPlan] ?? "#6b7280";
  const planLabel = PLAN_LABELS[currentPlan] ?? "Trial";

  async function handleApplyCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNotice(null);
    setError(null);
    const trimmed = code.trim().toUpperCase();
    const plan: BillingPlan | undefined = ACCESS_CODES[trimmed];
    if (!plan) {
      setError("Invalid access code. Please check and try again.");
      return;
    }
    setPending(true);
    try {
      await upsertSubscription({ plan, status: "active" });
      setNotice(`Plan upgraded to ${PLAN_LABELS[plan]}. Refresh to see all features.`);
      setCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not apply code.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="db-settings-card">
      <div className="db-settings-card-head">
        <div>
          <p className="db-settings-kicker">Billing</p>
          <h2>Plan &amp; access</h2>
          <p className="db-settings-card-copy">Your current workspace plan and access level.</p>
        </div>
        <CreditCard className="size-4" />
      </div>

      {notice && (
        <p className="db-settings-success">
          <CheckCircle2 className="size-4 shrink-0" />
          {notice}
        </p>
      )}
      {error && <p className="db-settings-error">{error}</p>}

      <div className="db-billing-current">
        <span className="db-billing-plan-badge" style={{ background: planColor + "18", color: planColor, borderColor: planColor + "40" }}>
          <BadgeCheck className="size-4" />
          {planLabel}
        </span>
        <p className="db-billing-plan-note">
          {currentPlan === "trial"
            ? "You are on the free trial. Apply an access code to unlock paid features."
            : "Your plan is active. Contact the team to change your subscription."}
        </p>
      </div>

      {isOwner && (
        <form onSubmit={handleApplyCode} className="db-billing-code-form">
          <p className="db-settings-field-label">Apply access code</p>
          <div className="db-billing-code-row">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. ENT-2026"
              className="h-10 border-[#d7d7d1] bg-[#f1f1ee] text-[13px] font-mono"
              disabled={pending}
            />
            <Button type="submit" disabled={!code.trim() || pending} className="db-primary-btn h-10 shrink-0">
              {pending ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
              Apply
            </Button>
          </div>
          <p className="db-billing-code-hint">
            Access codes are provided by the Payvio team. Contact{" "}
            <a href="mailto:info.procrasti@gmail.com" className="underline">info.procrasti@gmail.com</a>{" "}
            to get one.
          </p>
        </form>
      )}
    </section>
  );
}

function DangerZonePanel({ state }: { state: SettingsState }) {
  const router = useRouter();
  const deleteOrganization = useMutation(api.organizations.deleteOrganization);
  const [confirmationName, setConfirmationName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canDelete = state.permissions.canDeleteOrganization;
  const confirmed = confirmationName.trim() === state.organization.name;

  async function handleDelete() {
    setError(null);
    setPending(true);

    try {
      await deleteOrganization({ confirmationName });
      router.replace("/onboarding?mode=create");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to delete organization.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="db-settings-card db-settings-danger-zone">
      <div className="db-settings-card-head">
        <div>
          <p className="db-settings-kicker">Danger zone</p>
          <h2>Delete organization</h2>
        </div>
        <AlertTriangle className="size-4" />
      </div>

      {error ? <p className="db-settings-error">{error}</p> : null}

      {!canDelete ? (
        <p className="db-settings-warning">
          <AlertTriangle className="size-4" />
          Your role cannot delete this organization.
        </p>
      ) : null}

      <div className="db-settings-delete-row">
        <SettingsField label="Confirm organization name" htmlFor="delete-organization-name">
          <Input
            id="delete-organization-name"
            value={confirmationName}
            onChange={(event) => setConfirmationName(event.target.value)}
            disabled={!canDelete || pending}
            className="h-10 border-[#d7d7d1] bg-[#f6f6f4] text-[13px]"
          />
        </SettingsField>
        <Button
          type="button"
          variant="outline"
          disabled={!canDelete || !confirmed || pending}
          onClick={handleDelete}
          className="db-settings-delete-btn"
        >
          {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
          Delete organization
        </Button>
      </div>
    </section>
  );
}

function inviteUrl(token: string) {
  if (typeof window === "undefined") {
    return `/join/${token}`;
  }

  return `${window.location.origin}/join/${token}`;
}

function roleLabel(role: string) {
  if (role === "owner") {
    return "Owner";
  }

  if (role === "admin") {
    return "Admin";
  }

  if (role === "finance") {
    return "Finance";
  }

  if (role === "viewer") {
    return "Viewer";
  }

  return "Member";
}

function roleDescription(role: MemberRole) {
  if (role === "owner") {
    return "Full account ownership";
  }

  if (role === "admin") {
    return "Operations and access control";
  }

  if (role === "finance") {
    return "Invoices, payments, VAT";
  }

  if (role === "member") {
    return "Day-to-day records";
  }

  return "Read-only workspace";
}

function memberInitial(value: string) {
  return (value.trim().slice(0, 1) || "P").toUpperCase();
}

function SettingsEditor({
  workspace,
  initialForm,
  canManageSettings,
}: {
  workspace: Workspace | null;
  initialForm: SettingsForm;
  canManageSettings: boolean;
}) {
  const updateWorkspace = useMutation(api.invoices.updateWorkspace);
  const [form, setForm] = useState<SettingsForm>(initialForm);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setError(null);

    if (!canManageSettings) {
      setError("Your role cannot change organization profile settings.");
      return;
    }

    if (!/^[A-Z]{3}$/.test(form.defaultCurrency)) {
      setError("Currency must be a 3-letter code.");
      return;
    }

    const vatReturnDueDay = Math.min(28, Math.max(1, Number(form.vatReturnDueDay) || 25));
    const vatRecordRetentionYears = Math.max(5, Number(form.vatRecordRetentionYears) || 5);

    setPending(true);

    try {
      await updateWorkspace({
        name: form.name,
        legalName: form.legalName,
        tradingName: form.tradingName,
        entityType: form.entityType,
        region: form.region,
        address: form.address,
        phone: form.phone,
        taxId: form.taxId,
        vatNumber: form.vatNumber,
        vatRegistered: form.vatRegistered,
        vatRegistrationType: form.vatRegistered
          ? form.vatRegistrationType === "not_registered"
            ? "mandatory"
            : form.vatRegistrationType
          : "not_registered",
        vatFilingFrequency: form.vatFilingFrequency,
        vatReturnDueDay,
        vatRecordRetentionYears,
        vatDefaultTaxMode: form.vatRegistered ? form.vatDefaultTaxMode : "no_vat",
        vedEnabled: form.vatRegistered && form.vedEnabled,
        vedTransmissionMode: form.vedTransmissionMode,
        itasRegistered: form.itasRegistered,
        defaultCurrency: form.defaultCurrency,
        defaultTerms: form.defaultTerms,
        invoicePrefix: form.invoicePrefix,
        paymentInstructions: form.paymentInstructions,
        paymentLink: form.paymentLink,
        bankName: form.bankName,
        bankAccountName: form.bankAccountName,
        bankAccountNumber: form.bankAccountNumber,
        branchCode: form.branchCode,
        swiftCode: form.swiftCode,
      });
      setNotice(workspace ? "Settings saved." : "Workspace created.");
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Unable to save settings.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="db-settings-card db-settings-editor-card"
    >
      {notice ? (
        <p className="db-settings-success">
          <CheckCircle2 className="size-4 shrink-0" />
          {notice}
        </p>
      ) : null}

      {error ? <p className="db-settings-error">{error}</p> : null}

      {!canManageSettings ? (
        <p className="db-settings-warning">
          <AlertTriangle className="size-4" />
          Your role cannot change organization profile settings.
        </p>
      ) : null}

      <fieldset disabled={!canManageSettings || pending} className="db-settings-editor-fields">
      <SettingsField label="Workspace name" htmlFor="workspace-name">
        <Input
          id="workspace-name"
          value={form.name}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              name: event.target.value,
            }))
          }
          className="h-10 border-[#d7d7d1] bg-[#f1f1ee] text-[13px] font-normal"
        />
      </SettingsField>

      <div className="grid gap-3 sm:grid-cols-2">
        <SettingsField label="Legal name" htmlFor="legal-name">
          <Input id="legal-name" value={form.legalName} onChange={(event) => setForm((current) => ({ ...current, legalName: event.target.value }))} className="h-10 border-[#d7d7d1] bg-[#f1f1ee] text-[13px] font-normal" />
        </SettingsField>
        <SettingsField label="Trading name" htmlFor="trading-name">
          <Input id="trading-name" value={form.tradingName} onChange={(event) => setForm((current) => ({ ...current, tradingName: event.target.value }))} className="h-10 border-[#d7d7d1] bg-[#f1f1ee] text-[13px] font-normal" />
        </SettingsField>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <SettingsField label="Entity type" htmlFor="entity-type">
          <select id="entity-type" value={form.entityType} onChange={(event) => setForm((current) => ({ ...current, entityType: event.target.value as SettingsForm["entityType"] }))} className="h-10 rounded-lg border border-[#d7d7d1] bg-[#f1f1ee] px-3 text-[13px] outline-none">
            <option value="sole_proprietor">Sole proprietor</option>
            <option value="close_corporation">Close corporation</option>
            <option value="private_company">Private company</option>
            <option value="partnership">Partnership</option>
            <option value="ngo">NGO</option>
            <option value="other">Other</option>
          </select>
        </SettingsField>
        <SettingsField label="Region" htmlFor="region">
          <Input id="region" value={form.region} onChange={(event) => setForm((current) => ({ ...current, region: event.target.value }))} className="h-10 border-[#d7d7d1] bg-[#f1f1ee] text-[13px] font-normal" />
        </SettingsField>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <SettingsField label="Phone / WhatsApp" htmlFor="phone">
          <Input id="phone" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} className="h-10 border-[#d7d7d1] bg-[#f1f1ee] text-[13px] font-normal" />
        </SettingsField>
        <SettingsField label="Tax ID" htmlFor="tax-id">
          <Input id="tax-id" value={form.taxId} onChange={(event) => setForm((current) => ({ ...current, taxId: event.target.value }))} className="h-10 border-[#d7d7d1] bg-[#f1f1ee] text-[13px] font-normal" />
        </SettingsField>
      </div>

      <SettingsField label="Business address" htmlFor="business-address">
        <textarea id="business-address" value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} className="min-h-20 w-full resize-y rounded-lg border border-[#d7d7d1] bg-[#f1f1ee] px-3 py-2 text-[13px] font-normal outline-none transition-colors focus:border-[#009b68] focus:ring-2 focus:ring-[#009b68]/20" />
      </SettingsField>

      <div className="db-settings-form-section">
        <label className="db-settings-toggle">
          <input
            type="checkbox"
            checked={form.vatRegistered}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                vatRegistered: event.target.checked,
                vatRegistrationType: event.target.checked ? "mandatory" : "not_registered",
                vatDefaultTaxMode: event.target.checked ? "vat_15" : "no_vat",
                vedEnabled: event.target.checked,
              }))
            }
          />
          VAT registered
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <SettingsField label="VAT number" htmlFor="vat-number">
            <Input id="vat-number" value={form.vatNumber} onChange={(event) => setForm((current) => ({ ...current, vatNumber: event.target.value }))} disabled={!form.vatRegistered} className="h-10 border-[#d7d7d1] bg-[#f6f6f4] text-[13px] font-normal disabled:text-[#9ca3af]" />
          </SettingsField>
          <SettingsField label="Registration type" htmlFor="vat-registration-type">
            <select
              id="vat-registration-type"
              value={form.vatRegistrationType}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  vatRegistrationType: event.target.value as SettingsForm["vatRegistrationType"],
                }))
              }
              disabled={!form.vatRegistered}
              className="h-10 rounded-lg border border-[#d7d7d1] bg-[#f6f6f4] px-3 text-[13px] outline-none disabled:text-[#9ca3af]"
            >
              <option value="not_registered">Not registered</option>
              <option value="voluntary">Voluntary</option>
              <option value="mandatory">Mandatory</option>
            </select>
          </SettingsField>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <SettingsField label="Default VAT mode" htmlFor="vat-default-tax-mode">
            <select
              id="vat-default-tax-mode"
              value={form.vatRegistered ? form.vatDefaultTaxMode : "no_vat"}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  vatDefaultTaxMode: event.target.value as SettingsForm["vatDefaultTaxMode"],
                }))
              }
              disabled={!form.vatRegistered}
              className="h-10 rounded-lg border border-[#d7d7d1] bg-[#f6f6f4] px-3 text-[13px] outline-none disabled:text-[#9ca3af]"
            >
              <option value="vat_15">VAT 15%</option>
              <option value="zero_rated">Zero-rated</option>
              <option value="exempt">Exempt</option>
              <option value="no_vat">No VAT</option>
            </select>
          </SettingsField>
          <SettingsField label="Filing frequency" htmlFor="vat-filing-frequency">
            <select
              id="vat-filing-frequency"
              value={form.vatFilingFrequency}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  vatFilingFrequency: event.target.value as SettingsForm["vatFilingFrequency"],
                }))
              }
              disabled={!form.vatRegistered}
              className="h-10 rounded-lg border border-[#d7d7d1] bg-[#f6f6f4] px-3 text-[13px] outline-none disabled:text-[#9ca3af]"
            >
              <option value="monthly">Monthly</option>
              <option value="bi_monthly">Bi-monthly</option>
            </select>
          </SettingsField>
          <SettingsField label="Return due day" htmlFor="vat-return-due-day">
            <Input id="vat-return-due-day" inputMode="numeric" value={form.vatReturnDueDay} onChange={(event) => setForm((current) => ({ ...current, vatReturnDueDay: event.target.value }))} disabled={!form.vatRegistered} className="h-10 border-[#d7d7d1] bg-[#f6f6f4] text-[13px] font-normal disabled:text-[#9ca3af]" />
          </SettingsField>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <SettingsField label="Retention years" htmlFor="vat-retention-years">
            <Input id="vat-retention-years" inputMode="numeric" value={form.vatRecordRetentionYears} onChange={(event) => setForm((current) => ({ ...current, vatRecordRetentionYears: event.target.value }))} disabled={!form.vatRegistered} className="h-10 border-[#d7d7d1] bg-[#f6f6f4] text-[13px] font-normal disabled:text-[#9ca3af]" />
          </SettingsField>
          <SettingsField label="VAT transmission" htmlFor="ved-transmission-mode">
            <select
              id="ved-transmission-mode"
              value={form.vedTransmissionMode}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  vedTransmissionMode: event.target.value as SettingsForm["vedTransmissionMode"],
                }))
              }
              disabled={!form.vatRegistered}
              className="h-10 rounded-lg border border-[#d7d7d1] bg-[#f6f6f4] px-3 text-[13px] outline-none disabled:text-[#9ca3af]"
            >
              <option value="manual_export">Manual export</option>
              <option value="near_real_time">Near real-time</option>
              <option value="real_time">Real-time</option>
            </select>
          </SettingsField>
          <SettingsField label="ITAS profile" htmlFor="itas-registered">
            <label className="db-settings-checkbox-row">
              <input
                id="itas-registered"
                type="checkbox"
                checked={form.itasRegistered}
                disabled={!form.vatRegistered}
                onChange={(event) =>
                  setForm((current) => ({ ...current, itasRegistered: event.target.checked }))
                }
              />
              Saved
            </label>
          </SettingsField>
        </div>
        <label className="db-settings-toggle db-settings-toggle-compact">
          <input
            type="checkbox"
            checked={form.vatRegistered && form.vedEnabled}
            disabled={!form.vatRegistered}
            onChange={(event) =>
              setForm((current) => ({ ...current, vedEnabled: event.target.checked }))
            }
          />
          Enable VAT records and ITAS export preparation
        </label>
      </div>

      <SettingsField label="Default currency" htmlFor="default-currency">
        <Input
          id="default-currency"
          value={form.defaultCurrency}
          maxLength={3}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              defaultCurrency: event.target.value.toUpperCase(),
            }))
          }
          className="h-10 border-[#d7d7d1] bg-[#f1f1ee] text-[13px] font-normal uppercase"
        />
      </SettingsField>

      <div className="grid gap-3 sm:grid-cols-2">
        <SettingsField label="Invoice prefix" htmlFor="invoice-prefix">
          <Input id="invoice-prefix" value={form.invoicePrefix} onChange={(event) => setForm((current) => ({ ...current, invoicePrefix: event.target.value.toUpperCase() }))} className="h-10 border-[#d7d7d1] bg-[#f1f1ee] text-[13px] font-normal uppercase" />
        </SettingsField>
        <SettingsField label="Default terms" htmlFor="default-terms">
          <Input id="default-terms" value={form.defaultTerms} onChange={(event) => setForm((current) => ({ ...current, defaultTerms: event.target.value }))} className="h-10 border-[#d7d7d1] bg-[#f1f1ee] text-[13px] font-normal" />
        </SettingsField>
      </div>

      <div className="db-settings-form-section">
        <p className="db-settings-section-title">EFT bank details</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <SettingsField label="Bank name" htmlFor="bank-name">
            <Input id="bank-name" value={form.bankName} onChange={(event) => setForm((current) => ({ ...current, bankName: event.target.value }))} className="h-10 border-[#d7d7d1] bg-[#f6f6f4] text-[13px] font-normal" />
          </SettingsField>
          <SettingsField label="Account name" htmlFor="bank-account-name">
            <Input id="bank-account-name" value={form.bankAccountName} onChange={(event) => setForm((current) => ({ ...current, bankAccountName: event.target.value }))} className="h-10 border-[#d7d7d1] bg-[#f6f6f4] text-[13px] font-normal" />
          </SettingsField>
          <SettingsField label="Account number" htmlFor="bank-account-number">
            <Input id="bank-account-number" value={form.bankAccountNumber} onChange={(event) => setForm((current) => ({ ...current, bankAccountNumber: event.target.value }))} className="h-10 border-[#d7d7d1] bg-[#f6f6f4] text-[13px] font-normal" />
          </SettingsField>
          <SettingsField label="Branch code" htmlFor="branch-code">
            <Input id="branch-code" value={form.branchCode} onChange={(event) => setForm((current) => ({ ...current, branchCode: event.target.value }))} className="h-10 border-[#d7d7d1] bg-[#f6f6f4] text-[13px] font-normal" />
          </SettingsField>
        </div>
        <SettingsField label="SWIFT code" htmlFor="swift-code">
          <Input id="swift-code" value={form.swiftCode} onChange={(event) => setForm((current) => ({ ...current, swiftCode: event.target.value.toUpperCase() }))} className="h-10 border-[#d7d7d1] bg-[#f6f6f4] text-[13px] font-normal uppercase" />
        </SettingsField>
      </div>

      <SettingsField label="Payment instructions" htmlFor="payment-instructions">
        <textarea
          id="payment-instructions"
          value={form.paymentInstructions}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              paymentInstructions: event.target.value,
            }))
          }
          className="min-h-28 w-full resize-y rounded-lg border border-[#d7d7d1] bg-[#f1f1ee] px-3 py-2 text-[13px] font-normal outline-none transition-colors focus:border-[#009b68] focus:ring-2 focus:ring-[#009b68]/20"
        />
      </SettingsField>

      <SettingsField label="Default payment link" htmlFor="payment-link">
        <Input
          id="payment-link"
          type="url"
          value={form.paymentLink}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              paymentLink: event.target.value,
            }))
          }
          placeholder="https://pay.example.com"
          className="h-10 border-[#d7d7d1] bg-[#f1f1ee] text-[13px] font-normal"
        />
      </SettingsField>

      <Button
        type="submit"
        disabled={pending || !canManageSettings}
        className="db-primary-btn db-settings-save-btn"
      >
        {pending ? <Loader2 className="animate-spin" /> : <Save />}
        Save settings
      </Button>
      </fieldset>
    </form>
  );
}

function SettingsField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="db-settings-field">
      <Label htmlFor={htmlFor} className="db-settings-field-label">
        {label}
      </Label>
      {children}
    </div>
  );
}
