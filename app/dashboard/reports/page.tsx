"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  CalendarDays,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Gauge,
  ReceiptText,
  ShieldCheck,
  ShoppingCart,
  WalletCards,
} from "lucide-react";

import { api } from "@/convex/_generated/api";
import { usePlan } from "@/lib/plan";
import { LockedPage } from "../_components/DashboardShell";

type Summary = {
  currency: string;
  invoiceCount: number;
  paid: number;
  outstanding: number;
  overdue: number;
  vatCollected: number;
  vatInput: number;
  purchaseTotal: number;
};

type LedgerRow = {
  type: "invoice" | "purchase";
  number: string;
  party: string;
  issueDate: string;
  dueDate: string;
  status: string;
  currency: string;
  subtotal: number;
  vatAmount: number;
  total: number;
  balanceDue: number;
};

type VatExportRow = {
  recordType: "sale" | "purchase";
  documentType: string;
  documentNumber: string;
  issueDate: string;
  partyName: string;
  partyAddress: string;
  partyVatNumber: string;
  taxMode: string;
  taxModeLabel: string;
  vatRate: number;
  subtotal: number;
  vatAmount: number;
  total: number;
  currency: string;
  status: string;
  retentionUntil: string;
  vedStatus: "ready" | "incomplete";
  missingFields: string[];
};

type VatReturn = {
  organization: {
    name: string;
    legalName: string;
    address: string;
    taxId: string;
    vatNumber: string;
    currency: string;
  } | null;
  settings: {
    vatRegistered: boolean;
    vatNumber: string;
    vatRate: number;
    registrationType: string;
    filingFrequency: "monthly" | "bi_monthly";
    returnDueDay: number;
    recordRetentionYears: number;
    defaultTaxMode: string;
    vedEnabled: boolean;
    transmissionMode: "manual_export" | "near_real_time" | "real_time";
    itasRegistered: boolean;
  } | null;
  period: {
    from: string;
    to: string;
    dueDate: string;
    today: string;
  };
  totals: {
    salesSubtotal: number;
    outputVat: number;
    salesTotal: number;
    purchaseSubtotal: number;
    inputVat: number;
    purchaseTotal: number;
    netVat: number;
    issuedInvoiceCount: number;
    purchaseRecordCount: number;
    incompleteRecordCount: number;
  };
  exportRows: VatExportRow[];
  readiness: Array<{ key: string; label: string; done: boolean }>;
};

const TABS = [
  "Overview",
  "Revenue",
  "Cash Flow",
  "VAT / NamRA",
  "Receivables",
  "Purchases",
  "Exports",
] as const;
type Tab = (typeof TABS)[number];

const overdueStatuses = new Set(["sent", "viewed", "approved", "awaiting_payment", "overdue"]);

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartIso(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
}

function monthEndIso(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))
    .toISOString()
    .slice(0, 10);
}

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

function formatDate(date: string | undefined) {
  if (!date) {
    return "-";
  }

  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return new Intl.DateTimeFormat("en-NA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) {
    return "0%";
  }

  return `${Math.round(value)}%`;
}

