import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { query, type QueryCtx } from "./_generated/server";
import {
  getExistingOrganization,
  requireOrganizationPermission,
} from "./organizationContext";

function invoiceTotal(invoice: Doc<"invoices">) {
  return invoice.total ?? invoice.amountTotal ?? invoice.amount ?? 0;
}

function invoiceBalance(invoice: Doc<"invoices">) {
  return invoice.balanceDue ?? (invoice.status === "paid" ? 0 : invoiceTotal(invoice));
}

function insidePeriod(date: string | undefined, from?: string, to?: string) {
  if (!date) {
    return true;
  }
  if (from && date < from) {
    return false;
  }
  if (to && date > to) {
    return false;
  }
  return true;
}

async function loadPeriodInvoices(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  from?: string,
  to?: string,
) {
  if (from && to) {
    return await ctx.db
      .query("invoices")
      .withIndex("by_organizationId_and_issueDate", (q) =>
        q.eq("organizationId", organizationId).gte("issueDate", from).lte("issueDate", to),
      )
      .order("desc")
      .take(500);
  }

  return await ctx.db
    .query("invoices")
    .withIndex("by_organizationId", (q) => q.eq("organizationId", organizationId))
    .order("desc")
    .take(500);
}

async function loadPeriodPurchases(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  from?: string,
  to?: string,
) {
  if (from && to) {
    return await ctx.db
      .query("purchases")
      .withIndex("by_organizationId_and_issueDate", (q) =>
        q.eq("organizationId", organizationId).gte("issueDate", from).lte("issueDate", to),
      )
      .order("desc")
      .take(500);
  }

  return await ctx.db
    .query("purchases")
    .withIndex("by_organizationId", (q) => q.eq("organizationId", organizationId))
    .order("desc")
    .take(500);
}

export const summary = query({
  args: {
    from: v.optional(v.string()),
    to: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const empty = {
      currency: "NAD",
      invoiceCount: 0,
      paid: 0,
      outstanding: 0,
      overdue: 0,
      vatCollected: 0,
      vatInput: 0,
      purchaseTotal: 0,
    };

    if (userId === null) {
      return empty;
    }

    const organization = await getExistingOrganization(ctx, userId);

    if (!organization) {
      return empty;
    }

    const [invoices, purchases] = await Promise.all([
      loadPeriodInvoices(ctx, organization._id, args.from, args.to),
      loadPeriodPurchases(ctx, organization._id, args.from, args.to),
    ]);

    const totals = {
      ...empty,
      currency: organization.defaultCurrency,
    };

    invoices
      .filter((invoice) => invoice.status !== "void")
      .filter((invoice) => insidePeriod(invoice.issueDate, args.from, args.to))
      .forEach((invoice) => {
        totals.invoiceCount += 1;

        if (invoice.status === "paid") {
          totals.paid += invoiceTotal(invoice);
          totals.vatCollected += invoice.vatAmount ?? 0;
        } else {
          totals.outstanding += invoiceBalance(invoice);
        }

        if (invoice.status === "overdue") {
          totals.overdue += invoiceBalance(invoice);
        }
      });

    purchases
      .filter((purchase) => purchase.status !== "void")
      .filter((purchase) => insidePeriod(purchase.issueDate, args.from, args.to))
      .forEach((purchase) => {
        totals.purchaseTotal += purchase.total;
        totals.vatInput += purchase.vatAmount;
      });

    return totals;
  },
});

export const ledgerExport = query({
  args: {
    from: v.optional(v.string()),
    to: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (userId === null) {
      return [];
    }

    const { organization } = await requireOrganizationPermission(
      ctx,
      userId,
      "exportReports",
    );

    const [invoices, purchases] = await Promise.all([
      loadPeriodInvoices(ctx, organization._id, args.from, args.to),
      loadPeriodPurchases(ctx, organization._id, args.from, args.to),
    ]);
    const invoiceRows = invoices
      .filter((invoice) => insidePeriod(invoice.issueDate, args.from, args.to))
      .map((invoice) => ({
        type: "invoice" as const,
        number: invoice.invoiceNumber,
        party: invoice.clientName ?? invoice.client ?? "Client",
        issueDate: invoice.issueDate ?? "",
        dueDate: invoice.dueDate,
        status: invoice.status,
        currency: invoice.currency ?? organization.defaultCurrency,
        subtotal: invoice.subtotal ?? invoiceTotal(invoice),
        vatAmount: invoice.vatAmount ?? 0,
        total: invoiceTotal(invoice),
        balanceDue: invoiceBalance(invoice),
      }));
    const purchaseRows = purchases
      .filter((purchase) => insidePeriod(purchase.issueDate, args.from, args.to))
      .map((purchase) => ({
        type: "purchase" as const,
        number: purchase.invoiceNumber ?? "",
        party: purchase.supplierName,
        issueDate: purchase.issueDate,
        dueDate: purchase.dueDate ?? "",
        status: purchase.status,
        currency: purchase.currency,
        subtotal: purchase.subtotal,
        vatAmount: purchase.vatAmount,
        total: purchase.total,
        balanceDue: purchase.balanceDue,
      }));

    return [...invoiceRows, ...purchaseRows].sort((a, b) =>
      b.issueDate.localeCompare(a.issueDate),
    );
  },
});
