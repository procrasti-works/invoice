"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Download,
  FileJson,
  FileText,
  Filter,
  Search,
  Shield,
  ShoppingCart,
  SlidersHorizontal,
  WalletCards,
} from "lucide-react";

import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { usePlan } from "@/lib/plan";
import { useQuery } from "convex/react";
import { LockedPage } from "../_components/DashboardShell";

type InvoiceRow = {
  invoice: Doc<"invoices">;
};

type PurchaseRow = {
  purchase: Doc<"purchases">;
  supplier: Doc<"suppliers"> | null;
};

type TaxMode = "no_vat" | "vat_15" | "zero_rated" | "exempt";

type VatExportRow = {
  recordType: "sale" | "purchase";
  documentType: string;
  documentNumber: string;
  issueDate: string;
  partyName: string;
  partyAddress: string;
  partyVatNumber: string;
  taxMode: TaxMode;
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
    taxId: string;
    vatRate: number;
    registrationType: string;
    filingFrequency: "monthly" | "bi_monthly";
    returnDueDay: number;
    recordRetentionYears: number;
    defaultTaxMode: TaxMode;
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
  readiness: Array<{
    key: string;
    label: string;
    done: boolean;
  }>;
};

type LedgerTab = "Overview" | "Issued" | "Received" | "Audit" | "NamRA Export";
type RecordFilter = "all" | "incomplete" | "ready" | "vat" | "outstanding" | "paid" | "overdue";
type PeriodPreset = "month" | "quarter" | "year" | "all" | "custom";

const TABS: LedgerTab[] = ["Overview", "Issued", "Received", "Audit", "NamRA Export"];

const FILTERS: { id: RecordFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "incomplete", label: "Incomplete" },
  { id: "ready", label: "Ready" },
  { id: "vat", label: "VAT" },
  { id: "outstanding", label: "Open" },
  { id: "paid", label: "Paid" },
  { id: "overdue", label: "Overdue" },
];

const statusToneClass: Record<string, string> = {
  draft: "db-ledger-pill-muted",
  ready: "db-ledger-pill-info",
  sent: "db-ledger-pill-info",
  viewed: "db-ledger-pill-info",
  approved: "db-ledger-pill-success",
  awaiting_payment: "db-ledger-pill-warning",
  rejected: "db-ledger-pill-danger",
  paid: "db-ledger-pill-success",
  overdue: "db-ledger-pill-danger",
  recorded: "db-ledger-pill-info",
  void: "db-ledger-pill-muted",
};

const requiredTaxInvoiceFields = [
  "Tax Invoice label",
  "Supplier name, address, VAT number",
  "Customer name and address over N$500",
  "Sequential invoice number",
  "Date of issue",
  "Description, quantity, unit price",
  "Subtotal, VAT, total",
  "5-year retention",
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartIso(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
}

function quarterStartIso(date = new Date()) {
  const firstQuarterMonth = Math.floor(date.getUTCMonth() / 3) * 3;
  return new Date(Date.UTC(date.getUTCFullYear(), firstQuarterMonth, 1))
    .toISOString()
    .slice(0, 10);
}

function yearStartIso(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), 0, 1)).toISOString().slice(0, 10);
}

function presetRange(preset: PeriodPreset) {
  const to = todayIso();

  if (preset === "quarter") {
    return { from: quarterStartIso(), to };
  }

  if (preset === "year") {
    return { from: yearStartIso(), to };
  }

  if (preset === "all") {
    return { from: "2000-01-01", to: "2099-12-31" };
  }

  return { from: monthStartIso(), to };
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

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-NA", { maximumFractionDigits: 0 }).format(value);
}

function invoiceTotal(invoice: Doc<"invoices">) {
  return invoice.total ?? invoice.amountTotal ?? invoice.amount ?? 0;
}

function invoiceBalance(invoice: Doc<"invoices">) {
  return invoice.balanceDue ?? (invoice.status === "paid" ? 0 : invoiceTotal(invoice));
}

