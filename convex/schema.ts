import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

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
);

const memberRole = v.union(v.literal("owner"), v.literal("member"));

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
  organizations: defineTable({
    name: v.string(),
    ownerUserId: v.id("users"),
    defaultCurrency: v.string(),
    paymentInstructions: v.string(),
    paymentLink: v.optional(v.string()),
    brandColor: v.string(),
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
  clients: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    contactName: v.optional(v.string()),
    email: v.string(),
    company: v.optional(v.string()),
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
    currency: v.optional(v.string()),
    issueDate: v.optional(v.string()),
    dueDate: v.string(),
    terms: v.optional(v.string()),
    notes: v.optional(v.string()),
    paymentInstructions: v.optional(v.string()),
    paymentLink: v.optional(v.string()),
    publicToken: v.optional(v.string()),
    snapshotId: v.optional(v.id("invoiceSnapshots")),
    sentAt: v.optional(v.number()),
    viewedAt: v.optional(v.number()),
    approvedAt: v.optional(v.number()),
    rejectedAt: v.optional(v.number()),
    rejectionReason: v.optional(v.string()),
    paidAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
    userId: v.optional(v.id("users")),
  })
    .index("by_organizationId", ["organizationId"])
    .index("by_organizationId_and_status", ["organizationId", "status"])
    .index("by_publicToken", ["publicToken"])
    .index("by_clientId", ["clientId"]),
  invoiceLineItems: defineTable({
    organizationId: v.id("organizations"),
    invoiceId: v.id("invoices"),
    description: v.string(),
    quantity: v.number(),
    unitPrice: v.number(),
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
    currency: v.string(),
    issueDate: v.string(),
    dueDate: v.string(),
    terms: v.string(),
    notes: v.string(),
    paymentInstructions: v.string(),
    paymentLink: v.optional(v.string()),
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
    .index("by_organizationId", ["organizationId"]),
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
    createdAt: v.number(),
  })
    .index("by_invoiceId", ["invoiceId"])
    .index("by_organizationId", ["organizationId"]),
  reminders: defineTable({
    organizationId: v.id("organizations"),
    invoiceId: v.id("invoices"),
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
    .index("by_organizationId_and_status", ["organizationId", "status"])
    .index("by_organizationId_and_scheduledFor", [
      "organizationId",
      "scheduledFor",
    ]),
});
