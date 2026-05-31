"use client";

/*
 * ============================================================
 * SCAN INVOICE — BACKEND INTEGRATION GUIDE (FOR ANDREAS)
 * ============================================================
 *
 * This page handles the frontend for scanning paper invoices.
 * You need to wire up ONE API endpoint that receives images,
 * runs OCR, and returns structured invoice data.
 *
 * RECOMMENDED: Tesseract.js (100% FREE, no API key needed)
 * ------------------------------------------------------------
 * Install: npm install tesseract.js
 *
 * Create a Next.js API route at: app/api/scan-invoice/route.ts
 *
 * The endpoint should:
 * 1. Receive a multipart form POST with one or more image files
 * 2. For each image, run Tesseract OCR to extract raw text
 * 3. Parse the raw text to find: client name, invoice number,
 *    date, line items, amounts, VAT, total
 * 4. Return structured JSON — see ScanResult type below
 * 5. IMMEDIATELY delete the image from memory after extraction
 *    (never write images to disk or database)
 *
 * TESSERACT EXAMPLE (server side):
 * ------------------------------------------------------------
 * import Tesseract from 'tesseract.js';
 *
 * const { data: { text } } = await Tesseract.recognize(imageBuffer, 'eng');
 * // Then parse `text` with regex or an LLM to extract fields
 *
 * ALTERNATIVE: If Tesseract accuracy is low on handwritten invoices,
 * use Google Cloud Vision API (free up to 1,000 images/month):
 * https://cloud.google.com/vision/docs/ocr
 * API key goes in: GOOGLE_VISION_API_KEY (env variable)
 *
 * ENDPOINT URL THIS PAGE CALLS: POST /api/scan-invoice
 *
 * EXPECTED RESPONSE FORMAT:
 * {
 *   results: [
 *     {
 *       fileName: "invoice1.jpg",
 *       success: true,
 *       data: {
 *         clientName: string,
 *         clientEmail: string,
 *         invoiceNumber: string,
 *         issueDate: string,       // YYYY-MM-DD
 *         dueDate: string,         // YYYY-MM-DD
 *         lineItems: [{ description: string, quantity: number, unitPrice: number }],
 *         subtotal: number,
 *         vatAmount: number,       // 15% of subtotal
 *         total: number,
 *         currency: string,        // e.g. "NAD"
 *         notes: string,
 *       }
 *     }
 *   ]
 * }
 * ============================================================
 */

import { useState, useRef } from "react";
import { ScanLine, Upload, X, CheckCircle2, AlertCircle, FileText, Loader2, Trash2 } from "lucide-react";
import { usePlan } from "@/lib/plan";
import { LockedPage } from "../_components/DashboardShell";

type ScanResult = {
  fileName: string;
  success: boolean;
  data?: {
    clientName: string;
    clientEmail: string;
    invoiceNumber: string;
    issueDate: string;
    dueDate: string;
    lineItems: { description: string; quantity: number; unitPrice: number }[];
    subtotal: number;
    vatAmount: number;
    total: number;
    currency: string;
    notes: string;
  };
  error?: string;
};

type UploadedFile = {
  file: File;
  preview: string;
  status: "pending" | "scanning" | "done" | "error";
  result?: ScanResult;
};

