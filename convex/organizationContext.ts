import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  canRolePerform,
  type PermissionKey,
} from "./organizationPermissions";

type OrganizationCtx = QueryCtx | MutationCtx;

export type OrganizationMembership = {
  membership: Doc<"memberships">;
  organization: Doc<"organizations">;
};

async function activePreference(ctx: OrganizationCtx, userId: Id<"users">) {
  const preferences = await ctx.db
    .query("userOrganizationPreferences")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .take(1);

  return preferences[0] ?? null;
}

export async function listOrganizationMemberships(
  ctx: OrganizationCtx,
  userId: Id<"users">,
) {
  const memberships = await ctx.db
    .query("memberships")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .take(100);

  const organizations = await Promise.all(
    memberships.map(async (membership) => {
      const organization = await ctx.db.get(membership.organizationId);
      return organization && !organization.deletedAt
        ? { membership, organization }
        : null;
    }),
  );

  return organizations.filter(
    (item): item is OrganizationMembership => item !== null,
  );
}

export async function getOrganizationForUser(
  ctx: OrganizationCtx,
  userId: Id<"users">,
) {
  const memberships = await listOrganizationMemberships(ctx, userId);

  if (memberships.length === 0) {
    return { membership: null, organization: null };
  }

  const preference = await activePreference(ctx, userId);
  const selected = preference?.activeOrganizationId
    ? memberships.find(
        (item) => item.membership.organizationId === preference.activeOrganizationId,
      )
    : null;

  return selected ?? memberships[0];
}

export async function getExistingOrganization(
  ctx: OrganizationCtx,
  userId: Id<"users">,
) {
  const current = await getOrganizationForUser(ctx, userId);
  return current.organization;
}

export async function setActiveOrganization(
  ctx: MutationCtx,
  userId: Id<"users">,
  organizationId: Id<"organizations">,
) {
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_organizationId_and_userId", (q) =>
      q.eq("organizationId", organizationId).eq("userId", userId),
    )
    .unique();

  if (!membership) {
    throw new Error("You are not a member of this organization");
  }

  const organization = await ctx.db.get(organizationId);

  if (!organization) {
    throw new Error("Organization not found");
  }

  if (organization.deletedAt) {
    throw new Error("Organization not found");
  }

  const now = Date.now();
  const preference = await activePreference(ctx, userId);

  if (preference) {
    await ctx.db.patch(preference._id, {
      activeOrganizationId: organizationId,
      updatedAt: now,
    });
  } else {
    await ctx.db.insert("userOrganizationPreferences", {
      userId,
      activeOrganizationId: organizationId,
      updatedAt: now,
    });
  }

  return { membership, organization };
}

export function membershipCan(
  membership: Doc<"memberships">,
  organization: Doc<"organizations">,
  permission: PermissionKey,
) {
  return canRolePerform(
    membership.role,
    organization.permissionPolicy,
    permission,
  );
}

export async function requireOrganizationPermission(
  ctx: OrganizationCtx,
  userId: Id<"users">,
  permission: PermissionKey,
) {
  const current = await getOrganizationForUser(ctx, userId);

  if (!current.membership || !current.organization) {
    throw new Error("Organization setup required");
  }

  if (!membershipCan(current.membership, current.organization, permission)) {
    throw new Error("You do not have permission for this organization action");
  }

  return current;
}
