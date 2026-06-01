import type { Metadata } from "next";

import { SupportPage } from "./SupportPage";

export const metadata: Metadata = {
  title: "Support | Payvio",
  description: "Payvio support details, contacts, and workspace administrators.",
};

export default function Page() {
  return <SupportPage />;
}
