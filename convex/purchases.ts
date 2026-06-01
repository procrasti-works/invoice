import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import {
  getExistingOrganization,
  getOrganizationForUser,
  requireOrganizationPermission,
} from "./organizationContext";
import type { PermissionKey } from "./organizationPermissions";

const taxModeValidator = v.union(
  v.literal("no_vat"),
  v.literal("vat_15"),
  v.literal("zero_rated"),
  v.literal("exempt"),
);

const purchaseStatusValidator = v.union(
  v.literal("draft"),
  v.literal("recorded"),
  v.literal("paid"),
  v.literal("void"),
);

const purchaseScanStatusValidator = v.union(
  v.literal("uploaded"),
  v.literal("extracting"),
  v.literal("needs_review"),
  v.literal("ready"),
  v.literal("saved"),
  v.literal("failed"),
);

const extractionProviderValidator = v.union(
  v.literal("manual"),
  v.literal("openai"),
  v.literal("none"),
);

const scanLineItemInputValidator = v.object({
  description: v.string(),
  quantity: v.number(),
  unitPrice: v.number(),
  taxMode: v.optional(taxModeValidator),
});

const scanFieldsValidator = {
  detectedTaxInvoice: v.optional(v.boolean()),
  supplierName: v.optional(v.string()),
  supplierAddress: v.optional(v.string()),
  supplierVatNumber: v.optional(v.string()),
  recipientName: v.optional(v.string()),
  recipientAddress: v.optional(v.string()),
  invoiceNumber: v.optional(v.string()),
  purchaseOrderNumber: v.optional(v.string()),
  issueDate: v.optional(v.string()),
  dueDate: v.optional(v.string()),
  currency: v.optional(v.string()),
  subtotal: v.optional(v.number()),
  vatAmount: v.optional(v.number()),
  total: v.optional(v.number()),
  taxMode: v.optional(taxModeValidator),
  confidence: v.optional(v.number()),
  rawTextPreview: v.optional(v.string()),
  notes: v.optional(v.string()),
} as const;

const vatRate = 0.15;
const retentionMs = 1000 * 60 * 60 * 24 * 365 * 5;
const supportedCurrencies = new Set(["NAD", "ZAR", "USD"]);

function clean(value: string | undefined, fallback = "") {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function maybeString(value: string | undefined) {
  const trimmed = clean(value);
  return trimmed ? trimmed : undefined;
}

function money(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.round(value * 100) / 100);
}

function cleanCurrency(value: string | undefined, fallback: string | undefined) {
  const currency = clean(value, fallback ?? "NAD").toUpperCase();

  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error("Currency must be a 3-letter code");
  }

  return currency;
}

function normalizeTaxMode(
  requested: Doc<"purchases">["taxMode"] | undefined,
  organization: Doc<"organizations">,
) {
  if (!organization.vatRegistered) {
    return "no_vat" as const;
  }

  return requested ?? organization.vatDefaultTaxMode ?? "vat_15";
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function quantity(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return 1;
  }

  return Math.round(value * 1000) / 1000;
}

function confidence(value: number | undefined) {
  if (!Number.isFinite(value ?? Number.NaN)) {
    return undefined;
  }

  return Math.max(0, Math.min(1, Math.round((value ?? 0) * 100) / 100));
}

function rawTextPreview(value: string | undefined) {
  const text = clean(value);
  return text ? text.slice(0, 2000) : undefined;
}

function retentionUntil(now = Date.now()) {
  return now + retentionMs;
}

async function requireUserId(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);

  if (userId === null) {
    throw new Error("Authentication required");
  }

  return userId;
}

async function requireOrganization(
  ctx: QueryCtx | MutationCtx,
  permission?: PermissionKey,
) {
  const userId = await requireUserId(ctx);
  const current = permission
    ? await requireOrganizationPermission(ctx, userId, permission)
    : await getOrganizationForUser(ctx, userId);
  const organization = current.organization;

  if (!organization) {
    throw new Error("Organization setup required");
  }

  return { userId, organization };
}

function purchaseTotals(args: {
  subtotal: number;
  vatAmount?: number;
  taxMode?: Doc<"purchases">["taxMode"];
}, organization: Doc<"organizations">) {
  const taxMode = normalizeTaxMode(args.taxMode, organization);
  const subtotal = money(args.subtotal);
  const vatAmount =
    args.vatAmount === undefined
      ? taxMode === "vat_15"
        ? money(subtotal * 0.15)
        : 0
      : money(args.vatAmount);
  const total = money(subtotal + vatAmount);

  return { subtotal, vatAmount, total, taxMode };
}

type PurchaseLineInput = {
  description: string;
  quantity: number;
  unitPrice: number;
  taxMode?: Doc<"purchases">["taxMode"];
};

type CalculatedPurchaseLine = {
  description: string;
  quantity: number;
  unitPrice: number;
  taxMode: Doc<"purchases">["taxMode"];
  vatRate: number;
  vatAmount: number;
  lineSubtotal: number;
  lineTotal: number;
  position: number;
};

