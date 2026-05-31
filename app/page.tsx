"use client";

import { useState } from "react";

const navLinks = ["Home", "About", "Blog", "Contact"];

const serviceCards = [
  {
    title: "Invoice Management",
    description: "Create, send, and track professional invoices in minutes. Full audit trail included.",
    icon: "📄",
    color: "#eef3ff",
    accent: "#1a6fc4",
  },
  {
    title: "Client Approvals",
    description: "Route invoices to clients for approval with a secure one-click review link.",
    icon: "✅",
    color: "#eef9f4",
    accent: "#009b68",
  },
  {
    title: "Payment Tracking",
    description: "Monitor payment status, send reminders, and reconcile receivables effortlessly.",
    icon: "💳",
    color: "#fff8ec",
    accent: "#e07b00",
  },
];

const featureCards = [
  {
    title: "Bank-grade Security",
    description: "Every invoice and client interaction is encrypted and access-controlled.",
    icon: "🔒",
  },
  {
    title: "Real-Time Tracking",
    description: "Know the moment a client opens, approves, or rejects your invoice.",
    icon: "📊",
  },
  {
    title: "Global Payments",
    description: "Multi-currency support so you can invoice clients anywhere in the world.",
    icon: "🌍",
  },
  {
    title: "Team Collaboration",
    description: "Add team members with roles so everyone stays in the loop.",
    icon: "👥",
  },
  {
    title: "Smart Reminders",
    description: "Automated follow-up drafts for overdue invoices — ready to send in one click.",
    icon: "🔔",
  },
];

const workflowSteps = [
  { step: "01", title: "Sign Up", description: "Create your Payvio workspace in under 2 minutes." },
  { step: "02", title: "Add Client", description: "Add your client's name and email to get started." },
  { step: "03", title: "Create Invoice", description: "Build a professional invoice with line items and terms." },
  { step: "04", title: "Send & Approve", description: "Client receives a secure link to review and approve." },
  { step: "05", title: "Get Paid", description: "Mark payment received and close the invoice." },
];

const stats = [
  { value: "98%", label: "Invoice Approval Rate" },
  { value: "$2.4M+", label: "Invoices Processed" },
  { value: "3x", label: "Faster Collections" },
  { value: "500+", label: "Active Businesses" },
];

const testimonials = [
  {
    quote: "Payvio completely replaced our manual invoice process. Clients approve in hours, not weeks.",
    name: "Sarah M.",
    role: "Finance Director, Apex Group",
    initials: "SM",
    color: "#1a6fc4",
  },
  {
    quote: "The client approval link is brilliant. No more back-and-forth emails just to get a sign-off.",
    name: "James O.",
    role: "Founder, Orbit Creative",
    initials: "JO",
    color: "#009b68",
  },
  {
    quote: "We cut our invoice-to-payment cycle from 30 days to under 10. Game changer.",
    name: "Priya K.",
    role: "CFO, Vantage Labs",
    initials: "PK",
    color: "#7c3aed",
  },
];

const pricingPlans = [
  {
    name: "Starter",
    monthlyPrice: "$0",
    annualPrice: "$0",
    description: "Perfect for freelancers and solo operators.",
    features: ["Up to 5 invoices/month", "1 workspace", "Client approval links", "Basic reminders", "Email support"],
    cta: "Get Started Free",
    highlight: false,
  },
  {
    name: "Growth",
    monthlyPrice: "$29",
    annualPrice: "$19",
    description: "For growing teams that invoice regularly.",
    features: ["Unlimited invoices", "3 workspaces", "Team members (up to 5)", "Smart reminders", "Priority support", "Multi-currency"],
    cta: "Start Free Trial",
    highlight: true,
    badge: "Most Popular",
  },
  {
    name: "Business",
    monthlyPrice: "$79",
    annualPrice: "$59",
    description: "For finance teams managing high invoice volume.",
    features: ["Unlimited everything", "Unlimited workspaces", "Unlimited team members", "Advanced reporting", "Dedicated support", "Custom branding", "API access"],
    cta: "Contact Sales",
    highlight: false,
  },
];

const blogPosts = [
  {
    category: "Fintech",
    date: "May 20, 2026",
    title: "How to Cut Your Invoice-to-Payment Cycle in Half",
    excerpt: "Practical steps finance teams can take today to speed up approvals and collections.",
    color: "#1a6fc4",
  },
  {
    category: "Tips",
    date: "May 12, 2026",
    title: "The 5 Invoice Mistakes That Delay Client Payments",
    excerpt: "Small errors in your invoicing workflow cost you time and cash flow. Here's what to fix.",
    color: "#009b68",
  },
  {
    category: "Security",
    date: "Apr 28, 2026",
    title: "Why Secure Client Approval Links Matter More Than Ever",
    excerpt: "Invoice fraud is rising. Learn how secure, tokenized links protect your business.",
    color: "#7c3aed",
  },
];

