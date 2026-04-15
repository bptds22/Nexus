import Link from "next/link";
import MarketingNav from "@/components/marketing/MarketingNav";
import PlaybookBackground from "@/app/components/PlaybookBackground";

/* ═══════════════════════════════════════════════════════════════
   Pour les athlètes — public marketing landing page
   Static content. No Supabase. No X's and O's background.
═══════════════════════════════════════════════════════════════ */

export const metadata = {
  title: "Pour les athlètes — Nexus",
  description:
    "Crée ton profil gratuitement. Fais-toi vérifier par ton coach. Fais-toi repérer par les recruteurs CÉGEP.",
};

const STAT_ITEMS = [
  { value: "11x",  color: "text-white",      label: "plus de vues" },
  { value: "3x",   color: "text-white",      label: "plus d'engagements" },
  { value: "77%",  color: "text-[#E63946]",  label: "des athlètes vérifiés sont contactés" },
  { value: "16",   color: "text-white",      label: "sports supportés" },
];

const HOW_STEPS = [
  {
    n: "01",
    role: "Athlète",
    title: "Tu t'inscris",
    body: "Crée ton compte en 2 minutes. Remplis tes stats, tes vidéos, ton dossier académique. C'est gratuit.",
  },
  {
    n: "02",
    role: "Coach",
    title: "Ton coach te vérifie",
    body: "Il confirme tes infos, ajoute son évaluation et son rapport. Ton profil passe de visible à crédible.",
  },
  {
    n: "03",
    role: "Recruteur",
    title: "Les recruteurs te trouvent",
    body: "Tu reçois des notifications, tu vois qui regarde ton profil, et ton statut se met à jour en temps réel.",
  },
];

type TierKey = "FREE" | "PRO" | "ALLSTAR";
const FEATURES: { title: string; body: string; tier: TierKey }[] = [
  { title: "Profil complet",         body: "Stats, photo, vidéos, mensurations, profil académique — tout au même endroit.", tier: "FREE" },
  { title: "Vidéos illimitées",      body: "Faits saillants, match complet, Hudl, YouTube, Instagram — montre ton jeu.",   tier: "FREE" },
  { title: "Vérification coach",     body: "Ton coach confirme tes infos et t'évalue sur 8 critères. Badge bleu vérifié.", tier: "FREE" },
  { title: "Messagerie",             body: "Reçois des messages de recruteurs CÉGEP directement sur ton profil.",          tier: "FREE" },
  { title: "Nombre de vues",         body: "Vois combien de fois ton profil a été consulté. Tes stats de visibilité.",     tier: "FREE" },
  { title: "Nombre de favoris",      body: "Vois combien de recruteurs t'ont ajouté en favori.",                            tier: "FREE" },
  { title: "Qui te surveille",       body: "Tu sais combien de recruteurs te regardent. Avec Pro, tu sais QUI. Noms et CÉGEPs dévoilés.", tier: "PRO" },
  { title: "Tendances de vues",      body: "Vois l'évolution de tes vues semaine après semaine. Ton profil monte ou descend?",            tier: "PRO" },
  { title: "Tendances de likes",     body: "Suis qui t'ajoute en favori et quand. Détecte l'intérêt avant même qu'on te contacte.",        tier: "PRO" },
  { title: "Recherche par programme", body: "Trouve les CÉGEPs qui offrent le programme d'études qui t'intéresse.",                        tier: "ALLSTAR" },
  { title: "Carte interactive",      body: "Explore les CÉGEPs sur une carte. Filtre par sport, programme, région.",                       tier: "ALLSTAR" },
  { title: "Guide avancé",           body: "Accède au guide de recrutement interactif — stratégies avancées, timeline personnalisée, et conseils d'experts pour maximiser tes chances.", tier: "ALLSTAR" },
];

const SPORTS: { name: string; emoji: string; season: string }[] = [
  { name: "Football",       emoji: "🏈", season: "Automne" },
  { name: "Hockey",         emoji: "🏒", season: "Hiver" },
  { name: "Basketball",     emoji: "🏀", season: "Hiver" },
  { name: "Soccer",         emoji: "⚽", season: "Automne" },
  { name: "Volleyball",     emoji: "🏐", season: "Hiver" },
  { name: "Baseball",       emoji: "⚾", season: "Printemps" },
  { name: "Flag football",  emoji: "🚩", season: "Automne" },
  { name: "Rugby",          emoji: "🏉", season: "Printemps" },
  { name: "Athlétisme",     emoji: "🏃", season: "Toutes" },
  { name: "Natation",       emoji: "🏊", season: "Hiver" },
];

