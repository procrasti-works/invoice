"use client";

import { useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  CheckCircle2,
  Clock,
  EllipsisVertical,
  FileCheck2,
  FileText,
  Loader2,
  Paperclip,
  Plus,
  ReceiptText,
  RefreshCw,
  Save,
  ScanLine,
  Search,
  ShieldCheck,
  ShoppingCart,
  Trash2,
  UploadCloud,
  WalletCards,
} from "@/app/_components/IconPack";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { usePlan } from "@/lib/plan";
import { LockedPage } from "../_components/DashboardShell";

type TaxMode = "no_vat" | "vat_15" | "zero_rated" | "exempt";
type PurchaseStatus = Doc<"purchases">["status"];
type PurchaseView = "all" | "recorded" | "paid" | "draft" | "po";
type SortKey = "issue" | "due";

type PurchaseRow = {
  purchase: Doc<"purchases">;
  supplier: Doc<"suppliers"> | null;
};

type ScanDetails = {
  scan: Doc<"purchaseScans">;
  fileUrl: string | null;
  lineItems: Doc<"purchaseScanLineItems">[];
  events: Doc<"purchaseScanEvents">[];
} | null;

type ReviewLine = {
  description: string;
  quantity: string;
  unitPrice: string;
  taxMode: TaxMode;
};

type ReviewForm = {
  detectedTaxInvoice: boolean;
  supplierName: string;
  supplierAddress: string;
  supplierVatNumber: string;
  recipientName: string;
  recipientAddress: string;
  invoiceNumber: string;
  purchaseOrderNumber: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  subtotal: string;
  vatAmount: string;
  total: string;
  taxMode: TaxMode;
  notes: string;
  lineItems: ReviewLine[];
};

const emptyLine: ReviewLine = {
  description: "",
  quantity: "1",
  unitPrice: "",
  taxMode: "no_vat",
};

const fieldClass = "h-11 rounded-lg border-border bg-background text-base shadow-sm";
const textareaClass =
  "min-h-24 rounded-lg border-border bg-background text-base shadow-sm";
const labelClass = "grid gap-2 text-sm font-medium text-foreground";

const purchaseStatusLabels: Record<PurchaseStatus, string> = {
  draft: "Draft",
  recorded: "Recorded",
  paid: "Paid",
  void: "Void",
};

const purchaseStatusTone: Record<PurchaseStatus, string> = {
  draft: "bg-orange-50 text-orange-600",
  recorded: "bg-amber-50 text-amber-700",
  paid: "bg-teal-50 text-teal-700",
  void: "bg-neutral-100 text-neutral-600",
};

const scanStatusTone: Record<string, { color: string; label: string }> = {
  uploaded: { color: "var(--muted-foreground)", label: "Uploaded" },
  extracting: { color: "var(--warning)", label: "Sending" },
  needs_review: { color: "var(--destructive)", label: "Needs review" },
  ready: { color: "var(--success)", label: "Ready" },
  saved: { color: "var(--primary)", label: "Saved" },
  failed: { color: "var(--destructive)", label: "Failed" },
};

const providerLabels: Record<string, { label: string; detail: string }> = {
  manual: { label: "Manual review", detail: "In Payvio" },
  desert: { label: "Desert", detail: "Integration handoff" },
  none: { label: "Not sent", detail: "Waiting" },
};