function calculatePurchaseLines(
  rawLineItems: PurchaseLineInput[],
  fallbackTaxMode: Doc<"purchases">["taxMode"] = "no_vat",
) {
  const source = rawLineItems.length
    ? rawLineItems
    : [{ description: "Supplier invoice", quantity: 1, unitPrice: 0, taxMode: fallbackTaxMode }];
  const lines: CalculatedPurchaseLine[] = source.slice(0, 50).map((item, index) => {
    const itemTaxMode = item.taxMode ?? fallbackTaxMode;
    const cleanQuantity = quantity(item.quantity);
    const cleanUnitPrice = money(item.unitPrice);
    const lineSubtotal = money(cleanQuantity * cleanUnitPrice);
    const lineVat = itemTaxMode === "vat_15" ? money(lineSubtotal * vatRate) : 0;

    return {
      description: clean(item.description, "Supplier invoice item"),
      quantity: cleanQuantity,
      unitPrice: cleanUnitPrice,
      taxMode: itemTaxMode,
      vatRate: itemTaxMode === "vat_15" ? vatRate : 0,
      vatAmount: lineVat,
      lineSubtotal,
      lineTotal: money(lineSubtotal + lineVat),
      position: index,
    };
  });
  const subtotal = money(lines.reduce((total, line) => total + line.lineSubtotal, 0));
  const vatAmount = money(lines.reduce((total, line) => total + line.vatAmount, 0));
  const total = money(subtotal + vatAmount);

  return { lines, subtotal, vatAmount, total };
}

function draftTotals(args: {
  subtotal?: number;
  vatAmount?: number;
  total?: number;
  taxMode?: Doc<"purchases">["taxMode"];
  lines: CalculatedPurchaseLine[];
}) {
  const lineSubtotal = money(args.lines.reduce((sum, line) => sum + line.lineSubtotal, 0));
  const lineVat = money(args.lines.reduce((sum, line) => sum + line.vatAmount, 0));
  const subtotal = args.subtotal === undefined ? lineSubtotal : money(args.subtotal);
  const vatAmount =
    args.vatAmount === undefined
      ? args.taxMode === "vat_15"
        ? money(subtotal * vatRate)
        : lineVat
      : money(args.vatAmount);
  const total = args.total === undefined ? money(subtotal + vatAmount) : money(args.total);

  return { subtotal, vatAmount, total };
}

function scanWarnings(args: {
  detectedTaxInvoice?: boolean;
  supplierName?: string;
  supplierAddress?: string;
  supplierVatNumber?: string;
  recipientName?: string;
  recipientAddress?: string;
  invoiceNumber?: string;
  issueDate?: string;
  currency?: string;
  subtotal: number;
  vatAmount: number;
  total: number;
  taxMode?: Doc<"purchases">["taxMode"];
  lineItems: CalculatedPurchaseLine[];
  duplicate?: boolean;
}) {
  const warnings: string[] = [];
  const taxMode = args.taxMode ?? "no_vat";
  const currency = clean(args.currency, "NAD").toUpperCase();

  if (!args.detectedTaxInvoice && taxMode === "vat_15") {
    warnings.push("Confirm the document is clearly marked Tax Invoice.");
  }
  if (!maybeString(args.supplierName)) {
    warnings.push("Supplier name is required.");
  }
  if (!maybeString(args.supplierAddress) && taxMode === "vat_15") {
    warnings.push("Supplier address should be present on a VAT tax invoice.");
  }
  if (!maybeString(args.supplierVatNumber) && taxMode === "vat_15") {
    warnings.push("Supplier VAT number is required for input VAT records.");
  }
  if (args.total > 500 && !maybeString(args.recipientName)) {
    warnings.push("Recipient name should be present for invoices over N$500.");
  }
  if (args.total > 500 && !maybeString(args.recipientAddress)) {
    warnings.push("Recipient address should be present for invoices over N$500.");
  }
  if (!maybeString(args.invoiceNumber)) {
    warnings.push("Unique supplier invoice number is required.");
  }
  if (!maybeString(args.issueDate)) {
    warnings.push("Issue date is required.");
  }
  if (!supportedCurrencies.has(currency)) {
    warnings.push("Currency should be reviewed for NAD, ZAR, or USD reporting.");
  }
  if (args.lineItems.length === 0) {
    warnings.push("At least one purchase line item is required.");
  }
  if (Math.abs(args.total - money(args.subtotal + args.vatAmount)) > 0.05) {
    warnings.push("Subtotal plus VAT does not match the invoice total.");
  }
  if (taxMode === "vat_15" && Math.abs(args.vatAmount - money(args.subtotal * vatRate)) > 0.1) {
    warnings.push("VAT amount does not reconcile to 15% of the subtotal.");
  }
  if (args.duplicate) {
    warnings.push("A matching supplier invoice number already exists.");
  }

  return warnings.slice(0, 12);
}

function readyStatus(warnings: string[]): Doc<"purchaseScans">["status"] {
  const blocking = [
    "Supplier name is required.",
    "Unique supplier invoice number is required.",
    "Issue date is required.",
    "At least one purchase line item is required.",
  ];

  return warnings.some((warning) => blocking.includes(warning))
    ? "needs_review"
    : "ready";
}

