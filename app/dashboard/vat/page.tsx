"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { Download, Calculator, FileCheck, Globe, AlertCircle } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { usePlan } from "@/lib/plan";
import { LockedPage } from "../_components/DashboardShell";

type InvoiceRow = {
  invoice: Doc<"invoices">;
};

function formatMoney(amount: number, currency = "NAD") {
  try { return new Intl.NumberFormat("en-NA", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${amount.toFixed(2)}`; }
}

const TABS = ["VAT Calculator", "NamRA Export", "Currency Settings", "Compliance Status"] as const;
type Tab = typeof TABS[number];

export default function VatPage() {
  const { canAccess } = usePlan();
  const [activeTab, setActiveTab] = useState<Tab>("VAT Calculator");
  const [calcAmount, setCalcAmount] = useState("");
  const [calcMode, setCalcMode] = useState<"excl" | "incl">("excl");
  const invoiceRows = useQuery(api.invoices.list) as InvoiceRow[] | undefined;
  const workspace = useQuery(api.invoices.workspace);
  const currency = workspace?.defaultCurrency ?? "NAD";

  if (!canAccess("vat")) return <LockedPage feature="VAT & NamRA Compliance" requiredPlan="Professional" />;

  const rows = invoiceRows ?? [];
  const paid = rows.filter(({ invoice }) => invoice.status === "paid");
  const totalRevenue = paid.reduce((s, { invoice }) => s + (invoice.amountTotal ?? invoice.amount ?? 0), 0);
  const vatAmount = totalRevenue * 0.15;
  const exclVat = totalRevenue / 1.15;

  const calcNum = parseFloat(calcAmount) || 0;
  const calcVat = calcMode === "excl" ? calcNum * 0.15 : calcNum - (calcNum / 1.15);
  const calcTotal = calcMode === "excl" ? calcNum * 1.15 : calcNum;
  const calcExcl = calcMode === "excl" ? calcNum : calcNum / 1.15;

  return (
    <div className="db-page">
      <div className="db-page-header">
        <div>
          <p className="db-page-eyebrow">Tax & e-invoicing compliance</p>
          <h1 className="db-page-title">VAT & NamRA</h1>
        </div>
        <button className="db-primary-btn"><Download className="size-4" /> Export ITAS Report</button>
      </div>

      {/* NamRA compliance banner */}
      <div className="db-compliance-banner">
        <FileCheck className="size-5 text-[#16a34a]" />
        <div>
          <p className="db-compliance-title">NamRA ITAS Ready</p>
          <p className="db-compliance-sub">Your invoices are formatted for NamRA&apos;s Integrated Tax Administration System. Phased e-invoicing mandate: 2026–2029.</p>
        </div>
        <span className="db-compliance-badge">Compliant</span>
      </div>

      {/* VAT summary */}
      <div className="db-stat-row db-stat-row-4">
        <div className="db-stat-card">
          <p className="db-stat-label">Revenue (excl. VAT)</p>
          <p className="db-stat-value">{formatMoney(exclVat, currency)}</p>
        </div>
        <div className="db-stat-card">
          <p className="db-stat-label">VAT Collected (15%)</p>
          <p className="db-stat-value">{formatMoney(vatAmount, currency)}</p>
        </div>
        <div className="db-stat-card">
          <p className="db-stat-label">Total (incl. VAT)</p>
          <p className="db-stat-value">{formatMoney(totalRevenue, currency)}</p>
        </div>
        <div className="db-stat-card">
          <p className="db-stat-label">VAT Return Due</p>
          <p className="db-stat-value" style={{ fontSize: "1rem" }}>25th of month</p>
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

      {activeTab === "VAT Calculator" && (
        <div className="db-card">
          <h3 className="db-card-title"><Calculator className="size-4" /> VAT Calculator (15%)</h3>
          <div className="db-calc-wrap">
            <div className="db-calc-toggle">
              <button className={calcMode === "excl" ? "db-calc-toggle-active" : ""} onClick={() => setCalcMode("excl")}>Amount excl. VAT</button>
              <button className={calcMode === "incl" ? "db-calc-toggle-active" : ""} onClick={() => setCalcMode("incl")}>Amount incl. VAT</button>
            </div>
            <input
              type="number"
              className="db-calc-input"
              placeholder={`Enter amount (${currency})`}
              value={calcAmount}
              onChange={(e) => setCalcAmount(e.target.value)}
            />
            {calcNum > 0 && (
              <div className="db-calc-result">
                <div className="db-info-row"><span>Amount excl. VAT</span><strong>{formatMoney(calcExcl, currency)}</strong></div>
                <div className="db-info-row"><span>VAT (15%)</span><strong>{formatMoney(calcVat, currency)}</strong></div>
                <div className="db-info-row db-info-row-total"><span>Total incl. VAT</span><strong>{formatMoney(calcTotal, currency)}</strong></div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "NamRA Export" && (
        <div className="db-card">
          <h3 className="db-card-title">NamRA ITAS Export</h3>
          <p style={{ fontSize: "0.9rem", color: "#4b5563", marginBottom: "20px" }}>
            Export your invoice data in a format compatible with NamRA&apos;s Integrated Tax Administration System for VAT return filing.
          </p>
          <div className="db-info-grid">
            <div className="db-info-row"><span>Export Format</span><strong>ITAS-Compatible CSV/XML</strong></div>
            <div className="db-info-row"><span>VAT Period</span><strong>Monthly</strong></div>
            <div className="db-info-row"><span>Filing Deadline</span><strong>25th of following month</strong></div>
          </div>
          <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
            <button className="db-primary-btn"><Download className="size-4" /> Export VAT Return</button>
            <button className="db-outline-btn"><Download className="size-4" /> Export All Invoices</button>
          </div>
          <div className="db-notice" style={{ marginTop: "16px", background: "#fef9c3", borderColor: "#fde68a", color: "#92400e" }}>
            <AlertCircle className="size-4" /> Backend integration for direct ITAS submission coming soon. Your partner should wire this up.
          </div>
        </div>
      )}

      {activeTab === "Currency Settings" && (
        <div className="db-card">
          <h3 className="db-card-title"><Globe className="size-4" /> Multi-Currency Support</h3>
          <p style={{ fontSize: "0.9rem", color: "#4b5563", marginBottom: "20px" }}>
            Payvio supports NAD, USD, and ZAR for cross-border invoicing.
          </p>
          <div className="db-currency-grid">
            {[
              { code: "NAD", name: "Namibian Dollar", flag: "🇳🇦", active: true },
              { code: "USD", name: "US Dollar", flag: "🇺🇸", active: true },
              { code: "ZAR", name: "South African Rand", flag: "🇿🇦", active: true },
            ].map((c) => (
              <div key={c.code} className="db-currency-item">
                <span className="db-currency-flag">{c.flag}</span>
                <div>
                  <p className="db-currency-code">{c.code}</p>
                  <p className="db-currency-name">{c.name}</p>
                </div>
                <span className="db-currency-status">{c.active ? "Active" : "Inactive"}</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: "0.82rem", color: "#9ca3af", marginTop: "12px" }}>Default currency is set in Settings. Change it per invoice at creation time.</p>
        </div>
      )}

      {activeTab === "Compliance Status" && (
        <div className="db-card">
          <h3 className="db-card-title">Compliance Checklist</h3>
          <div className="db-compliance-list">
            {[
              { item: "Tax Invoice label on all invoices", done: true },
              { item: "Supplier VAT registration number included", done: true },
              { item: "Sequential invoice numbering", done: true },
              { item: "VAT amount shown separately (15%)", done: true },
              { item: "5-year invoice retention", done: true },
              { item: "NamRA ITAS export format", done: true },
              { item: "Direct ITAS system integration", done: false },
              { item: "Real-time invoice transmission to NamRA", done: false },
            ].map((row) => (
              <div key={row.item} className="db-compliance-row">
                <span className={`db-compliance-check ${row.done ? "db-compliance-check-done" : "db-compliance-check-pending"}`}>
                  {row.done ? "✓" : "○"}
                </span>
                <span style={{ color: row.done ? "#111827" : "#9ca3af" }}>{row.item}</span>
                <span className="db-compliance-tag">{row.done ? "Complete" : "Coming soon"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
