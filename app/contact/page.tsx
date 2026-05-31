import Link from "next/link";

export default function ContactPage() {
  return (
    <main className="info-page">
      <nav className="info-nav">
        <Link href="/" className="info-nav-logo">
          <img src="/payvio-logo.svg" alt="Payvio" style={{ height: "40px" }} />
        </Link>
        <div className="info-nav-links">
          <Link href="/">Home</Link>
          <Link href="/about">About</Link>
          <Link href="/blog">Blog</Link>
          <Link href="/contact" className="active">Contact</Link>
        </div>
        <Link href="/login" className="info-nav-cta">Login</Link>
      </nav>

      <section className="info-hero">
        <div className="lp-section-label">Get in touch</div>
        <h1 className="info-hero-title">We&apos;d love to hear from you.</h1>
        <p className="info-hero-sub">Whether you have a question about pricing, features, NamRA compliance, or just want to say hello — we&apos;re here.</p>
      </section>

      <section className="info-section">
        <div className="info-section-inner">
          <div className="info-contact-grid">

            {/* Contact cards */}
            <div className="info-contact-people">
              <h2 className="info-section-title" style={{ marginBottom: "24px" }}>Reach the founders directly</h2>

              <div className="info-contact-card">
                <div className="info-founder-avatar" style={{ background: "#1a6fc4", width: "52px", height: "52px", fontSize: "1.1rem", flexShrink: 0 }}>NH</div>
                <div>
                  <h3 style={{ margin: "0 0 4px", fontSize: "1.05rem", fontWeight: 700, color: "#111827" }}>Nazeem Harris</h3>
                  <p style={{ margin: "0 0 8px", fontSize: "0.82rem", color: "#9ca3af" }}>Co-Founder & CTO</p>
                  <a href="mailto:inthelooppodastnazeem@gmail.com" className="info-email-link">
                    inthelooppodastnazeem@gmail.com
                  </a>
                  <div style={{ marginTop: "10px" }}>
                    <a href="https://www.instagram.com/nazeem_harris/" target="_blank" rel="noreferrer" className="info-social-link">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                      @nazeem_harris
                    </a>
                  </div>
                </div>
              </div>

              <div className="info-contact-card">
                <div className="info-founder-avatar" style={{ background: "#009b68", width: "52px", height: "52px", fontSize: "1.1rem", flexShrink: 0 }}>AM</div>
                <div>
                  <h3 style={{ margin: "0 0 4px", fontSize: "1.05rem", fontWeight: 700, color: "#111827" }}>Andreas Mukombabi</h3>
                  <p style={{ margin: "0 0 8px", fontSize: "0.82rem", color: "#9ca3af" }}>Co-Founder & CTO</p>
                  <a href="mailto:info.procrasti@gmail.com" className="info-email-link">
                    info.procrasti@gmail.com
                  </a>
                  <div style={{ marginTop: "10px" }}>
                    <a href="https://www.instagram.com/dot.a9/" target="_blank" rel="noreferrer" className="info-social-link">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                      @dot.a9
                    </a>
                  </div>
                </div>
              </div>

              {/* Location */}
              <div className="info-location-card">
                <span>📍</span>
                <div>
                  <p style={{ fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>Based in Windhoek, Namibia</p>
                  <p style={{ color: "#6b7280", fontSize: "0.88rem", margin: 0 }}>Building Namibia&apos;s invoice infrastructure, one SME at a time.</p>
                </div>
              </div>
            </div>

            {/* FAQ */}
            <div className="info-contact-faq">
              <h2 className="info-section-title" style={{ marginBottom: "24px" }}>Common questions</h2>
              {[
                { q: "Is Payvio NamRA compliant?", a: "Yes. Every invoice generated on Payvio meets NamRA's VAT invoicing requirements — including sequential numbering, VAT breakdown, and 5-year digital retention." },
                { q: "What currencies do you support?", a: "Payvio supports NAD (Namibian Dollar), USD, and ZAR — perfect for businesses with cross-border clients." },
                { q: "Do you offer a free trial?", a: "Yes — every new account gets a 14-day free trial with full Starter plan features. No credit card required." },
                { q: "When will NamRA ITAS integration be live?", a: "The phased e-invoicing mandate runs 2026–2029. We are actively building the ITAS integration and will have it ready for large businesses first, ahead of the mandate deadline." },
                { q: "How do I get my access code?", a: "Access codes are issued when you purchase a plan. Contact us directly to get set up with a Business, Professional, or Enterprise plan." },
              ].map((item) => (
                <div key={item.q} className="info-faq-item">
                  <h3>{item.q}</h3>
                  <p>{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="info-footer">
        <p>© 2026 Payvio · Windhoek, Namibia · <Link href="/about">About</Link></p>
      </footer>
    </main>
  );
}
