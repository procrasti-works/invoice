import Link from "next/link";

const posts = [
  {
    slug: "cut-invoice-cycle",
    category: "Fintech",
    date: "May 20, 2026",
    readTime: "5 min read",
    title: "How to Cut Your Invoice-to-Payment Cycle in Half",
    excerpt: "Practical steps finance teams can take today to speed up approvals and collections.",
    image: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&q=80&fit=crop",
    content: `
      For most Namibian businesses, the time between sending an invoice and receiving payment is painfully long. The average invoice-to-payment cycle sits between 30 and 45 days — but it doesn't have to be.

      Here are five proven steps to cut that cycle dramatically:

      **1. Send invoices immediately — not at the end of the month**
      Every day you wait to send an invoice is a day added to your payment cycle. Send the invoice the moment the work is done or the goods are delivered. Platforms like Payvio let you create and send in under two minutes.

      **2. Use client approval links instead of email attachments**
      When you send a PDF by email, it gets buried, forwarded, and forgotten. A secure client approval link brings the client directly to the invoice — they can review, approve, or flag it in one click. Payvio generates this link automatically for every invoice.

      **3. Set clear payment terms upfront**
      "Due on receipt" is vague. "Payment due within 7 days of invoice date" is not. Be specific in your terms, and make sure they appear clearly on every invoice.

      **4. Automate payment reminders**
      Most late payments happen not because clients don't want to pay — but because the invoice got lost. An automated reminder 3 days before the due date and 1 day after it misses dramatically improves collection rates. Payvio handles this for you.

      **5. Make it easy to pay**
      Include a payment link directly on your invoice. The fewer steps between "I approve this" and "I've paid this", the faster your money moves.

      Implementing all five of these consistently can take your invoice-to-payment cycle from 30+ days down to under 10.
    `,
  },
  {
    slug: "invoice-mistakes",
    category: "Tips",
    date: "May 12, 2026",
    readTime: "4 min read",
    title: "The 5 Invoice Mistakes That Delay Client Payments",
    excerpt: "Small errors in your invoicing workflow cost you time and cash flow. Here's what to fix.",
    image: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&q=80&fit=crop",
    content: `
      Bad invoices cost Namibian businesses millions in delayed cash flow every year. Here are the five most common mistakes — and how to fix them:

      **Mistake 1: Missing or incorrect VAT breakdown**
      Under Namibian law (VAT Act No. 10 of 2000), every tax invoice must show the VAT amount separately from the subtotal. If your invoice just shows a single total, it's not NamRA compliant — and your client's accountant may reject it, delaying payment.

      Fix: Use software that automatically calculates and displays the 15% VAT breakdown on every invoice.

      **Mistake 2: No sequential invoice number**
      NamRA requires unique, sequential invoice numbering. Invoices with duplicate numbers or no numbers at all are invalid and can trigger an audit.

      Fix: Use a platform that auto-generates sequential invoice numbers (INV-001, INV-002, etc.).

      **Mistake 3: Sending to the wrong contact**
      Sending an invoice to your day-to-day contact doesn't mean it reaches the person who approves payments. Many invoices sit unread in the wrong inbox for weeks.

      Fix: Ask your client upfront who the billing contact is. Store it in your client database and always send directly to them.

      **Mistake 4: Vague line item descriptions**
      "Services rendered" tells nobody anything. If the approver doesn't understand what they're paying for, they'll flag it for clarification — adding days or weeks to the cycle.

      Fix: Be specific. "Website redesign — homepage, about page, contact page (May 2026)" is clear. "Design work" is not.

      **Mistake 5: No follow-up process**
      Most businesses send an invoice and wait. When it's overdue, they send a polite email. When that's ignored, they feel awkward chasing. The invoice dies in limbo.

      Fix: Have a defined follow-up process. Day 1: send invoice. Day 7 (if unpaid): automated reminder. Day 14: personal follow-up. Day 30: formal notice.
    `,
  },
  {
    slug: "secure-approval-links",
    category: "Security",
    date: "Apr 28, 2026",
    readTime: "6 min read",
    title: "Why Secure Client Approval Links Matter More Than Ever",
    excerpt: "Invoice fraud is rising. Learn how secure, tokenized links protect your business.",
    image: "https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=800&q=80&fit=crop",
    content: `
      Invoice fraud is one of the fastest-growing financial crimes in Africa. In 2024, South African businesses lost over R1.2 billion to invoice fraud. Namibia is not immune — and most SMEs have no protection at all.

      **What is invoice fraud?**
      Invoice fraud happens when a fraudster intercepts or impersonates a legitimate invoice and redirects the payment to their own account. It can happen via:
      - Email interception (man-in-the-middle attacks)
      - Spoofed email addresses that look like yours
      - Fake invoices sent to your clients pretending to be from you
      - PDF invoice tampering before the client opens it

      **Why email attachments are vulnerable**
      When you send an invoice as a PDF email attachment, you have zero control over what happens to it. It can be forwarded, modified, or replaced entirely by the time it reaches the person who approves payment.

      **How tokenized approval links protect you**
      Payvio generates a unique, encrypted public token for each invoice. The link looks like this:
      `payvio.site/invoice/[unique-token]`

      This link:
      - Can only be accessed by someone who has it
      - Points directly to the invoice on Payvio's servers — it cannot be tampered with
      - Tracks when it was opened and by whom
      - Allows the client to approve directly on the platform — no email attachment, no PDF, no risk of tampering

      Even if a fraudster intercepts the email, they cannot modify the invoice or redirect the payment — because the invoice lives on Payvio, not in an email attachment.

      **Additional steps to protect your business**
      - Always verify bank account changes verbally before updating client payment details
      - Use a dedicated business email, not a personal Gmail
      - Enable two-factor authentication on your invoicing platform
      - Brief your clients — tell them your bank details never change without verbal confirmation

      The cost of invoice fraud is catastrophic for a small business. The cost of preventing it is a few minutes of setup. Don't wait until it happens to you.
    `,
  },
];

