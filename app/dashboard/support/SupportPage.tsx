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
} from "lucide-react";

import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";

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
    copy: "VAT settings, ITAS-ready exports, record checks, and supplier purchase capture.",
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
    <div className="db-page db-dashboard-page db-support-page">
      <section className="db-workview">
        <div className="db-workview-head">
          <div>
            <p className="db-breadcrumb">
              Payvio <span>/</span> Support
            </p>
            <h1 className="db-workview-title">Support</h1>
          </div>
          <a className="db-primary-btn db-support-primary" href={primaryMailto}>
            <Mail className="size-4" />
            Email support
          </a>
        </div>

        <div className="db-support-hero">
          <div>
            <span className="db-support-hero-icon">
              <LifeBuoy className="size-5" />
            </span>
            <h2>Support desk</h2>
            <p>
              Email Payvio for product issues. Use workspace admins for access
              and role changes.
            </p>
          </div>
          <div className="db-support-hero-meta">
            <span>{workspaceName}</span>
            <strong>{currentRole}</strong>
          </div>
        </div>

        <div className="db-support-grid">
          <section className="db-card db-support-card db-support-contact-card">
            <div className="db-support-card-head">
              <div>
                <p className="db-panel-kicker">Contact</p>
                <h2>Payvio support</h2>
              </div>
              <MessageSquareText className="size-4" />
            </div>
            <div className="db-support-contact-list">
              {supportTeam.map((person) => (
                <article className="db-support-person" key={person.email}>
                  <span className="db-support-avatar">{person.initials}</span>
                  <div>
                    <strong>{person.name}</strong>
                    <small>{person.role}</small>
                    <a href={buildMailto({
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
            </div>
          </section>

          <section className="db-card db-support-card">
            <div className="db-support-card-head">
              <div>
                <p className="db-panel-kicker">Details</p>
                <h2>Support packet</h2>
              </div>
              <ShieldCheck className="size-4" />
            </div>
            <div className="db-support-info-list">
              <div>
                <span>Workspace</span>
                <strong>{workspaceName}</strong>
              </div>
              <div>
                <span>Your email</span>
                <strong>{userEmail || "Not available"}</strong>
              </div>
              <div>
                <span>Your role</span>
                <strong>{currentRole}</strong>
              </div>
              <div>
                <span>Currency</span>
                <strong>{state?.organization.defaultCurrency ?? "NAD"}</strong>
              </div>
            </div>
            <button
              className="db-outline-btn db-support-copy"
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
            </button>
          </section>
        </div>

        <div className="db-support-grid db-support-grid-wide">
          <section className="db-card db-support-card db-support-wide">
            <div className="db-support-card-head">
              <div>
                <p className="db-panel-kicker">Standard support</p>
                <h2>What to include</h2>
              </div>
              <LifeBuoy className="size-4" />
            </div>
            <div className="db-support-checklist">
              {supportChecklist.map((item) => (
                <div key={item}>
                  <CheckCircle2 className="size-4" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="db-card db-support-card">
            <div className="db-support-card-head">
              <div>
                <p className="db-panel-kicker">Admins</p>
                <h2>Workspace contacts</h2>
              </div>
              <UserCog className="size-4" />
            </div>
            <div className="db-support-admin-list">
              {state === undefined ? (
                <span className="db-support-empty-row">Loading admins...</span>
              ) : ownerAndAdmins.length > 0 ? (
                ownerAndAdmins.map((member) => (
                  <article className="db-support-admin" key={member.membership._id}>
                    <span className="db-support-avatar">
                      {memberInitial(member.user.email || member.user.name)}
                    </span>
                    <div>
                      <strong>
                        {member.user.name || member.user.email || "Workspace admin"}
                      </strong>
                      <small>
                        {roleLabel(member.membership.role)}
                        {member.current ? " - you" : ""}
                      </small>
                    </div>
                    {member.user.email ? (
                      <a href={`mailto:${member.user.email}`}>
                        <Mail className="size-4" />
                      </a>
                    ) : null}
                  </article>
                ))
              ) : (
                <span className="db-support-empty-row">No admins found.</span>
              )}
            </div>
            <Link href="/dashboard/settings" className="db-outline-btn db-support-copy">
              <Settings className="size-4" />
              Manage access
            </Link>
          </section>
        </div>

        <section className="db-card db-support-card db-support-wide">
          <div className="db-support-card-head">
            <div>
              <p className="db-panel-kicker">Topics</p>
              <h2>Support areas</h2>
            </div>
          </div>
          <div className="db-support-track-grid">
            {supportTracks.map((track) => (
              <article key={track.title}>
                <strong>{track.title}</strong>
                <span>{track.copy}</span>
              </article>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}
