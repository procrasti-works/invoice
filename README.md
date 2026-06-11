This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Code Review Notes — Fable 5 (2026-06-10)

Overall the codebase is technically clean: TypeScript compiles with zero errors,
the production build succeeds for all routes, and lint shows only 6 unused-import
warnings (in `app/dashboard/receipts/page.tsx`).

### 🔴 Critical: access-code billing upgrade is not secure

The Billing panel lets anyone grant themselves a paid plan (including Enterprise).
Two independent holes:

1. **Codes are validated only in the browser and ship to every visitor.** The
   access codes are hardcoded in `app/dashboard/_components/SettingsPage.tsx`
   (`ACCESS_CODES`, ~line 787), so they get compiled into the public JS bundle on
   payvio.site. Anyone can open DevTools, search the bundle for "PAYVIO", and read
   `PAYVIO-ADMIN-2026` to unlock Enterprise.
2. **The server never checks the code at all.** `upsertForOrganization` in
   `convex/subscriptions.ts` accepts `{ plan, status }` from any authenticated
   user — no code, no owner/admin role check. A user can skip the UI and call the
   Convex mutation directly with `plan: "enterprise", status: "active"`. Rotating
   the codes alone would not fix this.

**Recommended fix:** move validation server-side. Replace the open mutation with a
`redeemAccessCode({ code })` mutation that looks the code up on the server (env var
or a codes table so they can be rotated/revoked), verifies the caller is the org
owner, then writes the subscription. The client should never receive the code list
or be able to pick its own plan. Longer term, real billing can run through the
Stripe/PayPal/Square integrations with access codes kept as an admin/comp path
behind the same server-side check.

### Smaller improvements

- Remove the 6 unused imports/vars in `app/dashboard/receipts/page.tsx`.
- Add the owner/admin role check to the subscription mutation itself (not just the
  UI), covered by the fix above.
