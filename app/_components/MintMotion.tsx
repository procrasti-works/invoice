"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/* ── THE MINT motion primitives ──
   Scroll reveals, counting meters, magnetic buttons, and the
   self-printing invoice. All transform/opacity only; every effect
   respects prefers-reduced-motion via the pv-reduced class hooks. */

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/** Scroll-reveal wrapper. The animation is pure CSS (animation-timeline:
    view()), so content is never hidden pre-hydration or on browsers
    without scroll-driven animation support. */
export function Reveal({
  children,
  className = "",
  delay = 0,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  /** kept for call-site compatibility; view() timelines pace themselves */
  delay?: number;
  as?: "div" | "section" | "article" | "span";
}) {
  void delay;
  return <Tag className={`pv-reveal ${className}`}>{children}</Tag>;
}

/** Counts from 0 to `value` when scrolled into view. Mono, tabular. */
export function CountUp({
  value,
  prefix = "",
  suffix = "",
  decimals = 2,
  duration = 1400,
  className = "",
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = usePrefersReducedMotion();
  const format = useCallback(
    (n: number) =>
      `${prefix}${n.toLocaleString("en-NA", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}${suffix}`,
    [prefix, suffix, decimals]
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced) {
      el.textContent = format(value);
      return;
    }
    el.textContent = format(0);
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - t, 3);
          el.textContent = format(value * eased);
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [value, duration, reduced, format]);

  return <span className={`pv-count ${className}`} ref={ref} />;
}

/** Cursor-magnetic wrapper for CTAs. Subtle: max 6px pull. */
export function Magnetic({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el || reduced) return;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width - 0.5) * 12;
    const y = ((e.clientY - r.top) / r.height - 0.5) * 8;
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  };
  const onLeave = () => {
    const el = ref.current;
    if (el) el.style.transform = "translate(0, 0)";
  };

  return (
    <div
      className="pv-magnetic"
      onMouseLeave={onLeave}
      onMouseMove={onMove}
      ref={ref}
    >
      {children}
    </div>
  );
}

/** The hero document: an invoice that prints itself, then gets stamped. */
export function PrintedInvoice() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      el.classList.add("pv-printing");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.classList.add("pv-printing");
          io.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const lines: [string, string, string][] = [
    ["Brand identity system", "1", "N$9,800.00"],
    ["Packaging — 3 SKUs", "3", "N$7,350.00"],
    ["Label print supervision", "1", "N$2,400.00"],
  ];

  return (
    <div aria-hidden="true" className="pv-doc" ref={ref}>
      <div className="pv-doc-paper">
        <div className="pv-doc-head pv-doc-line">
          <div>
            <span className="pv-doc-brand">OKONJIMA STUDIO</span>
            <span className="pv-doc-sub">Windhoek · Reg 2021/0481</span>
          </div>
          <div className="pv-doc-no">
            <span>INVOICE</span>
            <strong>№ 0114</strong>
          </div>
        </div>
        <div className="pv-doc-meta pv-doc-line">
          <span>Billed to — Etosha Trading CC</span>
          <span>Due 30 Jun 2026</span>
        </div>
        <div className="pv-doc-items">
          {lines.map(([name, qty, amount], i) => (
            <div
              className="pv-doc-row pv-doc-line"
              key={name}
              style={{ transitionDelay: `${500 + i * 260}ms` }}
            >
              <span>{name}</span>
              <span className="pv-doc-qty">{qty}</span>
              <span className="pv-doc-amt">{amount}</span>
            </div>
          ))}
        </div>
        <div className="pv-doc-totals">
          <div className="pv-doc-trow pv-doc-line" style={{ transitionDelay: "1350ms" }}>
            <span>Subtotal</span>
            <span className="pv-doc-amt">N$19,550.00</span>
          </div>
          <div className="pv-doc-trow pv-doc-line" style={{ transitionDelay: "1500ms" }}>
            <span>VAT 15%</span>
            <span className="pv-doc-amt">N$2,932.50</span>
          </div>
          <div
            className="pv-doc-trow pv-doc-total pv-doc-line"
            style={{ transitionDelay: "1680ms" }}
          >
            <span>Total due</span>
            <span className="pv-doc-amt">N$22,482.50</span>
          </div>
        </div>
        <span className="pv-doc-micro">
          PAYVIO·SECURE·RECORD·PAYVIO·SECURE·RECORD·PAYVIO·SECURE·RECORD·PAYVIO·SECURE·RECORD
        </span>
        <span className="pv-stamp">PAID</span>
      </div>
    </div>
  );
}

/** Engraved ticker tape. */
export function TickerTape({ items }: { items: string[] }) {
  const doubled = [...items, ...items];
  return (
    <div aria-label="Businesses using Payvio" className="pv-tape">
      <div className="pv-tape-track">
        {doubled.map((item, i) => (
          <span aria-hidden={i >= items.length} className="pv-tape-item" key={`${item}-${i}`}>
            {item}
            <span aria-hidden="true" className="pv-tape-star">
              ✶
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