async function findSupplierByName(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  name: string,
) {
  const matches = await ctx.db
    .query("suppliers")
    .withIndex("by_organizationId_and_name", (q) =>
      q.eq("organizationId", organizationId).eq("name", name),
    )
    .take(1);

  return matches[0] ?? null;
}

async function getOrCreateSupplier(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  name: string,
  details?: {
    address?: string;
    vatNumber?: string;
  },
) {
  const supplierName = clean(name, "Supplier");
  const existing = await findSupplierByName(ctx, organizationId, supplierName);
  const patch = {
    ...(maybeString(details?.address) ? { address: maybeString(details?.address) } : {}),
    ...(maybeString(details?.vatNumber) ? { vatNumber: maybeString(details?.vatNumber) } : {}),
    updatedAt: Date.now(),
  };

  if (existing) {
    if (patch.address || patch.vatNumber) {
      await ctx.db.patch(existing._id, patch);
    }
    return existing._id;
  }

  const now = Date.now();
  return await ctx.db.insert("suppliers", {
    organizationId,
    name: supplierName,
    ...(maybeString(details?.address) ? { address: maybeString(details?.address) } : {}),
    ...(maybeString(details?.vatNumber) ? { vatNumber: maybeString(details?.vatNumber) } : {}),
    active: true,
    createdAt: now,
    updatedAt: now,
  });
}

async function writeScanEvent(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  scanId: Id<"purchaseScans">,
  type: Doc<"purchaseScanEvents">["type"],
  message: string,
  actorUserId?: Id<"users">,
) {
  await ctx.db.insert("purchaseScanEvents", {
    organizationId,
    scanId,
    ...(actorUserId ? { actorUserId } : {}),
    type,
    message,
    createdAt: Date.now(),
  });
}

async function replaceScanLineItems(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  scanId: Id<"purchaseScans">,
  lines: CalculatedPurchaseLine[],
) {
  const existing = await ctx.db
    .query("purchaseScanLineItems")
    .withIndex("by_scanId", (q) => q.eq("scanId", scanId))
    .take(100);

  for (const item of existing) {
    await ctx.db.delete(item._id);
  }

  const now = Date.now();

  for (const line of lines) {
    await ctx.db.insert("purchaseScanLineItems", {
      organizationId,
      scanId,
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      taxMode: line.taxMode,
      vatRate: line.vatRate,
      vatAmount: line.vatAmount,
      lineSubtotal: line.lineSubtotal,
      lineTotal: line.lineTotal,
      position: line.position,
      createdAt: now,
    });
  }
}

async function writePurchaseLineItems(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  purchaseId: Id<"purchases">,
  lines: CalculatedPurchaseLine[],
) {
  const now = Date.now();

  for (const line of lines) {
    await ctx.db.insert("purchaseLineItems", {
      organizationId,
      purchaseId,
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      taxMode: line.taxMode,
      vatRate: line.vatRate,
      vatAmount: line.vatAmount,
      lineSubtotal: line.lineSubtotal,
      lineTotal: line.lineTotal,
      position: line.position,
      createdAt: now,
    });
  }
}

async function duplicatePurchaseInvoice(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  invoiceNumber: string | undefined,
  supplierName: string | undefined,
) {
  const cleanInvoiceNumber = maybeString(invoiceNumber);

  if (!cleanInvoiceNumber) {
    return false;
  }

  const matches = await ctx.db
    .query("purchases")
    .withIndex("by_organizationId_and_invoiceNumber", (q) =>
      q.eq("organizationId", organizationId).eq("invoiceNumber", cleanInvoiceNumber),
    )
    .take(5);
  const cleanSupplierName = clean(supplierName).toLowerCase();

  return matches.some(
    (purchase) =>
      !cleanSupplierName || purchase.supplierName.toLowerCase() === cleanSupplierName,
  );
}

export const listSuppliers = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    if (userId === null) {
      return [];
    }

    const organization = await getExistingOrganization(ctx, userId);

    if (!organization) {
      return [];
    }

    return await ctx.db
      .query("suppliers")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", organization._id))
      .order("desc")
      .take(100);
  },
});

export const upsertSupplier = mutation({
  args: {
    id: v.optional(v.id("suppliers")),
    name: v.string(),
    contactName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    vatNumber: v.optional(v.string()),
    taxId: v.optional(v.string()),
    notes: v.optional(v.string()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { organization } = await requireOrganization(ctx, "managePurchases");
    const now = Date.now();
    const patch = {
      name: clean(args.name, "Supplier"),
      contactName: clean(args.contactName ?? "", ""),
      email: clean(args.email ?? "", "").toLowerCase(),
      phone: clean(args.phone ?? "", ""),
      address: clean(args.address ?? "", ""),
      vatNumber: clean(args.vatNumber ?? "", ""),
      taxId: clean(args.taxId ?? "", ""),
      notes: clean(args.notes ?? "", ""),
      active: args.active ?? true,
      updatedAt: now,
    };

    if (args.id) {
      const supplier = await ctx.db.get(args.id);

      if (!supplier || supplier.organizationId !== organization._id) {
        throw new Error("Supplier not found");
      }

      await ctx.db.patch(supplier._id, patch);
      return supplier._id;
    }

    const existing = await findSupplierByName(ctx, organization._id, patch.name);

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }

    return await ctx.db.insert("suppliers", {
      organizationId: organization._id,
      createdAt: now,
      ...patch,
    });
  },
});

