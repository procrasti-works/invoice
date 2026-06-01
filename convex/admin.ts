import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";

const platformRoleValidator = v.union(v.literal("user"), v.literal("admin"));

const subscriptionPlanValidator = v.union(
  v.literal("trial"),
  v.literal("starter"),
  v.literal("business"),
  v.literal("professional"),
  v.literal("enterprise"),
);

const subscriptionStatusValidator = v.union(
  v.literal("trialing"),
  v.literal("active"),
  v.literal("past_due"),
  v.literal("canceled"),
);

type AdminCtx = QueryCtx | MutationCtx;

function platformRole(user: Doc<"users"> | null) {
  return user?.role === "admin" ? "admin" : "user";
}

function userSummary(user: Doc<"users"> | null) {
  if (!user) {
    return null;
  }

  return {
    _id: user._id,
    createdAt: user._creationTime,
    name: typeof user.name === "string" ? user.name : "",
    email: typeof user.email === "string" ? user.email : "",
    image: typeof user.image === "string" ? user.image : "",
    role: platformRole(user),
  };
}

async function currentAdmin(ctx: AdminCtx) {
  const userId = await getAuthUserId(ctx);

  if (userId === null) {
    return null;
  }

  const user = await ctx.db.get(userId);

  if (!user || platformRole(user) !== "admin") {
    return null;
  }

  return { userId, user };
}

async function requirePlatformAdmin(ctx: AdminCtx) {
  const admin = await currentAdmin(ctx);

  if (!admin) {
    throw new Error("Admin access required");
  }

  return admin;
}

async function organizationSummary(
  ctx: AdminCtx,
  organization: Doc<"organizations">,
) {
  const [owner, memberships, subscriptionRows] = await Promise.all([
    ctx.db.get(organization.ownerUserId),
    ctx.db
      .query("memberships")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", organization._id),
      )
      .take(100),
    ctx.db
      .query("subscriptions")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", organization._id),
      )
      .take(1),
  ]);

  return {
    organization: {
      _id: organization._id,
      createdAt: organization.createdAt,
      updatedAt: organization.updatedAt,
      name: organization.name,
      defaultCurrency: organization.defaultCurrency,
      region: organization.region ?? "",
      vatRegistered: organization.vatRegistered ?? false,
      deletedAt: organization.deletedAt ?? null,
    },
    owner: userSummary(owner),
    memberCount: memberships.length,
    subscription: subscriptionRows[0] ?? null,
  };
}

export const platformState = query({
  args: {},
  handler: async (ctx) => {
    const admin = await currentAdmin(ctx);

    if (!admin) {
      return {
        authenticated: (await getAuthUserId(ctx)) !== null,
        authorized: false,
        viewer: null,
        stats: null,
        users: [],
        organizations: [],
      };
    }

    const [users, adminUsers, organizations] = await Promise.all([
      ctx.db.query("users").order("desc").take(80),
      ctx.db
        .query("users")
        .withIndex("by_role", (q) => q.eq("role", "admin"))
        .take(25),
      ctx.db.query("organizations").order("desc").take(80),
    ]);

    const usersWithMemberships = await Promise.all(
      users.map(async (user) => {
        const memberships = await ctx.db
          .query("memberships")
          .withIndex("by_userId", (q) => q.eq("userId", user._id))
          .take(100);

        return {
          ...userSummary(user)!,
          organizationCount: memberships.length,
        };
      }),
    );

    const organizationRows = await Promise.all(
      organizations.map((organization) =>
        organizationSummary(ctx, organization),
      ),
    );

    return {
      authenticated: true,
      authorized: true,
      viewer: userSummary(admin.user),
      stats: {
        loadedUsers: users.length,
        loadedOrganizations: organizations.length,
        loadedAdmins: adminUsers.length,
        activeOrganizations: organizations.filter(
          (organization) => !organization.deletedAt,
        ).length,
        deletedOrganizations: organizations.filter(
          (organization) => organization.deletedAt,
        ).length,
      },
      users: usersWithMemberships,
      organizations: organizationRows,
    };
  },
});

export const setUserRole = mutation({
  args: {
    userId: v.id("users"),
    role: platformRoleValidator,
  },
  handler: async (ctx, args) => {
    const admin = await requirePlatformAdmin(ctx);
    const target = await ctx.db.get(args.userId);

    if (!target) {
      throw new Error("User not found");
    }

    if (
      target._id === admin.userId &&
      platformRole(target) === "admin" &&
      args.role !== "admin"
    ) {
      const admins = await ctx.db
        .query("users")
        .withIndex("by_role", (q) => q.eq("role", "admin"))
        .take(2);

      if (admins.length <= 1) {
        throw new Error("Create another admin before changing your own role");
      }
    }

    await ctx.db.patch(target._id, {
      role: args.role,
    });

    const updated = await ctx.db.get(target._id);
    return userSummary(updated);
  },
});

export const updateOrganizationSubscription = mutation({
  args: {
    organizationId: v.id("organizations"),
    plan: subscriptionPlanValidator,
    status: subscriptionStatusValidator,
    currentPeriodEnd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx);
    const organization = await ctx.db.get(args.organizationId);

    if (!organization) {
      throw new Error("Organization not found");
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .take(1);
    const subscription = existing[0] ?? null;
    const patch = {
      plan: args.plan,
      status: args.status,
      updatedAt: now,
      ...(args.currentPeriodEnd !== undefined
        ? { currentPeriodEnd: args.currentPeriodEnd }
        : {}),
    };

    if (subscription) {
      await ctx.db.patch(subscription._id, patch);
      return await ctx.db.get(subscription._id);
    }

    const subscriptionId = await ctx.db.insert("subscriptions", {
      organizationId: args.organizationId,
      ...patch,
      createdAt: now,
    });

    return await ctx.db.get(subscriptionId);
  },
});

export const setOrganizationDeleted = mutation({
  args: {
    organizationId: v.id("organizations"),
    deleted: v.boolean(),
  },
  handler: async (ctx, args) => {
    const admin = await requirePlatformAdmin(ctx);
    const organization = await ctx.db.get(args.organizationId);

    if (!organization) {
      throw new Error("Organization not found");
    }

    const now = Date.now();
    await ctx.db.patch(organization._id, {
      deletedAt: args.deleted ? now : undefined,
      deletedByUserId: args.deleted ? admin.userId : undefined,
      updatedAt: now,
    });

    const updated = await ctx.db.get(organization._id);

    if (!updated) {
      throw new Error("Organization not found");
    }

    return organizationSummary(ctx, updated);
  },
});