function csvCell(value: unknown) {
  const text = Array.isArray(value) ? value.join("; ") : String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadBlob(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadCsv(filename: string, rows: unknown[][]) {
  downloadBlob(
    filename,
    rows.map((row) => row.map(csvCell).join(",")).join("\n"),
    "text/csv;charset=utf-8",
  );
}

function cleanStatus(status: string) {
  return status.replace(/_/g, " ");
}

function monthLabel(issueDate: string) {
  if (!issueDate) {
    return "Undated";
  }

  const parsed = new Date(`${issueDate}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return issueDate.slice(0, 7) || "Undated";
  }

  return new Intl.DateTimeFormat("en-NA", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(parsed);
}

function daysPastDue(row: LedgerRow, today: string) {
  if (!row.dueDate || row.balanceDue <= 0) {
    return 0;
  }

  const due = new Date(`${row.dueDate}T00:00:00.000Z`).getTime();
  const current = new Date(`${today}T00:00:00.000Z`).getTime();

  if (!Number.isFinite(due) || !Number.isFinite(current) || due >= current) {
    return 0;
  }

  return Math.floor((current - due) / 86_400_000);
}

function statusClass(status: string) {
  if (status === "paid" || status === "recorded") {
    return "db-report-status-success";
  }

  if (status === "overdue" || status === "rejected" || status === "incomplete") {
    return "db-report-status-danger";
  }

  if (status === "awaiting_payment" || status === "approved") {
    return "db-report-status-warning";
  }

  return "db-report-status-neutral";
}

function sumRows(rows: LedgerRow[], field: keyof Pick<LedgerRow, "subtotal" | "vatAmount" | "total" | "balanceDue">) {
  return rows.reduce((total, row) => total + row[field], 0);
}

export default function ReportsPage() {
  const { canAccess } = usePlan();
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [from, setFrom] = useState(monthStartIso);
  const [to, setTo] = useState(monthEndIso);
  const summary = useQuery(api.reports.summary, { from, to }) as Summary | undefined;
  const ledgerRowsResult = useQuery(api.reports.ledgerExport, { from, to }) as LedgerRow[] | undefined;
  const vatReturn = useQuery(api.vat.returnSummary, { from, to }) as VatReturn | undefined;
  const workspace = useQuery(api.invoices.workspace);

  const ledgerRows = useMemo(() => ledgerRowsResult ?? [], [ledgerRowsResult]);
  const currency = summary?.currency ?? vatReturn?.organization?.currency ?? workspace?.defaultCurrency ?? "NAD";
  const today = vatReturn?.period.today ?? todayIso();
  const invalidPeriod = Boolean(from && to && from > to);
  const isLoading = summary === undefined || ledgerRowsResult === undefined || vatReturn === undefined;

  const invoiceRows = useMemo(
    () => ledgerRows.filter((row) => row.type === "invoice"),
    [ledgerRows],
  );
  const purchaseRows = useMemo(
    () => ledgerRows.filter((row) => row.type === "purchase"),
    [ledgerRows],
  );
  const paidRows = useMemo(
    () => invoiceRows.filter((row) => row.status === "paid"),
    [invoiceRows],
  );
  const openInvoiceRows = useMemo(
    () =>
      invoiceRows.filter(
        (row) =>
          row.balanceDue > 0 &&
          row.status !== "void" &&
          (overdueStatuses.has(row.status) || row.status !== "draft"),
      ),
    [invoiceRows],
  );
  const overdueRows = useMemo(
    () =>
      openInvoiceRows
        .filter((row) => row.status === "overdue" || daysPastDue(row, today) > 0)
        .sort((a, b) => daysPastDue(b, today) - daysPastDue(a, today)),
    [openInvoiceRows, today],
  );
  const incompleteVatRows = useMemo(
    () => (vatReturn?.exportRows ?? []).filter((row) => row.vedStatus === "incomplete"),
    [vatReturn?.exportRows],
  );

  const trendRows = useMemo(() => {
    const buckets = new Map<
      string,
      { label: string; issued: number; paid: number; purchases: number; vat: number }
    >();

    for (const row of ledgerRows) {
      const key = row.issueDate ? row.issueDate.slice(0, 7) : "undated";
      const existing = buckets.get(key) ?? {
        label: monthLabel(row.issueDate),
        issued: 0,
        paid: 0,
        purchases: 0,
        vat: 0,
      };

      if (row.type === "invoice") {
        existing.issued += row.total;
        existing.vat += row.vatAmount;

        if (row.status === "paid") {
          existing.paid += row.total;
        }
      } else {
        existing.purchases += row.total;
        existing.vat -= row.vatAmount;
      }

      buckets.set(key, existing);
    }

    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, value]) => value)
      .slice(-12);
  }, [ledgerRows]);

  const clientRevenue = useMemo(() => {
    const totals = new Map<string, { party: string; paid: number; issued: number; invoices: number }>();

    for (const row of invoiceRows) {
      const key = row.party || "Client";
      const existing = totals.get(key) ?? {
        party: key,
        paid: 0,
        issued: 0,
        invoices: 0,
      };

      existing.invoices += 1;
      existing.issued += row.total;

      if (row.status === "paid") {
        existing.paid += row.total;
      }

      totals.set(key, existing);
    }

    return Array.from(totals.values()).sort((a, b) => b.issued - a.issued).slice(0, 8);
  }, [invoiceRows]);

  const supplierSpend = useMemo(() => {
    const totals = new Map<string, { party: string; total: number; vat: number; records: number }>();

    for (const row of purchaseRows) {
      const key = row.party || "Supplier";
      const existing = totals.get(key) ?? {
        party: key,
        total: 0,
        vat: 0,
        records: 0,
      };

      existing.records += 1;
      existing.total += row.total;
      existing.vat += row.vatAmount;
      totals.set(key, existing);
    }

    return Array.from(totals.values()).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [purchaseRows]);

  const ageingBuckets = useMemo(() => {
    const buckets = [
      { label: "Current", amount: 0, count: 0 },
      { label: "1-30 days", amount: 0, count: 0 },
      { label: "31-60 days", amount: 0, count: 0 },
      { label: "61+ days", amount: 0, count: 0 },
    ];

    for (const row of openInvoiceRows) {
      const days = daysPastDue(row, today);
      const index = days === 0 ? 0 : days <= 30 ? 1 : days <= 60 ? 2 : 3;
      buckets[index].amount += row.balanceDue;
      buckets[index].count += 1;
    }

    return buckets;
  }, [openInvoiceRows, today]);

  if (!canAccess("reports")) {
    return <LockedPage feature="Reports & Analytics" requiredPlan="Business" />;
  }

  const issuedSales = vatReturn?.totals.salesTotal ?? sumRows(invoiceRows, "total");
  const paidCashIn = summary?.paid ?? sumRows(paidRows, "total");
  const supplierPurchases = vatReturn?.totals.purchaseTotal ?? summary?.purchaseTotal ?? sumRows(purchaseRows, "total");
  const outstanding = summary?.outstanding ?? sumRows(openInvoiceRows, "balanceDue");
  const overdue = summary?.overdue ?? sumRows(overdueRows, "balanceDue");
  const netCash = paidCashIn - supplierPurchases;
  const netVat = vatReturn?.totals.netVat ?? (summary?.vatCollected ?? 0) - (summary?.vatInput ?? 0);
  const readiness = vatReturn?.readiness ?? [];
  const readyChecks = readiness.filter((item) => item.done).length;
  const readinessPercent = readiness.length > 0 ? (readyChecks / readiness.length) * 100 : 0;
  const trendMax = Math.max(
    1,
    ...trendRows.flatMap((row) => [row.issued, row.paid, row.purchases]),
  );
  const periodLabel = `${formatDate(from)} to ${formatDate(to)}`;

  function exportOverview() {
    downloadCsv(`payvio-report-overview-${from}-to-${to}.csv`, [
      ["Metric", "Value"],
      ["Period", periodLabel],
      ["Issued sales", issuedSales],
      ["Paid cash in", paidCashIn],
      ["Supplier purchases", supplierPurchases],
      ["Net cash", netCash],
      ["Outstanding", outstanding],
      ["Overdue", overdue],
      ["Output VAT", vatReturn?.totals.outputVat ?? summary?.vatCollected ?? 0],
      ["Input VAT", vatReturn?.totals.inputVat ?? summary?.vatInput ?? 0],
      ["Net VAT", netVat],
      ["Readiness", `${readyChecks}/${readiness.length}`],
      ["Incomplete VAT records", vatReturn?.totals.incompleteRecordCount ?? 0],
    ]);
  }

  function exportLedger() {
    downloadCsv(`payvio-ledger-${from}-to-${to}.csv`, [
      ["Type", "Document", "Party", "Issue date", "Due date", "Status", "Subtotal", "VAT", "Total", "Balance"],
      ...ledgerRows.map((row) => [
        row.type,
        row.number,
        row.party,
        row.issueDate,
        row.dueDate,
        row.status,
        row.subtotal,
        row.vatAmount,
        row.total,
        row.balanceDue,
      ]),
    ]);
  }

  function exportVatCsv() {
    downloadCsv(`payvio-vat-itas-records-${from}-to-${to}.csv`, [
      [
        "Record type",
        "Document type",
        "Document number",
        "Issue date",
        "Party name",
        "Party address",
        "Party VAT number",
        "Tax mode",
        "Subtotal",
        "VAT",
        "Total",
        "Currency",
        "Status",
        "Retention until",
        "VED status",
        "Missing fields",
      ],
      ...(vatReturn?.exportRows ?? []).map((row) => [
        row.recordType,
        row.documentType,
        row.documentNumber,
        row.issueDate,
        row.partyName,
        row.partyAddress,
        row.partyVatNumber,
        row.taxModeLabel,
        row.subtotal,
        row.vatAmount,
        row.total,
        row.currency,
        row.status,
        row.retentionUntil,
        row.vedStatus,
        row.missingFields,
      ]),
    ]);
  }

  function exportItasJson() {
    downloadBlob(
      `payvio-itas-export-${from}-to-${to}.json`,
      JSON.stringify(
        {
          source: "Payvio Namibia reports",
          period: vatReturn?.period,
          organization: vatReturn?.organization,
          settings: vatReturn?.settings,
          totals: vatReturn?.totals,
          records: vatReturn?.exportRows ?? [],
        },
        null,
        2,
      ),
      "application/json;charset=utf-8",
    );
  }

  function exportActiveReport() {
    if (activeTab === "Revenue") {
      downloadCsv(`payvio-revenue-${from}-to-${to}.csv`, [
        ["Invoice", "Client", "Issue date", "Due date", "Status", "Subtotal", "VAT", "Total", "Balance"],
        ...invoiceRows.map((row) => [
          row.number,
          row.party,
          row.issueDate,
          row.dueDate,
          row.status,
          row.subtotal,
          row.vatAmount,
          row.total,
          row.balanceDue,
        ]),
      ]);
      return;
    }

    if (activeTab === "Cash Flow") {
      downloadCsv(`payvio-cash-flow-${from}-to-${to}.csv`, [
        ["Metric", "Value"],
        ["Paid cash in", paidCashIn],
        ["Supplier purchases", supplierPurchases],
        ["Net cash", netCash],
        ["Outstanding receivables", outstanding],
        ["Overdue receivables", overdue],
      ]);
      return;
    }

    if (activeTab === "VAT / NamRA") {
      exportVatCsv();
      return;
    }

    if (activeTab === "Receivables") {
      downloadCsv(`payvio-receivables-${from}-to-${to}.csv`, [
        ["Invoice", "Client", "Due date", "Days overdue", "Status", "Balance"],
        ...openInvoiceRows.map((row) => [
          row.number,
          row.party,
          row.dueDate,
          daysPastDue(row, today),
          row.status,
          row.balanceDue,
        ]),
      ]);
      return;
    }

    if (activeTab === "Purchases") {
      downloadCsv(`payvio-purchases-${from}-to-${to}.csv`, [
        ["Supplier invoice", "Supplier", "Issue date", "Due date", "Status", "Subtotal", "VAT input", "Total"],
        ...purchaseRows.map((row) => [
          row.number,
          row.party,
          row.issueDate,
          row.dueDate,
          row.status,
          row.subtotal,
          row.vatAmount,
          row.total,
        ]),
      ]);
      return;
    }

    if (activeTab === "Exports") {
      exportLedger();
      return;
    }

    exportOverview();
  }

  return (
    <div className="db-page db-dashboard-page db-reports-page">
      <section className="db-workview">
      <div className="db-workview-head">
        <div>
          <p className="db-breadcrumb">Payvio <span>/</span> Reports</p>
          <h1 className="db-workview-title">Reports</h1>
        </div>
        <div className="db-report-header-actions">
          <button className="db-outline-btn" type="button" onClick={() => setActiveTab("VAT / NamRA")}>
            <ShieldCheck className="size-4" />
            VAT readiness
          </button>
          <button className="db-primary-btn db-new-invoice-btn" type="button" onClick={exportActiveReport} disabled={isLoading}>
            <Download className="size-4" />
            Export
          </button>
        </div>
      </div>

      <section className="db-card db-report-controls-card">
        <div className="db-panel-header">
          <div>
            <p className="db-panel-kicker">Controls</p>
            <h2>Report period</h2>
          </div>
          <div className="db-report-period-chip">
            <Filter className="size-4" />
            {periodLabel}
          </div>
        </div>
        <div className="db-report-controls">
          <label className="db-field">
            <span>From</span>
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="db-field-input" />
          </label>
          <label className="db-field">
            <span>To</span>
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="db-field-input" />
          </label>
          <button className="db-outline-btn" type="button" onClick={() => {
            setFrom(monthStartIso());
            setTo(monthEndIso());
          }}>
            <CalendarDays className="size-4" />
            Current month
          </button>
        </div>
      </section>

      {invalidPeriod ? (
        <div className="db-notice db-notice-clean db-report-warning" role="alert">
          <AlertTriangle className="size-4" />
          <span>The start date is after the end date.</span>
        </div>
      ) : null}

      <div className="db-metric-strip" aria-label="Report metrics">
        <div className="db-metric-cell">
          <span>Issued sales</span>
          <strong>{formatMoney(issuedSales, currency)}</strong>
          <small>{vatReturn?.totals.issuedInvoiceCount ?? invoiceRows.length} issued invoices</small>
        </div>
        <div className="db-metric-cell">
          <span>Paid cash in</span>
          <strong>{formatMoney(paidCashIn, currency)}</strong>
          <small>{paidRows.length} paid invoices</small>
        </div>
        <div className="db-metric-cell">
          <span>Overdue</span>
          <strong>{formatMoney(overdue, currency)}</strong>
          <small>{overdueRows.length} invoices past due</small>
        </div>
        <div className="db-metric-cell">
          <span>Net VAT</span>
          <strong>{formatMoney(netVat, currency)}</strong>
          <small>{netVat >= 0 ? "Payable position" : "Refund position"}</small>
        </div>
      </div>

      <div className="db-tabs db-report-tabs" role="tablist" aria-label="Report views">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`db-tab${activeTab === tab ? " db-tab-active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Overview" ? (
        <>
          <div className="db-report-grid">
            <section className="db-card db-report-wide">
              <div className="db-report-card-head">
                <p className="db-card-title">
                  <BarChart3 className="size-4" />
                  Revenue and purchase trend
                </p>
                <span className="db-report-chip">{trendRows.length || 1} months</span>
              </div>
              <div className="db-report-bars">
                {trendRows.length > 0 ? (
                  trendRows.map((row) => (
                    <div className="db-report-bar-row" key={row.label}>
                      <span>{row.label}</span>
                      <div className="db-report-bar-track">
                        <i className="db-report-bar db-report-bar-issued" style={{ width: `${Math.max(4, (row.issued / trendMax) * 100)}%` }} />
                        <i className="db-report-bar db-report-bar-paid" style={{ width: `${Math.max(4, (row.paid / trendMax) * 100)}%` }} />
                        <i className="db-report-bar db-report-bar-purchase" style={{ width: `${Math.max(4, (row.purchases / trendMax) * 100)}%` }} />
                      </div>
                      <strong>{formatMoney(row.issued, currency)}</strong>
                    </div>
                  ))
                ) : (
                  <div className="db-empty db-report-empty">
                    <BarChart3 className="size-10" />
                    <h3>No report activity</h3>
                    <p>Create invoices or purchase records for this period.</p>
                  </div>
                )}
              </div>
              <div className="db-report-legend">
                <span><i className="db-report-dot-issued" /> Issued</span>
                <span><i className="db-report-dot-paid" /> Paid</span>
                <span><i className="db-report-dot-purchase" /> Purchases</span>
              </div>
            </section>

            <section className="db-card">
              <div className="db-report-card-head">
                <p className="db-card-title">
                  <Gauge className="size-4" />
                  NamRA readiness
                </p>
                <span className="db-report-chip">{formatPercent(readinessPercent)}</span>
              </div>
              <div className="db-report-score">
                <strong>{readyChecks}/{readiness.length || 0}</strong>
                <span>checks ready</span>
              </div>
              <div className="db-compliance-list">
                {readiness.slice(0, 6).map((item) => (
                  <div key={item.key} className="db-compliance-row">
                    <span className={item.done ? "db-compliance-check db-compliance-check-done" : "db-compliance-check db-compliance-check-pending"}>
                      {item.done ? "Y" : "-"}
                    </span>
                    <span>{item.label}</span>
                    <span className="db-compliance-tag">{item.done ? "Ready" : "Open"}</span>
                  </div>
                ))}
              </div>
              <Link href="/dashboard/vat" className="db-outline-btn db-report-card-action">
                <ShieldCheck className="size-4" />
                VAT settings
              </Link>
            </section>
          </div>

          <section className="db-card">
            <div className="db-report-card-head">
              <p className="db-card-title">
                <FileText className="size-4" />
                Report packet
              </p>
              <span className="db-report-chip">{ledgerRows.length} records</span>
            </div>
            <div className="db-info-grid db-report-summary-grid">
              <div className="db-info-row"><span>Paid cash in</span><strong>{formatMoney(paidCashIn, currency)}</strong></div>
              <div className="db-info-row"><span>Supplier purchases</span><strong>{formatMoney(supplierPurchases, currency)}</strong></div>
              <div className="db-info-row"><span>Net cash</span><strong>{formatMoney(netCash, currency)}</strong></div>
              <div className="db-info-row"><span>Outstanding receivables</span><strong>{formatMoney(outstanding, currency)}</strong></div>
              <div className="db-info-row"><span>Incomplete VAT records</span><strong>{vatReturn?.totals.incompleteRecordCount ?? 0}</strong></div>
              <div className="db-info-row"><span>Return due</span><strong>{formatDate(vatReturn?.period.dueDate)}</strong></div>
            </div>
          </section>
        </>
      ) : null}

      {activeTab === "Revenue" ? (
        <>
          <div className="db-split-grid db-report-two">
            <section className="db-card">
              <p className="db-card-title">
                <ArrowUpRight className="size-4" />
                Sales report
              </p>
              <div className="db-info-grid">
                <div className="db-info-row"><span>Issued subtotal</span><strong>{formatMoney(vatReturn?.totals.salesSubtotal ?? sumRows(invoiceRows, "subtotal"), currency)}</strong></div>
                <div className="db-info-row"><span>Output VAT</span><strong>{formatMoney(vatReturn?.totals.outputVat ?? summary?.vatCollected ?? 0, currency)}</strong></div>
                <div className="db-info-row"><span>Issued total</span><strong>{formatMoney(issuedSales, currency)}</strong></div>
                <div className="db-info-row"><span>Paid total</span><strong>{formatMoney(paidCashIn, currency)}</strong></div>
              </div>
            </section>
            <section className="db-card">
              <p className="db-card-title">
                <WalletCards className="size-4" />
                Clients by revenue
              </p>
              <div className="db-report-mini-list">
                {clientRevenue.length > 0 ? (
                  clientRevenue.map((client) => (
                    <div className="db-report-mini-row" key={client.party}>
                      <span>
                        <strong>{client.party}</strong>
                        <small>{client.invoices} invoices</small>
                      </span>
                      <b>{formatMoney(client.issued, currency)}</b>
                    </div>
                  ))
                ) : (
                  <p className="db-report-muted">No client revenue in this period.</p>
                )}
              </div>
            </section>
          </div>

          <section className="db-card">
            <p className="db-card-title">
              <ReceiptText className="size-4" />
              Issued invoices
            </p>
            <div className="db-table-wrap">
              <table className="db-table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Client</th>
                    <th>Issue date</th>
                    <th>Status</th>
                    <th>VAT</th>
                    <th>Total</th>
                    <th>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceRows.map((row) => (
                    <tr key={`invoice:${row.number}:${row.issueDate}`}>
                      <td><span className="db-inv-num">{row.number}</span></td>
                      <td>{row.party}</td>
                      <td>{formatDate(row.issueDate)}</td>
                      <td><span className={`db-status-pill ${statusClass(row.status)}`}>{cleanStatus(row.status)}</span></td>
                      <td>{formatMoney(row.vatAmount, row.currency)}</td>
                      <td>{formatMoney(row.total, row.currency)}</td>
                      <td>{formatMoney(row.balanceDue, row.currency)}</td>
                    </tr>
                  ))}
                  {invoiceRows.length === 0 ? <tr><td colSpan={7} className="db-table-empty">No issued invoices in this period</td></tr> : null}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      {activeTab === "Cash Flow" ? (
        <div className="db-report-grid">
          <section className="db-card db-report-wide">
            <p className="db-card-title">
              <ArrowUpRight className="size-4" />
              Cash flow position
            </p>
            <div className="db-report-flow-grid">
              <div className="db-report-flow-cell">
                <span>Cash in</span>
                <strong>{formatMoney(paidCashIn, currency)}</strong>
                <small>{paidRows.length} paid invoices</small>
              </div>
              <div className="db-report-flow-cell">
                <span>Cash out</span>
                <strong>{formatMoney(supplierPurchases, currency)}</strong>
                <small>{purchaseRows.length} supplier records</small>
              </div>
              <div className={`db-report-flow-cell ${netCash >= 0 ? "db-report-positive" : "db-report-negative"}`}>
                <span>Net position</span>
                <strong>{formatMoney(netCash, currency)}</strong>
                <small>{netCash >= 0 ? "Positive period" : "Negative period"}</small>
              </div>
            </div>
          </section>

          <section className="db-card">
            <p className="db-card-title">
              <ArrowDownRight className="size-4" />
              Working capital
            </p>
            <div className="db-info-grid">
              <div className="db-info-row"><span>Outstanding</span><strong>{formatMoney(outstanding, currency)}</strong></div>
              <div className="db-info-row"><span>Overdue</span><strong>{formatMoney(overdue, currency)}</strong></div>
              <div className="db-info-row"><span>Purchase balance</span><strong>{formatMoney(sumRows(purchaseRows, "balanceDue"), currency)}</strong></div>
              <div className="db-info-row"><span>Receivable ratio</span><strong>{formatPercent(issuedSales ? (outstanding / issuedSales) * 100 : 0)}</strong></div>
            </div>
          </section>
        </div>
      ) : null}

      {activeTab === "VAT / NamRA" ? (
        <>
          <section className="db-card db-report-status-card">
            <div className="db-report-status-main">
              <span className="db-report-status-icon">
              <ShieldCheck className="size-4" />
              </span>
              <div>
              <p>
                {vatReturn?.settings?.vedEnabled ? "VAT e-document records enabled" : "Manual VAT export mode"}
              </p>
              <span>
                VAT {Math.round((vatReturn?.settings?.vatRate ?? 0.15) * 100)}% | return due day {vatReturn?.settings?.returnDueDay ?? 25} | retention {vatReturn?.settings?.recordRetentionYears ?? 5} years
              </span>
              </div>
            </div>
            <span className="db-compliance-badge db-report-status-badge">
              {vatReturn?.settings?.transmissionMode === "manual_export"
                ? "Manual export"
                : vatReturn?.settings?.transmissionMode?.replace("_", " ") ?? "Manual export"}
            </span>
          </section>

          <div className="db-split-grid db-report-two">
            <section className="db-card">
              <p className="db-card-title">
                <BadgeCheck className="size-4" />
                VAT return summary
              </p>
              <div className="db-info-grid">
                <div className="db-info-row"><span>Sales subtotal</span><strong>{formatMoney(vatReturn?.totals.salesSubtotal ?? 0, currency)}</strong></div>
                <div className="db-info-row"><span>Output VAT</span><strong>{formatMoney(vatReturn?.totals.outputVat ?? 0, currency)}</strong></div>
                <div className="db-info-row"><span>Purchase subtotal</span><strong>{formatMoney(vatReturn?.totals.purchaseSubtotal ?? 0, currency)}</strong></div>
                <div className="db-info-row"><span>Input VAT</span><strong>{formatMoney(vatReturn?.totals.inputVat ?? 0, currency)}</strong></div>
                <div className="db-info-row db-info-row-total"><span>Net VAT</span><strong>{formatMoney(netVat, currency)}</strong></div>
              </div>
            </section>
            <section className="db-card">
              <p className="db-card-title">
                <ShieldCheck className="size-4" />
                Tax invoice checks
              </p>
              <div className="db-compliance-list">
                {readiness.map((item) => (
                  <div key={item.key} className="db-compliance-row">
                    <span className={item.done ? "db-compliance-check db-compliance-check-done" : "db-compliance-check db-compliance-check-pending"}>
                      {item.done ? "Y" : "-"}
                    </span>
                    <span>{item.label}</span>
                    <span className="db-compliance-tag">{item.done ? "Ready" : "Open"}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="db-card">
            <div className="db-report-card-head">
              <p className="db-card-title">
                <FileSpreadsheet className="size-4" />
                ITAS export records
              </p>
              <div className="db-header-actions">
                <button className="db-outline-btn" type="button" onClick={exportItasJson} disabled={!vatReturn}>
                  <Download className="size-4" />
                  JSON
                </button>
                <button className="db-primary-btn" type="button" onClick={exportVatCsv} disabled={!vatReturn}>
                  <Download className="size-4" />
                  CSV
                </button>
              </div>
            </div>
            <div className="db-table-wrap">
              <table className="db-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Document</th>
                    <th>Date</th>
                    <th>Party</th>
                    <th>Tax</th>
                    <th>Status</th>
                    <th>VAT</th>
                    <th>Retention</th>
                  </tr>
                </thead>
                <tbody>
                  {(vatReturn?.exportRows ?? []).slice(0, 50).map((row) => (
                    <tr key={`${row.recordType}:${row.documentNumber}:${row.issueDate}`}>
                      <td>{row.recordType}</td>
                      <td>
                        <span className="db-inv-num">{row.documentNumber || "-"}</span>
                        <span className="db-report-table-meta">{row.documentType}</span>
                      </td>
                      <td>{formatDate(row.issueDate)}</td>
                      <td>{row.partyName}</td>
                      <td>{row.taxModeLabel}</td>
                      <td><span className={`db-status-pill ${statusClass(row.vedStatus)}`}>{row.vedStatus}</span></td>
                      <td>{formatMoney(row.vatAmount, row.currency)}</td>
                      <td>{formatDate(row.retentionUntil)}</td>
                    </tr>
                  ))}
                  {vatReturn?.exportRows.length === 0 ? <tr><td colSpan={8} className="db-table-empty">No VAT records in this period</td></tr> : null}
                </tbody>
              </table>
            </div>
            {incompleteVatRows.length > 0 ? (
              <div className="db-report-incomplete-list">
                {incompleteVatRows.slice(0, 4).map((row) => (
                  <div key={`${row.recordType}:${row.documentNumber}:missing`}>
                    <AlertTriangle className="size-4" />
                    <span>
                      <strong>{row.documentNumber || row.partyName}</strong>
                      <small>{row.missingFields.join(", ")}</small>
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        </>
      ) : null}

      {activeTab === "Receivables" ? (
        <>
          <div className="db-metric-strip db-report-ageing-strip" aria-label="Receivable ageing">
            {ageingBuckets.map((bucket) => (
              <div className="db-metric-cell" key={bucket.label}>
                <span>{bucket.label}</span>
                <strong>{formatMoney(bucket.amount, currency)}</strong>
                <small>{bucket.count} invoices</small>
              </div>
            ))}
          </div>
          <section className="db-card">
            <div className="db-report-card-head">
              <p className="db-card-title">
                <Clock className="size-4" />
                Receivables and overdue invoices
              </p>
              <Link href="/dashboard/reminders" className="db-outline-btn">
                <Clock className="size-4" />
                Reminders
              </Link>
            </div>
            <div className="db-table-wrap">
              <table className="db-table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Client</th>
                    <th>Due date</th>
                    <th>Days overdue</th>
                    <th>Status</th>
                    <th>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {openInvoiceRows.map((row) => (
                    <tr key={`receivable:${row.number}:${row.dueDate}`}>
                      <td><span className="db-inv-num">{row.number}</span></td>
                      <td>{row.party}</td>
                      <td>{formatDate(row.dueDate)}</td>
                      <td>{daysPastDue(row, today)}</td>
                      <td><span className={`db-status-pill ${statusClass(row.status)}`}>{cleanStatus(row.status)}</span></td>
                      <td>{formatMoney(row.balanceDue, row.currency)}</td>
                    </tr>
                  ))}
                  {openInvoiceRows.length === 0 ? <tr><td colSpan={6} className="db-table-empty">No open receivables in this period</td></tr> : null}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      {activeTab === "Purchases" ? (
        <>
          <div className="db-split-grid db-report-two">
            <section className="db-card">
              <p className="db-card-title">
                <ShoppingCart className="size-4" />
                Supplier spend
              </p>
              <div className="db-info-grid">
                <div className="db-info-row"><span>Purchase subtotal</span><strong>{formatMoney(vatReturn?.totals.purchaseSubtotal ?? sumRows(purchaseRows, "subtotal"), currency)}</strong></div>
                <div className="db-info-row"><span>Input VAT</span><strong>{formatMoney(vatReturn?.totals.inputVat ?? sumRows(purchaseRows, "vatAmount"), currency)}</strong></div>
                <div className="db-info-row"><span>Total purchases</span><strong>{formatMoney(supplierPurchases, currency)}</strong></div>
                <div className="db-info-row"><span>Purchase records</span><strong>{vatReturn?.totals.purchaseRecordCount ?? purchaseRows.length}</strong></div>
              </div>
            </section>
            <section className="db-card">
              <p className="db-card-title">
                <ReceiptText className="size-4" />
                Suppliers by spend
              </p>
              <div className="db-report-mini-list">
                {supplierSpend.length > 0 ? (
                  supplierSpend.map((supplier) => (
                    <div className="db-report-mini-row" key={supplier.party}>
                      <span>
                        <strong>{supplier.party}</strong>
                        <small>{supplier.records} records | VAT {formatMoney(supplier.vat, currency)}</small>
                      </span>
                      <b>{formatMoney(supplier.total, currency)}</b>
                    </div>
                  ))
                ) : (
                  <p className="db-report-muted">No supplier purchases in this period.</p>
                )}
              </div>
            </section>
          </div>

          <section className="db-card">
            <p className="db-card-title">
              <FileText className="size-4" />
              Purchase records
            </p>
            <div className="db-table-wrap">
              <table className="db-table">
                <thead>
                  <tr>
                    <th>Supplier invoice</th>
                    <th>Supplier</th>
                    <th>Issue date</th>
                    <th>Status</th>
                    <th>VAT input</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseRows.map((row) => (
                    <tr key={`purchase:${row.number}:${row.issueDate}`}>
                      <td><span className="db-inv-num">{row.number || "-"}</span></td>
                      <td>{row.party}</td>
                      <td>{formatDate(row.issueDate)}</td>
                      <td><span className={`db-status-pill ${statusClass(row.status)}`}>{cleanStatus(row.status)}</span></td>
                      <td>{formatMoney(row.vatAmount, row.currency)}</td>
                      <td>{formatMoney(row.total, row.currency)}</td>
                    </tr>
                  ))}
                  {purchaseRows.length === 0 ? <tr><td colSpan={6} className="db-table-empty">No purchase records in this period</td></tr> : null}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      {activeTab === "Exports" ? (
        <div className="db-report-grid">
          <section className="db-card">
            <p className="db-card-title">
              <Download className="size-4" />
              Export center
            </p>
            <div className="db-report-export-actions">
              <button className="db-outline-btn" type="button" onClick={exportOverview}>
                <Download className="size-4" />
                Overview CSV
              </button>
              <button className="db-outline-btn" type="button" onClick={exportLedger}>
                <Download className="size-4" />
                Ledger CSV
              </button>
              <button className="db-outline-btn" type="button" onClick={exportVatCsv}>
                <Download className="size-4" />
                VAT CSV
              </button>
              <button className="db-primary-btn" type="button" onClick={exportItasJson}>
                <Download className="size-4" />
                ITAS JSON
              </button>
            </div>
          </section>
          <section className="db-card db-report-wide">
            <p className="db-card-title">
              <FileSpreadsheet className="size-4" />
              Exportable records
            </p>
            <div className="db-table-wrap">
              <table className="db-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Document</th>
                    <th>Party</th>
                    <th>Issue date</th>
                    <th>Status</th>
                    <th>VAT</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerRows.map((row) => (
                    <tr key={`export:${row.type}:${row.number}:${row.issueDate}`}>
                      <td>{row.type}</td>
                      <td><span className="db-inv-num">{row.number || "-"}</span></td>
                      <td>{row.party}</td>
                      <td>{formatDate(row.issueDate)}</td>
                      <td><span className={`db-status-pill ${statusClass(row.status)}`}>{cleanStatus(row.status)}</span></td>
                      <td>{formatMoney(row.vatAmount, row.currency)}</td>
                      <td>{formatMoney(row.total, row.currency)}</td>
                    </tr>
                  ))}
                  {ledgerRows.length === 0 ? <tr><td colSpan={7} className="db-table-empty">No export records in this period</td></tr> : null}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}
      </section>
    </div>
  );
}
