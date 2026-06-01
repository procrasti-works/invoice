import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import Google, { type GoogleProfile } from "@auth/core/providers/google";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Google({
      allowDangerousEmailAccountLinking: false,
      profile(profile: GoogleProfile) {
        const email = normalizeEmail(profile.email);

        if (!email) {
          throw new Error("Google account must include an email address");
        }

        return {
          id: profile.sub,
          email,
          emailVerified: profile.email_verified === true,
          name: normalizeName(profile.name, email),
          image: profile.picture,
        };
      },
    }),
    Password({
      profile(params) {
        const email = normalizeEmail(params.email);
        const name =
          typeof params.name === "string" ? params.name.trim() : undefined;

        if (!email) {
          throw new Error("Email is required");
        }

        return {
          email,
          name: name || email.split("@")[0],
        };
      },
    }),
  ],
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      const email = normalizeEmail(args.profile.email);

      if (!email) {
        throw new Error("Email is required");
      }

      const name = normalizeName(args.profile.name, email);
      const image =
        typeof args.profile.image === "string" && args.profile.image.trim()
          ? args.profile.image.trim()
          : undefined;
      const emailVerified =
        args.profile.emailVerified === true || args.type === "email";
      const now = Date.now();
      const envRole = roleForEmail(email);
      const userData = {
        email,
        name,
        ...(image ? { image } : null),
        ...(emailVerified ? { emailVerificationTime: now } : null),
      };

      const appCtx = ctx as MutationCtx;

      if (args.existingUserId !== null) {
        const existingUser = await appCtx.db.get(args.existingUserId);
        const existingUserWithEmail = await uniqueUserByEmail(appCtx, email);

        if (
          existingUserWithEmail !== null &&
          existingUserWithEmail._id !== args.existingUserId
        ) {
          throw new Error("Another account already uses this email address");
        }

        await appCtx.db.patch(args.existingUserId, {
          ...userData,
          ...rolePatchForExisting(existingUser, envRole),
        });
        return args.existingUserId;
      }

      const existingUser = await uniqueUserByEmail(appCtx, email);

      if (existingUser !== null) {
        if (args.type === "oauth" && !emailVerified) {
          throw new Error("Google account email must be verified");
        }

        if (args.type !== "oauth" && !args.shouldLink && !emailVerified) {
          throw new Error("An account with this email already exists");
        }

        await appCtx.db.patch(existingUser._id, {
          ...userData,
          ...rolePatchForExisting(existingUser, envRole),
        });
        return existingUser._id;
      }

      if (args.type === "oauth" && !emailVerified) {
        throw new Error("Google account email must be verified");
      }

      return await appCtx.db.insert("users", {
        ...userData,
        role: envRole,
      });
    },
  },
});

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeName(value: unknown, email: string) {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : email.split("@")[0];
}

async function uniqueUserByEmail(
  ctx: MutationCtx,
  email: string,
) {
  const users = await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", email))
    .take(2);

  if (users.length > 1) {
    throw new Error("Multiple accounts already use this email address");
  }

  return users[0] ?? null;
}

function roleForEmail(email: string) {
  const admins = (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((item) => normalizeEmail(item))
    .filter(Boolean);

  return admins.includes(email) ? "admin" : "user";
}

function rolePatchForExisting(
  user: Doc<"users"> | null,
  envRole: "user" | "admin",
) {
  if (envRole === "admin") {
    return { role: "admin" as const };
  }

  return user?.role ? {} : { role: "user" as const };
}
