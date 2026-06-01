import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { getOrganizationForUser } from "./organizationContext";

type OrgCtx = QueryCtx | MutationCtx;
type SearchKind = "invoice" | "client" | "purchase" | "supplier" | "scan";
type NotificationTone = "danger" | "warning" | "info" | "success";
type SearchResult = {
  id: string;
  type: SearchKind;
  title: string;
  subtitle: string;
  meta: string;
  href: string;
  updatedAt: number;
  score: number;
};
type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string;
  cta: string;
  createdAt: number;
  tone: NotificationTone;
  read: boolean;
};

const activeInvoiceStatuses: Array<Doc<"invoices">["status"]> = [
  "overdue",
  "awaiting_payment",
  "approved",
  "viewed",
  "sent",
];

const statusLabels: Record<string, string> = {
  draft: "Draft",
  ready: "Ready",
  sent: "Sent",
  viewed: "Viewed",
  approved: "Approved",
  awaiting_payment: "Awaiting payment",
  rejected: "Rejected",
  paid: "Paid",
  overdue: "Overdue",
  void: "Void",
  uploaded: "Uploaded",
  extracting: "Extracting",
  needs_review: "Needs review",
  saved: "Saved",
  failed: "Failed",
  recorded: "Recorded",
};

async function activeOrganization(ctx: OrgCtx) {
  const userId = await getAuthUserId(ctx);

  if (userId === null) {
    return null;
  }

  const current = await getOrganizationForUser(ctx, userId);

  if (!current.membership || !current.organization) {
    return null;
  }

  return { userId, membership: current.membership, organization: current.organization };
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function includesAllTerms(haystack: string, terms: string[]) {
  return terms.every((term) => haystack.includes(term));
}

function text(parts: Array<string | number | null | undefined>) {
  return parts
    .filter((part): part is string | number => part !== null && part !== undefined)
    .join(" ");
}

function searchScore(
  haystack: string,
  primary: string,
  queryText: string,
  terms: string[],
): number {
  if (!includesAllTerms(haystack, terms)) {
    return 0;
  }

  let score = 10 + terms.length;

  if (primary === queryText) {
    score += 40;
  } else if (primary.startsWith(queryText)) {
    score += 24;
  } else if (primary.includes(queryText)) {
    score += 14;
  }

  return score;
}

function amountForInvoice(invoice: Doc<"invoices">) {
  return invoice.balanceDue ?? invoice.amountTotal ?? invoice.total ?? invoice.amount ?? 0;
}

function invoiceClientName(invoice: Doc<"invoices">) {
  return (
    invoice.clientSnapshot?.name ??
    invoice.clientName ??
    invoice.client ??
    invoice.clientEmail ??
    "Client"
  );
}

function money(currency: string | undefined, value: number | undefined) {
  const amount = Number.isFinite(value) ? value ?? 0 : 0;
  return `${currency ?? "NAD"} ${amount.toFixed(2)}`;
}

function result(
  kind: SearchKind,
  id: string,
  title: string,
  subtitle: string,
  meta: string,
  href: string,
  updatedAt: number,
  score: number,
): SearchResult {
  return {
    id: `${kind}:${id}`,
    type: kind,
    title,
    subtitle,
    meta,
    href,
    updatedAt,
    score,
  };
}

function dateToTime(date: string | undefined) {
  if (!date) {
    return 0;
  }

  const time = Date.parse(`${date}T00:00:00.000Z`);
  return Number.isFinite(time) ? time : 0;
}

function notification(
  type: string,
  sourceId: string,
  title: string,
  body: string,
  href: string,
  cta: string,
  createdAt: number,
  tone: NotificationTone,
  lastSeenAt: number,
): NotificationItem {
  return {
    id: `${type}:${sourceId}`,
    type,
    title,
    body,
    href,
    cta,
    createdAt,
    tone,
    read: createdAt <= lastSeenAt,
  };
}

async function notificationView(
  ctx: OrgCtx,
  organizationId: Id<"organizations">,
  userId: Id<"users">,
) {
  return await ctx.db
    .query("organizationNotificationViews")
    .withIndex("by_organizationId_and_userId", (q) =>
      q.eq("organizationId", organizationId).eq("userId", userId),
    )
    .unique();
}

export const globalSearch = query({
  args: {
    query: v.string(),
  },
  handler: async (ctx, args) => {
    const current = await activeOrganization(ctx);
    const queryText = normalize(args.query).slice(0, 80);

    if (!current || queryText.length < 2) {
      return {
        organizationId: null,
        organizationName: "",
        results: [],
      };
    }

    const terms = queryText.split(" ").filter(Boolean);
    const organizationId = current.organization._id;
    const [invoices, clients, purchases, suppliers, scans] = await Promise.all([
      ctx.db
        .query("invoices")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", organizationId))
        .order("desc")
        .take(300),
      ctx.db
        .query("clients")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", organizationId))
        .order("desc")
        .take(250),
      ctx.db
        .query("purchases")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", organizationId))
        .order("desc")
        .take(250),
      ctx.db
        .query("suppliers")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", organizationId))
        .order("desc")
        .take(200),
      ctx.db
        .query("purchaseScans")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", organizationId))
        .order("desc")
        .take(100),
    ]);

    const results: SearchResult[] = [];

    for (const invoice of invoices) {
      const title = invoice.invoiceNumber;
      const subtitle = invoiceClientName(invoice);
      const haystack = normalize(
        text([
          title,
          subtitle,
          invoice.clientEmail,
          invoice.status,
          invoice.dueDate,
          invoice.notes,
          invoice.paymentReference,
        ]),
      );
      const score = searchScore(haystack, normalize(title), queryText, terms);

      if (score > 0) {
        results.push(
          result(
            "invoice",
            invoice._id,
            title,
            subtitle,
            `${statusLabels[invoice.status]} - due ${invoice.dueDate} - ${money(
              invoice.currency,
              amountForInvoice(invoice),
            )}`,
            "/dashboard#invoices",
            invoice.updatedAt ?? invoice.createdAt,
            score,
          ),
        );
      }
    }

    for (const client of clients) {
      const title = client.name;
      const subtitle = client.email || client.businessName || "Client";
      const haystack = normalize(
        text([
          title,
          subtitle,
          client.businessName,
          client.contactName,
          client.phone,
          client.vatNumber,
          client.taxId,
          client.notes,
        ]),
      );
      const score = searchScore(haystack, normalize(title), queryText, terms);

      if (score > 0) {
        results.push(
          result(
            "client",
            client._id,
            title,
            subtitle,
            client.active === false ? "Inactive client" : "Client profile",
            "/dashboard/clients",
            client.updatedAt,
            score,
          ),
        );
      }
    }

    for (const purchase of purchases) {
      const title = purchase.invoiceNumber || purchase.supplierName;
      const subtitle = purchase.supplierName;
      const haystack = normalize(
        text([
          title,
          subtitle,
          purchase.purchaseOrderNumber,
          purchase.status,
          purchase.issueDate,
          purchase.dueDate,
          purchase.notes,
          purchase.supplierVatNumber,
        ]),
      );
      const score = searchScore(haystack, normalize(title), queryText, terms);

      if (score > 0) {
        results.push(
          result(
            "purchase",
            purchase._id,
            title,
            subtitle,
            `${statusLabels[purchase.status]} - ${money(purchase.currency, purchase.total)}`,
            "/dashboard/ledger",
            purchase.updatedAt ?? purchase.createdAt,
            score,
          ),
        );
      }
    }

    for (const supplier of suppliers) {
      const title = supplier.name;
      const subtitle = supplier.email || supplier.contactName || "Supplier";
      const haystack = normalize(
        text([
          title,
          subtitle,
          supplier.contactName,
          supplier.phone,
          supplier.vatNumber,
          supplier.taxId,
          supplier.notes,
        ]),
      );
      const score = searchScore(haystack, normalize(title), queryText, terms);

      if (score > 0) {
        results.push(
          result(
            "supplier",
            supplier._id,
            title,
            subtitle,
            supplier.active ? "Supplier profile" : "Inactive supplier",
            "/dashboard/scan",
            supplier.updatedAt ?? supplier.createdAt,
            score,
          ),
        );
      }
    }

    for (const scan of scans) {
      const title = scan.invoiceNumber || scan.fileName || scan.supplierName || "Purchase scan";
      const subtitle = scan.supplierName || scan.fileName || "Scan";
      const haystack = normalize(
        text([
          title,
          subtitle,
          scan.status,
          scan.fileName,
          scan.issueDate,
          scan.dueDate,
          scan.notes,
          scan.rawTextPreview,
        ]),
      );
      const score = searchScore(haystack, normalize(title), queryText, terms);

      if (score > 0) {
        results.push(
          result(
            "scan",
            scan._id,
            title,
            subtitle,
            statusLabels[scan.status] ?? "Scan",
            "/dashboard/scan",
            scan.updatedAt ?? scan.createdAt,
            score,
          ),
        );
      }
    }

    return {
      organizationId,
      organizationName: current.organization.name,
      results: results
        .sort((a, b) => b.score - a.score || b.updatedAt - a.updatedAt)
        .slice(0, 12)
        .map((item) => ({
          id: item.id,
          type: item.type,
          title: item.title,
          subtitle: item.subtitle,
          meta: item.meta,
          href: item.href,
          updatedAt: item.updatedAt,
        })),
    };
  },
});

export const notifications = query({
  args: {},
  handler: async (ctx) => {
    const current = await activeOrganization(ctx);

    if (!current) {
      return {
        organizationId: null,
        organizationName: "",
        unreadCount: 0,
        items: [],
      };
    }

    const organizationId = current.organization._id;
    const view = await notificationView(ctx, organizationId, current.userId);
    const lastSeenAt = view?.lastSeenAt ?? 0;
    const now = Date.now();
    const today = new Date(now).toISOString().slice(0, 10);
    const [submittedProofs, reminderRows, scanRows, subscriptionRows, invoiceGroups] =
      await Promise.all([
        ctx.db
          .query("paymentProofs")
          .withIndex("by_organizationId_and_status", (q) =>
            q.eq("organizationId", organizationId).eq("status", "submitted"),
          )
          .order("desc")
          .take(15),
        ctx.db
          .query("reminders")
          .withIndex("by_organizationId_and_scheduledFor", (q) =>
            q.eq("organizationId", organizationId).lte("scheduledFor", now),
          )
          .order("desc")
          .take(20),
        ctx.db
          .query("purchaseScans")
          .withIndex("by_organizationId", (q) => q.eq("organizationId", organizationId))
          .order("desc")
          .take(60),
        ctx.db
          .query("subscriptions")
          .withIndex("by_organizationId", (q) => q.eq("organizationId", organizationId))
          .take(1),
        Promise.all(
          activeInvoiceStatuses.map((status) =>
            ctx.db
              .query("invoices")
              .withIndex("by_organizationId_and_status", (q) =>
                q.eq("organizationId", organizationId).eq("status", status),
              )
              .order("desc")
              .take(35),
          ),
        ),
      ]);

    const items: NotificationItem[] = [];
    const invoiceMap = new Map<Id<"invoices">, Doc<"invoices">>();

    for (const invoice of invoiceGroups.flat()) {
      if (!invoiceMap.has(invoice._id)) {
        invoiceMap.set(invoice._id, invoice);
      }
    }

    for (const proof of submittedProofs) {
      const invoice = invoiceMap.get(proof.invoiceId) ?? (await ctx.db.get(proof.invoiceId));

      if (!invoice || invoice.organizationId !== organizationId) {
        continue;
      }

      items.push(
        notification(
          "payment",
          proof._id,
          "Payment proof needs review",
          `${proof.payerName} submitted ${money(proof.currency, proof.amount)} for ${invoice.invoiceNumber}.`,
          "/dashboard#invoices",
          "Review",
          proof.createdAt,
          "success",
          lastSeenAt,
        ),
      );
    }

    for (const invoice of invoiceMap.values()) {
      if (invoice.status === "void" || invoice.status === "paid") {
        continue;
      }

      const isOverdue = invoice.status === "overdue" || invoice.dueDate < today;

      if (!isOverdue) {
        continue;
      }

      const dueTime = dateToTime(invoice.dueDate);
      const createdAt = Math.max(invoice.updatedAt ?? invoice.createdAt, dueTime);

      items.push(
        notification(
          "overdue",
          invoice._id,
          "Invoice overdue",
          `${invoice.invoiceNumber} for ${money(invoice.currency, amountForInvoice(invoice))} was due ${invoice.dueDate}.`,
          "/dashboard/reminders",
          "Open reminders",
          createdAt,
          "danger",
          lastSeenAt,
        ),
      );
    }

    for (const reminder of reminderRows) {
      if (reminder.status !== "scheduled") {
        continue;
      }

      const invoice = invoiceMap.get(reminder.invoiceId) ?? (await ctx.db.get(reminder.invoiceId));

      if (!invoice || invoice.organizationId !== organizationId) {
        continue;
      }

      items.push(
        notification(
          "reminder",
          reminder._id,
          "Reminder due",
          `Follow up on ${invoice.invoiceNumber} for ${invoiceClientName(invoice)}.`,
          "/dashboard/reminders",
          "Open reminders",
          reminder.scheduledFor,
          "warning",
          lastSeenAt,
        ),
      );
    }

    for (const scan of scanRows) {
      if (scan.status !== "needs_review" && scan.status !== "failed") {
        continue;
      }

      items.push(
        notification(
          "scan",
          scan._id,
          scan.status === "failed" ? "Scan failed" : "Scan needs review",
          `${scan.fileName || scan.supplierName || "Purchase scan"} is ${statusLabels[scan.status].toLowerCase()}.`,
          "/dashboard/scan",
          "Open scan",
          scan.updatedAt ?? scan.createdAt,
          scan.status === "failed" ? "danger" : "info",
          lastSeenAt,
        ),
      );
    }

    const subscription = subscriptionRows[0] ?? null;

    if (subscription?.status === "past_due") {
      items.push(
        notification(
          "subscription",
          subscription._id,
          "Subscription past due",
          `${current.organization.name} billing needs attention.`,
          "/pricing",
          "Open billing",
          subscription.updatedAt ?? subscription.createdAt,
          "warning",
          lastSeenAt,
        ),
      );
    }

    const sortedItems = items
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 15);

    return {
      organizationId,
      organizationName: current.organization.name,
      unreadCount: sortedItems.filter((item) => !item.read).length,
      items: sortedItems,
    };
  },
});

export const markNotificationsSeen = mutation({
  args: {},
  handler: async (ctx) => {
    const current = await activeOrganization(ctx);

    if (!current) {
      return null;
    }

    const now = Date.now();
    const existing = await notificationView(ctx, current.organization._id, current.userId);

    if (existing) {
      await ctx.db.patch(existing._id, {
        lastSeenAt: now,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("organizationNotificationViews", {
        organizationId: current.organization._id,
        userId: current.userId,
        lastSeenAt: now,
        updatedAt: now,
      });
    }

    return { organizationId: current.organization._id, lastSeenAt: now };
  },
});
