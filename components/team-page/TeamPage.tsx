"use client";

// components/team-page/TeamPage.tsx
// Page équipe (niveau-2) — même archi que program-page (assembleur + CSS scopé)
// et MÊME rythme de section que la page école (72/64, dividers, .sec-in 1180).
// Thème = les 4 couleurs de l'équipe, verbatim (primaire + primaire éclaircie +
// foncée + claire). Pas de dérivation calculée : la teinte claire est un choix
// de design. Aucun filter:brightness() ici.
// #E63946 = PLATEFORME only (CTA cibles) ; vert = engagés/match/complet.

import * as React from "react";
import { DNA_CSS, GrainOverlay } from "@/components/shared/dna";
import { useSchoolTargets } from "@/lib/queries/schoolPage/useSchoolTargets";
import TeamHero from "./TeamHero";
import CalendarSection from "./CalendarSection";
import PresentationSection from "./PresentationSection";
import BesoinsWidget from "./BesoinsWidget";
import DejaEngageesSection from "./DejaEngageesSection";
import type { TeamData } from "./content";

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export default function TeamPage({ team }: { team: TeamData }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [r, g, b] = hexToRgb(team.teamColor);
  const [lr, lg, lb] = hexToRgb(team.teamColorLt);

  // Cibles — un seul état partagé hero ⇄ box besoins (R3). La cible est au
  // niveau ÉCOLE (arbitrage D-1) : depuis une page équipe, on cible le CÉGEP,
  // via le MÊME hook que la page école (insert/delete idempotents, RLS
  // « Athletes manage own targets »).
  // Sans schoolId (fixtures /team-test sans paramètre), rien n'est résolu ni
  // écrit : le bouton garde son bascule visuel local, comme avant.
  const targets = useSchoolTargets(team.schoolId ?? "", 0);
  const [localCible, setLocalCible] = React.useState(false);
  const wired = !!team.schoolId;
  const cible = wired ? targets.inTargets : localCible;
  const toggleCible = React.useCallback(() => {
    if (wired) targets.toggle();
    else setLocalCible((c) => !c);
  }, [wired, targets]);

  // Thème ÉQUIPE — les 4 couleurs de la fixture, verbatim. La primaire éclaircie
  // (--red-lt) est STOCKÉE : tous les accents clairs la lisent directement.
  // Aucun filter:brightness() sur cette page (rendu trop cru — décision produit).
  const rootStyle = {
    "--red": team.teamColor,          // PRIMAIRE
    "--red-lt": team.teamColorLt,     // PRIMAIRE ÉCLAIRCIE — accents/texte clair
    "--ink": team.teamColorDark,      // FONCÉE ⚠ pas l'encre texte (cf. --p-ink)
    "--cream": team.teamColorNeutral, // CLAIRE / crème
    // ── coquille Nexus (fixe) — identique à .pp
    "--bg": "#111317",
    "--card": "#1A1D24",
    "--card-deep": "#12151C", // carte enfoncée (= .pp .mcard / .match-empty)
    "--line": "#1E2129",      // divider de section
    "--line-card": "#262A33", // bordure de carte (l'école a bien 2 crans)
    // Plaques du terrain — neutres propres au widget besoins (aucun équivalent
    // école : elles vivent sur une plaque BLANCHE, pas sur la coquille sombre).
    "--gold-ink": "#8F6A15",       // « besoin moyen » sur plaque blanche
    "--plaque-off": "#20262F",     // plaque « complet » (poste pourvu)
    "--plaque-off-ink": "#5C6575",
    "--plaque-off-mut": "#4C5462",
    // ── rampe TEXTE — identique à .pp
    "--p-ink": "#EDEFF3",
    "--p-soft": "#C9CCD4",
    "--p-mut": "#8A909C",
    "--p-inv": "#15171B",     // texte foncé sur surface claire
    "--p-mut-inv": "#6B7280", // méta foncée sur surface claire (tuiles calendrier)
    // ── moments PLATEFORME (rouge Nexus) — seul usage : le CTA cibles
    "--nx-red": "#E63946",
    "--nx-red-deep": "#B32330", // état actif du CTA cibles
    "--green": "#22C55E",       // engagés / match / complet (règle système)
    "--pop": "cubic-bezier(0.34,1.56,0.64,1)",
    // Teintes rgba (calculées en JS → pas de color-mix).
    "--red-tint-bg": `rgba(${r},${g},${b},0.15)`,
    "--red-tint-bd": `rgba(${r},${g},${b},0.38)`,
    "--red-lt-55": `rgba(${lr},${lg},${lb},0.55)`, // anneau plaque « besoin élevé »
    "--red-fall": `rgba(${r},${g},${b},0.32)`,     // fallback hero sans photo
    // Contrat ADN partagé (shared/dna) — la marque = la primaire équipe.
    "--dna-mark": team.teamColor,
    "--dna-ink": "#EDEFF3",
    // Point focal du crop hero — par image. Défaut : haut de cadre (sujets debout).
    "--hero-focal": team.heroFocal ?? "50% 25%",
    // Zoom du cadrage (éditeur) : facteur d'échelle appliqué à la photo, centré
    // sur le point focal. 100 % → 1 (aucune transformation).
    "--hero-zoom": String(Math.max(100, team.heroZoom ?? 100) / 100),
  } as React.CSSProperties;

  // Reveals opacity-only (au-dessus de la ligne de flottaison → visibles direct).
  React.useEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion:reduce)").matches) return; // CSS montre .rv plein
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }),
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" },
    );
    root.querySelectorAll<HTMLElement>(".rv").forEach((el) => {
      if (el.getBoundingClientRect().top < window.innerHeight * 0.95) el.classList.add("in");
      else io.observe(el);
    });
    return () => io.disconnect();
  }, [team.id]);

  return (
    <div className="tp nx-dna" ref={ref} style={rootStyle}>
      <style dangerouslySetInnerHTML={{ __html: DNA_CSS + TP_CSS }} />
      <GrainOverlay id="tpg" />
      <div className="rv">
        <TeamHero team={team} cible={cible} onToggleCible={toggleCible} />
      </div>
      <CalendarSection team={team} />
      <PresentationSection team={team} />
      {/* Besoins : seule section qui ne se vide pas d'elle-même (le terrain se
          rend même sans donnée) → la visibilité se décide ici. */}
      {!(team.hiddenSections ?? []).includes("besoins") && (
        <BesoinsWidget team={team} cible={cible} onToggleCible={toggleCible} />
      )}
      <DejaEngageesSection team={team} />
    </div>
  );
}

