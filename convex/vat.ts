import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import {
  getExistingOrganization,
  requireOrganizationPermission,
} from "./organizationContext";

const standardVatRate = 0.15;
const defaultReturnDueDay = 25;
const defaultRetentionYears = 5;

const taxModeValidator = v.union(
  v.literal("no_vat"),
  v.literal("vat_15"),
  v.literal("zero_rated"),
  v.literal("exempt"),
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

type TaxMode = NonNullable<Doc<"organizations">["vatDefaultTaxMode"]>;
type VatSettings = ReturnType<typeof vatSettingsForOrganization>;

function clean(value: string | undefined, fallback = "") {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function money(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.round(value * 100) / 100);
}

function clampInt(value: number | undefined, fallback: number, min: number, max: number) {
  if (!Number.isFinite(value ?? Number.NaN)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(value ?? fallback)));
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartIso(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
}

function monthEndIso(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))
    .toISOString()
    .slice(0, 10);
}

function addYearsIso(date: string, years: number) {
  const parsed = new Date(`${date}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return new Date(
    Date.UTC(parsed.getUTCFullYear() + years, parsed.getUTCMonth(), parsed.getUTCDate()),
  )
    .toISOString()
    .slice(0, 10);
}

function vatDueDate(periodTo: string, dueDay: number) {
  const parsed = new Date(`${periodTo}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return new Date(
    Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, dueDay),
  )
    .toISOString()
    .slice(0, 10);
}

function organizationDisplayName(organization: Doc<"organizations">) {
  return clean(
    organization.tradingName,
    clean(organization.legalName, organization.name),
  );
}

function vatSettingsForOrganization(organization: Doc<"organizations">) {
  const vatRegistered = organization.vatRegistered ?? false;
  const registrationType = vatRegistered
    ? organization.vatRegistrationType === "voluntary" ||
      organization.vatRegistrationType === "mandatory"
      ? organization.vatRegistrationType
      : "mandatory"
    : "not_registered";
  const defaultTaxMode: TaxMode = vatRegistered
    ? organization.vatDefaultTaxMode && organization.vatDefaultTaxMode !== "no_vat"
      ? organization.vatDefaultTaxMode
      : "vat_15"
    : "no_vat";
  const returnDueDay = clampInt(
    organization.vatReturnDueDay,
    defaultReturnDueDay,
    1,
    28,
  );
  const retentionYears = clampInt(
    organization.vatRecordRetentionYears,
    defaultRetentionYears,
    defaultRetentionYears,
    10,
  );
  return {
    vatRegistered,
    vatNumber: organization.vatNumber ?? "",
    taxId: organization.taxId ?? "",
    vatRate: standardVatRate,
    registrationType,
    filingFrequency: organization.vatFilingFrequency ?? "monthly",
    returnDueDay,
    recordRetentionYears: retentionYears,
    defaultTaxMode,
    vedEnabled: vatRegistered && (organization.vedEnabled ?? true),
  };
}

function taxModeLabel(taxMode: TaxMode) {
  if (taxMode === "vat_15") {
    return "VAT 15%";
  }

  if (taxMode === "zero_rated") {
    return "Zero-rated";
  }

  if (taxMode === "exempt") {
    return "Exempt";
  }

  return "No VAT";
}

function vatRateForMode(taxMode: TaxMode) {
  return taxMode === "vat_15" ? standardVatRate : 0;
}

function invoiceTotal(invoice: Doc<"invoices">) {
  return invoice.total ?? invoice.amountTotal ?? invoice.amount ?? 0;
}

function invoiceTaxMode(invoice: Doc<"invoices">): TaxMode {
  return invoice.taxMode ?? "no_vat";
}

function isIssuedInvoice(invoice: Doc<"invoices">) {
  return (
    invoice.status !== "draft" &&
    invoice.status !== "ready" &&
    invoice.status !== "void" &&
    Boolean(invoice.publicToken || invoice.snapshotId || invoice.sentAt)
  );
}

