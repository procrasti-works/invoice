import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";

const statusValidator = v.union(
  v.literal("draft"),
  v.literal("ready"),
  v.literal("sent"),
  v.literal("viewed"),
  v.literal("approved"),
  v.literal("awaiting_payment"),
  v.literal("rejected"),
  v.literal("paid"),
  v.literal("overdue"),
);

const lineItemValidator = v.object({
  description: v.string(),
  quantity: v.number(),
  unitPrice: v.number(),
});

const dayMs = 1000 * 60 * 60 * 24;
const defaultPaymentInstructions =
  "Pay by bank transfer, card link, or the payment method agreed with the sender.";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function isoDaysFromNow(days: number) {
  return new Date(Date.now() + dayMs * days).toISOString().slice(0, 10);
}

function clean(value: string, fallback = "") {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function money(value: number) {
  return Math.max(0, Math.round(value * 100) / 100);
}

function buildInvoiceNumber(now: number) {
  return `INV-${new Date(now).getFullYear()}-${String(now).slice(-6)}`;
}

function cleanCurrency(value: string, fallback: string) {
  const currency = clean(value, fallback).toUpperCase();

  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error("Currency must be a 3-letter code");
  }

  return currency;
}

function cleanPaymentLink(value: string) {
  const paymentLink = clean(value);

  if (paymentLink && !/^https?:\/\//i.test(paymentLink)) {
    throw new Error("Payment link must start with http:// or https://");
  }

  return paymentLink;
}

function generatePublicToken() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(36).padStart(2, "0")).join("");
}

async function requireUserId(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);

  if (userId === null) {
    throw new Error("Authentication required");
  }

  return userId;
}

async function getExistingOrganization(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
) {
  const memberships = await ctx.db
    .query("memberships")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .take(1);
  const membership = memberships[0];

  if (!membership) {
    return null;
  }

  return await ctx.db.get(membership.organizationId);
}

async function ensureOrganization(ctx: MutationCtx, userId: Id<"users">) {
  const existing = await getExistingOrganization(ctx, userId);

  if (existing) {
    return existing;
  }

  const user = await ctx.db.get(userId);
  const name =
    typeof user?.name === "string" && user.name.trim()
      ? `${user.name.trim()}'s company`
      : "My company";
  const now = Date.now();
  const organizationId = await ctx.db.insert("organizations", {
    name,
    ownerUserId: userId,
    defaultCurrency: "USD",
    paymentInstructions: defaultPaymentInstructions,
    brandColor: "#111111",
    createdAt: now,
    updatedAt: now,
  });

  await ctx.db.insert("memberships", {
    organizationId,
    userId,
    role: "owner",
    createdAt: now,
  });

  const organization = await ctx.db.get(organizationId);

  if (!organization) {
    throw new Error("Unable to create organization");
  }

  return organization;
}

async function requireOrganization(ctx: QueryCtx | MutationCtx) {
  const userId = await requireUserId(ctx);
  const organization = await getExistingOrganization(ctx, userId);

  if (!organization) {
    throw new Error("Organization setup required");
  }

  return { userId, organization };
}

async function requireOwnedInvoice(
  ctx: QueryCtx | MutationCtx,
  invoiceId: Id<"invoices">,
) {
  const { userId, organization } = await requireOrganization(ctx);
  const invoice = await ctx.db.get(invoiceId);

  if (!invoice || invoice.organizationId !== organization._id) {
    throw new Error("Invoice not found");
  }

  return { userId, organization, invoice };
}

async function getOrCreateClient(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  clientName: string,
  clientEmail: string,
) {
  const normalizedEmail = clientEmail.trim().toLowerCase();

  if (!normalizedEmail.includes("@")) {
    throw new Error("Client email is required to send an invoice");
  }

  const existing = await ctx.db
    .query("clients")
    .withIndex("by_organizationId_and_email", (q) =>
      q.eq("organizationId", organizationId).eq("email", normalizedEmail),
    )
    .unique();

  const now = Date.now();

  if (existing) {
    await ctx.db.patch(existing._id, {
      name: clean(clientName, existing.name),
      updatedAt: now,
    });
    return existing._id;
  }

  return await ctx.db.insert("clients", {
    organizationId,
    name: clean(clientName, normalizedEmail),
    email: normalizedEmail,
    createdAt: now,
    updatedAt: now,
  });
}