const FREE_BULLETS = ["Profil complet", "Vidéos illimitées", "Notifications", "Statut en temps réel"];

/* ── Reused atoms ───────────────────────────────────────────── */

function RedLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-[#E63946]">
      {children}
    </p>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-head text-[26px] sm:text-[30px] font-black text-white leading-tight tracking-tight mt-3">
      {children}
    </h2>
  );
}

function TierPill({ tier }: { tier: TierKey }) {
  if (tier === "FREE") return <span className="inline-flex px-2 py-0.5 rounded-full bg-[#22C55E]/15 text-[#22C55E] text-[10px] font-bold uppercase tracking-wider">Gratuit</span>;
  if (tier === "PRO")  return <span className="inline-flex px-2 py-0.5 rounded-full bg-[#E63946]/15 text-[#E63946] text-[10px] font-bold uppercase tracking-wider">Pro · 4,99$/mois</span>;
  return <span className="inline-flex px-2 py-0.5 rounded-full bg-white/5 text-[#9CA3AF] text-[10px] font-bold uppercase tracking-wider">All Star · À venir</span>;
}

function Check({ className = "" }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function Star({ filled }: { filled: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? "#F59E0B" : "#4a4d56"}>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function HalfStar() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24">
      <defs>
        <linearGradient id="half-star">
          <stop offset="50%" stopColor="#F59E0B" />
          <stop offset="50%" stopColor="#4a4d56" />
        </linearGradient>
      </defs>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="url(#half-star)" />
    </svg>
  );
}

function GlowFrame({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: "relative", width: "100%" }}>
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: "-60px",
          background:
            "radial-gradient(ellipse at center, rgba(230, 57, 70, 0.35) 0%, rgba(230, 57, 70, 0.12) 45%, transparent 75%)",
          borderRadius: "32px",
          zIndex: 0,
          pointerEvents: "none",
          filter: "blur(12px)",
        }}
      />
      <div style={{ position: "relative", zIndex: 1, width: "100%" }}>{children}</div>
    </div>
  );
}