function buildSaleMissingFields(
  invoice: Doc<"invoices">,
  organization: Doc<"organizations">,
  settings: VatSettings,
  hasLineItems: boolean,
) {
  const missing: string[] = [];
  const supplier = invoice.supplierSnapshot;
  const client = invoice.clientSnapshot;
  const total = invoiceTotal(invoice);
  const taxable = settings.vatRegistered && invoiceTaxMode(invoice) === "vat_15";

  if (taxable) {
    if (!clean(supplier?.name, organizationDisplayName(organization))) {
      missing.push("Supplier name");
    }
    if (!settings.vatNumber && !supplier?.vatNumber) {
      missing.push("Supplier VAT number");
    }
    if (!clean(supplier?.address, organization.address ?? "")) {
      missing.push("Supplier address");
    }
    if (total > 500 && !clean(client?.address)) {
      missing.push("Customer address");
    }
  }

  if (!clean(invoice.invoiceNumber)) {
    missing.push("Sequential invoice number");
  }
  if (!clean(invoice.issueDate)) {
    missing.push("Date of issue");
  }
  if (!clean(invoice.clientName ?? invoice.client ?? "")) {
    missing.push("Customer name");
  }
  if (!hasLineItems) {
    missing.push("Description, quantity, and unit price");
  }
  if (taxable) {
    if (invoice.subtotal === undefined) {
      missing.push("Amount excluding VAT");
    }
    if (invoice.vatAmount === undefined) {
      missing.push("VAT amount");
    }
    if (invoice.total === undefined && invoice.amountTotal === undefined && invoice.amount === undefined) {
      missing.push("VAT-inclusive total");
    }
  }

  return missing;
}

function buildPurchaseMissingFields(purchase: Doc<"purchases">, hasLineItems: boolean) {
  const missing: string[] = [];

  if (!clean(purchase.supplierName)) {
    missing.push("Supplier name");
  }
  if (purchase.taxMode === "vat_15" && !clean(purchase.supplierVatNumber ?? "")) {
    missing.push("Supplier VAT number");
  }
  if (purchase.taxMode === "vat_15" && !clean(purchase.supplierAddress ?? "")) {
    missing.push("Supplier address");
  }
  if (!clean(purchase.invoiceNumber ?? "")) {
    missing.push("Supplier invoice number");
  }
  if (!clean(purchase.issueDate)) {
    missing.push("Date of issue");
  }
  if (!hasLineItems) {
    missing.push("Description, quantity, and unit price");
  }
  if (purchase.subtotal <= 0 && purchase.total <= 0) {
    missing.push("Amount excluding VAT");
  }
  if (purchase.taxMode === "vat_15" && purchase.vatAmount <= 0) {
    missing.push("VAT amount");
  }
  if (purchase.total <= 0) {
    missing.push("VAT-inclusive total");
  }

  return missing;
}

async function currentOrganization(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);

  if (userId === null) {
    return null;
  }

  return await getExistingOrganization(ctx, userId);
}

async function loadVatRecords(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  from: string,
  to: string,
) {
  const [periodInvoices, periodPurchases] = await Promise.all([
    ctx.db
      .query("invoices")
      .withIndex("by_organizationId_and_issueDate", (q) =>
        q.eq("organizationId", organizationId).gte("issueDate", from).lte("issueDate", to),
      )
      .order("desc")
      .take(1000),
    ctx.db
      .query("purchases")
      .withIndex("by_organizationId_and_issueDate", (q) =>
        q.eq("organizationId", organizationId).gte("issueDate", from).lte("issueDate", to),
      )
      .order("desc")
      .take(1000),
  ]);
  const invoiceLineItemIds = new Set<Id<"invoices">>();
  const purchaseLineItemIds = new Set<Id<"purchases">>();

  await Promise.all(
    periodInvoices.map(async (invoice) => {
      const lineItems = await ctx.db
        .query("invoiceLineItems")
        .withIndex("by_invoiceId", (q) => q.eq("invoiceId", invoice._id))
        .take(1);

      if (lineItems.length > 0) {
        invoiceLineItemIds.add(invoice._id);
      }
    }),
  );

  await Promise.all(
    periodPurchases.map(async (purchase) => {
      const lineItems = await ctx.db
        .query("purchaseLineItems")
        .withIndex("by_purchaseId", (q) => q.eq("purchaseId", purchase._id))
        .take(1);

      if (lineItems.length > 0) {
        purchaseLineItemIds.add(purchase._id);
      }
    }),
  );

  return {
    invoices: periodInvoices,
    purchases: periodPurchases,
    invoiceLineItemIds,
    purchaseLineItemIds,
  };
}

