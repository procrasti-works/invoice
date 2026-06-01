"use client";

import { useRef, useState, useMemo } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
  Receipt,
  RefreshCw,
  ScanLine,
  Tag,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";

import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { usePlan } from "@/lib/plan";
import { LockedPage } from "../_components/DashboardShell";

type TaxMode = "no_vat" | "vat_15" | "zero_rated" | "exempt";

const CATEGORIES = [
  "Travel & fuel",
  "Office & stationery",
  "Equipment",
  "Meals & entertainment",
  "Utilities",
  "Other",
] as const;

type Category = typeof CATEGORIES[number];

const statusTone: Record<string, { color: string; label: string }> = {
  uploaded:     { color: "#6b7280", label: "Uploaded" },
  extracting:   { color: "#7d6000", label: "Extracting" },
  needs_review: { color: "#a51f43", label: "Needs review" },
  ready:        { color: "#006545", label: "Ready" },
  saved:        { color: "#3042a6", label: "Saved" },
  failed:       { color: "#a51f43", label: "Failed" },
};

function StatusPill({ status }: { status: string }) {
  const tone = statusTone[status] ?? statusTone.uploaded;
  return (
    <span
      className="db-status-pill"
      style={{ background: tone.color + "18", color: tone.color, border: `1px solid ${tone.color}30` }}
    >
      {tone.label}
    </span>
  );
}

