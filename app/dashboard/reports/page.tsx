"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Clock,
  Download,
  FileSpreadsheet,
  Filter,
  ReceiptText,
  ShieldCheck,
  ShoppingCart,
  type LucideIcon,
} from "@/app/_components/IconPack";

import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePlan } from "@/lib/plan";
import { cn } from "@/lib/utils";
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
  taxModeLabel: string;
  vatAmount: number;
  total: number;
  currency: string;
  status: string;
};

type VatReturn = {
  organization: {
    currency: string;
  } | null;
  period: {
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
  };
  exportRows: VatExportRow[];
};

const REPORT_TABS = ["Revenue reports", "Overdue reports", "Tax summaries", "Cash flow charts"] as const;
type ReportTab = (typeof REPORT_TABS)[number];

const INVOICES_PER_PAGE = 5;
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
      currency,
      maximumFractionDigits: 2,
      style: "currency",
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
    timeZone: "UTC",
    year: "numeric",
  }).format(parsed);
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) {
    return "0%";
  }

  return `${Math.round(value)}%`;
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
    timeZone: "UTC",
    year: "2-digit",
  }).format(parsed);
}

function metricPercent(value: number, max: number) {
  if (max <= 0 || value <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round((value / max) * 100)));
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

function csvCell(value: unknown) {
  const text = Array.isArray(value) ? value.join("; ") : String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, rows: unknown[][]) {
  const blob = new Blob([rows.map((row) => row.map(csvCell).join(",")).join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function titleStatus(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusClass(status: string) {
  if (status === "paid" || status === "recorded") {
    return "bg-teal-50 text-teal-700";
  }

  if (status === "overdue" || status === "rejected") {
    return "bg-red-50 text-red-600";
  }

  if (status === "awaiting_payment" || status === "approved") {
    return "bg-amber-50 text-amber-700";
  }

  return "bg-neutral-100 text-neutral-600";
}

function sumRows(rows: LedgerRow[], field: keyof Pick<LedgerRow, "subtotal" | "vatAmount" | "total" | "balanceDue">) {
  return rows.reduce((total, row) => total + row[field], 0);
}

function ReportStatusPill({ status }: { status: string }) {
  return (
    <Badge className={cn("h-6 rounded-full border-0 px-3 text-sm font-semibold", statusClass(status))}>
      {titleStatus(status)}
    </Badge>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  meta,
  iconClassName,
  barClassName,
  progress,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  meta: string;
  iconClassName: string;
  barClassName: string;
  progress: number;
}) {
  return (
    <article className="min-h-[158px] rounded-lg border border-border bg-card p-6 shadow-none sm:p-[30px]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[28px] font-semibold leading-tight tracking-normal text-foreground">{value}</p>
          <p className="mt-2 text-[18px] leading-6 text-muted-foreground">{label}</p>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">{meta}</p>
        </div>
        <span className={cn("grid size-12 shrink-0 place-items-center rounded-lg sm:size-[60px]", iconClassName)}>
          <Icon className="size-6 sm:size-7" />
        </span>
      </div>
      <div className="mt-6 h-1 rounded-full bg-muted">
        <div className={cn("h-full rounded-full", barClassName)} style={{ width: `${progress}%` }} />
      </div>
    </article>
  );
}

function SectionTitle({ icon: Icon, title, badge }: { icon: LucideIcon; title: string; badge?: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <p className="flex min-w-0 items-center gap-2 text-base font-semibold text-foreground">
        <Icon className="size-5 shrink-0" />
        <span className="truncate">{title}</span>
      </p>
      {badge ? (
        <Badge variant="outline" className="h-6 shrink-0 rounded-full px-3">
          {badge}
        </Badge>
      ) : null}
    </div>
  );
}

function StatGrid({ rows }: { rows: Array<{ label: string; value: string }> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">{row.label}</p>
          <p className="mt-2 text-lg font-semibold text-foreground">{row.value}</p>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="grid min-h-48 place-items-center rounded-lg border border-dashed border-border p-8 text-center">
      <div>
        <Icon className="mx-auto mb-3 size-8 text-muted-foreground" />
        <p className="font-medium text-foreground">{title}</p>
      </div>
    </div>
  );
}

function CashFlowDonut({
  cashIn,
  cashOut,
  currency,
}: {
  cashIn: number;
  cashOut: number;
  currency: string;
}) {
  const total = Math.max(cashIn + cashOut, 0);
  const cashInPercent = total > 0 ? (cashIn / total) * 100 : 0;
  const cashOutPercent = total > 0 ? 100 - cashInPercent : 0;
  const gradient =
    total > 0
      ? `conic-gradient(#0d9488 0deg ${cashInPercent * 3.6}deg, #ef4444 ${cashInPercent * 3.6}deg 360deg)`
      : "conic-gradient(#f1f1f1 0deg 360deg)";

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Cash split</p>
          <p className="mt-1 text-lg font-semibold text-foreground">{formatMoney(total, currency)}</p>
        </div>
        <Badge variant="outline" className="h-6 rounded-full px-3">
          {formatPercent(cashInPercent)}
        </Badge>
      </div>
      <div className="mt-6 grid place-items-center">
        <div className="relative size-48 rounded-full" style={{ background: gradient }}>
          <div className="absolute inset-6 grid place-items-center rounded-full border border-border bg-background text-center">
            <span>
              <strong className="block text-xl font-semibold text-foreground">{formatMoney(cashIn - cashOut, currency)}</strong>
              <small className="mt-1 block text-sm text-muted-foreground">Net cash</small>
            </span>
          </div>
        </div>
      </div>
      <div className="mt-6 grid gap-3">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3">
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <i className="size-2 rounded-full bg-teal-600" />
            Cash in
          </span>
          <strong className="text-sm font-semibold text-foreground">{formatMoney(cashIn, currency)}</strong>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3">
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <i className="size-2 rounded-full bg-red-500" />
            Cash out
          </span>
          <strong className="text-sm font-semibold text-foreground">{formatMoney(cashOut, currency)}</strong>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3">
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <i className="size-2 rounded-full bg-neutral-900" />
            Out ratio
          </span>
          <strong className="text-sm font-semibold text-foreground">{formatPercent(cashOutPercent)}</strong>
        </div>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const { canAccess } = usePlan();
  const [activeTab, setActiveTab] = useState<ReportTab>("Revenue reports");
  const [revenuePage, setRevenuePage] = useState(1);
  const [from, setFrom] = useState(monthStartIso);
  const [to, setTo] = useState(monthEndIso);
  const summary = useQuery(api.reports.summary, { from, to }) as Summary | undefined;
  const ledgerRowsResult = useQuery(api.reports.ledgerExport, { from, to }) as LedgerRow[] | undefined;
  const vatReturn = useQuery(api.vat.returnSummary, { from, to }) as VatReturn | undefined;
  const workspace = useQuery(api.invoices.workspace);

  const ledgerRows = useMemo(() => ledgerRowsResult ?? [], [ledgerRowsResult]);
  const invoiceRows = useMemo(() => ledgerRows.filter((row) => row.type === "invoice"), [ledgerRows]);
  const purchaseRows = useMemo(() => ledgerRows.filter((row) => row.type === "purchase"), [ledgerRows]);
  const paidRows = useMemo(() => invoiceRows.filter((row) => row.status === "paid"), [invoiceRows]);
  const currency = summary?.currency ?? vatReturn?.organization?.currency ?? workspace?.defaultCurrency ?? "NAD";
  const today = vatReturn?.period.today ?? todayIso();
  const invalidPeriod = Boolean(from && to && from > to);
  const isLoading = summary === undefined || ledgerRowsResult === undefined || vatReturn === undefined;

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

  const monthlyRows = useMemo(() => {
    const buckets = new Map<string, { label: string; issued: number; paid: number; purchases: number }>();

    for (const row of ledgerRows) {
      const key = row.issueDate ? row.issueDate.slice(0, 7) : "undated";
      const bucket = buckets.get(key) ?? {
        label: monthLabel(row.issueDate),
        issued: 0,
        paid: 0,
        purchases: 0,
      };

      if (row.type === "invoice") {
        bucket.issued += row.total;
        if (row.status === "paid") {
          bucket.paid += row.total;
        }
      } else {
        bucket.purchases += row.total;
      }

      buckets.set(key, bucket);
    }

    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, value]) => value)
      .slice(-12);
  }, [ledgerRows]);

  const clientRevenue = useMemo(() => {
    const totals = new Map<string, { party: string; issued: number; invoices: number }>();

    for (const row of invoiceRows) {
      const key = row.party || "Client";
      const existing = totals.get(key) ?? { party: key, issued: 0, invoices: 0 };
      existing.issued += row.total;
      existing.invoices += 1;
      totals.set(key, existing);
    }

    return Array.from(totals.values()).sort((a, b) => b.issued - a.issued).slice(0, 6);
  }, [invoiceRows]);

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
  const outputVat = vatReturn?.totals.outputVat ?? summary?.vatCollected ?? 0;
  const inputVat = vatReturn?.totals.inputVat ?? summary?.vatInput ?? 0;
  const netVat = vatReturn?.totals.netVat ?? outputVat - inputVat;
  const netCash = paidCashIn - supplierPurchases;
  const chartMax = Math.max(1, ...monthlyRows.flatMap((row) => [row.issued, row.paid, row.purchases, Math.abs(row.paid - row.purchases)]));
  const reportBase = Math.max(issuedSales, overdue, Math.abs(netVat), Math.abs(netCash), paidCashIn, supplierPurchases, 1);
  const periodLabel = `${formatDate(from)} to ${formatDate(to)}`;
  const vatRows = vatReturn?.exportRows ?? [];

  const reportTabs = [
    { id: "Revenue reports" as const, count: invoiceRows.length, tone: "bg-teal-100 text-teal-700" },
    { id: "Overdue reports" as const, count: overdueRows.length, tone: "bg-red-100 text-red-700" },
    { id: "Tax summaries" as const, count: vatRows.length, tone: "bg-amber-100 text-amber-700" },
    { id: "Cash flow charts" as const, count: monthlyRows.length, tone: "bg-neutral-100 text-neutral-700" },
  ];
  const revenuePageCount = Math.max(1, Math.ceil(invoiceRows.length / INVOICES_PER_PAGE));
  const currentRevenuePage = Math.min(revenuePage, revenuePageCount);
  const firstRevenueIndex = (currentRevenuePage - 1) * INVOICES_PER_PAGE;
  const visibleInvoiceRows = invoiceRows.slice(firstRevenueIndex, firstRevenueIndex + INVOICES_PER_PAGE);
  const visibleInvoiceStart = invoiceRows.length > 0 ? firstRevenueIndex + 1 : 0;
  const visibleInvoiceEnd = Math.min(firstRevenueIndex + visibleInvoiceRows.length, invoiceRows.length);

  function exportActiveReport() {
    if (activeTab === "Revenue reports") {
      downloadCsv(`payvio-revenue-${from}-to-${to}.csv`, [
        ["Invoice", "Client", "Issue date", "Status", "Subtotal", "VAT", "Total", "Balance"],
        ...invoiceRows.map((row) => [row.number, row.party, row.issueDate, row.status, row.subtotal, row.vatAmount, row.total, row.balanceDue]),
      ]);
      return;
    }

    if (activeTab === "Overdue reports") {
      downloadCsv(`payvio-overdue-${from}-to-${to}.csv`, [
        ["Invoice", "Client", "Due date", "Days overdue", "Status", "Balance"],
        ...overdueRows.map((row) => [row.number, row.party, row.dueDate, daysPastDue(row, today), row.status, row.balanceDue]),
      ]);
      return;
    }

    if (activeTab === "Tax summaries") {
      downloadCsv(`payvio-tax-summary-${from}-to-${to}.csv`, [
        ["Metric", "Value"],
        ["Sales subtotal", vatReturn?.totals.salesSubtotal ?? sumRows(invoiceRows, "subtotal")],
        ["Output tax", outputVat],
        ["Purchase subtotal", vatReturn?.totals.purchaseSubtotal ?? sumRows(purchaseRows, "subtotal")],
        ["Input tax", inputVat],
        ["Net tax", netVat],
      ]);
      return;
    }

    downloadCsv(`payvio-cash-flow-${from}-to-${to}.csv`, [
      ["Month", "Issued revenue", "Cash in", "Cash out", "Net cash"],
      ...monthlyRows.map((row) => [row.label, row.issued, row.paid, row.purchases, row.paid - row.purchases]),
    ]);
  }

  return (
    <div className="invoice-list-page space-y-[30px]">
      <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">Payvio / Reports</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-foreground">Reporting & Analytics</h1>
        </div>
        <Button
          type="button"
          className="h-11 rounded-lg bg-neutral-950 px-5 text-base font-semibold !text-white hover:bg-neutral-800 hover:!text-white xl:self-end"
          onClick={exportActiveReport}
          disabled={isLoading}
        >
          <Download className="size-4" />
          Export report
        </Button>
      </section>

      <section className="rounded-lg border border-border bg-card p-5 shadow-none sm:p-[30px]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Filter className="size-4" />
              Report period
            </div>
            <p className="mt-2 text-lg font-semibold text-foreground">{periodLabel}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,180px)_minmax(0,180px)_auto] sm:items-end">
            <label className="grid gap-2 text-sm font-medium text-foreground" htmlFor="report-from">
              From
              <Input
                id="report-from"
                type="date"
                value={from}
                onChange={(event) => {
                  setRevenuePage(1);
                  setFrom(event.target.value);
                }}
                className="h-11 rounded-lg border-border bg-background text-base"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-foreground" htmlFor="report-to">
              To
              <Input
                id="report-to"
                type="date"
                value={to}
                onChange={(event) => {
                  setRevenuePage(1);
                  setTo(event.target.value);
                }}
                className="h-11 rounded-lg border-border bg-background text-base"
              />
            </label>
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-lg px-4 text-base"
              onClick={() => {
                setRevenuePage(1);
                setFrom(monthStartIso());
                setTo(monthEndIso());
              }}
            >
              <CalendarDays className="size-4" />
              Current month
            </Button>
          </div>
        </div>
      </section>

      {invalidPeriod ? (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700" role="alert">
          <AlertTriangle className="size-4 shrink-0" />
          <span>The start date is after the end date.</span>
        </div>
      ) : null}

      <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={ArrowUpRight}
          label="Revenue reports"
          value={formatMoney(issuedSales, currency)}
          meta={`${invoiceRows.length} invoices issued`}
          iconClassName="bg-teal-50 text-teal-600"
          barClassName="bg-teal-600"
          progress={metricPercent(issuedSales, reportBase)}
        />
        <MetricCard
          icon={Clock}
          label="Overdue reports"
          value={formatMoney(overdue, currency)}
          meta={`${overdueRows.length} invoices overdue`}
          iconClassName="bg-red-50 text-red-600"
          barClassName="bg-red-600"
          progress={metricPercent(overdue, reportBase)}
        />
        <MetricCard
          icon={ShieldCheck}
          label="Tax summaries"
          value={formatMoney(netVat, currency)}
          meta={`Output ${formatMoney(outputVat, currency)} / Input ${formatMoney(inputVat, currency)}`}
          iconClassName="bg-amber-50 text-amber-600"
          barClassName="bg-amber-500"
          progress={metricPercent(Math.abs(netVat), reportBase)}
        />
        <MetricCard
          icon={BarChart3}
          label="Cash flow charts"
          value={formatMoney(netCash, currency)}
          meta={netCash >= 0 ? "Positive net cash" : "Negative net cash"}
          iconClassName="bg-neutral-100 text-neutral-900"
          barClassName="bg-neutral-900"
          progress={metricPercent(Math.abs(netCash), reportBase)}
        />
      </section>

      <section className="min-h-[560px] rounded-lg border border-border bg-card p-5 shadow-none sm:p-[30px]">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ReportTab)}>
          <TabsList className="grid h-auto w-full max-w-none grid-cols-1 gap-2 overflow-visible rounded-none bg-transparent p-0 sm:grid-cols-2 xl:grid-cols-4">
            {reportTabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="h-12 min-w-0 justify-between gap-3 rounded-lg px-3 text-base text-muted-foreground after:hidden data-active:bg-muted data-active:text-foreground data-active:shadow-none"
              >
                <span className="min-w-0 truncate">{tab.id}</span>
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-full text-base font-semibold", tab.tone)}>
                  {tab.count}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="mt-[30px]">
          {activeTab === "Revenue reports" ? (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
              <section className="rounded-lg border border-border bg-background p-5 shadow-none sm:p-6">
                <SectionTitle icon={ReceiptText} title="Revenue reports" badge={`${invoiceRows.length} invoices`} />
                <div className="mt-5">
                  <StatGrid
                    rows={[
                      { label: "Issued revenue", value: formatMoney(issuedSales, currency) },
                      { label: "Paid revenue", value: formatMoney(paidCashIn, currency) },
                      { label: "Outstanding", value: formatMoney(outstanding, currency) },
                      { label: "Collection rate", value: formatPercent(issuedSales ? (paidCashIn / issuedSales) * 100 : 0) },
                    ]}
                  />
                </div>
                <div className="mt-6 overflow-hidden rounded-lg border border-border bg-card">
                  {invoiceRows.length > 0 ? (
                    <Table className="w-full table-fixed text-base">
                      <colgroup>
                        <col className="w-[19%]" />
                        <col className="w-[19%]" />
                        <col className="w-[16%]" />
                        <col className="w-[16%]" />
                        <col className="w-[15%]" />
                        <col className="w-[15%]" />
                      </colgroup>
                      <TableHeader>
                        <TableRow className="border-border hover:bg-transparent">
                          <TableHead className="h-14 overflow-hidden px-3 font-semibold text-foreground">Invoice</TableHead>
                          <TableHead className="h-14 overflow-hidden px-3 font-semibold text-foreground">Client</TableHead>
                          <TableHead className="h-14 overflow-hidden px-3 font-semibold text-foreground">Date</TableHead>
                          <TableHead className="h-14 overflow-hidden px-3 font-semibold text-foreground">Status</TableHead>
                          <TableHead className="h-14 overflow-hidden px-3 font-semibold text-foreground">Total</TableHead>
                          <TableHead className="h-14 overflow-hidden px-3 font-semibold text-foreground">Balance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visibleInvoiceRows.map((row, index) => (
                          <TableRow key={`revenue:${row.number}:${index}`} className="h-[71px] border-border hover:bg-muted/40">
                            <TableCell className="overflow-hidden px-3 font-medium text-foreground">
                              <span className="block truncate">{row.number || "-"}</span>
                            </TableCell>
                            <TableCell className="overflow-hidden px-3 text-foreground">
                              <span className="block truncate">{row.party || "Client"}</span>
                            </TableCell>
                            <TableCell className="overflow-hidden px-3 text-foreground">
                              <span className="block truncate">{formatDate(row.issueDate)}</span>
                            </TableCell>
                            <TableCell className="overflow-hidden px-3">
                              <ReportStatusPill status={row.status} />
                            </TableCell>
                            <TableCell className="overflow-hidden px-3 text-foreground">
                              <span className="block truncate">{formatMoney(row.total, row.currency)}</span>
                            </TableCell>
                            <TableCell className="overflow-hidden px-3 text-foreground">
                              <span className="block truncate">{formatMoney(row.balanceDue, row.currency)}</span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <EmptyState icon={ReceiptText} title="No revenue records for this period" />
                  )}
                </div>
                {invoiceRows.length > 0 ? (
                  <div className="mt-4 flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <span>Show</span>
                      <span className="inline-flex h-10 min-w-14 items-center justify-center rounded-lg border border-border bg-background px-3 font-medium text-foreground">
                        {INVOICES_PER_PAGE}
                      </span>
                      <span>per page</span>
                    </div>
                    <div className="flex items-center gap-3 sm:ml-auto">
                      <span className="min-w-20 text-right">
                        {visibleInvoiceStart}-{visibleInvoiceEnd} of {invoiceRows.length}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-9 rounded-lg"
                        disabled={currentRevenuePage === 1}
                        aria-label="Previous invoice page"
                        onClick={() => setRevenuePage((page) => Math.max(1, page - 1))}
                      >
                        <ArrowLeft className="size-4" />
                      </Button>
                      <span className="grid size-10 place-items-center rounded-lg bg-muted font-semibold text-foreground">
                        {currentRevenuePage}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-9 rounded-lg"
                        disabled={currentRevenuePage >= revenuePageCount}
                        aria-label="Next invoice page"
                        onClick={() => setRevenuePage((page) => Math.min(revenuePageCount, page + 1))}
                      >
                        <ArrowRight className="size-4" />
                      </Button>
                    </div>
                  </div>
                ) : null}
              </section>

              <section className="rounded-lg border border-border bg-background p-5 shadow-none sm:p-6">
                <SectionTitle icon={ArrowUpRight} title="Top clients" />
                <div className="mt-5 space-y-3">
                  {clientRevenue.length > 0 ? (
                    clientRevenue.map((client) => (
                      <div key={client.party} className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4">
                        <span className="min-w-0">
                          <strong className="block truncate text-sm font-semibold text-foreground">{client.party}</strong>
                          <small className="mt-1 block text-sm text-muted-foreground">{client.invoices} invoices</small>
                        </span>
                        <b className="shrink-0 text-sm font-semibold text-foreground">{formatMoney(client.issued, currency)}</b>
                      </div>
                    ))
                  ) : (
                    <EmptyState icon={ArrowUpRight} title="No client revenue yet" />
                  )}
                </div>
              </section>
            </div>
          ) : null}

          {activeTab === "Overdue reports" ? (
            <div className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
                {ageingBuckets.map((bucket) => (
                  <article key={bucket.label} className="rounded-lg border border-border bg-background p-5 shadow-none">
                    <p className="text-sm text-muted-foreground">{bucket.label}</p>
                    <strong className="mt-2 block text-2xl font-semibold text-foreground">{formatMoney(bucket.amount, currency)}</strong>
                    <small className="mt-1 block text-sm text-muted-foreground">{bucket.count} invoices</small>
                  </article>
                ))}
              </div>
              <section className="rounded-lg border border-border bg-background p-5 shadow-none sm:p-6">
                <SectionTitle icon={Clock} title="Overdue reports" badge={`${overdueRows.length} invoices`} />
                <div className="mt-5 max-h-[430px] overflow-y-auto pr-1 [scrollbar-color:color-mix(in_oklch,var(--foreground)_35%,transparent)_transparent] [scrollbar-width:thin]">
                  {overdueRows.length > 0 ? (
                    <Table className="min-w-[760px] table-fixed text-base">
                      <TableHeader className="sticky top-0 z-10 bg-background">
                        <TableRow className="border-border hover:bg-transparent">
                          <TableHead className="h-14 px-3 font-semibold text-foreground">Invoice</TableHead>
                          <TableHead className="h-14 px-3 font-semibold text-foreground">Client</TableHead>
                          <TableHead className="h-14 px-3 font-semibold text-foreground">Due date</TableHead>
                          <TableHead className="h-14 px-3 font-semibold text-foreground">Days overdue</TableHead>
                          <TableHead className="h-14 px-3 font-semibold text-foreground">Status</TableHead>
                          <TableHead className="h-14 px-3 font-semibold text-foreground">Balance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {overdueRows.map((row, index) => (
                          <TableRow key={`overdue:${row.number}:${index}`} className="h-[71px] border-border hover:bg-muted/40">
                            <TableCell className="px-3 font-medium text-foreground">{row.number || "-"}</TableCell>
                            <TableCell className="px-3 text-foreground">{row.party || "Client"}</TableCell>
                            <TableCell className="px-3 text-foreground">{formatDate(row.dueDate)}</TableCell>
                            <TableCell className="px-3 text-foreground">{daysPastDue(row, today)}</TableCell>
                            <TableCell className="px-3"><ReportStatusPill status={row.status} /></TableCell>
                            <TableCell className="px-3 text-foreground">{formatMoney(row.balanceDue, row.currency)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <EmptyState icon={Clock} title="No overdue invoices for this period" />
                  )}
                </div>
              </section>
            </div>
          ) : null}

          {activeTab === "Tax summaries" ? (
            <div className="space-y-6">
              <section className="rounded-lg border border-border bg-background p-5 shadow-none sm:p-6">
                <SectionTitle icon={ShieldCheck} title="Tax summaries" badge={formatMoney(netVat, currency)} />
                <div className="mt-5">
                  <StatGrid
                    rows={[
                      { label: "Sales subtotal", value: formatMoney(vatReturn?.totals.salesSubtotal ?? sumRows(invoiceRows, "subtotal"), currency) },
                      { label: "Output tax", value: formatMoney(outputVat, currency) },
                      { label: "Purchase subtotal", value: formatMoney(vatReturn?.totals.purchaseSubtotal ?? sumRows(purchaseRows, "subtotal"), currency) },
                      { label: "Input tax", value: formatMoney(inputVat, currency) },
                    ]}
                  />
                </div>
              </section>
              <section className="rounded-lg border border-border bg-background p-5 shadow-none sm:p-6">
                <SectionTitle icon={FileSpreadsheet} title="Tax records" badge={`${vatRows.length} records`} />
                <div className="mt-5 max-h-[430px] overflow-y-auto pr-1 [scrollbar-color:color-mix(in_oklch,var(--foreground)_35%,transparent)_transparent] [scrollbar-width:thin]">
                  {vatRows.length > 0 ? (
                    <Table className="min-w-[760px] table-fixed text-base">
                      <TableHeader className="sticky top-0 z-10 bg-background">
                        <TableRow className="border-border hover:bg-transparent">
                          <TableHead className="h-14 px-3 font-semibold text-foreground">Type</TableHead>
                          <TableHead className="h-14 px-3 font-semibold text-foreground">Document</TableHead>
                          <TableHead className="h-14 px-3 font-semibold text-foreground">Date</TableHead>
                          <TableHead className="h-14 px-3 font-semibold text-foreground">Party</TableHead>
                          <TableHead className="h-14 px-3 font-semibold text-foreground">Tax</TableHead>
                          <TableHead className="h-14 px-3 font-semibold text-foreground">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {vatRows.map((row, index) => (
                          <TableRow key={`tax:${row.documentNumber}:${index}`} className="h-[71px] border-border hover:bg-muted/40">
                            <TableCell className="px-3 text-foreground">{row.recordType}</TableCell>
                            <TableCell className="px-3 font-medium text-foreground">{row.documentNumber || "-"}</TableCell>
                            <TableCell className="px-3 text-foreground">{formatDate(row.issueDate)}</TableCell>
                            <TableCell className="px-3 text-foreground">{row.partyName || "-"}</TableCell>
                            <TableCell className="px-3 text-foreground">{formatMoney(row.vatAmount, row.currency)}</TableCell>
                            <TableCell className="px-3 text-foreground">{formatMoney(row.total, row.currency)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <EmptyState icon={ShieldCheck} title="No tax records for this period" />
                  )}
                </div>
              </section>
            </div>
          ) : null}

          {activeTab === "Cash flow charts" ? (
            <div className="space-y-6">
              <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                <CashFlowDonut cashIn={paidCashIn} cashOut={supplierPurchases} currency={currency} />

                <section className="rounded-lg border border-border bg-background p-5 shadow-none sm:p-6">
                  <SectionTitle icon={BarChart3} title="Monthly cash movement" badge={formatMoney(netCash, currency)} />
                  {monthlyRows.length > 0 ? (
                    <>
                      <div className="mt-6 overflow-x-auto pb-2 [scrollbar-color:color-mix(in_oklch,var(--foreground)_35%,transparent)_transparent] [scrollbar-width:thin]">
                        <div className="flex h-[280px] min-w-[640px] items-end gap-4 rounded-lg border border-border bg-card px-4 pb-4 pt-6">
                          {monthlyRows.map((row) => {
                            const rowNetCash = row.paid - row.purchases;
                            return (
                              <div key={row.label} className="flex h-full min-w-14 flex-1 flex-col justify-end">
                                <div className="flex h-[220px] items-end justify-center gap-1.5 border-b border-border pb-2">
                                  <span
                                    className="w-3 rounded-t-full bg-teal-600"
                                    title={`Cash in ${formatMoney(row.paid, currency)}`}
                                    style={{ height: `${row.paid > 0 ? Math.max(8, (row.paid / chartMax) * 100) : 0}%` }}
                                  />
                                  <span
                                    className="w-3 rounded-t-full bg-red-500"
                                    title={`Cash out ${formatMoney(row.purchases, currency)}`}
                                    style={{ height: `${row.purchases > 0 ? Math.max(8, (row.purchases / chartMax) * 100) : 0}%` }}
                                  />
                                  <span
                                    className={cn("w-3 rounded-t-full", rowNetCash >= 0 ? "bg-neutral-900" : "bg-red-700")}
                                    title={`Net cash ${formatMoney(rowNetCash, currency)}`}
                                    style={{ height: `${Math.abs(rowNetCash) > 0 ? Math.max(8, (Math.abs(rowNetCash) / chartMax) * 100) : 0}%` }}
                                  />
                                </div>
                                <span className="mt-3 truncate text-center text-xs font-medium text-muted-foreground">{row.label}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="mt-5 flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-2"><i className="size-2 rounded-full bg-teal-600" /> Cash in</span>
                        <span className="inline-flex items-center gap-2"><i className="size-2 rounded-full bg-red-500" /> Cash out</span>
                        <span className="inline-flex items-center gap-2"><i className="size-2 rounded-full bg-neutral-900" /> Net cash</span>
                      </div>
                    </>
                  ) : (
                    <div className="mt-6">
                      <EmptyState icon={BarChart3} title="No cash flow data for this period" />
                    </div>
                  )}
                </section>
              </div>

              <section className="rounded-lg border border-border bg-background p-5 shadow-none sm:p-6">
                <SectionTitle icon={ArrowDownRight} title="Cash position" />
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-lg border border-border bg-card p-4">
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <i className="size-2 rounded-full bg-teal-600" />
                      Cash in
                    </p>
                    <p className="mt-2 text-lg font-semibold text-foreground">{formatMoney(paidCashIn, currency)}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-card p-4">
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <i className="size-2 rounded-full bg-red-500" />
                      Cash out
                    </p>
                    <p className="mt-2 text-lg font-semibold text-foreground">{formatMoney(supplierPurchases, currency)}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-card p-4">
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <i className="size-2 rounded-full bg-neutral-900" />
                      Net cash
                    </p>
                    <p className={cn("mt-2 text-lg font-semibold", netCash >= 0 ? "text-foreground" : "text-red-600")}>
                      {formatMoney(netCash, currency)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-card p-4">
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <ShoppingCart className="size-4" />
                      Purchases
                    </p>
                    <p className="mt-2 text-lg font-semibold text-foreground">{purchaseRows.length} records</p>
                  </div>
                </div>
              </section>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
