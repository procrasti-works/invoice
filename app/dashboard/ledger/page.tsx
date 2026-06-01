"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { Download, FileText, Filter, Search, ShoppingCart } from "lucide-react";

import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { usePlan } from "@/lib/plan";
import { LockedPage } from "../_components/DashboardShell";

type InvoiceRow = {
  invoice: Doc<"invoices">;
};
type PurchaseRow = {
  purchase: Doc<"purchases">;
  supplier: Doc<"suppliers"> | null;
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

const statusColors: Record<string, string> = {
  draft: "#6b7280",
  ready: "#0874a8",
  sent: "#3042a6",
  viewed: "#6833b0",
  approved: "#006545",
  awaiting_payment: "#7d6000",
  rejected: "#a51f43",
  paid: "#006545",
  overdue: "#a51f43",
  recorded: "#3042a6",
  void: "#6b7280",
};

const TABS = ["Issued Invoices", "Purchase Records", "Records"] as const;
type Tab = typeof TABS[number];

export default function LedgerPage() {
  const { canAccess } = usePlan();
  const [activeTab, setActiveTab] = useState<Tab>("Issued Invoices");
  const [search, setSearch] = useState("");
  const invoiceRows = useQuery(api.invoices.listRecords) as InvoiceRow[] | undefined;
  const purchaseRows = useQuery(api.purchases.listPurchases, {}) as PurchaseRow[] | undefined;
  const workspace = useQuery(api.invoices.workspace);
  const currency = workspace?.defaultCurrency ?? "NAD";

  if (!canAccess("ledger")) {
    return <LockedPage feature="Invoice Ledger" requiredPlan="Business" />;
  }

  const invoices = invoiceRows ?? [];
  const purchases = purchaseRows ?? [];
  const query = search.trim().toLowerCase();
  const filteredInvoices = invoices.filter(({ invoice }) =>
    !query ||
    invoice.invoiceNumber.toLowerCase().includes(query) ||
    (invoice.clientName ?? invoice.client ?? "").toLowerCase().includes(query),
  );
  const filteredPurchases = purchases.filter(({ purchase }) =>
    !query ||
    purchase.supplierName.toLowerCase().includes(query) ||
    (purchase.invoiceNumber ?? "").toLowerCase().includes(query),
  );

  function handleExport() {
    if (activeTab === "Issued Invoices") {
      downloadCsv("payvio-issued-invoices.csv", [
        ["Invoice", "Client", "Issue date", "Due date", "Status", "Subtotal", "VAT", "Total"],
        ...filteredInvoices.map(({ invoice }) => [
          invoice.invoiceNumber,
          invoice.clientName ?? invoice.client ?? "",
          invoice.issueDate ?? "",
          invoice.dueDate,
          invoice.status,
          invoice.subtotal ?? invoiceTotal(invoice),
          invoice.vatAmount ?? 0,
          invoiceTotal(invoice),
        ]),
      ]);
      return;
    }

    if (activeTab === "Purchase Records") {
      downloadCsv("payvio-purchase-records.csv", [
        ["Supplier invoice", "Supplier", "Issue date", "Due date", "Status", "Subtotal", "VAT input", "Total"],
        ...filteredPurchases.map(({ purchase }) => [
          purchase.invoiceNumber ?? "",
          purchase.supplierName,
          purchase.issueDate,
          purchase.dueDate ?? "",
          purchase.status,
          purchase.subtotal,
          purchase.vatAmount,
          purchase.total,
        ]),
      ]);
      return;
    }

    downloadCsv("payvio-record-summary.csv", [
      ["Metric", "Value"],
      ["Issued invoices", invoices.length],
      ["Supplier records", purchases.length],
      ["Default currency", currency],
    ]);
  }

  return (
    <div className="db-page">
      <div className="db-page-header">
        <div>
          <p className="db-page-eyebrow">Issued and supplier records</p>
          <h1 className="db-page-title">Ledger</h1>
        </div>
        <div className="db-header-actions">
          <button className="db-outline-btn" type="button" onClick={() => document.getElementById("ledger-search")?.focus()}><Filter className="size-4" /> Filter</button>
          <button className="db-primary-btn" type="button" onClick={handleExport}><Download className="size-4" /> Export CSV</button>
        </div>
      </div>

      <div className="db-stat-row">
        <div className="db-stat-card">
          <p className="db-stat-label">Issued invoices</p>
          <p className="db-stat-value">{invoices.length}</p>
        </div>
        <div className="db-stat-card">
          <p className="db-stat-label">Purchase records</p>
          <p className="db-stat-value">{purchases.length}</p>
        </div>
        <div className="db-stat-card">
          <p className="db-stat-label">Record status</p>
          <p className="db-stat-value" style={{ color: "#0874a8", fontSize: "1rem" }}>VAT-ready</p>
        </div>
      </div>

      <div className="db-tabs">
        {TABS.map((tab) => (
          <button key={tab} className={`db-tab${activeTab === tab ? " db-tab-active" : ""}`} onClick={() => setActiveTab(tab)}>
            {tab}
          </button>
        ))}
      </div>

      <div className="db-search-bar" style={{ marginBottom: "16px" }}>
        <Search className="size-4 text-[#9ca3af]" />
        <input id="ledger-search" placeholder="Search invoice number, client, supplier..." className="db-search-bar-input" value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>

      {activeTab === "Issued Invoices" ? (
        <div className="db-card">
          <div className="db-table-wrap">
            <table className="db-table">
              <thead>
                <tr>
                  <th>Invoice #</th><th>Client</th><th>Issue Date</th><th>Due Date</th><th>Status</th><th>Subtotal</th><th>VAT</th><th>Total</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map(({ invoice }) => (
                  <tr key={invoice._id}>
                    <td><span className="db-inv-num">{invoice.invoiceNumber}</span></td>
                    <td>{invoice.clientName ?? invoice.client ?? "-"}</td>
                    <td>{invoice.issueDate ?? "-"}</td>
                    <td>{invoice.dueDate}</td>
                    <td><span className="db-status-pill" style={{ color: statusColors[invoice.status], background: statusColors[invoice.status] + "18" }}>{invoice.status.replace("_", " ")}</span></td>
                    <td>{formatMoney(invoice.subtotal ?? invoiceTotal(invoice), invoice.currency ?? currency)}</td>
                    <td>{formatMoney(invoice.vatAmount ?? 0, invoice.currency ?? currency)}</td>
                    <td>{formatMoney(invoiceTotal(invoice), invoice.currency ?? currency)}</td>
                  </tr>
                ))}
                {filteredInvoices.length === 0 ? <tr><td colSpan={8} className="db-table-empty">{invoices.length === 0 ? "No invoices yet" : "No results found"}</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {activeTab === "Purchase Records" ? (
        <div className="db-card">
          <div className="db-table-wrap">
            <table className="db-table">
              <thead>
                <tr>
                  <th>Supplier invoice</th><th>Supplier</th><th>Issue Date</th><th>Due Date</th><th>Status</th><th>Subtotal</th><th>VAT input</th><th>Total</th>
                </tr>
              </thead>
              <tbody>
                {filteredPurchases.map(({ purchase }) => (
                  <tr key={purchase._id}>
                    <td><span className="db-inv-num">{purchase.invoiceNumber ?? "-"}</span></td>
                    <td>{purchase.supplierName}</td>
                    <td>{purchase.issueDate}</td>
                    <td>{purchase.dueDate ?? "-"}</td>
                    <td><span className="db-status-pill" style={{ color: statusColors[purchase.status], background: statusColors[purchase.status] + "18" }}>{purchase.status}</span></td>
                    <td>{formatMoney(purchase.subtotal, purchase.currency)}</td>
                    <td>{formatMoney(purchase.vatAmount, purchase.currency)}</td>
                    <td>{formatMoney(purchase.total, purchase.currency)}</td>
                  </tr>
                ))}
                {filteredPurchases.length === 0 ? <tr><td colSpan={8} className="db-table-empty">{purchases.length === 0 ? "No purchase records yet" : "No results found"}</td></tr> : null}
              </tbody>
            </table>
          </div>
          {purchases.length === 0 ? (
            <div className="db-empty" style={{ minHeight: "180px" }}>
              <ShoppingCart className="size-10 text-[#d1d5db]" />
              <h3>No purchase records yet</h3>
              <p>Use the purchase backend to record supplier invoices and VAT input.</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {activeTab === "Records" ? (
        <div className="db-card">
          <h3 className="db-card-title"><FileText className="size-4" /> Export-ready records</h3>
          <div className="db-info-grid">
            <div className="db-info-row"><span>Issued invoices</span><strong>{invoices.length}</strong></div>
            <div className="db-info-row"><span>Supplier records</span><strong>{purchases.length}</strong></div>
            <div className="db-info-row"><span>Default currency</span><strong>{currency}</strong></div>
            <div className="db-info-row"><span>Tax module</span><strong>NamRA/ITAS coming later</strong></div>
          </div>
          <p style={{ fontSize: "0.85rem", color: "#6b7280", marginTop: "16px" }}>
            Payvio stores the invoice and purchase data needed for basic SME records. Direct NamRA/ITAS export will be added after official technical specifications are available.
          </p>
        </div>
      ) : null}
    </div>
  );
}