async function writeEvent(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  invoiceId: Id<"invoices">,
  type: Doc<"invoiceEvents">["type"],
  message: string,
  actor: {
    actorType: Doc<"invoiceEvents">["actorType"];
    actorUserId?: Id<"users">;
    actorName?: string;
  },
) {
  await ctx.db.insert("invoiceEvents", {
    organizationId,
    invoiceId,
    type,
    message,
    actorType: actor.actorType,
    ...(actor.actorUserId ? { actorUserId: actor.actorUserId } : {}),
    ...(actor.actorName ? { actorName: actor.actorName } : {}),
    createdAt: Date.now(),
  });
}

async function invoiceLineItems(ctx: QueryCtx | MutationCtx, invoiceId: Id<"invoices">) {
  return await ctx.db
    .query("invoiceLineItems")
    .withIndex("by_invoiceId", (q) => q.eq("invoiceId", invoiceId))
    .order("asc")
    .take(50);
}

async function publicInvoiceByToken(ctx: QueryCtx | MutationCtx, token: string) {
  return await ctx.db
    .query("invoices")
    .withIndex("by_publicToken", (q) => q.eq("publicToken", token))
    .unique();
}

export const workspace = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    if (userId === null) {
      return null;
    }

    return await getExistingOrganization(ctx, userId);
  },
});

export const updateWorkspace = mutation({
  args: {
    name: v.string(),
    defaultCurrency: v.string(),
    paymentInstructions: v.string(),
    paymentLink: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const organization = await ensureOrganization(ctx, userId);
    const now = Date.now();

    await ctx.db.patch(organization._id, {
      name: clean(args.name, organization.name),
      defaultCurrency: cleanCurrency(
        args.defaultCurrency,
        organization.defaultCurrency,
      ),
      paymentInstructions: clean(
        args.paymentInstructions,
        organization.paymentInstructions || defaultPaymentInstructions,
      ),
      paymentLink: cleanPaymentLink(args.paymentLink ?? ""),
      updatedAt: now,
    });

    return await ctx.db.get(organization._id);
  },
});

export const list = query({
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

    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", organization._id),
      )
      .order("desc")
      .take(40);

    return await Promise.all(
      invoices.map(async (invoice) => {
        const events = await ctx.db
          .query("invoiceEvents")
          .withIndex("by_invoiceId", (q) => q.eq("invoiceId", invoice._id))
          .order("desc")
          .take(3);
        const lineItems = await invoiceLineItems(ctx, invoice._id);

        return { invoice, events, lineItems };
      }),
    );
  },
});

export const stats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const empty = {
      totalOutstanding: 0,
      totalPaid: 0,
      invoiceCount: 0,
      awaitingClientCount: 0,
      overdueCount: 0,
      paidCount: 0,
    };

    if (userId === null) {
      return empty;
    }

    const organization = await getExistingOrganization(ctx, userId);

    if (!organization) {
      return empty;
    }

    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", organization._id),
      )
      .order("desc")
      .take(200);

    return invoices.reduce((totals, invoice) => {
      const amount = invoice.amountTotal ?? invoice.amount ?? 0;
      totals.invoiceCount += 1;

      if (invoice.status === "paid") {
        totals.paidCount += 1;
        totals.totalPaid += amount;
      } else {
        totals.totalOutstanding += amount;
      }

      if (
        invoice.status === "sent" ||
        invoice.status === "viewed" ||
        invoice.status === "approved" ||
        invoice.status === "awaiting_payment"
      ) {
        totals.awaitingClientCount += 1;
      }

      if (invoice.status === "overdue") {
        totals.overdueCount += 1;
      }

      return totals;
    }, empty);
  },
});

