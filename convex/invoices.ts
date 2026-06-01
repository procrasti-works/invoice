import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
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
  v.literal("void"),
);

const entityTypeValidator = v.union(
  v.literal("sole_proprietor"),
  v.literal("close_corporation"),
  v.literal("private_company"),
  v.literal("partnership"),
  v.literal("ngo"),
  v.literal("other"),
);

const vatRegistrationTypeValidator = v.union(
  v.literal("not_registered"),
  v.literal("voluntary"),
  v.literal("mandatory"),
);

const vatFilingFrequencyValidator = v.union(
  v.literal("monthly"),
  v.literal("bi_monthly"),
);

const vedTransmissionModeValidator = v.union(
  v.literal("manual_export"),
  v.literal("near_real_time"),
  v.literal("real_time"),
);

const lineItemValidator = v.object({
  description: v.string(),
  quantity: v.number(),
  unitPrice: v.number(),
  taxMode: v.optional(taxModeValidator),
});

const clientInputValidator = {
  clientId: v.optional(v.id("clients")),
  clientName: v.string(),
  clientEmail: v.optional(v.string()),
  clientPhone: v.optional(v.string()),
  clientAddress: v.optional(v.string()),
  clientVatNumber: v.optional(v.string()),
  clientTaxId: v.optional(v.string()),
};

type TaxMode = Doc<"invoices">["taxMode"];
type CalculatedLine = {
  description: string;
  quantity: number;
  unitPrice: number;
  taxMode: NonNullable<TaxMode>;
  vatRate: number;
  vatAmount: number;
  lineSubtotal: number;
  lineTotal: number;
  position: number;
};

const dayMs = 1000 * 60 * 60 * 24;
const vatRate = 0.15;
const reminderInvoiceStatuses: Array<Doc<"invoices">["status"]> = [
  "overdue",
  "awaiting_payment",
  "approved",
  "viewed",
  "sent",
];
const statsInvoiceStatuses: Array<Doc<"invoices">["status"]> = [
  "draft",
  "ready",
  "sent",
  "viewed",
  "approved",
  "awaiting_payment",
  "rejected",
  "paid",
  "overdue",
];
const defaultPaymentInstructions =
  "Pay by EFT or bank transfer using the invoice number as reference.";
const defaultTerms = "Payment due within 7 days unless otherwise agreed.";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function isoDaysFromNow(days: number) {
  return new Date(Date.now() + dayMs * days).toISOString().slice(0, 10);
}

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

function quantity(value: number) {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.max(0, Math.round(value * 1000) / 1000);
}

function cleanCurrency(value: string | undefined, fallback: string | undefined) {
  const currency = clean(value, fallback ?? "NAD").toUpperCase();

  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error("Currency must be a 3-letter code");
  }

  return currency;
}

function cleanPaymentLink(value: string | undefined) {
  const paymentLink = clean(value);

  if (paymentLink && !/^https?:\/\//i.test(paymentLink)) {
    throw new Error("Payment link must start with http:// or https://");
  }

  return paymentLink;
}

function cleanPrefix(value: string | undefined) {
  const prefix = clean(value, "INV").toUpperCase().replace(/[^A-Z0-9-]/g, "");
  return prefix.slice(0, 12) || "INV";
}

function generatePublicToken() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(36).padStart(2, "0")).join("");
}

function invoiceTotal(invoice: Doc<"invoices">) {
  return invoice.total ?? invoice.amountTotal ?? invoice.amount ?? 0;
}

function invoiceBalance(invoice: Doc<"invoices">) {
  return invoice.balanceDue ?? (invoice.status === "paid" ? 0 : invoiceTotal(invoice));
}

function organizationDisplayName(organization: Doc<"organizations">) {
  return clean(
    organization.tradingName,
    clean(organization.legalName, organization.name),
  );
}

function buildBankDetails(organization: Doc<"organizations">) {
  return {
    ...(maybeString(organization.bankName)
      ? { bankName: maybeString(organization.bankName) }
      : {}),
    ...(maybeString(organization.bankAccountName)
      ? { accountName: maybeString(organization.bankAccountName) }
      : {}),
    ...(maybeString(organization.bankAccountNumber)
      ? { accountNumber: maybeString(organization.bankAccountNumber) }
      : {}),
    ...(maybeString(organization.branchCode)
      ? { branchCode: maybeString(organization.branchCode) }
      : {}),
    ...(maybeString(organization.swiftCode)
      ? { swiftCode: maybeString(organization.swiftCode) }
      : {}),
  };
}

function buildBusinessSnapshot(organization: Doc<"organizations">) {
  return {
    name: organizationDisplayName(organization),
    ...(maybeString(organization.legalName)
      ? { legalName: maybeString(organization.legalName) }
      : {}),
    ...(maybeString(organization.tradingName)
      ? { tradingName: maybeString(organization.tradingName) }
      : {}),
    ...(maybeString(organization.phone) ? { phone: maybeString(organization.phone) } : {}),
    ...(maybeString(organization.address)
      ? { address: maybeString(organization.address) }
      : {}),
    ...(maybeString(organization.taxId) ? { taxId: maybeString(organization.taxId) } : {}),
    ...(maybeString(organization.vatNumber)
      ? { vatNumber: maybeString(organization.vatNumber) }
      : {}),
    vatRegistered: organization.vatRegistered ?? false,
  };
}

function buildClientSnapshot(input: {
  name: string;
  businessName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  vatNumber?: string;
}) {
  return {
    name: clean(input.name, "Client"),
    ...(maybeString(input.businessName) ? { businessName: maybeString(input.businessName) } : {}),
    ...(maybeString(input.contactName) ? { contactName: maybeString(input.contactName) } : {}),
    ...(maybeString(input.email) ? { email: maybeString(input.email) } : {}),
    ...(maybeString(input.phone) ? { phone: maybeString(input.phone) } : {}),
    ...(maybeString(input.address) ? { address: maybeString(input.address) } : {}),
    ...(maybeString(input.taxId) ? { taxId: maybeString(input.taxId) } : {}),
    ...(maybeString(input.vatNumber) ? { vatNumber: maybeString(input.vatNumber) } : {}),
  };
}

