import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="info-page">
      {/* Header */}
      <nav className="info-nav">
        <Link href="/" className="info-nav-logo">
          <img src="/payvio-logo.svg" alt="Payvio" style={{ height: "40px" }} />
        </Link>
        <div className="info-nav-links">
          <Link href="/">Home</Link>
          <Link href="/about" className="active">About</Link>
          <Link href="/blog">Blog</Link>
          <Link href="/contact">Contact</Link>
        </div>
        <Link href="/login" className="info-nav-cta">Login</Link>
      </nav>

      {/* Hero */}
      <section className="info-hero">
        <div className="lp-section-label">Our Story</div>
        <h1 className="info-hero-title">Built in Namibia.<br />Built for Namibia.</h1>
        <p className="info-hero-sub">
          Payvio was born from a simple observation — Namibia has over 40,000 active SMEs, a growing digital economy, and a government-mandated e-invoicing deadline. Yet not a single locally-built, NamRA-compliant invoicing platform existed. We decided to build it.
        </p>
      </section>

      {/* Mission */}
      <section className="info-section info-section-alt">
        <div className="info-section-inner">
          <div className="lp-section-label">Mission</div>
          <h2 className="info-section-title">Why Payvio exists</h2>
          <div className="info-mission-grid">
            <div className="info-mission-card">
              <div className="info-mission-num">90%</div>
              <p>of Namibian SMEs fail within their first five years. The primary cause: poor financial management — no proper invoicing, no cash flow visibility, no digital records.</p>
            </div>
            <div className="info-mission-card">
              <div className="info-mission-num">40K+</div>
              <p>active businesses in Namibia are still managing invoices on paper, WhatsApp, or Excel — not NamRA compliant, not scalable, not sustainable.</p>
            </div>
            <div className="info-mission-card">
              <div className="info-mission-num">2026</div>
              <p>NamRA&apos;s mandatory e-invoicing rollout begins. Every business will need a compliant digital invoicing system. We&apos;re building it before anyone else does.</p>
            </div>
          </div>
          <p className="info-mission-body">
            Payvio is the answer to all three. A professional, affordable, NamRA-compliant invoice management platform built specifically for Namibian businesses — in Namibian dollars, with local support, and designed for the realities of doing business in Namibia.
          </p>
        </div>
      </section>

      {/* Founders */}
      <section className="info-section">
        <div className="info-section-inner">
          <div className="lp-section-label">The Team</div>
          <h2 className="info-section-title">The people behind Payvio</h2>
          <div className="info-founders-grid">

            <div className="info-founder-card">
              <div className="info-founder-avatar" style={{ background: "#1a6fc4" }}>NH</div>
              <div className="info-founder-info">
                <h3>Nazeem Harris</h3>
                <p className="info-founder-role">Co-Founder & CTO</p>
                <p className="info-founder-bio">
                  Nazeem is a builder at heart. With a deep understanding of the Namibian SME landscape and the technical gaps that hold local businesses back, he co-founded Payvio to create the invoicing infrastructure that Namibia&apos;s economy has been missing. He leads product development, frontend architecture, and the overall vision of the platform — building every feature with the real-world challenges of Namibian business owners in mind.
                </p>
                <div className="info-founder-links">
                  <a href="https://www.instagram.com/nazeem_harris/" target="_blank" rel="noreferrer" className="info-social-link">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                    Instagram
                  </a>
                </div>
              </div>
            </div>

            <div className="info-founder-card">
              <div className="info-founder-avatar" style={{ background: "#009b68" }}>AM</div>
              <div className="info-founder-info">
                <h3>Andreas Mukombabi</h3>
                <p className="info-founder-role">Co-Founder & CTO</p>
                <p className="info-founder-bio">
                  Andreas brings the backend muscle to Payvio. Passionate about building technology that solves real problems for African businesses, he co-founded Payvio to tackle the compliance and financial digitisation challenges facing Namibian SMEs head-on. He leads backend architecture, API integrations, and the technical infrastructure that powers Payvio&apos;s real-time invoice operations — including the upcoming NamRA ITAS integration that will keep every Payvio user ahead of the e-invoicing mandate.
                </p>
                <div className="info-founder-links">
                  <a href="https://www.instagram.com/dot.a9/" target="_blank" rel="noreferrer" className="info-social-link">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                    Instagram
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="info-section info-section-alt">
        <div className="info-section-inner">
          <div className="lp-section-label">Our Values</div>
          <h2 className="info-section-title">What we stand for</h2>
          <div className="info-values-grid">
            {[
              { icon: "🇳🇦", title: "Local first", body: "Built by Namibians, for Namibians. Every feature is designed around the realities of running a business in Namibia." },
              { icon: "⚖️", title: "Compliance built in", body: "NamRA compliance isn&apos;t an afterthought — it&apos;s in the foundation. Every invoice Payvio generates is tax-ready." },
              { icon: "🔒", title: "Privacy by design", body: "Your financial data is yours. We never sell it, share it, or hold onto anything we don&apos;t need." },
              { icon: "💡", title: "Simple by choice", body: "Powerful enough for a growing business, simple enough for a first-time business owner. No training required." },
            ].map((v) => (
              <div key={v.title} className="info-value-card">
                <span className="info-value-icon">{v.icon}</span>
                <h3>{v.title}</h3>
                <p>{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="info-cta">
        <h2>Ready to take your invoicing digital?</h2>
        <p>Join Namibia&apos;s growing community of businesses that invoice smarter.</p>
        <Link href="/signup" className="lp-primary-btn">Get Started Free</Link>
      </section>

      <footer className="info-footer">
        <p>© 2026 Payvio · <Link href="/contact">Contact us</Link></p>
      </footer>
    </main>
  );
}
