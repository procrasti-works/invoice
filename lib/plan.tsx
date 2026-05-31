"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export type PlanLevel = "trial" | "starter" | "business" | "professional" | "enterprise" | "admin";

export type Feature = "invoices" | "clients" | "reminders" | "reports" | "ledger" | "vat" | "settings" | "scan";

const ACCESS_CODES: Record<string, PlanLevel> = {
  "PAYVIO-ADMIN-2026": "admin",
  "ENT-2026": "enterprise",
  "PRO-2026": "professional",
  "BIZ-2026": "business",
  "START-2026": "starter",
};

const TRIAL_DAYS = 14;
export const TRIAL_SCAN_LIMIT = 50;

const FEATURE_REQUIREMENTS: Record<Feature, PlanLevel[]> = {
  invoices:  ["trial", "starter", "business", "professional", "enterprise", "admin"],
  clients:   ["trial", "starter", "business", "professional", "enterprise", "admin"],
  reminders: ["trial", "starter", "business", "professional", "enterprise", "admin"],
  settings:  ["trial", "starter", "business", "professional", "enterprise", "admin"],
  reports:   ["starter", "business", "professional", "enterprise", "admin"],
  ledger:    ["starter", "business", "professional", "enterprise", "admin"],
  vat:       ["professional", "enterprise", "admin"],
  // scan: trial gets it (capped at 50), starter gets nothing, business+ unlimited
  scan:      ["trial", "business", "professional", "enterprise", "admin"],
};

export const PLAN_LABELS: Record<PlanLevel, string> = {
  trial:        "14-Day Free Trial",
  starter:      "Starter — N$150/mo",
  business:     "Business — N$350/mo",
  professional: "Professional — N$750/mo",
  enterprise:   "Enterprise — N$2,000/mo",
  admin:        "Admin — Full Access",
};

export const PLAN_COLORS: Record<PlanLevel, string> = {
  trial:        "#6b7280",
  starter:      "#1a6fc4",
  business:     "#009b68",
  professional: "#7c3aed",
  enterprise:   "#b45309",
  admin:        "#dc2626",
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

type PlanState = {
  plan: PlanLevel;
  daysLeftInTrial: number | null;
  scanCount: number;
};

const DEFAULT_PLAN_STATE: PlanState = {
  plan: "trial",
  daysLeftInTrial: TRIAL_DAYS,
  scanCount: 0,
};

function daysLeftForTrialStart(trialStart: string) {
  const elapsed = Date.now() - Number.parseInt(trialStart, 10);
  return Math.max(0, TRIAL_DAYS - Math.floor(elapsed / 86400000));
}

function readStoredPlanState(): PlanState {
  if (typeof window === "undefined") {
    return DEFAULT_PLAN_STATE;
  }

  const savedScanCount = Number.parseInt(
    localStorage.getItem("payvio_scan_count") ?? "0",
    10,
  );
  const scanCount = Number.isFinite(savedScanCount) ? savedScanCount : 0;
  const savedCode = localStorage.getItem("payvio_access_code");

  if (savedCode && ACCESS_CODES[savedCode]) {
    return {
      plan: ACCESS_CODES[savedCode],
      daysLeftInTrial: null,
      scanCount,
    };
  }

  let trialStart = localStorage.getItem("payvio_trial_start");
  if (!trialStart) {
    trialStart = Date.now().toString();
    localStorage.setItem("payvio_trial_start", trialStart);
  }

  return {
    plan: "trial",
    daysLeftInTrial: daysLeftForTrialStart(trialStart),
    scanCount,
  };
}

export function PlanProvider({ children }: { children: ReactNode }) {
  const [planState, setPlanState] = useState<PlanState>(readStoredPlanState);
  const { plan, daysLeftInTrial, scanCount } = planState;

  function applyCode(code: string): boolean {
    const level = ACCESS_CODES[code.trim().toUpperCase()];
    if (level) {
      localStorage.setItem("payvio_access_code", code.trim().toUpperCase());
      setPlanState((current) => ({
        ...current,
        plan: level,
        daysLeftInTrial: null,
      }));
      return true;
    }
    return false;
  }

  function clearCode() {
    localStorage.removeItem("payvio_access_code");
    let trialStart = localStorage.getItem("payvio_trial_start");
    if (!trialStart) {
      trialStart = Date.now().toString();
      localStorage.setItem("payvio_trial_start", trialStart);
    }
    setPlanState((current) => ({
      ...current,
      plan: "trial",
      daysLeftInTrial: daysLeftForTrialStart(trialStart),
    }));
  }

  function incrementScanCount(count: number) {
    setPlanState((current) => {
      const newCount = current.scanCount + count;
      localStorage.setItem("payvio_scan_count", newCount.toString());
      return {
        ...current,
        scanCount: newCount,
      };
    });
  }

  function canAccess(feature: Feature): boolean {
    return FEATURE_REQUIREMENTS[feature].includes(plan);
  }

  const scanLimitReached = plan === "trial" && scanCount >= TRIAL_SCAN_LIMIT;

  return (
    <PlanContext.Provider value={{ plan, daysLeftInTrial, scanCount, scanLimitReached, incrementScanCount, applyCode, clearCode, canAccess }}>
      {children}
    </PlanContext.Provider>
  );
}

export function usePlan() {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error("usePlan must be used within PlanProvider");
  return ctx;
}