export const settings = query({
  args: {},
  handler: async (ctx) => {
    const organization = await currentOrganization(ctx);

    if (!organization) {
      return null;
    }

    return vatSettingsForOrganization(organization);
  },
});

export const updateSettings = mutation({
  args: {
    vatRegistered: v.boolean(),
    vatNumber: v.optional(v.string()),
    taxId: v.optional(v.string()),
    vatRegistrationType: v.optional(vatRegistrationTypeValidator),
    vatFilingFrequency: v.optional(vatFilingFrequencyValidator),
    vatReturnDueDay: v.optional(v.number()),
    vatRecordRetentionYears: v.optional(v.number()),
    vatDefaultTaxMode: v.optional(taxModeValidator),
    vedEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (userId === null) {
      throw new Error("Authentication required");
    }

    const { organization } = await requireOrganizationPermission(
      ctx,
      userId,
      "manageVat",
    );
    const vatRegistered = args.vatRegistered;
    const vatRegistrationType = vatRegistered
      ? args.vatRegistrationType === "voluntary" ||
        args.vatRegistrationType === "mandatory"
        ? args.vatRegistrationType
        : "mandatory"
      : "not_registered";
    const vatDefaultTaxMode: TaxMode = vatRegistered
      ? args.vatDefaultTaxMode && args.vatDefaultTaxMode !== "no_vat"
        ? args.vatDefaultTaxMode
        : "vat_15"
      : "no_vat";

    await ctx.db.patch(organization._id, {
      taxId: clean(args.taxId ?? "", organization.taxId ?? ""),
      vatNumber: clean(args.vatNumber ?? "", organization.vatNumber ?? ""),
      vatRegistered,
      vatRegistrationType,
      vatFilingFrequency: args.vatFilingFrequency ?? "monthly",
      vatReturnDueDay: clampInt(args.vatReturnDueDay, defaultReturnDueDay, 1, 28),
      vatRecordRetentionYears: clampInt(
        args.vatRecordRetentionYears,
        defaultRetentionYears,
        defaultRetentionYears,
        10,
      ),
      vatDefaultTaxMode,
      vedEnabled: vatRegistered && (args.vedEnabled ?? true),
      updatedAt: Date.now(),
    });

    const updated = await ctx.db.get(organization._id);
    return updated ? vatSettingsForOrganization(updated) : null;
  },
});

