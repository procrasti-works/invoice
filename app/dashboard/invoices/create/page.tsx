import type { Metadata } from "next";

import { CreateInvoicePage } from "./CreateInvoicePage";

export const metadata: Metadata = {
  title: "Create invoice | Payvio",
  description: "Create a Payvio invoice draft.",
};

export default function Page() {
  return <CreateInvoicePage />;
}
