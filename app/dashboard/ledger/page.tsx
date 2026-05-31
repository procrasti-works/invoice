"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { BookOpen, Download, Filter, Search, ShoppingCart, FileText } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { usePlan } from "@/lib/plan";
import { LockedPage } from "../_components/DashboardShell";

function formatMoney(amount: number, currency = "NAD") {
  try { return new Intl.NumberFormat("en-NA", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${amount.toFixed(2)}`; }
}

const statusColors: Record<string, string> = {
  draft: "#6b7280", ready: "#0874a8", sent: "#3042a6", viewed: "#6833b0",
  approved: "#006545", awaiting_payment: "#7d6000", rejected: "#a51f43",
  paid: "#006545", overdue: "#a51f43",
};

const TABS = ["Issued Invoices", "Purchase Records", "5-Year Archive"] as const;
type Tab = typeof TABS[number];

export default function LedgerPage() {
  const { canAccess } = usePlan();
  const [activeTab, setActiveTab] = useState<Tab>("Issued Invoices");
  const [search, setSearch] = useState("");
  const invoiceRows = useQuery(api.invoices.list) as any[] | undefined;
  const workspace = useQuery(api.invoices.workspace);
  const currency = workspace?.defaultCurrency ?? "NAD";

  if (!canAccess("ledger")) return <LockedPage feature="Invoice Ledger" requiredPlan="Business" />;

  const rows = invoiceRows ?? [];
  const filtered = rows.filter(({ invoice }: any) =>
    !search || invoice.invoiceNumber?.toLowerCase().includes(search.toLowerCase()) ||
    (invoice.clientName ?? invoice.client ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="db-page">
      <div className="db-page-header">
        <div>
          <p className="db-page-eyebrow">Complete invoice history</p>
          <h1 className="db-page-title">Invoice Ledger</h1>
        </div>
        <div className="db-header-actions">
          <button className="db-outline-btn"><Filter className="size-4" /> Filter</button>
          <button className="db-primary-btn"><Download className="size-4" /> Export CSV</button>
        </div>
      </div>

      {/* Stats */}
      <div className="db-stat-row">
        <div className="db-stat-card">
          <p className="db-stat-label">Total Records</p>
          <p className="db-stat-value">{rows.length}</p>
        </div>
        <div className="db-stat-card">
          <p className="db-stat-label">Archive Status</p>
          <p className="db-stat-value" style={{ color: "#16a34a", fontSize: "1rem" }}>NamRA Compliant</p>
        </div>
        <div className="db-stat-card">
          <p className="db-stat-label">Retention Period</p>
          <p className="db-stat-value" style={{ fontSize: "1rem" }}>5 Years</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="db-tabs">
        {TABS.map((tab) => (
          <button key={tab} className={`db-tab${activeTab === tab ? " db-tab-active" : ""}`} onClick={() => setActiveTab(tab)}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Issued Invoices" && (
        <div className="db-card">
          <div className="db-search-bar" style={{ marginBottom: "16px" }}>
            <Search className="size-4 text-[#9ca3af]" />
            <input placeholder="Search by invoice number or client..." className="db-search-bar-input" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="db-table-wrap">
            <table className="db-table">
              <thead>
                <tr>
                  <th>Invoice #</th><th>Client</th><th>Issue Date</th><th>Due Date</th><th>Status</th><th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ invoice }: any) => (
                  <tr key={invoice._id}>
                    <td><span className="db-inv-num">{invoice.invoiceNumber}</span></td>
                    <td>{invoice.clientName ?? invoice.client ?? "—"}</td>
                    <td>{invoice.issueDate ?? "—"}</td>
                    <td>{invoice.dueDate}</td>
                    <td><span className="db-status-pill" style={{ color: statusColors[invoice.status], background: statusColors[invoice.status] + "18" }}>{invoice.status.replace("_", " ")}</span></td>
                    <td>{formatMoney(invoice.amountTotal ?? invoice.amount ?? 0, currency)}</td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={6} className="db-table-empty">{rows.length === 0 ? "No invoices yet" : "No results found"}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "Purchase Records" && (
        <div className="db-card">
          <h3 className="db-card-title">Supplier & Purchase Invoices</h3>
          <div className="db-empty" style={{ minHeight: "200px" }}>
            <ShoppingCart className="size-10 text-[#d1d5db]" />
            <h3>No purchase records yet</h3>
            <p>Record supplier invoices and purchase orders here. Your brother will wire up the backend for this section.</p>
            <button className="db-primary-btn" style={{ marginTop: "12px" }}><FileText className="size-4" /> Add Purchase Record</button>
          </div>
        </div>
      )}

      {activeTab === "5-Year Archive" && (
        <div className="db-card">
          <h3 className="db-card-title">NamRA 5-Year Record Archive</h3>
          <div className="db-info-grid">
            <div className="db-info-row"><span>Retention Requirement</span><strong>5 Years (NamRA)</strong></div>
            <div className="db-info-row"><span>Archive Status</span><strong style={{ color: "#16a34a" }}>Active & Compliant</strong></div>
            <div className="db-info-row"><span>Total Records Stored</span><strong>{rows.length}</strong></div>
            <div className="db-info-row"><span>Storage Format</span><strong>Cloud (Encrypted)</strong></div>
          </div>
          <p style={{ fontSize: "0.85rem", color: "#6b7280", marginTop: "16px" }}>
            All invoices are automatically retained for 5 years in compliance with NamRA VAT requirements. Records cannot be deleted during the retention period.
          </p>
          <button className="db-outline-btn" style={{ marginTop: "16px" }}><Download className="size-4" /> Download Full Archive</button>
        </div>
      )}
    </div>
  );
}