export const createDraft = mutation({
  args: {
    clientName: v.string(),
    clientEmail: v.string(),
    dueDate: v.string(),
    currency: v.optional(v.string()),
    terms: v.optional(v.string()),
    notes: v.optional(v.string()),
    paymentInstructions: v.optional(v.string()),
    paymentLink: v.optional(v.string()),
    lineItems: v.array(lineItemValidator),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const organization = await ensureOrganization(ctx, userId);
    const clientName = clean(args.clientName, "Client");
    const clientEmail = clean(args.clientEmail).toLowerCase();
    const clientId = await getOrCreateClient(
      ctx,
      organization._id,
      clientName,
      clientEmail,
    );
    const now = Date.now();
    const lineItems = args.lineItems.length
      ? args.lineItems
      : [{ description: "Professional services", quantity: 1, unitPrice: 0 }];
    const amountTotal = money(
      lineItems.reduce(
        (total, item) => total + money(item.quantity) * money(item.unitPrice),
        0,
      ),
    );
    const trimmedPaymentLink = clean(
      args.paymentLink ?? "",
      organization.paymentLink ?? "",
    );
    const invoiceId = await ctx.db.insert("invoices", {
      organizationId: organization._id,
      clientId,
      createdByUserId: userId,
      invoiceNumber: buildInvoiceNumber(now),
      clientName,
      clientEmail,
      status: clientEmail.includes("@") && amountTotal > 0 ? "ready" : "draft",
      amount: amountTotal,
      amountTotal,
      currency: cleanCurrency(args.currency ?? "", organization.defaultCurrency),
      issueDate: todayIso(),
      dueDate: clean(args.dueDate, isoDaysFromNow(14)),
      terms: clean(args.terms ?? "", "Due on receipt unless otherwise agreed."),
      notes: clean(args.notes ?? ""),
      paymentInstructions: clean(
        args.paymentInstructions ?? "",
        organization.paymentInstructions,
      ),
      ...(trimmedPaymentLink ? { paymentLink: trimmedPaymentLink } : {}),
      createdAt: now,
      updatedAt: now,
    });

    await Promise.all(
      lineItems.slice(0, 20).map(async (item, index) => {
        const quantity = money(item.quantity || 1);
        const unitPrice = money(item.unitPrice);

        await ctx.db.insert("invoiceLineItems", {
          organizationId: organization._id,
          invoiceId,
          description: clean(item.description, "Invoice item"),
          quantity,
          unitPrice,
          lineTotal: money(quantity * unitPrice),
          position: index,
          createdAt: now,
        });
      }),
    );

    await writeEvent(
      ctx,
      organization._id,
      invoiceId,
      "created",
      "Draft invoice created.",
      { actorType: "user", actorUserId: userId },
    );

    return invoiceId;
  },
});

export const amend = mutation({
  args: {
    id: v.id("invoices"),
    clientName: v.string(),
    clientEmail: v.string(),
    dueDate: v.string(),
    currency: v.optional(v.string()),
    terms: v.optional(v.string()),
    notes: v.optional(v.string()),
    paymentInstructions: v.optional(v.string()),
    paymentLink: v.optional(v.string()),
    lineItems: v.array(lineItemValidator),
  },
  handler: async (ctx, args) => {
    const { userId, organization, invoice } = await requireOwnedInvoice(
      ctx,
      args.id,
    );

    if (
      invoice.status !== "draft" &&
      invoice.status !== "ready" &&
      invoice.status !== "rejected"
    ) {
      throw new Error("Only draft, ready, or rejected invoices can be amended");
    }

    const clientName = clean(args.clientName, "Client");
    const clientEmail = clean(args.clientEmail).toLowerCase();
    const clientId = await getOrCreateClient(
      ctx,
      organization._id,
      clientName,
      clientEmail,
    );
    const now = Date.now();
    const lineItems = args.lineItems.length
      ? args.lineItems
      : [{ description: "Professional services", quantity: 1, unitPrice: 0 }];
    const amountTotal = money(
      lineItems.reduce(
        (total, item) => total + money(item.quantity) * money(item.unitPrice),
        0,
      ),
    );
    const trimmedPaymentLink = clean(
      args.paymentLink ?? "",
      organization.paymentLink ?? "",
    );
    const existingLineItems = await invoiceLineItems(ctx, invoice._id);

    await Promise.all(
      existingLineItems.map(async (lineItem) => {
        await ctx.db.delete(lineItem._id);
      }),
    );

    await Promise.all(
      lineItems.slice(0, 20).map(async (item, index) => {
        const quantity = money(item.quantity || 1);
        const unitPrice = money(item.unitPrice);

        await ctx.db.insert("invoiceLineItems", {
          organizationId: organization._id,
          invoiceId: invoice._id,
          description: clean(item.description, "Invoice item"),
          quantity,
          unitPrice,
          lineTotal: money(quantity * unitPrice),
          position: index,
          createdAt: now,
        });
      }),
    );

    await ctx.db.patch(invoice._id, {
      clientId,
      clientName,
      clientEmail,
      status: clientEmail.includes("@") && amountTotal > 0 ? "ready" : "draft",
      amount: amountTotal,
      amountTotal,
      currency: cleanCurrency(args.currency ?? "", organization.defaultCurrency),
      dueDate: clean(args.dueDate, isoDaysFromNow(14)),
      terms: clean(args.terms ?? "", "Due on receipt unless otherwise agreed."),
      notes: clean(args.notes ?? ""),
      paymentInstructions: clean(
        args.paymentInstructions ?? "",
        organization.paymentInstructions,
      ),
      paymentLink: trimmedPaymentLink,
      updatedAt: now,
    });

    await writeEvent(
      ctx,
      organization._id,
      invoice._id,
      "amended",
      "Business amended the invoice after client feedback.",
      { actorType: "user", actorUserId: userId },
    );

    return invoice._id;
  },
});

