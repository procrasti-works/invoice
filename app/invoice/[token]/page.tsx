import { ClientInvoicePage } from "./ClientInvoicePage";

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return <ClientInvoicePage token={token} />;
}
