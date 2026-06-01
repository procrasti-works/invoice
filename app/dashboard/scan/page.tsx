"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { CheckCircle2, Loader2, Paperclip, ScanLine, UploadCloud } from "lucide-react";

import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { usePlan } from "@/lib/plan";
import { LockedPage } from "../_components/DashboardShell";

type PurchaseRow = {
  purchase: Doc<"purchases">;
  supplier: Doc<"suppliers"> | null;
};

function today() {
  return new Date().toISOString().slice(0, 10);
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

export default function ScanPage() {
  const { canAccess } = usePlan();
  const workspace = useQuery(api.invoices.workspace);
  const purchases = useQuery(api.purchases.listPurchases, {}) as PurchaseRow[] | undefined;
  const generateUploadUrl = useMutation(api.purchases.generatePurchaseUploadUrl);
  const createPurchase = useMutation(api.purchases.createPurchase);

  const [supplierName, setSupplierName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [issueDate, setIssueDate] = useState(today);
  const [dueDate, setDueDate] = useState("");
  const [subtotal, setSubtotal] = useState("");
  const [taxMode, setTaxMode] = useState<"no_vat" | "vat_15">("no_vat");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currency = workspace?.defaultCurrency ?? "NAD";
  const parsedSubtotal = Math.max(0, Number(subtotal) || 0);
  const vatAmount = taxMode === "vat_15" ? parsedSubtotal * 0.15 : 0;
  const total = parsedSubtotal + vatAmount;
  const recentPurchases = useMemo(() => (purchases ?? []).slice(0, 6), [purchases]);

  if (!canAccess("scan")) {
    return <LockedPage feature="Scan" requiredPlan="Starter" />;
  }

  async function uploadFile() {
    if (!file) {
      return undefined;
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setNotice(null);
    setError(null);

    try {
      const proofStorageId = await uploadFile();

      await createPurchase({
        supplierName,
        invoiceNumber: invoiceNumber || undefined,
        issueDate,
        dueDate: dueDate || undefined,
        currency,
        subtotal: parsedSubtotal,
        taxMode,
        status: "recorded",
        notes: notes || undefined,
        proofStorageId,
      });

      setSupplierName("");
      setInvoiceNumber("");
      setIssueDate(today());
      setDueDate("");
      setSubtotal("");
      setTaxMode("no_vat");
      setNotes("");
      setFile(null);
      setNotice("Purchase record captured.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to capture purchase record.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="db-page">
      <div className="db-page-header">
        <div>
          <p className="db-page-eyebrow">Supplier invoice capture</p>
          <h1 className="db-page-title">Scan</h1>
        </div>
      </div>

      {notice ? (
        <div className="db-notice mb-5">
          <CheckCircle2 className="size-4" />
          {notice}
        </div>
      ) : null}

      {error ? (
        <div className="db-notice mb-5" style={{ borderColor: "rgb(255 107 129 / 42%)", background: "rgb(255 107 129 / 10%)", color: "#ffb3c0" }}>
          {error}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_330px]">
        <form onSubmit={handleSubmit} className="db-card grid gap-4">
          <p className="db-card-title">
            <ScanLine className="size-4" />
            Capture purchase record
          </p>

          <label className="grid gap-2 text-[13px] font-medium">
            Invoice file
            <div className="grid gap-3 rounded-lg border border-[#e5e7eb] bg-[#fbfbfd] p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-lg border border-[#e5e7eb] bg-white">
                  <UploadCloud className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#111827]">{file ? file.name : "Attach PDF or image"}</p>
                  <p className="text-xs text-[#6b7280]">Stored with the purchase record for later review.</p>
                </div>
              </div>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                className="h-10 rounded-md border border-[#e5e7eb] bg-white px-3 py-2 text-[13px]"
              />
            </div>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2 text-[13px] font-medium">
              Supplier
              <input
                value={supplierName}
                onChange={(event) => setSupplierName(event.target.value)}
                className="h-10 rounded-md border border-[#e5e7eb] bg-white px-3 text-[13px]"
                required
              />
            </label>
            <label className="grid gap-2 text-[13px] font-medium">
              Supplier invoice number
              <input
                value={invoiceNumber}
                onChange={(event) => setInvoiceNumber(event.target.value)}
                className="h-10 rounded-md border border-[#e5e7eb] bg-white px-3 text-[13px]"
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-2 text-[13px] font-medium">
              Issue date
              <input
                type="date"
                value={issueDate}
                onChange={(event) => setIssueDate(event.target.value)}
                className="h-10 rounded-md border border-[#e5e7eb] bg-white px-3 text-[13px]"
              />
            </label>
            <label className="grid gap-2 text-[13px] font-medium">
              Due date
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="h-10 rounded-md border border-[#e5e7eb] bg-white px-3 text-[13px]"
              />
            </label>
            <label className="grid gap-2 text-[13px] font-medium">
              Subtotal
              <input
                inputMode="decimal"
                value={subtotal}
                onChange={(event) => setSubtotal(event.target.value)}
                className="h-10 rounded-md border border-[#e5e7eb] bg-white px-3 text-[13px]"
                required
              />
            </label>
          </div>

          <label className="grid gap-2 text-[13px] font-medium">
            VAT mode
            <select
              value={taxMode}
              onChange={(event) => setTaxMode(event.target.value === "vat_15" ? "vat_15" : "no_vat")}
              className="h-10 rounded-md border border-[#e5e7eb] bg-white px-3 text-[13px]"
            >
              <option value="no_vat">No VAT</option>
              <option value="vat_15">VAT 15%</option>
            </select>
          </label>

          <label className="grid gap-2 text-[13px] font-medium">
            Notes
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="min-h-24 rounded-md border border-[#e5e7eb] bg-white px-3 py-2 text-[13px]"
            />
          </label>

          <button type="submit" disabled={pending} className="db-primary-btn w-max">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
            Capture record
          </button>
        </form>

        <aside className="db-card grid content-start gap-4">
          <p className="db-card-title">Record summary</p>
          <div className="db-info-grid">
            <div className="db-info-row"><span>Currency</span><strong>{currency}</strong></div>
            <div className="db-info-row"><span>Subtotal</span><strong>{formatMoney(parsedSubtotal, currency)}</strong></div>
            <div className="db-info-row"><span>VAT</span><strong>{formatMoney(vatAmount, currency)}</strong></div>
            <div className="db-info-row db-info-row-total"><span>Total</span><strong>{formatMoney(total, currency)}</strong></div>
          </div>
          <p className="text-sm leading-6 text-[#6b7280]">
            This creates a supplier purchase record immediately. OCR can be layered on top later without blocking manual capture.
          </p>
        </aside>
      </div>

      <div className="db-card">
        <p className="db-card-title">Recent captures</p>
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
                  <td><span className="db-inv-num">{purchase.supplierName}</span></td>
                  <td>{purchase.invoiceNumber ?? "-"}</td>
                  <td>{purchase.issueDate}</td>
                  <td><span className="db-status-pill">{purchase.status}</span></td>
                  <td style={{ textAlign: "right" }}>{formatMoney(purchase.total, purchase.currency)}</td>
                </tr>
              ))}
              {recentPurchases.length === 0 ? (
                <tr>
                  <td colSpan={5} className="db-table-empty">No purchase records captured yet</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
