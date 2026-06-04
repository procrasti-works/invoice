"use client";

import { useRouter } from "next/navigation";
import { useState, type ComponentType, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Copy,
  CreditCard,
  KeyRound,
  Loader2,
  MailPlus,
  Monitor,
  Save,
  Trash2,
  UploadCloud,
  UserCog,
  UserMinus,
  Users,
  X,
} from "@/app/_components/IconPack";
import { ThemeSegmentedControl, useThemeLabel } from "@/app/_components/ThemeSwitch";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { PLAN_COLORS, PLAN_LABELS, type PlanLevel } from "@/lib/plan";

type Workspace = Doc<"organizations"> & { imageUrl?: string | null };
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

const panelClassName = "rounded-lg border border-border bg-card p-5 shadow-none sm:p-[30px]";
const compactPanelClassName = "rounded-lg border border-border bg-card p-5 shadow-none";
const inputClassName = "h-11 rounded-lg border-border bg-background text-base shadow-sm";
const compactInputClassName = "h-10 rounded-lg border-border bg-background text-sm shadow-sm";
const textareaClassName =
  "min-h-28 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-base shadow-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20";
const selectClassName =
  "h-11 w-full rounded-lg border border-border bg-background px-3 text-base shadow-sm outline-none";
const compactSelectClassName =
  "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm shadow-sm outline-none";
const organizationImageAccept = "image/png,image/jpeg,image/webp,image/gif";
const maxOrganizationImageBytes = 5 * 1024 * 1024;
type SettingsSection = "profile" | "appearance" | "team" | "access" | "billing";

const settingsSections: Array<{ value: SettingsSection; label: string }> = [
  { value: "profile", label: "Profile" },
  { value: "appearance", label: "Appearance" },
  { value: "team", label: "Team" },
  { value: "access", label: "Access" },
  { value: "billing", label: "Billing" },
];

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
    description: "Business details, invoice defaults, bank details.",
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

