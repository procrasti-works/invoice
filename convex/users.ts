import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function cleanRequired(value: string, label: string, maxLength: number) {
  const trimmed = value.trim().replace(/\s+/g, " ");

  if (!trimmed) {
    throw new Error(`${label} is required`);
  }

  if (trimmed.length > maxLength) {
    throw new Error(`${label} must be ${maxLength} characters or less`);
  }

  return trimmed;
}

function cleanOptional(value: string, label: string, maxLength: number) {
  const trimmed = value.trim().replace(/\s+/g, " ");

  if (trimmed.length > maxLength) {
    throw new Error(`${label} must be ${maxLength} characters or less`);
  }

  return trimmed;
}

export const current = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    if (userId === null) {
      return null;
    }

    const user = await ctx.db.get(userId);

    if (!user) {
      return null;
    }

    return await userWithResolvedAvatar(ctx, user);
  },
});

export const updateProfile = mutation({
  args: {
    name: v.string(),
    phone: v.string(),
    avatarStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await requireCurrentUser(ctx);
    const avatar = args.avatarStorageId
      ? await validateAvatarStorage(ctx, args.avatarStorageId)
      : null;
    const previousAvatarStorageId = user.avatarStorageId;

    await ctx.db.patch(userId, {
      name: cleanRequired(args.name, "Name", 80),
      phone: cleanOptional(args.phone, "Phone", 40),
      ...(args.avatarStorageId
        ? {
            avatarStorageId: args.avatarStorageId,
            image: avatar?.url ?? "",
          }
        : null),
    });

    if (
      previousAvatarStorageId &&
      args.avatarStorageId &&
      previousAvatarStorageId !== args.avatarStorageId
    ) {
      await ctx.storage.delete(previousAvatarStorageId);
    }

    const updated = await ctx.db.get(userId);

    return updated ? await userWithResolvedAvatar(ctx, updated) : null;
  },
});

export const generateAvatarUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireCurrentUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const removeAvatar = mutation({
  args: {},
  handler: async (ctx) => {
    const { userId, user } = await requireCurrentUser(ctx);
    const previousAvatarStorageId = user.avatarStorageId;

    await ctx.db.patch(userId, {
      avatarStorageId: undefined,
      image: user.googleImage ?? "",
    });

    if (previousAvatarStorageId) {
      await ctx.storage.delete(previousAvatarStorageId);
    }

    const updated = await ctx.db.get(userId);

    return updated ? await userWithResolvedAvatar(ctx, updated) : null;
  },
});

async function requireCurrentUser(ctx: QueryCtx | MutationCtx) {
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

async function validateAvatarStorage(
  ctx: QueryCtx | MutationCtx,
  storageId: Id<"_storage">,
) {
  const metadata = await ctx.db.system.get("_storage", storageId);

  if (!metadata) {
    throw new Error("Uploaded avatar was not found.");
  }

  if (metadata.size > MAX_AVATAR_BYTES) {
    throw new Error("Avatar image must be 5 MB or smaller.");
  }

  if (!metadata.contentType || !ALLOWED_AVATAR_TYPES.has(metadata.contentType)) {
    throw new Error("Avatar must be a PNG, JPG, WebP, or GIF image.");
  }

  const url = await ctx.storage.getUrl(storageId);

  if (!url) {
    throw new Error("Uploaded avatar is not available.");
  }

  return { metadata, url };
}

export async function userWithResolvedAvatar(
  ctx: QueryCtx | MutationCtx,
  user: Doc<"users">,
) {
  const fallbackImage = user.googleImage || user.image || "";
  const avatarImage = user.avatarStorageId
    ? await ctx.storage.getUrl(user.avatarStorageId)
    : null;

  return {
    ...user,
    image: avatarImage ?? fallbackImage,
    role: user.role ?? "user",
  };
}
