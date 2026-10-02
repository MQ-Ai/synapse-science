import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sage · OEQ Mentor",
  description: "Dreading Booklet B meltdowns? Sage is a free AI tutor that guides your child through PSLE Science OEQs step by step — no tears, no giving away answers.",
  openGraph: {
    title: "Sage · OEQ Mentor",
    description: "Dreading Booklet B meltdowns? Sage is a free AI tutor that guides your child through PSLE Science OEQs step by step — no tears, no giving away answers.",
    url: "https://synapse-app-mu.vercel.app",
    siteName: "Sage by Synapse",
    images: [
      {
        url: "https://synapse-app-mu.vercel.app/og-image.png",
        width: 1200,
        height: 630,
        alt: "Sage — PSLE Science Tutor",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sage · OEQ Mentor",
    description: "Dreading Booklet B meltdowns? Sage is a free AI tutor that guides your child through PSLE Science OEQs step by step — no tears, no giving away answers.",
    images: ["https://synapse-app-mu.vercel.app/og-image.png"],
  },
};

export default function HomePage() {
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-5 py-12"
      style={{ background: "#FFF8F3", fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      <div
        className="w-full rounded-3xl overflow-hidden shadow-xl"
        style={{ maxWidth: "460px", background: "#FFFFFF", border: "1px solid #F0DDD0" }}
      >
        {/* Hero strip */}
        <div
          className="px-7 pt-8 pb-6 relative overflow-hidden"
          style={{ background: "linear-gradient(160deg, #FF6B35 0%, #FF9A6C 60%, #FFB085 100%)" }}
        >
          {/* subtle circle pattern */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='30' cy='30' r='28' fill='none' stroke='rgba(255,255,255,0.06)' stroke-width='1'/%3E%3C/svg%3E")`,
              backgroundSize: "60px 60px",
            }}
          />
          <div
            className="inline-flex items-center gap-1 mb-5 rounded-full border px-3 py-1 text-white"
            style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", background: "rgba(255,255,255,0.22)", borderColor: "rgba(255,255,255,0.35)" }}
          >
            ✦ Beta · Free
          </div>

          {/* Sage mascot — teardrop body, party hat, wand */}
          <svg className="mb-3" width="110" height="130" viewBox="0 0 110 130" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* PARTY HAT */}
            <g transform="rotate(-8 55 55)">
              <path d="M55 4 L38 48 L72 48 Z" fill="white"/>
              <path d="M55 4 L47 30 L63 30 Z" fill="#F0F0F0" opacity="0.6"/>
              <line x1="46" y1="27" x2="38" y2="48" stroke="#FFB3C6" strokeWidth="3" strokeLinecap="round" opacity="0.7"/>
              <line x1="55" y1="13" x2="55" y2="48" stroke="#FFD6E0" strokeWidth="2" opacity="0.5"/>
              <ellipse cx="55" cy="48" rx="17" ry="5" fill="#FFB3C6"/>
              <path d="M55 4 L56.5 8.5 L61 8.5 L57.5 11.5 L59 16 L55 13 L51 16 L52.5 11.5 L49 8.5 L53.5 8.5 Z" fill="#FCD34D"/>
            </g>
            {/* TEARDROP BODY */}
            <path d="M55 30 C30 30 18 55 18 72 C18 92 34 108 55 108 C76 108 92 92 92 72 C92 55 80 30 55 30Z" fill="white"/>
            <ellipse cx="45" cy="58" rx="8" ry="12" fill="white" opacity="0.5"/>
            {/* BLUSH */}
            <circle cx="34" cy="80" r="8" fill="#FFB3C6" opacity="0.5"/>
            <circle cx="76" cy="80" r="8" fill="#FFB3C6" opacity="0.5"/>
            {/* EYES */}
            <ellipse cx="43" cy="72" rx="7" ry="8" fill="#1a1a1a"/>
            <ellipse cx="67" cy="72" rx="7" ry="8" fill="#1a1a1a"/>
            <circle cx="46" cy="68" r="3" fill="white"/>
            <circle cx="70" cy="68" r="3" fill="white"/>
            <circle cx="41" cy="75" r="1.5" fill="white" opacity="0.7"/>
            <circle cx="65" cy="75" r="1.5" fill="white" opacity="0.7"/>
            {/* SMILE */}
            <path d="M44 87 Q55 96 66 87" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
            {/* WAND */}
            <line x1="85" y1="75" x2="104" y2="52" stroke="#D4A574" strokeWidth="4" strokeLinecap="round"/>
            <path d="M104 48 L105.8 53.5 L111.5 53.5 L106.9 56.9 L108.7 62.4 L104 59 L99.3 62.4 L101.1 56.9 L96.5 53.5 L102.2 53.5 Z" fill="#FCD34D"/>
            <circle cx="95" cy="48" r="2" fill="#FCD34D" opacity="0.8"/>
            <circle cx="109" cy="44" r="1.5" fill="white" opacity="0.9"/>
          </svg>

          <h1
            className="text-white font-bold leading-tight mb-2"
            style={{ fontSize: "clamp(24px, 6vw, 30px)", fontFamily: "Georgia, serif" }}
          >
            Meet{" "}
            <span style={{ fontFamily: "'Fredoka One', cursive", fontSize: "clamp(28px, 7vw, 34px)" }}>
              Sage
            </span>{" "}
            — your child&apos;s OEQ mentor
          </h1>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.85)" }}>
            Guided practice. Real exam questions. No shortcuts.
          </p>
        </div>

        {/* Body */}
        <div className="px-7 py-6 flex flex-col gap-5">
          <p className="text-sm leading-relaxed" style={{ color: "#2D1B0E" }}>
            <span className="font-semibold" style={{ color: "#FF6B35" }}>Sage</span> is a free AI tutor that walks Primary 6 students through real Booklet B Science questions — not by giving answers, but by asking the right questions, one step at a time.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2">
            {[
              "📚 58 real exam questions",
              "📅 2021, 2022 & 2024 papers",
              "🖼️ Diagrams included",
              "⭐ Instant star feedback",
              "🎯 MOE-aligned rubric",
              "✉️ Free with email signup",
            ].map((f) => (
              <span
                key={f}
                className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium"
                style={{ background: "#FFF0E8", color: "#C94A0E" }}
              >
                {f}
              </span>
            ))}
          </div>

          {/* CTA */}
          <Link
            href="/psle"
            className="block w-full text-center text-white font-semibold rounded-2xl py-4 text-sm transition-opacity hover:opacity-90 active:opacity-80"
            style={{ background: "linear-gradient(135deg, #FF9A56, #FF6B9D)" }}
          >
            Start practising now →
          </Link>

          {/* Divider */}
          <div style={{ height: "1px", background: "#F0DDD0" }} />

          {/* Method */}
          <div>
            <p className="mb-2" style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "#B8917A" }}>
              The Synapse Method
            </p>
            <p className="text-sm leading-relaxed" style={{ color: "#7A5540" }}>
              Sage uses the{" "}
              <span className="font-medium" style={{ color: "#2D1B0E" }}>Neuroscientific Socratic Method</span>
              {" "}— a structured dialogue approach where students arrive at answers through guided reasoning, not passive reading. This strengthens long-term retrieval and mirrors how strong science thinkers actually think.
            </p>
          </div>

          {/* Roadmap */}
          <div className="rounded-2xl p-4" style={{ background: "#FFF0E8" }}>
            <p className="mb-3" style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#B8917A" }}>
              Roadmap — Synapse Ecosystem
            </p>
            <div className="flex flex-col gap-2">
              {[
                { text: "Sage Beta — PSLE Science practice (you are here)", now: true },
                { text: "Full question bank: 2012 – 2024, all topics", now: false },
                { text: "O-Level Biology, Chemistry & Physics modules", now: false },
                { text: "Student progress tracking & parent insights", now: false },
                { text: "Full Synapse platform — cognitive sandbox for deep learning", now: false },
              ].map((s) => (
                <div key={s.text} className="flex items-baseline gap-2.5">
                  <div
                    className="flex-shrink-0 rounded-full"
                    style={{ width: "6px", height: "6px", background: s.now ? "#FF6B35" : "#FF9A6C", position: "relative", top: "-1px" }}
                  />
                  <span
                    className="text-xs leading-relaxed"
                    style={{ color: s.now ? "#2D1B0E" : "#7A5540", fontWeight: s.now ? 500 : 400 }}
                  >
                    {s.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-7 py-4 flex items-center justify-between" style={{ borderTop: "1px solid #F0DDD0" }}>
          <div style={{ fontSize: "11px", color: "#B8917A" }}>© 2026 Synapse Ecosystem</div>
          <a
            href="mailto:sage.synapse@gmail.com?subject=Sage%20Feedback"
            className="feedback-link"
            style={{ fontSize: "11px", color: "#B8917A", textDecoration: "none" }}
          >
            Send feedback →
          </a>
          <style>{`.feedback-link:hover { color: #FF6B35 !important; }`}</style>
        </div>
      </div>
    </main>
  );
}