const footerLinks = {
  Company: ["About Us", "Careers", "Blog", "Press"],
  Support: ["Help Center", "FAQs", "Contact Support", "Status"],
  Legal: ["Privacy Policy", "Terms of Service", "Security", "Cookies"],
};

export default function Home() {
  return (
    <main>
      <SiteHeader />
      <Hero />
      <ServiceCards />
      <StatsBar />
      <FeatureGrid />
      <WorkflowSteps />
      <Testimonials />
      <Pricing />
      <BlogSection />
      <SiteFooter />
    </main>
  );
}

function SiteHeader() {
  return (
    <header className="lp-header">
      <a href="/" aria-label="Payvio home" className="lp-logo-link">
        <img src="/payvio-logo.svg" alt="Payvio" className="lp-logo" />
      </a>
      <nav className="lp-nav" aria-label="Main navigation">
        {navLinks.map((link) => (
          <a key={link} href="#" className="lp-nav-link">{link}</a>
        ))}
      </nav>
      <div className="lp-header-actions">
        <a href="/login" className="lp-login">Login</a>
        <a href="/signup" className="lp-cta-btn">Get In Touch</a>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="lp-hero">
      <div className="lp-hero-pill">NEW: Payvio Approvals — one-click client invoice sign-off</div>
      <h1 className="lp-hero-title">Best Invoice Management Platform</h1>
      <p className="lp-hero-sub">Effortless invoice operations for a modern business world. Create, send, approve, and collect — all in one place.</p>
      <div className="lp-hero-actions">
        <div className="lp-hero-form">
          <input type="email" placeholder="Enter your work email" />
          <button type="button">Get Started Today</button>
        </div>
        <a href="#demo" className="lp-demo-link">Request Demo</a>
      </div>
      <p className="lp-fine-print">Payvio is invoice operations software. Banking and payment connections remain with your existing providers.</p>
      <div className="lp-brand-logos">
        <img src="/payvio-logo.svg" alt="Payvio" className="lp-brand-logo" />
        <img src="/payvio-logo.svg" alt="Payvio" className="lp-brand-logo lp-brand-logo-dim" />
        <img src="/payvio-logo.svg" alt="Payvio" className="lp-brand-logo lp-brand-logo-dim" />
      </div>
    </section>
  );
}

function ServiceCards() {
  return (
    <section className="lp-section lp-service-section">
      <div className="lp-section-label">What We Offer</div>
      <h2 className="lp-section-title">Transforming invoice experiences</h2>
      <p className="lp-section-sub">Cutting-edge features designed for your financial success.</p>
      <div className="lp-service-grid">
        {serviceCards.map((card) => (
          <article key={card.title} className="lp-service-card" style={{ "--card-bg": card.color, "--card-accent": card.accent } as React.CSSProperties}>
            <div className="lp-service-icon">{card.icon}</div>
            <h3>{card.title}</h3>
            <p>{card.description}</p>
            <a href="/signup" className="lp-service-link" style={{ color: card.accent }}>Learn more →</a>
          </article>
        ))}
      </div>
    </section>
  );
}

function StatsBar() {
  return (
    <section className="lp-stats-bar">
      {stats.map((stat) => (
        <div key={stat.label} className="lp-stat">
          <span className="lp-stat-value">{stat.value}</span>
          <span className="lp-stat-label">{stat.label}</span>
        </div>
      ))}
    </section>
  );
}

function FeatureGrid() {
  return (
    <section className="lp-section lp-feature-section">
      <div className="lp-section-label">Platform</div>
      <h2 className="lp-section-title">Cutting-edge features designed for your financial success</h2>
      <div className="lp-feature-grid">
        {featureCards.map((card) => (
          <article key={card.title} className="lp-feature-card">
            <div className="lp-feature-icon">{card.icon}</div>
            <h3>{card.title}</h3>
            <p>{card.description}</p>
          </article>
        ))}
      </div>
      <div className="lp-feature-cta">
        <a href="/signup" className="lp-primary-btn">Apply Now</a>
      </div>
    </section>
  );
}