/* ── CSS scopé (.tp) — team-hero-A-final + besoins-widget-final, verbatim ────
   Exporté : l'éditeur « Page équipe » l'injecte une fois pour ses previews
   (mêmes composants, même feuille — aucun style dupliqué). */
export const TP_CSS = `
.tp{background:var(--bg);color:var(--p-ink);font-family:'Outfit',sans-serif;padding:24px 0 0;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility}
/* ── RYTHME DE SECTION — porté 1:1 de la page école (.pp section / .pp .sec-in).
   Section pleine largeur + divider bas, contenu contraint à 1180px. Les fantômes
   ADN sont enfants directs de la section (comme .pp), le contenu vit dans .sec-in. */
.tp .pagewrap{max-width:1500px;margin:0 auto;position:relative}
.tp section{position:relative;z-index:2;padding:72px 26px 64px;border-bottom:1px solid var(--line);overflow:hidden}
.tp .sec-in{max-width:1180px;margin:0 auto;position:relative;z-index:2}
/* Accents de titre = la PRIMAIRE de l'équipe, pas sa version éclaircie : toute
   variante claire d'un rouge d'école converge vers le rouge Nexus (#D8394C en
   est à 15 unités RGB) et le titre se lit alors comme un élément plateforme. */
.tp .kick{font-family:'Bebas Neue';letter-spacing:.34em;font-size:14px;color:var(--red)}
.tp .h2{font-family:'Anton';font-size:clamp(30px,3.6vw,46px);text-transform:uppercase;color:var(--p-ink);margin:6px 0 4px;line-height:1.02}
.tp .h2 em{font-style:normal;color:var(--red)}
.tp .lead{font-family:'Outfit';font-size:16px;line-height:1.65;color:var(--p-soft);max-width:640px}
/* reveals opacity-only */
.tp .rv{opacity:0;transition:opacity .5s ease}
.tp .rv.in{opacity:1}
@media(prefers-reduced-motion:reduce){.tp .rv{opacity:1;transition:none}}

/* ── HERO v2 « full-bleed Texas » ──────────────────────────────────────
   Plus de carte : pleine largeur viewport, image = fond, fade left→right vers
   le sombre où vit le contenu (colonne droite). Sans photo → fallback thémé. */
/* hauteur : 560px = la cible design, conservée telle quelle dès que la fenêtre
   fait ≥560px (donc sur tout écran normal — aucun changement de layout). Sur
   fenêtre COURTE le hero se contente de la hauteur dispo au lieu de déborder,
   avec un plancher à 480px = le bloc titre+stats+CTA (369px) + ses paddings. */
.tp .hero{position:relative;width:100vw;margin-left:calc(50% - 50vw);margin-top:-24px;height:clamp(480px, 100vh, 560px);overflow:hidden;background:var(--bg)}
/* fallback thémé (couleur école) — visible quand pas de photo (.nophoto) */
.tp .hero-fallback{position:absolute;inset:0;z-index:0;background:radial-gradient(95% 130% at 12% 38%, var(--red-fall), transparent 58%),linear-gradient(90deg,#15181e,#111317 62%)}
/* photo de fond — point focal PAR IMAGE (--hero-focal, défaut haut de cadre).
   Le hero est très large (≈2.6:1) : en mode cover le débord est quasi toujours
   VERTICAL, donc c'est la composante Y du focal qui fait le travail.
   AUCUN filtre : la source est déjà pauvre, on ne la dégrade pas davantage.
   image-rendering laissé sur auto (le seul correct pour une photo).
   LARGEUR 66% (desktop) : au-delà de 61% le fade est OPAQUE — la photo n'y est
   pas visible. La contraindre à la zone réellement vue divise l'upscale par ~1.5
   (3.22× → 2.13×) sans changer d'un pixel ce que l'œil voit. */
/* object-position = le point visé ; transform-origin = le MÊME point, pour que
   le zoom agrandisse autour du sujet et non autour du centre du cadre. */
.tp .hero-bg{position:absolute;inset:0 auto 0 0;z-index:1;width:66%;height:100%;object-fit:cover;object-position:var(--hero-focal, 50% 25%);transform:scale(var(--hero-zoom, 1));transform-origin:var(--hero-focal, 50% 25%)}
.tp .hero.nophoto .hero-bg{display:none}
/* fade Texas COMPLET : image ~60% → fondu total vers un aplat OPAQUE #111317
   (aucune photo sous le texte) + fade bas sans couture vers le fond de page */
.tp .hero-fade{position:absolute;inset:0;z-index:2;pointer-events:none;background:linear-gradient(90deg, transparent 34%, rgba(17,19,23,.5) 48%, rgba(17,19,23,.95) 56%, #111317 61%),linear-gradient(0deg, #111317 0%, transparent 22%)}
.tp .accent{position:absolute;top:0;bottom:0;left:0;width:6px;z-index:6;background:var(--red)}
.tp .accent::after{content:"";position:absolute;top:0;bottom:0;left:6px;width:2px;background:rgba(255,255,255,.85)}
.tp .logo{position:absolute;top:26px;left:32px;z-index:6;width:58px;height:58px;border-radius:13px;background:var(--red);display:flex;align-items:center;justify-content:center;font-family:'Outfit';font-weight:800;font-size:26px;color:#fff;box-shadow:0 10px 26px -12px rgba(0,0,0,.7)}
/* crest réel — pas de fond ni cadre, le logo se suffit */
.tp .logo-img{position:absolute;top:24px;left:30px;z-index:6;width:64px;height:64px;object-fit:contain;filter:drop-shadow(0 6px 14px rgba(0,0,0,.55))}
.tp .soc{position:absolute;left:34px;bottom:28px;z-index:6;display:flex;align-items:center;gap:18px}
/* contenu — colonne à droite, posée SUR le fade (plus de panneau séparé) */
.tp .pnl{position:absolute;top:0;bottom:0;right:0;z-index:4;width:40%;min-width:400px;padding:48px 5vw 48px 40px;display:flex;flex-direction:column;justify-content:center;gap:20px}
.tp .eyebrow{font-family:'Bebas Neue';letter-spacing:.34em;font-size:14px;color:var(--red)}
.tp .name{font-family:'Anton';font-size:clamp(40px,4.6vw,64px);line-height:.94;text-transform:uppercase;text-shadow:0 2px 20px rgba(0,0,0,.5)}
.tp .meta{display:flex;gap:8px;flex-wrap:wrap}
.tp .chip{font-family:'Outfit';font-weight:700;font-size:13px;letter-spacing:.04em;padding:7px 15px;border-radius:99px}
.tp .chip.solid{background:var(--red);color:var(--cream)}
.tp .chip.out{border:1.5px solid rgba(255,255,255,.45);color:#fff;background:rgba(255,255,255,.06)}
.tp .stats{display:flex;gap:34px;flex-wrap:wrap;padding-top:4px}
.tp .stat .v{font-family:'Anton';font-size:clamp(26px,2.4vw,34px);line-height:1;color:var(--p-ink)}
.tp .stat .v em{color:var(--red);font-style:normal}
/* stat « personne » — un nom n'est ni un titre ni un chiffre → hors Anton (Outfit) */
.tp .stat.pers .v{font-family:'Outfit';font-weight:700;font-size:clamp(19px,1.6vw,23px);line-height:1.15;letter-spacing:-.01em}
.tp .stat .l{font-family:'Outfit';font-weight:600;font-size:12px;letter-spacing:.08em;color:var(--p-mut);text-transform:uppercase;margin-top:8px}
.tp .cibles{display:inline-flex;align-items:center;gap:9px;font-family:'Outfit';font-weight:700;font-size:14px;background:var(--nx-red);color:#fff;border:0;border-radius:12px;padding:13px 22px;cursor:pointer;box-shadow:0 8px 22px -10px rgba(230,57,70,.7);align-self:flex-start;transition:transform .25s cubic-bezier(0.34,1.56,0.64,1)}
.tp .cibles:hover{transform:translateY(-2px)}
/* laptop : colonne un peu plus large */
@media(max-width:1200px){.tp .pnl{width:46%;padding:44px 44px 44px 40px}}
/* mobile : image plein cadre, contenu en bas sur un fade vertical */
@media(max-width:820px){
  .tp .hero{height:clamp(420px, 100vh, 480px)}
  /* mobile : fade VERTICAL → la photo doit remplir le cadre (pas de zone masquée
     à droite), donc on rend la largeur complète. */
  .tp .hero-bg{inset:0;width:100%}
  .tp .hero-fade{background:linear-gradient(0deg, rgba(17,19,23,.95) 0%, rgba(17,19,23,.55) 34%, transparent 68%),linear-gradient(90deg, rgba(17,19,23,.35), transparent 60%)}
  .tp .pnl{position:absolute;top:auto;right:0;left:0;bottom:0;width:100%;min-width:0;justify-content:flex-end;padding:32px 26px 30px 34px;gap:16px}
  .tp .name{font-size:clamp(36px,10vw,52px)}
  .tp .stats{gap:22px}
}

/* ── SECTION CALENDRIER (entre hero et présentation) — sans boîte ──────────── */
.tp .cal-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:20px}
.tp .cara-nav{display:flex;gap:8px}
.tp .cara-nav button{width:40px;height:40px;border-radius:10px;border:1.5px solid var(--line-card);background:var(--card);color:var(--p-ink);font-size:20px;line-height:1;cursor:pointer;transition:transform .2s var(--pop),border-color .2s}
/* hover : teinte ÉQUIPE (le rouge Nexus est réservé au CTA cibles) */
.tp .cara-nav button:hover{transform:translateY(-2px);border-color:var(--red-lt)}
/* fade de bord = mask SUR le conteneur (jamais un overlay sur les tuiles §6) */
.tp .cal-row{display:flex;gap:14px;overflow-x:auto;scroll-snap-type:x mandatory;padding:4px 2px 16px;scrollbar-width:thin;-webkit-mask-image:linear-gradient(90deg, transparent 0, #000 10px, #000 calc(100% - 30px), transparent 100%);mask-image:linear-gradient(90deg, transparent 0, #000 10px, #000 calc(100% - 30px), transparent 100%)}
.tp .cal-row::-webkit-scrollbar{height:6px}
.tp .cal-row::-webkit-scrollbar-thumb{background:var(--line-card);border-radius:3px}
.tp .ev{flex:0 0 auto;width:210px;scroll-snap-align:start;border-radius:14px;padding:18px;display:flex;flex-direction:column}
.tp .ev.match.past{opacity:.5}
.tp .ev-date{display:flex;align-items:baseline;gap:8px;margin-bottom:12px}
.tp .ev-date .d{font-family:'Anton';font-size:40px;line-height:.9}
.tp .ev-date .m{font-family:'Outfit';font-weight:700;font-size:13px;letter-spacing:.08em;text-transform:uppercase}
.tp .ev-vs{font-family:'Outfit';font-weight:700;font-size:16px}
.tp .ev-meta{font-family:'Outfit';font-weight:500;font-size:14.5px;margin-top:6px}
/* score d'un match JOUÉ (public.games) — remplace l'heure/lieu sur la tuile */
.tp .ev-score{font-family:'Anton';font-size:22px;letter-spacing:.02em;margin-top:6px;color:var(--p-inv)}
.tp .ev.match.home .ev-score{color:var(--p-ink)}
.tp .ev-score.w{color:var(--green)}
.tp .ev-score.l{color:var(--p-mut)}
/* match EXTÉRIEUR = tuile CLAIRE (texte foncé) — défaut */
.tp .ev.match.away{background:var(--cream);color:var(--p-inv)}
.tp .ev.match.away .ev-date .d{color:var(--p-inv)}
.tp .ev.match.away .ev-date .m{color:var(--p-mut-inv)}
.tp .ev.match.away .ev-vs{color:var(--p-inv)}
.tp .ev.match.away .ev-meta{color:var(--p-mut-inv)}
/* match DOMICILE = tuile FONCÉE (texte clair) */
.tp .ev.match.home{background:var(--ink);color:var(--cream)}
.tp .ev.match.home .ev-date .d{color:var(--cream)}
.tp .ev.match.home .ev-date .m{color:rgba(237,239,243,.7)}
.tp .ev.match.home .ev-vs{color:var(--cream)}
.tp .ev.match.home .ev-meta{color:rgba(237,239,243,.66)}
/* camp de sélection — événement spécial : couleur primaire école, texte crème */
.tp .ev.camp{width:224px;background:linear-gradient(150deg, var(--red), var(--ink));color:var(--cream)}
/* L'intitulé est libre (≤40 car.) : deux lignes max, ellipse au-delà, et
   overflow-wrap anywhere pour qu'un mot très long casse au lieu de déborder. */
.tp .ev.camp .ev-tag{font-family:'Outfit';font-weight:800;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--cream);opacity:.92;margin-bottom:10px;
  line-height:1.25;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;overflow-wrap:anywhere}
.tp .ev.camp .ev-date .d{color:var(--cream)}
.tp .ev.camp .ev-date .m{color:var(--cream);opacity:.85}
.tp .ev.camp .ev-lieu{font-family:'Outfit';font-weight:700;font-size:15px;color:var(--cream);line-height:1.35;margin-top:2px}

/* ── SECTION PRÉSENTATION — mot fantôme + craie playbook → ADN PARTAGÉ ──────── */
.tp .p-head{margin-bottom:22px}
.tp .p-cols{position:relative;z-index:1;display:grid;grid-template-columns:1.12fr 1fr;gap:52px;align-items:start}
/* colonne droite décalée de la hauteur du kick → la photo s'aligne avec le titre (§1) */
.tp .p-right{margin-top:24px}
.tp .p-stats{margin-top:28px}
/* fanions de palmarès — bannières triangulaires suspendues (clip-path, statique) */
.tp .pennants{margin-top:34px;max-width:520px}
.tp .pen-string{height:2px;background:linear-gradient(90deg, transparent, var(--ink) 8% 92%, transparent)}
.tp .pen-row{display:flex;gap:14px;flex-wrap:wrap;padding-top:0}
.tp .pennant{width:96px;padding:11px 8px 20px;text-align:center;color:var(--cream);clip-path:polygon(0 0,100% 0,100% 74%,50% 100%,0 74%);box-shadow:0 8px 16px -10px rgba(0,0,0,.7)}
/* 3 habits, une seule forme : le TYPE pilote la couleur (contrat éditeur). */
.tp .pennant.championnat{background:var(--red)}
.tp .pennant.coupe{background:var(--ink);border:1px solid rgba(237,239,243,.14)}
/* bannière « retirée au plafond » : rectangle sombre à liseré, pas de pointe */
.tp .pennant.banniere{background:#14171D;border:1.5px solid var(--red);color:var(--p-ink);clip-path:none;border-radius:6px;padding:12px 10px}
.tp .pen-t{display:block;font-family:'Outfit';font-weight:800;font-size:12px;letter-spacing:.06em;line-height:1.15}
.tp .pen-y{display:block;font-family:'Anton';font-size:20px;margin-top:4px}
/* staff — colonne droite */
.tp .cphoto{position:relative;width:100%;aspect-ratio:16/10;border-radius:14px;overflow:hidden;background:linear-gradient(140deg, var(--red-tint-bg), var(--card-deep) 74%)}
.tp .cphoto img{width:100%;height:100%;object-fit:cover;filter:saturate(.9) contrast(1.03)}
.tp .cph-tag{position:absolute;top:12px;left:14px;font-family:'Outfit';font-weight:600;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:rgba(237,239,243,.32)}
.tp .cname{font-family:'Outfit';font-weight:700;font-size:19px;color:var(--p-ink);margin-top:14px}
.tp .crole{font-family:'Outfit';font-weight:600;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--red);margin-top:3px}
.tp .cbio{font-family:'Outfit';font-weight:400;font-size:14.5px;line-height:1.6;color:var(--p-soft);margin-top:11px;max-width:440px}
.tp .sList{display:flex;flex-direction:column;border-top:1px solid var(--line);margin-top:24px}
.tp .sRow{display:flex;align-items:baseline;justify-content:space-between;gap:16px;border-bottom:1px solid var(--line);padding:14px 4px}
.tp .sName{font-family:'Outfit';font-weight:600;font-size:14.5px;color:var(--p-ink)}
.tp .sRole{font-family:'Outfit';font-weight:500;font-size:13.5px;color:var(--p-mut);text-align:right}
@media(max-width:820px){.tp .p-cols{grid-template-columns:1fr;gap:34px}.tp .p-right{margin-top:0}}

/* ── SECTION DÉJÀ ENGAGÉES (sous le widget) — rangées sobres, sans boîte ─────── */
.tp .engaged .p-head{margin-bottom:20px}
.tp .eList{max-width:760px;margin-top:0}
.tp .eRow{align-items:center}
.tp .e-id{display:flex;flex-direction:column;gap:3px}
.tp .e-school{font-family:'Outfit';font-weight:500;font-size:14.5px;color:var(--p-mut)}
.tp .e-meta{display:flex;align-items:center;gap:16px}
.tp .e-promo{font-family:'Outfit';font-weight:600;font-size:12px;letter-spacing:.03em;color:var(--red-lt);border:1px solid var(--red-tint-bd);background:var(--red-tint-bg);padding:4px 11px;border-radius:99px;white-space:nowrap}
@media(max-width:820px){.tp .eRow{flex-wrap:wrap;gap:10px}.tp .e-meta{width:100%;justify-content:space-between}}

/* ── WIDGET BESOINS ────────────────────────────────────────────────── */
/* mots du mur (§C5) + craie playbook → ADN PARTAGÉ (shared/dna) : le vocabulaire
   et les 5 densités vivent dans wallWordGhosts(), alimentées par team.wallWords.
   .kick / .h2 : voir le bloc RYTHME DE SECTION en tête (voix école, une seule fois). */
.tp .top{position:relative;z-index:2;display:flex;align-items:flex-end;justify-content:space-between;gap:18px;flex-wrap:wrap;margin-bottom:8px}
.tp .commit{font-weight:600;font-size:14px;color:var(--green);white-space:nowrap;padding-bottom:6px}
/* compteur cliquable → ancre vers la section « Déjà engagées » (§9) */
.tp .commit-link{cursor:pointer;border:0;background:transparent;font-family:'Outfit';padding:0 0 6px}
.tp .commit-link:hover{text-decoration:underline}
.tp .toggle{position:relative;z-index:2;display:inline-flex;background:var(--card);border:1.5px solid var(--line-card);border-radius:12px;padding:4px;gap:4px;margin:16px 0 22px}
.tp .toggle button{font-family:'Outfit';font-weight:700;font-size:15px;letter-spacing:.02em;color:var(--p-mut);background:transparent;border:0;border-radius:9px;padding:12px 26px;cursor:pointer;transition:color .2s,background .2s}
.tp .toggle button.on{background:var(--red);color:var(--cream)}
/* ── SCÈNE TERRAIN (photo inclinée sur .scene, plaques 2D plates) ── */
.tp .stage{position:relative;height:430px;overflow:hidden;z-index:1}
.tp .scene{position:absolute;inset:-26% -20% -4% -20%;perspective:840px;overflow:hidden}
.tp .scene .imgwrap{position:absolute;left:50%;bottom:-14%;width:76%;transform:translateX(-50%) rotateX(44deg);transform-origin:50% 100%}
.tp .scene.flat .imgwrap{position:absolute;left:50%;top:4%;bottom:auto;width:62%;transform:translateX(-50%)}
.tp .scene img{display:block;width:100%;filter:saturate(.66) brightness(.92) contrast(1.05)}
/* baseball : photo sombre/délavée → éclaircir + resserrer sur le losange (§1) */
.tp .scene img.baseball{filter:saturate(.92) brightness(1.28) contrast(1.14);transform:scale(1.34) translateY(2%);transform-origin:50% 42%}
.tp .scene .imgwrap .ph{display:block;width:100%;aspect-ratio:16/9;background:radial-gradient(130% 100% at 50% 24%, #444d5e, #262d3a 72%)}
.tp .scene .imgwrap .court{display:block;width:100%;aspect-ratio:16/9}
.tp .scene .tint{position:absolute;inset:0;background:linear-gradient(180deg, rgba(17,19,23,.35), rgba(17,19,23,.08) 45%, rgba(17,19,23,.4)),radial-gradient(70% 55% at 50% 40%, transparent 35%, rgba(17,19,23,.55) 100%)}
.tp .fade{position:absolute;inset:0;pointer-events:none;background:radial-gradient(66% 56% at 50% 46%, transparent 20%, #111317 95%),linear-gradient(#111317, transparent 14% 86%, #111317),linear-gradient(90deg,#111317, transparent 12% 88%, #111317)}
.tp .glow{position:absolute;inset:0;pointer-events:none;background:radial-gradient(44% 28% at 50% 36%, rgba(255,255,255,.06), transparent 70%)}
.tp .tokens{position:absolute;inset:0}
.tp .tk{position:absolute;transform:translate(-50%,-50%);transition:transform .2s var(--pop)}
.tp .tk:hover{transform:translate(-50%,-50%) scale(1.06);z-index:9}
.tp .tk .pl{background:#fff;border-radius:9px;padding:10px 18px;text-align:center;box-shadow:0 12px 24px -8px rgba(0,0,0,.8)}
.tp .tk .pa{font-family:'Anton';font-size:24px;line-height:1;letter-spacing:.02em;color:var(--red);white-space:nowrap}
.tp .tk .po{font-family:'Outfit';font-weight:800;font-size:17px;color:var(--p-inv);line-height:1;white-space:nowrap}
/* avec initiales : le nom du groupe passe en sous-titre (l'acronyme porte la plaque) */
.tp .tk .pa+.po{font-size:12.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;margin-top:4px}
.tp .tk .pn{font-family:'Outfit';font-weight:700;font-size:12px;letter-spacing:.07em;text-transform:uppercase;margin-top:3px;white-space:nowrap}
/* ── ÉCHELLE DES NIVEAUX — lisible en une demi-seconde, de loin ──────────────
   COMPLET = éteint · MOYEN = neutre clair · ÉLEVÉ = ambre · URGENT = rouge
   Nexus (bordure épaisse + halo). C'est une échelle de PLATEFORME : elle ne
   suit pas la couleur de l'école, sinon deux collèges ne se comparent plus. */
.tp .tk.pri{z-index:6}
.tp .tk.pri .pl{box-shadow:0 0 0 3px var(--nx-red),0 0 22px -2px rgba(230,57,70,.55),0 12px 24px -8px rgba(0,0,0,.8)}
.tp .tk.pri .pa{color:var(--nx-red)}
.tp .tk.pri .pn{color:var(--nx-red);font-weight:800;letter-spacing:.09em}
.tp .tk.hi .pl{box-shadow:0 0 0 2.5px #F59E0B,0 0 14px -4px rgba(245,158,11,.45),0 12px 24px -8px rgba(0,0,0,.8)}
.tp .tk.hi .pa{color:#B4770B}
.tp .tk.hi .pn{color:#B4770B;font-weight:800}
.tp .tk.mid .pl{box-shadow:0 0 0 1.5px #B6BCC7,0 12px 24px -8px rgba(0,0,0,.8)}
.tp .tk.mid .pa{color:var(--p-inv)}
.tp .tk.mid .pn{color:var(--p-mut-inv)}
.tp .tk.full .pl{background:var(--plaque-off);box-shadow:0 8px 18px -8px rgba(0,0,0,.8);opacity:.82}
.tp .tk.full .po{color:var(--plaque-off-ink)}
.tp .tk.full .pa{color:var(--plaque-off-ink)}
.tp .tk.full .pn{color:var(--plaque-off-mut)}
/* warning « sans année » — texte discret sous le terrain (§A1) */
.tp .noyear{position:relative;z-index:1;margin-top:10px;font-family:'Outfit';font-weight:500;font-size:14.5px;color:var(--p-mut)}
/* BOX UNIQUE besoins (§A2) — double état, plus grande. Bordure verte = match,
   bordure neutre = sans match. Pattern match académique page école. */
/* fond OPAQUE (#12151C) sur les 2 états — rien ne transparaît derrière le texte */
.tp .needbox{position:relative;z-index:1;margin-top:20px;border-radius:12px;padding:22px 26px;background:var(--card-deep)}
.tp .needbox.match{border:1.5px solid var(--green)}
.tp .needbox.none{border:1.5px solid var(--line-card)}
/* intensité du bandeau selon le NIVEAU saisi (besoin moyen → urgent). Le vert
   reste la couleur du match ; seuls le halo et l'épaisseur montent. */
.tp .needbox.match.nb-hi{box-shadow:0 0 0 1px rgba(34,197,94,.28)}
.tp .needbox.match.nb-pri{border-width:2px;box-shadow:0 0 0 2px rgba(34,197,94,.34),0 10px 26px -14px rgba(34,197,94,.5)}
.tp .needbox .nb-l{font-family:'Outfit';font-weight:700;font-size:17px;line-height:1.45;color:var(--p-ink);max-width:660px}
.tp .needbox.match .nb-l b{color:var(--green);font-weight:800}
.tp .needbox .nb-s{font-family:'Outfit';font-weight:500;font-size:14px;color:var(--p-mut);margin-top:6px}
.tp .needbox.none .cibles.sm{margin-top:16px}
/* variante compacte du bouton cibles (dans la box) + état actif partagé */
.tp .cibles.sm{font-size:14px;padding:11px 18px;border-radius:11px}
.tp .cibles.on{background:var(--nx-red-deep);box-shadow:0 8px 22px -12px rgba(230,57,70,.6)}
@media(max-width:720px){.tp section{padding:44px 20px 40px}.tp .stage{height:360px}.tp .needbox{padding:16px 18px}.tp .needbox .nb-l{font-size:15px}}
`;