export const returnSummary = query({
  args: {
    from: v.optional(v.string()),
    to: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const organization = await currentOrganization(ctx);
    const from = args.from ?? monthStartIso();
    const to = args.to ?? monthEndIso();
    const empty = {
      organization: null,
      settings: null,
      period: {
        from,
        to,
        dueDate: vatDueDate(to, defaultReturnDueDay),
        today: todayIso(),
      },
      totals: {
        salesSubtotal: 0,
        outputVat: 0,
        salesTotal: 0,
        purchaseSubtotal: 0,
        inputVat: 0,
        purchaseTotal: 0,
        netVat: 0,
        issuedInvoiceCount: 0,
        purchaseRecordCount: 0,
        incompleteRecordCount: 0,
      },
      exportRows: [],
      readiness: [],
    };

    if (!organization) {
      return empty;
    }

    const settings = vatSettingsForOrganization(organization);
    const {
      invoices,
      purchases,
      invoiceLineItemIds,
      purchaseLineItemIds,
    } = await loadVatRecords(
      ctx,
      organization._id,
      from,
      to,
    );
    const issuedInvoices = invoices.filter(isIssuedInvoice);
    const activePurchases = purchases.filter(
      (purchase) => purchase.status !== "void" && purchase.status !== "draft",
    );

    let incompleteRecordCount = 0;
    const salesRows = issuedInvoices.map((invoice) => {
      const missingFields = buildSaleMissingFields(
        invoice,
        organization,
        settings,
        invoiceLineItemIds.has(invoice._id),
      );
      incompleteRecordCount += missingFields.length > 0 ? 1 : 0;

      return {
        recordType: "sale" as const,
        documentType:
          settings.vatRegistered && invoiceTaxMode(invoice) !== "no_vat"
            ? "Tax Invoice"
            : "Invoice",
        documentNumber: invoice.invoiceNumber,
        issueDate: invoice.issueDate ?? "",
        partyName: invoice.clientName ?? invoice.client ?? "Client",
        partyAddress: invoice.clientSnapshot?.address ?? "",
        partyVatNumber: invoice.clientSnapshot?.vatNumber ?? "",
        taxMode: invoiceTaxMode(invoice),
        taxModeLabel: taxModeLabel(invoiceTaxMode(invoice)),
        vatRate: vatRateForMode(invoiceTaxMode(invoice)),
        subtotal: invoice.subtotal ?? invoiceTotal(invoice),
        vatAmount: invoice.vatAmount ?? 0,
        total: invoiceTotal(invoice),
        currency: invoice.currency ?? organization.defaultCurrency,
        status: invoice.status,
        retentionUntil: addYearsIso(
          invoice.issueDate ?? todayIso(),
          settings.recordRetentionYears,
        ),
        vedStatus: missingFields.length === 0 ? "ready" : "incomplete",
        missingFields,
      };
    });
    const purchaseRows = activePurchases.map((purchase) => {
      const missingFields = buildPurchaseMissingFields(
        purchase,
        purchaseLineItemIds.has(purchase._id),
      );
      incompleteRecordCount += missingFields.length > 0 ? 1 : 0;

      return {
        recordType: "purchase" as const,
        documentType: purchase.taxMode === "vat_15" ? "Supplier Tax Invoice" : "Supplier Invoice",
        documentNumber: purchase.invoiceNumber ?? "",
        issueDate: purchase.issueDate,
        partyName: purchase.supplierName,
        partyAddress: "",
        partyVatNumber: "",
        taxMode: purchase.taxMode,
        taxModeLabel: taxModeLabel(purchase.taxMode),
        vatRate: vatRateForMode(purchase.taxMode),
        subtotal: purchase.subtotal,
        vatAmount: purchase.vatAmount,
        total: purchase.total,
        currency: purchase.currency,
        status: purchase.status,
        retentionUntil: addYearsIso(purchase.issueDate, settings.recordRetentionYears),
        vedStatus: missingFields.length === 0 ? "ready" : "incomplete",
        missingFields,
      };
    });
    const salesSubtotal = money(
      issuedInvoices.reduce(
        (total, invoice) => total + (invoice.subtotal ?? invoiceTotal(invoice)),
        0,
      ),
    );
    const outputVat = money(
      issuedInvoices.reduce((total, invoice) => total + (invoice.vatAmount ?? 0), 0),
    );
    const salesTotal = money(
      issuedInvoices.reduce((total, invoice) => total + invoiceTotal(invoice), 0),
    );
    const purchaseSubtotal = money(
      activePurchases.reduce((total, purchase) => total + purchase.subtotal, 0),
    );
    const inputVat = money(
      activePurchases.reduce((total, purchase) => total + purchase.vatAmount, 0),
    );
    const purchaseTotal = money(
      activePurchases.reduce((total, purchase) => total + purchase.total, 0),
    );
    const readiness = [
      {
        key: "vat-registration",
        label: "VAT registration saved",
        done: settings.vatRegistered && Boolean(settings.vatNumber),
      },
      {
        key: "tax-invoice-fields",
        label: "Tax invoice fields complete",
        done: incompleteRecordCount === 0,
      },
      {
        key: "retention",
        label: `${settings.recordRetentionYears}-year record retention tracked`,
        done: settings.recordRetentionYears >= defaultRetentionYears,
      },
      {
        key: "filing-deadline",
        label: `Return deadline set to day ${settings.returnDueDay}`,
        done: settings.returnDueDay === defaultReturnDueDay,
      },
    ];

    return {
      organization: {
        name: organizationDisplayName(organization),
        legalName: organization.legalName ?? "",
        address: organization.address ?? "",
        taxId: organization.taxId ?? "",
        vatNumber: organization.vatNumber ?? "",
        currency: organization.defaultCurrency,
      },
      settings,
      period: {
        from,
        to,
        dueDate: vatDueDate(to, settings.returnDueDay),
        today: todayIso(),
      },
      totals: {
        salesSubtotal,
        outputVat,
        salesTotal,
        purchaseSubtotal,
        inputVat,
        purchaseTotal,
        netVat: money(outputVat - inputVat),
        issuedInvoiceCount: issuedInvoices.length,
        purchaseRecordCount: activePurchases.length,
        incompleteRecordCount,
      },
      exportRows: [...salesRows, ...purchaseRows].sort((a, b) =>
        b.issueDate.localeCompare(a.issueDate),
      ),
      readiness,
    };
  },
});