export const send = mutation({
  args: { id: v.id("invoices") },
  handler: async (ctx, args) => {
    const { userId, organization, invoice } = await requireOwnedInvoice(
      ctx,
      args.id,
    );

    if (!invoice.clientEmail?.includes("@")) {
      throw new Error("Add a client email before sending");
    }

    if ((invoice.amountTotal ?? invoice.amount ?? 0) <= 0) {
      throw new Error("Add at least one billable line item before sending");
    }

    const now = Date.now();
    const token = invoice.publicToken ?? generatePublicToken();
    const lineItems = await invoiceLineItems(ctx, invoice._id);
    const snapshot = {
      organizationId: organization._id,
      invoiceId: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      clientName: invoice.clientName ?? invoice.client ?? "Client",
      clientEmail: invoice.clientEmail,
      amountTotal: invoice.amountTotal ?? invoice.amount ?? 0,
      currency: invoice.currency ?? organization.defaultCurrency,
      issueDate: invoice.issueDate ?? todayIso(),
      dueDate: invoice.dueDate,
      terms: invoice.terms ?? "",
      notes: invoice.notes ?? "",
      paymentInstructions:
        invoice.paymentInstructions ?? organization.paymentInstructions,
      createdAt: now,
      ...(invoice.paymentLink ? { paymentLink: invoice.paymentLink } : {}),
    };
    const snapshotId = await ctx.db.insert("invoiceSnapshots", snapshot);

    await Promise.all(
      lineItems.map(async (item) => {
        await ctx.db.insert("invoiceSnapshotLineItems", {
          organizationId: organization._id,
          invoiceId: invoice._id,
          snapshotId,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
          position: item.position,
        });
      }),
    );

    await ctx.db.patch(invoice._id, {
      publicToken: token,
      snapshotId,
      status: invoice.status === "draft" ? "ready" : invoice.status,
      updatedAt: now,
    });

    await writeEvent(
      ctx,
      organization._id,
      invoice._id,
      "updated",
      "Email template prepared with a secure invoice link. The invoice is not sent until the owner sends the email.",
      { actorType: "user", actorUserId: userId },
    );

    return { token, urlPath: `/invoice/${token}` };
  },
});

export const markSent = mutation({
  args: { id: v.id("invoices") },
  handler: async (ctx, args) => {
    const { userId, organization, invoice } = await requireOwnedInvoice(
      ctx,
      args.id,
    );

    if (!invoice.publicToken) {
      throw new Error("Prepare the email before marking this invoice sent");
    }

    if (invoice.status === "paid") {
      throw new Error("Paid invoices are already closed");
    }

    const now = Date.now();
    await ctx.db.patch(invoice._id, {
      status: "sent",
      sentAt: now,
      updatedAt: now,
    });

    await writeEvent(
      ctx,
      organization._id,
      invoice._id,
      "sent",
      "Business owner marked the invoice email as sent.",
      { actorType: "user", actorUserId: userId },
    );
  },
});

export const markPaid = mutation({
  args: {
    id: v.id("invoices"),
    providerReference: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, organization, invoice } = await requireOwnedInvoice(
      ctx,
      args.id,
    );
    const now = Date.now();

    await ctx.db.patch(invoice._id, {
      status: "paid",
      paidAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("paymentRecords", {
      organizationId: organization._id,
      invoiceId: invoice._id,
      provider: "manual",
      status: "paid",
      amount: invoice.amountTotal ?? invoice.amount ?? 0,
      currency: invoice.currency ?? organization.defaultCurrency,
      ...(clean(args.providerReference ?? "")
        ? { providerReference: clean(args.providerReference ?? "") }
        : {}),
      ...(invoice.paymentLink ? { paymentLink: invoice.paymentLink } : {}),
      createdAt: now,
    });

    await writeEvent(
      ctx,
      organization._id,
      invoice._id,
      "payment_marked",
      "Payment marked as received.",
      { actorType: "user", actorUserId: userId },
    );
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("invoices"),
    status: statusValidator,
  },
  handler: async (ctx, args) => {
    const { userId, organization, invoice } = await requireOwnedInvoice(
      ctx,
      args.id,
    );
    const now = Date.now();

    await ctx.db.patch(invoice._id, {
      status: args.status,
      updatedAt: now,
    });

    await writeEvent(
      ctx,
      organization._id,
      invoice._id,
      "status_changed",
      `Status changed to ${args.status.replace("_", " ")}.`,
      { actorType: "user", actorUserId: userId },
    );
  },
});

export const scheduleReminder = mutation({
  args: {
    id: v.id("invoices"),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, organization, invoice } = await requireOwnedInvoice(
      ctx,
      args.id,
    );
    const now = Date.now();
    const scheduledFor = now;
    const message = clean(
      args.message ?? "",
      `Reminder email prepared for ${invoice.clientName ?? invoice.client ?? "client"}.`,
    );

    await ctx.db.insert("reminders", {
      organizationId: organization._id,
      invoiceId: invoice._id,
      status: "scheduled",
      channel: "email",
      scheduledFor,
      message,
      createdAt: now,
    });

    await writeEvent(
      ctx,
      organization._id,
      invoice._id,
      "reminder_scheduled",
      message,
      { actorType: "user", actorUserId: userId },
    );

    return scheduledFor;
  },
});

