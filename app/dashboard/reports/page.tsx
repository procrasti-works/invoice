"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { BarChart3, Clock, Download, Filter, TrendingUp, WalletCards } from "lucide-react";

import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { usePlan } from "@/lib/plan";
import { LockedPage } from "../_components/DashboardShell";

type InvoiceRow = {
  invoice: Doc<"invoices">;
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

function invoiceTotal(invoice: Doc<"invoices">) {
  return invoice.total ?? invoice.amountTotal ?? invoice.amount ?? 0;
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, rows: unknown[][]) {
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

const TABS = ["Revenue", "Cash Flow", "VAT Summary", "Overdue"] as const;
type Tab = typeof TABS[number];

export default function ReportsPage() {
  const { canAccess } = usePlan();
  const [activeTab, setActiveTab] = useState<Tab>("Revenue");
  const invoiceRows = useQuery(api.invoices.listRecords) as InvoiceRow[] | undefined;
  const summary = useQuery(api.reports.summary, {});
  const workspace = useQuery(api.invoices.workspace);
  const currency = summary?.currency ?? workspace?.defaultCurrency ?? "NAD";

  if (!canAccess("reports")) {
    return <LockedPage feature="Reports & Analytics" requiredPlan="Business" />;
  }

  const rows = invoiceRows ?? [];
  const paid = rows.filter(({ invoice }) => invoice.status === "paid");
  const outstanding = rows.filter(({ invoice }) => ["sent", "viewed", "approved", "awaiting_payment", "overdue"].includes(invoice.status));
  const overdue = rows.filter(({ invoice }) => invoice.status === "overdue");

  function handleExport() {
    if (activeTab === "Revenue") {
      downloadCsv("payvio-revenue.csv", [
        ["Invoice", "Client", "Issue date", "Subtotal", "VAT", "Total"],
        ...paid.map(({ invoice }) => [
          invoice.invoiceNumber,
          invoice.clientName ?? invoice.client ?? "",
          invoice.issueDate ?? invoice.dueDate,
          invoice.subtotal ?? invoiceTotal(invoice),
          invoice.vatAmount ?? 0,
          invoiceTotal(invoice),
        ]),
      ]);
      return;
    }

    if (activeTab === "Overdue") {
      downloadCsv("payvio-overdue.csv", [
        ["Invoice", "Client", "Due date", "Balance"],
        ...overdue.map(({ invoice }) => [
          invoice.invoiceNumber,
          invoice.clientName ?? invoice.client ?? "",
          invoice.dueDate,
          invoice.balanceDue ?? invoiceTotal(invoice),
        ]),
      ]);
      return;
    }

    downloadCsv("payvio-report-summary.csv", [
      ["Metric", "Value"],
      ["Paid", summary?.paid ?? 0],
      ["Outstanding", summary?.outstanding ?? 0],
      ["Overdue", summary?.overdue ?? 0],
      ["Supplier purchases", summary?.purchaseTotal ?? 0],
      ["VAT collected", summary?.vatCollected ?? 0],
      ["VAT input", summary?.vatInput ?? 0],
      ["Currency", currency],
    ]);
  }

  return (
    <div className="db-page">
      <div className="db-page-header">
        <div>
          <p className="db-page-eyebrow">Financial overview</p>
          <h1 className="db-page-title">Reports</h1>
        </div>
        <div className="db-header-actions">
          <button className="db-outline-btn" type="button" onClick={() => setActiveTab("Overdue")}><Filter className="size-4" /> Show overdue</button>
          <button className="db-primary-btn" type="button" onClick={handleExport}><Download className="size-4" /> Export CSV</button>
        </div>
      </div>

      <div className="db-stat-row db-stat-row-4">
        <div className="db-stat-card">
          <div className="db-stat-icon" style={{ background: "#dcfce7", color: "#16a34a" }}><WalletCards className="size-4" /></div>
          <p className="db-stat-label">Paid</p>
          <p className="db-stat-value">{formatMoney(summary?.paid ?? 0, currency)}</p>
          <p className="db-stat-sub">{paid.length} paid invoices</p>
        </div>
        <div className="db-stat-card">
          <div className="db-stat-icon" style={{ background: "#dbeafe", color: "#1a6fc4" }}><TrendingUp className="size-4" /></div>
          <p className="db-stat-label">Outstanding</p>
          <p className="db-stat-value">{formatMoney(summary?.outstanding ?? 0, currency)}</p>
          <p className="db-stat-sub">{outstanding.length} with clients</p>
        </div>
        <div className="db-stat-card">
          <div className="db-stat-icon" style={{ background: "#fee2e2", color: "#dc2626" }}><Clock className="size-4" /></div>
          <p className="db-stat-label">Overdue</p>
          <p className="db-stat-value">{formatMoney(summary?.overdue ?? 0, currency)}</p>
          <p className="db-stat-sub">{overdue.length} overdue invoices</p>
        </div>
        <div className="db-stat-card">
          <div className="db-stat-icon" style={{ background: "#fef9c3", color: "#ca8a04" }}><BarChart3 className="size-4" /></div>
          <p className="db-stat-label">VAT position</p>
          <p className="db-stat-value">{formatMoney((summary?.vatCollected ?? 0) - (summary?.vatInput ?? 0), currency)}</p>
          <p className="db-stat-sub">Collected minus input</p>
        </div>
      </div>

      <div className="db-tabs">
        {TABS.map((tab) => (
          <button key={tab} className={`db-tab${activeTab === tab ? " db-tab-active" : ""}`} onClick={() => setActiveTab(tab)}>
            {tab}
          </button>
        ))}
      </div>

      <div className="db-card">
        {activeTab === "Revenue" ? (
          <div>
            <h3 className="db-card-title">Paid invoices</h3>
            <div className="db-table-wrap">
              <table className="db-table">
                <thead><tr><th>Invoice</th><th>Client</th><th>Issue date</th><th>Subtotal</th><th>VAT</th><th>Total</th></tr></thead>
                <tbody>
                  {paid.slice(0, 20).map(({ invoice }) => (
                    <tr key={invoice._id}>
                      <td>{invoice.invoiceNumber}</td>
                      <td>{invoice.clientName ?? invoice.client}</td>
                      <td>{invoice.issueDate ?? invoice.dueDate}</td>
                      <td>{formatMoney(invoice.subtotal ?? invoiceTotal(invoice), invoice.currency ?? currency)}</td>
                      <td>{formatMoney(invoice.vatAmount ?? 0, invoice.currency ?? currency)}</td>
                      <td>{formatMoney(invoiceTotal(invoice), invoice.currency ?? currency)}</td>
                    </tr>
                  ))}
                  {paid.length === 0 ? <tr><td colSpan={6} className="db-table-empty">No paid invoices yet</td></tr> : null}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {activeTab === "Cash Flow" ? (
          <div>
            <h3 className="db-card-title">Cash flow</h3>
            <div className="db-info-grid">
              <div className="db-info-row"><span>Paid</span><strong>{formatMoney(summary?.paid ?? 0, currency)}</strong></div>
              <div className="db-info-row"><span>Outstanding</span><strong>{formatMoney(summary?.outstanding ?? 0, currency)}</strong></div>
              <div className="db-info-row"><span>Overdue</span><strong>{formatMoney(summary?.overdue ?? 0, currency)}</strong></div>
              <div className="db-info-row"><span>Supplier purchases</span><strong>{formatMoney(summary?.purchaseTotal ?? 0, currency)}</strong></div>
            </div>
          </div>
        ) : null}

        {activeTab === "VAT Summary" ? (
          <div>
            <h3 className="db-card-title">VAT summary</h3>
            <div className="db-info-grid">
              <div className="db-info-row"><span>VAT collected</span><strong>{formatMoney(summary?.vatCollected ?? 0, currency)}</strong></div>
              <div className="db-info-row"><span>VAT input</span><strong>{formatMoney(summary?.vatInput ?? 0, currency)}</strong></div>
              <div className="db-info-row"><span>VAT position</span><strong>{formatMoney((summary?.vatCollected ?? 0) - (summary?.vatInput ?? 0), currency)}</strong></div>
              <div className="db-info-row"><span>Tax mode</span><strong>VAT-ready records</strong></div>
            </div>
            <p style={{ fontSize: "0.85rem", color: "#6b7280", marginTop: "16px" }}>
              Direct NamRA/ITAS submission is not enabled in v1. Use these figures as internal working records.
            </p>
          </div>
        ) : null}

        {activeTab === "Overdue" ? (
          <div>
            <h3 className="db-card-title">Overdue invoices</h3>
            <div className="db-table-wrap">
              <table className="db-table">
                <thead><tr><th>Invoice</th><th>Client</th><th>Due Date</th><th>Balance</th></tr></thead>
                <tbody>
                  {overdue.map(({ invoice }) => (
                    <tr key={invoice._id} style={{ color: "#dc2626" }}>
                      <td>{invoice.invoiceNumber}</td>
                      <td>{invoice.clientName ?? invoice.client}</td>
                      <td>{invoice.dueDate}</td>
                      <td>{formatMoney(invoice.balanceDue ?? invoiceTotal(invoice), invoice.currency ?? currency)}</td>
                    </tr>
                  ))}
                  {overdue.length === 0 ? <tr><td colSpan={4} className="db-table-empty">No overdue invoices</td></tr> : null}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