function formatMoney(amount: number, currency = "NAD") {
  try {
    return new Intl.NumberFormat("en-NA", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export default function ReceiptsPage() {
  const { canAccess } = usePlan();
  const workspace = useQuery(api.invoices.workspace);
  const scans = useQuery(api.purchases.listPurchaseScans, {});
  const purchases = useQuery(api.purchases.listPurchases, {});
  const generateUploadUrl = useMutation(api.purchases.generatePurchaseUploadUrl);
  const createScan = useMutation(api.purchases.createPurchaseScan);
  const extractScan = useAction(api.purchaseScanExtraction.extractPurchaseScan);
  const createFromScan = useMutation(api.purchases.createPurchaseFromScan);

  const [selectedScanId, setSelectedScanId] = useState<Id<"purchaseScans"> | null>(null);
  const scanDetails = useQuery(
    api.purchases.getPurchaseScan,
    selectedScanId ? { id: selectedScanId } : "skip",
  );

  const [selectedCategory, setSelectedCategory] = useState<Category>("Other");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const currency = workspace?.defaultCurrency ?? "NAD";
  const recentScans = useMemo(() => (scans ?? []).slice(0, 10), [scans]);
  const receiptPurchases = useMemo(() => (purchases ?? []).slice(0, 8), [purchases]);

  const selectedScan = scanDetails?.scan ?? null;

  if (!canAccess("receipts")) {
    return <LockedPage feature="receipts" requiredPlan="Business" />;
  }

  function handleFile(f: File) {
    setFile(f);
    setError(null);
    setNotice(null);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }

  async function uploadAndExtract() {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) throw new Error("Upload failed");
      const { storageId } = await res.json();

      const scanId = await createScan({
        storageId,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      });

      setSelectedScanId(scanId);
      setFile(null);
      setUploading(false);
      setExtracting(true);
      setNotice("Extracting receipt details…");

      await extractScan({ id: scanId });
      setExtracting(false);
      setNotice("Receipt extracted — review the details below.");
    } catch (err) {
      setUploading(false);
      setExtracting(false);
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  async function saveReceipt() {
    if (!selectedScanId) return;
    setSaving(true);
    setError(null);
    try {
      await createFromScan({ id: selectedScanId });
      setNotice("Receipt saved to your ledger.");
      setSelectedScanId(null);
      setSaving(false);
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : "Could not save receipt.");
    }
  }

  const isBusy = uploading || extracting || saving;

  return (
    <div className="db-workview db-receipts-page">
      <div className="db-workview-head">
        <div>
          <p className="db-panel-kicker">Receipt Tracker</p>
          <h1 className="db-page-title">Capture and track every expense receipt</h1>
        </div>
      </div>

      {notice && (
        <div className="db-notice db-notice-info">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)}><X className="size-3.5" /></button>
        </div>
      )}
      {error && (
        <div className="db-notice db-notice-error">
          <AlertTriangle className="size-4 shrink-0" />
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)}><X className="size-3.5" /></button>
        </div>
      )}

      {/* ── Upload area ── */}
      <div className="db-card db-receipt-upload-card">
        <div className="db-panel-header">
          <div>
            <p className="db-panel-kicker">Step 1</p>
            <h2>Upload a receipt</h2>
          </div>
        </div>

        <div
          className={`db-receipt-dropzone${dragging ? " db-receipt-dropzone-active" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && fileRef.current?.click()}
          aria-label="Upload receipt"
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            className="sr-only"
            onChange={onFileChange}
          />
          {file ? (
            <div className="db-receipt-file-ready">
              <FileText className="size-8 text-[#0978e1]" />
              <span className="font-semibold text-[#0d141c]">{file.name}</span>
              <span className="text-sm text-[#6b7280]">{(file.size / 1024).toFixed(0)} KB</span>
            </div>
          ) : (
            <div className="db-receipt-dropzone-copy">
              <UploadCloud className="size-10 text-[#0978e1]" />
              <strong>Drop a receipt here or click to browse</strong>
              <span>Supports JPG, PNG, PDF — images deleted after extraction</span>
            </div>
          )}
        </div>

        {/* Category picker */}
        <div className="db-receipt-cat-row">
          <label className="db-field-label">Category</label>
          <div className="db-receipt-categories">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`db-receipt-cat-pill${selectedCategory === cat ? " db-receipt-cat-pill-active" : ""}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="db-receipt-upload-actions">
          <button
            type="button"
            className="db-primary-btn"
            onClick={uploadAndExtract}
            disabled={!file || isBusy}
          >
            {isBusy ? <Loader2 className="size-4 animate-spin" /> : <ScanLine className="size-4" />}
            {uploading ? "Uploading…" : extracting ? "Extracting…" : "Extract receipt"}
          </button>
        </div>
      </div>

      {/* ── Review panel ── */}
      {selectedScan && (
        <div className="db-card db-receipt-review-card">
          <div className="db-panel-header">
            <div>
              <p className="db-panel-kicker">Step 2</p>
              <h2>Review extracted details</h2>
            </div>
            <StatusPill status={selectedScan.status} />
          </div>

          <div className="db-receipt-review-grid">
            <div className="db-receipt-review-row">
              <span className="db-field-label">Merchant</span>
              <strong>{selectedScan.supplierName || "—"}</strong>
            </div>
            <div className="db-receipt-review-row">
              <span className="db-field-label">Date</span>
              <strong>{selectedScan.issueDate || "—"}</strong>
            </div>
            <div className="db-receipt-review-row">
              <span className="db-field-label">Total</span>
              <strong>{selectedScan.total != null ? formatMoney(selectedScan.total, currency) : "—"}</strong>
            </div>
            <div className="db-receipt-review-row">
              <span className="db-field-label">VAT</span>
              <strong>{selectedScan.vatAmount != null ? formatMoney(selectedScan.vatAmount, currency) : "—"}</strong>
            </div>
            <div className="db-receipt-review-row">
              <span className="db-field-label">Invoice #</span>
              <strong>{selectedScan.invoiceNumber || "—"}</strong>
            </div>
            <div className="db-receipt-review-row">
              <span className="db-field-label">Category</span>
              <strong>{selectedCategory}</strong>
            </div>
          </div>

          {extracting && (
            <div className="db-receipt-extracting">
              <Loader2 className="size-5 animate-spin text-[#0978e1]" />
              <span>Extracting receipt details…</span>
            </div>
          )}

          <div className="db-receipt-review-actions">
            <button
              type="button"
              className="db-primary-btn"
              onClick={saveReceipt}
              disabled={isBusy || selectedScan.status === "extracting"}
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Receipt className="size-4" />}
              {saving ? "Saving…" : "Save to ledger"}
            </button>
            <button
              type="button"
              className="db-ghost-btn"
              onClick={() => setSelectedScanId(null)}
              disabled={isBusy}
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* ── Recent receipts table ── */}
      <div className="db-card">
        <div className="db-panel-header">
          <div>
            <p className="db-panel-kicker">History</p>
            <h2>Recent receipts</h2>
          </div>
          <span className="db-panel-meta">{receiptPurchases.length}</span>
        </div>
        <div className="db-table-wrap">
          <table className="db-table">
            <thead>
              <tr>
                <th>Merchant</th>
                <th>Date</th>
                <th>Category</th>
                <th>VAT</th>
                <th style={{ textAlign: "right" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {receiptPurchases.map(({ purchase }) => (
                <tr key={purchase._id}>
                  <td><span className="db-inv-num">{purchase.supplierName || "—"}</span></td>
                  <td>{purchase.issueDate || "—"}</td>
                  <td>
                    <span className="db-receipt-cat-pill" style={{ fontSize: "0.75rem", padding: "3px 10px" }}>
                      {selectedCategory}
                    </span>
                  </td>
                  <td>{purchase.vatAmount != null ? formatMoney(purchase.vatAmount, currency) : "—"}</td>
                  <td style={{ textAlign: "right" }}>{formatMoney(purchase.total, currency)}</td>
                </tr>
              ))}
              {receiptPurchases.length === 0 && (
                <tr>
                  <td colSpan={5} className="db-table-empty">No receipts captured yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── VAT summary strip ── */}
      <div className="db-receipt-vat-strip">
        <div className="db-receipt-vat-cell">
          <span>Total expenses</span>
          <strong>
            {formatMoney(receiptPurchases.reduce((s, { purchase }) => s + (purchase.total ?? 0), 0), currency)}
          </strong>
        </div>
        <div className="db-receipt-vat-cell">
          <span>VAT input claimed</span>
          <strong className="text-[#006545]">
            {formatMoney(receiptPurchases.reduce((s, { purchase }) => s + (purchase.vatAmount ?? 0), 0), currency)}
          </strong>
        </div>
        <div className="db-receipt-vat-cell">
          <span>Receipts this month</span>
          <strong>{receiptPurchases.length}</strong>
        </div>
      </div>
    </div>
  );
}
