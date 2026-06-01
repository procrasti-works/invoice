import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import {
  getOrganizationForUser,
  listOrganizationMemberships,
  setActiveOrganization,
} from "./organizationContext";

const dayMs = 1000 * 60 * 60 * 24;
const trialDays = 14;
const invitationDays = 7;
const defaultTerms = "Payment due within 7 days unless otherwise agreed.";
const defaultPaymentInstructions =
  "Pay by EFT or bank transfer using the invoice number as reference.";

type OrganizationInput = {
  name: string;
  legalName?: string;
  tradingName?: string;
  entityType?: NonNullable<Doc<"organizations">["entityType"]>;
  region?: string;
  vatRegistered?: boolean;
  vatNumber?: string;
  defaultCurrency?: string;
};

const entityTypeValidator = v.union(
  v.literal("sole_proprietor"),
  v.literal("close_corporation"),
  v.literal("private_company"),
  v.literal("partnership"),
  v.literal("ngo"),
  v.literal("other"),
);

const invitableRoleValidator = v.union(
  v.literal("admin"),
  v.literal("finance"),
  v.literal("viewer"),
  v.literal("member"),
);

const invitationStatusValidator = v.union(
  v.literal("pending"),
  v.literal("accepted"),
  v.literal("revoked"),
  v.literal("expired"),
);

function clean(value: string | undefined, fallback = "") {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function maybeString(value: string | undefined) {
  const trimmed = clean(value);
  return trimmed ? trimmed : undefined;
}

function cleanEmail(value: string) {
  const email = value.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid email address");
  }

  return email;
}

function cleanCurrency(value: string | undefined) {
  const currency = clean(value, "NAD").toUpperCase();

  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error("Currency must be a 3-letter code");
  }

  return currency;
}

function randomToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function requireUser(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);

  if (userId === null) {
    throw new Error("Authentication required");
  }

  const user = await ctx.db.get(userId);

  if (!user) {
    throw new Error("User not found");
  }

  return { userId, user };
}

async function requireOrganization(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
) {
  const current = await getOrganizationForUser(ctx, userId);

  if (!current.membership || !current.organization) {
    throw new Error("Organization setup required");
  }

  return {
    membership: current.membership,
    organization: current.organization,
  };
}

function canManageTeam(role: Doc<"memberships">["role"]) {
  return role === "owner" || role === "admin";
}

async function pendingInvitationsForEmail(ctx: QueryCtx, email: string) {
  const invitations = await ctx.db
    .query("organizationInvitations")
    .withIndex("by_email_and_status", (q) =>
      q.eq("email", email).eq("status", "pending"),
    )
    .take(10);

  return await Promise.all(
    invitations.map(async (invitation) => {
      const organization = await ctx.db.get(invitation.organizationId);

      return {
        _id: invitation._id,
        organizationId: invitation.organizationId,
        organizationName: organization?.name ?? "Workspace",
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        expired: invitation.expiresAt <= Date.now(),
      };
    }),
  );
}

async function createOrganizationMembership(
  ctx: MutationCtx,
  userId: Id<"users">,
  input: OrganizationInput,
) {
  const name = clean(input.name);

  if (!name) {
    throw new Error("Organization name is required");
  }

  const now = Date.now();
  const tradingName = clean(input.tradingName, name);
  const organizationId = await ctx.db.insert("organizations", {
    name,
    legalName: maybeString(input.legalName),
    tradingName,
    ...(input.entityType ? { entityType: input.entityType } : {}),
    region: maybeString(input.region),
    vatNumber: maybeString(input.vatNumber),
    vatRegistered: input.vatRegistered ?? false,
    ownerUserId: userId,
    defaultCurrency: cleanCurrency(input.defaultCurrency),
    paymentInstructions: defaultPaymentInstructions,
    brandColor: "#111111",
    defaultTerms,
    invoicePrefix: "INV",
    nextInvoiceSequence: 1,
    createdAt: now,
    updatedAt: now,
  });

  await ctx.db.insert("memberships", {
    organizationId,
    userId,
    role: "owner",
    createdAt: now,
  });

  await ctx.db.insert("subscriptions", {
    organizationId,
    plan: "trial",
    status: "trialing",
    currentPeriodEnd: now + trialDays * dayMs,
    createdAt: now,
    updatedAt: now,
  });

  await setActiveOrganization(ctx, userId, organizationId);
  return organizationId;
}

