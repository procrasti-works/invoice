"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { BarChart3, TrendingUp, DollarSign, Clock, Download, Filter } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { usePlan } from "@/lib/plan";
import { LockedPage } from "../_components/DashboardShell";

function formatMoney(amount: number, currency = "NAD") {
  try { return new Intl.NumberFormat("en-NA", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${amount.toFixed(2)}`; }
}

const TABS = ["Revenue", "Cash Flow", "Tax Summary", "Overdue Report"] as const;
type Tab = typeof TABS[number];

export default function ReportsPage() {
  const { canAccess } = usePlan();
  const [activeTab, setActiveTab] = useState<Tab>("Revenue");
  const invoiceRows = useQuery(api.invoices.list) as any[] | undefined;
  const stats = useQuery(api.invoices.stats);
  const workspace = useQuery(api.invoices.workspace);
  const currency = workspace?.defaultCurrency ?? "NAD";

  if (!canAccess("reports")) return <LockedPage feature="Reports & Analytics" requiredPlan="Business" />;

  const rows = invoiceRows ?? [];
  const paid = rows.filter(({ invoice }: any) => invoice.status === "paid");
  const outstanding = rows.filter(({ invoice }: any) => ["sent","viewed","approved","awaiting_payment"].includes(invoice.status));
  const overdue = rows.filter(({ invoice }: any) => invoice.status === "overdue");
  const totalRevenue = paid.reduce((s: number, { invoice }: any) => s + (invoice.amountTotal ?? invoice.amount ?? 0), 0);
  const totalOutstanding = outstanding.reduce((s: number, { invoice }: any) => s + (invoice.amountTotal ?? invoice.amount ?? 0), 0);
  const totalOverdue = overdue.reduce((s: number, { invoice }: any) => s + (invoice.amountTotal ?? invoice.amount ?? 0), 0);
  const vatCollected = totalRevenue * 0.15;

  return (
    <div className="db-page">
      <div className="db-page-header">
        <div>
          <p className="db-page-eyebrow">Financial overview</p>
          <h1 className="db-page-title">Reports & Analytics</h1>
        </div>
        <div className="db-header-actions">
          <button className="db-outline-btn"><Filter className="size-4" /> Filter</button>
          <button className="db-primary-btn"><Download className="size-4" /> Export</button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="db-stat-row db-stat-row-4">
        <div className="db-stat-card">
          <div className="db-stat-icon" style={{ background: "#dcfce7", color: "#16a34a" }}><DollarSign className="size-4" /></div>
          <p className="db-stat-label">Total Revenue</p>
          <p className="db-stat-value">{formatMoney(totalRevenue, currency)}</p>
          <p className="db-stat-sub">{paid.length} paid invoices</p>
        </div>
        <div className="db-stat-card">
          <div className="db-stat-icon" style={{ background: "#dbeafe", color: "#1a6fc4" }}><TrendingUp className="size-4" /></div>
          <p className="db-stat-label">Outstanding</p>
          <p className="db-stat-value">{formatMoney(totalOutstanding, currency)}</p>
          <p className="db-stat-sub">{outstanding.length} with clients</p>
        </div>
        <div className="db-stat-card">
          <div className="db-stat-icon" style={{ background: "#fee2e2", color: "#dc2626" }}><Clock className="size-4" /></div>
          <p className="db-stat-label">Overdue</p>
          <p className="db-stat-value">{formatMoney(totalOverdue, currency)}</p>
          <p className="db-stat-sub">{overdue.length} overdue invoices</p>
        </div>
        <div className="db-stat-card">
          <div className="db-stat-icon" style={{ background: "#fef9c3", color: "#ca8a04" }}><BarChart3 className="size-4" /></div>
          <p className="db-stat-label">VAT Collected (15%)</p>
          <p className="db-stat-value">{formatMoney(vatCollected, currency)}</p>
          <p className="db-stat-sub">From paid invoices</p>
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

      {/* Tab content */}
      <div className="db-card">
        {activeTab === "Revenue" && (
          <div>
            <h3 className="db-card-title">Revenue Breakdown</h3>
            <div className="db-chart-placeholder">
              <BarChart3 className="size-12 text-[#d1d5db]" />
              <p>Revenue chart — backend integration coming soon</p>
            </div>
            <div className="db-table-wrap">
              <table className="db-table">
                <thead><tr><th>Invoice</th><th>Client</th><th>Date</th><th>Amount</th></tr></thead>
                <tbody>
                  {paid.slice(0, 10).map(({ invoice }: any) => (
                    <tr key={invoice._id}>
                      <td>{invoice.invoiceNumber}</td>
                      <td>{invoice.clientName ?? invoice.client}</td>
                      <td>{invoice.dueDate}</td>
                      <td>{formatMoney(invoice.amountTotal ?? invoice.amount ?? 0, currency)}</td>
                    </tr>
                  ))}
                  {paid.length === 0 && <tr><td colSpan={4} className="db-table-empty">No paid invoices yet</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {activeTab === "Cash Flow" && (
          <div>
            <h3 className="db-card-title">Cash Flow Overview</h3>
            <div className="db-chart-placeholder">
              <TrendingUp className="size-12 text-[#d1d5db]" />
              <p>Cash flow chart — backend integration coming soon</p>
            </div>
          </div>
        )}
        {activeTab === "Tax Summary" && (
          <div>
            <h3 className="db-card-title">VAT & Tax Summary</h3>
            <div className="db-info-grid">
              <div className="db-info-row"><span>VAT Rate</span><strong>15%</strong></div>
              <div className="db-info-row"><span>Total Revenue (excl. VAT)</span><strong>{formatMoney(totalRevenue * (100/115), currency)}</strong></div>
              <div className="db-info-row"><span>VAT Amount</span><strong>{formatMoney(vatCollected, currency)}</strong></div>
              <div className="db-info-row"><span>Total (incl. VAT)</span><strong>{formatMoney(totalRevenue, currency)}</strong></div>
            </div>
            <button className="db-outline-btn" style={{ marginTop: "16px" }}><Download className="size-4" /> Export NamRA Report</button>
          </div>
        )}
        {activeTab === "Overdue Report" && (
          <div>
            <h3 className="db-card-title">Overdue Invoices</h3>
            <div className="db-table-wrap">
              <table className="db-table">
                <thead><tr><th>Invoice</th><th>Client</th><th>Due Date</th><th>Amount</th></tr></thead>
                <tbody>
                  {overdue.map(({ invoice }: any) => (
                    <tr key={invoice._id} style={{ color: "#dc2626" }}>
                      <td>{invoice.invoiceNumber}</td>
                      <td>{invoice.clientName ?? invoice.client}</td>
                      <td>{invoice.dueDate}</td>
                      <td>{formatMoney(invoice.amountTotal ?? invoice.amount ?? 0, currency)}</td>
                    </tr>
                  ))}
                  {overdue.length === 0 && <tr><td colSpan={4} className="db-table-empty">No overdue invoices 🎉</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
