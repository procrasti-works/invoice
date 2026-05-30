import type { Metadata } from "next";

import { SettingsPage } from "../_components/SettingsPage";

export const metadata: Metadata = {
  title: "Settings | Invoice Ledger",
  description: "Workspace settings for Invoice Ledger.",
};

export default function Page() {
  return <SettingsPage />;
}
