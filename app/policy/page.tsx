import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/app/_components/LegalPage";

export const metadata: Metadata = {
  title: "Platform Policy | Payvio",
  description:
    "Payvio platform, payment, acceptable use, refund, security, and enforcement policy.",
};

const sections: LegalSection[] = [
  {
    title: "Purpose and priority",
    body: [
      "This Platform Policy forms part of the Payvio Terms of Service. It sets out operational rules for acceptable use, invoices, payments, subscriptions, refunds, security, enforcement, and platform integrity.",
      "If there is a conflict between this Platform Policy and the Terms of Service, the Terms of Service prevail unless this Platform Policy imposes stricter operational or security requirements. Payvio may apply this policy in its reasonable discretion to protect users, recipients, third parties, the platform, and the Payvio builders.",
    ],
  },
  {
    title: "Permitted use",
    body: [
      "Payvio may be used for lawful invoice, client, supplier, purchase, ledger, reminder, report, and VAT-ready record workflows for legitimate businesses. Each user must ensure that their use is accurate, authorized, lawful, and appropriate for their sector.",
      "A user may not use Payvio in a way that causes Payvio to become a bank, payment service provider, payment facilitator, escrow provider, money transmitter, debt collector, regulated financial service, or other licensed provider unless Payvio has expressly agreed in writing and obtained any required authorization.",
    ],
  },
  {
    title: "Prohibited conduct",
    body: [
      "The following conduct is strictly prohibited. Payvio may suspend, terminate, restrict, preserve records, or report suspected misconduct where appropriate.",
    ],
    items: [
      "Creating or sending fraudulent, false, misleading, inflated, duplicated, impersonated, unauthorized, or sham invoices.",
      "Changing bank details, payment references, recipient information, or invoice terms to misdirect funds or deceive a payer.",
      "Using Payvio for money laundering, terrorist financing, sanctions evasion, bribery, corruption, tax evasion, illegal gambling, scams, counterfeit goods, stolen goods, regulated products without authorization, or any criminal activity.",
      "Impersonating a business, government body, bank, Payvio staff member, client, supplier, tax authority, accountant, or payment provider.",
      "Uploading malware, malicious links, credential-harvesting forms, unlawful content, defamatory content, infringing material, or content designed to compromise another system.",
      "Attempting to bypass authentication, access another workspace, probe security controls, scrape data, overload systems, interfere with logging, reverse engineer restricted code, or test vulnerabilities without written permission.",
      "Using Payvio to spam recipients, send unlawful marketing, harass clients, threaten others, or pressure payments through misleading legal, tax, or regulatory statements.",
      "Entering personal, banking, tax, health, employment, children, or highly sensitive information where you lack authority, consent, or a lawful basis.",
    ],
  },
  {
    title: "Payment policy",
    body: [
      "Payvio records invoice amounts, payment statuses, payment proof, reminders, references, and related workflow information. Unless a separate written agreement states otherwise, Payvio does not hold customer funds, settle customer funds, guarantee payment, underwrite invoices, provide credit, provide escrow, process regulated payment instructions, or recover debts.",
      "Users must independently verify payment instructions, bank account details, payment references, client identities, and proof of payment. Payvio is not responsible for funds sent to the wrong account, fake proof of payment, delayed bank transfers, failed settlements, chargebacks, reversals, exchange-control issues, payment-provider holds, card disputes, or payer refusal.",
      "Where Payvio links to or integrates with a bank, gateway, payment service provider, payment facilitator, card network, or third-party payment product, that provider is solely responsible for its regulated services. Users must comply with that provider's terms, verification requirements, fees, limits, settlement timelines, chargeback rules, prohibited-business rules, and dispute processes.",
    ],
  },
  {
    title: "Subscription, cancellation, and refund policy",
    body: [
      "Subscription fees are charged according to the selected plan, billing cycle, order form, invoice, or checkout terms. Unless required by law or expressly agreed in writing by Payvio, subscription fees are non-refundable once a billing period starts.",
      "Cancellation prevents future renewals but does not automatically refund past or current-period fees. Payvio may decline refunds for unused time, user error, incorrect settings, failure to cancel, lack of client payment, tax disputes, changed business needs, feature misunderstanding, third-party outage, or account suspension caused by breach.",
      "Payvio may issue discretionary credits, refunds, extensions, or plan adjustments without admitting liability and without creating a right to similar treatment in the future. Any refund approved by Payvio may be reduced by bank fees, payment provider fees, taxes, discounts, chargeback costs, or unpaid amounts.",
    ],
  },
  {
    title: "Invoice and tax policy",
    body: [
      "Payvio may support NAD, USD, ZAR, VAT-ready fields, invoice numbering, exports, reminders, reports, and record organization for Namibian SMEs and related business use cases. These features are operational tools only.",
      "Users remain solely responsible for determining whether they are VAT registered, whether VAT must be charged, the applicable rate, the correct treatment of exempt or zero-rated supplies, invoice validity, retention periods, customer documentation, tax filings, e-invoicing obligations, and all NamRA, ITAS, accounting, audit, or sector-specific requirements.",
      "Payvio is not liable if a template, export, report, invoice, reminder, calculation, field, or setting is unsuitable for a user's business, tax position, regulator, accountant, auditor, client, supplier, procurement process, or payment dispute.",
    ],
  },
  {
    title: "Data and record policy",
    body: [
      "Users are responsible for all data they create, upload, import, edit, export, delete, or send through Payvio. Users must maintain independent backups of information that is critical to their business, legal, accounting, tax, audit, or customer obligations.",
      "Payvio may preserve logs, backups, audit events, invoice access history, payment-proof records, support correspondence, and account information where reasonably necessary for security, recovery, legal compliance, dispute resolution, fraud prevention, accounting, enforcement, or platform operations.",
      "Payvio may remove or restrict access to content if it reasonably believes the content is unlawful, harmful, infringing, fraudulent, misleading, abusive, unsafe, or likely to expose Payvio or any third party to risk.",
    ],
  },
  {
    title: "Security policy",
    body: [
      "Users must keep credentials confidential, use secure devices and email accounts, restrict workspace permissions, verify recipients, train staff, remove former employees, and report suspicious activity immediately.",
      "Security testing, vulnerability scanning, penetration testing, automated probing, social engineering, denial-of-service testing, credential attacks, or access to data not owned by the tester is prohibited without prior written permission from Payvio.",
      "Good-faith vulnerability reports should include clear reproduction steps, affected URLs or features, impact, and contact details. Reporters must not access, modify, delete, copy, retain, disclose, or exfiltrate another user's data and must not demand payment, threaten disclosure, or disrupt service.",
    ],
  },
  {
    title: "Enforcement",
    body: [
      "Payvio may investigate suspected violations using logs, account records, invoice records, recipient reports, provider reports, payment disputes, abuse reports, security tools, and other available information.",
      "Where Payvio reasonably believes that a violation, security risk, payment risk, legal risk, fraud risk, non-payment, or platform threat exists, Payvio may take any action it considers appropriate, including warning, limiting features, disabling invoice links, freezing exports, suspending users, terminating workspaces, contacting administrators, preserving evidence, notifying providers, refusing support, or reporting to authorities.",
      "Payvio is not liable for losses caused by enforcement action taken in good faith to protect the platform, users, recipients, payment integrity, legal compliance, security, or Payvio's business interests.",
    ],
  },
  {
    title: "Reporting and contact",
    body: [
      "Users, invoice recipients, banks, payment providers, and third parties may report suspected fraud, unauthorized invoices, incorrect payment details, security issues, privacy concerns, intellectual property complaints, or policy violations through the contact page.",
      "A report should include enough information for Payvio to assess the issue, including invoice number, workspace name, sender, recipient, date, screenshots where appropriate, and a clear description. Payvio may request verification before disclosing information or taking action.",
    ],
  },
  {
    title: "Policy changes",
    body: [
      "Payvio may update this Platform Policy at any time to reflect product changes, risk controls, legal requirements, payment provider requirements, security needs, or business decisions. Continued use after an update means the updated policy applies from its effective date.",
    ],
  },
];

export default function PolicyPage() {
  return (
    <LegalPage
      description="This policy sets the operational rules for acceptable use, invoices, payments, refunds, security, data, and enforcement on Payvio."
      effectiveDate="1 June 2026"
      eyebrow="Platform Policy"
      sections={sections}
      summary={[
        "Payvio can remove, restrict, or suspend risky or unlawful activity.",
        "Users remain responsible for invoices, payment instructions, tax settings, and client disputes.",
        "Subscription refunds are limited and discretionary unless the law requires otherwise.",
      ]}
      title="Platform, Payment, and Acceptable Use Policy"
    />
  );
}
