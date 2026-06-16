"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import { internal } from "./_generated/api";
import { action } from "./_generated/server";

/**
 * Receipt / supplier-invoice OCR.
 *
 * Pipeline (best → fallback):
 *   1. Claude vision  — reads the photo/PDF, returns structured fields. (default)
 *   2. Tesseract      — free local OCR fallback if no API key / Claude fails.
 *   3. Manual         — last resort: queue for manual review (+ optional Desert ping).
 *
 * Required env (set on the Convex deployment, not just .env.local):
 *   npx convex env set ANTHROPIC_API_KEY sk-ant-...
 * Optional:
 *   PAYVIO_SCAN_MODEL                 (default: claude-haiku-4-5-20251001)
 *   PAYVIO_SCAN_DESERT_WEBHOOK_URL    (Discord-style manual-review notification)
 */

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
const IMAGE_MEDIA_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

type ExtractedLine = {
  description: string;
  quantity: number;
  unitPrice: number;
};

type ExtractionFields = {
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
  subtotal: number;
  vatAmount: number;
  total: number;
  hasVat: boolean;
  lineItems: ExtractedLine[];
  confidence: number;
  rawTextPreview: string;
};

function clean(value: string | undefined, fallback = "") {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function num(value: unknown): number {
  const n = typeof value === "string" ? parseFloat(value.replace(/[^0-9.\-]/g, "")) : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function fileSizeLabel(bytes: number | undefined) {
  if (!bytes || !Number.isFinite(bytes)) return "unknown";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
}

function desertWebhookUrl() {
  return (
    process.env.PAYVIO_SCAN_DESERT_WEBHOOK_URL ??
    process.env.DESERT_SCAN_WEBHOOK_URL
  );
}

/** Download the uploaded file and return base64 + a usable media type. */
async function fetchFileAsBase64(
  fileUrl: string,
  declaredType: string | undefined,
): Promise<{ base64: string; mediaType: string; bytes: number }> {
  const res = await fetch(fileUrl);
  if (!res.ok) {
    throw new Error(`Could not download scan (${res.status}).`);
  }
  const headerType = res.headers.get("content-type")?.split(";")[0]?.trim();
  const mediaType = clean(declaredType) || headerType || "application/octet-stream";
  const buffer = Buffer.from(await res.arrayBuffer());
  return { base64: buffer.toString("base64"), mediaType, bytes: buffer.byteLength };
}

const EXTRACTION_PROMPT = `You are an OCR + extraction engine for a Namibian invoicing app (Payvio).
Read this supplier invoice / receipt and return ONLY a JSON object — no prose, no markdown fences.

Context: Namibia. Default currency NAD. VAT rate is 15%. A valid "tax invoice" shows the
supplier's VAT registration number and the words "Tax Invoice".

Return exactly this shape (use "" for unknown strings, 0 for unknown numbers):
{
  "supplierName": string,
  "supplierAddress": string,
  "supplierVatNumber": string,
  "recipientName": string,
  "recipientAddress": string,
  "invoiceNumber": string,
  "purchaseOrderNumber": string,
  "issueDate": "YYYY-MM-DD",
  "dueDate": "YYYY-MM-DD",
  "currency": "NAD"|"ZAR"|"USD",
  "hasVat": boolean,
  "subtotal": number,
  "vatAmount": number,
  "total": number,
  "lineItems": [{ "description": string, "quantity": number, "unitPrice": number }],
  "confidence": number  // 0..1, how sure you are overall
}
Rules:
- Dates as ISO YYYY-MM-DD. If only one date is present, use it as issueDate.
- Numbers are plain (no currency symbols, no thousands separators).
- If you cannot read the document at all, return the shape with empty/zero values and confidence 0.`;

function normalizeFields(raw: Record<string, unknown>, defaultCurrency: string): ExtractionFields {
  const lineItems: ExtractedLine[] = Array.isArray(raw.lineItems)
    ? (raw.lineItems as Record<string, unknown>[])
        .map((l) => ({
          description: clean(String(l.description ?? "")),
          quantity: num(l.quantity) || 1,
          unitPrice: num(l.unitPrice),
        }))
        .filter((l) => l.description.length > 0)
    : [];

  const currencyRaw = clean(String(raw.currency ?? ""), defaultCurrency).toUpperCase();
  const currency = /^[A-Z]{3}$/.test(currencyRaw) ? currencyRaw : defaultCurrency;
  const hasVat = Boolean(raw.hasVat) || num(raw.vatAmount) > 0;

  return {
    detectedTaxInvoice: hasVat && clean(String(raw.supplierVatNumber ?? "")).length > 0,
    supplierName: clean(String(raw.supplierName ?? "")),
    supplierAddress: clean(String(raw.supplierAddress ?? "")),
    supplierVatNumber: clean(String(raw.supplierVatNumber ?? "")),
    recipientName: clean(String(raw.recipientName ?? "")),
    recipientAddress: clean(String(raw.recipientAddress ?? "")),
    invoiceNumber: clean(String(raw.invoiceNumber ?? "")),
    purchaseOrderNumber: clean(String(raw.purchaseOrderNumber ?? "")),
    issueDate: clean(String(raw.issueDate ?? "")),
    dueDate: clean(String(raw.dueDate ?? "")),
    currency,
    subtotal: num(raw.subtotal),
    vatAmount: num(raw.vatAmount),
    total: num(raw.total),
    hasVat,
    lineItems,
    confidence: Math.min(1, Math.max(0, num(raw.confidence))),
    rawTextPreview: "",
  };
}

/** Primary engine: Claude vision via the Messages API (raw fetch, no SDK). */
async function extractWithClaude(
  base64: string,
  mediaType: string,
  defaultCurrency: string,
): Promise<ExtractionFields> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const isPdf = mediaType === "application/pdf";
  const isImage = IMAGE_MEDIA_TYPES.has(mediaType);
  if (!isPdf && !isImage) {
    throw new Error(`Unsupported file type for vision: ${mediaType}`);
  }

  const source = isPdf
    ? { type: "base64", media_type: "application/pdf", data: base64 }
    : { type: "base64", media_type: mediaType, data: base64 };
  const block = isPdf
    ? { type: "document", source }
    : { type: "image", source };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.PAYVIO_SCAN_MODEL ?? DEFAULT_MODEL,
      max_tokens: 1500,
      messages: [
        { role: "user", content: [block, { type: "text", text: EXTRACTION_PROMPT }] },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Claude vision failed (${res.status}): ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = (data.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Claude returned no JSON");

  const fields = normalizeFields(JSON.parse(match[0]) as Record<string, unknown>, defaultCurrency);
  fields.rawTextPreview = text.slice(0, 500);
  return fields;
}

/** Fallback engine: Tesseract OCR (free). Best-effort; images only. */
async function extractWithTesseract(
  base64: string,
  mediaType: string,
  defaultCurrency: string,
): Promise<ExtractionFields> {
  if (!IMAGE_MEDIA_TYPES.has(mediaType)) {
    throw new Error("Tesseract supports images only");
  }
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    const { data } = await worker.recognize(Buffer.from(base64, "base64"));
    const rawText: string = data.text ?? "";

    // Light heuristic parse — Tesseract gives raw text, so we grab what we can
    // and leave the rest for manual review.
    const totalMatch = rawText.match(/total[^0-9]{0,12}([0-9][0-9.,]+)/i);
    const invMatch = rawText.match(/(?:invoice|inv|tax invoice)[^A-Za-z0-9]{0,6}#?\s*([A-Za-z0-9\-\/]+)/i);
    const vatMatch = rawText.match(/vat[^0-9]{0,12}([0-9][0-9.,]+)/i);
    const hasVat = /vat/i.test(rawText);

    return {
      detectedTaxInvoice: /tax invoice/i.test(rawText),
      supplierName: "",
      supplierAddress: "",
      supplierVatNumber: "",
      recipientName: "",
      recipientAddress: "",
      invoiceNumber: clean(invMatch?.[1]),
      purchaseOrderNumber: "",
      issueDate: "",
      dueDate: "",
      currency: defaultCurrency,
      subtotal: 0,
      vatAmount: vatMatch ? num(vatMatch[1]) : 0,
      total: totalMatch ? num(totalMatch[1]) : 0,
      hasVat,
      lineItems: [],
      confidence: rawText.trim().length > 20 ? 0.3 : 0,
      rawTextPreview: rawText.slice(0, 500),
    };
  } finally {
    await worker.terminate();
  }
}

/** Optional: ping a Discord-style channel that a scan landed (manual review). */
async function notifyDesert(args: {
  webhookUrl: string;
  fileUrl: string;
  scan: { _id: string; fileName?: string; fileType?: string; fileSize?: number };
  organizationName: string;
  defaultCurrency: string;
}) {
  await fetch(args.webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: "New Payvio scan needs manual review.",
      allowed_mentions: { parse: [] },
      embeds: [
        {
          title: clean(args.scan.fileName, "Supplier invoice scan"),
          url: args.fileUrl,
          color: 0x1a6fc4,
          fields: [
            { name: "Workspace", value: clean(args.organizationName, "-"), inline: true },
            { name: "Currency", value: clean(args.defaultCurrency, "NAD"), inline: true },
            { name: "File type", value: clean(args.scan.fileType, "unknown"), inline: true },
            { name: "File size", value: fileSizeLabel(args.scan.fileSize), inline: true },
            { name: "Scan ID", value: args.scan._id, inline: false },
          ],
        },
      ],
    }),
  }).catch(() => {
    /* notification is best-effort; never block extraction on it */
  });
}

