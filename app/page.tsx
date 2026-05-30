const navGroups = [
  {
    label: "Products",
    href: "#products",
    items: [
      { title: "Invoices", description: "Create, send, and track invoice work.", icon: "invoice" },
      { title: "Approvals", description: "Route edits and approvals in one place.", icon: "approve" },
      { title: "Collections", description: "Manage reminders and follow-up queues.", icon: "collect" },
      { title: "Clients", description: "Keep client billing records organized.", icon: "clients" },
      { title: "Payments", description: "Track payment status and matching.", icon: "payment" },
      { title: "Close", description: "Review receivables before month end.", icon: "close" },
      { title: "Templates", description: "Reuse invoice formats and terms.", icon: "template" },
      { title: "Reports", description: "Export clean receivables summaries.", icon: "report" },
      { title: "Settings", description: "Control roles, access, and workflow rules.", icon: "settings" },
    ],
    promo: {
      title: "Receivables Review",
      description: "Close open invoice work with a focused review flow.",
    },
  },
  {
    label: "Solutions",
    href: "#solutions",
    items: [
      { title: "Finance teams", description: "Keep billing and collections aligned.", icon: "invoice" },
      { title: "Operators", description: "Give teams clean request paths.", icon: "clients" },
      { title: "Accountants", description: "Export organized receivables records.", icon: "report" },
      { title: "Founders", description: "See what needs attention without extra tools.", icon: "close" },
    ],
  },
  {
    label: "Resources",
    href: "#resources",
    items: [
      { title: "Guides", description: "Practical invoice operations playbooks.", icon: "template" },
      { title: "Security", description: "Controls for financial workflow access.", icon: "settings" },
      { title: "Integrations", description: "Connect accounting and payment providers.", icon: "payment" },
      { title: "Help center", description: "Setup and workflow documentation.", icon: "report" },
    ],
  },
];

const workflowCards = [
  ["Draft", "Template, terms, tax, attachments"],
  ["Review", "Approval owner, notes, exceptions"],
  ["Send", "Client delivery, reminders, audit trail"],
  ["Collect", "Payment status, follow-up, reconciliation"],
];

const sidebarItems = [
  "Home",
  "Invoices",
  "Approvals",
  "Clients",
  "Collections",
  "Reports",
  "Settings",
];

const invoiceRows = [
  ["Draft invoice", "Needs details", "Create"],
  ["Approval request", "Reviewer queue", "Review"],
  ["Sent invoice", "Client follow-up", "Track"],
  ["Payment received", "Match record", "Reconcile"],
];

const platformPanes = [
  ["Approval queue", "A focused review surface for finance and operators."],
  ["Collections board", "A single view for reminders and payment status."],
  ["Close review", "A clean checklist for receivables exceptions."],
];

export default function Home() {
  return (
    <main>
      <Header />
      <Hero />
      <ProductStage />
      <ScaleSection />
      <PlatformStrip />
      <FeatureSection />
      <OperationsSection />
      <FooterCta />
    </main>
  );
}

function Header() {
  return (
    <header className="site-header">
      <a href="#" aria-label="Payvio home">
        <img src="/payvio-logo.svg" alt="Payvio" style={{height:"51px"}} className="w-auto" />
      </a>

      <nav className="desktop-nav" aria-label="Main navigation">
        {navGroups.slice(0, 2).map((group) => (
          <NavGroup key={group.label} group={group} />
        ))}
        <a href="#pricing" className="nav-link">
          Pricing
        </a>
        <NavGroup group={navGroups[2]} />
      </nav>

      <div className="header-actions">
        <a href="/login" className="login-link">
          Login
        </a>
        <a href="/signup" className="mint-button header-button">
          Open Ledger
        </a>
      </div>
    </header>
  );
}

function NavGroup({
  group,
}: {
  group: {
    label: string;
    href: string;
    items: { title: string; description: string; icon: string }[];
    promo?: { title: string; description: string };
  };
}) {
  return (
    <div className="nav-group">
      <a href={group.href} className="nav-link">
        {group.label}
        <span aria-hidden="true" className="chevron" />
      </a>
      <div
        className={`nav-panel ${group.promo ? "nav-panel-wide" : ""}`}
        aria-label={`${group.label} menu`}
      >
        <div className="nav-panel-grid">
          {group.items.map((item) => (
            <a href={group.href} key={item.title} className="nav-panel-item">
              <span className={`tile-icon icon-${item.icon}`} aria-hidden="true" />
              <span className="nav-panel-copy">
                <strong>{item.title}</strong>
                <span>{item.description}</span>
              </span>
            </a>
          ))}
        </div>
        {group.promo && (
          <a href="#close" className="nav-promo">
            <span className="promo-art" aria-hidden="true">
              <span />
            </span>
            <strong>{group.promo.title}</strong>
            <span>{group.promo.description}</span>
          </a>
        )}
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="hero-section" aria-labelledby="hero-title">
      <a href="#close" className="news-pill">
        NEW: Payvio Close - Receivables review workspace
      </a>
      <h1 id="hero-title">Invoice operations you will not outgrow.</h1>
      <p className="hero-copy">
        Create invoices, manage approvals, collect payments, and reconcile
        receivables in one calm workspace built for finance teams.
      </p>
      <div className="hero-actions">
        <div className="hero-form" aria-label="Request access">
          <input type="email" placeholder="Enter your work email" />
          <button type="button">Submit</button>
        </div>
        <a href="#demo" className="demo-link">
          Request Demo
        </a>
      </div>
      <p className="fine-print">
        Payvio is workflow software for invoice operations. Accounting,
        banking, and payment connections remain with your connected providers.
      </p>
    </section>
  );
}

