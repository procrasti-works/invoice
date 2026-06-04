"use client";

import Link from "next/link";
import { useMemo, useState, type ComponentType, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  Clock,
  Download,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Loader2,
  ReceiptText,
  RefreshCw,
  Save,
  ScanLine,
  Search,
  SlidersHorizontal,
  WalletCards,
} from "@/app/_components/IconPack";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { usePlan } from "@/lib/plan";
import { LockedPage } from "../_components/DashboardShell";

type TaxMode = "no_vat" | "vat_15" | "zero_rated" | "exempt";
type RecordFilter = "all" | "sale" | "purchase" | "incomplete";
type PeriodPreset = "this_month" | "last_month" | "two_month" | "custom";
type IconComponent = ComponentType<{ className?: string }>;

type VatSettingsForm = {
  vatRegistered: boolean;
  vatNumber: string;
  taxId: string;
  vatRegistrationType: "not_registered" | "voluntary" | "mandatory";
  vatFilingFrequency: "monthly" | "bi_monthly";
  vatReturnDueDay: string;
  vatRecordRetentionYears: string;
  vatDefaultTaxMode: TaxMode;
  vedEnabled: boolean;
};

type VatSettings = {
  vatRegistered: boolean;
  vatNumber: string;
  taxId: string;
  registrationType: string;
  filingFrequency: "monthly" | "bi_monthly";
  returnDueDay: number;
  recordRetentionYears: number;
  defaultTaxMode: TaxMode;
  vedEnabled: boolean;
  vatRate: number;
};

type VatRecord = {
  recordType: "sale" | "purchase";
  documentType: string;
  documentNumber: string;
  issueDate: string;
  partyName: string;
  partyAddress: string;
  partyVatNumber: string;
  taxModeLabel: string;
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
  settings: VatSettings | null;
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
  exportRows: VatRecord[];
  readiness: Array<{ key: string; label: string; done: boolean }>;
};

const defaultSettingsForm: VatSettingsForm = {
  vatRegistered: false,
  vatNumber: "",
  taxId: "",
  vatRegistrationType: "not_registered",
  vatFilingFrequency: "monthly",
  vatReturnDueDay: "25",
  vatRecordRetentionYears: "5",
  vatDefaultTaxMode: "no_vat",
  vedEnabled: false,
};

const primaryButtonClass =
  "rounded-lg bg-neutral-950 text-base font-semibold !text-white hover:bg-neutral-800 hover:!text-white";

const taxModeLabels: Record<TaxMode, string> = {
  no_vat: "No VAT",
  vat_15: "VAT 15%",
  zero_rated: "Zero-rated",
  exempt: "Exempt",
};

const registrationLabels: Record<VatSettingsForm["vatRegistrationType"], string> = {
  not_registered: "Not registered",
  voluntary: "Voluntary",
  mandatory: "Mandatory",
};

const filingLabels: Record<VatSettingsForm["vatFilingFrequency"], string> = {
  monthly: "Monthly",
  bi_monthly: "Bi-monthly",
};

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

