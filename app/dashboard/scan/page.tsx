"use client";

import { useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  CheckCircle2,
  FileCheck2,
  FileText,
  Loader2,
  Paperclip,
  Plus,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Trash2,
  UploadCloud,
} from "lucide-react";

import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { usePlan } from "@/lib/plan";
import { LockedPage } from "../_components/DashboardShell";

type TaxMode = "no_vat" | "vat_15" | "zero_rated" | "exempt";

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

const fieldClass = "db-field-input";
const textareaClass =
  "db-field-input db-field-textarea";

const statusTone: Record<string, { color: string; label: string }> = {
  uploaded: { color: "#6b7280", label: "Uploaded" },
  extracting: { color: "#7d6000", label: "Sending" },
  needs_review: { color: "#a51f43", label: "Needs review" },
  ready: { color: "#006545", label: "Ready" },
  saved: { color: "#3042a6", label: "Saved" },
  failed: { color: "#a51f43", label: "Failed" },
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

function emptyReviewForm(currency = "NAD"): ReviewForm {
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
    taxMode: "no_vat",
    notes: "",
    lineItems: [{ ...emptyLine }],
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
  const tone = statusTone[status] ?? statusTone.uploaded;
  return (
    <span
      className="db-status-pill"
      style={{ color: tone.color, background: `${tone.color}18` }}
    >
      {tone.label}
    </span>
  );
}

export default function ScanPage() {
  const { canAccess } = usePlan();
  const workspace = useQuery(api.invoices.workspace);
  const purchases = useQuery(api.purchases.listPurchases, {}) as PurchaseRow[] | undefined;
  const scans = useQuery(api.purchases.listPurchaseScans, {});
  const generateUploadUrl = useMutation(api.purchases.generatePurchaseUploadUrl);
  const createScan = useMutation(api.purchases.createPurchaseScan);
  const updateReview = useMutation(api.purchases.updatePurchaseScanReview);
  const createFromScan = useMutation(api.purchases.createPurchaseFromScan);
  const extractScan = useAction(api.purchaseScanExtraction.extractPurchaseScan);

  const [selectedScanId, setSelectedScanId] = useState<Id<"purchaseScans"> | null>(null);
  const scanDetails = useQuery(
    api.purchases.getPurchaseScan,
    selectedScanId ? { id: selectedScanId } : "skip",
  ) as ScanDetails | undefined;
  const [formEdits, setFormEdits] = useState<Record<string, ReviewForm>>({});
  const [file, setFile] = useState<File | null>(null);
  const [pendingUpload, setPendingUpload] = useState(false);
  const [pendingReview, setPendingReview] = useState(false);
  const [pendingPurchase, setPendingPurchase] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currency = workspace?.defaultCurrency ?? "NAD";
  const vatRegistered = workspace?.vatRegistered ?? false;
  const defaultTaxMode = (vatRegistered
    ? workspace?.vatDefaultTaxMode ?? "vat_15"
    : "no_vat") as TaxMode;
  const scanRows = useMemo(() => scans ?? [], [scans]);
  const recentPurchases = useMemo(() => (purchases ?? []).slice(0, 6), [purchases]);
  const recentScans = useMemo(() => scanRows.slice(0, 8), [scanRows]);
  const scanCount = scanRows.length;
  const needsReviewCount = scanRows.filter((scan) => scan.status === "needs_review").length;
  const savedScanCount = scanRows.filter((scan) => scan.status === "saved").length;
  const purchaseCount = purchases?.length ?? 0;
  const selectedScan = scanDetails?.scan ?? null;
  const selectedProvider = providerDisplay(selectedScan?.extractionProvider);
  const formBase = useMemo(() => {
    if (scanDetails) {
      return scanToForm(scanDetails, currency);
    }

    const base = emptyReviewForm(currency);
    return {
      ...base,
      taxMode: defaultTaxMode,
      lineItems: base.lineItems.map((line) => ({ ...line, taxMode: defaultTaxMode })),
    };
  }, [currency, defaultTaxMode, scanDetails]);
  const formKey = selectedScanId ?? "draft";
  const form = formEdits[formKey] ?? formBase;
  const summarySubtotal = moneyValue(form.subtotal);
  const summaryVat = moneyValue(form.vatAmount);
  const summaryTotal = moneyValue(form.total);
  const currentLineTotals = formTotals(form.lineItems);
  const isBusy = pendingUpload || pendingReview || pendingPurchase;

  if (!canAccess("scan")) {
    return <LockedPage feature="Scan" requiredPlan="Business" />;
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
      setNotice("Scan ready for review.");
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
      taxMode: form.taxMode,
      notes: form.notes,
      lineItems: form.lineItems
        .map((line) => ({
          description: line.description,
          quantity: moneyValue(line.quantity) || 1,
          unitPrice: moneyValue(line.unitPrice),
          taxMode: line.taxMode,
        }))
        .filter((line) => line.description.trim() || line.unitPrice > 0),
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

  async function handleCreatePurchase() {
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

  return (
    <div className="db-page db-dashboard-page db-scan-page">
      <section className="db-workview">
        <div className="db-workview-head">
          <div>
            <p className="db-breadcrumb">Payvio <span>/</span> Scan</p>
            <h1 className="db-workview-title">Scan</h1>
          </div>
        </div>

        <div className="db-metric-strip" aria-label="Scan metrics">
          <div className="db-metric-cell">
            <span>Scans</span>
            <strong>{scanCount}</strong>
            <small>Uploaded supplier files</small>
          </div>
          <div className="db-metric-cell">
            <span>Needs review</span>
            <strong>{needsReviewCount}</strong>
            <small>Check before saving</small>
          </div>
          <div className="db-metric-cell">
            <span>Saved</span>
            <strong>{savedScanCount}</strong>
            <small>Converted to records</small>
          </div>
          <div className="db-metric-cell">
            <span>Purchases</span>
            <strong>{purchaseCount}</strong>
            <small>Captured records</small>
          </div>
        </div>

      {notice ? (
        <div className="db-notice db-notice-clean">
          <CheckCircle2 className="size-4" />
          <span>{notice}</span>
        </div>
      ) : null}

      {error ? (
        <div
          className="db-notice db-notice-clean db-scan-error"
        >
          <AlertTriangle className="size-4" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="db-scan-layout">
        <section className="db-card db-scan-intake-card">
          <div className="db-panel-header">
            <div>
              <p className="db-panel-kicker">Supplier intake</p>
              <h2>Review scan</h2>
            </div>
            {selectedScan ? <StatusPill status={selectedScan.status} /> : null}
          </div>

          <div className="db-scan-upload-panel">
            <div className="db-scan-upload-head">
              <span className="db-scan-upload-icon">
                <UploadCloud className="size-4" />
              </span>
              <div>
                <p>
                  {file ? file.name : "Attach PDF or image"}
                </p>
                <span>
                  The original file stays with the purchase record.
                </span>
              </div>
            </div>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="db-field-input db-file-input"
            />
            <div className="db-scan-actions">
              <button
                type="button"
                disabled={pendingUpload || !file}
                className="db-primary-btn"
                onClick={handleUploadAndExtract}
              >
                {pendingUpload ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}
                Upload for review
              </button>
              {selectedScan ? (
                <button
                  type="button"
                  disabled={pendingUpload || selectedScan.status === "saved"}
                  className="db-outline-btn"
                  onClick={rerunExtraction}
                >
                  {pendingUpload ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                  Send again
                </button>
              ) : null}
            </div>
          </div>

          {selectedScan ? (
            <div className="db-scan-review-form">
              <div className="db-scan-form-grid db-scan-form-grid-2">
                <label className="db-field">
                  Supplier
                  <input
                    value={form.supplierName}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, supplierName: event.target.value }))
                    }
                    className={fieldClass}
                  />
                </label>
                <label className="db-field">
                  Supplier invoice number
                  <input
                    value={form.invoiceNumber}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, invoiceNumber: event.target.value }))
                    }
                    className={fieldClass}
                  />
                </label>
              </div>

              <div className="db-scan-form-grid db-scan-form-grid-3">
                <label className="db-field">
                  Issue date
                  <input
                    type="date"
                    value={form.issueDate}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, issueDate: event.target.value }))
                    }
                    className={fieldClass}
                  />
                </label>
                <label className="db-field">
                  Due date
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, dueDate: event.target.value }))
                    }
                    className={fieldClass}
                  />
                </label>
                <label className="db-field">
                  PO number
                  <input
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

              <div className="db-scan-form-grid db-scan-form-grid-3">
                <label className="db-field">
                  Currency
                  <select
                    value={form.currency}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, currency: event.target.value }))
                    }
                    className={fieldClass}
                  >
                    <option value="NAD">NAD</option>
                    <option value="ZAR">ZAR</option>
                    <option value="USD">USD</option>
                  </select>
                </label>
                <label className="db-field">
                  VAT mode
                  <select
                    value={vatRegistered ? form.taxMode : "no_vat"}
                    disabled={!vatRegistered}
                    onChange={(event) => {
                      const taxMode = event.target.value as TaxMode;
                      setForm((current) => ({
                        ...current,
                        taxMode,
                        lineItems: current.lineItems.map((line) => ({ ...line, taxMode })),
                      }));
                    }}
                    className={fieldClass}
                  >
                    <option value="no_vat">No VAT</option>
                    <option value="vat_15">VAT 15%</option>
                    <option value="zero_rated">Zero rated</option>
                    <option value="exempt">Exempt</option>
                  </select>
                </label>
                <label className="db-scan-tax-toggle">
                  <input
                    type="checkbox"
                    checked={form.detectedTaxInvoice}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        detectedTaxInvoice: event.target.checked,
                      }))
                    }
                  />
                  Tax Invoice wording found
                </label>
              </div>

              <div className="db-scan-form-grid db-scan-form-grid-2">
                <label className="db-field">
                  Supplier VAT number
                  <input
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
                <label className="db-field">
                  Recipient
                  <input
                    value={form.recipientName}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, recipientName: event.target.value }))
                    }
                    className={fieldClass}
                  />
                </label>
              </div>

              <div className="db-scan-form-grid db-scan-form-grid-2">
                <label className="db-field">
                  Supplier address
                  <textarea
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
                <label className="db-field">
                  Recipient address
                  <textarea
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

              <div className="db-scan-form-grid db-scan-form-grid-3">
                <label className="db-field">
                  Subtotal
                  <input
                    inputMode="decimal"
                    value={form.subtotal}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, subtotal: event.target.value }))
                    }
                    className={fieldClass}
                  />
                </label>
                <label className="db-field">
                  VAT
                  <input
                    inputMode="decimal"
                    value={form.vatAmount}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, vatAmount: event.target.value }))
                    }
                    className={fieldClass}
                  />
                </label>
                <label className="db-field">
                  Total
                  <input
                    inputMode="decimal"
                    value={form.total}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, total: event.target.value }))
                    }
                    className={fieldClass}
                  />
                </label>
              </div>

              <section className="db-scan-lines">
                <div className="db-scan-lines-head">
                  <div>
                    <p className="db-panel-kicker">Items</p>
                    <h3>Line items</h3>
                  </div>
                  <div className="db-scan-actions">
                    <button type="button" className="db-outline-btn" onClick={applyLineTotals}>
                      Use line totals
                    </button>
                    <button
                      type="button"
                      className="db-outline-btn"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          lineItems: [...current.lineItems, { ...emptyLine, taxMode: current.taxMode }],
                        }))
                      }
                    >
                      <Plus className="size-4" />
                      Add line
                    </button>
                  </div>
                </div>

                <div className="grid gap-2">
                  {form.lineItems.map((line, index) => {
                    const totals = lineTotals(line);
                    return (
                      <div key={index} className="db-scan-line-row">
                        <label className="db-field">
                          Description
                          <input
                            value={line.description}
                            onChange={(event) => updateLine(index, { description: event.target.value })}
                            className={fieldClass}
                          />
                        </label>
                        <label className="db-field">
                          Qty
                          <input
                            inputMode="decimal"
                            value={line.quantity}
                            onChange={(event) => updateLine(index, { quantity: event.target.value })}
                            className={fieldClass}
                          />
                        </label>
                        <label className="db-field">
                          Unit price
                          <input
                            inputMode="decimal"
                            value={line.unitPrice}
                            onChange={(event) => updateLine(index, { unitPrice: event.target.value })}
                            className={fieldClass}
                          />
                        </label>
                        <label className="db-field">
                          Tax
                          <select
                            value={vatRegistered ? line.taxMode : "no_vat"}
                            disabled={!vatRegistered}
                            onChange={(event) => updateLine(index, { taxMode: event.target.value as TaxMode })}
                            className={fieldClass}
                          >
                            <option value="no_vat">No VAT</option>
                            <option value="vat_15">VAT 15%</option>
                            <option value="zero_rated">Zero rated</option>
                            <option value="exempt">Exempt</option>
                          </select>
                        </label>
                        <div className="db-scan-line-total">
                          <span className="block">Line total</span>
                          <strong className="text-[#111827]">
                            {formatMoney(totals.total, form.currency)}
                          </strong>
                        </div>
                        <button
                          type="button"
                          className="db-outline-btn"
                          aria-label="Remove line item"
                          onClick={() => removeLine(index)}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                <p className="db-scan-line-summary">
                  Line subtotal: {formatMoney(currentLineTotals.subtotal, form.currency)} | VAT:{" "}
                  {formatMoney(currentLineTotals.vatAmount, form.currency)} | Total:{" "}
                  {formatMoney(currentLineTotals.total, form.currency)}
                </p>
              </section>

              <label className="db-field">
                Notes
                <textarea
                  value={form.notes}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, notes: event.target.value }))
                  }
                  className={textareaClass}
                />
              </label>

              <div className="db-scan-actions">
                <button
                  type="button"
                  disabled={isBusy || selectedScan.status === "saved"}
                  className="db-outline-btn"
                  onClick={() => void saveReview()}
                >
                  {pendingReview ? <Loader2 className="size-4 animate-spin" /> : <FileCheck2 className="size-4" />}
                  Save review
                </button>
                <button
                  type="button"
                  disabled={isBusy || selectedScan.status === "saved"}
                  className="db-primary-btn"
                  onClick={handleCreatePurchase}
                >
                  {pendingPurchase ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
                  Create purchase
                </button>
                {scanDetails?.fileUrl ? (
                  <a
                    href={scanDetails.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="db-outline-btn"
                  >
                    <FileText className="size-4" />
                    Open file
                  </a>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="db-empty db-scan-empty">
              <ScanLine className="size-10 text-[#d1d5db]" />
              <h3>No scan selected</h3>
              <p>Upload a supplier invoice or select a recent scan.</p>
            </div>
          )}
        </section>

        <aside className="db-scan-side">
          <section className="db-card db-scan-side-card">
            <div className="db-panel-header">
              <div>
                <p className="db-panel-kicker">Compliance</p>
                <h2>Totals</h2>
              </div>
              <span className="db-panel-meta">
                <ShieldCheck className="size-3.5" /> VAT
              </span>
            </div>
            <div className="db-scan-side-body">
            <div className="db-info-grid">
              <div className="db-info-row">
                <span>Subtotal</span>
                <strong>{formatMoney(summarySubtotal, form.currency)}</strong>
              </div>
              <div className="db-info-row">
                <span>VAT</span>
                <strong>{formatMoney(summaryVat, form.currency)}</strong>
              </div>
              <div className="db-info-row db-info-row-total">
                <span>Total</span>
                <strong>{formatMoney(summaryTotal, form.currency)}</strong>
              </div>
            </div>

            {selectedScan?.warnings.length ? (
              <div className="grid gap-2">
                {selectedScan.warnings.map((warning) => (
                  <div key={warning} className="flex gap-2 rounded-md border border-[#facc15]/40 bg-[#fefce8] px-3 py-2 text-xs text-[#854d0e]">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                    <span>{warning}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex gap-2 rounded-md border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-2 text-xs text-[#166534]">
                <CheckCircle2 className="size-3.5" />
                Ready for purchase records.
              </div>
            )}

            <div className="grid gap-2 text-xs text-[#6b7280]">
              <div className="flex justify-between gap-3">
                <span>Retention</span>
                <strong className="text-[#111827]">
                  {selectedScan
                    ? new Date(selectedScan.retainedUntil).toISOString().slice(0, 10)
                    : "-"}
                </strong>
              </div>
              <div className="flex justify-between gap-3">
                <span>Review path</span>
                <strong className="text-[#111827]">
                  {selectedProvider.label}
                </strong>
              </div>
              <div className="flex justify-between gap-3">
                <span>Handoff</span>
                <strong className="text-[#111827]">
                  {selectedScan ? selectedProvider.detail : "-"}
                </strong>
              </div>
            </div>
            </div>
          </section>

          <section className="db-card db-scan-side-card">
            <div className="db-panel-header">
              <div>
                <p className="db-panel-kicker">Queue</p>
                <h2>Recent scans</h2>
              </div>
              <span className="db-panel-meta">{recentScans.length}</span>
            </div>
            <div className="db-scan-side-list">
              {recentScans.map((scan) => (
                <button
                  key={scan._id}
                  type="button"
                  className="db-scan-list-row"
                  onClick={() => setSelectedScanId(scan._id)}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-[#111827]">
                      {scan.invoiceNumber || scan.fileName || "Supplier invoice"}
                    </span>
                    <span className="block truncate text-xs text-[#6b7280]">
                      {scan.supplierName || "Review supplier"}
                    </span>
                  </span>
                  <StatusPill status={scan.status} />
                </button>
              ))}
              {recentScans.length === 0 ? (
                <p className="db-scan-list-empty">
                  No scans yet
                </p>
              ) : null}
            </div>
          </section>
        </aside>
      </div>

      <div className="db-card db-scan-purchases-card">
        <div className="db-panel-header">
          <div>
            <p className="db-panel-kicker">Ledger</p>
            <h2>Recent purchase records</h2>
          </div>
          <span className="db-panel-meta">{recentPurchases.length}</span>
        </div>
        <div className="db-table-wrap">
          <table className="db-table">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Invoice</th>
                <th>Issue date</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {recentPurchases.map(({ purchase }) => (
                <tr key={purchase._id}>
                  <td>
                    <span className="db-inv-num">{purchase.supplierName}</span>
                  </td>
                  <td>{purchase.invoiceNumber ?? "-"}</td>
                  <td>{purchase.issueDate}</td>
                  <td>
                    <span className="db-status-pill">{purchase.status}</span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {formatMoney(purchase.total, purchase.currency)}
                  </td>
                </tr>
              ))}
              {recentPurchases.length === 0 ? (
                <tr>
                  <td colSpan={5} className="db-table-empty">
                    No purchase records captured yet
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
      </section>
    </div>
  );
}
