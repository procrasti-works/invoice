"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";

export type PlanLevel = "trial" | "starter" | "business" | "professional" | "enterprise" | "admin";

export type Feature = "invoices" | "clients" | "reminders" | "reports" | "vat" | "settings" | "scan";

const TRIAL_DAYS = 14;
export const TRIAL_SCAN_LIMIT = 0;

const FEATURE_REQUIREMENTS: Record<Feature, PlanLevel[]> = {
  invoices: ["trial", "starter", "business", "professional", "enterprise", "admin"],
  clients: ["trial", "starter", "business", "professional", "enterprise", "admin"],
  reminders: ["trial", "starter", "business", "professional", "enterprise", "admin"],
  settings: ["trial", "starter", "business", "professional", "enterprise", "admin"],
  reports: ["trial", "starter", "business", "professional", "enterprise", "admin"],
  vat: ["trial", "starter", "business", "professional", "enterprise", "admin"],
  scan: ["trial", "starter", "business", "professional", "enterprise", "admin"],
};

export const PLAN_LABELS: Record<PlanLevel, string> = {
  trial: "SME Trial",
  starter: "Starter - N$150/mo",
  business: "Business - N$350/mo",
  professional: "Professional - N$750/mo",
  enterprise: "Enterprise",
  admin: "Admin",
};

export const PLAN_COLORS: Record<PlanLevel, string> = {
  trial: "var(--muted-foreground)",
  starter: "var(--primary)",
  business: "var(--success)",
  professional: "var(--primary)",
  enterprise: "var(--warning)",
  admin: "var(--destructive)",
};

type PlanContextType = {
  plan: PlanLevel;
  daysLeftInTrial: number | null;
  scanCount: number;
  scanLimitReached: boolean;
  incrementScanCount: (count: number) => void;
  applyCode: (code: string) => boolean;
  clearCode: () => void;
  canAccess: (feature: Feature) => boolean;
};

const PlanContext = createContext<PlanContextType | null>(null);

function daysLeft(currentPeriodEnd: number | undefined) {
  if (!currentPeriodEnd) {
    return TRIAL_DAYS;
  }

  return Math.max(0, Math.ceil((currentPeriodEnd - Date.now()) / 86400000));
}

export function PlanProvider({
  children,
  subscription,
}: {
  children: ReactNode;
  subscription?: Doc<"subscriptions"> | null;
}) {
  const fetchedSubscription = useQuery(
    api.subscriptions.current,
    subscription === undefined ? {} : "skip",
  );
  const activeSubscription =
    subscription === undefined ? fetchedSubscription : subscription;
  const plan = (activeSubscription?.plan ?? "trial") as PlanLevel;
  const daysLeftInTrial =
    plan === "trial" ? daysLeft(activeSubscription?.currentPeriodEnd) : null;

  const value = useMemo<PlanContextType>(() => {
    function canAccess(feature: Feature): boolean {
      return FEATURE_REQUIREMENTS[feature].includes(plan);
    }

    return {
      plan,
      daysLeftInTrial,
      scanCount: 0,
      scanLimitReached: false,
      incrementScanCount: () => undefined,
      applyCode: () => false,
      clearCode: () => undefined,
      canAccess,
    };
  }, [daysLeftInTrial, plan]);

  return (
    <PlanContext.Provider value={value}>
      {children}
    </PlanContext.Provider>
  );
}

export function usePlan() {
  const ctx = useContext(PlanContext);
  if (!ctx) {
    throw new Error("usePlan must be used within PlanProvider");
  }
  return ctx;
}