async function acceptInvitationDoc(
  ctx: MutationCtx,
  invitation: Doc<"organizationInvitations">,
  userId: Id<"users">,
  userEmail: string,
) {
  const now = Date.now();

  if (invitation.status !== "pending") {
    throw new Error("This invitation is no longer active");
  }

  if (invitation.expiresAt <= now) {
    await ctx.db.patch(invitation._id, {
      status: "expired",
      updatedAt: now,
    });
    throw new Error("This invitation has expired");
  }

  if (invitation.email !== userEmail) {
    throw new Error("Sign in with the invited email address to join this organization");
  }

  const existingOrgMembership = await ctx.db
    .query("memberships")
    .withIndex("by_organizationId_and_userId", (q) =>
      q.eq("organizationId", invitation.organizationId).eq("userId", userId),
    )
    .unique();

  if (existingOrgMembership) {
    await ctx.db.patch(invitation._id, {
      status: "accepted",
      acceptedByUserId: userId,
      acceptedAt: now,
      updatedAt: now,
    });
    await setActiveOrganization(ctx, userId, invitation.organizationId);
    return invitation.organizationId;
  }

  await ctx.db.insert("memberships", {
    organizationId: invitation.organizationId,
    userId,
    role: invitation.role,
    createdAt: now,
  });

  await ctx.db.patch(invitation._id, {
    status: "accepted",
    acceptedByUserId: userId,
    acceptedAt: now,
    updatedAt: now,
  });

  await setActiveOrganization(ctx, userId, invitation.organizationId);
  return invitation.organizationId;
}

export const onboardingState = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    if (userId === null) {
      return {
        authenticated: false,
        user: null,
        membership: null,
        organization: null,
        pendingInvitations: [],
      };
    }

    const user = await ctx.db.get(userId);
    const current = await getOrganizationForUser(ctx, userId);
    const email =
      typeof user?.email === "string" ? user.email.trim().toLowerCase() : "";
    const pendingInvitations = email
      ? await pendingInvitationsForEmail(ctx, email)
      : [];

    return {
      authenticated: true,
      user,
      membership: current.membership,
      organization: current.organization,
      pendingInvitations,
    };
  },
});

export const switcherState = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    if (userId === null) {
      return {
        authenticated: false,
        user: null,
        membership: null,
        organization: null,
        organizations: [],
        pendingInvitations: [],
      };
    }

    const user = await ctx.db.get(userId);
    const current = await getOrganizationForUser(ctx, userId);
    const memberships = await listOrganizationMemberships(ctx, userId);
    const email =
      typeof user?.email === "string" ? user.email.trim().toLowerCase() : "";
    const pendingInvitations = email
      ? await pendingInvitationsForEmail(ctx, email)
      : [];

    return {
      authenticated: true,
      user,
      membership: current.membership,
      organization: current.organization,
      organizations: memberships.map((item) => ({
        membership: item.membership,
        organization: item.organization,
        active: item.organization._id === current.organization?._id,
      })),
      pendingInvitations,
    };
  },
});

export const createFromOnboarding = mutation({
  args: {
    name: v.string(),
    legalName: v.optional(v.string()),
    tradingName: v.optional(v.string()),
    entityType: v.optional(entityTypeValidator),
    region: v.optional(v.string()),
    vatRegistered: v.boolean(),
    vatNumber: v.optional(v.string()),
    defaultCurrency: v.string(),
    createSeparate: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await requireUser(ctx);
    const existing = await getOrganizationForUser(ctx, userId);

    if (existing.organization && !args.createSeparate) {
      return { organizationId: existing.organization._id, created: false };
    }

    const now = Date.now();
    const userEmail =
      typeof user.email === "string" ? user.email.trim().toLowerCase() : "";

    if (userEmail) {
      const pendingInvitations = await ctx.db
        .query("organizationInvitations")
        .withIndex("by_email_and_status", (q) =>
          q.eq("email", userEmail).eq("status", "pending"),
        )
        .take(10);
      const activeInvitations = pendingInvitations.filter(
        (invitation) => invitation.expiresAt > now,
      );

      if (activeInvitations.length > 0 && !args.createSeparate) {
        throw new Error("Accept your pending invitation or confirm a separate workspace first");
      }
    }

    const organizationId = await createOrganizationMembership(ctx, userId, {
      name: args.name,
      legalName: args.legalName,
      tradingName: args.tradingName,
      entityType: args.entityType,
      region: args.region,
      vatRegistered: args.vatRegistered,
      vatNumber: args.vatNumber,
      defaultCurrency: args.defaultCurrency,
    });

    return { organizationId, created: true };
  },
});

export const switchOrganization = mutation({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx);
    const current = await setActiveOrganization(ctx, userId, args.organizationId);

    return {
      organizationId: current.organization._id,
      membershipId: current.membership._id,
    };
  },
});