export const getByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const invoice = await publicInvoiceByToken(ctx, args.token);

    if (!invoice || !invoice.organizationId) {
      return null;
    }

    const organization = await ctx.db.get(invoice.organizationId);
    const snapshot = invoice.snapshotId
      ? await ctx.db.get(invoice.snapshotId)
      : null;
    const lineItems = snapshot
      ? await ctx.db
          .query("invoiceSnapshotLineItems")
          .withIndex("by_snapshotId", (q) => q.eq("snapshotId", snapshot._id))
          .order("asc")
          .take(50)
      : await invoiceLineItems(ctx, invoice._id);
    const events = await ctx.db
      .query("invoiceEvents")
      .withIndex("by_invoiceId", (q) => q.eq("invoiceId", invoice._id))
      .order("desc")
      .take(10);

    return {
      organization,
      invoice,
      snapshot,
      lineItems,
      events,
    };
  },
});

export const markViewedByToken = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const invoice = await publicInvoiceByToken(ctx, args.token);

    if (
      !invoice ||
      !invoice.organizationId ||
      invoice.status !== "sent"
    ) {
      return null;
    }

    const now = Date.now();
    await ctx.db.patch(invoice._id, {
      status: "viewed",
      viewedAt: now,
      updatedAt: now,
    });

    await writeEvent(
      ctx,
      invoice.organizationId,
      invoice._id,
      "viewed",
      "Client opened the invoice.",
      {
        actorType: "client",
        ...(invoice.clientEmail ? { actorName: invoice.clientEmail } : {}),
      },
    );

    return invoice._id;
  },
});

export const approveByToken = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const invoice = await publicInvoiceByToken(ctx, args.token);

    if (!invoice || !invoice.organizationId) {
      throw new Error("Invoice not found");
    }

    const now = Date.now();
    await ctx.db.patch(invoice._id, {
      status: invoice.status === "paid" ? "paid" : "approved",
      approvedAt: now,
      updatedAt: now,
    });

    await writeEvent(
      ctx,
      invoice.organizationId,
      invoice._id,
      "approved",
      "Client approved the invoice. Payment is still tracked separately.",
      {
        actorType: "client",
        ...(invoice.clientEmail ? { actorName: invoice.clientEmail } : {}),
      },
    );

    if (invoice.paymentLink) {
      const existingPayment = await ctx.db
        .query("paymentRecords")
        .withIndex("by_invoiceId", (q) => q.eq("invoiceId", invoice._id))
        .take(1);

      if (existingPayment.length === 0) {
        await ctx.db.insert("paymentRecords", {
          organizationId: invoice.organizationId,
          invoiceId: invoice._id,
          provider: "external",
          status: "pending",
          amount: invoice.amountTotal ?? invoice.amount ?? 0,
          currency: invoice.currency ?? "USD",
          paymentLink: invoice.paymentLink,
          createdAt: now,
        });
      }
    }

    return invoice.paymentLink ?? null;
  },
});

export const rejectByToken = mutation({
  args: {
    token: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const invoice = await publicInvoiceByToken(ctx, args.token);

    if (!invoice || !invoice.organizationId) {
      throw new Error("Invoice not found");
    }

    if (invoice.status === "paid") {
      throw new Error("Paid invoices cannot be rejected");
    }

    const now = Date.now();
    const reason = clean(
      args.reason,
      "Client rejected the invoice and requested changes.",
    );

    await ctx.db.patch(invoice._id, {
      status: "rejected",
      rejectedAt: now,
      rejectionReason: reason,
      updatedAt: now,
    });

    await writeEvent(
      ctx,
      invoice.organizationId,
      invoice._id,
      "rejected",
      `Client rejected the invoice: ${reason}`,
      {
        actorType: "client",
        ...(invoice.clientEmail ? { actorName: invoice.clientEmail } : {}),
      },
    );

    return invoice._id;
  },
});