export const extractPurchaseScan = action({
  args: {
    id: v.id("purchaseScans"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Authentication required");
    }

    const scanContext = await ctx.runQuery(internal.purchases.internalGetScanForExtraction, {
      id: args.id,
    });
    const fileUrl = await ctx.storage.getUrl(scanContext.scan.storageId);
    if (!fileUrl) {
      throw new Error("Uploaded file is no longer available.");
    }

    await ctx.runMutation(internal.purchases.internalMarkScanExtractionStarted, {
      id: args.id,
      provider: "claude",
    });

    const defaultCurrency = scanContext.defaultCurrency || "NAD";

    let fields: ExtractionFields | null = null;
    let provider: "claude" | "tesseract" | "manual" = "manual";
    const errors: string[] = [];

    let download: { base64: string; mediaType: string; bytes: number } | null = null;
    try {
      download = await fetchFileAsBase64(fileUrl, scanContext.scan.fileType);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "download failed");
    }

    // 1. Claude vision (primary)
    if (download && process.env.ANTHROPIC_API_KEY) {
      try {
        fields = await extractWithClaude(download.base64, download.mediaType, defaultCurrency);
        provider = "claude";
      } catch (error) {
        errors.push(error instanceof Error ? error.message : "Claude failed");
      }
    }

    // 2. Tesseract (free fallback)
    if (!fields && download) {
      try {
        fields = await extractWithTesseract(download.base64, download.mediaType, defaultCurrency);
        provider = "tesseract";
      } catch (error) {
        errors.push(error instanceof Error ? error.message : "Tesseract failed");
      }
    }

    // Optional manual-review notification.
    const webhookUrl = desertWebhookUrl();
    if (webhookUrl) {
      await notifyDesert({
        webhookUrl,
        fileUrl,
        scan: scanContext.scan,
        organizationName: scanContext.organizationName,
        defaultCurrency,
      });
    }

    // 3. Manual (last resort)
    if (!fields) {
      await ctx.runMutation(internal.purchases.internalApplyScanExtraction, {
        id: args.id,
        provider: "manual",
        detectedTaxInvoice: false,
        currency: defaultCurrency,
        taxMode: "no_vat",
        notes: errors.length ? `Auto-extraction unavailable: ${errors[0]}` : "Manual review required.",
        lineItems: [],
        rawTextPreview: errors.join(" | ").slice(0, 500),
        message: "Could not auto-read this scan. Enter the fields manually before saving.",
      });
      return args.id;
    }

    const taxMode = fields.hasVat ? "vat_15" : "no_vat";

    await ctx.runMutation(internal.purchases.internalApplyScanExtraction, {
      id: args.id,
      provider,
      detectedTaxInvoice: fields.detectedTaxInvoice,
      supplierName: fields.supplierName,
      supplierAddress: fields.supplierAddress,
      supplierVatNumber: fields.supplierVatNumber,
      recipientName: fields.recipientName,
      recipientAddress: fields.recipientAddress,
      invoiceNumber: fields.invoiceNumber,
      purchaseOrderNumber: fields.purchaseOrderNumber,
      issueDate: fields.issueDate,
      dueDate: fields.dueDate,
      currency: fields.currency,
      subtotal: fields.subtotal,
      vatAmount: fields.vatAmount,
      total: fields.total,
      taxMode,
      confidence: fields.confidence,
      rawTextPreview: fields.rawTextPreview,
      lineItems: fields.lineItems.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
      })),
      notes: provider === "tesseract"
        ? "Read with Tesseract (free OCR) — please double-check every field."
        : "",
      message:
        provider === "claude"
          ? `Read with Claude vision (confidence ${(fields.confidence * 100).toFixed(0)}%). Review before saving.`
          : "Read with Tesseract. Review carefully before saving.",
    });

    return args.id;
  },
});
