"use client";

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Loader2,
  MailPlus,
  Save,
  Trash2,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";

type Workspace = Doc<"organizations">;
type InviteRole = "admin" | "finance" | "viewer" | "member";
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
  const workspace = useQuery(api.invoices.workspace);
  const loading = workspace === undefined;

  const workspaceVersion = workspace
    ? `${workspace._id}:${workspace.updatedAt}`
    : "new";

  return (
    <div className="db-page">
      <div className="db-page-header">
        <div>
          <p className="db-page-eyebrow">Workspace settings</p>
          <h1 className="db-page-title">Settings</h1>
        </div>
        <Link href="/dashboard" className="db-outline-btn">
          <ArrowLeft className="size-4" />
          Dashboard
        </Link>
      </div>

      {loading ? (
        <section className="db-card grid max-w-3xl gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-12 rounded-lg bg-[#f1f1ee]" />
          ))}
        </section>
      ) : workspace ? (
        <div className="grid max-w-3xl gap-5">
          <SettingsEditor
            key={workspaceVersion}
            workspace={workspace}
            initialForm={settingsFromWorkspace(workspace)}
          />
          <TeamInvitationsPanel />
        </div>
      ) : (
        <section className="db-card grid max-w-3xl gap-3">
          <h2 className="text-lg font-semibold text-[#050505]">Workspace setup required</h2>
          <p className="text-sm text-[#686b70]">
            Create or join an organization before editing settings.
          </p>
          <Link href="/onboarding" className="db-primary-btn w-max">Open setup</Link>
        </section>
      )}
    </div>
  );
}

function TeamInvitationsPanel() {
  const state = useQuery(api.organizations.onboardingState);
  const invitations = useQuery(api.organizations.listInvitations, {
    status: "pending",
  });
  const createInvitation = useMutation(api.organizations.createInvitation);
  const revokeInvitation = useMutation(api.organizations.revokeInvitation);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteRole>("finance");
  const [pending, setPending] = useState(false);
  const [revokingId, setRevokingId] =
    useState<Id<"organizationInvitations"> | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canManageTeam =
    state?.membership?.role === "owner" || state?.membership?.role === "admin";

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

  if (state === undefined || invitations === undefined) {
    return (
      <section className="db-card grid gap-3">
        <div className="h-5 w-32 rounded bg-[#ecece8]" />
        <div className="h-10 rounded bg-[#ecece8]" />
      </section>
    );
  }

  return (
    <section className="db-card grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-[#505258]">
            <Users className="size-4 text-[#009b68]" />
            Team access
          </div>
          <p className="mt-1 text-sm text-[#686b70]">
            Create invite links for this organization.
          </p>
        </div>
        <Badge variant={canManageTeam ? "success" : "warning"}>
          {canManageTeam ? "Owner/admin" : "Restricted"}
        </Badge>
      </div>

      {notice ? (
        <p className="flex items-center gap-2 rounded-lg border border-[#bfe8d8] bg-[#ecf8f2] p-3 text-sm text-[#006545]">
          <CheckCircle2 className="size-4 shrink-0" />
          {notice}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-[#ffc7d1] bg-[#fff0f3] p-3 text-sm text-[#a51f43]">
          {error}
        </p>
      ) : null}

      {canManageTeam ? (
        <form onSubmit={handleInvite} className="grid gap-3 rounded-lg border border-[#deded8] bg-[#f1f1ee] p-3">
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
                onChange={(event) => setRole(event.target.value as InviteRole)}
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
              className="self-end bg-[#009b68] text-white hover:bg-[#00875b]"
            >
              {pending ? <Loader2 className="animate-spin" /> : <MailPlus />}
              Create link
            </Button>
          </div>
        </form>
      ) : (
        <p className="rounded-lg border border-[#f7e09b] bg-[#fff9df] p-3 text-sm text-[#7d6000]">
          Only owners and admins can invite teammates.
        </p>
      )}

      <div className="grid gap-2">
        <p className="text-[13px] font-medium text-[#505258]">Pending invites</p>
        {invitations.length === 0 ? (
          <p className="rounded-lg border border-[#deded8] bg-[#f1f1ee] p-3 text-sm text-[#686b70]">
            No pending invites.
          </p>
        ) : (
          invitations.map((invitation) => (
            <div
              key={invitation._id}
              className="flex flex-col gap-3 rounded-lg border border-[#deded8] bg-[#f1f1ee] p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-semibold text-[#050505]">
                  {invitation.email}
                </p>
                <p className="text-xs text-[#686b70]">
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
                    className="border-[#deded8] bg-[#f6f6f4]"
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
                    className="border-[#ffc7d1] bg-[#fff0f3] text-[#a51f43] hover:bg-[#ffe5eb]"
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

function inviteUrl(token: string) {
  if (typeof window === "undefined") {
    return `/join/${token}`;
  }

  return `${window.location.origin}/join/${token}`;
}

function roleLabel(role: string) {
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

function SettingsEditor({
  workspace,
  initialForm,
}: {
  workspace: Workspace | null;
  initialForm: SettingsForm;
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
        vatNumber: form.vatNumber,
        vatRegistered: form.vatRegistered,
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
      className="db-card grid max-w-3xl gap-5"
    >
      {notice ? (
        <p className="flex items-center gap-2 rounded-lg border border-[#bfe8d8] bg-[#ecf8f2] p-3 text-sm text-[#006545]">
          <CheckCircle2 className="size-4 shrink-0" />
          {notice}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-[#ffc7d1] bg-[#fff0f3] p-3 text-sm text-[#a51f43]">
          {error}
        </p>
      ) : null}

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

      <div className="grid gap-3 rounded-lg border border-[#deded8] bg-[#f1f1ee] p-3">
        <label className="flex items-center gap-2 text-[13px] font-medium text-[#505258]">
          <input type="checkbox" checked={form.vatRegistered} onChange={(event) => setForm((current) => ({ ...current, vatRegistered: event.target.checked }))} />
          VAT registered
        </label>
        <SettingsField label="VAT number" htmlFor="vat-number">
          <Input id="vat-number" value={form.vatNumber} onChange={(event) => setForm((current) => ({ ...current, vatNumber: event.target.value }))} disabled={!form.vatRegistered} className="h-10 border-[#d7d7d1] bg-[#f6f6f4] text-[13px] font-normal disabled:text-[#9ca3af]" />
        </SettingsField>
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

      <div className="grid gap-3 rounded-lg border border-[#deded8] bg-[#f1f1ee] p-3">
        <p className="text-[13px] font-medium text-[#505258]">EFT bank details</p>
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
        disabled={pending}
        className="h-10 w-full bg-[#009b68] text-white hover:bg-[#00875b] hover:text-white sm:w-max"
      >
        {pending ? <Loader2 className="animate-spin" /> : <Save />}
        Save settings
      </Button>
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
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor} className="text-[13px] font-medium text-[#505258]">
        {label}
      </Label>
      {children}
    </div>
  );
}