function SelectControl({
  id,
  value,
  onValueChange,
  disabled,
  className = selectClassName,
  ariaLabel,
  options,
}: {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  options: Array<{ value: string; label: ReactNode }>;
}) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger id={id} className={className} aria-label={ariaLabel}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

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
  const [activeSection, setActiveSection] = useState<SettingsSection>("profile");

  const workspaceVersion = workspace
    ? `${workspace._id}:${workspace.updatedAt}:${state?.membership.role}`
    : "new";

  if (state === undefined) {
    return (
      <div className="invoice-list-page">
        <section className={cn(panelClassName, "flex min-h-[240px] items-center justify-center")}>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading settings
          </div>
        </section>
      </div>
    );
  }

  if (!state || !workspace) {
    return (
      <div className="invoice-list-page">
        <section className={cn(panelClassName, "max-w-xl")}>
          <PanelHeader
            eyebrow="Workspace"
            title="Workspace setup required"
            description="Create or join an organization before editing settings."
            icon={Building2}
          />
          <Button asChild className="mt-5 h-11 rounded-lg bg-neutral-950 px-5 text-base font-semibold !text-white hover:bg-neutral-800 hover:!text-white">
            <a href="/onboarding">Open setup</a>
          </Button>
        </section>
      </div>
    );
  }

  return (
    <div className="invoice-list-page">
      <div className="space-y-6">
        <div
          className="grid w-full grid-cols-2 gap-1 rounded-lg bg-muted p-1 sm:grid-cols-3 xl:grid-cols-5"
          role="tablist"
          aria-label="Settings sections"
        >
          {settingsSections.map((section) => (
            <button
              key={section.value}
              type="button"
              role="tab"
              aria-selected={activeSection === section.value}
              className={cn(
                "h-9 min-w-0 rounded-md px-4 text-sm font-semibold leading-none text-muted-foreground transition-colors hover:text-foreground",
                activeSection === section.value && "bg-background text-foreground",
              )}
              onClick={() => setActiveSection(section.value)}
            >
              {section.label}
            </button>
          ))}
        </div>

        {activeSection === "profile" ? (
          <div className="grid gap-[30px] xl:grid-cols-[minmax(0,1fr)_360px]">
            <SettingsEditor
              key={workspaceVersion}
              workspace={workspace}
              initialForm={settingsFromWorkspace(workspace)}
              canManageSettings={state.permissions.canManageSettings}
            />
            <OrganizationSummaryPanel state={state} />
          </div>
        ) : null}

        {activeSection === "appearance" ? (
          <div className="max-w-xl">
            <AppearancePanel />
          </div>
        ) : null}

        {activeSection === "team" ? (
          <div className="grid gap-[30px] xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <TeamInvitationsPanel key={`invites:${workspaceVersion}`} state={state} />
            <MembersPanel key={`members:${workspaceVersion}`} state={state} />
          </div>
        ) : null}

        {activeSection === "access" ? (
          <div className="grid gap-[30px] xl:grid-cols-[minmax(0,1fr)_360px]">
            <RoleRulesPanel key={`rules:${workspaceVersion}`} state={state} />
            <DangerZonePanel key={`danger:${workspaceVersion}`} state={state} />
          </div>
        ) : null}

        {activeSection === "billing" ? (
          <div className="max-w-xl">
            <BillingPanel key={`billing:${workspaceVersion}`} state={state} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AppearancePanel() {
  const themeLabel = useThemeLabel();

  return (
    <section className={compactPanelClassName}>
      <PanelHeader
        eyebrow="Appearance"
        title="Theme"
        description="System is the default."
        icon={Monitor}
      />

      <div className="mt-6 space-y-4">
        <ThemeSegmentedControl />
        <div className="divide-y divide-border rounded-lg border border-border">
          <InfoRow label="Active theme" value={themeLabel} />
        </div>
      </div>
    </section>
  );
}

function PanelHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  icon: ComponentType<{ className?: string }>;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">{eyebrow}</p>
        <h2 className="mt-1 truncate text-xl font-semibold leading-7 text-foreground">{title}</h2>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {action}
        <span className="grid size-10 place-items-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="size-5" />
        </span>
      </div>
    </div>
  );
}

function StatusMessage({
  tone,
  children,
}: {
  tone: "success" | "warning" | "error";
  children: ReactNode;
}) {
  const Icon = tone === "success" ? CheckCircle2 : AlertTriangle;

  return (
    <p
      className={cn(
        "mt-5 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm leading-5",
        tone === "success" && "border-teal-200 bg-teal-50 text-teal-700",
        tone === "warning" && "border-amber-200 bg-amber-50 text-amber-700",
        tone === "error" && "border-red-200 bg-red-50 text-red-700",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

function OrganizationSummaryPanel({ state }: { state: SettingsState }) {
  const policy = state.permissionPolicy;
  const adminCount = state.members.filter(
    (member) =>
      member.membership.role === "owner" || member.membership.role === "admin",
  ).length;

  return (
    <section className={compactPanelClassName}>
      <PanelHeader
        eyebrow="Organization"
        title={state.organization.name}
        description={state.organization.legalName || state.organization.tradingName || "Active workspace"}
        icon={Building2}
      />

      <div className="mt-6 divide-y divide-border rounded-lg border border-border">
        <InfoRow label="Currency" value={state.organization.defaultCurrency} />
        <InfoRow label="Your role" value={roleLabel(state.membership.role)} />
        <InfoRow label="Admins" value={String(adminCount)} />
        <InfoRow label="Invoice access" value={`${roleLabel(policy.createInvoices)}+`} />
        <InfoRow
          label="Delete access"
          value={policy.deleteOrganization === "admin" ? "Admins" : "Owner"}
        />
      </div>
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <span className="min-w-0 text-sm text-muted-foreground">{label}</span>
      <strong className="min-w-0 truncate text-right text-sm font-semibold text-foreground">{value}</strong>
    </div>
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
    <section className={panelClassName}>
      <PanelHeader
        eyebrow="Access"
        title="Role rules"
        description="Choose the minimum role required for real workspace actions."
        icon={KeyRound}
      />

      {notice ? <StatusMessage tone="success">{notice}</StatusMessage> : null}
      {error ? <StatusMessage tone="error">{error}</StatusMessage> : null}
      {!canManageRules ? (
        <StatusMessage tone="warning">Your role cannot change permission rules.</StatusMessage>
      ) : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {roleOptions.map((role) => (
          <div key={role.value} className="rounded-lg border border-border bg-background p-4">
            <strong className="block text-sm font-semibold text-foreground">{role.label}</strong>
            <span className="mt-1 block text-xs leading-5 text-muted-foreground">{roleDescription(role.value)}</span>
          </div>
        ))}
      </div>

      <div className="mt-6 divide-y divide-border rounded-lg border border-border">
        {permissionRows.map((row) => {
          const options =
            row.key === "deleteOrganization"
              ? roleOptions.filter(
                  (role) => role.value === "owner" || role.value === "admin",
                )
              : roleOptions;

          return (
            <div
              key={row.key}
              className="grid gap-3 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center"
            >
              <div className="min-w-0">
                <span className={cn("block text-sm font-semibold text-foreground", row.destructive && "text-red-600")}>
                  {row.label}
                </span>
                <small className="mt-1 block text-sm leading-5 text-muted-foreground">{row.description}</small>
              </div>
              <SelectControl
                value={policy[row.key]}
                onValueChange={(value) =>
                  setPolicy((current) => ({
                    ...current,
                    [row.key]: value as PermissionPolicy[typeof row.key],
                  }))
                }
                disabled={!canManageRules || pending}
                className={compactSelectClassName}
                ariaLabel={`${row.label} minimum role`}
                options={options.map((role) => ({
                  value: role.value,
                  label: role.value === "owner" ? "Owner only" : `${role.label}+`,
                }))}
              />
            </div>
          );
        })}
      </div>

      <Button
        type="button"
        disabled={!canManageRules || pending}
        onClick={handleSave}
        className="mt-6 h-11 rounded-lg bg-neutral-950 px-5 text-base font-semibold !text-white hover:bg-neutral-800 hover:!text-white"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
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
    <section className={panelClassName}>
      <PanelHeader
        eyebrow="Team"
        title="Organization members"
        description="Manage the roles already assigned to this workspace."
        icon={UserCog}
      />

      {notice ? <StatusMessage tone="success">{notice}</StatusMessage> : null}
      {error ? <StatusMessage tone="error">{error}</StatusMessage> : null}

      <div className="mt-6 divide-y divide-border rounded-lg border border-border">
        {state.members.map((member) => {
          const role = member.membership.role;
          const canChangeRole =
            state.permissions.canManageRoles && role !== "owner" && !member.current;
          const canRemove =
            state.permissions.canManageMembers && role !== "owner" && !member.current;

          return (
            <div
              key={member.membership._id}
              className="flex flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
                  {memberInitial(member.user.email || member.user.name)}
                </span>
                <div className="min-w-0">
                  <strong className="block truncate text-sm font-semibold text-foreground">
                    {member.user.name || member.user.email || "Team member"}
                  </strong>
                  <small className="block truncate text-sm text-muted-foreground">
                    {member.user.email || "No email"}{member.current ? " - you" : ""}
                  </small>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:justify-end">
                {canChangeRole ? (
                  <SelectControl
                    value={role}
                    onValueChange={(value) =>
                      handleRoleChange(
                        member.membership._id,
                        value as AssignableRole,
                      )
                    }
                    disabled={changingId === member.membership._id}
                    className={compactSelectClassName}
                    ariaLabel="Member role"
                    options={assignableRoleOptions}
                  />
                ) : (
                  <Badge variant="secondary" className="h-8 rounded-full px-3 text-sm">
                    {roleLabel(role)}
                  </Badge>
                )}

                {canRemove ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-9 rounded-lg px-3 text-sm text-red-600 hover:text-red-700"
                    onClick={() => handleRemove(member.membership._id)}
                    disabled={removingId === member.membership._id}
                  >
                    {removingId === member.membership._id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <UserMinus className="size-4" />
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
    <section className={panelClassName}>
      <PanelHeader
        eyebrow="Team access"
        title="Invite links"
        description="Create invite links for this organization."
        icon={Users}
        action={
          <Badge variant={canManageTeam ? "success" : "warning"} className="h-8 rounded-full px-3 text-sm">
            {canManageTeam ? "Can invite" : "Restricted"}
          </Badge>
        }
      />

      {notice ? <StatusMessage tone="success">{notice}</StatusMessage> : null}
      {error ? <StatusMessage tone="error">{error}</StatusMessage> : null}

      {canManageTeam ? (
        <form onSubmit={handleInvite} className="mt-6">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_auto] lg:items-end">
            <SettingsField label="Email" htmlFor="invite-email">
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={inputClassName}
                required
              />
            </SettingsField>
            <SettingsField label="Role" htmlFor="invite-role">
              <SelectControl
                id="invite-role"
                value={role}
                onValueChange={(value) => setRole(value as AssignableRole)}
                className={selectClassName}
                options={[
                  { value: "admin", label: "Admin" },
                  { value: "finance", label: "Finance" },
                  { value: "viewer", label: "Viewer" },
                  { value: "member", label: "Member" },
                ]}
              />
            </SettingsField>
            <Button
              type="submit"
              disabled={pending}
              className="h-11 rounded-lg bg-neutral-950 px-5 text-base font-semibold !text-white hover:bg-neutral-800 hover:!text-white"
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <MailPlus className="size-4" />}
              Create link
            </Button>
          </div>
        </form>
      ) : (
        <StatusMessage tone="warning">Your current role cannot invite teammates.</StatusMessage>
      )}

      <div className="mt-6">
        <p className="mb-3 text-sm font-semibold text-foreground">Pending invites</p>
        {invitations.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No pending invites.
          </div>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border">
            {invitations.map((invitation) => (
              <div
                key={invitation._id}
                className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{invitation.email}</p>
                  <p className="text-sm text-muted-foreground">
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
                      className="h-9 rounded-lg px-3 text-sm"
                      onClick={() => copyInviteUrl(invitation.token)}
                      disabled={!invitation.token || invitation.expired}
                    >
                      <Copy className="size-4" />
                      Copy
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-9 rounded-lg px-3 text-sm text-red-600 hover:text-red-700"
                      onClick={() => handleRevoke(invitation._id)}
                      disabled={revokingId === invitation._id}
                    >
                      {revokingId === invitation._id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                      Revoke
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
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
  const planColor = PLAN_COLORS[currentPlan] ?? "var(--muted-foreground)";
  const planLabel = PLAN_LABELS[currentPlan] ?? "Trial";

  async function handleApplyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
    <section className={compactPanelClassName}>
      <PanelHeader
        eyebrow="Billing"
        title="Plan access"
        description="Current workspace plan."
        icon={CreditCard}
      />

      {notice ? <StatusMessage tone="success">{notice}</StatusMessage> : null}
      {error ? <StatusMessage tone="error">{error}</StatusMessage> : null}

      <div className="mt-6 rounded-lg border border-border p-4">
        <span
          className="inline-flex h-8 items-center gap-2 rounded-full border px-3 text-sm font-semibold"
          style={{
            background: `color-mix(in oklch, ${planColor} 12%, transparent)`,
            borderColor: `color-mix(in oklch, ${planColor} 25%, transparent)`,
            color: planColor,
          }}
        >
          <BadgeCheck className="size-4" />
          {planLabel}
        </span>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {currentPlan === "trial"
            ? "Apply an access code to unlock paid features."
            : "Your plan is active. Contact the team to change your subscription."}
        </p>
      </div>

      {isOwner ? (
        <form onSubmit={handleApplyCode} className="mt-5 space-y-3">
          <SettingsField label="Apply access code" htmlFor="billing-access-code">
            <Input
              id="billing-access-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="e.g. ENT-2026"
              className={cn(compactInputClassName, "font-mono")}
              disabled={pending}
            />
          </SettingsField>
          <Button
            type="submit"
            disabled={!code.trim() || pending}
            className="h-10 w-full rounded-lg bg-neutral-950 px-4 text-sm font-semibold !text-white hover:bg-neutral-800 hover:!text-white"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
            Apply
          </Button>
          <p className="text-xs leading-5 text-muted-foreground">
            Access codes are provided by the Payvio team. Contact{" "}
            <a href="mailto:info.procrasti@gmail.com" className="underline">
              info.procrasti@gmail.com
            </a>{" "}
            to get one.
          </p>
        </form>
      ) : null}
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
    <section className={compactPanelClassName}>
      <PanelHeader
        eyebrow="Danger zone"
        title="Delete organization"
        description="Only use this when this workspace should be removed."
        icon={AlertTriangle}
      />

      {error ? <StatusMessage tone="error">{error}</StatusMessage> : null}
      {!canDelete ? (
        <StatusMessage tone="warning">Your role cannot delete this organization.</StatusMessage>
      ) : null}

      <div className="mt-6 space-y-3">
        <SettingsField label="Confirm organization name" htmlFor="delete-organization-name">
          <Input
            id="delete-organization-name"
            value={confirmationName}
            onChange={(event) => setConfirmationName(event.target.value)}
            disabled={!canDelete || pending}
            className={compactInputClassName}
          />
        </SettingsField>
        <Button
          type="button"
          variant="outline"
          disabled={!canDelete || !confirmed || pending}
          onClick={handleDelete}
          className="h-10 w-full rounded-lg px-4 text-sm text-red-600 hover:text-red-700"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          Delete organization
        </Button>
      </div>
    </section>
  );
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
  const generateImageUploadUrl = useMutation(
    api.organizations.generateOrganizationImageUploadUrl,
  );
  const updateOrganizationImage = useMutation(api.organizations.updateOrganizationImage);
  const removeOrganizationImage = useMutation(api.organizations.removeOrganizationImage);
  const [form, setForm] = useState<SettingsForm>(initialForm);
  const [pending, setPending] = useState(false);
  const [pendingImage, setPendingImage] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageInputKey, setImageInputKey] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const workspaceImageUrl = workspace?.imageUrl ?? "";
  const workspaceInitial = (workspace?.name ?? form.name).trim().slice(0, 1).toUpperCase() || "W";

  async function handleImageUpload() {
    setNotice(null);
    setError(null);

    if (!canManageSettings) {
      setError("Your role cannot change organization profile settings.");
      return;
    }

    if (!imageFile) {
      setError("Choose an image file first.");
      return;
    }

    if (!organizationImageAccept.split(",").includes(imageFile.type)) {
      setError("Use a PNG, JPG, WebP, or GIF image.");
      return;
    }

    if (imageFile.size > maxOrganizationImageBytes) {
      setError("Organization image must be 5 MB or smaller.");
      return;
    }

    setPendingImage(true);

    try {
      const uploadUrl = await generateImageUploadUrl({});
      const upload = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": imageFile.type || "application/octet-stream" },
        body: imageFile,
      });

      if (!upload.ok) {
        throw new Error("Unable to upload organization image.");
      }

      const uploadJson = (await upload.json()) as { storageId: string };

      await updateOrganizationImage({
        storageId: uploadJson.storageId as Id<"_storage">,
        fileName: imageFile.name,
      });
      setImageFile(null);
      setImageInputKey((current) => current + 1);
      setNotice("Organization image saved.");
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Unable to save organization image.",
      );
    } finally {
      setPendingImage(false);
    }
  }

  async function handleRemoveImage() {
    setNotice(null);
    setError(null);

    if (!canManageSettings) {
      setError("Your role cannot change organization profile settings.");
      return;
    }

    setPendingImage(true);

    try {
      await removeOrganizationImage({});
      setImageFile(null);
      setImageInputKey((current) => current + 1);
      setNotice("Organization image removed.");
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Unable to remove organization image.",
      );
    } finally {
      setPendingImage(false);
    }
  }

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
    <form onSubmit={handleSubmit} className={panelClassName}>
      <PanelHeader
        eyebrow="Workspace"
        title="Organization profile"
        description="Details used on invoices and client payment instructions."
        icon={Building2}
      />

      {notice ? <StatusMessage tone="success">{notice}</StatusMessage> : null}
      {error ? <StatusMessage tone="error">{error}</StatusMessage> : null}
      {!canManageSettings ? (
        <StatusMessage tone="warning">Your role cannot change organization profile settings.</StatusMessage>
      ) : null}

      <fieldset disabled={!canManageSettings || pending || pendingImage} className="mt-6 space-y-8">
        <FormSection title="Business details">
          <div className="grid gap-4 rounded-lg border border-border bg-background p-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
            {workspaceImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={workspaceImageUrl}
                alt=""
                className="size-16 shrink-0 rounded-lg object-cover"
              />
            ) : (
              <span className="grid size-16 shrink-0 place-items-center rounded-lg bg-primary text-xl font-semibold text-primary-foreground">
                {workspaceInitial}
              </span>
            )}
            <div className="min-w-0">
              <SettingsField label="Organization image" htmlFor="organization-image">
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                  <Input
                    key={imageInputKey}
                    id="organization-image"
                    type="file"
                    accept={organizationImageAccept}
                    onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
                    className={inputClassName}
                  />
                  <Button
                    type="button"
                    disabled={!imageFile || pendingImage || !canManageSettings}
                    onClick={handleImageUpload}
                    className="h-11 rounded-lg bg-neutral-950 px-5 text-base font-semibold !text-white hover:bg-neutral-800 hover:!text-white"
                  >
                    {pendingImage ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}
                    Upload
                  </Button>
                  {workspaceImageUrl ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={pendingImage || !canManageSettings}
                      onClick={handleRemoveImage}
                      className="h-11 rounded-lg px-4 text-base"
                    >
                      {pendingImage ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
                      Remove
                    </Button>
                  ) : null}
                </div>
              </SettingsField>
            </div>
          </div>

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
              className={inputClassName}
            />
          </SettingsField>

          <div className="grid gap-3 sm:grid-cols-2">
            <SettingsField label="Legal name" htmlFor="legal-name">
              <Input
                id="legal-name"
                value={form.legalName}
                onChange={(event) => setForm((current) => ({ ...current, legalName: event.target.value }))}
                className={inputClassName}
              />
            </SettingsField>
            <SettingsField label="Trading name" htmlFor="trading-name">
              <Input
                id="trading-name"
                value={form.tradingName}
                onChange={(event) => setForm((current) => ({ ...current, tradingName: event.target.value }))}
                className={inputClassName}
              />
            </SettingsField>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <SettingsField label="Entity type" htmlFor="entity-type">
              <SelectControl
                id="entity-type"
                value={form.entityType}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    entityType: value as SettingsForm["entityType"],
                  }))
                }
                disabled={!canManageSettings || pending}
                className={selectClassName}
                options={[
                  { value: "sole_proprietor", label: "Sole proprietor" },
                  { value: "close_corporation", label: "Close corporation" },
                  { value: "private_company", label: "Private company" },
                  { value: "partnership", label: "Partnership" },
                  { value: "ngo", label: "NGO" },
                  { value: "other", label: "Other" },
                ]}
              />
            </SettingsField>
            <SettingsField label="Region" htmlFor="region">
              <Input
                id="region"
                value={form.region}
                onChange={(event) => setForm((current) => ({ ...current, region: event.target.value }))}
                className={inputClassName}
              />
            </SettingsField>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <SettingsField label="Phone / WhatsApp" htmlFor="phone">
              <Input
                id="phone"
                value={form.phone}
                onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                className={inputClassName}
              />
            </SettingsField>
            <SettingsField label="Tax ID" htmlFor="tax-id">
              <Input
                id="tax-id"
                value={form.taxId}
                onChange={(event) => setForm((current) => ({ ...current, taxId: event.target.value }))}
                className={inputClassName}
              />
            </SettingsField>
          </div>

          <SettingsField label="Business address" htmlFor="business-address">
            <Textarea
              id="business-address"
              value={form.address}
              onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
              className={textareaClassName}
            />
          </SettingsField>
        </FormSection>

        <FormSection title="Invoice defaults">
          <div className="grid gap-3 sm:grid-cols-2">
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
                className={cn(inputClassName, "uppercase")}
              />
            </SettingsField>
            <SettingsField label="Invoice prefix" htmlFor="invoice-prefix">
              <Input
                id="invoice-prefix"
                value={form.invoicePrefix}
                onChange={(event) => setForm((current) => ({ ...current, invoicePrefix: event.target.value.toUpperCase() }))}
                className={cn(inputClassName, "uppercase")}
              />
            </SettingsField>
          </div>

          <SettingsField label="Default terms" htmlFor="default-terms">
            <Input
              id="default-terms"
              value={form.defaultTerms}
              onChange={(event) => setForm((current) => ({ ...current, defaultTerms: event.target.value }))}
              className={inputClassName}
            />
          </SettingsField>
        </FormSection>

        <FormSection title="EFT bank details">
          <div className="grid gap-3 sm:grid-cols-2">
            <SettingsField label="Bank name" htmlFor="bank-name">
              <Input
                id="bank-name"
                value={form.bankName}
                onChange={(event) => setForm((current) => ({ ...current, bankName: event.target.value }))}
                className={inputClassName}
              />
            </SettingsField>
            <SettingsField label="Account name" htmlFor="bank-account-name">
              <Input
                id="bank-account-name"
                value={form.bankAccountName}
                onChange={(event) => setForm((current) => ({ ...current, bankAccountName: event.target.value }))}
                className={inputClassName}
              />
            </SettingsField>
            <SettingsField label="Account number" htmlFor="bank-account-number">
              <Input
                id="bank-account-number"
                value={form.bankAccountNumber}
                onChange={(event) => setForm((current) => ({ ...current, bankAccountNumber: event.target.value }))}
                className={inputClassName}
              />
            </SettingsField>
            <SettingsField label="Branch code" htmlFor="branch-code">
              <Input
                id="branch-code"
                value={form.branchCode}
                onChange={(event) => setForm((current) => ({ ...current, branchCode: event.target.value }))}
                className={inputClassName}
              />
            </SettingsField>
          </div>
          <SettingsField label="SWIFT code" htmlFor="swift-code">
            <Input
              id="swift-code"
              value={form.swiftCode}
              onChange={(event) => setForm((current) => ({ ...current, swiftCode: event.target.value.toUpperCase() }))}
              className={cn(inputClassName, "uppercase")}
            />
          </SettingsField>
        </FormSection>

        <FormSection title="Payment instructions">
          <SettingsField label="Payment instructions" htmlFor="payment-instructions">
            <Textarea
              id="payment-instructions"
              value={form.paymentInstructions}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  paymentInstructions: event.target.value,
                }))
              }
              className={textareaClassName}
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
              className={inputClassName}
            />
          </SettingsField>
        </FormSection>

        <Button
          type="submit"
          disabled={pending || pendingImage || !canManageSettings}
          className="h-11 rounded-lg bg-neutral-950 px-5 text-base font-semibold !text-white hover:bg-neutral-800 hover:!text-white"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save settings
        </Button>
      </fieldset>
    </form>
  );
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4 border-t border-border pt-6 first:border-t-0 first:pt-0">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <div className="space-y-3">{children}</div>
    </div>
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
    <div className="min-w-0 space-y-2">
      <Label htmlFor={htmlFor} className="text-sm font-semibold text-foreground">
        {label}
      </Label>
      {children}
    </div>
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
    return "Invoices and payments";
  }

  if (role === "member") {
    return "Day-to-day records";
  }

  return "Read-only workspace";
}

function memberInitial(value: string) {
  return (value.trim().slice(0, 1) || "P").toUpperCase();
}
