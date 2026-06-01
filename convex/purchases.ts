import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { getExistingOrganization } from "./organizationContext";

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

async function requireUserId(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);

  if (userId === null) {
    throw new Error("Authentication required");
  }

  return userId;
}

async function requireOrganization(ctx: QueryCtx | MutationCtx) {
  const userId = await requireUserId(ctx);
  const organization = await getExistingOrganization(ctx, userId);

  if (!organization) {
    throw new Error("Organization setup required");
  }

  return { userId, organization };
}

function purchaseTotals(args: {
  subtotal: number;
  vatAmount?: number;
  taxMode?: Doc<"purchases">["taxMode"];
}) {
  const taxMode = args.taxMode ?? "no_vat";
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
) {
  const supplierName = clean(name, "Supplier");
  const existing = await findSupplierByName(ctx, organizationId, supplierName);

  if (existing) {
    return existing._id;
  }

  const now = Date.now();
  return await ctx.db.insert("suppliers", {
    organizationId,
    name: supplierName,
    active: true,
    createdAt: now,
    updatedAt: now,
  });
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
    const { organization } = await requireOrganization(ctx);
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
    await requireOrganization(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const createPurchase = mutation({
  args: {
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
    const { userId, organization } = await requireOrganization(ctx);
    const now = Date.now();
    const supplierName = clean(args.supplierName, "Supplier");
    const supplierId = args.supplierId
      ? args.supplierId
      : await getOrCreateSupplier(ctx, organization._id, supplierName);

    if (args.supplierId) {
      const supplier = await ctx.db.get(args.supplierId);

      if (!supplier || supplier.organizationId !== organization._id) {
        throw new Error("Supplier not found");
      }
    }

    const totals = purchaseTotals(args);
    const status = args.status ?? "recorded";

    return await ctx.db.insert("purchases", {
      organizationId: organization._id,
      supplierId,
      supplierName,
      ...(maybeString(args.invoiceNumber)
        ? { invoiceNumber: maybeString(args.invoiceNumber) }
        : {}),
      issueDate: clean(args.issueDate, new Date().toISOString().slice(0, 10)),
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
      createdByUserId: userId,
      createdAt: now,
      updatedAt: now,
    });
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
    const { organization } = await requireOrganization(ctx);
    const purchase = await ctx.db.get(args.id);

    if (!purchase || purchase.organizationId !== organization._id) {
      throw new Error("Purchase not found");
    }

    const supplierName = clean(args.supplierName, purchase.supplierName);
    const supplierId = args.supplierId
      ? args.supplierId
      : await getOrCreateSupplier(ctx, organization._id, supplierName);
    const totals = purchaseTotals(args);
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
    const { organization } = await requireOrganization(ctx);
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
