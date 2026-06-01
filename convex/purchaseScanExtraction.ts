"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import { internal } from "./_generated/api";
import { action } from "./_generated/server";

function clean(value: string | undefined, fallback = "") {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function fileSizeLabel(bytes: number | undefined) {
  if (!bytes || !Number.isFinite(bytes)) {
    return "unknown";
  }

  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
}

function desertWebhookUrl() {
  return (
    process.env.PAYVIO_SCAN_DESERT_WEBHOOK_URL ??
    process.env.DESERT_SCAN_WEBHOOK_URL
  );
}

async function sendDesertScan(args: {
  webhookUrl: string;
  fileUrl: string;
  scan: {
    _id: string;
    fileName?: string;
    fileType?: string;
    fileSize?: number;
  };
  organizationName: string;
  organizationAddress: string;
  organizationVatNumber: string;
  defaultCurrency: string;
}) {
  const response = await fetch(args.webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: "New Payvio scan needs review.",
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
            {
              name: "Buyer details",
              value: [
                clean(args.organizationAddress, "Address not set"),
                clean(args.organizationVatNumber, "VAT number not set"),
              ].join("\n"),
              inline: false,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body.slice(0, 300) || `Desert webhook failed with ${response.status}`);
  }
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

    const webhookUrl = desertWebhookUrl();
    const provider = webhookUrl ? "desert" : "manual";

    await ctx.runMutation(internal.purchases.internalMarkScanExtractionStarted, {
      id: args.id,
      provider,
    });

    try {
      if (webhookUrl) {
        await sendDesertScan({
          webhookUrl,
          fileUrl,
          scan: scanContext.scan,
          organizationName: scanContext.organizationName,
          organizationAddress: scanContext.organizationAddress,
          organizationVatNumber: scanContext.organizationVatNumber,
          defaultCurrency: scanContext.defaultCurrency,
        });
      }

      await ctx.runMutation(internal.purchases.internalApplyScanExtraction, {
        id: args.id,
        provider,
        detectedTaxInvoice: false,
        currency: scanContext.defaultCurrency,
        taxMode: "no_vat",
        notes: webhookUrl ? "Sent to Desert for review." : "Manual review required.",
        lineItems: [],
        message: webhookUrl
          ? "Scan sent to Desert. Complete the fields before saving."
          : "Scan queued for manual review. Complete the fields before saving.",
      });
    } catch (error) {
      await ctx.runMutation(internal.purchases.internalApplyScanExtraction, {
        id: args.id,
        provider: "manual",
        detectedTaxInvoice: false,
        currency: scanContext.defaultCurrency,
        taxMode: "no_vat",
        notes: "Desert handoff failed. Manual review required.",
        lineItems: [],
        message:
          error instanceof Error
            ? `Desert handoff failed: ${error.message}. Review manually.`
            : "Desert handoff failed. Review manually.",
      });
    }

    return args.id;
  },
});
