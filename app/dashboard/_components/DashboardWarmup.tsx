"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useConvex } from "convex/react";

import { api } from "@/convex/_generated/api";

type IdleWindow = Window &
  typeof globalThis & {
    requestIdleCallback?: (
      callback: () => void,
      options?: { timeout?: number },
    ) => number;
    cancelIdleCallback?: (handle: number) => void;
  };

type NetworkNavigator = Navigator & {
  connection?: {
    saveData?: boolean;
    effectiveType?: string;
  };
};

function scheduleIdle(callback: () => void, timeout: number) {
  const idleWindow = window as IdleWindow;

  if (idleWindow.requestIdleCallback) {
    const handle = idleWindow.requestIdleCallback(callback, { timeout });
    return () => idleWindow.cancelIdleCallback?.(handle);
  }

  const handle = window.setTimeout(callback, timeout);
  return () => window.clearTimeout(handle);
}

function canWarmAggressively() {
  const connection = (navigator as NetworkNavigator).connection;

  if (!connection) {
    return true;
  }

  return !connection.saveData && connection.effectiveType !== "2g";
}

export function DashboardWarmup({ routes }: { routes: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const convex = useConvex();

  useEffect(() => {
    if (!canWarmAggressively()) {
      return;
    }

    let cancelled = false;
    const routeSet = Array.from(new Set(routes)).filter((route) => route !== pathname);
    const extendSubscriptionFor = 90_000;

    const cancelRouteWarmup = scheduleIdle(() => {
      if (cancelled) {
        return;
      }

      routeSet.forEach((route) => router.prefetch(route));
    }, 250);

    const cancelCoreQueryWarmup = scheduleIdle(() => {
      if (cancelled) {
        return;
      }

      convex.prewarmQuery({
        query: api.invoices.list,
        args: {},
        extendSubscriptionFor,
      });
      convex.prewarmQuery({
        query: api.invoices.stats,
        args: {},
        extendSubscriptionFor,
      });
      convex.prewarmQuery({
        query: api.invoices.listClients,
        args: {},
        extendSubscriptionFor,
      });
      convex.prewarmQuery({
        query: api.invoices.listPaymentProofs,
        args: { status: "submitted" },
        extendSubscriptionFor,
      });
    }, 700);

    const cancelSecondaryQueryWarmup = scheduleIdle(() => {
      if (cancelled) {
        return;
      }

      convex.prewarmQuery({
        query: api.invoices.listRecords,
        args: {},
        extendSubscriptionFor,
      });
      convex.prewarmQuery({
        query: api.invoices.listReminderQueue,
        args: {},
        extendSubscriptionFor,
      });
      convex.prewarmQuery({
        query: api.reports.summary,
        args: {},
        extendSubscriptionFor,
      });
      convex.prewarmQuery({
        query: api.purchases.listPurchases,
        args: {},
        extendSubscriptionFor,
      });
      convex.prewarmQuery({
        query: api.organizations.switcherState,
        args: {},
        extendSubscriptionFor,
      });
      convex.prewarmQuery({
        query: api.subscriptions.current,
        args: {},
        extendSubscriptionFor,
      });
    }, 1400);

    return () => {
      cancelled = true;
      cancelRouteWarmup();
      cancelCoreQueryWarmup();
      cancelSecondaryQueryWarmup();
    };
  }, [convex, pathname, router, routes]);

  return null;
}