function normalizeTaxMode(
  requested: TaxMode | undefined,
  vatRegistered: boolean | undefined,
  defaultTaxMode?: TaxMode,
) {
  if (!vatRegistered) {
    return "no_vat" as const;
  }

  return requested ?? (defaultTaxMode && defaultTaxMode !== "no_vat" ? defaultTaxMode : "vat_15");
}

function calculateLines(
  rawLineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    taxMode?: TaxMode;
  }>,
  requestedTaxMode: TaxMode | undefined,
  vatRegistered: boolean | undefined,
  defaultTaxMode?: TaxMode,
) {
  const fallbackTaxMode = normalizeTaxMode(requestedTaxMode, vatRegistered, defaultTaxMode);
  const source = rawLineItems.length
    ? rawLineItems
    : [{ description: "Professional services", quantity: 1, unitPrice: 0 }];
  const lines: CalculatedLine[] = source.slice(0, 30).map((item, index) => {
    const itemTaxMode = normalizeTaxMode(
      item.taxMode ?? fallbackTaxMode,
      vatRegistered,
      defaultTaxMode,
    );
    const cleanQuantity = quantity(item.quantity || 1);
    const cleanUnitPrice = money(item.unitPrice);
    const lineSubtotal = money(cleanQuantity * cleanUnitPrice);
    const lineVat =
      itemTaxMode === "vat_15" ? money(lineSubtotal * vatRate) : 0;

    return {
      description: clean(item.description, "Invoice item"),
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

  return {
    lines,
    subtotal,
    vatAmount,
    total,
    taxMode: fallbackTaxMode,
  };
}

async function requireUserId(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);

  if (userId === null) {
    throw new Error("Authentication required");
  }

  return userId;
}

async function seedNextInvoiceSequence(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
) {
  const existingInvoices = await ctx.db
    .query("invoices")
    .withIndex("by_organizationId", (q) => q.eq("organizationId", organizationId))
    .take(1000);

  return existingInvoices.length + 1;
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

async function requireOwnedInvoice(
  ctx: QueryCtx | MutationCtx,
  invoiceId: Id<"invoices">,
  permission?: PermissionKey,
) {
  const { userId, organization } = await requireOrganization(ctx, permission);
  const invoice = await ctx.db.get(invoiceId);

  if (!invoice || invoice.organizationId !== organization._id) {
    throw new Error("Invoice not found");
  }

  return { userId, organization, invoice };
}

async function nextInvoiceNumber(
  ctx: MutationCtx,
  organization: Doc<"organizations">,
) {
  const sequence =
    organization.nextInvoiceSequence && organization.nextInvoiceSequence > 0
      ? organization.nextInvoiceSequence
      : await seedNextInvoiceSequence(ctx, organization._id);
  const prefix = cleanPrefix(organization.invoicePrefix);
  const invoiceNumber = `${prefix}-${new Date().getFullYear()}-${String(sequence).padStart(4, "0")}`;

  await ctx.db.patch(organization._id, {
    invoicePrefix: prefix,
    nextInvoiceSequence: sequence + 1,
    updatedAt: Date.now(),
  });

  return invoiceNumber;
}

async function getOrCreateClient(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  input: {
    name: string;
    businessName?: string;
    contactName?: string;
    email?: string;
    phone?: string;
    address?: string;
    vatNumber?: string;
    taxId?: string;
    paymentTerms?: string;
    notes?: string;
  },
) {
  const normalizedEmail = clean(input.email).toLowerCase();
  const inputName = clean(input.name, normalizedEmail || "Client");
  const businessName = maybeString(input.businessName);
  const contactName = maybeString(input.contactName);
  const now = Date.now();

  if (normalizedEmail.includes("@")) {
    const existing = await ctx.db
      .query("clients")
      .withIndex("by_organizationId_and_email", (q) =>
        q.eq("organizationId", organizationId).eq("email", normalizedEmail),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: clean(input.name, existing.name),
        ...(businessName ? { businessName, company: businessName } : {}),
        ...(contactName ? { contactName } : {}),
        ...(maybeString(input.phone) ? { phone: maybeString(input.phone) } : {}),
        ...(maybeString(input.address)
          ? { address: maybeString(input.address) }
          : {}),
        ...(maybeString(input.vatNumber)
          ? { vatNumber: maybeString(input.vatNumber) }
          : {}),
        ...(maybeString(input.taxId) ? { taxId: maybeString(input.taxId) } : {}),
        ...(maybeString(input.paymentTerms)
          ? { paymentTerms: maybeString(input.paymentTerms) }
          : {}),
        ...(maybeString(input.notes) ? { notes: maybeString(input.notes) } : {}),
        active: true,
        updatedAt: now,
      });
      return existing._id;
    }
  }

  return await ctx.db.insert("clients", {
    organizationId,
    name: inputName,
    ...(businessName ? { businessName, company: businessName } : {}),
    ...(contactName ? { contactName } : {}),
    email: normalizedEmail,
    ...(maybeString(input.phone) ? { phone: maybeString(input.phone) } : {}),
    ...(maybeString(input.address) ? { address: maybeString(input.address) } : {}),
    ...(maybeString(input.vatNumber)
      ? { vatNumber: maybeString(input.vatNumber) }
      : {}),
    ...(maybeString(input.taxId) ? { taxId: maybeString(input.taxId) } : {}),
    ...(maybeString(input.paymentTerms)
      ? { paymentTerms: maybeString(input.paymentTerms) }
      : {}),
    ...(maybeString(input.notes) ? { notes: maybeString(input.notes) } : {}),
    active: true,
    createdAt: now,
    updatedAt: now,
  });
}

async function resolveInvoiceClient(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  input: {
    clientId?: Id<"clients">;
    clientName: string;
    clientEmail?: string;
    clientPhone?: string;
    clientAddress?: string;
    clientVatNumber?: string;
    clientTaxId?: string;
    terms?: string;
  },
) {
  const selectedClient = input.clientId
    ? await ctx.db.get(input.clientId)
    : null;

  if (
    input.clientId &&
    (!selectedClient || selectedClient.organizationId !== organizationId)
  ) {
    throw new Error("Client not found");
  }

  const clientName = clean(input.clientName, selectedClient?.name ?? "Client");
  const clientEmail = clean(input.clientEmail, selectedClient?.email ?? "").toLowerCase();
  const clientPhone = clean(input.clientPhone, selectedClient?.phone ?? "");
  const clientAddress = clean(input.clientAddress, selectedClient?.address ?? "");
  const clientVatNumber = clean(input.clientVatNumber, selectedClient?.vatNumber ?? "");
  const clientTaxId = clean(input.clientTaxId, selectedClient?.taxId ?? "");
  const clientBusinessName = clean(
    selectedClient?.businessName ?? selectedClient?.company ?? "",
  );
  const clientContactName = clean(selectedClient?.contactName ?? "");
  const clientPaymentTerms = clean(selectedClient?.paymentTerms ?? "");
  const clientId =
    selectedClient?._id ??
    (await getOrCreateClient(ctx, organizationId, {
      name: clientName,
      email: clientEmail,
      phone: clientPhone,
      address: clientAddress,
      vatNumber: clientVatNumber,
      taxId: clientTaxId,
      paymentTerms: input.terms,
    }));

  return {
    clientId,
    clientName,
    clientEmail,
    clientPhone,
    clientAddress,
    clientVatNumber,
    clientTaxId,
    clientBusinessName,
    clientContactName,
    clientPaymentTerms,
  };
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

async function invoiceProofs(ctx: QueryCtx | MutationCtx, invoiceId: Id<"invoices">) {
  return await ctx.db
    .query("paymentProofs")
    .withIndex("by_invoiceId", (q) => q.eq("invoiceId", invoiceId))
    .order("desc")
    .take(10);
}

async function latestInvoiceProof(ctx: QueryCtx | MutationCtx, invoiceId: Id<"invoices">) {
  const proofs = await ctx.db
    .query("paymentProofs")
    .withIndex("by_invoiceId", (q) => q.eq("invoiceId", invoiceId))
    .order("desc")
    .take(1);

  return proofs[0] ?? null;
}

async function publicInvoiceByToken(ctx: QueryCtx | MutationCtx, token: string) {
  return await ctx.db
    .query("invoices")
    .withIndex("by_publicToken", (q) => q.eq("publicToken", token))
    .unique();
}

async function invoiceClient(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  invoice: Doc<"invoices">,
) {
  if (invoice.clientId) {
    const client = await ctx.db.get(invoice.clientId);

    if (client && client.organizationId === organizationId) {
      return client;
    }
  }

  const email = clean(invoice.clientEmail).toLowerCase();

  if (!email.includes("@")) {
    return null;
  }

  return await ctx.db
    .query("clients")
    .withIndex("by_organizationId_and_email", (q) =>
      q.eq("organizationId", organizationId).eq("email", email),
    )
    .unique();
}

async function replaceInvoiceLineItems(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  invoiceId: Id<"invoices">,
  calculatedLines: CalculatedLine[],
) {
  const existingLineItems = await invoiceLineItems(ctx, invoiceId);
  const now = Date.now();

  await Promise.all(existingLineItems.map((lineItem) => ctx.db.delete(lineItem._id)));

  await Promise.all(
    calculatedLines.map((item) =>
      ctx.db.insert("invoiceLineItems", {
        organizationId,
        invoiceId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxMode: item.taxMode,
        vatRate: item.vatRate,
        vatAmount: item.vatAmount,
        lineSubtotal: item.lineSubtotal,
        lineTotal: item.lineTotal,
        position: item.position,
        createdAt: now,
      }),
    ),
  );
}

async function recordPayment(
  ctx: MutationCtx,
  args: {
    invoiceId: Id<"invoices">;
    amount?: number;
    providerReference?: string;
    proofId?: Id<"paymentProofs">;
    notes?: string;
    actorUserId: Id<"users">;
  },
) {
  const { organization, invoice } = await requireOwnedInvoice(ctx, args.invoiceId);
  const now = Date.now();
  const paymentAmount = args.amount === undefined ? invoiceBalance(invoice) : money(args.amount);
  const remainingBalance = money(invoiceBalance(invoice) - paymentAmount);
  const paid = remainingBalance <= 0;

  await ctx.db.patch(invoice._id, {
    status: paid ? "paid" : "awaiting_payment",
    balanceDue: paid ? 0 : remainingBalance,
    ...(paid ? { paidAt: now } : {}),
    updatedAt: now,
  });

  await ctx.db.insert("paymentRecords", {
    organizationId: organization._id,
    invoiceId: invoice._id,
    provider: "manual",
    status: "paid",
    amount: paymentAmount,
    currency: invoice.currency ?? organization.defaultCurrency ?? "NAD",
    ...(maybeString(args.providerReference)
      ? { providerReference: maybeString(args.providerReference) }
      : {}),
    ...(invoice.paymentLink ? { paymentLink: invoice.paymentLink } : {}),
    ...(args.proofId ? { proofId: args.proofId } : {}),
    reviewedByUserId: args.actorUserId,
    reviewedAt: now,
    ...(maybeString(args.notes) ? { notes: maybeString(args.notes) } : {}),
    createdAt: now,
  });

  await writeEvent(
    ctx,
    organization._id,
    invoice._id,
    "payment_marked",
    paid
      ? "Payment accepted and invoice marked paid."
      : `Payment accepted. Balance due: ${remainingBalance.toFixed(2)}.`,
    { actorType: "user", actorUserId: args.actorUserId },
  );
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
    legalName: v.optional(v.string()),
    tradingName: v.optional(v.string()),
    entityType: v.optional(entityTypeValidator),
    region: v.optional(v.string()),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    taxId: v.optional(v.string()),
    vatNumber: v.optional(v.string()),
    vatRegistered: v.optional(v.boolean()),
    vatRegistrationType: v.optional(vatRegistrationTypeValidator),
    vatFilingFrequency: v.optional(vatFilingFrequencyValidator),
    vatReturnDueDay: v.optional(v.number()),
    vatRecordRetentionYears: v.optional(v.number()),
    vatDefaultTaxMode: v.optional(taxModeValidator),
    vedEnabled: v.optional(v.boolean()),
    vedTransmissionMode: v.optional(vedTransmissionModeValidator),
    itasRegistered: v.optional(v.boolean()),
    defaultCurrency: v.string(),
    defaultTerms: v.optional(v.string()),
    invoicePrefix: v.optional(v.string()),
    paymentInstructions: v.string(),
    paymentLink: v.optional(v.string()),
    bankName: v.optional(v.string()),
    bankAccountName: v.optional(v.string()),
    bankAccountNumber: v.optional(v.string()),
    branchCode: v.optional(v.string()),
    swiftCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { organization } = await requireOrganization(ctx, "manageSettings");

    const now = Date.now();
    const vatRegistered = args.vatRegistered ?? organization.vatRegistered ?? false;

    await ctx.db.patch(organization._id, {
      name: clean(args.name, organization.name),
      legalName: clean(args.legalName ?? "", organization.legalName ?? ""),
      tradingName: clean(args.tradingName ?? "", args.name),
      ...(args.entityType ? { entityType: args.entityType } : {}),
      region: clean(args.region ?? "", organization.region ?? ""),
      address: clean(args.address ?? "", organization.address ?? ""),
      phone: clean(args.phone ?? "", organization.phone ?? ""),
      taxId: clean(args.taxId ?? "", organization.taxId ?? ""),
      vatNumber: clean(args.vatNumber ?? "", organization.vatNumber ?? ""),
      vatRegistered,
      vatRegistrationType: vatRegistered
        ? args.vatRegistrationType ?? organization.vatRegistrationType ?? "mandatory"
        : "not_registered",
      vatFilingFrequency:
        args.vatFilingFrequency ?? organization.vatFilingFrequency ?? "monthly",
      vatReturnDueDay: args.vatReturnDueDay ?? organization.vatReturnDueDay ?? 25,
      vatRecordRetentionYears:
        args.vatRecordRetentionYears ?? organization.vatRecordRetentionYears ?? 5,
      vatDefaultTaxMode: vatRegistered
        ? args.vatDefaultTaxMode ?? organization.vatDefaultTaxMode ?? "vat_15"
        : "no_vat",
      vedEnabled: vatRegistered
        ? args.vedEnabled ?? organization.vedEnabled ?? true
        : false,
      vedTransmissionMode:
        args.vedTransmissionMode ?? organization.vedTransmissionMode ?? "manual_export",
      itasRegistered: args.itasRegistered ?? organization.itasRegistered ?? false,
      defaultCurrency: cleanCurrency(args.defaultCurrency, organization.defaultCurrency),
      defaultTerms: clean(args.defaultTerms ?? "", organization.defaultTerms ?? defaultTerms),
      invoicePrefix: cleanPrefix(args.invoicePrefix ?? organization.invoicePrefix),
      paymentInstructions: clean(
        args.paymentInstructions,
        organization.paymentInstructions || defaultPaymentInstructions,
      ),
      paymentLink: cleanPaymentLink(args.paymentLink),
      bankName: clean(args.bankName ?? "", organization.bankName ?? ""),
      bankAccountName: clean(
        args.bankAccountName ?? "",
        organization.bankAccountName ?? "",
      ),
      bankAccountNumber: clean(
        args.bankAccountNumber ?? "",
        organization.bankAccountNumber ?? "",
      ),
      branchCode: clean(args.branchCode ?? "", organization.branchCode ?? ""),
      swiftCode: clean(args.swiftCode ?? "", organization.swiftCode ?? ""),
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
      .take(60);
    const submittedProofs = await ctx.db
      .query("paymentProofs")
      .withIndex("by_organizationId_and_status", (q) =>
        q.eq("organizationId", organization._id).eq("status", "submitted"),
      )
      .order("desc")
      .take(100);
    const proofsByInvoice = new Map<Id<"invoices">, Doc<"paymentProofs">[]>();

    for (const proof of submittedProofs) {
      const proofs = proofsByInvoice.get(proof.invoiceId) ?? [];
      proofs.push(proof);
      proofsByInvoice.set(proof.invoiceId, proofs);
    }

    const invoiceIds = new Set(invoices.map((invoice) => invoice._id));
    const recentEvents =
      invoices.length > 0
        ? await ctx.db
            .query("invoiceEvents")
            .withIndex("by_organizationId_and_createdAt", (q) =>
              q.eq("organizationId", organization._id),
            )
            .order("desc")
            .take(240)
        : [];
    const eventsByInvoice = new Map<Id<"invoices">, Doc<"invoiceEvents">[]>();

    for (const event of recentEvents) {
      if (!invoiceIds.has(event.invoiceId)) {
        continue;
      }

      const events = eventsByInvoice.get(event.invoiceId) ?? [];

      if (events.length < 3) {
        events.push(event);
        eventsByInvoice.set(event.invoiceId, events);
      }
    }

    return invoices.map((invoice) => ({
      invoice,
      client: null,
      events: eventsByInvoice.get(invoice._id) ?? [],
      lineItems: [],
      paymentProofs: proofsByInvoice.get(invoice._id) ?? [],
    }));
  },
});

export const listRecords = query({
  args: {
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

    const rows =
      args.from && args.to
        ? await ctx.db
            .query("invoices")
            .withIndex("by_organizationId_and_issueDate", (q) =>
              q
                .eq("organizationId", organization._id)
                .gte("issueDate", args.from as string)
                .lte("issueDate", args.to as string),
            )
            .order("desc")
            .take(300)
        : await ctx.db
            .query("invoices")
            .withIndex("by_organizationId", (q) =>
              q.eq("organizationId", organization._id),
            )
            .order("desc")
            .take(300);

    return rows.map((invoice) => ({ invoice }));
  },
});

export const getEditDetails = query({
  args: {
    id: v.id("invoices"),
  },
  handler: async (ctx, args) => {
    const { organization } = await requireOrganization(ctx);
    const invoice = await ctx.db.get(args.id);

    if (!invoice || invoice.organizationId !== organization._id) {
      throw new Error("Invoice not found");
    }

    const lineItems = await invoiceLineItems(ctx, invoice._id);
    const client = await invoiceClient(ctx, organization._id, invoice);

    return { invoice, client, lineItems };
  },
});

export const listReminderQueue = query({
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

    const invoiceGroups = await Promise.all(
      reminderInvoiceStatuses.map((status) =>
        ctx.db
          .query("invoices")
          .withIndex("by_organizationId_and_status", (q) =>
            q.eq("organizationId", organization._id).eq("status", status),
          )
          .order("desc")
          .take(40),
      ),
    );
    const invoices = invoiceGroups
      .flat()
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 100);
    const invoiceIds = new Set(invoices.map((invoice) => invoice._id));
    const [clients, recentReminders] =
      invoices.length > 0
        ? await Promise.all([
            ctx.db
              .query("clients")
              .withIndex("by_organizationId", (q) =>
                q.eq("organizationId", organization._id),
              )
              .order("desc")
              .take(250),
            ctx.db
              .query("reminders")
              .withIndex("by_organizationId_and_scheduledFor", (q) =>
                q.eq("organizationId", organization._id),
              )
              .order("desc")
              .take(500),
          ])
        : [[], []];
    const clientsById = new Map(clients.map((client) => [client._id, client]));
    const clientsByEmail = new Map(
      clients
        .filter((client) => client.email.includes("@"))
        .map((client) => [client.email.toLowerCase(), client]),
    );
    const remindersByInvoice = new Map<Id<"invoices">, Doc<"reminders">[]>();

    for (const reminder of recentReminders) {
      if (!invoiceIds.has(reminder.invoiceId)) {
        continue;
      }

      const reminders = remindersByInvoice.get(reminder.invoiceId) ?? [];

      if (reminders.length < 5) {
        reminders.push(reminder);
        remindersByInvoice.set(reminder.invoiceId, reminders);
      }
    }

    return invoices.map((invoice) => {
      const client =
        (invoice.clientId ? clientsById.get(invoice.clientId) : null) ??
        clientsByEmail.get(clean(invoice.clientEmail).toLowerCase()) ??
        null;

      return {
        invoice,
        client,
        reminders: remindersByInvoice.get(invoice._id) ?? [],
      };
    });
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
      vatCollected: 0,
      vatOutstanding: 0,
    };

    if (userId === null) {
      return empty;
    }

    const organization = await getExistingOrganization(ctx, userId);

    if (!organization) {
      return empty;
    }

    const invoiceGroups = await Promise.all(
      statsInvoiceStatuses.map((status) =>
        ctx.db
          .query("invoices")
          .withIndex("by_organizationId_and_status", (q) =>
            q.eq("organizationId", organization._id).eq("status", status),
          )
          .order("desc")
          .take(250),
      ),
    );
    const invoices = invoiceGroups.flat();

    return invoices.reduce((totals, invoice) => {
      if (invoice.status === "void") {
        return totals;
      }

      const total = invoiceTotal(invoice);
      totals.invoiceCount += 1;

      if (invoice.status === "paid") {
        totals.paidCount += 1;
        totals.totalPaid += total;
        totals.vatCollected += invoice.vatAmount ?? 0;
      } else {
        totals.totalOutstanding += invoiceBalance(invoice);
        totals.vatOutstanding += invoice.vatAmount ?? 0;
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

export const listClients = query({
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
      .query("clients")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", organization._id))
      .order("desc")
      .take(150);
  },
});

export const upsertClient = mutation({
  args: {
    id: v.optional(v.id("clients")),
    name: v.string(),
    businessName: v.optional(v.string()),
    contactName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    vatNumber: v.optional(v.string()),
    taxId: v.optional(v.string()),
    paymentTerms: v.optional(v.string()),
    notes: v.optional(v.string()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { organization } = await requireOrganization(ctx, "manageClients");

    const now = Date.now();
    const email = clean(args.email).toLowerCase();
    const businessName = clean(args.businessName ?? "", "");
    const basePatch = {
      name: clean(args.name, "Client"),
      businessName,
      contactName: clean(args.contactName ?? "", ""),
      email,
      company: businessName,
      phone: clean(args.phone ?? "", ""),
      address: clean(args.address ?? "", ""),
      vatNumber: clean(args.vatNumber ?? "", ""),
      taxId: clean(args.taxId ?? "", ""),
      paymentTerms: clean(args.paymentTerms ?? "", ""),
      notes: clean(args.notes ?? "", ""),
      active: args.active ?? true,
      updatedAt: now,
    };

    if (args.id) {
      const existing = await ctx.db.get(args.id);

      if (!existing || existing.organizationId !== organization._id) {
        throw new Error("Client not found");
      }

      await ctx.db.patch(existing._id, basePatch);
      return existing._id;
    }

    if (email.includes("@")) {
      const existing = await ctx.db
        .query("clients")
        .withIndex("by_organizationId_and_email", (q) =>
          q.eq("organizationId", organization._id).eq("email", email),
        )
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, basePatch);
        return existing._id;
      }
    }

    return await ctx.db.insert("clients", {
      organizationId: organization._id,
      createdAt: now,
      ...basePatch,
    });
  },
});

export const createDraft = mutation({
  args: {
    ...clientInputValidator,
    dueDate: v.string(),
    currency: v.optional(v.string()),
    exchangeRateSnapshot: v.optional(v.number()),
    taxMode: v.optional(taxModeValidator),
    terms: v.optional(v.string()),
    notes: v.optional(v.string()),
    paymentInstructions: v.optional(v.string()),
    paymentLink: v.optional(v.string()),
    paymentReference: v.optional(v.string()),
    requiresApproval: v.optional(v.boolean()),
    lineItems: v.array(lineItemValidator),
  },
  handler: async (ctx, args) => {
    const { userId, organization } = await requireOrganization(ctx, "createInvoices");

    const client = await resolveInvoiceClient(ctx, organization._id, args);
    const now = Date.now();
    const invoiceNumber = await nextInvoiceNumber(ctx, organization);
    const calculated = calculateLines(
      args.lineItems,
      args.taxMode,
      organization.vatRegistered,
      organization.vatDefaultTaxMode,
    );
    const trimmedPaymentLink = clean(
      args.paymentLink,
      organization.paymentLink ?? "",
    );
    const currency = cleanCurrency(args.currency, organization.defaultCurrency);
    const dueDate = clean(args.dueDate, isoDaysFromNow(7));
    const terms = clean(
      args.terms,
      client.clientPaymentTerms || organization.defaultTerms || defaultTerms,
    );
    const paymentReference = clean(args.paymentReference, invoiceNumber);
    const invoiceId = await ctx.db.insert("invoices", {
      organizationId: organization._id,
      clientId: client.clientId,
      createdByUserId: userId,
      invoiceNumber,
      clientName: client.clientName,
      clientEmail: client.clientEmail,
      status: calculated.total > 0 ? "ready" : "draft",
      amount: calculated.total,
      amountTotal: calculated.total,
      subtotal: calculated.subtotal,
      vatAmount: calculated.vatAmount,
      total: calculated.total,
      balanceDue: calculated.total,
      taxMode: calculated.taxMode,
      currency,
      exchangeRateSnapshot: args.exchangeRateSnapshot,
      issueDate: todayIso(),
      dueDate,
      terms,
      notes: clean(args.notes),
      paymentInstructions: clean(
        args.paymentInstructions,
        organization.paymentInstructions,
      ),
      paymentReference,
      requiresApproval: args.requiresApproval ?? false,
      bankDetails: buildBankDetails(organization),
      supplierSnapshot: buildBusinessSnapshot(organization),
      clientSnapshot: buildClientSnapshot({
        name: client.clientName,
        businessName: client.clientBusinessName,
        contactName: client.clientContactName,
        email: client.clientEmail,
        phone: client.clientPhone,
        address: client.clientAddress,
        taxId: client.clientTaxId,
        vatNumber: client.clientVatNumber,
      }),
      ...(trimmedPaymentLink ? { paymentLink: trimmedPaymentLink } : {}),
      createdAt: now,
      updatedAt: now,
    });

    await replaceInvoiceLineItems(
      ctx,
      organization._id,
      invoiceId,
      calculated.lines,
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

export const createInvoiceDraft = createDraft;

export const amend = mutation({
  args: {
    id: v.id("invoices"),
    ...clientInputValidator,
    dueDate: v.string(),
    currency: v.optional(v.string()),
    exchangeRateSnapshot: v.optional(v.number()),
    taxMode: v.optional(taxModeValidator),
    terms: v.optional(v.string()),
    notes: v.optional(v.string()),
    paymentInstructions: v.optional(v.string()),
    paymentLink: v.optional(v.string()),
    paymentReference: v.optional(v.string()),
    requiresApproval: v.optional(v.boolean()),
    lineItems: v.array(lineItemValidator),
  },
  handler: async (ctx, args) => {
    const { userId, organization, invoice } = await requireOwnedInvoice(
      ctx,
      args.id,
      "createInvoices",
    );

    if (
      invoice.status !== "draft" &&
      invoice.status !== "ready" &&
      invoice.status !== "rejected"
    ) {
      throw new Error("Only draft, ready, or rejected invoices can be amended");
    }

    const client = await resolveInvoiceClient(ctx, organization._id, args);
    const now = Date.now();
    const calculated = calculateLines(
      args.lineItems,
      args.taxMode,
      organization.vatRegistered,
      organization.vatDefaultTaxMode,
    );
    const trimmedPaymentLink = clean(
      args.paymentLink,
      organization.paymentLink ?? "",
    );

    await replaceInvoiceLineItems(
      ctx,
      organization._id,
      invoice._id,
      calculated.lines,
    );

    await ctx.db.patch(invoice._id, {
      clientId: client.clientId,
      clientName: client.clientName,
      clientEmail: client.clientEmail,
      status: calculated.total > 0 ? "ready" : "draft",
      amount: calculated.total,
      amountTotal: calculated.total,
      subtotal: calculated.subtotal,
      vatAmount: calculated.vatAmount,
      total: calculated.total,
      balanceDue: calculated.total,
      taxMode: calculated.taxMode,
      currency: cleanCurrency(args.currency, organization.defaultCurrency),
      exchangeRateSnapshot: args.exchangeRateSnapshot,
      dueDate: clean(args.dueDate, isoDaysFromNow(7)),
      terms: clean(
        args.terms,
        client.clientPaymentTerms || organization.defaultTerms || defaultTerms,
      ),
      notes: clean(args.notes),
      paymentInstructions: clean(
        args.paymentInstructions,
        organization.paymentInstructions,
      ),
      paymentLink: trimmedPaymentLink,
      paymentReference: clean(args.paymentReference, invoice.paymentReference ?? invoice.invoiceNumber),
      requiresApproval: args.requiresApproval ?? false,
      bankDetails: buildBankDetails(organization),
      supplierSnapshot: buildBusinessSnapshot(organization),
      clientSnapshot: buildClientSnapshot({
        name: client.clientName,
        businessName: client.clientBusinessName,
        contactName: client.clientContactName,
        email: client.clientEmail,
        phone: client.clientPhone,
        address: client.clientAddress,
        taxId: client.clientTaxId,
        vatNumber: client.clientVatNumber,
      }),
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

export const updateInvoiceDraft = amend;

export const send = mutation({
  args: { id: v.id("invoices") },
  handler: async (ctx, args) => {
    const { userId, organization, invoice } = await requireOwnedInvoice(
      ctx,
      args.id,
      "sendInvoices",
    );

    if (invoice.status === "void") {
      throw new Error("Voided invoices cannot be issued");
    }

    if (invoiceTotal(invoice) <= 0) {
      throw new Error("Add at least one billable line item before issuing");
    }

    const now = Date.now();
    const token = invoice.publicToken ?? generatePublicToken();
    const lineItems = await invoiceLineItems(ctx, invoice._id);
    const snapshot = {
      organizationId: organization._id,
      invoiceId: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      clientName: invoice.clientName ?? invoice.client ?? "Client",
      clientEmail: invoice.clientEmail ?? "",
      amountTotal: invoiceTotal(invoice),
      subtotal: invoice.subtotal ?? invoiceTotal(invoice),
      vatAmount: invoice.vatAmount ?? 0,
      total: invoiceTotal(invoice),
      taxMode: invoice.taxMode ?? "no_vat",
      balanceDue: invoiceBalance(invoice),
      currency: invoice.currency ?? organization.defaultCurrency ?? "NAD",
      exchangeRateSnapshot: invoice.exchangeRateSnapshot,
      issueDate: invoice.issueDate ?? todayIso(),
      dueDate: invoice.dueDate,
      terms: invoice.terms ?? organization.defaultTerms ?? defaultTerms,
      notes: invoice.notes ?? "",
      paymentInstructions:
        invoice.paymentInstructions ?? organization.paymentInstructions,
      paymentReference: invoice.paymentReference ?? invoice.invoiceNumber,
      requiresApproval: invoice.requiresApproval ?? false,
      bankDetails: invoice.bankDetails ?? buildBankDetails(organization),
      supplierSnapshot:
        invoice.supplierSnapshot ?? buildBusinessSnapshot(organization),
      clientSnapshot:
        invoice.clientSnapshot ??
        buildClientSnapshot({
          name: invoice.clientName ?? invoice.client ?? "Client",
          email: invoice.clientEmail,
        }),
      createdAt: now,
      ...(invoice.paymentLink ? { paymentLink: invoice.paymentLink } : {}),
    };
    const snapshotId = await ctx.db.insert("invoiceSnapshots", snapshot);

    await Promise.all(
      lineItems.map((item) =>
        ctx.db.insert("invoiceSnapshotLineItems", {
          organizationId: organization._id,
          invoiceId: invoice._id,
          snapshotId,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxMode: item.taxMode ?? invoice.taxMode ?? "no_vat",
          vatRate: item.vatRate ?? 0,
          vatAmount: item.vatAmount ?? 0,
          lineSubtotal: item.lineSubtotal ?? item.lineTotal,
          lineTotal: item.lineTotal,
          position: item.position,
        }),
      ),
    );

    await ctx.db.patch(invoice._id, {
      publicToken: token,
      snapshotId,
      status: invoice.status === "draft" ? "ready" : invoice.status,
      balanceDue: invoiceBalance(invoice),
      updatedAt: now,
    });

    await writeEvent(
      ctx,
      organization._id,
      invoice._id,
      "updated",
      "Secure client link prepared. Send it by email or WhatsApp from your business account.",
      { actorType: "user", actorUserId: userId },
    );

    return { token, urlPath: `/invoice/${token}` };
  },
});

export const issueInvoice = send;

export const markSent = mutation({
  args: { id: v.id("invoices") },
  handler: async (ctx, args) => {
    const { userId, organization, invoice } = await requireOwnedInvoice(
      ctx,
      args.id,
      "sendInvoices",
    );

    if (!invoice.publicToken) {
      throw new Error("Prepare the client link before marking this invoice sent");
    }

    if (invoice.status === "paid" || invoice.status === "void") {
      throw new Error("This invoice is already closed");
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
      "Business owner marked the invoice link as sent.",
      { actorType: "user", actorUserId: userId },
    );
  },
});

export const markPaid = mutation({
  args: {
    id: v.id("invoices"),
    amount: v.optional(v.number()),
    providerReference: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireOrganization(ctx, "recordPayments");
    await recordPayment(ctx, {
      invoiceId: args.id,
      amount: args.amount,
      providerReference: args.providerReference,
      notes: args.notes,
      actorUserId: userId,
    });
  },
});

export const recordManualPayment = markPaid;

export const updateStatus = mutation({
  args: {
    id: v.id("invoices"),
    status: statusValidator,
  },
  handler: async (ctx, args) => {
    const { userId, organization, invoice } = await requireOwnedInvoice(
      ctx,
      args.id,
      args.status === "void" ? "voidInvoices" : "sendInvoices",
    );
    const now = Date.now();

    await ctx.db.patch(invoice._id, {
      status: args.status,
      ...(args.status === "void" ? { voidedAt: now } : {}),
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

export const voidInvoice = mutation({
  args: { id: v.id("invoices"), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { userId, organization, invoice } = await requireOwnedInvoice(
      ctx,
      args.id,
      "voidInvoices",
    );

    if (invoice.status === "paid") {
      throw new Error("Paid invoices cannot be voided");
    }

    const now = Date.now();
    await ctx.db.patch(invoice._id, {
      status: "void",
      voidedAt: now,
      balanceDue: 0,
      notes: clean(args.reason, invoice.notes ?? ""),
      updatedAt: now,
    });

    await writeEvent(
      ctx,
      organization._id,
      invoice._id,
      "status_changed",
      clean(args.reason, "Invoice voided."),
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
      "sendInvoices",
    );
    const now = Date.now();
    const message = clean(
      args.message,
      `Reminder prepared for ${invoice.clientName ?? invoice.client ?? "client"}.`,
    );

    await ctx.db.insert("reminders", {
      organizationId: organization._id,
      invoiceId: invoice._id,
      ...(invoice.clientId ? { clientId: invoice.clientId } : {}),
      status: "scheduled",
      channel: "manual",
      scheduledFor: now,
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

    return now;
  },
});

export const listPaymentProofs = query({
  args: {
    status: v.optional(
      v.union(v.literal("submitted"), v.literal("accepted"), v.literal("rejected")),
    ),
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

    const status = args.status ?? "submitted";
    const proofs = await ctx.db
      .query("paymentProofs")
      .withIndex("by_organizationId_and_status", (q) =>
        q.eq("organizationId", organization._id).eq("status", status),
      )
      .order("desc")
      .take(100);

    return await Promise.all(
      proofs.map(async (proof) => {
        const invoice = await ctx.db.get(proof.invoiceId);
        const proofFileUrl = proof.storageId
          ? await ctx.storage.getUrl(proof.storageId)
          : null;

        return { proof, invoice, proofFileUrl };
      }),
    );
  },
});

export const reviewPaymentProof = mutation({
  args: {
    proofId: v.id("paymentProofs"),
    status: v.union(v.literal("accepted"), v.literal("rejected")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, organization } = await requireOrganization(ctx, "recordPayments");
    const proof = await ctx.db.get(args.proofId);

    if (!proof || proof.organizationId !== organization._id) {
      throw new Error("Payment proof not found");
    }

    if (proof.status !== "submitted") {
      throw new Error("Payment proof has already been reviewed");
    }

    const invoice = await ctx.db.get(proof.invoiceId);

    if (!invoice || invoice.organizationId !== organization._id) {
      throw new Error("Invoice not found");
    }

    const now = Date.now();
    await ctx.db.patch(proof._id, {
      status: args.status,
      reviewerUserId: userId,
      reviewedAt: now,
      notes: clean(args.notes),
      updatedAt: now,
    });

    if (args.status === "accepted") {
      await recordPayment(ctx, {
        invoiceId: invoice._id,
        amount: proof.amount,
        providerReference: proof.bankReference,
        proofId: proof._id,
        notes: args.notes,
        actorUserId: userId,
      });
    } else {
      await writeEvent(
        ctx,
        organization._id,
        invoice._id,
        "status_changed",
        "Payment proof rejected. Invoice remains unpaid.",
        { actorType: "user", actorUserId: userId },
      );
    }
  },
});

export const generatePaymentProofUploadUrl = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const invoice = await publicInvoiceByToken(ctx, args.token);

    if (!invoice || !invoice.organizationId || invoice.status === "void") {
      throw new Error("Invoice not found");
    }

    if (invoice.status === "paid") {
      throw new Error("This invoice is already marked paid");
    }

    if (
      (invoice.requiresApproval ?? false) &&
      invoice.status !== "approved" &&
      invoice.status !== "awaiting_payment"
    ) {
      throw new Error("Approve this invoice before uploading payment proof");
    }

    const existingProof = await latestInvoiceProof(ctx, invoice._id);

    if (existingProof) {
      throw new Error("Payment details have already been submitted");
    }

    return await ctx.storage.generateUploadUrl();
  },
});

export const getByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const invoice = await publicInvoiceByToken(ctx, args.token);

    if (!invoice || !invoice.organizationId || invoice.status === "void") {
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
    const paymentProofs = await invoiceProofs(ctx, invoice._id);

    return {
      organization,
      invoice,
      snapshot,
      lineItems,
      events,
      paymentProofs,
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

    if (!invoice || !invoice.organizationId || invoice.status === "void") {
      throw new Error("Invoice not found");
    }

    if (!(invoice.requiresApproval ?? false)) {
      throw new Error("This invoice does not require client approval");
    }

    if (invoice.status === "rejected") {
      throw new Error("Rejected invoices must be amended before approval");
    }

    if (invoice.status === "paid") {
      throw new Error("Paid invoices do not need approval");
    }

    const now = Date.now();
    await ctx.db.patch(invoice._id, {
      status: "approved",
      approvedAt: now,
      updatedAt: now,
    });

    await writeEvent(
      ctx,
      invoice.organizationId,
      invoice._id,
      "approved",
      "Client approved the invoice. Payment is still confirmed by the sender.",
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
          amount: invoiceTotal(invoice),
          currency: invoice.currency ?? "NAD",
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

    if (!invoice || !invoice.organizationId || invoice.status === "void") {
      throw new Error("Invoice not found");
    }

    if (invoice.status === "paid") {
      throw new Error("Paid invoices cannot be rejected");
    }

    if (
      invoice.status === "approved" ||
      invoice.status === "awaiting_payment"
    ) {
      throw new Error("Approved invoices cannot be rejected");
    }

    if (!(invoice.requiresApproval ?? false)) {
      throw new Error("This invoice does not require client approval");
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

export const submitPaymentProofByToken = mutation({
  args: {
    token: v.string(),
    payerName: v.string(),
    amount: v.number(),
    paymentDate: v.string(),
    bankReference: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const invoice = await publicInvoiceByToken(ctx, args.token);

    if (!invoice || !invoice.organizationId || invoice.status === "void") {
      throw new Error("Invoice not found");
    }

    if (invoice.status === "paid") {
      throw new Error("This invoice is already marked paid");
    }

    const existingProof = await latestInvoiceProof(ctx, invoice._id);

    if (existingProof) {
      throw new Error("Payment details have already been submitted");
    }

    if (
      (invoice.requiresApproval ?? false) &&
      invoice.status !== "approved" &&
      invoice.status !== "awaiting_payment"
    ) {
      throw new Error("Approve this invoice before submitting payment proof");
    }

    const now = Date.now();
    const proofId = await ctx.db.insert("paymentProofs", {
      organizationId: invoice.organizationId,
      invoiceId: invoice._id,
      publicToken: args.token,
      payerName: clean(args.payerName, invoice.clientName ?? "Client"),
      amount: money(args.amount),
      currency: invoice.currency ?? "NAD",
      paymentDate: clean(args.paymentDate, todayIso()),
      ...(maybeString(args.bankReference)
        ? { bankReference: maybeString(args.bankReference) }
        : {}),
      ...(args.storageId ? { storageId: args.storageId } : {}),
      ...(maybeString(args.fileName) ? { fileName: maybeString(args.fileName) } : {}),
      status: "submitted",
      ...(maybeString(args.notes) ? { notes: maybeString(args.notes) } : {}),
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(invoice._id, {
      status: "awaiting_payment",
      updatedAt: now,
    });

    await writeEvent(
      ctx,
      invoice.organizationId,
      invoice._id,
      "payment_marked",
      "Client submitted proof of payment for owner review.",
      {
        actorType: "client",
        ...(invoice.clientEmail ? { actorName: invoice.clientEmail } : {}),
      },
    );

    return proofId;
  },
});
