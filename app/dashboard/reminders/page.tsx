"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  ExternalLink,
  Mail,
  Phone,
  UserRound,
} from "lucide-react";

import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { usePlan } from "@/lib/plan";
import { LockedPage } from "../_components/DashboardShell";

type Invoice = Doc<"invoices">;
type Client = Doc<"clients">;
type Reminder = Doc<"reminders">;
type ReminderRow = {
  invoice: Invoice;
  client: Client | null;
  reminders: Reminder[];
};
type ReminderKind = "reminder" | "overdue";

const statusLabels: Record<Invoice["status"], string> = {
  draft: "Draft",
  ready: "Ready",
  sent: "Sent",
  viewed: "Viewed",
  approved: "Approved",
  awaiting_payment: "Awaiting payment",
  rejected: "Rejected",
  paid: "Paid",
  overdue: "Overdue",
  void: "Void",
};

function formatMoney(amount: number, currency = "NAD") {
  try {
    return new Intl.NumberFormat("en-NA", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat("en-NA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(timestamp));
}

function invoiceTotal(invoice: Invoice) {
  return invoice.balanceDue ?? invoice.total ?? invoice.amountTotal ?? invoice.amount ?? 0;
}

function rowClientName(row: ReminderRow) {
  return row.client?.name ?? row.invoice.clientName ?? row.invoice.client ?? "Client";
}

function rowClientEmail(row: ReminderRow) {
  return row.client?.email ?? row.invoice.clientEmail ?? "";
}

function rowClientPhone(row: ReminderRow) {
  return row.client?.phone ?? row.invoice.clientSnapshot?.phone ?? "";
}

function gmailHref(to: string, subject: string, body: string) {
  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to,
    su: subject,
    body,
  });

  return `https://mail.google.com/mail/?${params.toString()}`;
}

function buildFollowUpDraft(
  row: ReminderRow,
  invoiceUrl: string,
  senderName: string,
  kind: ReminderKind,
) {
  const { invoice } = row;
  const clientName = rowClientName(row);
  const amount = formatMoney(invoiceTotal(invoice), invoice.currency ?? "NAD");
  const subject =
    kind === "overdue"
      ? `Overdue invoice ${invoice.invoiceNumber}`
      : `Reminder: ${invoice.invoiceNumber}`;
  const body =
    kind === "overdue"
      ? [
          `Hi ${clientName},`,
          "",
          `${invoice.invoiceNumber} for ${amount} is now overdue.`,
          `You can review it here: ${invoiceUrl}`,
          "",
          "Please arrange payment or reply if anything needs attention.",
          "",
          "Thanks,",
          senderName,
        ].join("\n")
      : [
          `Hi ${clientName},`,
          "",
          `Reminder for ${invoice.invoiceNumber} for ${amount}, due ${invoice.dueDate}.`,
          `You can review it here: ${invoiceUrl}`,
          "",
          "Please approve it or reply with any questions.",
          "",
          "Thanks,",
          senderName,
        ].join("\n");

  return {
    subject,
    body,
    gmailHref: gmailHref(rowClientEmail(row), subject, body),
  };
}

export default function RemindersPage() {
  const { canAccess } = usePlan();
  const reminderRows = useQuery(api.invoices.listReminderQueue) as ReminderRow[] | undefined;
  const workspace = useQuery(api.invoices.workspace);
  const scheduleReminder = useMutation(api.invoices.scheduleReminder);
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const rows = useMemo(() => reminderRows ?? [], [reminderRows]);
  const overdueRows = rows.filter(({ invoice }) => invoice.status === "overdue");
  const activeRows = rows.filter(({ invoice }) => invoice.status !== "overdue");
  const scheduledCount = rows.reduce(
    (total, row) =>
      total + row.reminders.filter((reminder) => reminder.status === "scheduled").length,
    0,
  );
  const linkedClientCount = rows.filter((row) => row.client !== null).length;
  const senderName =
    workspace?.tradingName?.trim() ||
    workspace?.legalName?.trim() ||
    workspace?.name?.trim() ||
    "Payvio";

  if (!canAccess("reminders")) {
    return <LockedPage feature="Reminders" requiredPlan="Starter" />;
  }

  async function handleReminder(row: ReminderRow, kind: ReminderKind) {
    const { invoice } = row;

    if (!invoice.publicToken) {
      setNotice("Prepare the invoice link before sending a reminder.");
      return;
    }

    setPending(`${kind}-${invoice._id}`);
    setNotice(null);
    const emailWindow = window.open("", "_blank");

    try {
      const link = `${window.location.origin}/invoice/${invoice.publicToken}`;
      const draft = buildFollowUpDraft(row, link, senderName, kind);

      await scheduleReminder({
        id: invoice._id,
        message:
          kind === "overdue"
            ? `Overdue notice prepared for ${rowClientName(row)}.`
            : `Reminder prepared for ${rowClientName(row)}.`,
      });

      if (emailWindow) {
        emailWindow.location.href = draft.gmailHref;
      }

      setNotice(
        kind === "overdue"
          ? `${invoice.invoiceNumber} overdue email opened.`
          : `${invoice.invoiceNumber} reminder email opened.`,
      );
    } catch (error) {
      emailWindow?.close();
      setNotice(error instanceof Error ? error.message : "Unable to prepare reminder.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="db-page db-dashboard-page db-reminders-page">
      <section className="db-workview">
        <div className="db-workview-head">
          <div>
            <p className="db-breadcrumb">Payvio <span>/</span> Reminders</p>
            <h1 className="db-workview-title">Reminders</h1>
          </div>
        </div>

        <div className="db-metric-strip" aria-label="Reminder metrics">
          <div className="db-metric-cell">
            <span>Active invoices</span>
            <strong>{activeRows.length}</strong>
            <small>Ready to follow up</small>
          </div>
          <div className="db-metric-cell">
            <span>Overdue</span>
            <strong>{overdueRows.length}</strong>
            <small>Needs attention</small>
          </div>
          <div className="db-metric-cell">
            <span>Scheduled</span>
            <strong>{scheduledCount}</strong>
            <small>Prepared follow-ups</small>
          </div>
          <div className="db-metric-cell">
            <span>Linked clients</span>
            <strong>{linkedClientCount}</strong>
            <small>Saved profiles</small>
          </div>
        </div>

        {notice ? (
          <div className="db-notice db-notice-clean">
            <CheckCircle2 className="size-4" />
            <span>{notice}</span>
          </div>
        ) : null}

        {rows.length === 0 ? (
          <div className="db-card db-reminders-card">
            <div className="db-empty">
              <Bell className="size-10 text-[#d1d5db]" />
              <h3>No invoices need reminders</h3>
              <p>Sent, approved, awaiting payment, and overdue invoices will appear here.</p>
            </div>
          </div>
        ) : (
          <div className="db-reminders-layout">
            {overdueRows.length > 0 ? (
              <section className="db-card db-reminders-card db-reminders-card-overdue">
                <div className="db-panel-header">
                  <div>
                    <p className="db-panel-kicker">Past due</p>
                    <h2>Overdue invoices</h2>
                  </div>
                  <span className="db-panel-meta">
                    <AlertTriangle className="size-3.5" /> {overdueRows.length}
                  </span>
                </div>
                <div className="db-reminder-list db-reminder-list-clean">
                  {overdueRows.map((row) => (
                    <ReminderCard
                      key={row.invoice._id}
                      row={row}
                      kind="overdue"
                      pending={pending}
                      onSend={handleReminder}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            <section className="db-card db-reminders-card">
              <div className="db-panel-header">
                <div>
                  <p className="db-panel-kicker">Follow up</p>
                  <h2>Active invoices</h2>
                </div>
                <span className="db-panel-meta">
                  <Clock className="size-3.5" /> {activeRows.length}
                </span>
              </div>
              {activeRows.length === 0 ? (
                <div className="db-empty">
                  <Bell className="size-10 text-[#d1d5db]" />
                  <h3>No active invoices</h3>
                  <p>Invoices sent to clients will appear here.</p>
                </div>
              ) : (
                <div className="db-reminder-list db-reminder-list-clean">
                  {activeRows.map((row) => (
                    <ReminderCard
                      key={row.invoice._id}
                      row={row}
                      kind="reminder"
                      pending={pending}
                      onSend={handleReminder}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </section>
    </div>
  );
}

function ReminderCard({
  row,
  kind,
  pending,
  onSend,
}: {
  row: ReminderRow;
  kind: ReminderKind;
  pending: string | null;
  onSend: (row: ReminderRow, kind: ReminderKind) => void;
}) {
  const { invoice, reminders } = row;
  const latestReminder = reminders[0];
  const email = rowClientEmail(row);
  const phone = rowClientPhone(row);
  const amount = formatMoney(invoiceTotal(invoice), invoice.currency ?? "NAD");
  const isPending = pending === `${kind}-${invoice._id}`;

  return (
    <article className={`db-reminder-item db-reminder-row${kind === "overdue" ? " db-reminder-overdue" : ""}`}>
      <span
        className={`db-reminder-status-dot ${kind === "overdue" ? "db-status-danger" : "db-status-info"}`}
        aria-hidden="true"
      />
      <div className="db-reminder-row-main">
        <div>
          <p className="db-reminder-inv">
            {invoice.invoiceNumber} - {rowClientName(row)}
          </p>
          <p className="db-reminder-meta">
            Due {invoice.dueDate} - {statusLabels[invoice.status]} - {amount}
          </p>
        </div>
        <div className="db-reminder-contact-list">
          <span>
            <UserRound className="size-3.5" /> {row.client ? "Onboarded client" : "Invoice client"}
          </span>
          {email ? (
            <span>
              <Mail className="size-3.5" /> {email}
            </span>
          ) : null}
          {phone ? (
            <span>
              <Phone className="size-3.5" /> {phone}
            </span>
          ) : null}
        </div>
        <p className="db-reminder-meta">
          {latestReminder
            ? `Last reminder: ${formatDate(latestReminder.createdAt)}`
            : "No reminders sent yet"}
        </p>
      </div>
      <div className="db-reminder-row-actions">
        {invoice.publicToken ? (
          <a
            className="db-reminder-btn"
            href={`/invoice/${invoice.publicToken}`}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink className="size-3.5" /> Open invoice
          </a>
        ) : null}
        <button
          className={`db-reminder-btn${kind === "overdue" ? " db-reminder-btn-red" : ""}`}
          onClick={() => onSend(row, kind)}
          disabled={isPending}
          type="button"
        >
          {kind === "overdue" ? <Mail className="size-3.5" /> : <Bell className="size-3.5" />}
          {isPending ? "Preparing..." : kind === "overdue" ? "Overdue notice" : "Send reminder"}
        </button>
      </div>
    </article>
  );
}
