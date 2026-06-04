import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

import {
  memberRoleValidator as memberRole,
  organizationPermissionPolicyValidator,
} from "./organizationPermissions";

const invoiceStatus = v.union(
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

const invitationStatus = v.union(
  v.literal("pending"),
  v.literal("accepted"),
  v.literal("revoked"),
  v.literal("expired"),
);

const platformRole = v.union(v.literal("user"), v.literal("admin"));

const entityType = v.union(
  v.literal("sole_proprietor"),
  v.literal("close_corporation"),
  v.literal("private_company"),
  v.literal("partnership"),
  v.literal("ngo"),
  v.literal("other"),
);

const taxMode = v.union(
  v.literal("no_vat"),
  v.literal("vat_15"),
  v.literal("zero_rated"),
  v.literal("exempt"),
);

const vatRegistrationType = v.union(
  v.literal("not_registered"),
  v.literal("voluntary"),
  v.literal("mandatory"),
);

const vatFilingFrequency = v.union(
  v.literal("monthly"),
  v.literal("bi_monthly"),
);

const vedTransmissionMode = v.union(
  v.literal("manual_export"),
  v.literal("near_real_time"),
  v.literal("real_time"),
);

const purchaseScanStatus = v.union(
  v.literal("uploaded"),
  v.literal("extracting"),
  v.literal("needs_review"),
  v.literal("ready"),
  v.literal("saved"),
  v.literal("failed"),
);

const purchaseScanEventType = v.union(
  v.literal("uploaded"),
  v.literal("extraction_started"),
  v.literal("extraction_completed"),
  v.literal("review_saved"),
  v.literal("purchase_created"),
  v.literal("failed"),
);

const extractionProvider = v.union(
  v.literal("manual"),
  v.literal("desert"),
  v.literal("none"),
);

const businessSnapshot = v.object({
  name: v.string(),
  legalName: v.optional(v.string()),
  tradingName: v.optional(v.string()),
  phone: v.optional(v.string()),
  address: v.optional(v.string()),
  taxId: v.optional(v.string()),
  vatNumber: v.optional(v.string()),
  vatRegistered: v.optional(v.boolean()),
});

const clientSnapshot = v.object({
  name: v.string(),
  businessName: v.optional(v.string()),
  contactName: v.optional(v.string()),
  email: v.optional(v.string()),
  phone: v.optional(v.string()),
  address: v.optional(v.string()),
  taxId: v.optional(v.string()),
  vatNumber: v.optional(v.string()),
});

const bankDetails = v.object({
  bankName: v.optional(v.string()),
  accountName: v.optional(v.string()),
  accountNumber: v.optional(v.string()),
  branchCode: v.optional(v.string()),
  swiftCode: v.optional(v.string()),
});

const eventType = v.union(
  v.literal("created"),
  v.literal("updated"),
  v.literal("sent"),
  v.literal("viewed"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("amended"),
  v.literal("payment_marked"),
  v.literal("reminder_scheduled"),
  v.literal("status_changed"),
);

export default defineSchema({
  ...authTables,
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")),
    googleImage: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    role: v.optional(platformRole),
  })
    .index("email", ["email"])
    .index("phone", ["phone"])
    .index("by_role", ["role"]),
  organizations: defineTable({
    name: v.string(),
    legalName: v.optional(v.string()),
    tradingName: v.optional(v.string()),
    entityType: v.optional(entityType),
    region: v.optional(v.string()),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    taxId: v.optional(v.string()),
    vatNumber: v.optional(v.string()),
    vatRegistered: v.optional(v.boolean()),
    vatRegistrationType: v.optional(vatRegistrationType),
    vatFilingFrequency: v.optional(vatFilingFrequency),
    vatReturnDueDay: v.optional(v.number()),
    vatRecordRetentionYears: v.optional(v.number()),
    vatDefaultTaxMode: v.optional(taxMode),
    vedEnabled: v.optional(v.boolean()),
    vedTransmissionMode: v.optional(vedTransmissionMode),
    itasRegistered: v.optional(v.boolean()),
    defaultTerms: v.optional(v.string()),
    invoicePrefix: v.optional(v.string()),
    nextInvoiceSequence: v.optional(v.number()),
    bankName: v.optional(v.string()),
    bankAccountName: v.optional(v.string()),
    bankAccountNumber: v.optional(v.string()),
    branchCode: v.optional(v.string()),
    swiftCode: v.optional(v.string()),
    ownerUserId: v.id("users"),
    defaultCurrency: v.string(),
    paymentInstructions: v.string(),
    paymentLink: v.optional(v.string()),
    brandColor: v.string(),
    imageStorageId: v.optional(v.id("_storage")),
    imageFileName: v.optional(v.string()),
    imageUpdatedAt: v.optional(v.number()),
    permissionPolicy: v.optional(organizationPermissionPolicyValidator),
    deletedAt: v.optional(v.number()),
    deletedByUserId: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_ownerUserId", ["ownerUserId"]),
  memberships: defineTable({
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    role: memberRole,
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_organizationId", ["organizationId"])
    .index("by_organizationId_and_userId", ["organizationId", "userId"]),
  userOrganizationPreferences: defineTable({
    userId: v.id("users"),
    activeOrganizationId: v.optional(v.id("organizations")),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_activeOrganizationId", ["activeOrganizationId"]),
  organizationNotificationViews: defineTable({
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    lastSeenAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_organizationId_and_userId", ["organizationId", "userId"]),
  organizationInvitations: defineTable({
    organizationId: v.id("organizations"),
    email: v.string(),
    role: memberRole,
    token: v.string(),
    status: invitationStatus,
    invitedByUserId: v.id("users"),
    acceptedByUserId: v.optional(v.id("users")),
    expiresAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
    acceptedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
  })
    .index("by_token", ["token"])
    .index("by_email_and_status", ["email", "status"])
    .index("by_organizationId", ["organizationId"])
    .index("by_organizationId_and_status", ["organizationId", "status"])
    .index("by_organizationId_and_email_and_status", [
      "organizationId",
      "email",
      "status",
    ]),
  clients: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    businessName: v.optional(v.string()),
    contactName: v.optional(v.string()),
    email: v.string(),
    company: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    vatNumber: v.optional(v.string()),
    taxId: v.optional(v.string()),
    paymentTerms: v.optional(v.string()),
    notes: v.optional(v.string()),
    active: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organizationId", ["organizationId"])
    .index("by_organizationId_and_email", ["organizationId", "email"]),
  invoices: defineTable({
    organizationId: v.optional(v.id("organizations")),
    clientId: v.optional(v.id("clients")),
    createdByUserId: v.optional(v.id("users")),
    invoiceNumber: v.string(),
    clientName: v.optional(v.string()),
    clientEmail: v.optional(v.string()),
    client: v.optional(v.string()),
    status: invoiceStatus,
    amount: v.optional(v.number()),
    amountTotal: v.optional(v.number()),
    subtotal: v.optional(v.number()),
    vatAmount: v.optional(v.number()),
    total: v.optional(v.number()),
    taxMode: v.optional(taxMode),
    currency: v.optional(v.string()),
    exchangeRateSnapshot: v.optional(v.number()),
    balanceDue: v.optional(v.number()),
    issueDate: v.optional(v.string()),
    dueDate: v.string(),
    terms: v.optional(v.string()),
    notes: v.optional(v.string()),
    paymentInstructions: v.optional(v.string()),
    paymentLink: v.optional(v.string()),
    paymentReference: v.optional(v.string()),
    requiresApproval: v.optional(v.boolean()),
    bankDetails: v.optional(bankDetails),
    supplierSnapshot: v.optional(businessSnapshot),
    clientSnapshot: v.optional(clientSnapshot),
    legacy: v.optional(v.boolean()),
    publicToken: v.optional(v.string()),
    snapshotId: v.optional(v.id("invoiceSnapshots")),
    sentAt: v.optional(v.number()),
    viewedAt: v.optional(v.number()),
    approvedAt: v.optional(v.number()),
    rejectedAt: v.optional(v.number()),
    rejectionReason: v.optional(v.string()),
    paidAt: v.optional(v.number()),
    voidedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
    userId: v.optional(v.id("users")),
  })
    .index("by_organizationId", ["organizationId"])
    .index("by_organizationId_and_status", ["organizationId", "status"])
    .index("by_organizationId_and_createdAt", ["organizationId", "createdAt"])
    .index("by_organizationId_and_issueDate", ["organizationId", "issueDate"])
    .index("by_publicToken", ["publicToken"])
    .index("by_clientId", ["clientId"]),
  invoiceLineItems: defineTable({
    organizationId: v.id("organizations"),
    invoiceId: v.id("invoices"),
    description: v.string(),
    quantity: v.number(),
    unitPrice: v.number(),
    taxMode: v.optional(taxMode),
    vatRate: v.optional(v.number()),
    vatAmount: v.optional(v.number()),
    lineSubtotal: v.optional(v.number()),
    lineTotal: v.number(),
    position: v.number(),
    createdAt: v.number(),
  })
    .index("by_invoiceId", ["invoiceId"])
    .index("by_organizationId", ["organizationId"]),
  invoiceSnapshots: defineTable({
    organizationId: v.id("organizations"),
    invoiceId: v.id("invoices"),
    invoiceNumber: v.string(),
    clientName: v.string(),
    clientEmail: v.string(),
    amountTotal: v.number(),
    subtotal: v.optional(v.number()),
    vatAmount: v.optional(v.number()),
    total: v.optional(v.number()),
    taxMode: v.optional(taxMode),
    balanceDue: v.optional(v.number()),
    currency: v.string(),
    exchangeRateSnapshot: v.optional(v.number()),
    issueDate: v.string(),
    dueDate: v.string(),
    terms: v.string(),
    notes: v.string(),
    paymentInstructions: v.string(),
    paymentLink: v.optional(v.string()),
    paymentReference: v.optional(v.string()),
    requiresApproval: v.optional(v.boolean()),
    bankDetails: v.optional(bankDetails),
    supplierSnapshot: v.optional(businessSnapshot),
    clientSnapshot: v.optional(clientSnapshot),
    createdAt: v.number(),
  })
    .index("by_invoiceId", ["invoiceId"])
    .index("by_organizationId", ["organizationId"]),
  invoiceSnapshotLineItems: defineTable({
    organizationId: v.id("organizations"),
    invoiceId: v.id("invoices"),
    snapshotId: v.id("invoiceSnapshots"),
    description: v.string(),
    quantity: v.number(),
    unitPrice: v.number(),
    taxMode: v.optional(taxMode),
    vatRate: v.optional(v.number()),
    vatAmount: v.optional(v.number()),
    lineSubtotal: v.optional(v.number()),
    lineTotal: v.number(),
    position: v.number(),
  }).index("by_snapshotId", ["snapshotId"]),
  invoiceEvents: defineTable({
    organizationId: v.id("organizations"),
    invoiceId: v.id("invoices"),
    type: eventType,
    actorType: v.union(v.literal("user"), v.literal("client"), v.literal("system")),
    actorUserId: v.optional(v.id("users")),
    actorName: v.optional(v.string()),
    message: v.string(),
    createdAt: v.number(),
  })
    .index("by_invoiceId", ["invoiceId"])
    .index("by_organizationId", ["organizationId"])
    .index("by_organizationId_and_createdAt", ["organizationId", "createdAt"]),
  paymentRecords: defineTable({
    organizationId: v.id("organizations"),
    invoiceId: v.id("invoices"),
    provider: v.union(
      v.literal("manual"),
      v.literal("external"),
      v.literal("stripe"),
      v.literal("polar"),
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("paid"),
      v.literal("failed"),
      v.literal("refunded"),
    ),
    amount: v.number(),
    currency: v.string(),
    providerReference: v.optional(v.string()),
    paymentLink: v.optional(v.string()),
    proofId: v.optional(v.id("paymentProofs")),
    reviewedByUserId: v.optional(v.id("users")),
    reviewedAt: v.optional(v.number()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_invoiceId", ["invoiceId"])
    .index("by_organizationId", ["organizationId"]),
  paymentProofs: defineTable({
    organizationId: v.id("organizations"),
    invoiceId: v.id("invoices"),
    publicToken: v.optional(v.string()),
    payerName: v.string(),
    amount: v.number(),
    currency: v.string(),
    paymentDate: v.string(),
    bankReference: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    fileName: v.optional(v.string()),
    status: v.union(
      v.literal("submitted"),
      v.literal("accepted"),
      v.literal("rejected"),
    ),
    reviewerUserId: v.optional(v.id("users")),
    reviewedAt: v.optional(v.number()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_invoiceId", ["invoiceId"])
    .index("by_organizationId_and_status", ["organizationId", "status"]),
  reminders: defineTable({
    organizationId: v.id("organizations"),
    invoiceId: v.id("invoices"),
    clientId: v.optional(v.id("clients")),
    status: v.union(
      v.literal("scheduled"),
      v.literal("sent"),
      v.literal("canceled"),
    ),
    channel: v.union(v.literal("email"), v.literal("manual")),
    scheduledFor: v.number(),
    message: v.string(),
    createdAt: v.number(),
  })
    .index("by_invoiceId", ["invoiceId"])
    .index("by_clientId", ["clientId"])
    .index("by_organizationId_and_status", ["organizationId", "status"])
    .index("by_organizationId_and_clientId", ["organizationId", "clientId"])
    .index("by_organizationId_and_scheduledFor", [
      "organizationId",
      "scheduledFor",
    ]),
  suppliers: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    contactName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    vatNumber: v.optional(v.string()),
    taxId: v.optional(v.string()),
    notes: v.optional(v.string()),
    active: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_organizationId", ["organizationId"])
    .index("by_organizationId_and_name", ["organizationId", "name"]),
  purchases: defineTable({
    organizationId: v.id("organizations"),
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
    currency: v.string(),
    subtotal: v.number(),
    vatAmount: v.number(),
    total: v.number(),
    balanceDue: v.number(),
    taxMode,
    status: v.union(
      v.literal("draft"),
      v.literal("recorded"),
      v.literal("paid"),
      v.literal("void"),
    ),
    notes: v.optional(v.string()),
    proofStorageId: v.optional(v.id("_storage")),
    sourceScanId: v.optional(v.id("purchaseScans")),
    retainedUntil: v.optional(v.number()),
    createdByUserId: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_organizationId", ["organizationId"])
    .index("by_organizationId_and_status", ["organizationId", "status"])
    .index("by_organizationId_and_issueDate", ["organizationId", "issueDate"])
    .index("by_organizationId_and_invoiceNumber", ["organizationId", "invoiceNumber"])
    .index("by_supplierId", ["supplierId"]),
  purchaseLineItems: defineTable({
    organizationId: v.id("organizations"),
    purchaseId: v.id("purchases"),
    description: v.string(),
    quantity: v.number(),
    unitPrice: v.number(),
    taxMode,
    vatRate: v.optional(v.number()),
    vatAmount: v.optional(v.number()),
    lineSubtotal: v.optional(v.number()),
    lineTotal: v.number(),
    position: v.number(),
    createdAt: v.number(),
  })
    .index("by_purchaseId", ["purchaseId"])
    .index("by_organizationId", ["organizationId"]),
  purchaseScans: defineTable({
    organizationId: v.id("organizations"),
    createdByUserId: v.id("users"),
    storageId: v.id("_storage"),
    fileName: v.optional(v.string()),
    fileType: v.optional(v.string()),
    fileSize: v.optional(v.number()),
    status: purchaseScanStatus,
    extractionProvider: extractionProvider,
    extractedAt: v.optional(v.number()),
    reviewedAt: v.optional(v.number()),
    savedPurchaseId: v.optional(v.id("purchases")),
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
    taxMode: v.optional(taxMode),
    confidence: v.optional(v.number()),
    rawTextPreview: v.optional(v.string()),
    warnings: v.array(v.string()),
    notes: v.optional(v.string()),
    retainedUntil: v.number(),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_organizationId", ["organizationId"])
    .index("by_organizationId_and_status", ["organizationId", "status"])
    .index("by_storageId", ["storageId"])
    .index("by_savedPurchaseId", ["savedPurchaseId"]),
  purchaseScanLineItems: defineTable({
    organizationId: v.id("organizations"),
    scanId: v.id("purchaseScans"),
    description: v.string(),
    quantity: v.number(),
    unitPrice: v.number(),
    taxMode,
    vatRate: v.optional(v.number()),
    vatAmount: v.optional(v.number()),
    lineSubtotal: v.optional(v.number()),
    lineTotal: v.number(),
    position: v.number(),
    createdAt: v.number(),
  })
    .index("by_scanId", ["scanId"])
    .index("by_organizationId", ["organizationId"]),
  purchaseScanEvents: defineTable({
    organizationId: v.id("organizations"),
    scanId: v.id("purchaseScans"),
    actorUserId: v.optional(v.id("users")),
    type: purchaseScanEventType,
    message: v.string(),
    createdAt: v.number(),
  })
    .index("by_scanId", ["scanId"])
    .index("by_organizationId", ["organizationId"]),
  subscriptions: defineTable({
    organizationId: v.id("organizations"),
    plan: v.union(
      v.literal("trial"),
      v.literal("starter"),
      v.literal("business"),
      v.literal("professional"),
      v.literal("enterprise"),
    ),
    status: v.union(
      v.literal("trialing"),
      v.literal("active"),
      v.literal("past_due"),
      v.literal("canceled"),
    ),
    currentPeriodEnd: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  }).index("by_organizationId", ["organizationId"]),
});
