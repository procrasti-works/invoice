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

function monthStartIso(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
}

function monthEndIso(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))
    .toISOString()
    .slice(0, 10);
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
    const currentMonth = {
      from: monthStartIso(),
      to: monthEndIso(),
    };

    function isCancelled() {
      return cancelled || document.visibilityState === "hidden";
    }

    function prefetchRoute(route: string) {
      if (isCancelled()) {
        return;
      }

      router.prefetch(route);
    }

    function prewarmCoreQueries() {
      if (isCancelled()) {
        return;
      }

      convex.prewarmQuery({
        query: api.users.current,
        args: {},
        extendSubscriptionFor,
      });
      convex.prewarmQuery({
        query: api.invoices.workspace,
        args: {},
        extendSubscriptionFor,
      });
      convex.prewarmQuery({
        query: api.subscriptions.current,
        args: {},
        extendSubscriptionFor,
      });
      convex.prewarmQuery({
        query: api.organizations.switcherState,
        args: {},
        extendSubscriptionFor,
      });
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
    }

    function prewarmAccountingQueries() {
      if (isCancelled()) {
        return;
      }

      convex.prewarmQuery({
        query: api.invoices.listRecords,
        args: currentMonth,
        extendSubscriptionFor,
      });
      convex.prewarmQuery({
        query: api.invoices.listReminderQueue,
        args: {},
        extendSubscriptionFor,
      });
      convex.prewarmQuery({
        query: api.reports.summary,
        args: currentMonth,
        extendSubscriptionFor,
      });
      convex.prewarmQuery({
        query: api.reports.ledgerExport,
        args: currentMonth,
        extendSubscriptionFor,
      });
      convex.prewarmQuery({
        query: api.vat.returnSummary,
        args: currentMonth,
        extendSubscriptionFor,
      });
      convex.prewarmQuery({
        query: api.purchases.listPurchases,
        args: {},
        extendSubscriptionFor,
      });
      convex.prewarmQuery({
        query: api.purchases.listPurchases,
        args: currentMonth,
        extendSubscriptionFor,
      });
      convex.prewarmQuery({
        query: api.purchases.listPurchaseScans,
        args: {},
        extendSubscriptionFor,
      });
    }

    function prewarmSettingsQueries() {
      if (isCancelled()) {
        return;
      }

      convex.prewarmQuery({
        query: api.organizations.settingsState,
        args: {},
        extendSubscriptionFor,
      });
    }

    function warmEverything() {
      routeSet.forEach(prefetchRoute);
      prewarmCoreQueries();
      prewarmAccountingQueries();
      prewarmSettingsQueries();
    }

    const cancelRouteWarmup = scheduleIdle(() => {
      if (isCancelled()) {
        return;
      }

      routeSet.forEach(prefetchRoute);
    }, 250);

    const cancelCoreQueryWarmup = scheduleIdle(() => {
      prewarmCoreQueries();
    }, 700);

    const cancelSecondaryQueryWarmup = scheduleIdle(() => {
      prewarmAccountingQueries();
    }, 1400);
    const cancelSettingsQueryWarmup = scheduleIdle(() => {
      prewarmSettingsQueries();
    }, 2200);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        warmEverything();
      }
    };

    window.addEventListener("focus", warmEverything);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      cancelRouteWarmup();
      cancelCoreQueryWarmup();
      cancelSecondaryQueryWarmup();
      cancelSettingsQueryWarmup();
      window.removeEventListener("focus", warmEverything);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [convex, pathname, router, routes]);

  return null;
}