function statusLabel(value: string) {
  return value.replace(/_/g, " ");
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

function insidePeriod(date: string | undefined, from: string, to: string) {
  if (!date) {
    return true;
  }

  return date >= from && date <= to;
}

function isOpenInvoice(invoice: Doc<"invoices">) {
  return ["sent", "viewed", "approved", "awaiting_payment", "overdue"].includes(invoice.status);
}

function matchesFilter(record: VatExportRow, filter: RecordFilter) {
  if (filter === "incomplete") {
    return record.vedStatus === "incomplete";
  }

  if (filter === "ready") {
    return record.vedStatus === "ready";
  }

  if (filter === "vat") {
    return record.taxMode === "vat_15" || record.vatAmount > 0;
  }

  if (filter === "outstanding") {
    return record.status !== "paid" && record.status !== "void";
  }

  if (filter === "paid") {
    return record.status === "paid";
  }

  if (filter === "overdue") {
    return record.status === "overdue";
  }

  return true;
}

function rowSearchText(row: VatExportRow) {
  return [
    row.recordType,
    row.documentType,
    row.documentNumber,
    row.issueDate,
    row.partyName,
    row.partyAddress,
    row.partyVatNumber,
    row.taxModeLabel,
    row.status,
    row.vedStatus,
    row.missingFields.join(" "),
  ]
    .join(" ")
    .toLowerCase();
}

function invoiceSearchText(invoice: Doc<"invoices">) {
  return [
    invoice.invoiceNumber,
    invoice.clientName,
    invoice.client,
    invoice.clientEmail,
    invoice.issueDate,
    invoice.dueDate,
    invoice.status,
    invoice.taxMode,
  ]
    .join(" ")
    .toLowerCase();
}

function purchaseSearchText(purchase: Doc<"purchases">) {
  return [
    purchase.invoiceNumber,
    purchase.purchaseOrderNumber,
    purchase.supplierName,
    purchase.supplierVatNumber,
    purchase.issueDate,
    purchase.dueDate,
    purchase.status,
    purchase.taxMode,
  ]
    .join(" ")
    .toLowerCase();
}

function ComplianceBadge({ status }: { status: "ready" | "incomplete" | string }) {
  const ready = status === "ready";

  return (
    <span className={`db-status-pill ${ready ? "db-ledger-pill-success" : "db-ledger-pill-warning"}`}>
      {ready ? "Ready" : "Incomplete"}
    </span>
  );
}

function StatusPill({ value }: { value: string }) {
  return (
    <span className={`db-status-pill ${statusToneClass[value] ?? "db-ledger-pill-muted"}`}>
      {statusLabel(value)}
    </span>
  );
}

export default function LedgerPage() {
  const { canAccess } = usePlan();
  const initialRange = useMemo(() => presetRange("month"), []);
  const [activeTab, setActiveTab] = useState<LedgerTab>("Overview");
  const [recordFilter, setRecordFilter] = useState<RecordFilter>("all");
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("month");
  const [periodFrom, setPeriodFrom] = useState(initialRange.from);
  const [periodTo, setPeriodTo] = useState(initialRange.to);
  const [search, setSearch] = useState("");

  const periodArgs = useMemo(
    () => ({
      from: periodFrom,
      to: periodTo,
    }),
    [periodFrom, periodTo],
  );
  const invoiceRows = useQuery(api.invoices.listRecords, periodArgs) as
    | InvoiceRow[]
    | undefined;
  const purchaseRows = useQuery(api.purchases.listPurchases, periodArgs) as
    | PurchaseRow[]
    | undefined;
  const vatReturn = useQuery(api.vat.returnSummary, periodArgs) as VatReturn | undefined;
  const workspace = useQuery(api.invoices.workspace);

  if (!canAccess("ledger")) {
    return <LockedPage feature="Invoice Ledger" requiredPlan="Business" />;
  }

  const workspaceDoc = workspace as Doc<"organizations"> | null | undefined;
  const currency = workspaceDoc?.defaultCurrency ?? vatReturn?.organization?.currency ?? "NAD";
  const query = search.trim().toLowerCase();
  const invoices = invoiceRows?.map((row) => row.invoice) ?? [];
  const purchases = purchaseRows?.map((row) => row.purchase) ?? [];
  const auditRows = vatReturn?.exportRows ?? [];
  const saleAuditByNumber = new Map(
    auditRows
      .filter((row) => row.recordType === "sale")
      .map((row) => [row.documentNumber, row]),
  );
  const purchaseAuditByNumber = new Map(
    auditRows
      .filter((row) => row.recordType === "purchase")
      .map((row) => [row.documentNumber, row]),
  );

  const filteredAuditRows = auditRows.filter((row) => {
    const matchesSearch = !query || rowSearchText(row).includes(query);
    return matchesSearch && matchesFilter(row, recordFilter);
  });
  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch = !query || invoiceSearchText(invoice).includes(query);
    const matchesDate = insidePeriod(invoice.issueDate ?? invoice.dueDate, periodFrom, periodTo);
    const matchesStatus =
      recordFilter === "all" ||
      (recordFilter === "paid" && invoice.status === "paid") ||
      (recordFilter === "overdue" && invoice.status === "overdue") ||
      (recordFilter === "outstanding" && isOpenInvoice(invoice)) ||
      (recordFilter === "vat" && ((invoice.taxMode ?? "no_vat") === "vat_15" || (invoice.vatAmount ?? 0) > 0)) ||
      (recordFilter === "ready" && saleAuditByNumber.get(invoice.invoiceNumber)?.vedStatus === "ready") ||
      (recordFilter === "incomplete" && saleAuditByNumber.get(invoice.invoiceNumber)?.vedStatus === "incomplete");

    return matchesSearch && matchesDate && matchesStatus;
  });
  const filteredPurchases = purchases.filter((purchase) => {
    const matchesSearch = !query || purchaseSearchText(purchase).includes(query);
    const matchesDate = insidePeriod(purchase.issueDate, periodFrom, periodTo);
    const purchaseAudit = purchase.invoiceNumber
      ? purchaseAuditByNumber.get(purchase.invoiceNumber)
      : null;
    const matchesStatus =
      recordFilter === "all" ||
      (recordFilter === "paid" && purchase.status === "paid") ||
      (recordFilter === "outstanding" && purchase.status !== "paid" && purchase.status !== "void") ||
      (recordFilter === "vat" && (purchase.taxMode === "vat_15" || purchase.vatAmount > 0)) ||
      (recordFilter === "ready" && purchaseAudit?.vedStatus === "ready") ||
      (recordFilter === "incomplete" && purchaseAudit?.vedStatus === "incomplete") ||
      (recordFilter === "overdue" && Boolean(purchase.dueDate && purchase.dueDate < todayIso() && purchase.status !== "paid"));

    return matchesSearch && matchesDate && matchesStatus;
  });

  const incompleteRows = filteredAuditRows.filter((row) => row.vedStatus === "incomplete");
  const issuedCount = vatReturn?.totals.issuedInvoiceCount ?? auditRows.filter((row) => row.recordType === "sale").length;
  const receivedCount =
    vatReturn?.totals.purchaseRecordCount ?? auditRows.filter((row) => row.recordType === "purchase").length;
  const receivables = filteredInvoices
    .filter((invoice) => invoice.status !== "void" && invoice.status !== "paid")
    .reduce((total, invoice) => total + invoiceBalance(invoice), 0);
  const payables = filteredPurchases
    .filter((purchase) => purchase.status !== "void" && purchase.status !== "paid")
    .reduce((total, purchase) => total + purchase.balanceDue, 0);
  const currencySummary = Array.from(
    [...filteredInvoices, ...filteredPurchases].reduce((map, record) => {
      const recordCurrency =
        "invoiceNumber" in record && "clientName" in record
          ? record.currency ?? currency
          : record.currency ?? currency;
      const current = map.get(recordCurrency) ?? { count: 0, total: 0 };
      const total =
        "clientName" in record || "client" in record
          ? invoiceTotal(record as Doc<"invoices">)
          : (record as Doc<"purchases">).total;

      current.count += 1;
      current.total += total;
      map.set(recordCurrency, current);
      return map;
    }, new Map<string, { count: number; total: number }>()),
  );
  const readiness = vatReturn?.readiness ?? [];
  const readyCount = readiness.filter((item) => item.done).length;
  const namraReady =
    (vatReturn?.settings?.vedEnabled ?? false) &&
    incompleteRows.length === 0 &&
    readiness.every((item) => item.done || item.key === "namra-transmission");

  function applyPreset(preset: PeriodPreset) {
    const next = presetRange(preset);
    setPeriodPreset(preset);
    setPeriodFrom(next.from);
    setPeriodTo(next.to);
  }

  function exportCurrentCsv() {
    if (activeTab === "Issued") {
      downloadCsv(`payvio-issued-ledger-${periodFrom}-to-${periodTo}.csv`, [
        [
          "Invoice",
          "Client",
          "Issue date",
          "Due date",
          "Status",
          "Tax mode",
          "Subtotal",
          "VAT",
          "Total",
          "Balance",
          "Currency",
          "VED status",
          "Missing fields",
        ],
        ...filteredInvoices.map((invoice) => {
          const audit = saleAuditByNumber.get(invoice.invoiceNumber);

          return [
            invoice.invoiceNumber,
            invoice.clientName ?? invoice.client ?? "",
            invoice.issueDate ?? "",
            invoice.dueDate,
            invoice.status,
            invoice.taxMode ?? "no_vat",
            invoice.subtotal ?? invoiceTotal(invoice),
            invoice.vatAmount ?? 0,
            invoiceTotal(invoice),
            invoiceBalance(invoice),
            invoice.currency ?? currency,
            audit?.vedStatus ?? "",
            audit?.missingFields ?? [],
          ];
        }),
      ]);
      return;
    }

    if (activeTab === "Received") {
      downloadCsv(`payvio-received-ledger-${periodFrom}-to-${periodTo}.csv`, [
        [
          "Supplier invoice",
          "Purchase order",
          "Supplier",
          "Supplier VAT",
          "Issue date",
          "Due date",
          "Status",
          "Tax mode",
          "Subtotal",
          "VAT input",
          "Total",
          "Balance",
          "Currency",
          "VED status",
          "Missing fields",
        ],
        ...filteredPurchases.map((purchase) => {
          const audit = purchase.invoiceNumber
            ? purchaseAuditByNumber.get(purchase.invoiceNumber)
            : null;

          return [
            purchase.invoiceNumber ?? "",
            purchase.purchaseOrderNumber ?? "",
            purchase.supplierName,
            purchase.supplierVatNumber ?? "",
            purchase.issueDate,
            purchase.dueDate ?? "",
            purchase.status,
            purchase.taxMode,
            purchase.subtotal,
            purchase.vatAmount,
            purchase.total,
            purchase.balanceDue,
            purchase.currency,
            audit?.vedStatus ?? "",
            audit?.missingFields ?? [],
          ];
        }),
      ]);
      return;
    }

    const rows = activeTab === "Audit" ? incompleteRows : filteredAuditRows;
    downloadCsv(`payvio-ledger-${activeTab.toLowerCase().replace(/ /g, "-")}-${periodFrom}-to-${periodTo}.csv`, [
      [
        "Record type",
        "Document type",
        "Document number",
        "Issue date",
        "Party name",
        "Party address",
        "Party VAT number",
        "Tax mode",
        "VAT rate",
        "Subtotal",
        "VAT",
        "Total",
        "Currency",
        "Status",
        "Retention until",
        "VED status",
        "Missing fields",
      ],
      ...rows.map((row) => [
        row.recordType,
        row.documentType,
        row.documentNumber,
        row.issueDate,
        row.partyName,
        row.partyAddress,
        row.partyVatNumber,
        row.taxModeLabel,
        row.vatRate,
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

  function exportNamraJson() {
    downloadBlob(
      `payvio-namra-itas-export-${periodFrom}-to-${periodTo}.json`,
      JSON.stringify(
        {
          schemaVersion: "payvio.namibia.ledger.v1",
          jurisdiction: "NA",
          generatedAt: new Date().toISOString(),
          organization: vatReturn?.organization ?? {
            name: workspaceDoc?.name ?? "",
            legalName: workspaceDoc?.legalName ?? "",
            address: workspaceDoc?.address ?? "",
            taxId: workspaceDoc?.taxId ?? "",
            vatNumber: workspaceDoc?.vatNumber ?? "",
            currency,
          },
          period: vatReturn?.period ?? periodArgs,
          settings: vatReturn?.settings ?? null,
          totals: vatReturn?.totals ?? null,
          readiness: {
            ready: namraReady,
            completeRecordCount: filteredAuditRows.length - incompleteRows.length,
            incompleteRecordCount: incompleteRows.length,
          },
          records: filteredAuditRows,
        },
        null,
        2,
      ),
      "application/json;charset=utf-8",
    );
  }

  return (
    <div className="db-page db-dashboard-page db-ledger-page">
      <section className="db-workview">
      <div className="db-workview-head">
        <div>
          <p className="db-breadcrumb">Payvio <span>/</span> Ledger</p>
          <h1 className="db-workview-title">Ledger</h1>
        </div>
        <div className="db-ledger-header-actions">
          <button
            className="db-outline-btn"
            type="button"
            onClick={() => document.getElementById("ledger-search")?.focus()}
          >
            <Filter className="size-4" />
            Filter
          </button>
          <button className="db-outline-btn" type="button" onClick={exportNamraJson}>
            <FileJson className="size-4" />
            ITAS JSON
          </button>
          <button className="db-primary-btn db-new-invoice-btn" type="button" onClick={exportCurrentCsv}>
            <Download className="size-4" />
            Export CSV
          </button>
        </div>
      </div>

      <section className="db-card db-ledger-controls-card">
        <div className="db-panel-header">
          <div>
            <p className="db-panel-kicker">Controls</p>
            <h2>Period and filters</h2>
          </div>
          <span className="db-panel-meta">{periodPreset === "all" ? "All time" : periodPreset}</span>
        </div>
        <div className="db-ledger-controls-body">
          <div className="db-ledger-control-grid">
            <label className="db-field">
              Period from
              <input
                type="date"
                value={periodFrom}
                onChange={(event) => {
                  setPeriodPreset("custom");
                  setPeriodFrom(event.target.value);
                }}
                className="db-field-input"
              />
            </label>
            <label className="db-field">
              Period to
              <input
                type="date"
                value={periodTo}
                onChange={(event) => {
                  setPeriodPreset("custom");
                  setPeriodTo(event.target.value);
                }}
                className="db-field-input"
              />
            </label>
            <label className="db-field">
              Search
              <span className="db-search-bar db-ledger-search">
                <Search className="size-4 text-[#9ca3af]" />
                <input
                  id="ledger-search"
                  placeholder="Number, party, VAT, status"
                  className="db-search-bar-input"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </span>
            </label>
          </div>
          <div className="db-tabs db-ledger-preset-tabs" aria-label="Ledger period presets">
            {(["month", "quarter", "year", "all"] as PeriodPreset[]).map((preset) => (
              <button
                key={preset}
                type="button"
                className={`db-tab${periodPreset === preset ? " db-tab-active" : ""}`}
                onClick={() => applyPreset(preset)}
              >
                {preset === "all" ? "All time" : preset}
              </button>
            ))}
          </div>
          <div className="db-tabs db-ledger-filter-tabs" aria-label="Ledger filters">
            {FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                className={`db-tab${recordFilter === filter.id ? " db-tab-active" : ""}`}
                onClick={() => setRecordFilter(filter.id)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="db-card db-ledger-status-card">
        <div className="db-ledger-status-main">
          <span className="db-ledger-status-icon">
          <Shield className="size-4" />
          </span>
          <div>
          <p>
            {namraReady ? "NamRA export ready" : "NamRA export needs review"}
          </p>
          <span>
            VAT {Math.round((vatReturn?.settings?.vatRate ?? 0.15) * 100)}% | due {vatReturn?.period.dueDate ?? "-"} | retention {vatReturn?.settings?.recordRetentionYears ?? 5} years
          </span>
          </div>
        </div>
        <span className="db-compliance-badge db-ledger-status-badge">
          {vatReturn?.settings?.transmissionMode?.replace(/_/g, " ") ?? "manual export"}
        </span>
      </section>

      <div className="db-metric-strip" aria-label="Ledger metrics">
        <div className="db-metric-cell">
          <span>Issued records</span>
          <strong>{formatNumber(issuedCount)}</strong>
          <small>{formatMoney(vatReturn?.totals.salesTotal ?? 0, currency)} sales</small>
        </div>
        <div className="db-metric-cell">
          <span>Received records</span>
          <strong>{formatNumber(receivedCount)}</strong>
          <small>{formatMoney(vatReturn?.totals.purchaseTotal ?? 0, currency)} purchases</small>
        </div>
        <div className="db-metric-cell">
          <span>Net VAT</span>
          <strong>{formatMoney(vatReturn?.totals.netVat ?? 0, currency)}</strong>
          <small>Output minus input</small>
        </div>
        <div className="db-metric-cell">
          <span>Exceptions</span>
          <strong>{formatNumber(incompleteRows.length)}</strong>
          <small>{filteredAuditRows.length} export rows</small>
        </div>
      </div>

      <div className="db-tabs db-ledger-view-tabs" role="tablist" aria-label="Ledger views">
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
        <div className="grid gap-5">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="db-card">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="db-card-title">
                  <AlertTriangle className="size-4" />
                  Compliance queue
                </p>
                <button type="button" className="db-outline-btn" onClick={() => setActiveTab("Audit")}>
                  Review
                  <ArrowUpRight className="size-4" />
                </button>
              </div>
              <div className="db-table-wrap">
                <table className="db-table">
                  <thead>
                    <tr>
                      <th>Document</th>
                      <th>Party</th>
                      <th>Date</th>
                      <th>Missing</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incompleteRows.slice(0, 8).map((row) => (
                      <tr key={`${row.recordType}:${row.documentNumber}:${row.issueDate}`}>
                        <td>
                          <span className="db-inv-num">{row.documentNumber || "-"}</span>
                          <span className="db-row-meta">{row.documentType}</span>
                        </td>
                        <td>{row.partyName}</td>
                        <td>{row.issueDate}</td>
                        <td>{row.missingFields.join(", ")}</td>
                        <td><ComplianceBadge status={row.vedStatus} /></td>
                      </tr>
                    ))}
                    {incompleteRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="db-table-empty">No compliance exceptions in this period</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="db-card">
              <p className="db-card-title">
                <Shield className="size-4" />
                Readiness
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
                {readiness.length === 0 ? (
                  <div className="db-compliance-row">
                    <span className="db-compliance-check db-compliance-check-pending">-</span>
                    <span>No ledger checks yet</span>
                    <span className="db-compliance-tag">Open</span>
                  </div>
                ) : null}
              </div>
              <div className="db-info-grid db-ledger-info-grid">
                <div className="db-info-row"><span>Ready checks</span><strong>{readyCount}/{readiness.length || 6}</strong></div>
                <div className="db-info-row"><span>Return due</span><strong>{vatReturn?.period.dueDate ?? "-"}</strong></div>
                <div className="db-info-row"><span>ITAS profile</span><strong>{vatReturn?.settings?.itasRegistered ? "Saved" : "Open"}</strong></div>
              </div>
            </section>
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            <section className="db-card">
              <p className="db-card-title">
                <CalendarDays className="size-4" />
                Cash position
              </p>
              <div className="db-info-grid">
                <div className="db-info-row"><span>Receivables</span><strong>{formatMoney(receivables, currency)}</strong></div>
                <div className="db-info-row"><span>Payables</span><strong>{formatMoney(payables, currency)}</strong></div>
                <div className="db-info-row db-info-row-total"><span>Net open</span><strong>{formatMoney(receivables - payables, currency)}</strong></div>
              </div>
            </section>

            <section className="db-card">
              <p className="db-card-title">
                <SlidersHorizontal className="size-4" />
                Required fields
              </p>
              <div className="flex flex-wrap gap-2">
                {requiredTaxInvoiceFields.map((field) => (
                  <span key={field} className="db-compliance-badge">
                    {field}
                  </span>
                ))}
              </div>
            </section>

            <section className="db-card">
              <p className="db-card-title">
                <WalletCards className="size-4" />
                Currency exposure
              </p>
              <div className="db-info-grid">
                {currencySummary.slice(0, 4).map(([code, summary]) => (
                  <div key={code} className="db-info-row">
                    <span>{code} | {summary.count} records</span>
                    <strong>{formatMoney(summary.total, code)}</strong>
                  </div>
                ))}
                {currencySummary.length === 0 ? (
                  <div className="db-info-row"><span>No records</span><strong>-</strong></div>
                ) : null}
              </div>
            </section>
          </div>

          <RecordsTable rows={filteredAuditRows.slice(0, 14)} currency={currency} />
        </div>
      ) : null}

      {activeTab === "Issued" ? (
        <section className="db-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="db-card-title">
              <FileText className="size-4" />
              Issued invoices
            </p>
            <Link href="/dashboard#new-invoice" className="db-outline-btn">
              New invoice
              <ArrowUpRight className="size-4" />
            </Link>
          </div>
          <div className="db-table-wrap">
            <table className="db-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Client</th>
                  <th>Issue</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th>Tax</th>
                  <th>Compliance</th>
                  <th className="db-align-right">Balance</th>
                  <th className="db-align-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((invoice) => {
                  const audit = saleAuditByNumber.get(invoice.invoiceNumber);

                  return (
                    <tr key={invoice._id}>
                      <td>
                        <span className="db-inv-num">{invoice.invoiceNumber}</span>
                        <span className="db-row-meta">{invoice.currency ?? currency}</span>
                      </td>
                      <td>
                        <span className="db-row-primary">{invoice.clientName ?? invoice.client ?? "Client"}</span>
                        <span className="db-row-meta">{invoice.clientEmail ?? "No email"}</span>
                      </td>
                      <td>{invoice.issueDate ?? "-"}</td>
                      <td>{invoice.dueDate}</td>
                      <td><StatusPill value={invoice.status} /></td>
                      <td>{audit?.taxModeLabel ?? statusLabel(invoice.taxMode ?? "no_vat")}</td>
                      <td>
                        <ComplianceBadge status={audit?.vedStatus ?? "incomplete"} />
                        {audit?.missingFields.length ? (
                          <span className="db-row-warning">{audit.missingFields.join(", ")}</span>
                        ) : null}
                      </td>
                      <td className="db-align-right">{formatMoney(invoiceBalance(invoice), invoice.currency ?? currency)}</td>
                      <td className="db-align-right">{formatMoney(invoiceTotal(invoice), invoice.currency ?? currency)}</td>
                    </tr>
                  );
                })}
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="db-table-empty">{invoices.length === 0 ? "No invoices yet" : "No results found"}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {activeTab === "Received" ? (
        <section className="db-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="db-card-title">
              <ShoppingCart className="size-4" />
              Supplier invoices
            </p>
            <Link href="/dashboard/scan" className="db-outline-btn">
              Capture supplier invoice
              <ArrowUpRight className="size-4" />
            </Link>
          </div>
          <div className="db-table-wrap">
            <table className="db-table">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Supplier</th>
                  <th>Issue</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th>Tax</th>
                  <th>Compliance</th>
                  <th className="db-align-right">Balance</th>
                  <th className="db-align-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {filteredPurchases.map((purchase) => {
                  const audit = purchase.invoiceNumber
                    ? purchaseAuditByNumber.get(purchase.invoiceNumber)
                    : null;

                  return (
                    <tr key={purchase._id}>
                      <td>
                        <span className="db-inv-num">{purchase.invoiceNumber ?? "-"}</span>
                        <span className="db-row-meta">{purchase.purchaseOrderNumber ?? purchase.currency}</span>
                      </td>
                      <td>
                        <span className="db-row-primary">{purchase.supplierName}</span>
                        <span className="db-row-meta">{purchase.supplierVatNumber ?? "No VAT number"}</span>
                      </td>
                      <td>{purchase.issueDate}</td>
                      <td>{purchase.dueDate ?? "-"}</td>
                      <td><StatusPill value={purchase.status} /></td>
                      <td>{audit?.taxModeLabel ?? statusLabel(purchase.taxMode)}</td>
                      <td>
                        <ComplianceBadge status={audit?.vedStatus ?? "incomplete"} />
                        {audit?.missingFields.length ? (
                          <span className="db-row-warning">{audit.missingFields.join(", ")}</span>
                        ) : null}
                      </td>
                      <td className="db-align-right">{formatMoney(purchase.balanceDue, purchase.currency)}</td>
                      <td className="db-align-right">{formatMoney(purchase.total, purchase.currency)}</td>
                    </tr>
                  );
                })}
                {filteredPurchases.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="db-table-empty">{purchases.length === 0 ? "No purchase records yet" : "No results found"}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {purchases.length === 0 ? (
            <div className="db-empty db-ledger-empty">
              <ShoppingCart className="size-10" />
              <h3>No purchase records yet</h3>
              <p>Capture supplier invoices from Scan to unlock input VAT and payables tracking.</p>
              <Link href="/dashboard/scan" className="db-primary-btn">
                Open Scan
              </Link>
            </div>
          ) : null}
        </section>
      ) : null}

      {activeTab === "Audit" ? (
        <section className="db-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="db-card-title">
              <AlertTriangle className="size-4" />
              Compliance exceptions
            </p>
            <div className="db-header-actions">
              <Link href="/dashboard/settings" className="db-outline-btn">
                Business profile
                <ArrowUpRight className="size-4" />
              </Link>
              <Link href="/dashboard/vat" className="db-outline-btn">
                VAT settings
                <ArrowUpRight className="size-4" />
              </Link>
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
                  <th>Missing fields</th>
                  <th>Retention</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {incompleteRows.map((row) => (
                  <tr key={`${row.recordType}:${row.documentNumber}:${row.issueDate}`}>
                    <td>{row.recordType}</td>
                    <td>
                      <span className="db-inv-num">{row.documentNumber || "-"}</span>
                      <span className="db-row-meta">{row.documentType}</span>
                    </td>
                    <td>{row.issueDate}</td>
                    <td>{row.partyName}</td>
                    <td>{row.missingFields.join(", ")}</td>
                    <td>{row.retentionUntil}</td>
                    <td><ComplianceBadge status={row.vedStatus} /></td>
                  </tr>
                ))}
                {incompleteRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="db-table-empty">No exceptions match the current filters</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {activeTab === "NamRA Export" ? (
        <div className="grid gap-5">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="db-card">
              <p className="db-card-title">
                <FileJson className="size-4" />
                ITAS export package
              </p>
              <div className="db-info-grid">
                <div className="db-info-row"><span>Organization</span><strong>{vatReturn?.organization?.name ?? workspaceDoc?.name ?? "-"}</strong></div>
                <div className="db-info-row"><span>VAT number</span><strong>{vatReturn?.organization?.vatNumber || "-"}</strong></div>
                <div className="db-info-row"><span>Period</span><strong>{periodFrom} to {periodTo}</strong></div>
                <div className="db-info-row"><span>Records</span><strong>{filteredAuditRows.length}</strong></div>
                <div className="db-info-row"><span>Output VAT</span><strong>{formatMoney(vatReturn?.totals.outputVat ?? 0, currency)}</strong></div>
                <div className="db-info-row"><span>Input VAT</span><strong>{formatMoney(vatReturn?.totals.inputVat ?? 0, currency)}</strong></div>
                <div className="db-info-row db-info-row-total"><span>Net VAT</span><strong>{formatMoney(vatReturn?.totals.netVat ?? 0, currency)}</strong></div>
              </div>
              <div className="db-ledger-export-actions">
                <button type="button" className="db-primary-btn" onClick={exportNamraJson}>
                  <Download className="size-4" />
                  Download JSON
                </button>
                <button type="button" className="db-outline-btn" onClick={exportCurrentCsv}>
                  <Download className="size-4" />
                  Download CSV
                </button>
              </div>
            </section>

            <section className="db-card">
              <p className="db-card-title">
                {namraReady ? <CheckCircle2 className="size-4" /> : <AlertTriangle className="size-4" />}
                Export status
              </p>
              <div className="db-compliance-list">
                <div className="db-compliance-row">
                  <span className={vatReturn?.settings?.vedEnabled ? "db-compliance-check db-compliance-check-done" : "db-compliance-check db-compliance-check-pending"}>
                    {vatReturn?.settings?.vedEnabled ? "Y" : "-"}
                  </span>
                  <span>VED active</span>
                  <span className="db-compliance-tag">{vatReturn?.settings?.vedEnabled ? "Ready" : "Open"}</span>
                </div>
                <div className="db-compliance-row">
                  <span className={incompleteRows.length === 0 ? "db-compliance-check db-compliance-check-done" : "db-compliance-check db-compliance-check-pending"}>
                    {incompleteRows.length === 0 ? "Y" : "-"}
                  </span>
                  <span>Required fields complete</span>
                  <span className="db-compliance-tag">{incompleteRows.length === 0 ? "Ready" : `${incompleteRows.length} open`}</span>
                </div>
                <div className="db-compliance-row">
                  <span className={vatReturn?.settings?.itasRegistered ? "db-compliance-check db-compliance-check-done" : "db-compliance-check db-compliance-check-pending"}>
                    {vatReturn?.settings?.itasRegistered ? "Y" : "-"}
                  </span>
                  <span>ITAS profile saved</span>
                  <span className="db-compliance-tag">{vatReturn?.settings?.itasRegistered ? "Ready" : "Open"}</span>
                </div>
              </div>
            </section>
          </div>

          <RecordsTable rows={filteredAuditRows} currency={currency} />
        </div>
      ) : null}
      </section>
    </div>
  );
}

function RecordsTable({ rows, currency }: { rows: VatExportRow[]; currency: string }) {
  return (
    <section className="db-card">
      <p className="db-card-title">
        <FileText className="size-4" />
        Export records
      </p>
      <div className="db-table-wrap">
        <table className="db-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Document</th>
              <th>Date</th>
              <th>Party</th>
              <th>Tax</th>
              <th>Retention</th>
              <th>Status</th>
              <th className="db-align-right">VAT</th>
              <th className="db-align-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.recordType}:${row.documentNumber}:${row.issueDate}`}>
                <td>{row.recordType}</td>
                <td>
                  <span className="db-inv-num">{row.documentNumber || "-"}</span>
                  <span className="db-row-meta">{row.documentType}</span>
                </td>
                <td>{row.issueDate}</td>
                <td>{row.partyName}</td>
                <td>{row.taxModeLabel}</td>
                <td>{row.retentionUntil}</td>
                <td><ComplianceBadge status={row.vedStatus} /></td>
                <td className="db-align-right">{formatMoney(row.vatAmount, row.currency || currency)}</td>
                <td className="db-align-right">{formatMoney(row.total, row.currency || currency)}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="db-table-empty">No export records match the current filters</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