export const listPurchases = query({
  args: {
    status: v.optional(purchaseStatusValidator),
    from: v.optional(v.string()),
    to: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (userId === null) {
      return [];
    }

    const organization = await getExistingOrganization(ctx, userId);

    if (!organization) {
      return [];
    }

    let purchases: Doc<"purchases">[];

    if (args.status) {
      const status = args.status;
      purchases = await ctx.db
        .query("purchases")
        .withIndex("by_organizationId_and_status", (q) =>
          q.eq("organizationId", organization._id).eq("status", status),
        )
        .order("desc")
        .take(150);
    } else if (args.from && args.to) {
      purchases = await ctx.db
        .query("purchases")
        .withIndex("by_organizationId_and_issueDate", (q) =>
          q
            .eq("organizationId", organization._id)
            .gte("issueDate", args.from as string)
            .lte("issueDate", args.to as string),
        )
        .order("desc")
        .take(150);
    } else {
      purchases = await ctx.db
        .query("purchases")
        .withIndex("by_organizationId", (q) =>
          q.eq("organizationId", organization._id),
        )
        .order("desc")
        .take(150);
    }

    return await Promise.all(
      purchases.map(async (purchase) => {
        const supplier = purchase.supplierId
          ? await ctx.db.get(purchase.supplierId)
          : null;
        return { purchase, supplier };
      }),
    );
  },
});

export const generatePurchaseUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireOrganization(ctx, "managePurchases");
    return await ctx.storage.generateUploadUrl();
  },
});

export const createPurchase = mutation({
  args: {
    supplierId: v.optional(v.id("suppliers")),
    supplierName: v.string(),
    supplierAddress: v.optional(v.string()),
    supplierVatNumber: v.optional(v.string()),
    recipientName: v.optional(v.string()),
    recipientAddress: v.optional(v.string()),
    invoiceNumber: v.optional(v.string()),
    purchaseOrderNumber: v.optional(v.string()),
    issueDate: v.string(),
    dueDate: v.optional(v.string()),
    currency: v.optional(v.string()),
    subtotal: v.number(),
    vatAmount: v.optional(v.number()),
    taxMode: v.optional(taxModeValidator),
    status: v.optional(purchaseStatusValidator),
    notes: v.optional(v.string()),
    proofStorageId: v.optional(v.id("_storage")),
    sourceScanId: v.optional(v.id("purchaseScans")),
    lineItems: v.optional(v.array(scanLineItemInputValidator)),
  },
  handler: async (ctx, args) => {
    const { userId, organization } = await requireOrganization(ctx, "managePurchases");
    const now = Date.now();
    const supplierName = clean(args.supplierName, "Supplier");
    const supplierId = args.supplierId
      ? args.supplierId
      : await getOrCreateSupplier(ctx, organization._id, supplierName, {
          address: args.supplierAddress,
          vatNumber: args.supplierVatNumber,
        });

    if (args.supplierId) {
      const supplier = await ctx.db.get(args.supplierId);

      if (!supplier || supplier.organizationId !== organization._id) {
        throw new Error("Supplier not found");
      }

      if (maybeString(args.supplierAddress) || maybeString(args.supplierVatNumber)) {
        await ctx.db.patch(supplier._id, {
          ...(maybeString(args.supplierAddress)
            ? { address: maybeString(args.supplierAddress) }
            : {}),
          ...(maybeString(args.supplierVatNumber)
            ? { vatNumber: maybeString(args.supplierVatNumber) }
            : {}),
          updatedAt: now,
        });
      }
    }

    const totals = purchaseTotals(args, organization);
    const status = args.status ?? "recorded";
    const purchaseId = await ctx.db.insert("purchases", {
      organizationId: organization._id,
      supplierId,
      supplierName,
      ...(maybeString(args.supplierAddress)
        ? { supplierAddress: maybeString(args.supplierAddress) }
        : {}),
      ...(maybeString(args.supplierVatNumber)
        ? { supplierVatNumber: maybeString(args.supplierVatNumber) }
        : {}),
      ...(maybeString(args.recipientName)
        ? { recipientName: maybeString(args.recipientName) }
        : {}),
      ...(maybeString(args.recipientAddress)
        ? { recipientAddress: maybeString(args.recipientAddress) }
        : {}),
      ...(maybeString(args.invoiceNumber)
        ? { invoiceNumber: maybeString(args.invoiceNumber) }
        : {}),
      ...(maybeString(args.purchaseOrderNumber)
        ? { purchaseOrderNumber: maybeString(args.purchaseOrderNumber) }
        : {}),
      issueDate: clean(args.issueDate, todayIso()),
      ...(maybeString(args.dueDate) ? { dueDate: maybeString(args.dueDate) } : {}),
      currency: cleanCurrency(args.currency, organization.defaultCurrency),
      subtotal: totals.subtotal,
      vatAmount: totals.vatAmount,
      total: totals.total,
      balanceDue: status === "paid" ? 0 : totals.total,
      taxMode: totals.taxMode,
      status,
      ...(maybeString(args.notes) ? { notes: maybeString(args.notes) } : {}),
      ...(args.proofStorageId ? { proofStorageId: args.proofStorageId } : {}),
      ...(args.sourceScanId ? { sourceScanId: args.sourceScanId } : {}),
      retainedUntil: retentionUntil(now),
      createdByUserId: userId,
      createdAt: now,
      updatedAt: now,
    });

    if (args.lineItems?.length) {
      const { lines } = calculatePurchaseLines(args.lineItems, totals.taxMode);
      await writePurchaseLineItems(ctx, organization._id, purchaseId, lines);
    }

    return purchaseId;
  },
});