function providerDisplay(provider: string | undefined) {
  return providerLabels[provider ?? "none"] ?? {
    label: provider ?? "Not sent",
    detail: "Review",
  };
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function moneyValue(value: string | number | undefined) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function moneyString(value: number | undefined) {
  return value === undefined ? "" : String(Math.round(value * 100) / 100);
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

function cleanCurrency(value: string | undefined, fallback = "NAD") {
  const currency = (value || fallback).trim().toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : fallback;
}

function formatDate(value?: string, fallbackTime?: number) {
  const date = value
    ? new Date(`${value}T00:00:00`)
    : fallbackTime
      ? new Date(fallbackTime)
      : null;

  if (!date || Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function dateValue(value?: string, fallbackTime = 0) {
  if (!value) {
    return fallbackTime;
  }

  const time = new Date(`${value}T00:00:00`).getTime();
  return Number.isNaN(time) ? fallbackTime : time;
}

function metricPercent(value: number, max: number) {
  if (max <= 0 || value <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round((value / max) * 100)));
}

function lineTotals(line: ReviewLine) {
  const subtotal = moneyValue(line.quantity) * moneyValue(line.unitPrice);
  const vatAmount = line.taxMode === "vat_15" ? subtotal * 0.15 : 0;

  return {
    subtotal,
    vatAmount,
    total: subtotal + vatAmount,
  };
}

function formTotals(lines: ReviewLine[]) {
  return lines.reduce(
    (totals, line) => {
      const item = lineTotals(line);
      totals.subtotal += item.subtotal;
      totals.vatAmount += item.vatAmount;
      totals.total += item.total;
      return totals;
    },
    { subtotal: 0, vatAmount: 0, total: 0 },
  );
}

function emptyReviewForm(currency = "NAD", taxMode: TaxMode = "no_vat"): ReviewForm {
  return {
    detectedTaxInvoice: false,
    supplierName: "",
    supplierAddress: "",
    supplierVatNumber: "",
    recipientName: "",
    recipientAddress: "",
    invoiceNumber: "",
    purchaseOrderNumber: "",
    issueDate: today(),
    dueDate: "",
    currency,
    subtotal: "",
    vatAmount: "",
    total: "",
    taxMode,
    notes: "",
    lineItems: [{ ...emptyLine, taxMode }],
  };
}

function scanToForm(details: ScanDetails, fallbackCurrency: string): ReviewForm {
  if (!details) {
    return emptyReviewForm(fallbackCurrency);
  }

  const scan = details.scan;
  const lineItems =
    details.lineItems.length > 0
      ? details.lineItems.map((line) => ({
          description: line.description,
          quantity: String(line.quantity),
          unitPrice: String(line.unitPrice),
          taxMode: line.taxMode as TaxMode,
        }))
      : [{ ...emptyLine, taxMode: (scan.taxMode ?? "no_vat") as TaxMode }];

  return {
    detectedTaxInvoice: scan.detectedTaxInvoice ?? false,
    supplierName: scan.supplierName ?? "",
    supplierAddress: scan.supplierAddress ?? "",
    supplierVatNumber: scan.supplierVatNumber ?? "",
    recipientName: scan.recipientName ?? "",
    recipientAddress: scan.recipientAddress ?? "",
    invoiceNumber: scan.invoiceNumber ?? "",
    purchaseOrderNumber: scan.purchaseOrderNumber ?? "",
    issueDate: scan.issueDate ?? today(),
    dueDate: scan.dueDate ?? "",
    currency: cleanCurrency(scan.currency, fallbackCurrency),
    subtotal: moneyString(scan.subtotal),
    vatAmount: moneyString(scan.vatAmount),
    total: moneyString(scan.total),
    taxMode: (scan.taxMode ?? "no_vat") as TaxMode,
    notes: scan.notes ?? "",
    lineItems,
  };
}

function StatusPill({ status }: { status: string }) {
  const tone = scanStatusTone[status] ?? scanStatusTone.uploaded;

  return (
    <span
      className="db-status-pill inline-flex h-6 items-center rounded-full px-3 text-sm font-semibold"
      style={{
        background: `color-mix(in oklch, ${tone.color} 12%, transparent)`,
        color: tone.color,
      }}
    >
      {tone.label}
    </span>
  );
}

function PurchaseStatusBadge({ status }: { status: PurchaseStatus }) {
  return (
    <Badge className={cn("h-6 rounded-full border-0 px-3 text-sm font-semibold", purchaseStatusTone[status])}>
      {purchaseStatusLabels[status]}
    </Badge>
  );
}

function purchaseUpdatePayload(purchase: Doc<"purchases">, status: PurchaseStatus) {
  return {
    id: purchase._id,
    ...(purchase.supplierId ? { supplierId: purchase.supplierId } : {}),
    supplierName: purchase.supplierName,
    ...(purchase.invoiceNumber ? { invoiceNumber: purchase.invoiceNumber } : {}),
    issueDate: purchase.issueDate,
    ...(purchase.dueDate ? { dueDate: purchase.dueDate } : {}),
    currency: purchase.currency,
    subtotal: purchase.subtotal,
    vatAmount: purchase.vatAmount,
    taxMode: purchase.taxMode,
    status,
    ...(purchase.notes ? { notes: purchase.notes } : {}),
    ...(purchase.proofStorageId ? { proofStorageId: purchase.proofStorageId } : {}),
  };
}

export default function ScanPage() {
  const { canAccess } = usePlan();
  const workspace = useQuery(api.invoices.workspace);
  const purchases = useQuery(api.purchases.listPurchases, {}) as PurchaseRow[] | undefined;
  const suppliers = useQuery(api.purchases.listSuppliers, {}) as Doc<"suppliers">[] | undefined;
  const scans = useQuery(api.purchases.listPurchaseScans, {}) as Doc<"purchaseScans">[] | undefined;
  const generateUploadUrl = useMutation(api.purchases.generatePurchaseUploadUrl);
  const createScan = useMutation(api.purchases.createPurchaseScan);
  const updateReview = useMutation(api.purchases.updatePurchaseScanReview);
  const createFromScan = useMutation(api.purchases.createPurchaseFromScan);
  const createPurchase = useMutation(api.purchases.createPurchase);
  const updatePurchase = useMutation(api.purchases.updatePurchase);
  const markPurchasePaid = useMutation(api.purchases.markPurchasePaid);
  const extractScan = useAction(api.purchaseScanExtraction.extractPurchaseScan);

  const [activeView, setActiveView] = useState<PurchaseView>("all");
  const [purchaseSearch, setPurchaseSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("issue");
  const [selectedScanId, setSelectedScanId] = useState<Id<"purchaseScans"> | null>(null);
  const scanDetails = useQuery(
    api.purchases.getPurchaseScan,
    selectedScanId ? { id: selectedScanId } : "skip",
  ) as ScanDetails | undefined;
  const [formEdits, setFormEdits] = useState<Record<string, ReviewForm>>({});
  const [draftSupplierId, setDraftSupplierId] = useState<Id<"suppliers"> | "new">("new");
  const [manualStatus, setManualStatus] = useState<PurchaseStatus>("recorded");
  const [file, setFile] = useState<File | null>(null);
  const [pendingUpload, setPendingUpload] = useState(false);
  const [pendingReview, setPendingReview] = useState(false);
  const [pendingPurchase, setPendingPurchase] = useState(false);
  const [pendingAction, setPendingAction] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currency = workspace?.defaultCurrency ?? "NAD";
  const vatRegistered = workspace?.vatRegistered ?? false;
  const defaultTaxMode = (vatRegistered
    ? workspace?.vatDefaultTaxMode ?? "vat_15"
    : "no_vat") as TaxMode;
  const purchaseRows = useMemo(() => purchases ?? [], [purchases]);
  const supplierRows = useMemo(() => suppliers ?? [], [suppliers]);
  const scanRows = useMemo(() => scans ?? [], [scans]);
  const selectedScan = scanDetails?.scan ?? null;
  const selectedProvider = providerDisplay(selectedScan?.extractionProvider);
  const draftFormBase = useMemo(
    () => emptyReviewForm(currency, defaultTaxMode),
    [currency, defaultTaxMode],
  );
  const formBase = useMemo(() => {
    if (scanDetails) {
      return scanToForm(scanDetails, currency);
    }

    return draftFormBase;
  }, [currency, draftFormBase, scanDetails]);
  const formKey = selectedScanId ?? "draft";
  const form = formEdits[formKey] ?? formBase;
  const lineSummary = formTotals(form.lineItems);
  const summarySubtotal = moneyValue(form.subtotal);
  const summaryVat = moneyValue(form.vatAmount);
  const summaryTotal = moneyValue(form.total) || summarySubtotal + summaryVat;
  const hasLineAmounts = lineSummary.total > 0;
  const displaySubtotal = hasLineAmounts ? lineSummary.subtotal : summarySubtotal;
  const displayVat = hasLineAmounts ? lineSummary.vatAmount : summaryVat;
  const displayTotal = hasLineAmounts ? lineSummary.total : summaryTotal;
  const isBusy = pendingUpload || pendingReview || pendingPurchase || Boolean(pendingAction);

  const recordedRows = purchaseRows.filter(({ purchase }) => purchase.status === "recorded");
  const draftRows = purchaseRows.filter(({ purchase }) => purchase.status === "draft");
  const paidRows = purchaseRows.filter(({ purchase }) => purchase.status === "paid");
  const openRows = purchaseRows.filter(
    ({ purchase }) => purchase.status !== "paid" && purchase.status !== "void",
  );
  const poRows = purchaseRows.filter(({ purchase }) => Boolean(purchase.purchaseOrderNumber));
  const reviewScans = scanRows.filter((scan) =>
    ["uploaded", "failed", "needs_review", "ready"].includes(scan.status),
  );
  const purchaseTotal = purchaseRows
    .filter(({ purchase }) => purchase.status !== "void")
    .reduce((total, { purchase }) => total + purchase.total, 0);
  const openPayables = openRows.reduce((total, { purchase }) => total + purchase.balanceDue, 0);
  const metricBase = Math.max(purchaseTotal, openPayables, 1);

  const metricCards = [
    {
      label: "Supplier spend",
      value: formatMoney(purchaseTotal, currency),
      icon: ShoppingCart,
      iconClassName: "bg-neutral-100 text-neutral-700",
      barClassName: "bg-neutral-900",
      progress: metricPercent(purchaseTotal, metricBase),
    },
    {
      label: "Open payables",
      value: formatMoney(openPayables, currency),
      icon: WalletCards,
      iconClassName: "bg-amber-50 text-amber-600",
      barClassName: "bg-amber-500",
      progress: metricPercent(openPayables, metricBase),
    },
    {
      label: "Purchase orders",
      value: String(poRows.length),
      icon: ReceiptText,
      iconClassName: "bg-teal-50 text-teal-700",
      barClassName: "bg-teal-600",
      progress: metricPercent(poRows.length, Math.max(purchaseRows.length, 1)),
    },
    {
      label: "Needs review",
      value: String(reviewScans.length),
      icon: ScanLine,
      iconClassName: "bg-red-50 text-red-600",
      barClassName: "bg-red-600",
      progress: metricPercent(reviewScans.length, Math.max(scanRows.length, 1)),
    },
  ];

  const tabs: { id: PurchaseView; label: string; count: number; tone: string }[] = [
    { id: "all", label: "All purchases", count: purchaseRows.length, tone: "bg-muted text-foreground" },
    { id: "recorded", label: "Recorded", count: recordedRows.length, tone: "bg-amber-100 text-amber-700" },
    { id: "paid", label: "Paid", count: paidRows.length, tone: "bg-teal-100 text-teal-700" },
    { id: "draft", label: "Draft", count: draftRows.length, tone: "bg-orange-100 text-orange-700" },
    { id: "po", label: "With PO", count: poRows.length, tone: "bg-neutral-100 text-neutral-700" },
  ];

  const filteredRows = useMemo(() => {
    const query = purchaseSearch.trim().toLowerCase();

    return purchaseRows
      .filter(({ purchase }) => {
        if (activeView === "recorded") {
          return purchase.status === "recorded";
        }
        if (activeView === "paid") {
          return purchase.status === "paid";
        }
        if (activeView === "draft") {
          return purchase.status === "draft";
        }
        if (activeView === "po") {
          return Boolean(purchase.purchaseOrderNumber);
        }

        return true;
      })
      .filter(({ purchase, supplier }) => {
        if (!query) {
          return true;
        }

        return [
          purchase.invoiceNumber,
          purchase.purchaseOrderNumber,
          purchase.supplierName,
          supplier?.email,
          purchase.issueDate,
          purchase.dueDate,
          purchaseStatusLabels[purchase.status],
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) => {
        const aValue =
          sortBy === "due"
            ? dateValue(a.purchase.dueDate, a.purchase.createdAt)
            : dateValue(a.purchase.issueDate, a.purchase.createdAt);
        const bValue =
          sortBy === "due"
            ? dateValue(b.purchase.dueDate, b.purchase.createdAt)
            : dateValue(b.purchase.issueDate, b.purchase.createdAt);

        return bValue - aValue;
      });
  }, [activeView, purchaseRows, purchaseSearch, sortBy]);

  if (!canAccess("scan")) {
    return <LockedPage feature="Purchase Management" requiredPlan="Business" />;
  }

  function setForm(updater: ReviewForm | ((current: ReviewForm) => ReviewForm)) {
    setFormEdits((current) => {
      const currentForm = current[formKey] ?? formBase;
      const nextForm = typeof updater === "function" ? updater(currentForm) : updater;

      return {
        ...current,
        [formKey]: nextForm,
      };
    });
  }

  function resetDraftForm() {
    setSelectedScanId(null);
    setDraftSupplierId("new");
    setManualStatus("recorded");
    setFormEdits((current) => ({
      ...current,
      draft: emptyReviewForm(currency, defaultTaxMode),
    }));
  }

  function selectSupplier(value: string) {
    if (value === "new") {
      setDraftSupplierId("new");
      return;
    }

    const supplierId = value as Id<"suppliers">;
    const supplier = supplierRows.find((item) => item._id === supplierId);

    setDraftSupplierId(supplierId);
    if (supplier) {
      setForm((current) => ({
        ...current,
        supplierName: supplier.name,
        supplierAddress: supplier.address ?? current.supplierAddress,
        supplierVatNumber: supplier.vatNumber ?? current.supplierVatNumber,
      }));
    }
  }

  async function uploadFile() {
    if (!file) {
      throw new Error("Attach a supplier invoice PDF or image first.");
    }

    const uploadUrl = await generateUploadUrl();
    const upload = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });

    if (!upload.ok) {
      throw new Error("Unable to upload invoice file.");
    }

    const result = (await upload.json()) as { storageId: string };
    return result.storageId as Id<"_storage">;
  }

  async function handleUploadAndExtract() {
    setPendingUpload(true);
    setNotice(null);
    setError(null);

    try {
      const storageId = await uploadFile();
      const scanId = await createScan({
        storageId,
        fileName: file?.name,
        fileType: file?.type,
        fileSize: file?.size,
      });

      setSelectedScanId(scanId);
      await extractScan({ id: scanId });
      setFile(null);
      setNotice("Supplier invoice ready for review.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to scan invoice.");
    } finally {
      setPendingUpload(false);
    }
  }

  function updateLine(index: number, patch: Partial<ReviewLine>) {
    setForm((current) => ({
      ...current,
      lineItems: current.lineItems.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...patch } : line,
      ),
    }));
  }

  function removeLine(index: number) {
    setForm((current) => ({
      ...current,
      lineItems:
        current.lineItems.length === 1
          ? [{ ...emptyLine, taxMode: current.taxMode }]
          : current.lineItems.filter((_, lineIndex) => lineIndex !== index),
    }));
  }

  function lineItemPayload() {
    return form.lineItems
      .map((line) => ({
        description: line.description.trim(),
        quantity: moneyValue(line.quantity) || 1,
        unitPrice: moneyValue(line.unitPrice),
        taxMode: vatRegistered ? line.taxMode : "no_vat",
      }))
      .filter((line) => line.description || line.unitPrice > 0);
  }

  function applyLineTotals() {
    const totals = formTotals(form.lineItems);
    setForm((current) => ({
      ...current,
      subtotal: moneyString(totals.subtotal),
      vatAmount: moneyString(totals.vatAmount),
      total: moneyString(totals.total),
    }));
  }

  function reviewPayload() {
    if (!selectedScanId) {
      throw new Error("Select a scan first.");
    }

    return {
      id: selectedScanId,
      detectedTaxInvoice: form.detectedTaxInvoice,
      supplierName: form.supplierName,
      supplierAddress: form.supplierAddress,
      supplierVatNumber: form.supplierVatNumber,
      recipientName: form.recipientName,
      recipientAddress: form.recipientAddress,
      invoiceNumber: form.invoiceNumber,
      purchaseOrderNumber: form.purchaseOrderNumber,
      issueDate: form.issueDate,
      dueDate: form.dueDate,
      currency: cleanCurrency(form.currency, currency),
      subtotal: summarySubtotal,
      vatAmount: summaryVat,
      total: summaryTotal,
      taxMode: vatRegistered ? form.taxMode : "no_vat",
      notes: form.notes,
      lineItems: lineItemPayload(),
    };
  }

  async function saveReview(showNotice = true) {
    setPendingReview(true);
    setNotice(null);
    setError(null);

    try {
      await updateReview(reviewPayload());
      if (showNotice) {
        setNotice("Review saved.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save review.");
      throw caught;
    } finally {
      setPendingReview(false);
    }
  }

  async function handleCreateFromScan() {
    setPendingPurchase(true);
    setNotice(null);
    setError(null);

    try {
      await saveReview(false);

      if (!selectedScanId) {
        throw new Error("Select a scan first.");
      }

      await createFromScan({ id: selectedScanId });
      setNotice("Purchase record created.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create purchase.");
    } finally {
      setPendingPurchase(false);
    }
  }

  async function handleCreateManualPurchase() {
    setPendingPurchase(true);
    setNotice(null);
    setError(null);

    try {
      const supplierName = form.supplierName.trim();
      const invoiceNumber = form.invoiceNumber.trim();
      const purchaseOrderNumber = form.purchaseOrderNumber.trim();
      const lines = lineItemPayload();
      const lineBasedTotals = lines.length > 0 && lineSummary.total > 0;
      const subtotal = lineBasedTotals
        ? lineSummary.subtotal
        : summarySubtotal || Math.max(summaryTotal - summaryVat, 0);
      const vatAmount = lineBasedTotals ? lineSummary.vatAmount : summaryVat;
      const total = subtotal + vatAmount;

      if (!supplierName) {
        throw new Error("Supplier name is required.");
      }
      if (!invoiceNumber && !purchaseOrderNumber) {
        throw new Error("Enter a supplier invoice number or purchase order number.");
      }
      if (!form.issueDate) {
        throw new Error("Issue date is required.");
      }
      if (manualStatus !== "draft" && total <= 0) {
        throw new Error("Add at least one amount before recording this purchase.");
      }

      await createPurchase({
        ...(draftSupplierId !== "new" ? { supplierId: draftSupplierId } : {}),
        supplierName,
        ...(form.supplierAddress.trim() ? { supplierAddress: form.supplierAddress.trim() } : {}),
        ...(form.supplierVatNumber.trim() ? { supplierVatNumber: form.supplierVatNumber.trim() } : {}),
        ...(form.recipientName.trim() ? { recipientName: form.recipientName.trim() } : {}),
        ...(form.recipientAddress.trim() ? { recipientAddress: form.recipientAddress.trim() } : {}),
        ...(invoiceNumber ? { invoiceNumber } : {}),
        ...(purchaseOrderNumber ? { purchaseOrderNumber } : {}),
        issueDate: form.issueDate,
        ...(form.dueDate ? { dueDate: form.dueDate } : {}),
        currency: cleanCurrency(form.currency, currency),
        subtotal,
        ...((lineBasedTotals || form.vatAmount.trim()) ? { vatAmount } : {}),
        taxMode: vatRegistered ? form.taxMode : "no_vat",
        status: manualStatus,
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
        ...(lines.length ? { lineItems: lines } : {}),
      });

      resetDraftForm();
      setNotice("Purchase record saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save purchase.");
    } finally {
      setPendingPurchase(false);
    }
  }

  async function rerunExtraction() {
    if (!selectedScanId) {
      return;
    }

    setPendingUpload(true);
    setNotice(null);
    setError(null);

    try {
      await extractScan({ id: selectedScanId });
      setFormEdits((current) => {
        const next = { ...current };
        delete next[selectedScanId];
        return next;
      });
      setNotice("Review handoff refreshed.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to send this scan for review.");
    } finally {
      setPendingUpload(false);
    }
  }

  async function runPurchaseAction(
    action: string,
    callback: () => Promise<unknown>,
    message: string,
  ) {
    setPendingAction(action);
    setNotice(null);
    setError(null);

    try {
      await callback();
      setNotice(message);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Action failed.");
    } finally {
      setPendingAction("");
    }
  }

  function updatePurchaseStatus(purchase: Doc<"purchases">, status: PurchaseStatus) {
    return runPurchaseAction(
      `${status}-${purchase._id}`,
      () => updatePurchase(purchaseUpdatePayload(purchase, status)),
      `Purchase marked ${purchaseStatusLabels[status].toLowerCase()}.`,
    );
  }

  return (
    <div className="invoice-list-page space-y-[30px]">
      <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((metric) => {
          const Icon = metric.icon;

          return (
            <article
              key={metric.label}
              className="min-h-[156px] rounded-lg border border-border bg-card p-6 shadow-none xl:h-[156px]"
            >
              <div className="flex items-start justify-between gap-6">
                <div className="min-w-0">
                  <p className="text-[24px] font-semibold leading-none tracking-normal text-foreground">
                    {metric.value}
                  </p>
                  <p className="mt-2 text-base leading-5 text-muted-foreground">
                    {metric.label}
                  </p>
                </div>
                <span className={cn("grid size-12 shrink-0 place-items-center rounded-lg", metric.iconClassName)}>
                  <Icon className="size-6" />
                </span>
              </div>
              <div className="mt-[27px] h-1 rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full", metric.barClassName)}
                  style={{ width: `${metric.progress}%` }}
                />
              </div>
            </article>
          );
        })}
      </section>

      {notice || error ? (
        <Card className="rounded-lg bg-background">
          <CardContent
            className={cn(
              "flex items-center gap-2 py-3 text-sm",
              error ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {error ? <AlertTriangle className="size-4" /> : <CheckCircle2 className="size-4" />}
            {error ?? notice}
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,.75fr)]">
        <section className="rounded-lg border border-border bg-card p-5 shadow-none sm:p-[30px]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {selectedScan ? "Review scan" : "Purchase intake"}
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">
                {selectedScan ? "Review supplier invoice" : "Record invoice or PO"}
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedScan ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-lg px-4 text-base"
                  onClick={resetDraftForm}
                >
                  <Plus className="size-4" />
                  New purchase
                </Button>
              ) : null}
              {selectedScan ? <StatusPill status={selectedScan.status} /> : null}
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {!selectedScan ? (
              <label className={labelClass}>
                Supplier profile
                <Select value={draftSupplierId} onValueChange={selectSupplier}>
                  <SelectTrigger className={fieldClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New supplier</SelectItem>
                    {supplierRows.map((supplier) => (
                      <SelectItem key={supplier._id} value={supplier._id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            ) : null}
            <label className={labelClass}>
              Supplier
              <Input
                value={form.supplierName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, supplierName: event.target.value }))
                }
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              Supplier invoice
              <Input
                value={form.invoiceNumber}
                onChange={(event) =>
                  setForm((current) => ({ ...current, invoiceNumber: event.target.value }))
                }
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              Purchase order
              <Input
                value={form.purchaseOrderNumber}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    purchaseOrderNumber: event.target.value,
                  }))
                }
                className={fieldClass}
              />
            </label>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
            <label className={labelClass}>
              Issue date
              <Input
                type="date"
                value={form.issueDate}
                onChange={(event) =>
                  setForm((current) => ({ ...current, issueDate: event.target.value }))
                }
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              Due date
              <Input
                type="date"
                value={form.dueDate}
                onChange={(event) =>
                  setForm((current) => ({ ...current, dueDate: event.target.value }))
                }
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              Currency
              <Select
                value={form.currency}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, currency: value }))
                }
              >
                <SelectTrigger className={fieldClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NAD">NAD</SelectItem>
                  <SelectItem value="ZAR">ZAR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </label>
            {!selectedScan ? (
              <label className={labelClass}>
                Status
                <Select
                  value={manualStatus}
                  onValueChange={(value) => setManualStatus(value as PurchaseStatus)}
                >
                  <SelectTrigger className={fieldClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="recorded">Recorded</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </label>
            ) : (
              <label className={labelClass}>
                VAT mode
                <Select
                  value={vatRegistered ? form.taxMode : "no_vat"}
                  disabled={!vatRegistered}
                  onValueChange={(value) => {
                    const taxMode = value as TaxMode;
                    setForm((current) => ({
                      ...current,
                      taxMode,
                      lineItems: current.lineItems.map((line) => ({ ...line, taxMode })),
                    }));
                  }}
                >
                  <SelectTrigger className={fieldClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no_vat">No VAT</SelectItem>
                    <SelectItem value="vat_15">VAT 15%</SelectItem>
                    <SelectItem value="zero_rated">Zero rated</SelectItem>
                    <SelectItem value="exempt">Exempt</SelectItem>
                  </SelectContent>
                </Select>
              </label>
            )}
          </div>

          {!selectedScan ? (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className={labelClass}>
                VAT mode
                <Select
                  value={vatRegistered ? form.taxMode : "no_vat"}
                  disabled={!vatRegistered}
                  onValueChange={(value) => {
                    const taxMode = value as TaxMode;
                    setForm((current) => ({
                      ...current,
                      taxMode,
                      lineItems: current.lineItems.map((line) => ({ ...line, taxMode })),
                    }));
                  }}
                >
                  <SelectTrigger className={fieldClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no_vat">No VAT</SelectItem>
                    <SelectItem value="vat_15">VAT 15%</SelectItem>
                    <SelectItem value="zero_rated">Zero rated</SelectItem>
                    <SelectItem value="exempt">Exempt</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className={labelClass}>
                Supplier VAT
                <Input
                  value={form.supplierVatNumber}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      supplierVatNumber: event.target.value,
                    }))
                  }
                  className={fieldClass}
                />
              </label>
            </div>
          ) : null}

          {selectedScan ? (
            <div className="mt-4 flex min-h-11 items-center gap-3 rounded-lg border border-border bg-background px-4">
              <Checkbox
                checked={form.detectedTaxInvoice}
                onCheckedChange={(checked) =>
                  setForm((current) => ({
                    ...current,
                    detectedTaxInvoice: checked === true,
                  }))
                }
              />
              <span className="text-sm font-medium text-foreground">Tax Invoice wording found</span>
            </div>
          ) : null}

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className={labelClass}>
              Supplier address
              <Textarea
                value={form.supplierAddress}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    supplierAddress: event.target.value,
                  }))
                }
                className={textareaClass}
              />
            </label>
            <label className={labelClass}>
              Recipient address
              <Textarea
                value={form.recipientAddress}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    recipientAddress: event.target.value,
                  }))
                }
                className={textareaClass}
              />
            </label>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
            <label className={labelClass}>
              Recipient
              <Input
                value={form.recipientName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, recipientName: event.target.value }))
                }
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              Subtotal
              <Input
                inputMode="decimal"
                value={form.subtotal}
                onChange={(event) =>
                  setForm((current) => ({ ...current, subtotal: event.target.value }))
                }
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              VAT
              <Input
                inputMode="decimal"
                value={form.vatAmount}
                onChange={(event) =>
                  setForm((current) => ({ ...current, vatAmount: event.target.value }))
                }
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              Total
              <Input
                inputMode="decimal"
                value={form.total}
                onChange={(event) =>
                  setForm((current) => ({ ...current, total: event.target.value }))
                }
                className={fieldClass}
              />
            </label>
          </div>

          <div className="mt-6 border-t border-border pt-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Items</p>
                <h3 className="text-lg font-semibold text-foreground">Line items</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-lg px-4 text-base"
                  onClick={applyLineTotals}
                >
                  <FileCheck2 className="size-4" />
                  Use line totals
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-lg px-4 text-base"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      lineItems: [...current.lineItems, { ...emptyLine, taxMode: current.taxMode }],
                    }))
                  }
                >
                  <Plus className="size-4" />
                  Add line
                </Button>
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              {form.lineItems.map((line, index) => {
                const totals = lineTotals(line);

                return (
                  <div
                    key={index}
                    className="grid gap-3 rounded-lg border border-border bg-background p-3 md:grid-cols-2 min-[1900px]:grid-cols-[minmax(180px,1.4fr)_80px_120px_130px_130px_44px] min-[1900px]:items-end"
                  >
                    <label className={labelClass}>
                      Description
                      <Input
                        value={line.description}
                        onChange={(event) => updateLine(index, { description: event.target.value })}
                        className={fieldClass}
                      />
                    </label>
                    <label className={labelClass}>
                      Qty
                      <Input
                        inputMode="decimal"
                        value={line.quantity}
                        onChange={(event) => updateLine(index, { quantity: event.target.value })}
                        className={fieldClass}
                      />
                    </label>
                    <label className={labelClass}>
                      Unit price
                      <Input
                        inputMode="decimal"
                        value={line.unitPrice}
                        onChange={(event) => updateLine(index, { unitPrice: event.target.value })}
                        className={fieldClass}
                      />
                    </label>
                    <label className={labelClass}>
                      Tax
                      <Select
                        value={vatRegistered ? line.taxMode : "no_vat"}
                        disabled={!vatRegistered}
                        onValueChange={(value) => updateLine(index, { taxMode: value as TaxMode })}
                      >
                        <SelectTrigger className={fieldClass}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="no_vat">No VAT</SelectItem>
                          <SelectItem value="vat_15">VAT 15%</SelectItem>
                          <SelectItem value="zero_rated">Zero rated</SelectItem>
                          <SelectItem value="exempt">Exempt</SelectItem>
                        </SelectContent>
                      </Select>
                    </label>
                    <div className="grid h-11 content-center rounded-lg bg-muted px-3 text-sm">
                      <span className="text-xs text-muted-foreground">Line total</span>
                      <strong className="truncate text-foreground">
                        {formatMoney(totals.total, form.currency)}
                      </strong>
                    </div>
                    <div className="flex items-end md:justify-end min-[1900px]:block">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-11 rounded-lg"
                        aria-label="Remove line item"
                        onClick={() => removeLine(index)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="mt-3 text-sm text-muted-foreground">
              Line subtotal: {formatMoney(lineSummary.subtotal, form.currency)} | VAT:{" "}
              {formatMoney(lineSummary.vatAmount, form.currency)} | Total:{" "}
              {formatMoney(lineSummary.total, form.currency)}
            </p>
          </div>

          <label className={cn(labelClass, "mt-6")}>
            Notes
            <Textarea
              value={form.notes}
              onChange={(event) =>
                setForm((current) => ({ ...current, notes: event.target.value }))
              }
              className={textareaClass}
            />
          </label>

          <div className="mt-6 flex flex-col gap-4 border-t border-border pt-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-3 sm:gap-6">
              <span>Subtotal: <strong className="text-foreground">{formatMoney(displaySubtotal, form.currency)}</strong></span>
              <span>VAT: <strong className="text-foreground">{formatMoney(displayVat, form.currency)}</strong></span>
              <span>Total: <strong className="text-foreground">{formatMoney(displayTotal, form.currency)}</strong></span>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedScan ? (
                <>
                  <Button
                    type="button"
                    disabled={isBusy || selectedScan.status === "saved"}
                    variant="outline"
                    className="h-11 rounded-lg px-4 text-base"
                    onClick={() => void saveReview()}
                  >
                    {pendingReview ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    Save review
                  </Button>
                  <Button
                    type="button"
                    disabled={isBusy || selectedScan.status === "saved"}
                    className="h-11 rounded-lg bg-neutral-950 px-5 text-base font-semibold !text-white hover:bg-neutral-800 hover:!text-white"
                    onClick={handleCreateFromScan}
                  >
                    {pendingPurchase ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
                    Create purchase
                  </Button>
                  {scanDetails?.fileUrl ? (
                    <Button
                      asChild
                      variant="outline"
                      className="h-11 rounded-lg px-4 text-base"
                    >
                      <a href={scanDetails.fileUrl} target="_blank" rel="noreferrer">
                        <FileText className="size-4" />
                        Open file
                      </a>
                    </Button>
                  ) : null}
                </>
              ) : (
                <Button
                  type="button"
                  disabled={isBusy}
                  className="h-11 rounded-lg bg-neutral-950 px-5 text-base font-semibold !text-white hover:bg-neutral-800 hover:!text-white"
                  onClick={handleCreateManualPurchase}
                >
                  {pendingPurchase ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  Save purchase
                </Button>
              )}
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <section className="rounded-lg border border-border bg-card p-5 shadow-none sm:p-[30px]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Upload</p>
                <h2 className="mt-1 text-xl font-semibold text-foreground">Supplier file</h2>
              </div>
              <UploadCloud className="size-6 text-muted-foreground" />
            </div>
            <div className="mt-5 grid gap-3">
              <Input
                type="file"
                accept="image/*,.pdf"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                className={fieldClass}
              />
              <Button
                type="button"
                disabled={pendingUpload || !file}
                className="h-11 rounded-lg bg-neutral-950 px-5 text-base font-semibold !text-white hover:bg-neutral-800 hover:!text-white"
                onClick={handleUploadAndExtract}
              >
                {pendingUpload ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}
                Upload for review
              </Button>
              {selectedScan ? (
                <Button
                  type="button"
                  disabled={pendingUpload || selectedScan.status === "saved"}
                  variant="outline"
                  className="h-11 rounded-lg px-4 text-base"
                  onClick={rerunExtraction}
                >
                  {pendingUpload ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                  Send again
                </Button>
              ) : null}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-5 shadow-none sm:p-[30px]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Queue</p>
                <h2 className="mt-1 text-xl font-semibold text-foreground">Review scans</h2>
              </div>
              <Badge variant="outline" className="h-6 rounded-full px-3">{scanRows.length}</Badge>
            </div>
            <div className="mt-5 grid max-h-[310px] gap-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
              {scanRows.slice(0, 12).map((scan) => (
                <Button
                  key={scan._id}
                  type="button"
                  variant="ghost"
                  className={cn(
                    "h-auto min-h-16 w-full justify-between gap-3 rounded-lg border border-border bg-background px-3 py-3 text-left hover:bg-muted",
                    selectedScanId === scan._id && "bg-muted",
                  )}
                  onClick={() => setSelectedScanId(scan._id)}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-foreground">
                      {scan.invoiceNumber || scan.fileName || scan.purchaseOrderNumber || "Supplier invoice"}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {scan.supplierName || "Review supplier"}
                    </span>
                  </span>
                  <StatusPill status={scan.status} />
                </Button>
              ))}
              {scanRows.length === 0 ? (
                <div className="grid min-h-28 place-items-center rounded-lg border border-dashed text-center">
                  <div>
                    <ScanLine className="mx-auto mb-2 size-7 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No scans yet</p>
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-5 shadow-none sm:p-[30px]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Summary</p>
                <h2 className="mt-1 text-xl font-semibold text-foreground">Purchase totals</h2>
              </div>
              <ShieldCheck className="size-6 text-muted-foreground" />
            </div>
            <div className="mt-5 grid gap-3 text-sm">
              <div className="flex justify-between gap-3 rounded-lg bg-muted px-3 py-2">
                <span className="text-muted-foreground">Subtotal</span>
                <strong>{formatMoney(displaySubtotal, form.currency)}</strong>
              </div>
              <div className="flex justify-between gap-3 rounded-lg bg-muted px-3 py-2">
                <span className="text-muted-foreground">VAT</span>
                <strong>{formatMoney(displayVat, form.currency)}</strong>
              </div>
              <div className="flex justify-between gap-3 rounded-lg bg-foreground px-3 py-2 text-background">
                <span>Total</span>
                <strong>{formatMoney(displayTotal, form.currency)}</strong>
              </div>
            </div>
            {selectedScan?.warnings.length ? (
              <div className="mt-4 grid gap-2">
                {selectedScan.warnings.map((warning) => (
                  <div key={warning} className="flex gap-2 rounded-lg border border-[color:var(--warning)]/40 bg-[var(--warning-soft)] px-3 py-2 text-xs text-[var(--warning)]">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                    <span>{warning}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 flex gap-2 rounded-lg border border-[color:var(--success)]/30 bg-[var(--success-soft)] px-3 py-2 text-xs text-[var(--success)]">
                <CheckCircle2 className="size-3.5" />
                Ready for purchase records.
              </div>
            )}
            <div className="mt-4 grid gap-2 text-xs text-muted-foreground">
              <div className="flex justify-between gap-3">
                <span>Review path</span>
                <strong className="text-foreground">{selectedProvider.label}</strong>
              </div>
              <div className="flex justify-between gap-3">
                <span>Handoff</span>
                <strong className="text-foreground">{selectedScan ? selectedProvider.detail : "-"}</strong>
              </div>
            </div>
          </section>
        </aside>
      </section>

      <section className="min-h-[560px] rounded-lg border border-border bg-card p-5 shadow-none sm:p-[30px]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <Tabs value={activeView} onValueChange={(value) => setActiveView(value as PurchaseView)}>
            <TabsList className="flex h-auto w-full max-w-none flex-wrap items-center justify-start gap-x-9 gap-y-3 overflow-visible rounded-none bg-transparent p-0">
              {tabs.map((tab) => (
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
            className="h-11 rounded-lg bg-neutral-950 px-5 text-base font-semibold !text-white hover:bg-neutral-800 hover:!text-white"
            onClick={resetDraftForm}
          >
            <Plus className="size-4" />
            New purchase
          </Button>
        </div>

        <div className="mt-[30px] flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative w-full lg:max-w-[304px]" htmlFor="purchase-search">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="purchase-search"
              value={purchaseSearch}
              onChange={(event) => setPurchaseSearch(event.target.value)}
              placeholder="Search purchases..."
              className="h-11 rounded-lg border-border bg-background pl-12 text-base shadow-sm"
            />
          </label>
          <Button
            type="button"
            variant="outline"
            className={cn("h-11 rounded-lg px-4 text-base", sortBy === "issue" && "bg-muted text-foreground")}
            onClick={() => setSortBy("issue")}
          >
            <CalendarDays className="size-4" />
            Issue date
          </Button>
          <Button
            type="button"
            variant="outline"
            className={cn("h-11 rounded-lg px-4 text-base", sortBy === "due" && "bg-muted text-foreground")}
            onClick={() => setSortBy("due")}
          >
            <CalendarDays className="size-4" />
            Due date
          </Button>
        </div>

        <div className="mt-8 max-h-[430px] overflow-y-auto pr-1 [scrollbar-color:color-mix(in_oklch,var(--foreground)_35%,transparent)_transparent] [scrollbar-width:thin]">
          {filteredRows.length > 0 ? (
            <Table className="table-fixed text-base">
              <colgroup>
                <col className="w-[15%]" />
                <col className="w-[15%]" />
                <col className="w-[13%]" />
                <col className="w-[13%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
                <col className="w-[110px]" />
              </colgroup>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="h-14 overflow-hidden px-3 font-semibold text-foreground">Supplier invoice</TableHead>
                  <TableHead className="h-14 overflow-hidden px-3 font-semibold text-foreground">Supplier</TableHead>
                  <TableHead className="h-14 overflow-hidden px-3 font-semibold text-foreground">Purchase order</TableHead>
                  <TableHead className="h-14 overflow-hidden px-3 font-semibold text-foreground">Total cost</TableHead>
                  <TableHead className="h-14 overflow-hidden px-3 font-semibold text-foreground">Status</TableHead>
                  <TableHead className="h-14 overflow-hidden px-3 font-semibold text-foreground">Issued</TableHead>
                  <TableHead className="h-14 overflow-hidden px-3 font-semibold text-foreground">Due</TableHead>
                  <TableHead className="h-14 px-3 text-center font-semibold text-foreground">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map(({ purchase, supplier }) => (
                  <TableRow key={purchase._id} className="h-[71px] border-border hover:bg-muted/40">
                    <TableCell className="overflow-hidden px-3 font-medium text-foreground">
                      <span className="block truncate">{purchase.invoiceNumber || "-"}</span>
                    </TableCell>
                    <TableCell className="overflow-hidden px-3 text-foreground">
                      <span className="block truncate">{purchase.supplierName}</span>
                      {supplier?.email ? (
                        <span className="mt-1 block truncate text-xs text-muted-foreground">{supplier.email}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="overflow-hidden px-3 text-foreground">
                      <span className="block truncate">{purchase.purchaseOrderNumber || "-"}</span>
                    </TableCell>
                    <TableCell className="overflow-hidden px-3 text-foreground">
                      <span className="block truncate">{formatMoney(purchase.total, purchase.currency)}</span>
                      {purchase.balanceDue > 0 ? (
                        <span className="mt-1 block text-xs text-muted-foreground">
                          Balance {formatMoney(purchase.balanceDue, purchase.currency)}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="overflow-hidden px-3">
                      <PurchaseStatusBadge status={purchase.status} />
                    </TableCell>
                    <TableCell className="overflow-hidden px-3 text-foreground">
                      <span className="block truncate">{formatDate(purchase.issueDate, purchase.createdAt)}</span>
                    </TableCell>
                    <TableCell className="overflow-hidden px-3 text-foreground">
                      <span className="block truncate">{formatDate(purchase.dueDate)}</span>
                    </TableCell>
                    <TableCell className="px-3">
                      <PurchaseActions
                        purchase={purchase}
                        pendingAction={pendingAction}
                        onMarkPaid={(item) =>
                          runPurchaseAction(
                            `paid-${item._id}`,
                            () => markPurchasePaid({ id: item._id }),
                            "Purchase marked paid.",
                          )
                        }
                        onMarkRecorded={(item) => updatePurchaseStatus(item, "recorded")}
                        onMarkDraft={(item) => updatePurchaseStatus(item, "draft")}
                        onVoid={(item) => updatePurchaseStatus(item, "void")}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="grid min-h-52 place-items-center rounded-lg border border-dashed p-8 text-center">
              <div>
                <ReceiptText className="mx-auto mb-3 size-8 text-muted-foreground" />
                <h3 className="font-medium">No purchases here</h3>
                <p className="mt-1 text-sm text-muted-foreground">Record a supplier invoice or PO to start tracking.</p>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function PurchaseActions({
  purchase,
  pendingAction,
  onMarkPaid,
  onMarkRecorded,
  onMarkDraft,
  onVoid,
}: {
  purchase: Doc<"purchases">;
  pendingAction: string;
  onMarkPaid: (purchase: Doc<"purchases">) => void;
  onMarkRecorded: (purchase: Doc<"purchases">) => void;
  onMarkDraft: (purchase: Doc<"purchases">) => void;
  onVoid: (purchase: Doc<"purchases">) => void;
}) {
  const pending = pendingAction.endsWith(`-${purchase._id}`);
  const canMarkPaid = purchase.status !== "paid" && purchase.status !== "void";
  const canMarkRecorded = purchase.status === "draft";
  const canMarkDraft = purchase.status === "recorded";
  const canVoid = purchase.status !== "void";

  return (
    <div className="flex items-center justify-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Mark ${purchase.invoiceNumber || purchase.purchaseOrderNumber || "purchase"} paid`}
        className="size-9 rounded-full bg-teal-50 text-teal-600 hover:bg-teal-100 hover:text-teal-700"
        disabled={!canMarkPaid || pending}
        onClick={() => onMarkPaid(purchase)}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Banknote className="size-4" />}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`More actions for ${purchase.invoiceNumber || purchase.purchaseOrderNumber || "purchase"}`}
            className="size-9 rounded-full bg-neutral-100 text-neutral-950 hover:bg-neutral-200 hover:text-neutral-950"
          >
            <EllipsisVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {canMarkPaid ? (
            <DropdownMenuItem onSelect={() => onMarkPaid(purchase)}>
              <Banknote className="size-4" />
              Mark paid
            </DropdownMenuItem>
          ) : null}
          {canMarkRecorded ? (
            <DropdownMenuItem onSelect={() => onMarkRecorded(purchase)}>
              <CheckCircle2 className="size-4" />
              Mark recorded
            </DropdownMenuItem>
          ) : null}
          {canMarkDraft ? (
            <DropdownMenuItem onSelect={() => onMarkDraft(purchase)}>
              <Clock className="size-4" />
              Move to draft
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem disabled>
            <FileText className="size-4" />
            {purchase.purchaseOrderNumber || "No PO number"}
          </DropdownMenuItem>
          {canVoid ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => onVoid(purchase)}>
                <Trash2 className="size-4" />
                Void purchase
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