export default function ScanInvoicePage() {
  const { canAccess } = usePlan();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [scanning, setScanning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!canAccess("ledger")) return <LockedPage feature="Scan Invoice" requiredPlan="Business" />;

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    const imageFiles = selected.filter((f) => f.type.startsWith("image/"));
    const newFiles: UploadedFile[] = imageFiles.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      status: "pending",
    }));
    setFiles((prev) => [...prev, ...newFiles]);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
    const newFiles: UploadedFile[] = dropped.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      status: "pending",
    }));
    setFiles((prev) => [...prev, ...newFiles]);
  }

  function removeFile(index: number) {
    setFiles((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function handleScan() {
    const pending = files.filter((f) => f.status === "pending");
    if (pending.length === 0) return;

    setScanning(true);
    setNotice(null);

    const formData = new FormData();
    pending.forEach((f) => formData.append("images", f.file));

    // Mark all pending as scanning
    setFiles((prev) => prev.map((f) => f.status === "pending" ? { ...f, status: "scanning" } : f));

    try {
      const res = await fetch("/api/scan-invoice", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Extraction failed. Please try again.");

      const { results }: { results: ScanResult[] } = await res.json();

      setFiles((prev) =>
        prev.map((f) => {
          const result = results.find((r) => r.fileName === f.file.name);
          if (!result) return f;
          // Revoke preview URL — image no longer needed on client
          URL.revokeObjectURL(f.preview);
          return { ...f, preview: "", status: result.success ? "done" : "error", result };
        })
      );

      const successCount = results.filter((r) => r.success).length;
      setNotice(`${successCount} of ${results.length} invoice${results.length !== 1 ? "s" : ""} extracted successfully. Images deleted from memory.`);
    } catch (err) {
      setFiles((prev) => prev.map((f) => f.status === "scanning" ? { ...f, status: "error" } : f));
      setNotice(err instanceof Error ? err.message : "Extraction failed.");
    } finally {
      setScanning(false);
    }
  }

  function clearAll() {
    files.forEach((f) => f.preview && URL.revokeObjectURL(f.preview));
    setFiles([]);
    setNotice(null);
  }

  const hasPending = files.some((f) => f.status === "pending");
  const hasResults = files.some((f) => f.status === "done");

  return (
    <div className="db-page">
      <div className="db-page-header">
        <div>
          <p className="db-page-eyebrow">Import paper records</p>
          <h1 className="db-page-title">Scan Paper Invoices</h1>
        </div>
      </div>

      {/* Info banner */}
      <div className="db-compliance-banner" style={{ background: "#eff6ff", borderColor: "#bfdbfe" }}>
        <ScanLine className="size-5 text-[#1a6fc4]" />
        <div>
          <p className="db-compliance-title" style={{ color: "#1a6fc4" }}>How it works</p>
          <p className="db-compliance-sub">Take photos of your paper invoices and upload them here. We extract the invoice data automatically — client name, amounts, dates, VAT — and save it as a proper digital record. Images are immediately deleted after extraction and never stored on our servers.</p>
        </div>
        <span className="db-compliance-badge" style={{ background: "#1a6fc4" }}>Privacy Safe</span>
      </div>

      {notice && (
        <div className="db-notice" style={{ marginBottom: "20px" }}>
          <CheckCircle2 className="size-4" /> {notice}
        </div>
      )}

      {/* Upload zone */}
      <div className="db-card">
        <div
          className="scan-dropzone"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="size-8 text-[#9ca3af]" />
          <p className="scan-dropzone-title">Drop invoice photos here or click to browse</p>
          <p className="scan-dropzone-sub">JPG, PNG, HEIC supported · Scan as many as you want at once</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>

        {files.length > 0 && (
          <>
            <div className="scan-file-grid">
              {files.map((f, i) => (
                <div key={i} className={`scan-file-card scan-file-${f.status}`}>
                  {f.preview ? (
                    <img src={f.preview} alt={f.file.name} className="scan-file-img" />
                  ) : (
                    <div className="scan-file-img-placeholder">
                      <FileText className="size-6 text-[#9ca3af]" />
                    </div>
                  )}
                  <div className="scan-file-info">
                    <p className="scan-file-name">{f.file.name}</p>
                    <p className="scan-file-status">
                      {f.status === "pending" && "Ready to scan"}
                      {f.status === "scanning" && <span className="scan-scanning"><Loader2 className="size-3 animate-spin" /> Extracting...</span>}
                      {f.status === "done" && <span className="scan-done"><CheckCircle2 className="size-3" /> Extracted</span>}
                      {f.status === "error" && <span className="scan-error"><AlertCircle className="size-3" /> Failed</span>}
                    </p>
                  </div>
                  {f.status === "pending" && (
                    <button className="scan-file-remove" onClick={(e) => { e.stopPropagation(); removeFile(i); }}>
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "20px", alignItems: "center" }}>
              {hasPending && (
                <button className="db-primary-btn" onClick={handleScan} disabled={scanning}>
                  {scanning ? <Loader2 className="size-4 animate-spin" /> : <ScanLine className="size-4" />}
                  {scanning ? "Scanning..." : `Scan ${files.filter((f) => f.status === "pending").length} invoice${files.filter((f) => f.status === "pending").length !== 1 ? "s" : ""}`}
                </button>
              )}
              <button className="db-outline-btn" onClick={clearAll} disabled={scanning}>
                <Trash2 className="size-4" /> Clear all
              </button>
            </div>
          </>
        )}
      </div>

      {/* Extracted results */}
      {hasResults && (
        <div className="db-card">
          <p className="db-card-title"><CheckCircle2 className="size-4 text-[#16a34a]" /> Extracted Invoice Data</p>
          <p style={{ fontSize: "0.85rem", color: "#6b7280", marginBottom: "20px" }}>
            Review the extracted information below. Click "Save to Ledger" to add each invoice as a permanent digital record.
          </p>
          {files.filter((f) => f.status === "done" && f.result?.data).map((f, i) => {
            const d = f.result!.data!;
            return (
              <div key={i} className="scan-result-card">
                <div className="scan-result-header">
                  <p className="scan-result-title">{f.file.name}</p>
                  <span className="scan-result-badge">Extracted</span>
                </div>
                <div className="db-info-grid" style={{ marginBottom: "14px" }}>
                  <div className="db-info-row"><span>Client</span><strong>{d.clientName || "—"}</strong></div>
                  <div className="db-info-row"><span>Invoice #</span><strong>{d.invoiceNumber || "—"}</strong></div>
                  <div className="db-info-row"><span>Issue Date</span><strong>{d.issueDate || "—"}</strong></div>
                  <div className="db-info-row"><span>Due Date</span><strong>{d.dueDate || "—"}</strong></div>
                  <div className="db-info-row"><span>Subtotal (excl. VAT)</span><strong>{d.currency} {d.subtotal?.toFixed(2) ?? "—"}</strong></div>
                  <div className="db-info-row"><span>VAT (15%)</span><strong>{d.currency} {d.vatAmount?.toFixed(2) ?? "—"}</strong></div>
                  <div className="db-info-row db-info-row-total"><span>Total (incl. VAT)</span><strong>{d.currency} {d.total?.toFixed(2) ?? "—"}</strong></div>
                </div>
                <button className="db-primary-btn" style={{ background: "#009b68" }}>
                  <FileText className="size-4" /> Save to Ledger
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