export const listPurchaseScans = query({
  args: {
    status: v.optional(purchaseScanStatusValidator),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (userId === null) {
      return [];
    }

    const organization = await getExistingOrganization(ctx, userId);

    if (!organization) {
      return [];
    }

    if (args.status) {
      const status = args.status;
      return await ctx.db
        .query("purchaseScans")
        .withIndex("by_organizationId_and_status", (q) =>
          q.eq("organizationId", organization._id).eq("status", status),
        )
        .order("desc")
        .take(40);
    }

    return await ctx.db
      .query("purchaseScans")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", organization._id))
      .order("desc")
      .take(40);
  },
});

export const getPurchaseScan = query({
  args: {
    id: v.id("purchaseScans"),
  },
  handler: async (ctx, args) => {
    const { organization } = await requireOrganization(ctx);
    const scan = await ctx.db.get(args.id);

    if (!scan || scan.organizationId !== organization._id) {
      return null;
    }

    const lineItems = await ctx.db
      .query("purchaseScanLineItems")
      .withIndex("by_scanId", (q) => q.eq("scanId", scan._id))
      .take(100);
    const events = await ctx.db
      .query("purchaseScanEvents")
      .withIndex("by_scanId", (q) => q.eq("scanId", scan._id))
      .order("desc")
      .take(20);
    const fileUrl = await ctx.storage.getUrl(scan.storageId);

    return {
      scan,
      fileUrl,
      lineItems: lineItems.sort((a, b) => a.position - b.position),
      events,
    };
  },
});

export const createPurchaseScan = mutation({
  args: {
    storageId: v.id("_storage"),
    fileName: v.optional(v.string()),
    fileType: v.optional(v.string()),
    fileSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId, organization } = await requireOrganization(ctx, "managePurchases");
    const now = Date.now();
    const metadata = await ctx.db.system.get("_storage", args.storageId);

    if (!metadata) {
      throw new Error("Uploaded file was not found.");
    }

    const scanId = await ctx.db.insert("purchaseScans", {
      organizationId: organization._id,
      createdByUserId: userId,
      storageId: args.storageId,
      ...(maybeString(args.fileName) ? { fileName: maybeString(args.fileName) } : {}),
      ...(maybeString(args.fileType) ? { fileType: maybeString(args.fileType) } : {}),
      fileSize: args.fileSize ?? metadata.size,
      status: "uploaded",
      extractionProvider: "none",
      warnings: ["Review the uploaded invoice before saving it to purchase records."],
      retainedUntil: retentionUntil(now),
      createdAt: now,
      updatedAt: now,
    });

    await writeScanEvent(
      ctx,
      organization._id,
      scanId,
      "uploaded",
      "Supplier invoice uploaded for review.",
      userId,
    );

    return scanId;
  },
});

