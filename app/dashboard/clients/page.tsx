"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { Mail, Phone, Users, Plus, Search } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { usePlan } from "@/lib/plan";
import { LockedPage } from "../_components/DashboardShell";

function formatMoney(amount: number, currency = "NAD") {
  try {
    return new Intl.NumberFormat("en-NA", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export default function ClientsPage() {
  const { canAccess } = usePlan();
  const invoiceRows = useQuery(api.invoices.list);
  const workspace = useQuery(api.invoices.workspace);

  const clients = useMemo(() => {
    if (!invoiceRows) return [];
    const byEmail = new Map<string, { name: string; email: string; value: number; invoices: number; lastInvoice: string }>();
    (invoiceRows as any[]).forEach(({ invoice }: any) => {
      const email = invoice.clientEmail ?? "no-email";
      const current = byEmail.get(email) ?? { name: invoice.clientName ?? invoice.client ?? "Client", email, value: 0, invoices: 0, lastInvoice: invoice.dueDate ?? "" };
      current.value += invoice.amountTotal ?? invoice.amount ?? 0;
      current.invoices += 1;
      byEmail.set(email, current);
    });
    return Array.from(byEmail.values());
  }, [invoiceRows]);

  if (!canAccess("clients")) return <LockedPage feature="Clients" requiredPlan="Starter" />;

  return (
    <div className="db-page">
      <div className="db-page-header">
        <div>
          <p className="db-page-eyebrow">Client management</p>
          <h1 className="db-page-title">Clients</h1>
        </div>
        <button className="db-primary-btn">
          <Plus className="size-4" /> Add Client
        </button>
      </div>

      {/* Search */}
      <div className="db-search-bar">
        <Search className="size-4 text-[#9ca3af]" />
        <input placeholder="Search clients by name or email..." className="db-search-bar-input" />
      </div>

      {/* Stats */}
      <div className="db-stat-row">
        <div className="db-stat-card">
          <p className="db-stat-label">Total Clients</p>
          <p className="db-stat-value">{clients.length}</p>
        </div>
        <div className="db-stat-card">
          <p className="db-stat-label">Total Billed</p>
          <p className="db-stat-value">{formatMoney(clients.reduce((s, c) => s + c.value, 0), workspace?.defaultCurrency ?? "NAD")}</p>
        </div>
        <div className="db-stat-card">
          <p className="db-stat-label">Total Invoices</p>
          <p className="db-stat-value">{clients.reduce((s, c) => s + c.invoices, 0)}</p>
        </div>
      </div>

      {/* Clients grid */}
      {clients.length === 0 ? (
        <div className="db-empty">
          <Users className="size-10 text-[#d1d5db]" />
          <h3>No clients yet</h3>
          <p>Clients appear automatically when you create and send your first invoice.</p>
        </div>
      ) : (
        <div className="db-clients-grid">
          {clients.map((client) => (
            <article key={client.email} className="db-client-card">
              <div className="db-client-avatar">
                {client.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="db-client-info">
                <p className="db-client-name">{client.name}</p>
                <p className="db-client-email">
                  <Mail className="size-3" /> {client.email}
                </p>
              </div>
              <div className="db-client-stats">
                <span>{client.invoices} invoice{client.invoices !== 1 ? "s" : ""}</span>
                <strong>{formatMoney(client.value, workspace?.defaultCurrency ?? "NAD")}</strong>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
