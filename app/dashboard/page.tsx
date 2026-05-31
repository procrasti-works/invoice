import type { Metadata } from "next";

import { DashboardPage } from "./_components/DashboardPage";

export const metadata: Metadata = {
  title: "Dashboard | Payvio",
  description: "Payvio dashboard.",
};

export default function Page() {
  return <DashboardPage />;
}
