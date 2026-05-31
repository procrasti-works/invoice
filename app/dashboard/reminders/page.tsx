"use client";

import { useQuery, useMutation } from "convex/react";
import { Bell, Mail, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { usePlan } from "@/lib/plan";
import { LockedPage } from "../_components/DashboardShell";
import { useState } from "react";

type Invoice = Doc<"invoices">;
type InvoiceRow = {
  invoice: Invoice;
};

function isClientActive(status: Invoice["status"]) {
  return ["sent", "viewed", "approved", "awaiting_payment", "overdue"].includes(status);
}

const statusLabels: Record<string, string> = {
  draft: "Draft", ready: "Ready", sent: "Sent", viewed: "Viewed",
  approved: "Approved", awaiting_payment: "Awaiting Payment",
  rejected: "Rejected", paid: "Paid", overdue: "Overdue",
};

export default function RemindersPage() {
  const { canAccess } = usePlan();
  const invoiceRows = useQuery(api.invoices.list) as InvoiceRow[] | undefined;
  const scheduleReminder = useMutation(api.invoices.scheduleReminder);
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!canAccess("reminders")) return <LockedPage feature="Reminders" requiredPlan="Starter" />;

  const activeInvoices = (invoiceRows ?? []).filter(({ invoice }) => isClientActive(invoice.status));
  const overdueInvoices = (invoiceRows ?? []).filter(({ invoice }) => invoice.status === "overdue");

  async function handleReminder(invoice: Invoice) {
    setPending(invoice._id);
    try {
      await scheduleReminder({ id: invoice._id, message: `Reminder scheduled for ${invoice.clientName ?? "client"}.` });
      setNotice(`Reminder scheduled for ${invoice.invoiceNumber}.`);
    } catch {
      setNotice("Unable to schedule reminder.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="db-page">
      <div className="db-page-header">
        <div>
          <p className="db-page-eyebrow">Payment follow-ups</p>
          <h1 className="db-page-title">Reminders</h1>
        </div>
      </div>

      {/* Stats */}
      <div className="db-stat-row">
        <div className="db-stat-card">
          <p className="db-stat-label">Active with Client</p>
          <p className="db-stat-value">{activeInvoices.length}</p>
        </div>
        <div className="db-stat-card">
          <p className="db-stat-label">Overdue</p>
          <p className="db-stat-value" style={{ color: "#dc2626" }}>{overdueInvoices.length}</p>
        </div>
      </div>

      {notice && (
        <div className="db-notice">
          <CheckCircle2 className="size-4" /> {notice}
        </div>
      )}

      {/* Overdue section */}
      {overdueInvoices.length > 0 && (
        <section className="db-section">
          <div className="db-section-header">
            <AlertTriangle className="size-4 text-[#dc2626]" />
            <h2>Overdue Invoices</h2>
          </div>
          <div className="db-reminder-list">
            {overdueInvoices.map(({ invoice }) => (
              <div key={invoice._id} className="db-reminder-item db-reminder-overdue">
                <div>
                  <p className="db-reminder-inv">{invoice.invoiceNumber} — {invoice.clientName ?? invoice.client}</p>
                  <p className="db-reminder-meta">Due {invoice.dueDate} · Overdue</p>
                </div>
                <button className="db-reminder-btn db-reminder-btn-red" onClick={() => handleReminder(invoice)} disabled={pending === invoice._id}>
                  <Mail className="size-3.5" /> Send overdue notice
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Active invoices */}
      <section className="db-section">
        <div className="db-section-header">
          <Clock className="size-4 text-[#1a6fc4]" />
          <h2>Active — Awaiting Response</h2>
        </div>
        {activeInvoices.length === 0 ? (
          <div className="db-empty">
            <Bell className="size-10 text-[#d1d5db]" />
            <h3>No active invoices</h3>
            <p>Invoices that have been sent to clients will appear here for follow-up.</p>
          </div>
        ) : (
          <div className="db-reminder-list">
            {activeInvoices.map(({ invoice }) => (
              <div key={invoice._id} className="db-reminder-item">
                <div>
                  <p className="db-reminder-inv">{invoice.invoiceNumber} — {invoice.clientName ?? invoice.client}</p>
                  <p className="db-reminder-meta">Due {invoice.dueDate} · {statusLabels[invoice.status]}</p>
                </div>
                <button className="db-reminder-btn" onClick={() => handleReminder(invoice)} disabled={pending === invoice._id}>
                  <Bell className="size-3.5" /> Send reminder
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