export const invitationByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const invitation = await ctx.db
      .query("organizationInvitations")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();

    if (!invitation) {
      return null;
    }

    const organization = await ctx.db.get(invitation.organizationId);
    const expired =
      invitation.status === "pending" && invitation.expiresAt <= Date.now();

    return {
      _id: invitation._id,
      email: invitation.email,
      role: invitation.role,
      status: expired ? "expired" : invitation.status,
      expiresAt: invitation.expiresAt,
      organizationName: organization?.name ?? "Workspace",
    };
  },
});

export const listInvitations = query({
  args: {
    status: v.optional(invitationStatusValidator),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx);
    const { membership, organization } = await requireOrganization(ctx, userId);

    if (!canManageTeam(membership.role)) {
      return [];
    }

    const status = args.status;
    const invitations = status
      ? await ctx.db
          .query("organizationInvitations")
          .withIndex("by_organizationId_and_status", (q) =>
            q.eq("organizationId", organization._id).eq("status", status),
          )
          .order("desc")
          .take(100)
      : await ctx.db
          .query("organizationInvitations")
          .withIndex("by_organizationId", (q) =>
            q.eq("organizationId", organization._id),
          )
          .order("desc")
          .take(100);

    return invitations.map((invitation) => ({
      ...invitation,
      token: invitation.status === "pending" ? invitation.token : "",
      expired:
        invitation.status === "pending" && invitation.expiresAt <= Date.now(),
    }));
  },
});

export const createInvitation = mutation({
  args: {
    email: v.string(),
    role: invitableRoleValidator,
  },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx);
    const { membership, organization } = await requireOrganization(ctx, userId);

    if (!canManageTeam(membership.role)) {
      throw new Error("Only organization owners and admins can invite users");
    }

    const email = cleanEmail(args.email);
    const now = Date.now();
    const existing = await ctx.db
      .query("organizationInvitations")
      .withIndex("by_organizationId_and_email_and_status", (q) =>
        q
          .eq("organizationId", organization._id)
          .eq("email", email)
          .eq("status", "pending"),
      )
      .take(1);
    const pending = existing[0];

    if (pending && pending.expiresAt > now) {
      return {
        invitationId: pending._id,
        email: pending.email,
        role: pending.role,
        token: pending.token,
        expiresAt: pending.expiresAt,
      };
    }

    if (pending) {
      await ctx.db.patch(pending._id, {
        status: "expired",
        updatedAt: now,
      });
    }

    const invitationId = await ctx.db.insert("organizationInvitations", {
      organizationId: organization._id,
      email,
      role: args.role,
      token: randomToken(),
      status: "pending",
      invitedByUserId: userId,
      expiresAt: now + invitationDays * dayMs,
      createdAt: now,
      updatedAt: now,
    });
    const invitation = await ctx.db.get(invitationId);

    if (!invitation) {
      throw new Error("Unable to create invitation");
    }

    return {
      invitationId,
      email: invitation.email,
      role: invitation.role,
      token: invitation.token,
      expiresAt: invitation.expiresAt,
    };
  },
});

export const revokeInvitation = mutation({
  args: { invitationId: v.id("organizationInvitations") },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx);
    const { membership, organization } = await requireOrganization(ctx, userId);

    if (!canManageTeam(membership.role)) {
      throw new Error("Only organization owners and admins can revoke invitations");
    }

    const invitation = await ctx.db.get(args.invitationId);

    if (!invitation || invitation.organizationId !== organization._id) {
      throw new Error("Invitation not found");
    }

    if (invitation.status !== "pending") {
      throw new Error("Only pending invitations can be revoked");
    }

    const now = Date.now();
    await ctx.db.patch(invitation._id, {
      status: "revoked",
      revokedAt: now,
      updatedAt: now,
    });
  },
});

export const acceptInvitation = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const { userId, user } = await requireUser(ctx);
    const email =
      typeof user.email === "string" ? cleanEmail(user.email) : "";

    if (!email) {
      throw new Error("Your account needs an email address to accept invitations");
    }

    const invitation = await ctx.db
      .query("organizationInvitations")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();

    if (!invitation) {
      throw new Error("Invitation not found");
    }

    const organizationId = await acceptInvitationDoc(ctx, invitation, userId, email);
    return { organizationId };
  },
});

export const acceptInvitationById = mutation({
  args: { invitationId: v.id("organizationInvitations") },
  handler: async (ctx, args) => {
    const { userId, user } = await requireUser(ctx);
    const email =
      typeof user.email === "string" ? cleanEmail(user.email) : "";

    if (!email) {
      throw new Error("Your account needs an email address to accept invitations");
    }

    const invitation = await ctx.db.get(args.invitationId);

    if (!invitation) {
      throw new Error("Invitation not found");
    }

    const organizationId = await acceptInvitationDoc(ctx, invitation, userId, email);
    return { organizationId };
  },
});
