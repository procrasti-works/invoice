"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import {
  CheckCircle2,
  Copy,
  LifeBuoy,
  Mail,
  MessageSquareText,
  Settings,
  ShieldCheck,
  UserCog,
} from "@/app/_components/IconPack";

import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type SupportState = {
  user: { name: string; email: string };
  membership: Doc<"memberships">;
  organization: Doc<"organizations">;
  members: Array<{
    membership: Doc<"memberships">;
    current: boolean;
    user: { name: string; email: string };
  }>;
  pendingInvitations: Array<
    Doc<"organizationInvitations"> & { expired: boolean; token: string }
  >;
};

const supportTeam = [
  {
    initials: "NH",
    name: "Nazeem Harris",
    role: "Founder support",
    email: "inthelooppodastnazeem@gmail.com",
  },
  {
    initials: "AM",
    name: "Andreas Mukombabi",
    role: "Founder support",
    email: "info.procrasti@gmail.com",
  },
];

const supportTracks = [
  {
    title: "Account access",
    copy: "Sign-in issues, locked accounts, invites, workspace access, and role changes.",
  },
  {
    title: "Invoices and ledger",
    copy: "Invoice links, payment status, reminders, client records, reports, and exports.",
  },
  {
    title: "VAT and compliance",
    copy: "VAT settings, record checks, report exports, and supplier purchase capture.",
  },
  {
    title: "Security and billing",
    copy: "Suspicious access, subscription questions, admin handover, and data requests.",
  },
];

const supportChecklist = [
  "Workspace name and your login email",
  "Invoice, client, report, or VAT period involved",
  "Screenshot or exact error text",
  "What changed and what result you expected",
];
const primaryButtonClass = "bg-primary text-primary-foreground hover:bg-primary/90";

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

function memberInitial(value: string) {
  const trimmed = value.trim();
  return (trimmed ? trimmed.slice(0, 1) : "P").toUpperCase();
}

function buildMailto({
  to,
  cc,
  workspaceName,
  userEmail,
  role,
}: {
  to: string;
  cc?: string;
  workspaceName: string;
  userEmail: string;
  role: string;
}) {
  const params = new URLSearchParams({
    subject: `Payvio support - ${workspaceName}`,
    body: [
      `Workspace: ${workspaceName}`,
      `User: ${userEmail || "Not available"}`,
      `Role: ${role}`,
      "",
      "Issue:",
      "",
      "Steps already tried:",
    ].join("\n"),
  });

  if (cc) {
    params.set("cc", cc);
  }

  return `mailto:${to}?${params.toString()}`;
}

