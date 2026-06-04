/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as auth from "../auth.js";
import type * as dashboard from "../dashboard.js";
import type * as http from "../http.js";
import type * as invoices from "../invoices.js";
import type * as organizationContext from "../organizationContext.js";
import type * as organizationImages from "../organizationImages.js";
import type * as organizationPermissions from "../organizationPermissions.js";
import type * as organizations from "../organizations.js";
import type * as purchaseScanExtraction from "../purchaseScanExtraction.js";
import type * as purchases from "../purchases.js";
import type * as reports from "../reports.js";
import type * as subscriptions from "../subscriptions.js";
import type * as users from "../users.js";
import type * as vat from "../vat.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  auth: typeof auth;
  dashboard: typeof dashboard;
  http: typeof http;
  invoices: typeof invoices;
  organizationContext: typeof organizationContext;
  organizationImages: typeof organizationImages;
  organizationPermissions: typeof organizationPermissions;
  organizations: typeof organizations;
  purchaseScanExtraction: typeof purchaseScanExtraction;
  purchases: typeof purchases;
  reports: typeof reports;
  subscriptions: typeof subscriptions;
  users: typeof users;
  vat: typeof vat;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
