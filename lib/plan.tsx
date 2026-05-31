"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type PlanLevel = "trial" | "starter" | "business" | "professional" | "enterprise" | "admin";

export type Feature = "invoices" | "clients" | "reminders" | "reports" | "ledger" | "vat" | "settings";

const ACCESS_CODES: Record<string, PlanLevel> = {
  "PAYVIO-ADMIN-2026": "admin",
  "ENT-2026": "enterprise",
  "PRO-2026": "professional",
  "BIZ-2026": "business",
  "START-2026": "starter",
};

const TRIAL_DAYS = 14;

const FEATURE_REQUIREMENTS: Record<Feature, PlanLevel[]> = {
  invoices:  ["trial", "starter", "business", "professional", "enterprise", "admin"],
  clients:   ["trial", "starter", "business", "professional", "enterprise", "admin"],
  reminders: ["trial", "starter", "business", "professional", "enterprise", "admin"],
  settings:  ["trial", "starter", "business", "professional", "enterprise", "admin"],
  reports:   ["starter", "business", "professional", "enterprise", "admin"],
  ledger:    ["starter", "business", "professional", "enterprise", "admin"],
  vat:       ["professional", "enterprise", "admin"],
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
  applyCode: (code: string) => boolean;
  clearCode: () => void;
  canAccess: (feature: Feature) => boolean;
};

const PlanContext = createContext<PlanContextType | null>(null);

export function PlanProvider({ children }: { children: ReactNode }) {
  const [plan, setPlan] = useState<PlanLevel>("trial");
  const [daysLeftInTrial, setDaysLeftInTrial] = useState<number | null>(14);

  useEffect(() => {
    const savedCode = localStorage.getItem("payvio_access_code");
    if (savedCode && ACCESS_CODES[savedCode]) {
      setPlan(ACCESS_CODES[savedCode]);
      setDaysLeftInTrial(null);
      return;
    }
    let trialStart = localStorage.getItem("payvio_trial_start");
    if (!trialStart) {
      trialStart = Date.now().toString();
      localStorage.setItem("payvio_trial_start", trialStart);
    }
    const elapsed = Date.now() - parseInt(trialStart);
    const daysElapsed = Math.floor(elapsed / (1000 * 60 * 60 * 24));
    const daysLeft = Math.max(0, TRIAL_DAYS - daysElapsed);
    setDaysLeftInTrial(daysLeft);
    setPlan("trial");
  }, []);

  function applyCode(code: string): boolean {
    const level = ACCESS_CODES[code.trim().toUpperCase()];
    if (level) {
      localStorage.setItem("payvio_access_code", code.trim().toUpperCase());
      setPlan(level);
      setDaysLeftInTrial(null);
      return true;
    }
    return false;
  }

  function clearCode() {
    localStorage.removeItem("payvio_access_code");
    const trialStart = localStorage.getItem("payvio_trial_start");
    if (trialStart) {
      const elapsed = Date.now() - parseInt(trialStart);
      const daysLeft = Math.max(0, TRIAL_DAYS - Math.floor(elapsed / 86400000));
      setDaysLeftInTrial(daysLeft);
    }
    setPlan("trial");
  }

  function canAccess(feature: Feature): boolean {
    return FEATURE_REQUIREMENTS[feature].includes(plan);
  }

  return (
    <PlanContext.Provider value={{ plan, daysLeftInTrial, applyCode, clearCode, canAccess }}>
      {children}
    </PlanContext.Provider>
  );
}

export function usePlan() {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error("usePlan must be used within PlanProvider");
  return ctx;
}