export const updatePurchaseScanReview = mutation({
  args: {
    id: v.id("purchaseScans"),
    ...scanFieldsValidator,
    lineItems: v.array(scanLineItemInputValidator),
  },
  handler: async (ctx, args) => {
    const { userId, organization } = await requireOrganization(ctx, "managePurchases");
    const scan = await ctx.db.get(args.id);

    if (!scan || scan.organizationId !== organization._id) {
      throw new Error("Scan not found");
    }

    if (scan.status === "saved") {
      throw new Error("This scan has already been saved to purchase records.");
    }

    const taxMode = normalizeTaxMode(args.taxMode ?? scan.taxMode, organization);
    const lineCalculation = calculatePurchaseLines(args.lineItems, taxMode);
    const totals = draftTotals({
      subtotal: args.subtotal,
      vatAmount: args.vatAmount,
      total: args.total,
      taxMode,
      lines: lineCalculation.lines,
    });
    const duplicate = await duplicatePurchaseInvoice(
      ctx,
      organization._id,
      args.invoiceNumber,
      args.supplierName,
    );
    const warnings = scanWarnings({
      detectedTaxInvoice: args.detectedTaxInvoice,
      supplierName: args.supplierName,
      supplierAddress: args.supplierAddress,
      supplierVatNumber: args.supplierVatNumber,
      recipientName: args.recipientName,
      recipientAddress: args.recipientAddress,
      invoiceNumber: args.invoiceNumber,
      issueDate: args.issueDate,
      currency: args.currency,
      subtotal: totals.subtotal,
      vatAmount: totals.vatAmount,
      total: totals.total,
      taxMode,
      lineItems: lineCalculation.lines,
      duplicate,
    });
    const now = Date.now();

    await replaceScanLineItems(ctx, organization._id, scan._id, lineCalculation.lines);
    await ctx.db.patch(scan._id, {
      detectedTaxInvoice: args.detectedTaxInvoice ?? false,
      supplierName: clean(args.supplierName ?? "", scan.supplierName ?? ""),
      supplierAddress: clean(args.supplierAddress ?? "", scan.supplierAddress ?? ""),
      supplierVatNumber: clean(args.supplierVatNumber ?? "", scan.supplierVatNumber ?? ""),
      recipientName: clean(args.recipientName ?? "", scan.recipientName ?? ""),
      recipientAddress: clean(args.recipientAddress ?? "", scan.recipientAddress ?? ""),
      invoiceNumber: clean(args.invoiceNumber ?? "", scan.invoiceNumber ?? ""),
      purchaseOrderNumber: clean(
        args.purchaseOrderNumber ?? "",
        scan.purchaseOrderNumber ?? "",
      ),
      issueDate: clean(args.issueDate ?? "", scan.issueDate ?? todayIso()),
      dueDate: clean(args.dueDate ?? "", scan.dueDate ?? ""),
      currency: cleanCurrency(args.currency, organization.defaultCurrency),
      subtotal: totals.subtotal,
      vatAmount: totals.vatAmount,
      total: totals.total,
      taxMode,
      confidence: confidence(args.confidence) ?? scan.confidence,
      ...(rawTextPreview(args.rawTextPreview)
        ? { rawTextPreview: rawTextPreview(args.rawTextPreview) }
        : {}),
      notes: clean(args.notes ?? "", scan.notes ?? ""),
      warnings,
      status: readyStatus(warnings),
      reviewedAt: now,
      updatedAt: now,
    });

    await writeScanEvent(
      ctx,
      organization._id,
      scan._id,
      "review_saved",
      warnings.length
        ? "Scan review saved with compliance warnings."
        : "Scan review saved and ready for purchase records.",
      userId,
    );

    return scan._id;
  },
});

export const createPurchaseFromScan = mutation({
  args: {
    id: v.id("purchaseScans"),
  },
  handler: async (ctx, args) => {
    const { userId, organization } = await requireOrganization(ctx, "managePurchases");
    const scan = await ctx.db.get(args.id);

    if (!scan || scan.organizationId !== organization._id) {
      throw new Error("Scan not found");
    }

    if (scan.status === "saved") {
      if (!scan.savedPurchaseId) {
        throw new Error("This scan was already saved.");
      }
      return scan.savedPurchaseId;
    }

    const lineItems = await ctx.db
      .query("purchaseScanLineItems")
      .withIndex("by_scanId", (q) => q.eq("scanId", scan._id))
      .take(100);
    const calculatedLines = lineItems
      .sort((a, b) => a.position - b.position)
      .map((line) => ({
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        taxMode: line.taxMode,
        vatRate: line.vatRate ?? 0,
        vatAmount: line.vatAmount ?? 0,
        lineSubtotal: line.lineSubtotal ?? money(line.quantity * line.unitPrice),
        lineTotal: line.lineTotal,
        position: line.position,
      }));
    const duplicate = await duplicatePurchaseInvoice(
      ctx,
      organization._id,
      scan.invoiceNumber,
      scan.supplierName,
    );
    const taxMode = normalizeTaxMode(scan.taxMode, organization);
    const warnings = scanWarnings({
      detectedTaxInvoice: scan.detectedTaxInvoice,
      supplierName: scan.supplierName,
      supplierAddress: scan.supplierAddress,
      supplierVatNumber: scan.supplierVatNumber,
      recipientName: scan.recipientName,
      recipientAddress: scan.recipientAddress,
      invoiceNumber: scan.invoiceNumber,
      issueDate: scan.issueDate,
      currency: scan.currency,
      subtotal: scan.subtotal ?? 0,
      vatAmount: scan.vatAmount ?? 0,
      total: scan.total ?? 0,
      taxMode,
      lineItems: calculatedLines,
      duplicate,
    });

    if (readyStatus(warnings) !== "ready") {
      await ctx.db.patch(scan._id, {
        warnings,
        status: "needs_review",
        updatedAt: Date.now(),
      });
      throw new Error("Resolve the required scan fields before saving this purchase.");
    }

    const now = Date.now();
    const supplierName = clean(scan.supplierName, "Supplier");
    const subtotal = money(scan.subtotal ?? 0);
    const vatAmount = taxMode === "vat_15" ? money(scan.vatAmount ?? 0) : 0;
    const total = money(scan.total ?? subtotal + vatAmount);
    const supplierId = await getOrCreateSupplier(ctx, organization._id, supplierName, {
      address: scan.supplierAddress,
      vatNumber: scan.supplierVatNumber,
    });
    const purchaseId = await ctx.db.insert("purchases", {
      organizationId: organization._id,
      supplierId,
      supplierName,
      ...(maybeString(scan.supplierAddress)
        ? { supplierAddress: maybeString(scan.supplierAddress) }
        : {}),
      ...(maybeString(scan.supplierVatNumber)
        ? { supplierVatNumber: maybeString(scan.supplierVatNumber) }
        : {}),
      ...(maybeString(scan.recipientName)
        ? { recipientName: maybeString(scan.recipientName) }
        : {}),
      ...(maybeString(scan.recipientAddress)
        ? { recipientAddress: maybeString(scan.recipientAddress) }
        : {}),
      ...(maybeString(scan.invoiceNumber)
        ? { invoiceNumber: maybeString(scan.invoiceNumber) }
        : {}),
      ...(maybeString(scan.purchaseOrderNumber)
        ? { purchaseOrderNumber: maybeString(scan.purchaseOrderNumber) }
        : {}),
      issueDate: clean(scan.issueDate, todayIso()),
      ...(maybeString(scan.dueDate) ? { dueDate: maybeString(scan.dueDate) } : {}),
      currency: cleanCurrency(scan.currency, organization.defaultCurrency),
      subtotal,
      vatAmount,
      total,
      balanceDue: total,
      taxMode,
      status: "recorded",
      ...(maybeString(scan.notes) ? { notes: maybeString(scan.notes) } : {}),
      proofStorageId: scan.storageId,
      sourceScanId: scan._id,
      retainedUntil: scan.retainedUntil,
      createdByUserId: userId,
      createdAt: now,
      updatedAt: now,
    });

    await writePurchaseLineItems(ctx, organization._id, purchaseId, calculatedLines);
    await ctx.db.patch(scan._id, {
      status: "saved",
      savedPurchaseId: purchaseId,
      warnings,
      reviewedAt: now,
      updatedAt: now,
    });
    await writeScanEvent(
      ctx,
      organization._id,
      scan._id,
      "purchase_created",
      "Purchase record created from reviewed scan.",
      userId,
    );

    return purchaseId;
  },
});

