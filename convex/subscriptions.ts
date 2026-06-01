import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { getExistingOrganization } from "./organizationContext";

const planValidator = v.union(
  v.literal("trial"),
  v.literal("starter"),
  v.literal("business"),
  v.literal("professional"),
  v.literal("enterprise"),
);

const statusValidator = v.union(
  v.literal("trialing"),
  v.literal("active"),
  v.literal("past_due"),
  v.literal("canceled"),
);

async function requireOrganization(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);

  if (userId === null) {
    throw new Error("Authentication required");
  }

  const organization = await getExistingOrganization(ctx, userId);

  if (!organization) {
    throw new Error("Organization setup required");
  }

  return { userId, organization };
}

export const current = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    if (userId === null) {
      return null;
    }

    const organization = await getExistingOrganization(ctx, userId);

    if (!organization) {
      return null;
    }

    const subscriptions = await ctx.db
      .query("subscriptions")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", organization._id),
      )
      .order("desc")
      .take(1);

    return subscriptions[0] ?? null;
  },
});

export const upsertForOrganization = mutation({
  args: {
    plan: planValidator,
    status: statusValidator,
    currentPeriodEnd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { organization } = await requireOrganization(ctx);
    const now = Date.now();
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", organization._id),
      )
      .order("desc")
      .take(1);
    const current = existing[0];

    if (current) {
      await ctx.db.patch(current._id, {
        plan: args.plan,
        status: args.status,
        currentPeriodEnd: args.currentPeriodEnd,
        updatedAt: now,
      });
      return current._id;
    }

    return await ctx.db.insert("subscriptions", {
      organizationId: organization._id,
      plan: args.plan,
      status: args.status,
      currentPeriodEnd: args.currentPeriodEnd,
      createdAt: now,
      updatedAt: now,
    });
  },
});
