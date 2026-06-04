import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/app/_components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service | Payvio",
  description:
    "Payvio terms of service for invoice, ledger, client, VAT-ready record, subscription, and platform use.",
};

const sections: LegalSection[] = [
  {
    title: "Agreement and acceptance",
    body: [
      "These Terms of Service form a legally binding agreement between the person or entity using Payvio and Payvio, including its operators, founders, owners, directors, employees, contractors, developers, agents, affiliates, successors, and assigns. By creating an account, accessing a workspace, using an invoice link, subscribing to a plan, or otherwise using the service, you accept these Terms.",
      "If you use Payvio on behalf of a company, close corporation, partnership, trust, sole proprietorship, government body, or other organization, you represent that you have authority to bind that organization. The words you and your refer to that organization and to each individual using the service under its account.",
      "If you do not agree to these Terms, you must not access or use Payvio.",
    ],
  },
  {
    title: "Service description",
    body: [
      "Payvio provides cloud-based invoice, client, ledger, purchase, reminder, report, branding, payment-proof, and VAT-ready record tools for businesses. The service may include marketing pages, public invoice links, dashboard tools, exports, subscription billing, support, and related features.",
      "Payvio is not a bank, licensed payment service provider, payment facilitator, money transmitter, escrow agent, debt collector, credit provider, insurer, accountant, auditor, tax practitioner, legal adviser, payroll provider, or financial adviser. Payvio does not guarantee that an invoice will be paid, approved, accepted, tax compliant, legally enforceable, recoverable, or suitable for any specific use.",
    ],
  },
  {
    title: "Account responsibility",
    body: [
      "You are responsible for all activity under your account and workspace, including actions by employees, contractors, agents, administrators, invited users, and anyone who obtains access through your credentials, devices, email inboxes, or security failures.",
      "You must provide accurate account, business, billing, tax, and contact information, keep it current, protect passwords and devices, restrict administrative rights, immediately remove unauthorized users, and notify Payvio without delay if you suspect unauthorized access or compromise.",
      "Payvio may rely on instructions, approvals, invoice edits, exports, deletion requests, billing changes, and administrative actions submitted through your account as authorized by you.",
    ],
  },
  {
    title: "Invoice, VAT, tax, and legal compliance",
    body: [
      "You are solely responsible for the accuracy, completeness, legality, and suitability of every invoice, quote, client record, supplier record, purchase entry, tax setting, VAT amount, report, export, reminder, payment instruction, bank detail, attachment, and communication created or sent through Payvio.",
      "Payvio may provide fields, calculations, templates, VAT-ready records, exports, reminders, and workflow tools, but those tools are not a substitute for professional advice or independent review. You must verify all invoice numbers, tax registrations, VAT status, currency, amounts, descriptions, recipient details, bank details, and filing obligations before sending, relying on, or submitting information.",
      "You are responsible for complying with all laws that apply to your business, including tax, VAT, e-commerce, electronic communications, data protection, consumer protection, anti-fraud, anti-money-laundering, sector licensing, procurement, record-retention, and financial reporting requirements. Payvio is not liable for penalties, interest, rejected filings, unpaid invoices, tax assessments, audits, or disputes caused by your records, settings, omissions, or business decisions.",
    ],
  },
  {
    title: "Payments, subscriptions, and third parties",
    body: [
      "Subscription fees, plan limits, billing intervals, trials, renewals, and included features are shown on the pricing page, checkout flow, invoice, or written order. Fees are due in advance unless Payvio agrees otherwise in writing. Taxes, bank fees, payment provider fees, exchange differences, failed-payment charges, and third-party charges are your responsibility unless expressly included.",
      "Payvio may use third-party payment processors or banks for subscription collection or optional customer-payment workflows. Those providers are independent third parties. You authorize Payvio and its providers to process payments, retries, plan changes, renewals, receipts, refunds where approved, and billing communications.",
      "Payvio is not responsible for payment delays, failed bank transfers, wrong payment references, incorrect bank details, chargebacks, reversals, fraud, card disputes, frozen funds, provider downtime, compliance holds, account closures, exchange controls, settlement failures, or any act or omission of a bank, payment service provider, client, supplier, card network, or other third party.",
    ],
  },
  {
    title: "No professional advice",
    body: [
      "All content, calculations, templates, dashboards, exports, reports, reminders, and product guidance are provided for general software and workflow purposes only. They do not constitute legal, tax, accounting, audit, financial, banking, payment, procurement, compliance, or business advice.",
      "You must obtain advice from qualified professionals before relying on Payvio for tax filings, VAT treatment, regulatory submissions, financial statements, audits, legal proceedings, debt recovery, payment disputes, or regulated activities. Reliance on Payvio is at your own risk.",
    ],
  },
  {
    title: "User content and license",
    body: [
      "You retain ownership of content and data that you submit to Payvio, subject to rights held by your clients, suppliers, employees, or other third parties. You grant Payvio a worldwide, non-exclusive, royalty-free license to host, store, copy, process, transmit, display, modify for formatting, back up, secure, and otherwise use that content as necessary to provide, protect, support, improve, and operate the service.",
      "You represent that you have all rights, consents, notices, permissions, and lawful bases required to upload, process, send, store, disclose, and retain all user content. You must not upload unlawful, misleading, defamatory, infringing, malicious, confidential, regulated, or sensitive information unless you have full authority and appropriate safeguards.",
    ],
  },
  {
    title: "Acceptable use",
    body: [
      "You must use Payvio only for lawful business purposes. You must not misuse the service, interfere with platform security, impersonate another person, send fraudulent invoices, mislead recipients, collect unauthorized payments, distribute malware, scrape data, test vulnerabilities without permission, violate sanctions, facilitate crime, or use Payvio in a way that may expose Payvio or others to liability.",
      "Payvio may suspend, restrict, remove content, disable invoice links, block access, preserve evidence, notify affected parties, or terminate accounts where Payvio reasonably believes that use is unlawful, harmful, fraudulent, risky, abusive, non-payment related, or inconsistent with these Terms or the Platform Policy.",
    ],
  },
  {
    title: "Availability and changes",
    body: [
      "Payvio aims to provide a reliable service, but it does not guarantee uninterrupted, error-free, secure, or permanent availability. Maintenance, bugs, outages, cyber incidents, provider failures, internet problems, force majeure events, regulatory changes, or business decisions may affect access or features.",
      "Payvio may modify, suspend, discontinue, limit, replace, or remove any feature, plan, workflow, integration, export, template, calculation, or page at any time. Payvio is not liable for loss resulting from changes to the service, provided that this does not limit any right that cannot be excluded under applicable law.",
    ],
  },
  {
    title: "Disclaimers",
    body: [
      "To the fullest extent permitted by applicable law, Payvio is provided as is and as available, without warranties of any kind, whether express, implied, statutory, or otherwise. Payvio disclaims all warranties of merchantability, fitness for a particular purpose, title, non-infringement, accuracy, availability, security, uninterrupted operation, error-free operation, compliance, tax correctness, payment success, and data preservation.",
      "Payvio does not warrant that records will satisfy any regulator, court, auditor, accountant, tax authority, client, supplier, bank, payment provider, lender, insurer, procurement authority, or other third party.",
    ],
  },
  {
    title: "Limitation of liability",
    body: [
      "To the fullest extent permitted by applicable law, Payvio and its operators, founders, owners, directors, employees, contractors, developers, agents, affiliates, successors, and assigns will not be liable for indirect, incidental, special, consequential, exemplary, punitive, reputational, business interruption, loss of profit, loss of revenue, loss of goodwill, loss of data, tax, penalty, audit, payment, chargeback, fraud, banking, procurement, client-dispute, supplier-dispute, regulatory, or similar damages, even if advised of the possibility of such damages.",
      "To the fullest extent permitted by applicable law, Payvio's aggregate liability for all claims arising out of or relating to the service, these Terms, any subscription, any invoice, any payment workflow, any legal page, or any user content will not exceed the greater of N$1,000 or the fees actually paid by you to Payvio for the affected workspace during the three months immediately before the event giving rise to the claim.",
      "Nothing in these Terms excludes or limits liability that cannot be excluded or limited under applicable law. Any unenforceable limitation will be interpreted and enforced to the maximum extent legally permitted.",
    ],
  },
  {
    title: "Indemnity",
    body: [
      "You will defend, indemnify, and hold harmless Payvio and its operators, founders, owners, directors, employees, contractors, developers, agents, affiliates, successors, and assigns from and against all claims, losses, liabilities, damages, fines, penalties, costs, expenses, and legal fees arising out of or relating to your account, user content, invoices, payment instructions, taxes, VAT, reports, exports, client communications, breach of these Terms, violation of law, misuse of the service, or dispute with any client, supplier, employee, contractor, bank, payment provider, regulator, or third party.",
      "Payvio may control the defence of any matter at your expense if it reasonably determines that your conduct may expose Payvio to liability, regulatory attention, security risk, reputational harm, or operational risk.",
    ],
  },
  {
    title: "Termination and survival",
    body: [
      "You may stop using Payvio at any time. Payvio may suspend or terminate access for non-payment, risk, abuse, security concerns, legal concerns, breach, inactivity, business discontinuation, or any reason permitted by law. Termination does not release you from amounts already due or obligations that accrued before termination.",
      "Sections dealing with payment obligations, user responsibility, ownership, confidentiality, privacy, disclaimers, limitation of liability, indemnity, dispute resolution, governing law, and any provision that by nature should survive will survive suspension, expiry, cancellation, and termination.",
    ],
  },
  {
    title: "Governing law and disputes",
    body: [
      "These Terms are governed by the laws of the Republic of Namibia, without regard to conflict-of-law rules. Subject to any mandatory law that applies, disputes must be brought before courts with competent jurisdiction in Namibia.",
      "Before filing a claim, the parties must first attempt in good faith to resolve the dispute by written notice and commercial discussion for at least 30 days, unless urgent injunctive relief, security enforcement, non-payment collection, or unlawful use requires immediate action.",
    ],
  },
  {
    title: "Changes and notices",
    body: [
      "Payvio may update these Terms from time to time. Updates may be posted on the website, shown inside the service, or sent to the account email. Continued use after the effective date means you accept the updated Terms.",
      "Legal notices to Payvio must be submitted through the contact page unless a separate written agreement identifies another notice address. Routine support messages are not legal notices unless they clearly state that they are formal legal notices.",
    ],
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      description="These terms govern access to Payvio invoice, client, ledger, report, reminder, subscription, and VAT-ready record tools."
      effectiveDate="1 June 2026"
      eyebrow="Terms of Service"
      sections={sections}
      summary={[
        "Payvio is invoice and ledger software, not a bank, PSP, accountant, tax adviser, or legal adviser.",
        "Users are responsible for invoice accuracy, VAT/tax compliance, bank details, client disputes, and payment outcomes.",
        "Payvio liability is limited to the maximum extent permitted by law, with strong indemnity protection for the platform and builders.",
      ]}
      title="Terms of Service"
    />
  );
}