export default function BlogPage() {
  return (
    <main className="info-page">
      <nav className="info-nav">
        <Link href="/" className="info-nav-logo">
          <img src="/payvio-logo.svg" alt="Payvio" style={{ height: "40px" }} />
        </Link>
        <div className="info-nav-links">
          <Link href="/">Home</Link>
          <Link href="/about">About</Link>
          <Link href="/blog" className="active">Blog</Link>
          <Link href="/contact">Contact</Link>
        </div>
        <Link href="/login" className="info-nav-cta">Login</Link>
      </nav>

      <section className="info-hero">
        <div className="lp-section-label">Payvio Blog</div>
        <h1 className="info-hero-title">Invoice smarter.<br />Get paid faster.</h1>
        <p className="info-hero-sub">Practical guides, compliance tips, and invoicing insights for Namibian business owners.</p>
      </section>

      <section className="info-section">
        <div className="info-section-inner">
          <div className="info-blog-grid">
            {posts.map((post) => (
              <article key={post.slug} className="info-blog-post">
                <div className="info-blog-img">
                  <img src={post.image} alt={post.title} />
                </div>
                <div className="info-blog-body">
                  <div className="info-blog-meta">
                    <span className="info-blog-cat">{post.category}</span>
                    <span className="info-blog-date">{post.date} · {post.readTime}</span>
                  </div>
                  <h2>{post.title}</h2>
                  <p className="info-blog-excerpt">{post.excerpt}</p>
                  <div className="info-blog-content">
                    {post.content.trim().split("\n\n").map((para, i) => {
                      if (para.startsWith("**") && para.endsWith("**")) {
                        return <h3 key={i}>{para.replace(/\*\*/g, "")}</h3>;
                      }
                      if (para.includes("**")) {
                        const parts = para.split(/(\*\*[^*]+\*\*)/g);
                        return <p key={i}>{parts.map((p, j) => p.startsWith("**") ? <strong key={j}>{p.replace(/\*\*/g, "")}</strong> : p)}</p>;
                      }
                      return <p key={i}>{para}</p>;
                    })}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="info-cta">
        <h2>Ready to invoice smarter?</h2>
        <p>Start your 14-day free trial — no credit card required.</p>
        <Link href="/signup" className="lp-primary-btn">Get Started Free</Link>
      </section>

      <footer className="info-footer">
        <p>© 2026 Payvio · <Link href="/contact">Contact us</Link></p>
      </footer>
    </main>
  );
}