export const internalGetScanForExtraction = internalQuery({
  args: {
    id: v.id("purchaseScans"),
  },
  handler: async (ctx, args) => {
    const { organization } = await requireOrganization(ctx, "managePurchases");
    const scan = await ctx.db.get(args.id);

    if (!scan || scan.organizationId !== organization._id) {
      throw new Error("Scan not found");
    }

    return {
      scan,
      organizationName: organization.name,
      organizationAddress: organization.address ?? "",
      organizationVatNumber: organization.vatNumber ?? "",
      defaultCurrency: organization.defaultCurrency,
    };
  },
});

export const internalMarkScanExtractionStarted = internalMutation({
  args: {
    id: v.id("purchaseScans"),
    provider: extractionProviderValidator,
  },
  handler: async (ctx, args) => {
    const { userId, organization } = await requireOrganization(ctx, "managePurchases");
    const scan = await ctx.db.get(args.id);

    if (!scan || scan.organizationId !== organization._id) {
      throw new Error("Scan not found");
    }

    if (scan.status === "saved") {
      throw new Error("Saved scans cannot be extracted again.");
    }

    await ctx.db.patch(scan._id, {
      status: "extracting",
      extractionProvider: args.provider,
      updatedAt: Date.now(),
    });
    await writeScanEvent(
      ctx,
      organization._id,
      scan._id,
      "extraction_started",
      "Invoice extraction started.",
      userId,
    );
  },
});

