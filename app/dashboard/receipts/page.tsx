"use client";

import {
  CheckCircle2,
  Receipt,
  ScanLine,
  Tag,
  UploadCloud,
} from "lucide-react";

import { usePlan } from "@/lib/plan";
import { LockedPage } from "../_components/DashboardShell";

export default function ReceiptsPage() {
  const { canAccess } = usePlan();

  if (!canAccess("scan")) {
    return <LockedPage feature="scan" requiredPlan="Business" />;
  }

  return (
    <div className="db-workview db-receipts-page">
      <div className="db-workview-head">
        <div>
          <p className="db-panel-kicker">Receipt Tracker</p>
          <h1 className="db-page-title">Capture and track every expense receipt</h1>
        </div>
      </div>

      <p className="db-receipts-intro">
        Photograph any receipt — fuel, stationery, meals, equipment — and Payvio
        extracts the amount, merchant, date, and VAT. Every receipt automatically
        feeds your VAT input totals so month-end is already done.
      </p>

      <div className="db-receipt-how-grid">
        <div className="db-receipt-step">
          <span className="db-receipt-step-icon">
            <UploadCloud className="size-5" />
          </span>
          <div>
            <strong>1. Capture</strong>
            <p>Take a photo or upload a PDF of any expense receipt.</p>
          </div>
        </div>
        <div className="db-receipt-step">
          <span className="db-receipt-step-icon">
            <ScanLine className="size-5" />
          </span>
          <div>
            <strong>2. Extract</strong>
            <p>Payvio reads the merchant, date, amount, and VAT automatically.</p>
          </div>
        </div>
        <div className="db-receipt-step">
          <span className="db-receipt-step-icon">
            <Tag className="size-5" />
          </span>
          <div>
            <strong>3. Categorise</strong>
            <p>Tag it — Travel, Office, Equipment, Meals, Utilities.</p>
          </div>
        </div>
        <div className="db-receipt-step">
          <span className="db-receipt-step-icon">
            <Receipt className="size-5" />
          </span>
          <div>
            <strong>4. VAT tracked</strong>
            <p>VAT input is added to your totals — no manual calculation.</p>
          </div>
        </div>
      </div>

      <div className="db-receipt-categories">
        {["Travel & fuel", "Office & stationery", "Equipment", "Meals & entertainment", "Utilities", "Other"].map((cat) => (
          <span key={cat} className="db-receipt-cat-pill">{cat}</span>
        ))}
      </div>

      <div className="db-card db-receipt-coming-soon">
        <div className="db-receipt-coming-icon">
          <Receipt className="size-8" />
        </div>
        <h3>Receipt Tracker — coming soon</h3>
        <p>
          Upload receipts, extract expense details automatically, and have every VAT
          input claim ready before month-end. Your expense records will live here,
          linked directly to your VAT position.
        </p>
        <div className="db-receipt-coming-pills">
          <span><CheckCircle2 className="size-3.5" /> Photo &amp; PDF upload</span>
          <span><CheckCircle2 className="size-3.5" /> Auto VAT extraction</span>
          <span><CheckCircle2 className="size-3.5" /> Category tagging</span>
          <span><CheckCircle2 className="size-3.5" /> VAT input totals</span>
          <span><CheckCircle2 className="size-3.5" /> 5-year retention</span>
        </div>
      </div>
    </div>
  );
}
