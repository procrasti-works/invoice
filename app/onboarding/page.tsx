import type { Metadata } from "next";

import { OnboardingPage } from "./OnboardingPage";

export const metadata: Metadata = {
  title: "Set up workspace | Payvio",
  description: "Create or join a Payvio organization.",
};

type OnboardingSearchParams = Promise<{
  mode?: string | string[];
  create?: string | string[];
  next?: string | string[];
}>;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function safeDashboardPath(value: string | undefined) {
  if (!value || !value.startsWith("/dashboard") || value.startsWith("//")) {
    return "/dashboard";
  }

  return value;
}

export default async function Page({
  searchParams,
}: {
  searchParams: OnboardingSearchParams;
}) {
  const params = await searchParams;
  const mode = firstParam(params.mode);
  const create = firstParam(params.create);
  const createMode = mode === "create" || create === "organization";
  const nextPath = safeDashboardPath(firstParam(params.next));

  return <OnboardingPage createMode={createMode} nextPath={nextPath} />;
}