function formatDate(value?: string) {
  if (!value) {
    return "-";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-NA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function periodRange(preset: Exclude<PeriodPreset, "custom">) {
  const today = new Date();
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth();

  if (preset === "last_month") {
    return {
      from: isoDate(new Date(Date.UTC(year, month - 1, 1))),
      to: isoDate(new Date(Date.UTC(year, month, 0))),
    };
  }

  if (preset === "two_month") {
    return {
      from: isoDate(new Date(Date.UTC(year, month - 1, 1))),
      to: isoDate(new Date(Date.UTC(year, month + 1, 0))),
    };
  }

  return {
    from: isoDate(new Date(Date.UTC(year, month, 1))),
    to: isoDate(new Date(Date.UTC(year, month + 1, 0))),
  };
}

function monthStartIso() {
  return periodRange("this_month").from;
}

function monthEndIso() {
  return periodRange("this_month").to;
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

function settingsToForm(settings: VatSettings | null): VatSettingsForm {
  if (!settings) {
    return { ...defaultSettingsForm };
  }

  return {
    vatRegistered: settings.vatRegistered,
    vatNumber: settings.vatNumber,
    taxId: settings.taxId,
    vatRegistrationType: settings.registrationType as VatSettingsForm["vatRegistrationType"],
    vatFilingFrequency: settings.filingFrequency,
    vatReturnDueDay: String(settings.returnDueDay),
    vatRecordRetentionYears: String(settings.recordRetentionYears),
    vatDefaultTaxMode: settings.defaultTaxMode,
    vedEnabled: settings.vedEnabled,
  };
}

function metricPercent(value: number, max: number) {
  if (max <= 0 || value <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round((value / max) * 100)));
}

export default function VatPage() {
  const { canAccess } = usePlan();
  const [from, setFrom] = useState(monthStartIso);
  const [to, setTo] = useState(monthEndIso);
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("this_month");
  const [recordFilter, setRecordFilter] = useState<RecordFilter>("all");
  const [recordSearch, setRecordSearch] = useState("");
  const [amount, setAmount] = useState("1000");
  const [mode, setMode] = useState<"exclusive" | "inclusive">("exclusive");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<VatSettingsForm | null>(null);

  const summary = useQuery(api.vat.returnSummary, { from, to }) as VatReturn | undefined;
  const updateSettings = useMutation(api.vat.updateSettings);

  const settings = summary?.settings ?? null;
  const loadedSettingsForm = useMemo(() => settingsToForm(settings), [settings]);
  const settingsForm = settingsDraft ?? loadedSettingsForm;
  const organization = summary?.organization ?? null;
  const currency = organization?.currency ?? "NAD";
  const rows = useMemo(() => summary?.exportRows ?? [], [summary?.exportRows]);
  const totals = summary?.totals;
  const vatRate = settings?.vatRate ?? 0.15;
  const outputVat = totals?.outputVat ?? 0;
  const inputVat = totals?.inputVat ?? 0;
  const netVat = totals?.netVat ?? 0;
  const incompleteRows = rows.filter((row) => row.vedStatus === "incomplete");
  const readinessRows = summary?.readiness ?? [];
  const readinessProgress = readinessRows.length > 0
    ? Math.round((readinessRows.filter((item) => item.done).length / readinessRows.length) * 100)
    : 0;
  const vatBase = Math.max(outputVat, inputVat, Math.abs(netVat), 1);
  const value = Math.max(0, Number(amount) || 0);
  const subtotal = mode === "exclusive" ? value : value / (1 + vatRate);
  const vat = mode === "exclusive" ? value * vatRate : value - subtotal;
  const total = subtotal + vat;
  const isLoading = summary === undefined;

  const filteredRows = useMemo(() => {
    const query = recordSearch.trim().toLowerCase();

    return rows.filter((row) => {
      if (recordFilter === "sale" && row.recordType !== "sale") {
        return false;
      }

      if (recordFilter === "purchase" && row.recordType !== "purchase") {
        return false;
      }

      if (recordFilter === "incomplete" && row.vedStatus !== "incomplete") {
        return false;
      }

      if (!query) {
        return true;
      }

      return [
        row.recordType,
        row.documentType,
        row.documentNumber,
        row.issueDate,
        row.partyName,
        row.partyVatNumber,
        row.taxModeLabel,
        row.status,
        ...row.missingFields,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [recordFilter, recordSearch, rows]);

  const recordTabs: { id: RecordFilter; label: string; count: number; tone: string }[] = [
    { id: "all", label: "All records", count: rows.length, tone: "bg-muted text-foreground" },
    {
      id: "sale",
      label: "Sales",
      count: rows.filter((row) => row.recordType === "sale").length,
      tone: "bg-teal-100 text-teal-700",
    },
    {
      id: "purchase",
      label: "Purchases",
      count: rows.filter((row) => row.recordType === "purchase").length,
      tone: "bg-amber-100 text-amber-700",
    },
    {
      id: "incomplete",
      label: "Open",
      count: incompleteRows.length,
      tone: "bg-red-100 text-red-700",
    },
  ];

  const vatPosition = netVat > 0 ? "Payable" : netVat < 0 ? "Refund" : "Settled";
  const metricCards = [
    {
      label: "Net VAT",
      value: isLoading ? "Loading" : formatMoney(netVat, currency),
      detail: vatPosition,
      icon: WalletCards,
      iconClassName: netVat > 0 ? "bg-amber-50 text-amber-500" : "bg-teal-50 text-teal-600",
      barClassName: netVat > 0 ? "bg-amber-400" : "bg-teal-600",
      progress: metricPercent(Math.abs(netVat), vatBase),
    },
    {
      label: "Output VAT",
      value: isLoading ? "Loading" : formatMoney(outputVat, currency),
      detail: `${totals?.issuedInvoiceCount ?? 0} issued invoices`,
      icon: ReceiptText,
      iconClassName: "bg-teal-50 text-teal-600",
      barClassName: "bg-teal-600",
      progress: metricPercent(outputVat, vatBase),
    },
    {
      label: "Input VAT",
      value: isLoading ? "Loading" : formatMoney(inputVat, currency),
      detail: `${totals?.purchaseRecordCount ?? 0} supplier records`,
      icon: FileCheck2,
      iconClassName: "bg-neutral-100 text-neutral-700",
      barClassName: "bg-neutral-900",
      progress: metricPercent(inputVat, vatBase),
    },
    {
      label: "Return due",
      value: isLoading ? "Loading" : formatDate(summary?.period.dueDate),
      detail: filingLabels[settingsForm.vatFilingFrequency],
      icon: Clock,
      iconClassName: "bg-red-50 text-red-600",
      barClassName: "bg-red-600",
      progress: readinessProgress,
    },
  ];

  function setSettingsForm(
    nextForm: VatSettingsForm | ((current: VatSettingsForm) => VatSettingsForm),
  ) {
    setSettingsDraft((current) => {
      const base = current ?? loadedSettingsForm;
      return typeof nextForm === "function" ? nextForm(base) : nextForm;
    });
  }

  function applyPeriodPreset(value: PeriodPreset) {
    setPeriodPreset(value);

    if (value === "custom") {
      return;
    }

    const range = periodRange(value);
    setFrom(range.from);
    setTo(range.to);
  }

  if (!canAccess("vat")) {
    return <LockedPage feature="VAT" requiredPlan="Starter" />;
  }

  async function handleSaveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setNotice(null);
    setError(null);

    try {
      await updateSettings({
        vatRegistered: settingsForm.vatRegistered,
        vatNumber: settingsForm.vatNumber,
        taxId: settingsForm.taxId,
        vatRegistrationType: settingsForm.vatRegistered
          ? settingsForm.vatRegistrationType === "not_registered"
            ? "mandatory"
            : settingsForm.vatRegistrationType
          : "not_registered",
        vatFilingFrequency: settingsForm.vatFilingFrequency,
        vatReturnDueDay: Number(settingsForm.vatReturnDueDay) || 25,
        vatRecordRetentionYears: Number(settingsForm.vatRecordRetentionYears) || 5,
        vatDefaultTaxMode: settingsForm.vatRegistered ? settingsForm.vatDefaultTaxMode : "no_vat",
        vedEnabled: settingsForm.vatRegistered && settingsForm.vedEnabled,
      });
      setNotice("VAT settings saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save VAT settings.");
    } finally {
      setSaving(false);
    }
  }

  function exportRows() {
    if (!summary) {
      return;
    }

    downloadCsv(`payvio-vat-return-${from}-to-${to}.csv`, [
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
        "VAT status",
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

  return (
    <div className="invoice-list-page space-y-[30px]">
      <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>

      {notice ? <Notice>{notice}</Notice> : null}
      {error ? <Notice danger>{error}</Notice> : null}

      <section className="rounded-lg border border-border bg-card p-5 shadow-none sm:p-[30px]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <Tabs value={periodPreset} onValueChange={(value) => applyPeriodPreset(value as PeriodPreset)}>
            <TabsList className="flex h-auto w-full max-w-none flex-wrap items-center justify-start gap-x-3 gap-y-3 overflow-visible rounded-none bg-transparent p-0">
              <TabsTrigger className="h-12 min-w-fit flex-none rounded-lg px-4 text-base text-muted-foreground after:hidden data-active:bg-muted data-active:text-foreground data-active:shadow-none" value="this_month">
                This month
              </TabsTrigger>
              <TabsTrigger className="h-12 min-w-fit flex-none rounded-lg px-4 text-base text-muted-foreground after:hidden data-active:bg-muted data-active:text-foreground data-active:shadow-none" value="last_month">
                Last month
              </TabsTrigger>
              <TabsTrigger className="h-12 min-w-fit flex-none rounded-lg px-4 text-base text-muted-foreground after:hidden data-active:bg-muted data-active:text-foreground data-active:shadow-none" value="two_month">
                2 months
              </TabsTrigger>
              <TabsTrigger className="h-12 min-w-fit flex-none rounded-lg px-4 text-base text-muted-foreground after:hidden data-active:bg-muted data-active:text-foreground data-active:shadow-none" value="custom">
                Custom
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="h-11 rounded-lg px-4 text-base">
              <Link href="/dashboard/scan">
                <ScanLine className="size-4" />
                Supplier invoice
              </Link>
            </Button>
            <Button asChild className={cn("h-11 px-5", primaryButtonClass)}>
              <Link href="/dashboard/invoices/create">
                <FileText className="size-4" />
                New invoice
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-[30px] grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] lg:items-end">
          <Field label="Period from">
            <Input
              type="date"
              value={from}
              onChange={(event) => {
                setPeriodPreset("custom");
                setFrom(event.target.value);
              }}
              className="h-11 rounded-lg border-border bg-background text-base shadow-sm"
            />
          </Field>
          <Field label="Period to">
            <Input
              type="date"
              value={to}
              onChange={(event) => {
                setPeriodPreset("custom");
                setTo(event.target.value);
              }}
              className="h-11 rounded-lg border-border bg-background text-base shadow-sm"
            />
          </Field>
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-lg px-4 text-base"
            onClick={() => applyPeriodPreset("this_month")}
          >
            <RefreshCw className="size-4" />
            Current
          </Button>
          <Button
            type="button"
            className={cn("h-11 px-4", primaryButtonClass)}
            disabled={!summary}
            onClick={exportRows}
          >
            <Download className="size-4" />
            CSV
          </Button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryPill label="VAT rate" value={`${Math.round(vatRate * 100)}%`} detail="Namibia standard" />
          <SummaryPill label="Filing" value={filingLabels[settingsForm.vatFilingFrequency]} detail={`Due day ${settingsForm.vatReturnDueDay || "25"}`} />
          <SummaryPill label="Default tax" value={taxModeLabels[settingsForm.vatDefaultTaxMode]} detail={settingsForm.vatRegistered ? "Active" : "Off"} />
          <SummaryPill label="Retention" value={`${settingsForm.vatRecordRetentionYears || "5"} years`} detail="Minimum 5 years" />
        </div>
      </section>

      <div className="grid gap-6">
        <section className="rounded-lg border border-border bg-card p-5 shadow-none sm:p-[30px]">
          <SectionTitle
            icon={SlidersHorizontal}
            title="VAT settings"
            detail={settingsForm.vatRegistered ? registrationLabels[settingsForm.vatRegistrationType] : "Not registered"}
          />

          <form onSubmit={handleSaveSettings} className="mt-6 grid gap-5">
            <label className="flex items-start gap-3 rounded-lg border border-border bg-background p-4 text-sm">
              <Checkbox
                checked={settingsForm.vatRegistered}
                onCheckedChange={(checked) =>
                  setSettingsForm((current) => ({
                    ...current,
                    vatRegistered: checked === true,
                    vatRegistrationType: checked === true ? "mandatory" : "not_registered",
                    vatDefaultTaxMode: checked === true ? "vat_15" : "no_vat",
                    vedEnabled: checked === true,
                  }))
                }
                className="mt-0.5 border-border bg-background"
              />
              <span className="min-w-0">
                <span className="block text-base font-semibold text-foreground">VAT registered business</span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  Enables 15% VAT calculations, VAT invoice fields, input VAT, and return exports.
                </span>
              </span>
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="VAT number">
                <Input
                  value={settingsForm.vatNumber}
                  disabled={!settingsForm.vatRegistered}
                  onChange={(event) => setSettingsForm((current) => ({ ...current, vatNumber: event.target.value }))}
                  className="h-11 rounded-lg border-border bg-background text-base shadow-sm"
                />
              </Field>
              <Field label="Tax ID">
                <Input
                  value={settingsForm.taxId}
                  onChange={(event) => setSettingsForm((current) => ({ ...current, taxId: event.target.value }))}
                  className="h-11 rounded-lg border-border bg-background text-base shadow-sm"
                />
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Registration type">
                <Select
                  value={settingsForm.vatRegistrationType}
                  disabled={!settingsForm.vatRegistered}
                  onValueChange={(value) =>
                    setSettingsForm((current) => ({
                      ...current,
                      vatRegistrationType: value as VatSettingsForm["vatRegistrationType"],
                    }))
                  }
                >
                  <SelectTrigger className="h-11 w-full rounded-lg border-border bg-background text-base shadow-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_registered">Not registered</SelectItem>
                    <SelectItem value="voluntary">Voluntary</SelectItem>
                    <SelectItem value="mandatory">Mandatory</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Default tax mode">
                <Select
                  value={settingsForm.vatRegistered ? settingsForm.vatDefaultTaxMode : "no_vat"}
                  disabled={!settingsForm.vatRegistered}
                  onValueChange={(value) =>
                    setSettingsForm((current) => ({ ...current, vatDefaultTaxMode: value as TaxMode }))
                  }
                >
                  <SelectTrigger className="h-11 w-full rounded-lg border-border bg-background text-base shadow-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vat_15">VAT 15%</SelectItem>
                    <SelectItem value="zero_rated">Zero-rated</SelectItem>
                    <SelectItem value="exempt">Exempt</SelectItem>
                    <SelectItem value="no_vat">No VAT</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Filing frequency">
                <Select
                  value={settingsForm.vatFilingFrequency}
                  disabled={!settingsForm.vatRegistered}
                  onValueChange={(value) =>
                    setSettingsForm((current) => ({
                      ...current,
                      vatFilingFrequency: value as VatSettingsForm["vatFilingFrequency"],
                    }))
                  }
                >
                  <SelectTrigger className="h-11 w-full rounded-lg border-border bg-background text-base shadow-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="bi_monthly">Bi-monthly</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Return due day">
                <Input
                  inputMode="numeric"
                  value={settingsForm.vatReturnDueDay}
                  disabled={!settingsForm.vatRegistered}
                  onChange={(event) =>
                    setSettingsForm((current) => ({ ...current, vatReturnDueDay: event.target.value }))
                  }
                  className="h-11 rounded-lg border-border bg-background text-base shadow-sm"
                />
              </Field>
              <Field label="Retention years">
                <Input
                  inputMode="numeric"
                  value={settingsForm.vatRecordRetentionYears}
                  disabled={!settingsForm.vatRegistered}
                  onChange={(event) =>
                    setSettingsForm((current) => ({ ...current, vatRecordRetentionYears: event.target.value }))
                  }
                  className="h-11 rounded-lg border-border bg-background text-base shadow-sm"
                />
              </Field>
            </div>

            <ToggleLine
              checked={settingsForm.vatRegistered && settingsForm.vedEnabled}
              disabled={!settingsForm.vatRegistered}
              label="VAT record checks"
              onCheckedChange={(checked) =>
                setSettingsForm((current) => ({ ...current, vedEnabled: checked === true }))
              }
            />

            <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {organization?.name ?? "Workspace"} / {currency}
              </p>
              <Button type="submit" className={cn("h-11 px-5", primaryButtonClass)} disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save VAT settings
              </Button>
            </div>
          </form>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-h-[560px] rounded-lg border border-border bg-card p-5 shadow-none sm:p-[30px]">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <Tabs value={recordFilter} onValueChange={(value) => setRecordFilter(value as RecordFilter)}>
              <TabsList className="flex h-auto w-full max-w-none flex-wrap items-center justify-start gap-x-5 gap-y-3 overflow-visible rounded-none bg-transparent p-0">
                {recordTabs.map((tab) => (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className="h-12 min-w-fit flex-none gap-3 rounded-lg px-4 text-base text-muted-foreground after:hidden data-active:bg-muted data-active:text-foreground data-active:shadow-none"
                  >
                    <span className="whitespace-nowrap">{tab.label}</span>
                    <span className={cn("grid size-9 shrink-0 place-items-center rounded-full text-base font-semibold", tab.tone)}>
                      {tab.count}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <Button
              type="button"
              className={cn("h-11 px-5", primaryButtonClass)}
              disabled={!summary}
              onClick={exportRows}
            >
              <FileSpreadsheet className="size-4" />
              Export VAT
            </Button>
          </div>

          <div className="mt-[30px] flex flex-col gap-3 lg:flex-row lg:items-center">
            <label className="relative w-full lg:max-w-[360px]" htmlFor="vat-record-search">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="vat-record-search"
                value={recordSearch}
                onChange={(event) => setRecordSearch(event.target.value)}
                placeholder="Search VAT records..."
                className="h-11 rounded-lg border-border bg-background pl-12 text-base shadow-sm"
              />
            </label>
            <Badge className="h-9 rounded-full border-0 bg-muted px-4 text-sm text-foreground">
              {formatDate(from)} - {formatDate(to)}
            </Badge>
            <Badge
              variant={incompleteRows.length > 0 ? "warning" : "success"}
              className="h-9 rounded-full border-0 px-4 text-sm"
            >
              {incompleteRows.length} open records
            </Badge>
          </div>

          <div className="mt-8 max-h-[430px] overflow-y-auto pr-1 [scrollbar-color:color-mix(in_oklch,var(--foreground)_35%,transparent)_transparent] [scrollbar-width:thin]">
            {isLoading ? (
              <div className="grid min-h-52 place-items-center rounded-lg border border-dashed p-8 text-center">
                <div>
                  <Loader2 className="mx-auto mb-3 size-8 animate-spin text-muted-foreground" />
                  <h3 className="font-medium">Loading VAT records</h3>
                </div>
              </div>
            ) : filteredRows.length > 0 ? (
              <Table className="table-fixed text-base">
                <colgroup>
                  <col className="w-[10%]" />
                  <col className="w-[18%]" />
                  <col className="w-[14%]" />
                  <col className="w-[20%]" />
                  <col className="w-[13%]" />
                  <col className="w-[12%]" />
                  <col className="w-[13%]" />
                </colgroup>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="h-14 px-3 font-semibold text-foreground">Type</TableHead>
                    <TableHead className="h-14 px-3 font-semibold text-foreground">Document</TableHead>
                    <TableHead className="h-14 px-3 font-semibold text-foreground">Date</TableHead>
                    <TableHead className="h-14 px-3 font-semibold text-foreground">Party</TableHead>
                    <TableHead className="h-14 px-3 font-semibold text-foreground">Tax mode</TableHead>
                    <TableHead className="h-14 px-3 text-right font-semibold text-foreground">VAT</TableHead>
                    <TableHead className="h-14 px-3 text-right font-semibold text-foreground">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((row, index) => (
                    <TableRow
                      key={`${row.recordType}:${row.documentNumber}:${row.issueDate}:${index}`}
                      className="h-[71px] border-border hover:bg-muted/40"
                    >
                      <TableCell className="px-3">
                        <Badge
                          className={cn(
                            "h-6 rounded-full border-0 px-3 text-sm font-semibold capitalize",
                            row.recordType === "sale"
                              ? "bg-teal-50 text-teal-700"
                              : "bg-amber-50 text-amber-700",
                          )}
                        >
                          {row.recordType}
                        </Badge>
                      </TableCell>
                      <TableCell className="overflow-hidden px-3">
                        <span className="block truncate font-medium text-foreground">{row.documentNumber || "-"}</span>
                        <span className="mt-1 block truncate text-xs text-muted-foreground">{row.documentType}</span>
                      </TableCell>
                      <TableCell className="overflow-hidden px-3 text-foreground">
                        <span className="block truncate">{formatDate(row.issueDate)}</span>
                      </TableCell>
                      <TableCell className="overflow-hidden px-3">
                        <span className="block truncate text-foreground">{row.partyName || "-"}</span>
                        <span className="mt-1 block truncate text-xs text-muted-foreground">
                          {row.partyVatNumber || row.status}
                        </span>
                      </TableCell>
                      <TableCell className="overflow-hidden px-3">
                        <span className="block truncate text-foreground">{row.taxModeLabel}</span>
                        {row.missingFields.length > 0 ? (
                          <span className="mt-1 block truncate text-xs text-red-600">
                            {row.missingFields.slice(0, 2).join(", ")}
                          </span>
                        ) : (
                          <span className="mt-1 block truncate text-xs text-muted-foreground">
                            Retain until {formatDate(row.retentionUntil)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="overflow-hidden px-3 text-right text-foreground">
                        <span className="block truncate">{formatMoney(row.vatAmount, row.currency)}</span>
                      </TableCell>
                      <TableCell className="overflow-hidden px-3 text-right text-foreground">
                        <span className="block truncate">{formatMoney(row.total, row.currency)}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="grid min-h-52 place-items-center rounded-lg border border-dashed p-8 text-center">
                <div>
                  <FileSpreadsheet className="mx-auto mb-3 size-8 text-muted-foreground" />
                  <h3 className="font-medium">No VAT records</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Create invoices or scan supplier records for this period.</p>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-5 shadow-none sm:p-[30px]">
          <SectionTitle icon={Calculator} title="VAT calculator" detail={`${Math.round(vatRate * 100)}% rate`} />

          <div className="mt-6 grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={mode === "exclusive" ? "default" : "outline"}
              className={cn(
                "h-11 rounded-lg text-base",
                mode === "exclusive" && "bg-neutral-950 !text-white hover:bg-neutral-800 hover:!text-white",
              )}
              onClick={() => setMode("exclusive")}
            >
              Add VAT
            </Button>
            <Button
              type="button"
              variant={mode === "inclusive" ? "default" : "outline"}
              className={cn(
                "h-11 rounded-lg text-base",
                mode === "inclusive" && "bg-neutral-950 !text-white hover:bg-neutral-800 hover:!text-white",
              )}
              onClick={() => setMode("inclusive")}
            >
              Extract VAT
            </Button>
          </div>

          <div className="mt-5">
            <Field label="Amount">
              <Input
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="h-11 rounded-lg border-border bg-background text-base shadow-sm"
              />
            </Field>
          </div>

          <div className="mt-5 grid gap-2">
            <CalcRow label="Subtotal" value={formatMoney(subtotal, currency)} />
            <CalcRow label={`VAT ${Math.round(vatRate * 100)}%`} value={formatMoney(vat, currency)} />
            <CalcRow label="Total" value={formatMoney(total, currency)} strong />
          </div>

          <div className="mt-6 border-t border-border pt-5">
            <p className="text-base font-semibold text-foreground">Return totals</p>
            <div className="mt-3 grid gap-2">
              <CalcRow label="Sales" value={formatMoney(totals?.salesTotal ?? 0, currency)} />
              <CalcRow label="Purchases" value={formatMoney(totals?.purchaseTotal ?? 0, currency)} />
              <CalcRow label="VAT position" value={vatPosition} strong />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-foreground">
      <span>{label}</span>
      {children}
    </label>
  );
}

function ToggleLine({
  checked,
  disabled,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onCheckedChange: (checked: boolean | "indeterminate") => void;
}) {
  return (
    <label className="flex h-11 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm">
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        className="border-border bg-background"
      />
      <span className="truncate text-foreground">{label}</span>
    </label>
  );
}

function Notice({ children, danger = false }: { children: string; danger?: boolean }) {
  const Icon = danger ? AlertTriangle : CheckCircle2;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border bg-card px-5 py-3 text-sm",
        danger ? "text-destructive" : "text-muted-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  iconClassName,
  barClassName,
  progress,
}: {
  label: string;
  value: string;
  detail: string;
  icon: IconComponent;
  iconClassName: string;
  barClassName: string;
  progress: number;
}) {
  return (
    <article className="min-h-[156px] rounded-lg border border-border bg-card p-[30px] shadow-none xl:h-[156px]">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <p className="truncate text-[30px] font-semibold leading-none tracking-normal text-foreground">
            {value}
          </p>
          <p className="mt-2 truncate text-[20px] leading-6 text-muted-foreground">{label}</p>
        </div>
        <span className={cn("grid size-[60px] shrink-0 place-items-center rounded-lg", iconClassName)}>
          <Icon className="size-7" />
        </span>
      </div>
      <div className="mt-[27px] h-1 rounded-full bg-muted">
        <div className={cn("h-full rounded-full", barClassName)} style={{ width: `${progress}%` }} />
      </div>
      <p className="sr-only">{detail}</p>
    </article>
  );
}

function SummaryPill({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 truncate text-lg font-semibold text-foreground">{value}</p>
      <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  detail,
}: {
  icon: IconComponent;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-muted text-foreground">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold tracking-normal text-foreground">{title}</h2>
          <p className="mt-1 truncate text-sm text-muted-foreground">{detail}</p>
        </div>
      </div>
    </div>
  );
}

function CalcRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3 text-sm">
      <span className="truncate text-muted-foreground">{label}</span>
      <strong className={cn("truncate text-right text-foreground", strong && "text-base")}>{value}</strong>
    </div>
  );
}
