import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import {
  getExistingOrganization,
  requireOrganizationPermission,
} from "./organizationContext";

type Plan = "trial" | "starter" | "business" | "professional" | "enterprise";

/**
 * Access codes are validated SERVER-SIDE only. The plan a code grants is
 * never decided by the client. Codes may be supplied at deploy time via the
 * PAYVIO_ACCESS_CODES env var (JSON: { "CODE": "plan" }); the constants below
 * are the built-in fallback so existing codes keep working.
 *
 * NOTE: never import or reference this map from any client component — it
 * must not ship in the browser bundle.
 */
const FALLBACK_ACCESS_CODES: Record<string, Plan> = {
  "PAYVIO-ADMIN-2026": "enterprise",
  "ENT-2026": "enterprise",
  "PRO-2026": "professional",
  "BIZ-2026": "business",
  "START-2026": "starter",
};

function accessCodeTable(): Record<string, Plan> {
  const raw = process.env.PAYVIO_ACCESS_CODES;
  if (!raw) return FALLBACK_ACCESS_CODES;
  try {
    const parsed = JSON.parse(raw) as Record<string, Plan>;
    return Object.keys(parsed).length > 0 ? parsed : FALLBACK_ACCESS_CODES;
  } catch {
    return FALLBACK_ACCESS_CODES;
  }
}

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

/**
 * Redeem an access code to set the workspace plan. The code is validated on
 * the server and the granted plan is derived server-side — the client never
 * chooses the plan. Requires the caller to hold the manageSettings permission
 * (owner/admin by default), enforced server-side regardless of the UI.
 */
export const redeemAccessCode = mutation({
  args: {
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Authentication required");
    }

    // Server-side authorization: only members who can manage settings.
    const { organization } = await requireOrganizationPermission(
      ctx,
      userId,
      "manageSettings",
    );

    const normalized = args.code.trim().toUpperCase();
    if (normalized.length === 0 || normalized.length > 64) {
      throw new Error("Invalid access code.");
    }

    const plan = accessCodeTable()[normalized];
    if (!plan) {
      throw new Error("Invalid access code.");
    }

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
        plan,
        status: "active",
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("subscriptions", {
        organizationId: organization._id,
        plan,
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
    }

    return { plan };
  },
});
