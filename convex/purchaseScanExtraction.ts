"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import { internal } from "./_generated/api";
import { action } from "./_generated/server";

type ExtractedLine = {
  description?: unknown;
  quantity?: unknown;
  unitPrice?: unknown;
  taxMode?: unknown;
};

type ExtractedInvoice = {
  documentLabel?: unknown;
  detectedTaxInvoice?: unknown;
  supplierName?: unknown;
  supplierAddress?: unknown;
  supplierVatNumber?: unknown;
  recipientName?: unknown;
  recipientAddress?: unknown;
  invoiceNumber?: unknown;
  purchaseOrderNumber?: unknown;
  issueDate?: unknown;
  dueDate?: unknown;
  currency?: unknown;
  subtotal?: unknown;
  vatAmount?: unknown;
  total?: unknown;
  taxMode?: unknown;
  confidence?: unknown;
  notes?: unknown;
  rawTextPreview?: unknown;
  lineItems?: unknown;
};

const extractionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    documentLabel: { type: ["string", "null"] },
    detectedTaxInvoice: { type: ["boolean", "null"] },
    supplierName: { type: ["string", "null"] },
    supplierAddress: { type: ["string", "null"] },
    supplierVatNumber: { type: ["string", "null"] },
    recipientName: { type: ["string", "null"] },
    recipientAddress: { type: ["string", "null"] },
    invoiceNumber: { type: ["string", "null"] },
    purchaseOrderNumber: { type: ["string", "null"] },
    issueDate: { type: ["string", "null"] },
    dueDate: { type: ["string", "null"] },
    currency: { type: ["string", "null"] },
    subtotal: { type: ["number", "null"] },
    vatAmount: { type: ["number", "null"] },
    total: { type: ["number", "null"] },
    taxMode: { type: ["string", "null"] },
    confidence: { type: ["number", "null"] },
    notes: { type: ["string", "null"] },
    rawTextPreview: { type: ["string", "null"] },
    lineItems: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          description: { type: ["string", "null"] },
          quantity: { type: ["number", "null"] },
          unitPrice: { type: ["number", "null"] },
          taxMode: { type: ["string", "null"] },
        },
        required: ["description", "quantity", "unitPrice", "taxMode"],
      },
    },
  },
  required: [
    "documentLabel",
    "detectedTaxInvoice",
    "supplierName",
    "supplierAddress",
    "supplierVatNumber",
    "recipientName",
    "recipientAddress",
    "invoiceNumber",
    "purchaseOrderNumber",
    "issueDate",
    "dueDate",
    "currency",
    "subtotal",
    "vatAmount",
    "total",
    "taxMode",
    "confidence",
    "notes",
    "rawTextPreview",
    "lineItems",
  ],
};

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function boolValue(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function normalizeTaxMode(value: unknown, vatAmount?: number) {
  const text = stringValue(value)?.toLowerCase().replace(/[\s-]+/g, "_");

  if (text === "vat_15" || text === "15" || text === "standard" || text === "standard_rate") {
    return "vat_15" as const;
  }
  if (text === "zero_rated" || text === "zero" || text === "0") {
    return "zero_rated" as const;
  }
  if (text === "exempt") {
    return "exempt" as const;
  }

  return (vatAmount ?? 0) > 0 ? ("vat_15" as const) : ("no_vat" as const);
}

function normalizeCurrency(value: unknown, fallback: string) {
  const currency = stringValue(value)?.toUpperCase() ?? fallback;
  return /^[A-Z]{3}$/.test(currency) ? currency : fallback;
}

function normalizeDate(value: unknown) {
  const text = stringValue(value);

  if (!text) {
    return undefined;
  }

  const iso = text.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  return iso ?? text;
}

function normalizeLines(value: unknown, fallbackTaxMode: "no_vat" | "vat_15" | "zero_rated" | "exempt") {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .slice(0, 50)
    .map((item) => {
      const line = item as ExtractedLine;
      return {
        description: stringValue(line.description) ?? "Supplier invoice item",
        quantity: numberValue(line.quantity) ?? 1,
        unitPrice: numberValue(line.unitPrice) ?? 0,
        taxMode: normalizeTaxMode(line.taxMode, fallbackTaxMode === "vat_15" ? 1 : 0),
      };
    })
    .filter((line) => line.description || line.unitPrice > 0);
}

function outputText(response: unknown) {
  const body = response as {
    output_text?: unknown;
    output?: Array<{ content?: Array<{ text?: unknown; type?: unknown }> }>;
  };

  if (typeof body.output_text === "string") {
    return body.output_text;
  }

  return (body.output ?? [])
    .flatMap((item) => item.content ?? [])
    .map((content) => (typeof content.text === "string" ? content.text : ""))
    .join("")
    .trim();
}

async function extractWithOpenAI(args: {
  fileUrl: string;
  fileType?: string;
  fileName?: string;
  defaultCurrency: string;
  organizationName: string;
  organizationAddress: string;
  organizationVatNumber: string;
}) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return null;
  }

  const isImage = args.fileType?.startsWith("image/");
  const filePart = isImage
    ? {
        type: "input_image",
        image_url: args.fileUrl,
      }
    : {
        type: "input_file",
        file_url: args.fileUrl,
      };
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_SCAN_MODEL ?? "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content:
            "Extract supplier invoice data for a Namibian purchase ledger. Return only fields supported by the schema. Prefer ISO dates, NAD/ZAR/USD currency codes, VAT 15% where shown, and null for missing values.",
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                "Extract this supplier invoice or receipt for review before posting.",
                `Buyer workspace: ${args.organizationName}`,
                `Buyer address: ${args.organizationAddress || "unknown"}`,
                `Buyer VAT number: ${args.organizationVatNumber || "unknown"}`,
                `Default currency: ${args.defaultCurrency}`,
                "Namibian VAT tax invoice checks: Tax Invoice wording, supplier name/address/VAT number, recipient name/address for invoices over N$500, unique invoice number, issue date, descriptions, quantities, VAT amount, and VAT-inclusive total.",
              ].join("\n"),
            },
            filePart,
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "purchase_invoice_extraction",
          strict: true,
          schema: extractionSchema,
        },
      },
      max_output_tokens: 2500,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text.slice(0, 500) || "OpenAI extraction request failed.");
  }

  const json = await response.json();
  const text = outputText(json);

  if (!text) {
    throw new Error("OpenAI returned an empty extraction response.");
  }

  return JSON.parse(text) as ExtractedInvoice;
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

    if (!process.env.OPENAI_API_KEY) {
      await ctx.runMutation(internal.purchases.internalApplyScanExtraction, {
        id: args.id,
        provider: "none",
        detectedTaxInvoice: false,
        currency: scanContext.defaultCurrency,
        taxMode: "no_vat",
        lineItems: [],
        message: "AI extraction is not configured. Review this scan manually.",
      });
      return args.id;
    }

    await ctx.runMutation(internal.purchases.internalMarkScanExtractionStarted, {
      id: args.id,
      provider: "openai",
    });

    try {
      const extracted = await extractWithOpenAI({
        fileUrl,
        fileType: scanContext.scan.fileType,
        fileName: scanContext.scan.fileName,
        defaultCurrency: scanContext.defaultCurrency,
        organizationName: scanContext.organizationName,
        organizationAddress: scanContext.organizationAddress,
        organizationVatNumber: scanContext.organizationVatNumber,
      });

      if (!extracted) {
        throw new Error("AI extraction is not configured.");
      }

      const vatAmount = numberValue(extracted.vatAmount);
      const taxMode = normalizeTaxMode(extracted.taxMode, vatAmount);
      const lineItems = normalizeLines(extracted.lineItems, taxMode);
      const fallbackSubtotal = numberValue(extracted.subtotal);

      await ctx.runMutation(internal.purchases.internalApplyScanExtraction, {
        id: args.id,
        provider: "openai",
        detectedTaxInvoice:
          boolValue(extracted.detectedTaxInvoice) ??
          stringValue(extracted.documentLabel)?.toLowerCase().includes("tax invoice") ??
          false,
        supplierName: stringValue(extracted.supplierName),
        supplierAddress: stringValue(extracted.supplierAddress),
        supplierVatNumber: stringValue(extracted.supplierVatNumber),
        recipientName: stringValue(extracted.recipientName),
        recipientAddress: stringValue(extracted.recipientAddress),
        invoiceNumber: stringValue(extracted.invoiceNumber),
        purchaseOrderNumber: stringValue(extracted.purchaseOrderNumber),
        issueDate: normalizeDate(extracted.issueDate),
        dueDate: normalizeDate(extracted.dueDate),
        currency: normalizeCurrency(extracted.currency, scanContext.defaultCurrency),
        subtotal: fallbackSubtotal,
        vatAmount,
        total: numberValue(extracted.total),
        taxMode,
        confidence: numberValue(extracted.confidence),
        notes: stringValue(extracted.notes),
        rawTextPreview: stringValue(extracted.rawTextPreview),
        lineItems:
          lineItems.length > 0
            ? lineItems
            : fallbackSubtotal
              ? [{ description: "Supplier invoice", quantity: 1, unitPrice: fallbackSubtotal, taxMode }]
              : [],
        message: "AI extraction completed. Review the fields before saving.",
      });
    } catch (error) {
      await ctx.runMutation(internal.purchases.internalMarkScanExtractionFailed, {
        id: args.id,
        provider: "openai",
        message:
          error instanceof Error
            ? `AI extraction failed: ${error.message}`
            : "AI extraction failed. Review manually.",
      });
    }

    return args.id;
  },
});
