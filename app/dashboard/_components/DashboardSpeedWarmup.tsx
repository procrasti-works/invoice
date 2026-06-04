"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";

const EMPTY_ARGS = {};

const DASHBOARD_ROUTES = [
  "/dashboard",
  "/dashboard/clients",
  "/dashboard/reminders",
  "/dashboard/reports",
  "/dashboard/scan",
  "/dashboard/vat",
  "/dashboard/settings",
  "/dashboard/support",
  "/dashboard/invoices/create",
];

function monthRange() {
  const today = new Date();
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth();

  return {
    from: new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10),
    to: new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10),
  };
}

function useIdleWarmup(active: boolean) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!active || ready) {
      return;
    }

    const idleWindow = window as typeof window & {
      requestIdleCallback?: (
        callback: IdleRequestCallback,
        options?: IdleRequestOptions,
      ) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    let cancelled = false;
    let idleHandle: number | null = null;
    let timeoutHandle: number | null = null;

    const markReady = () => {
      if (!cancelled) {
        setReady(true);
      }
    };

    if (idleWindow.requestIdleCallback) {
      idleHandle = idleWindow.requestIdleCallback(markReady, { timeout: 1_200 });
    } else {
      timeoutHandle = window.setTimeout(markReady, 400);
    }

    return () => {
      cancelled = true;

      if (idleHandle !== null && idleWindow.cancelIdleCallback) {
        idleWindow.cancelIdleCallback(idleHandle);
      }

      if (timeoutHandle !== null) {
        window.clearTimeout(timeoutHandle);
      }
    };
  }, [active, ready]);

  return active && ready;
}

export function DashboardSpeedWarmup({
  active,
  intentRoute,
}: {
  active: boolean;
  intentRoute: string | null;
}) {
  const router = useRouter();
  const warmCommon = useIdleWarmup(active);
  const reportPeriod = useMemo(() => monthRange(), []);
  const intent = active ? intentRoute : null;
  const warmInvoices = warmCommon || intent === "/dashboard";
  const warmClients =
    warmCommon ||
    intent === "/dashboard/clients" ||
    intent === "/dashboard/invoices/create";
  const warmReminders = warmCommon || intent === "/dashboard/reminders";
  const warmReports = intent === "/dashboard/reports";
  const warmScan = intent === "/dashboard/scan";
  const warmVat = intent === "/dashboard/vat" || warmReports;
  const warmSettings =
    intent === "/dashboard/settings" || intent === "/dashboard/support";

  useEffect(() => {
    if (!warmCommon) {
      return;
    }

    for (const route of DASHBOARD_ROUTES) {
      router.prefetch(route);
    }
  }, [router, warmCommon]);

  useQuery(api.invoices.workspace, warmCommon ? EMPTY_ARGS : "skip");
  useQuery(api.invoices.dashboardOverview, warmInvoices ? EMPTY_ARGS : "skip");
  useQuery(api.invoices.listClients, warmClients ? EMPTY_ARGS : "skip");
  useQuery(api.invoices.listReminderQueue, warmReminders ? EMPTY_ARGS : "skip");
  useQuery(api.organizations.settingsState, warmSettings ? EMPTY_ARGS : "skip");
  useQuery(api.reports.summary, warmReports ? reportPeriod : "skip");
  useQuery(api.reports.ledgerExport, warmReports ? reportPeriod : "skip");
  useQuery(api.vat.returnSummary, warmVat ? reportPeriod : "skip");
  useQuery(api.purchases.listPurchases, warmScan ? EMPTY_ARGS : "skip");
  useQuery(api.purchases.listSuppliers, warmScan ? EMPTY_ARGS : "skip");
  useQuery(api.purchases.listPurchaseScans, warmScan ? EMPTY_ARGS : "skip");

  return null;
}