function VerifiedBadge({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#2563EB" aria-label="Vérifié">
      <circle cx="12" cy="12" r="10" />
      <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

/* ── Hero player card (visual recreation, static) ───────────── */

function HeroPlayerCard() {
  return (
    <div className="nx-v30-wrap relative" style={{ width: 340, paddingTop: 6, paddingBottom: 10 }}>
      {/* Verified badge — 3D lapel pin */}
      <div className="nx-v30-badge absolute z-30" style={{ top: 12, right: -14 }}>
        <svg width="54" height="54" viewBox="0 0 54 54" fill="none">
          <defs>
            <radialGradient id="bg_grad_a" cx="38%" cy="28%" r="68%">
              <stop offset="0%" stopColor="#29AAFF" />
              <stop offset="55%" stopColor="#0094F0" />
              <stop offset="100%" stopColor="#0060C0" />
            </radialGradient>
            <radialGradient id="shine_a" cx="38%" cy="25%" r="55%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.32)" />
              <stop offset="60%" stopColor="rgba(255,255,255,0)" />
            </radialGradient>
          </defs>
          <circle cx="27" cy="27" r="26" fill="#0060C0" opacity="0.35" />
          <circle cx="27" cy="27" r="24" fill="url(#bg_grad_a)" />
          <circle cx="27" cy="27" r="24" fill="url(#shine_a)" />
          <circle cx="27" cy="27" r="24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
          <path d="M16,27 L22,34 L38,18" stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </div>

      {/* Main card */}
      <div className="nx-v30-card relative overflow-visible" style={{ width: 340, borderRadius: 10 }}>
        {/* Photo area */}
        <div className="relative overflow-hidden" style={{ width: 340, height: 500, borderRadius: 10, background: "#2F3440" }}>
          <div
            className="absolute inset-0 z-[1]"
            style={{
              backgroundImage: "url('/player_card%20image%20Bruno%207.png')",
              backgroundSize: "cover",
              backgroundPosition: "center top -40px",
            }}
          />
          {/* Gradient fade */}
          <div
            className="absolute bottom-0 left-0 right-0 h-1/2 z-[2]"
            style={{ background: "linear-gradient(to top, rgba(11,18,32,0.97) 0%, rgba(11,18,32,0.7) 35%, transparent 100%)" }}
          />
          {/* Corner fold */}
          <div
            className="absolute top-0 right-0 z-20"
            style={{ width: 0, height: 0, borderStyle: "solid", borderWidth: "0 20px 20px 0", borderColor: "transparent #1E2128 transparent transparent" }}
          />
        </div>

        {/* Ticket */}
        <div
          className="nx-v30-ticket absolute z-[999] overflow-hidden"
          style={{ bottom: -16, right: -26, borderRadius: 4, border: "1.5px solid rgba(255,255,255,0.08)" }}
        >
          <div className="flex" style={{ width: 364 }}>
            {/* Left — dark navy */}
            <div
              className="flex flex-col justify-between"
              style={{ background: "#1E2128", padding: "14px 16px 14px 18px", minWidth: 109, gap: 5 }}
            >
              {[
                { lbl: "Sport", val: "Football" },
                { lbl: "Pos", val: "QB" },
                { lbl: "No.", val: "#12" },
              ].map((r) => (
                <div key={r.lbl}>
                  <div style={{ fontFamily: "var(--font-barlow-cond), sans-serif", fontSize: 7, fontWeight: 800, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.38)", marginBottom: 2 }}>
                    {r.lbl}
                  </div>
                  <div style={{ fontFamily: "var(--font-heading), sans-serif", fontSize: 18, color: "#fff", letterSpacing: "0.06em", lineHeight: 1 }}>
                    {r.val}
                  </div>
                </div>
              ))}
            </div>

            {/* Perforation */}
            <div
              className="nx-v30-perf flex flex-col items-center justify-center"
              style={{ width: 12, background: "#E6E6E6", borderLeft: "1.5px dashed rgba(11,18,32,0.2)", borderRight: "1.5px dashed rgba(11,18,32,0.2)", gap: 3 }}
            >
              {[...Array(8)].map((_, i) => (
                <span key={i} className="flex-shrink-0" style={{ width: 3, height: 3, borderRadius: "50%", background: "rgba(11,18,32,0.2)" }} />
              ))}
            </div>

            {/* Right — white with dark star pill */}
            <div className="flex-1 flex flex-col justify-center" style={{ background: "#FFFFFF", padding: "14px 18px" }}>
              <svg width="150" height="22" viewBox="0 0 150 22" fill="none" style={{ display: "block", marginBottom: 8 }}>
                {[0, 30, 60, 90, 120].map((x) => (
                  <path key={x} d="M11,0L13.5,8L22,8L15.5,13L18,21L11,16.2L4,21L6.5,13L0,8L8.5,8Z" fill="#F59E0B" transform={`translate(${x},0)`} />
                ))}
              </svg>
              <div style={{ fontFamily: "var(--font-barlow-cond), sans-serif", fontWeight: 800, fontSize: 14, letterSpacing: "0.1em", textTransform: "uppercase", color: "#1E2128", marginBottom: 2 }}>
                École secondaire Saint-Jean-Eudes
              </div>
              <div style={{ fontFamily: "var(--font-barlow-cond), sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9CA3AF" }}>
                Québec, QC
              </div>
              <div style={{ fontFamily: "var(--font-barlow-cond), sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", color: "#E63946", marginTop: 2 }}>
                Promotion 2026
              </div>
            </div>

            {/* Stub */}
            <div
              className="flex items-center justify-center flex-shrink-0"
              style={{
                background: "#E63946",
                width: 26,
                writingMode: "vertical-rl",
                fontFamily: "var(--font-heading), sans-serif",
                fontSize: 11,
                letterSpacing: "0.22em",
                color: "rgba(255,255,255,0.7)",
              }}
            >
              NEXUS
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Section 4 mockup ───────────────────────────────────────── */

function ProfileMockup() {
  return (
    <div className="bg-[#15171c] rounded-2xl border border-white/[0.06] p-6 sm:p-8 shadow-2xl">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="w-16 h-16 shrink-0 rounded-full bg-[#2a2d36] flex items-center justify-center">
          <span className="font-head text-[18px] font-black text-white/30">MT</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-head text-[18px] font-black text-white">Mathis Thériault</h3>
            <VerifiedBadge size={16} />
          </div>
          <p className="text-[12px] text-[#9CA3AF]">Football · Receveur · Collège André-Grasset</p>
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-2 mb-6">
        <span className="inline-flex px-2.5 py-1 rounded-full bg-[#22C55E]/15 text-[#22C55E] text-[11px] font-bold uppercase tracking-wider">Ouvert</span>
        <span className="inline-flex px-2.5 py-1 rounded-full bg-white/5 text-[#9CA3AF] text-[11px] font-bold uppercase tracking-wider">2027</span>
        <span className="inline-flex px-2.5 py-1 rounded-full bg-white/5 text-[#9CA3AF] text-[11px] font-bold uppercase tracking-wider">Sciences de la nature</span>
        <span className="inline-flex px-2.5 py-1 rounded-full bg-[#E63946]/15 text-[#E63946] text-[11px] font-bold uppercase tracking-wider">Vérifié</span>
      </div>

      {/* Measurements */}
      <div className="mb-5">
        <p className="text-[10px] font-bold text-[#6b7280] uppercase tracking-[0.2em] mb-2">Mensurations</p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { k: "Taille", v: "6'1\"" },
            { k: "Poids",  v: "185 lb" },
            { k: "40 vg",  v: "4.62 s" },
          ].map((m) => (
            <div key={m.k} className="bg-[#1A1D24] rounded-lg p-3 border border-white/[0.04]">
              <p className="text-[10px] text-[#6b7280] uppercase tracking-wider">{m.k}</p>
              <p className="font-head text-[16px] font-black text-white mt-0.5">{m.v}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Academic */}
      <div>
        <p className="text-[10px] font-bold text-[#6b7280] uppercase tracking-[0.2em] mb-2">Académique</p>
        <div className="bg-[#1A1D24] rounded-lg p-3 border border-white/[0.04] flex items-center justify-between">
          <div>
            <p className="text-[13px] text-white font-bold">Moyenne générale</p>
            <p className="text-[11px] text-[#9CA3AF]">Mention d'honneur · 2 années consécutives</p>
          </div>
          <span className="font-head text-[22px] font-black text-[#22C55E]">87%</span>
        </div>
      </div>
    </div>
  );
}

/* ── Section 5 mockup ───────────────────────────────────────── */

function CoachReportMockup() {
  return (
    <div className="bg-[#15171c] rounded-2xl border border-white/[0.06] p-6 sm:p-8 shadow-2xl space-y-6">
      {/* Quote */}
      <div className="border-l-2 border-[#E63946] pl-4">
        <p className="italic text-[14px] text-[#E0E0E0] leading-relaxed">
          &ldquo;Leader naturel sur la glace et dans le vestiaire. Sa capacité à lire le jeu et à élever le niveau de ses coéquipiers en fait un joueur rare. Prêt pour le CÉGEP div. 1.&rdquo;
        </p>
        <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider mt-3">
          Coach Desrochers — Séminaire Saint-Joseph
        </p>
      </div>

      {/* Star rating */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-0.5">
          <Star filled /><Star filled /><Star filled /><Star filled /><HalfStar />
        </div>
        <span className="font-head text-[18px] font-black text-white">4.5</span>
        <span className="text-[11px] text-[#6b7280] uppercase tracking-wider">Cote globale</span>
      </div>

      {/* Distinctions */}
      <div>
        <p className="text-[10px] font-bold text-[#6b7280] uppercase tracking-[0.2em] mb-2">Distinctions</p>
        <div className="flex flex-wrap gap-2">
          {["Capitaine", "Étoile provinciale", "MVP"].map((d) => (
            <span key={d} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#E63946]/15 border border-[#E63946]/30 text-[#E63946] text-[11px] font-bold uppercase tracking-wider">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
              {d}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Section 6 mockup ───────────────────────────────────────── */

function StatusTrackerMockup() {
  const stages = [
    { label: "Ouvert",      done: true,  color: "bg-[#22C55E]" },
    { label: "En processus", done: true,  color: "bg-[#22C55E]" },
    { label: "Recruté",     done: false, color: "bg-[#2a2d36]" },
  ];
  return (
    <div className="bg-[#15171c] rounded-2xl border border-white/[0.06] p-8 shadow-2xl">
      <p className="text-[12px] font-bold text-[#6b7280] uppercase tracking-[0.2em] mb-7">Ton statut</p>
      <div className="flex items-center">
        {stages.map((s, i) => (
          <div key={s.label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-3">
              <div className={`w-10 h-10 rounded-full ${s.color} flex items-center justify-center`}>
                {s.done ? <Check className="text-white" /> : <span className="w-2.5 h-2.5 rounded-full bg-[#6b7280]" />}
              </div>
              <span className={`text-[12px] font-bold uppercase tracking-wider whitespace-nowrap ${s.done ? "text-white" : "text-[#6b7280]"}`}>
                {s.label}
              </span>
            </div>
            {i < stages.length - 1 && (
              <div className={`h-0.5 flex-1 mx-3 -mt-6 ${stages[i + 1].done ? "bg-[#22C55E]" : "bg-[#2a2d36]"}`} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function NotificationsMockup() {
  const items = [
    { dot: "bg-[#E63946]", text: "CÉGEP André-Grasset a consulté ton profil", time: "2h" },
    { dot: "bg-[#2563EB]", text: "Ton statut est passé à En processus",       time: "1j" },
    { dot: "bg-[#E63946]", text: "CÉGEP de Sherbrooke a regardé ta vidéo",    time: "3j" },
  ];
  return (
    <div className="bg-[#15171c] rounded-2xl border border-white/[0.06] p-8 shadow-2xl">
      <p className="text-[12px] font-bold text-[#6b7280] uppercase tracking-[0.2em] mb-5">Notifications</p>
      <ul className="space-y-4">
        {items.map((n, i) => (
          <li key={i} className="flex items-center gap-4">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${n.dot}`} />
            <p className="flex-1 text-[16px] text-[#E0E0E0] truncate">{n.text}</p>
            <span className="text-[13px] text-[#6b7280] shrink-0">{n.time}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Page
══════════════════════════════════════════════════════════════ */

export default function PourLesAthletesPage() {
  return (
    <div className="hero-playbook min-h-screen bg-[#111317] text-white font-sans scroll-smooth relative">
      <PlaybookBackground />
      <div className="relative z-10">
        <MarketingNav />

      {/* ─── SECTION 1 — HERO ─────────────────────────────── */}
      <section id="hero" className="border-b border-white/[0.06]">
        <div className="max-w-[1200px] mx-auto px-6 py-20 lg:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-[55%_45%] gap-12 lg:gap-16 items-center">
            <div>
              <RedLabel>Pour les étudiants-athlètes</RedLabel>
              <h1 className="font-head text-[42px] sm:text-[48px] font-black leading-[1.05] tracking-tight mt-4">
                Crée ton profil.<br />
                Fais-toi vérifier.<br />
                <span className="text-[#E63946]">Fais-toi repérer.</span>
              </h1>
              <p className="text-[18px] text-white/75 leading-relaxed mt-6 max-w-[520px]">
                Inscris-toi gratuitement, remplis ton profil avec tes stats et vidéos. Quand ton coach te vérifie, tu passes devant tout le monde.
              </p>
              <p className="text-[15px] text-white/55 mt-4 max-w-[520px]">
                Ton profil. Ta visibilité. La vérification de ton coach fait la différence.
              </p>
              <div className="flex items-center gap-3 mt-9 flex-wrap">
                <Link
                  href="/inscription"
                  className="inline-flex items-center rounded-lg bg-[#E63946] text-white font-bold uppercase tracking-wider hover:bg-[#D42B22] transition-colors"
                  style={{ fontSize: 16, padding: "14px 32px" }}
                >
                  Sois le Nex
                </Link>
                <span className="inline-flex items-center px-3.5 py-1.5 rounded-full bg-[#22C55E]/15 text-[#22C55E] text-[13px] font-bold uppercase tracking-wider">
                  100% gratuit
                </span>
              </div>
            </div>

            <div className="flex justify-center">
              <HeroPlayerCard />
            </div>
          </div>
        </div>
      </section>

      {/* ─── SECTION 2 — STATS TICKER ─────────────────────── */}
      <section id="stats" className="bg-[#0d0f12] border-b border-white/[0.06]">
        <div className="py-14">
          <div className="nx-stats-viewport overflow-hidden">
            <div className="nx-stats-track flex items-center whitespace-nowrap">
              {[...STAT_ITEMS, ...STAT_ITEMS].map((s, i) => (
                <div key={`${s.label}-${i}`} className="text-center shrink-0 px-16 sm:px-24 min-w-[320px] sm:min-w-[360px]">
                  <p className={`font-head text-[64px] sm:text-[80px] font-black leading-none ${s.color}`}>
                    {s.value}
                  </p>
                  <p className="text-[13px] sm:text-[14px] text-white/75 mt-3 leading-snug tracking-wide">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <p className="text-center text-[11px] text-white/55 mt-8">
            Profils vérifiés vs profils incomplets sur Nexus
          </p>
        </div>
        <style>{`
          .nx-stats-track {
            width: max-content;
            animation: nx-stats-scroll 28s linear infinite;
          }
          .nx-stats-viewport:hover .nx-stats-track {
            animation-play-state: paused;
          }
          @keyframes nx-stats-scroll {
            from { transform: translateX(0); }
            to   { transform: translateX(-50%); }
          }
        `}</style>
      </section>

      {/* ─── SECTION 3 — COMMENT ÇA MARCHE ────────────────── */}
      <section id="comment-ca-marche" className="border-b border-white/[0.06]">
        <div className="max-w-[1200px] mx-auto px-6 py-20">
          <div className="max-w-[700px]">
            <RedLabel>Comment ça marche</RedLabel>
            <SectionTitle>3 étapes. Zéro stress.</SectionTitle>
            <p className="text-[14px] text-white/75 leading-relaxed mt-4">
              Tu peux commencer seul. La vérification de ton coach, c&apos;est ce qui te donne l&apos;avantage.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-6 mt-14">
            {HOW_STEPS.map((step, i) => (
              <div
                key={step.n}
                className={`relative pl-6 md:pl-8 py-4 ${
                  i === 0 ? "border-l-[3px] border-[#E63946]/30" : "border-l-[3px] border-white/[0.04]"
                }`}
              >
                <span className="font-head text-[64px] sm:text-[72px] font-black leading-none text-white/[0.08] tracking-tighter block">
                  {step.n}
                </span>
                <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#E63946] mt-5">
                  {step.role}
                </p>
                <h3 className="font-head text-[20px] font-black uppercase text-white tracking-tight mt-2.5">
                  {step.title}
                </h3>
                <p className="text-[14px] text-white/75 leading-relaxed mt-3 max-w-[340px]">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── SECTION 4 — VÉRIFICATION DU COACH (text L, img bleeds R) ─ */}
      <section id="verification" className="border-b border-white/[0.06] overflow-x-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-[35%_65%] gap-10 lg:gap-0 px-6 py-16 lg:px-0 lg:py-24 min-h-[600px] items-center">
          <div className="order-2 lg:order-1 lg:pl-12 lg:pr-8 flex items-center">
            <div className="max-w-[480px]">
              <p className="text-[12px] font-bold tracking-[0.25em] uppercase text-[#E63946]">Vérification du coach</p>
              <h2 className="font-head text-[24px] font-bold text-white leading-tight tracking-tight mt-3">
                La parole de ton coach vaut plus que ton CV.
              </h2>
              <p className="text-[16px] text-white/75 mt-4 leading-relaxed">
                Ton coach t&apos;évalue sur 8 critères — leadership, discipline, coachabilité, intelligence de jeu, compétitivité, esprit d&apos;équipe, résilience, attitude. Son rapport est lu par tous les recruteurs qui consultent ton profil. C&apos;est ton avantage concurrentiel.
              </p>
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <GlowFrame>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/Image/ATH%20Profile.png"
                alt="Profil athlète Nexus vérifié avec évaluation du coach"
                style={{ width: "100%", display: "block", borderRadius: "12px 0 0 12px", border: "1px solid rgba(255,255,255,0.15)", borderRight: "none", boxShadow: "0 40px 100px -20px rgba(0,0,0,0.85)" }}
              />
            </GlowFrame>
          </div>
        </div>
      </section>

      {/* ─── SECTION 5 — TON PROFIL COMPLET (img bleeds L, text R) ─ */}
      <section id="profil" className="border-b border-white/[0.06] overflow-x-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-[65%_35%] gap-10 lg:gap-0 px-6 py-16 lg:px-0 lg:py-24 min-h-[600px] items-center">
          <div>
            <GlowFrame>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/Image/ATH%20School.png"
                alt="Profil académique et vidéos d'un athlète Nexus"
                style={{ width: "100%", display: "block", borderRadius: "0 12px 12px 0", border: "1px solid rgba(255,255,255,0.15)", borderLeft: "none", boxShadow: "0 40px 100px -20px rgba(0,0,0,0.85)" }}
              />
            </GlowFrame>
          </div>
          <div className="lg:pr-12 lg:pl-8 flex items-center">
            <div className="max-w-[480px]">
              <p className="text-[12px] font-bold tracking-[0.25em] uppercase text-[#E63946]">Ton profil complet</p>
              <h2 className="font-head text-[24px] font-bold text-white leading-tight tracking-tight mt-3">
                Tout ce qu&apos;un recruteur a besoin pour t&apos;évaluer.
              </h2>
              <p className="text-[16px] text-white/75 mt-4 leading-relaxed">
                Tes stats, tes vidéos, ton dossier académique, tes mensurations, tes matières fortes — tout au même endroit. Un profil complet est consulté 4x plus qu&apos;un profil à moitié rempli.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SECTION 6 — STATUT DE RECRUTEMENT (text L, mockup R) ─ */}
      <section id="statut" className="border-b border-white/[0.06] overflow-x-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-[35%_65%] gap-10 lg:gap-0 px-6 py-16 lg:px-0 lg:py-24 min-h-[600px] items-center">
          <div className="order-2 lg:order-1 lg:pl-12 lg:pr-8 flex items-center">
            <div className="max-w-[480px]">
              <p className="text-[12px] font-bold tracking-[0.25em] uppercase text-[#E63946]">Statut de recrutement</p>
              <h2 className="font-head text-[24px] font-bold text-white leading-tight tracking-tight mt-3">
                Tu sauras toujours où tu en es.
              </h2>
              <p className="text-[16px] text-white/75 mt-4 leading-relaxed">
                Quand un recruteur te contacte, planifie une visite ou te fait une offre, ton statut se met à jour automatiquement. Plus besoin de deviner où en est ta démarche — tu vois tout en temps réel.
              </p>
            </div>
          </div>
          <div className="order-1 lg:order-2 lg:pr-0">
            <GlowFrame>
              <div className="space-y-5">
                <StatusTrackerMockup />
                <NotificationsMockup />
              </div>
            </GlowFrame>
          </div>
        </div>
      </section>

      {/* ─── SECTION 7 — FONCTIONNALITÉS ──────────────────── */}
      <section id="fonctionnalites" className="border-b border-white/[0.06]">
        <div className="max-w-[1200px] mx-auto px-6 py-20">
          <div className="max-w-[700px]">
            <RedLabel>Fonctionnalités</RedLabel>
            <SectionTitle>Tout ce qu&apos;il te faut pour te faire recruter.</SectionTitle>
            <p className="text-[14px] text-white/75 leading-relaxed mt-4">
              Crée ton profil gratuitement. Débloque les fonctionnalités Pro quand tu es prêt.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-12">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-[#1A1D24] rounded-2xl border border-white/[0.06] p-6">
                <div className="flex items-center justify-between mb-3">
                  <TierPill tier={f.tier} />
                </div>
                <h3 className="font-head text-[16px] font-black text-white">{f.title}</h3>
                <p className="text-[13px] text-white/75 leading-relaxed mt-1.5">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── SECTION 8 — PRIX ─────────────────────────────── */}
      <section id="prix" className="border-b border-white/[0.06]">
        <div className="max-w-[1200px] mx-auto px-6 py-20 text-center">
          <RedLabel>Prix</RedLabel>
          <SectionTitle>100% gratuit pour les athlètes.</SectionTitle>
          <p className="font-head text-[56px] sm:text-[72px] font-black text-[#22C55E] leading-none mt-8">
            0$
          </p>
          <p className="text-[14px] text-white/75 leading-relaxed mt-6 max-w-[500px] mx-auto">
            Pas de frais cachés. Les recruteurs paient pour accéder à la plateforme — pas toi.
          </p>

          <div className="mt-10 flex flex-wrap justify-center gap-4 sm:gap-8">
            {FREE_BULLETS.map((b) => (
              <div key={b} className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#22C55E]/15 flex items-center justify-center text-[#22C55E]">
                  <Check />
                </span>
                <span className="text-[13px] text-white/80">{b}</span>
              </div>
            ))}
          </div>

          <p className="text-[12px] text-white/55 mt-8">
            Envie de savoir <span className="text-white/75">QUI</span> te surveille?{" "}
            <Link href="#fonctionnalites" className="text-[#E63946] hover:underline">
              Pro à 4,99$/mois
            </Link>
            . Demande à tes parents.
          </p>
        </div>
      </section>

      {/* ─── SECTION 9 — SPORTS ───────────────────────────── */}
      <section id="sports" className="border-b border-white/[0.06]">
        <div className="max-w-[1200px] mx-auto px-6 py-20">
          <div className="text-center max-w-[640px] mx-auto">
            <RedLabel>Sports</RedLabel>
            <SectionTitle>Ton sport est sur Nexus.</SectionTitle>
            <p className="text-[15px] text-white/75 leading-relaxed mt-4">
              10 sports principaux, + 6 autres disponibles. Tous reconnus par le RSEQ et compatibles avec les programmes sport-études.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
            {SPORTS.map((s) => (
              <div
                key={s.name}
                className="group relative bg-[#1A1D24] rounded-2xl border border-white/[0.06] p-5 sm:p-6 text-center hover:border-[#E63946]/50 hover:bg-[#1A1D24]/80 transition-all duration-200 hover:-translate-y-0.5"
              >
                <div className="text-[40px] sm:text-[44px] leading-none select-none" aria-hidden="true">
                  {s.emoji}
                </div>
                <p className="font-head text-[14px] sm:text-[15px] font-black uppercase tracking-wide text-white mt-3">
                  {s.name}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 group-hover:text-[#E63946] transition-colors mt-1.5">
                  {s.season}
                </p>
              </div>
            ))}

          </div>

          <p className="text-center text-[13px] text-white/55 mt-8">
            + 6 autres sports disponibles
          </p>
        </div>
      </section>

      {/* ─── SECTION 10 — RESSOURCES ──────────────────────── */}
      <section id="ressources" className="border-b border-white/[0.06]">
        <div className="max-w-[1200px] mx-auto px-6 py-20">
          <div className="max-w-[700px]">
            <RedLabel>Ressources</RedLabel>
            <SectionTitle>Apprends comment te faire recruter.</SectionTitle>
            <p className="text-[14px] text-white/75 leading-relaxed mt-4">
              Le processus de recrutement CÉGEP peut sembler compliqué — calendrier des camps, différences entre divisions, comment approcher les coachs. On a tout expliqué.
            </p>
          </div>

          <Link
            href="/guide-recrutement"
            className="mt-10 block bg-[#1A1D24] rounded-2xl border border-white/[0.06] p-6 sm:p-8 hover:border-[#E63946]/40 transition-colors group"
          >
            <div className="flex items-start gap-5">
              <div className="w-12 h-12 rounded-xl bg-[#E63946]/15 border border-[#E63946]/30 flex items-center justify-center shrink-0">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-head text-[18px] font-black text-white">Guide du recrutement CÉGEP</h3>
                <p className="text-[13px] text-white/75 leading-relaxed mt-2">
                  Camps, divisions, contacts recruteurs, timeline — tout ce que tu dois savoir pour naviguer le processus.
                </p>
                <span className="inline-flex items-center gap-1 mt-3 text-[13px] font-bold text-[#E63946] group-hover:text-[#FF5C58] transition-colors">
                  Lire le guide →
                </span>
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* ─── SECTION 11 — FINAL CTA ───────────────────────── */}
      <section id="cta" className="bg-[#0d0f12] border-t border-white/[0.06]">
        <div className="max-w-[820px] mx-auto px-6 py-28 text-center">
          <span className="inline-block w-10 h-[2px] bg-[#E63946] mb-8" />

          <h2 className="font-head text-[40px] sm:text-[56px] font-black text-white leading-[1.05] tracking-tight">
            Prêt à te faire <span className="text-[#E63946]">repérer</span>?
          </h2>

          <p className="text-[16px] sm:text-[17px] text-white/75 leading-relaxed mt-6 max-w-[560px] mx-auto">
            Crée ton compte. Remplis ton profil. Demande à ton coach de te vérifier.
          </p>

          <div className="mt-10">
            <Link
              href="/inscription"
              className="inline-flex items-center justify-center rounded-lg bg-[#E63946] text-white font-bold uppercase tracking-wider hover:bg-[#D42B22] transition-colors"
              style={{ fontSize: 16, padding: "16px 40px" }}
            >
              Sois le Nex
            </Link>
          </div>

          <div className="mt-6 flex items-center justify-center gap-5 text-[12px] text-white/55">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
              100% gratuit
            </span>
            <span className="w-px h-3 bg-white/15" />
            <span>Inscription en 2 min</span>
          </div>

          <p className="text-[13px] text-white/55 mt-10">
            Pas de coach sur Nexus?{" "}
            <Link href="/pour-les-coachs" className="text-[#E63946] font-semibold hover:underline">
              Envoie-lui ce lien →
            </Link>
          </p>
        </div>
      </section>
      </div>
    </div>
  );
}
