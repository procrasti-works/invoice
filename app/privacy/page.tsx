import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/app/_components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy | Payvio",
  description:
    "Payvio privacy policy for invoice, ledger, client, VAT-ready record, support, and account data.",
};

const sections: LegalSection[] = [
  {
    title: "Scope and controller roles",
    body: [
      "This Privacy Policy applies to Payvio websites, applications, invoice links, ledger tools, support channels, and related services. It explains how Payvio collects, uses, discloses, stores, and protects information when you visit, create an account, operate a workspace, receive an invoice link, or contact us.",
      "For workspace data uploaded by a business, including client, supplier, invoice, purchase, tax, VAT, payment proof, and ledger information, the workspace owner is primarily responsible for deciding what data is entered and why it is processed. Payvio processes that information to provide the service, secure the platform, support the workspace, and comply with applicable law.",
      "If you receive an invoice or approval link from a Payvio customer, Payvio processes your information on behalf of that customer and for limited platform purposes such as security, delivery, access logs, fraud prevention, and dispute handling.",
    ],
  },
  {
    title: "Information we collect",
    body: [
      "We collect information that is provided directly, generated through use of the service, or received from integrated providers. The exact information depends on the features used and the workspace configuration.",
    ],
    items: [
      "Account information, including names, emails, passwords or authentication references, roles, workspace membership, and login activity.",
      "Business information, including business name, trading name, address, contact details, currency preferences, tax/VAT settings, branding, and subscription plan.",
      "Invoice and ledger information, including clients, suppliers, line items, descriptions, amounts, dates, invoice numbers, purchase records, reports, reminders, payment status, proof of payment, attachments, notes, and audit history.",
      "Client-recipient information, including names, email addresses, phone numbers, company details, invoice views, approval actions, and communications generated through invoice links.",
      "Technical and security information, including device identifiers, IP address, browser type, operating system, timestamps, referring pages, error logs, security events, cookies, and similar diagnostics.",
      "Billing and subscription information, including plan, invoice history, billing contact, payment provider references, receipts, failed-payment status, and tax or accounting metadata. Payvio does not intentionally store full card numbers or online banking credentials.",
      "Support, marketing, and communication information, including emails, form submissions, preferences, product feedback, and records of requests made to the team.",
    ],
  },
  {
    title: "How we use information",
    body: [
      "Payvio uses information only for legitimate business and platform purposes connected to providing invoice and ledger software, protecting users, supporting customers, improving the product, and meeting legal obligations.",
    ],
    items: [
      "To create, operate, secure, and administer user accounts, workspaces, invoices, client links, reminders, reports, purchases, VAT-ready records, and support workflows.",
      "To authenticate users, manage roles, prevent unauthorized access, investigate abuse, detect fraud, enforce legal terms, and maintain reliable service operations.",
      "To send service messages, invoice notifications, client reminders, workspace emails, support replies, billing messages, security notices, and legal updates.",
      "To process subscriptions, billing records, plan changes, renewals, cancellations, failed payments, receipts, and related accounting records.",
      "To analyse product performance, fix errors, test features, improve usability, and understand aggregate usage without selling personal information.",
      "To comply with court orders, lawful requests, regulatory obligations, tax, accounting, audit, record-retention, anti-fraud, or dispute-resolution requirements.",
    ],
  },
  {
    title: "Legal basis and consent",
    body: [
      "Where a legal basis is required, Payvio processes information because it is necessary to provide the contracted service, because the user or recipient has consented, because Payvio has a legitimate interest in operating and securing the platform, because processing is necessary to comply with law, or because processing is necessary to establish, exercise, or defend legal claims.",
      "A user who enters personal information about clients, suppliers, employees, or other third parties represents that they have a lawful basis, permission, or authority to do so, and that their use of Payvio will not violate privacy, employment, banking, tax, consumer, or communications laws.",
    ],
  },
  {
    title: "Disclosure and subprocessors",
    body: [
      "Payvio does not sell personal information. We may disclose information only where necessary to operate the service, follow user instructions, protect the platform, comply with law, or complete a corporate transaction.",
    ],
    items: [
      "Service providers and subprocessors that support hosting, database storage, authentication, email delivery, analytics, payment processing, customer support, logging, security, backups, and infrastructure operations.",
      "Banks, payment providers, or payment facilitators only where a user chooses to use an integration or where billing, dispute, fraud, compliance, or chargeback handling requires it.",
      "Professional advisers, auditors, insurers, accountants, lawyers, and consultants where reasonably necessary for business, legal, tax, security, or compliance purposes.",
      "Courts, regulators, law enforcement, tax authorities, or government bodies where required by law, court order, subpoena, lawful request, or to protect rights, safety, security, or property.",
      "A purchaser, successor, investor, or restructuring party if Payvio is involved in a merger, acquisition, financing, sale of assets, reorganization, insolvency process, or similar transaction.",
    ],
  },
  {
    title: "Payments and financial data",
    body: [
      "Payvio is invoice and ledger software. Unless a separate written agreement says otherwise, Payvio is not a bank, payment service provider, payment facilitator, money transmitter, escrow agent, credit provider, accountant, tax practitioner, or financial adviser.",
      "Where online payments or subscription payments are enabled, payment processing may be performed by banks, card networks, payment service providers, or other regulated third parties. Their privacy notices, security controls, settlement rules, chargeback rules, and terms may apply independently. Payvio is not responsible for payment delays, reversals, failed settlements, bank errors, provider outages, chargebacks, fraud by third parties, or incorrect payment instructions entered by users.",
    ],
  },
  {
    title: "Security",
    body: [
      "Payvio uses commercially reasonable administrative, technical, and organizational safeguards designed to protect information against unauthorized access, loss, misuse, alteration, and disclosure. These safeguards may include access controls, encryption in transit, provider security controls, backups, logging, least-privilege practices, and review of security events.",
      "No internet service, hosting provider, email system, browser, device, payment provider, or security control is guaranteed to be completely secure. Users are responsible for strong passwords, authorized account access, device security, staff training, correct recipient addresses, verification of bank details, and immediate notice of suspected compromise.",
    ],
  },
  {
    title: "International transfers and storage",
    body: [
      "Payvio may store and process information in Namibia or in other countries where infrastructure providers, subprocessors, or support providers operate. Those countries may have data protection rules different from those in Namibia.",
      "By using Payvio, you authorize these transfers and processing arrangements where they are necessary to provide, secure, support, and improve the service, subject to reasonable contractual, technical, and organizational safeguards.",
    ],
  },
  {
    title: "Retention and deletion",
    body: [
      "Payvio retains information for as long as reasonably necessary to provide the service, maintain business and accounting records, comply with legal obligations, resolve disputes, enforce agreements, prevent fraud, maintain backups, and support legitimate business purposes.",
      "Workspace owners are responsible for deciding how long they keep invoice, client, supplier, purchase, VAT, and ledger records inside their workspace. Deleting records may affect legal, tax, audit, or commercial obligations. Payvio may retain residual copies in backups or logs for a limited period, and may retain records where required for legal, security, accounting, or dispute purposes.",
    ],
  },
  {
    title: "Rights and choices",
    body: [
      "Subject to applicable law and verification, individuals may request access, correction, export, deletion, restriction, or objection relating to personal information held by Payvio. Some requests may need to be directed to the workspace owner if Payvio processes the data on behalf of that owner.",
      "Payvio may decline, delay, limit, or charge for a request where permitted by law, where identity cannot be verified, where the request is excessive or abusive, where disclosure would affect another person, where retention is legally required, or where the information is needed to establish, exercise, or defend legal claims.",
    ],
  },
  {
    title: "Changes and contact",
    body: [
      "Payvio may update this Privacy Policy from time to time. Material changes will be posted on the website or communicated through the service where appropriate. Continued use of Payvio after an update means the updated policy applies from its effective date.",
      "Questions, privacy requests, and security concerns should be sent through the contact page. Do not include unnecessary confidential information in a general support request.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      description="This policy explains how Payvio handles account, invoice, ledger, client, VAT-ready record, billing, support, and technical information."
      effectiveDate="1 June 2026"
      eyebrow="Privacy Policy"
      sections={sections}
      summary={[
        "Payvio does not sell personal information.",
        "Workspace owners remain responsible for the client, supplier, invoice, and tax data they enter.",
        "Payvio is software, not a bank, accountant, payment service provider, or tax adviser.",
      ]}
      title="Privacy Policy"
    />
  );
}