export function SupportPage() {
  const state = useQuery(api.organizations.settingsState) as
    | SupportState
    | undefined;
  const [copied, setCopied] = useState(false);

  const workspaceName = state?.organization.name ?? "Payvio workspace";
  const userEmail = state?.user.email ?? "";
  const currentRole = roleLabel(state?.membership.role ?? "member");
  const ownerAndAdmins = useMemo(
    () =>
      (state?.members ?? [])
        .filter((member) =>
          ["owner", "admin"].includes(member.membership.role),
        )
        .sort((a, b) => {
          if (a.membership.role === b.membership.role) {
            return (a.user.email || a.user.name).localeCompare(
              b.user.email || b.user.name,
            );
          }

          return a.membership.role === "owner" ? -1 : 1;
        }),
    [state?.members],
  );
  const primaryMailto = buildMailto({
    to: supportTeam[0].email,
    cc: supportTeam[1].email,
    workspaceName,
    userEmail,
    role: currentRole,
  });

  async function copySupportDetails() {
    if (!state || !navigator.clipboard?.writeText) {
      return;
    }

    await navigator.clipboard.writeText(
      [
        `Workspace: ${workspaceName}`,
        `Workspace ID: ${state.organization._id}`,
        `User: ${state.user.email}`,
        `Role: ${currentRole}`,
        `Currency: ${state.organization.defaultCurrency}`,
        `Admins: ${ownerAndAdmins
          .map((member) => member.user.email || member.user.name || "No email")
          .join(", ")}`,
      ].join("\n"),
    );
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="flex flex-col gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Payvio / Support</p>
            <h1 className="text-2xl font-semibold tracking-tight">Support</h1>
          </div>
          <Button asChild className={primaryButtonClass}>
            <a href={primaryMailto}>
              <Mail className="size-4" />
              Email support
            </a>
          </Button>
        </div>

        <Card>
          <CardHeader className="gap-4 sm:flex sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <LifeBuoy className="size-5" />
                Support desk
              </CardTitle>
              <CardDescription>Email Payvio for product issues. Ask admins for access changes.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{workspaceName}</Badge>
              <Badge variant="outline">{currentRole}</Badge>
            </div>
          </CardHeader>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquareText className="size-4" />
                  Payvio support
                </CardTitle>
                <CardDescription>Contact one of the support leads.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3">
              {supportTeam.map((person) => (
                <article className="flex items-center gap-3 rounded-lg border p-3" key={person.email}>
                  <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-sm font-medium">{person.initials}</span>
                  <div className="min-w-0">
                    <div className="font-medium">{person.name}</div>
                    <div className="text-xs text-muted-foreground">{person.role}</div>
                    <a className="break-all text-sm text-muted-foreground hover:text-foreground" href={buildMailto({
                      to: person.email,
                      workspaceName,
                      userEmail,
                      role: currentRole,
                    })}>
                      {person.email}
                    </a>
                  </div>
                </article>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="size-4" />
                  Support packet
                </CardTitle>
                <CardDescription>Copy these details when reporting an issue.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4">
            <div className="grid gap-3">
              <div className="flex items-center justify-between gap-3">
                <span>Workspace</span>
                <strong className="text-right">{workspaceName}</strong>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Your email</span>
                <strong className="text-right">{userEmail || "Not available"}</strong>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Your role</span>
                <strong>{currentRole}</strong>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Currency</span>
                <strong>{state?.organization.defaultCurrency ?? "NAD"}</strong>
              </div>
            </div>
            <Separator />
            <Button
              variant="outline"
              type="button"
              disabled={!state}
              onClick={copySupportDetails}
            >
              {copied ? (
                <CheckCircle2 className="size-4" />
              ) : (
                <Copy className="size-4" />
              )}
              {copied ? "Copied" : "Copy details"}
            </Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Card>
            <CardHeader>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <LifeBuoy className="size-4" />
                  What to include
                </CardTitle>
                <CardDescription>Send the basics first.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {supportChecklist.map((item) => (
                <div className="flex items-center gap-2 rounded-lg border p-3 text-sm" key={item}>
                  <CheckCircle2 className="size-4" />
                  <span>{item}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <UserCog className="size-4" />
                  Workspace contacts
                </CardTitle>
                <CardDescription>Admins can help with access.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3">
              {state === undefined ? (
                <span className="text-sm text-muted-foreground">Loading admins...</span>
              ) : ownerAndAdmins.length > 0 ? (
                ownerAndAdmins.map((member) => (
                  <article className="flex items-center gap-3 rounded-lg border p-3" key={member.membership._id}>
                    <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-sm font-medium">
                      {memberInitial(member.user.email || member.user.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">
                        {member.user.name || member.user.email || "Workspace admin"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {roleLabel(member.membership.role)}
                        {member.current ? " - you" : ""}
                      </div>
                    </div>
                    {member.user.email ? (
                      <Button asChild variant="outline" size="icon">
                        <a href={`mailto:${member.user.email}`} aria-label="Email admin">
                          <Mail className="size-4" />
                        </a>
                      </Button>
                    ) : null}
                  </article>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">No admins found.</span>
              )}
              <Button asChild variant="outline">
                <Link href="/dashboard/settings">
                  <Settings className="size-4" />
                  Manage access
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Support areas</CardTitle>
            <CardDescription>Pick the closest topic.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {supportTracks.map((track) => (
              <article className="rounded-lg border p-4" key={track.title}>
                <div className="font-medium">{track.title}</div>
                <p className="mt-2 text-sm text-muted-foreground">{track.copy}</p>
              </article>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