export const internalApplyScanExtraction = internalMutation({
  args: {
    id: v.id("purchaseScans"),
    provider: extractionProviderValidator,
    ...scanFieldsValidator,
    lineItems: v.array(scanLineItemInputValidator),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, organization } = await requireOrganization(ctx, "managePurchases");
    const scan = await ctx.db.get(args.id);

    if (!scan || scan.organizationId !== organization._id) {
      throw new Error("Scan not found");
    }

    if (scan.status === "saved") {
      throw new Error("Saved scans cannot be extracted again.");
    }

    const taxMode = normalizeTaxMode(args.taxMode ?? scan.taxMode, organization);
    const lineCalculation = calculatePurchaseLines(args.lineItems, taxMode);
    const totals = draftTotals({
      subtotal: args.subtotal,
      vatAmount: args.vatAmount,
      total: args.total,
      taxMode,
      lines: lineCalculation.lines,
    });
    const duplicate = await duplicatePurchaseInvoice(
      ctx,
      organization._id,
      args.invoiceNumber,
      args.supplierName,
    );
    const warnings = scanWarnings({
      detectedTaxInvoice: args.detectedTaxInvoice,
      supplierName: args.supplierName,
      supplierAddress: args.supplierAddress,
      supplierVatNumber: args.supplierVatNumber,
      recipientName: args.recipientName,
      recipientAddress: args.recipientAddress,
      invoiceNumber: args.invoiceNumber,
      issueDate: args.issueDate,
      currency: args.currency,
      subtotal: totals.subtotal,
      vatAmount: totals.vatAmount,
      total: totals.total,
      taxMode,
      lineItems: lineCalculation.lines,
      duplicate,
    });
    const now = Date.now();

    await replaceScanLineItems(ctx, organization._id, scan._id, lineCalculation.lines);
    await ctx.db.patch(scan._id, {
      detectedTaxInvoice: args.detectedTaxInvoice ?? false,
      supplierName: clean(args.supplierName ?? "", ""),
      supplierAddress: clean(args.supplierAddress ?? "", ""),
      supplierVatNumber: clean(args.supplierVatNumber ?? "", ""),
      recipientName: clean(args.recipientName ?? "", ""),
      recipientAddress: clean(args.recipientAddress ?? "", ""),
      invoiceNumber: clean(args.invoiceNumber ?? "", ""),
      purchaseOrderNumber: clean(args.purchaseOrderNumber ?? "", ""),
      issueDate: clean(args.issueDate ?? "", ""),
      dueDate: clean(args.dueDate ?? "", ""),
      currency: cleanCurrency(args.currency, organization.defaultCurrency),
      subtotal: totals.subtotal,
      vatAmount: totals.vatAmount,
      total: totals.total,
      taxMode,
      confidence: confidence(args.confidence),
      ...(rawTextPreview(args.rawTextPreview)
        ? { rawTextPreview: rawTextPreview(args.rawTextPreview) }
        : {}),
      notes: clean(args.notes ?? "", ""),
      warnings,
      status: readyStatus(warnings),
      extractionProvider: args.provider,
      extractedAt: now,
      updatedAt: now,
    });

    await writeScanEvent(
      ctx,
      organization._id,
      scan._id,
      "extraction_completed",
      clean(args.message, "Invoice extraction completed. Review before saving."),
      userId,
    );

    return scan._id;
  },
});

export const internalMarkScanExtractionFailed = internalMutation({
  args: {
    id: v.id("purchaseScans"),
    provider: extractionProviderValidator,
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, organization } = await requireOrganization(ctx, "managePurchases");
    const scan = await ctx.db.get(args.id);

    if (!scan || scan.organizationId !== organization._id) {
      throw new Error("Scan not found");
    }

    const message = clean(args.message, "Invoice extraction failed. Review manually.");

    await ctx.db.patch(scan._id, {
      status: "failed",
      extractionProvider: args.provider,
      warnings: [message],
      updatedAt: Date.now(),
    });
    await writeScanEvent(ctx, organization._id, scan._id, "failed", message, userId);
  },
});

export const updatePurchase = mutation({
  args: {
    id: v.id("purchases"),
    supplierId: v.optional(v.id("suppliers")),
    supplierName: v.string(),
    invoiceNumber: v.optional(v.string()),
    issueDate: v.string(),
    dueDate: v.optional(v.string()),
    currency: v.optional(v.string()),
    subtotal: v.number(),
    vatAmount: v.optional(v.number()),
    taxMode: v.optional(taxModeValidator),
    status: v.optional(purchaseStatusValidator),
    notes: v.optional(v.string()),
    proofStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const { organization } = await requireOrganization(ctx, "managePurchases");
    const purchase = await ctx.db.get(args.id);

    if (!purchase || purchase.organizationId !== organization._id) {
      throw new Error("Purchase not found");
    }

    const supplierName = clean(args.supplierName, purchase.supplierName);
    const supplierId = args.supplierId
      ? args.supplierId
      : await getOrCreateSupplier(ctx, organization._id, supplierName);
    const totals = purchaseTotals(args, organization);
    const status = args.status ?? purchase.status;
    const now = Date.now();

    await ctx.db.patch(purchase._id, {
      supplierId,
      supplierName,
      invoiceNumber: clean(args.invoiceNumber ?? "", purchase.invoiceNumber ?? ""),
      issueDate: clean(args.issueDate, purchase.issueDate),
      dueDate: clean(args.dueDate ?? "", purchase.dueDate ?? ""),
      currency: cleanCurrency(args.currency, purchase.currency),
      subtotal: totals.subtotal,
      vatAmount: totals.vatAmount,
      total: totals.total,
      balanceDue: status === "paid" ? 0 : totals.total,
      taxMode: totals.taxMode,
      status,
      notes: clean(args.notes ?? "", purchase.notes ?? ""),
      ...(args.proofStorageId ? { proofStorageId: args.proofStorageId } : {}),
      updatedAt: now,
    });

    return purchase._id;
  },
});

export const markPurchasePaid = mutation({
  args: { id: v.id("purchases") },
  handler: async (ctx, args) => {
    const { organization } = await requireOrganization(ctx, "managePurchases");
    const purchase = await ctx.db.get(args.id);

    if (!purchase || purchase.organizationId !== organization._id) {
      throw new Error("Purchase not found");
    }

    await ctx.db.patch(purchase._id, {
      status: "paid",
      balanceDue: 0,
      updatedAt: Date.now(),
    });
  },
});