function WorkflowSteps() {
  return (
    <section className="lp-section lp-workflow-section">
      <div className="lp-section-label">How It Works</div>
      <h2 className="lp-section-title">From first invoice to final payment in 5 steps</h2>
      <div className="lp-workflow-steps">
        {workflowSteps.map((step, i) => (
          <div key={step.step} className="lp-workflow-step">
            <div className="lp-step-number">{step.step}</div>
            {i < workflowSteps.length - 1 && <div className="lp-step-connector" />}
            <h3>{step.title}</h3>
            <p>{step.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Testimonials() {
  const [active, setActive] = useState(0);
  const t = testimonials[active];

  return (
    <section className="lp-section lp-testimonial-section">
      <div className="lp-section-label">Testimonials</div>
      <h2 className="lp-section-title">Trusted by growing businesses</h2>
      <div className="lp-testimonial-card">
        <div className="lp-testimonial-avatar" style={{ background: t.color }}>{t.initials}</div>
        <blockquote className="lp-testimonial-quote">"{t.quote}"</blockquote>
        <p className="lp-testimonial-name">{t.name}</p>
        <p className="lp-testimonial-role">{t.role}</p>
        <div className="lp-testimonial-dots">
          {testimonials.map((_, i) => (
            <button
              key={i}
              className={`lp-dot${i === active ? " lp-dot-active" : ""}`}
              onClick={() => setActive(i)}
              aria-label={`Testimonial ${i + 1}`}
            />
          ))}
        </div>
      </div>
      <div className="lp-testimonial-metrics">
        <div><span>98%</span><p>Transaction Success Rate</p></div>
        <div><span>$2.4M+</span><p>Average Business Savings</p></div>
        <div><span>3x</span><p>Improved Collection Speed</p></div>
        <div><span>500+</span><p>Active Businesses Worldwide</p></div>
      </div>
    </section>
  );
}

function Pricing() {
  const [annual, setAnnual] = useState(false);

  return (
    <section className="lp-section lp-pricing-section" id="pricing">
      <div className="lp-section-label">Pricing</div>
      <h2 className="lp-section-title">Simple, transparent pricing</h2>
      <p className="lp-section-sub">Start free. Upgrade when you're ready.</p>
      <div className="lp-pricing-toggle">
        <button className={!annual ? "lp-toggle-active" : ""} onClick={() => setAnnual(false)}>Monthly</button>
        <button className={annual ? "lp-toggle-active" : ""} onClick={() => setAnnual(true)}>
          Annual <span className="lp-save-badge">Save 30%</span>
        </button>
      </div>
      <div className="lp-pricing-grid">
        {pricingPlans.map((plan) => (
          <article key={plan.name} className={`lp-pricing-card${plan.highlight ? " lp-pricing-highlight" : ""}`}>
            {plan.badge && <div className="lp-pricing-badge">{plan.badge}</div>}
            <h3>{plan.name}</h3>
            <div className="lp-price">
              {annual ? plan.annualPrice : plan.monthlyPrice}
              {plan.monthlyPrice !== "$0" && <span>/mo</span>}
            </div>
            <p className="lp-plan-desc">{plan.description}</p>
            <ul className="lp-plan-features">
              {plan.features.map((f) => (
                <li key={f}><span className="lp-check">✓</span> {f}</li>
              ))}
            </ul>
            <a href="/signup" className={plan.highlight ? "lp-primary-btn" : "lp-outline-btn"}>{plan.cta}</a>
          </article>
        ))}
      </div>
    </section>
  );
}

function BlogSection() {
  return (
    <section className="lp-section lp-blog-section">
      <div className="lp-section-label">Blog</div>
      <h2 className="lp-section-title">Latest from Payvio</h2>
      <div className="lp-blog-grid">
        {blogPosts.map((post) => (
          <article key={post.title} className="lp-blog-card">
            <div className="lp-blog-img" style={{ background: post.color }}>
              <img src="/payvio-logo.svg" alt="" className="lp-blog-logo" />
            </div>
            <div className="lp-blog-body">
              <div className="lp-blog-meta">
                <span className="lp-blog-cat">{post.category}</span>
                <span className="lp-blog-date">{post.date}</span>
              </div>
              <h3>{post.title}</h3>
              <p>{post.excerpt}</p>
              <a href="#" className="lp-blog-link">Read more →</a>
            </div>
          </article>
        ))}
      </div>
      <div className="lp-blog-more">
        <a href="#" className="lp-outline-btn">View More Posts</a>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="lp-footer">
      <div className="lp-footer-top">
        <div className="lp-footer-brand">
          <img src="/payvio-logo.svg" alt="Payvio" className="lp-footer-logo" />
          <p>Invoice operations software for modern finance teams.</p>
          <div className="lp-newsletter">
            <input type="email" placeholder="Your email address" />
            <button type="button">Subscribe</button>
          </div>
          <div className="lp-social-links">
            <a href="#" aria-label="Twitter" className="lp-social">𝕏</a>
            <a href="#" aria-label="LinkedIn" className="lp-social">in</a>
            <a href="#" aria-label="Facebook" className="lp-social">f</a>
            <a href="#" aria-label="Instagram" className="lp-social">ig</a>
          </div>
        </div>
        {Object.entries(footerLinks).map(([group, links]) => (
          <div key={group} className="lp-footer-col">
            <h4>{group}</h4>
            {links.map((link) => (
              <a key={link} href="#">{link}</a>
            ))}
          </div>
        ))}
      </div>
      <div className="lp-footer-bottom">
        <span>© 2026 Payvio. All Rights Reserved.</span>
        <div className="lp-footer-bottom-links">
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
        </div>
      </div>
    </footer>
  );
}
