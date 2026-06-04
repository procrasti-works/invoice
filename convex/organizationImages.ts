import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

const MAX_ORGANIZATION_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_ORGANIZATION_IMAGE_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export async function validateOrganizationImageStorage(
  ctx: QueryCtx | MutationCtx,
  storageId: Id<"_storage">,
) {
  const metadata = await ctx.db.system.get("_storage", storageId);

  if (!metadata) {
    throw new Error("Uploaded organization image was not found.");
  }

  if (metadata.size > MAX_ORGANIZATION_IMAGE_BYTES) {
    throw new Error("Organization image must be 5 MB or smaller.");
  }

  if (
    !metadata.contentType ||
    !ALLOWED_ORGANIZATION_IMAGE_TYPES.has(metadata.contentType)
  ) {
    throw new Error("Organization image must be a PNG, JPG, WebP, or GIF file.");
  }

  const url = await ctx.storage.getUrl(storageId);

  if (!url) {
    throw new Error("Uploaded organization image is not available.");
  }

  return { metadata, url };
}

export async function organizationWithImageUrl(
  ctx: QueryCtx | MutationCtx,
  organization: Doc<"organizations">,
) {
  const imageUrl = organization.imageStorageId
    ? await ctx.storage.getUrl(organization.imageStorageId)
    : null;

  return {
    ...organization,
    imageUrl: imageUrl ?? null,
  };
}