function ProductStage() {
  return (
    <section className="product-stage" aria-label="Payvio product preview">
      <div className="workflow-rail" aria-hidden="true">
        {workflowCards.map(([title, detail]) => (
          <article className="workflow-card" key={title}>
            <span>{title}</span>
            <p>{detail}</p>
          </article>
        ))}
      </div>

      <div className="monitor-shell">
        <div className="monitor-screen">
          <div className="app-sidebar">
            <strong>Ledger</strong>
            {sidebarItems.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
          <div className="app-main">
            <div className="app-topbar">
              <span>Search invoices, clients, or approvals...</span>
              <strong>Workspace</strong>
            </div>
            <div className="status-row">
              <div>
                <span>Open work</span>
                <i />
              </div>
              <div>
                <span>Needs review</span>
                <i />
              </div>
              <div>
                <span>Ready to close</span>
                <i />
              </div>
            </div>
            <div className="chart-card">
              <div className="chart-line" />
              <span className="chart-tag">Collections timeline</span>
            </div>
            <div className="invoice-table" aria-label="Invoice workflow preview">
              {invoiceRows.map(([stage, context, action]) => (
                <div key={stage}>
                  <span>{stage}</span>
                  <em>{context}</em>
                  <strong>{action}</strong>
                </div>
              ))}
            </div>
          </div>
          <aside className="task-panel">
            <strong>Tasks</strong>
            <span>Review invoice changes</span>
            <span>Send scheduled reminders</span>
            <span>Match payment records</span>
          </aside>
        </div>
      </div>
      <div className="monitor-stand" aria-hidden="true" />
      <div className="terrain" aria-hidden="true" />
    </section>
  );
}

function ScaleSection() {
  return (
    <section className="scale-section" aria-labelledby="scale-title">
      <div className="orbit orbit-one" aria-hidden="true" />
      <div className="orbit orbit-two" aria-hidden="true" />
      <span className="orbit-node node-one" aria-hidden="true" />
      <span className="orbit-node node-two" aria-hidden="true" />
      <span className="orbit-node node-three" aria-hidden="true" />
      <span className="orbit-node node-four" aria-hidden="true" />
      <div className="scale-copy">
        <h2 id="scale-title">Easy to start, powerful to close.</h2>
        <p>
          From the first invoice draft to month-end receivables review, Invoice
          Ledger keeps every step connected without turning the workflow into a
          heavy system.
        </p>
      </div>
    </section>
  );
}

function PlatformStrip() {
  return (
    <section className="platform-strip" id="solutions" aria-labelledby="strip-title">
      <h2 id="strip-title">Designed around the invoice lifecycle</h2>
      <div className="pane-strip">
        {platformPanes.map(([title, body], index) => (
          <article className="pane-card" key={title}>
            <div className={`pane-visual pane-${index + 1}`} />
            <h3>{title}</h3>
            <p>{body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function FeatureSection() {
  return (
    <section className="feature-section" id="products" aria-labelledby="products-title">
      <div className="section-heading">
        <h2 id="products-title">One platform for invoice operations</h2>
        <p>
          The work around invoicing is where teams lose time. Payvio
          keeps creation, approval, collections, and close in the same flow.
        </p>
        <a href="/signup" className="mint-button">
          Apply Now
        </a>
      </div>
    </section>
  );
}

function OperationsSection() {
  return (
    <section className="operations-section" id="pricing" aria-labelledby="operations-title">
      <div>
        <h2 id="operations-title">Quiet by default.</h2>
        <p>
          The interface stays focused on the next invoice action instead of
          flooding the team with dashboards they do not need.
        </p>
      </div>
      <div>
        <h2>Structured when it matters.</h2>
        <p>
          Review paths, payment follow-up, audit history, and exports are ready
          when the workflow needs more control.
        </p>
      </div>
    </section>
  );
}

function FooterCta() {
  return (
    <footer className="footer-cta" id="demo">
      <div>
        <h2>Ready when you are.</h2>
        <div className="hero-form dark-form" aria-label="Request a demo">
          <input type="email" placeholder="Enter your work email" />
          <button type="button">Submit</button>
        </div>
        <p>
          A focused invoice operations workspace for teams that need less
          spreadsheet cleanup and clearer receivables review.
        </p>
      </div>
      <nav aria-label="Footer navigation" id="resources">
        <a href="#products">Products</a>
        <a href="#solutions">Solutions</a>
        <a href="#pricing">Pricing</a>
        <a href="#resources">Resources</a>
        <a href="#security">Security</a>
      </nav>
    </footer>
  );
}
