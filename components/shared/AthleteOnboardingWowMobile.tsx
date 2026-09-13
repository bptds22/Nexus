"use client";

/* ═══════════════════════════════════════════════════════════════
   AthleteOnboardingWowMobile — iter 7.50-b3-fix3

   Écran "WOW" plein écran, déclenché par AthleteOnboardingMobile
   APRÈS la fin du submit (toutes les writes réussies). Le WOW
   n'écrit RIEN en DB — étoiles/badges/pipeline sont showcase.

   Refonte sprint b3-fix3 :
   - Respiration : marges généreuses, rien ne colle.
   - Pipeline = UNE pill qui MORPHE (titre + couleur gris→rouge),
     pas un stepper à 6 dots.
   - Foil/holographique : sweep diagonal à l'entrée + shimmer
     continu subtil (overlay au-dessus de la carte, clip 10px).
   - Tilt 3D gyroscope (DeviceOrientation web API — pas de plugin).
     Fallback auto-tilt CSS si pas de capteur.
   - Anticipation "assemblage" : 3 coches "Ton sport ✓ → Ton équipe
     ✓ → Ton profil ✓" puis la carte se forme.
   - Choré haptique fine : Medium card, Medium verified, Light
     étoile, Light tick pill, Success final, Medium CTA.
   - Captions intermédiaires retirées (seul texte = afterglow).
   - Transition de sortie : voile #111317 anti-flash avant
     router.replace côté parent.

   Aucun bouton "Passer" — le WOW se joue en entier.
   AthletePlayerCard / DistinctionBadge inchangés (overlays
   externes).
═══════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AthleteProfileRecruiterView } from "@/lib/types/models";
import AthletePlayerCard from "@/components/shared/AthletePlayerCard";
import DistinctionBadge from "@/components/shared/DistinctionBadge";
import { triggerHaptic } from "@/lib/haptics";

/* ── Constantes showcase ─────────────────────────────────────── */

/* QUATRE badges, et des codes de CATALOGUE — pas des codes hérités.

   Avant : captain / progression / allstar. Trois déclarés, DEUX affichés :
   « progression » n'a aucun équivalent au catalogue des 22, DistinctionBadge
   rendait null et le signalait dans la console. Le troisième manquait donc
   en silence depuis toujours.

   Les codes hérités (captain, allstar) passaient par LEGACY_BADGE_TO_CATALOGUE
   avant d'être dessinés. On écrit désormais les codes du catalogue directement :
   un aller-retour de moins, et plus de risque qu'un code sans correspondance
   s'installe sans qu'on le voie.

   La séquence raconte une progression plutôt qu'un tas : le leadership, puis
   l'explosivité, puis l'intelligence de jeu — qui dit que Nexus ne mesure pas
   que le physique — et la consécration en bouquet final. */
/* CINQ badges, en crescendo — et c'est de l'aspirationnel ASSUMÉ.

   Les étoiles restent pleines elles aussi — décision BP du 2026-09-11, qui
   REMPLACE la redescente à vide de la veille. La carte entière est une
   projection : 5/5 et cinq distinctions, c'est la démo de ce à quoi ça
   ressemble quand tout est là. Elle ne devient pas honnête en se démentant,
   elle le devient en se NOMMANT — le défilé des badges nommés, et la ligne
   « Ton entraîneur t'évaluera » affichée en permanence sous la rangée.

   La séquence monte : le brassard, la vitesse, la tête, la sélection —
   puis nexus-x, le badge maison, en bouquet. Chacune dit une facette
   différente, pour qu'un jeune se reconnaisse dans au moins une.

   Codes de CATALOGUE, jamais de codes hérités : un code sans équivalent
   se rend en `null` sans bruit, et c'est comme ça qu'un des trois badges
   d'origine manquait depuis toujours.

   ⚠️ LE LIBELLÉ EST OBLIGATOIRE ICI, et c'est le même piège d'un cran plus
   loin : BADGE_CONFIG ne connaît que les codes HÉRITÉS. Un code de catalogue
   arrivant sans sa prop `libelle` tombe sur le second garde de
   DistinctionBadge (`!config && !libelle`) et se rend en `null` — les cinq
   badges auraient disparu d'un coup, en silence. Les libellés viennent de
   public.badges, relevés le 2026-09-10.

   Depuis le « défilé », le libellé est AFFICHÉ — le badge arrive seul au
   centre en `lg` et se nomme. Il disparaît au rangement : la vignette `xs`
   de la rangée ne rend aucun libellé (DistinctionBadge:246). Raison de plus
   pour ne pas les inventer. */
const SHOWCASE_BADGES: { badge: string; libelle: string }[] = [
  { badge: "capitaine",      libelle: "Leadership" },        // universel
  { badge: "fusee",          libelle: "Explosif" },          // sport — le physique
  { badge: "qi",             libelle: "IQ" },                // universel — la tête
  { badge: "equipe-etoiles", libelle: "Équipe d'étoiles" },  // honneur — la sélection
  { badge: "mvp",            libelle: "MVP" },               // honneur — le bouquet
];

// Pill labels — repris verbatim du brief b3-fix3 (override des shortLabel
// de RECRUITMENT_STATUSES qui afficheraient "Discussion" / "Visite" un peu
// trop télégraphiques pour le WOW).
const PILL_LABELS = [
  "Identifié",
  "Contacté",
  "En discussion",
  "En visite",
  "Engagé",
  "Lettre signée",
];

/* ── Timing (ms) ─────────────────────────────────────────────── */

const T_ACT1_DURATION    = 2700; // anticipation (re-fetch tourne en // )
const T_CARD_ENTER       = 700;  // scale-in bouncy
const T_VERIFIED_DELAY   = 250;  // pause après scale-in avant Vérifié
const T_STARS_LEAD       = 320;  // pause après Vérifié avant 1ère étoile
const T_STAR_GAP         = 420;  // cadence étoile
const T_BADGES_DELAY     = 300;  // après dernière étoile

/* ── ACTE 2, « le défilé » ───────────────────────────────────────────────
   Les cinq badges arrivaient ENSEMBLE, décalés de 130 ms : 940 ms pour les
   cinq, ce qui se lit comme une volée, pas comme cinq arrivées. Et surtout
   ils arrivaient en `sm` (96 px de cellule) sur une rangée à gouttière 20 :
       5 × 96 + 4 × 20 = 560 px
   pour 411 px d'écran utile sur l'émulateur (1080 / densité 420), 360 px sur
   le plus étroit visé. La racine est en `overflow-hidden` : les badges 1 et 5
   n'étaient pas serrés, ils étaient COUPÉS — il en restait 6 px et 5 px.
   Régression introduite en passant de 3 à 5 badges (à 3 : 328 px, ça tenait).

   Désormais : un badge arrive SEUL au centre, en `lg`, avec son nom, il
   claque, puis il se range dans une rangée `xs`.
       5 × 28 + 4 × 12 = 188 px   ≤ 328 px (écran 360)  et  ≤ 379 px (écran 411)
   Le badge central en `lg` fait 110 px, qui tient aussi sur 360. */
const T_BADGE_CADENCE    = 700;  // un badge toutes les 700 ms — CALÉ SUR
                                 // T_PILL_GAP, la cadence des statuts de
                                 // recrutement qui suivent. Le défilé et la
                                 // pipeline battent désormais la MÊME mesure :
                                 // à 340 ms les badges passaient deux fois plus
                                 // vite que ce qui les suit, et la chorégraphie
                                 // se lisait comme deux séquences sans rapport.
const T_BADGE_SETTLE     = 520;  // temps passé au centre avant de descendre.
                                 // Suit la cadence (260/340 ≈ 520/700) : le badge
                                 // doit être rangé AVANT l'arrivée du suivant,
                                 // il reste 180 ms de battement.
const T_PIPELINE_LEAD    = 4500; // respiration avant pipeline. Le défilé dure
                                 // maintenant 4×700 + 520 = 3320 ms ; 4500 lui
                                 // laisse les MÊMES 1180 ms de contemplation
                                 // qu'avant le ralentissement. Recalculer cette
                                 // constante à chaque changement de cadence,
                                 // sinon la pipeline démarre sur le défilé.
const T_PILL_FIRST       = 500;
const T_PILL_GAP         = 700;  // cadence des titres de pill
const T_AFTERGLOW_LEAD   = 900;
const T_EXIT_DURATION    = 650;

/* ── Haptic helper ───────────────────────────────────────────── */


/* ── Gyro tilt hook (DeviceOrientation web API) ──────────────── */

/** Retourne un tilt 3D (rotateX, rotateY) ±6° basé sur l'orientation
 *  du device. Si aucun event n'arrive (émulateur / capteur indispo /
 *  permission iOS non accordée), `hasGyro` reste false et le composant
 *  bascule sur l'auto-tilt CSS de fallback. Pas de plugin requis. */
function useGyroTilt(maxDeg = 6) {
  const [tilt, setTilt] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hasGyro, setHasGyro] = useState(false);
  // Dernier tilt commité + dernier timestamp traité, gardés en ref pour ne
  // PAS re-render à chaque event deviceorientation (~60 Hz). Sans ça,
  // setTilt({x,y}) crée un objet neuf à chaque event → re-render storm
  // permanent tant que le WOW est affiché.
  const lastTiltRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastTsRef = useRef(0);
  const hasGyroRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const THRESHOLD_DEG = 0.5; // ignore le bruit capteur sous 0.5°
    const THROTTLE_MS = 40;    // ~25 Hz — amplement fluide pour un tilt 3D

    const handler = (e: DeviceOrientationEvent) => {
      if (cancelled) return;

      // 1) Throttle : au plus un traitement toutes les THROTTLE_MS.
      const now = e.timeStamp || 0;
      if (now - lastTsRef.current < THROTTLE_MS) return;
      lastTsRef.current = now;

      const beta = e.beta ?? 0;   // -180..180 (front-back)
      const gamma = e.gamma ?? 0; // -90..90 (left-right)
      const x = Math.max(-maxDeg, Math.min(maxDeg, gamma / 4));
      const y = Math.max(-maxDeg, Math.min(maxDeg, -beta / 4));

      // Active le mode gyro UNE seule fois (ref → un unique setState).
      if (!hasGyroRef.current) { hasGyroRef.current = true; setHasGyro(true); }

      // 2) Seuil : on ne setTilt (= re-render) QUE si le tilt a bougé
      // au-delà du bruit. Sinon on garde la référence précédente → zéro
      // re-render. C'est ce qui tue le storm tout en gardant le tilt fluide.
      const last = lastTiltRef.current;
      if (Math.abs(x - last.x) < THRESHOLD_DEG && Math.abs(y - last.y) < THRESHOLD_DEG) return;
      lastTiltRef.current = { x, y };
      setTilt({ x, y });
    };

    try {
      window.addEventListener("deviceorientation", handler, { passive: true });
    } catch { /* SSR / window absent */ }

    return () => {
      cancelled = true;
      try { window.removeEventListener("deviceorientation", handler); } catch { /* noop */ }
    };
  }, [maxDeg]);

  return { tilt, hasGyro };
}

/* ═══════════════════════════════════════════════════════════════
   Composant
═══════════════════════════════════════════════════════════════ */

type Act = "anticipation" | "card" | "pipeline" | "afterglow";

interface Props {
  athlete: AthleteProfileRecruiterView;
  onComplete: () => void;
}

export default function AthleteOnboardingWowMobile({ athlete, onComplete }: Props) {
  // Hooks AVANT tout return (canon Rules of Hooks).
  const [act, setAct] = useState<Act>("anticipation");
  const [wowVerified, setWowVerified] = useState(false);
  const [wowStars, setWowStars] = useState(0);
  /* Le défilé se décrit avec deux compteurs, pas un drapeau.
     `badgeAuCentre` = l'index qui occupe le centre (−1 = personne).
     `badgesRanges`  = combien sont déjà descendus dans la rangée.
     Le badge central n'est visible que tant qu'il n'est pas rangé, ce qui
     enchaîne les deux animations sans avoir à mesurer quoi que ce soit. */
  const [badgeAuCentre, setBadgeAuCentre] = useState(-1);
  const [badgesRanges, setBadgesRanges] = useState(0);
  const showBadges = badgesRanges > 0 || badgeAuCentre >= 0;
  const [activeStage, setActiveStage] = useState(0); // 0..6
  const [exiting, setExiting] = useState(false);
  // Portal vers document.body : ce WOW est un overlay `fixed inset-0`. Rendu
  // inline il était piégé par le containing block de <AnimatedRoute>
  // (willChange:"transform,opacity" établit un containing block → le `fixed`
  // devient relatif au wrapper animé, pas au viewport → layout déréglé). Même
  // fix que le FAB roster (commit f32b768 : portal to body). mounted = SSR-safe.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const { tilt, hasGyro } = useGyroTilt(6);

  // Override SHOWCASE en mémoire (DB intacte).
  const cardData: AthleteProfileRecruiterView = useMemo(() => ({
    ...athlete,
    isVerified: wowVerified,
    lastValidation: wowVerified ? new Date().toISOString() : (athlete.lastValidation ?? null),
    overallRating: wowStars,
    distinctions: showBadges ? SHOWCASE_BADGES : [],
  }), [athlete, wowVerified, wowStars, showBadges]);

  /* ── Choreography ──────────────────────────────────────────── */
  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    const T = (ms: number, fn: () => void) => { timeouts.push(setTimeout(fn, ms)); };

    // ACT 1 : loading épuré (logo + "Chargement..." 3 dots) — pas de
    // timers, juste un fond animé pendant T_ACT1_DURATION ms.

    // Card lands — haptic Medium
    T(T_ACT1_DURATION, () => {
      setAct("card");
      triggerHaptic("Medium");
    });

    // Vérifié claque — Medium, après scale-in carte
    const verifiedAt = T_ACT1_DURATION + T_CARD_ENTER + T_VERIFIED_DELAY;
    T(verifiedAt, () => {
      setWowVerified(true);
      triggerHaptic("Medium");
    });

    /* 5 étoiles cascade — Light chacune — ET ELLES RESTENT PLEINES.

       Décision produit BP du 2026-09-11, qui REMPLACE celle de la veille :
       la carte du WOW est une PROJECTION ASPIRATIONNELLE assumée. Elle ne
       montre pas ce que l'athlète EST, elle montre ce à quoi ça ressemble
       quand tout est là — 5 étoiles, cinq distinctions nommées.

       La version précédente faisait retomber les étoiles à vide pour ne pas
       « mentir ». Le problème n'était pas la valeur affichée, c'était le
       cadre : une carte qui monte à 5/5 puis se vide raconte un échec à un
       gamin qui vient de s'inscrire. Ce qui rend la projection honnête, ce
       n'est pas de la démentir, c'est de la NOMMER — le défilé des badges
       et la ligne « Ton entraîneur t'évaluera », affichée en permanence,
       disent ensemble « voilà la démo, voilà qui la remplira pour de vrai ». */
    const starsStart = verifiedAt + T_STARS_LEAD;
    for (let i = 1; i <= 5; i++) {
      T(starsStart + (i - 1) * T_STAR_GAP, () => {
        setWowStars(i);
        triggerHaptic("Light");
      });
    }

    /* Le défilé : chaque badge arrive seul au centre, claque, puis se range.
       L'haptique est ici et nulle part ailleurs dans l'acte 2 — c'était le
       seul moment de la chorégraphie sans retour physique, alors que les
       étoiles et la pipeline en ont un à chaque pas. Le cinquième porte
       `Success` : c'est le bouquet, il ne se signale pas comme les autres. */
    const badgesStart = starsStart + 5 * T_STAR_GAP + T_BADGES_DELAY;
    for (let i = 0; i < SHOWCASE_BADGES.length; i++) {
      const arriveA = badgesStart + i * T_BADGE_CADENCE;
      T(arriveA, () => {
        setBadgeAuCentre(i);
        triggerHaptic(i === SHOWCASE_BADGES.length - 1 ? "Success" : "Light");
      });
      T(arriveA + T_BADGE_SETTLE, () => setBadgesRanges(i + 1));
    }

    // ACT 3 : pipeline pill (6 stages 700ms chacun)
    const pipelineStart = badgesStart + T_PIPELINE_LEAD;
    T(pipelineStart, () => setAct("pipeline"));
    for (let i = 1; i <= 6; i++) {
      T(pipelineStart + T_PILL_FIRST + (i - 1) * T_PILL_GAP, () => {
        setActiveStage(i);
        // Light tick à chaque morphe ; Success sur Lettre signée
        triggerHaptic(i === 6 ? "Success" : "Light");
      });
    }

    // ACT 4 : afterglow
    const afterglowStart = pipelineStart + T_PILL_FIRST + 6 * T_PILL_GAP + T_AFTERGLOW_LEAD;
    T(afterglowStart, () => setAct("afterglow"));

    return () => { timeouts.forEach(clearTimeout); };
  }, []);

  /* ── Glow ember (drop-shadow → épouse la forme alpha de la carte).
        Sprint WOW-polish §B — la couche GOLD centered (rgba(245,158,11))
        produisait un anneau jaune autour de la carte = perçu comme un
        "cadre doré" par BP. Retirée. Reste 2 couches RED à blurs
        différents pour profondeur (inner punchy + outer diffus). Pure
        red ember chaud, pas de bordure ressentie. */
  const intensity = wowStars / 5;
  const cardFilter = wowStars === 0 && !wowVerified
    ? "none"
    : [
        // Inner halo rouge punchy (court rayon)
        `drop-shadow(0 4px ${14 + wowStars * 4}px rgba(230,57,70,${0.30 + intensity * 0.18}))`,
        // Outer halo rouge diffus (large rayon, profondeur chaude)
        `drop-shadow(0 14px ${36 + wowStars * 6}px rgba(230,57,70,${0.14 + intensity * 0.16}))`,
      ].join(" ");

  const showAnticipation  = act === "anticipation";
  const showCardScene     = act === "card";
  const showPipelinePanel = act === "pipeline" || act === "afterglow";
  const showAfterglow     = act === "afterglow";

  // Sprint b3-fix3 §4 : en scène B/C, la carte recule légèrement vers
  // le haut + se réduit pour libérer le centre pour la pill. Pas trop :
  // doit rester ENTIÈREMENT visible, sans coller le notch.
  // Sprint WOW-polish §A — la carte recule moins en scène B/C pour rester
  // plus centrée / plus basse (avant : -52, trop haut, collait le notch).
  // -24 + scale 0.88 → la carte respire avec le pipeline+afterglow sans
  // se sentir aspirée vers le haut.
  const cardTranslateY = showPipelinePanel ? -24 : 0;
  const cardScale = showPipelinePanel ? 0.88 : 1;

  /* ── CTA C'est parti — joue l'exit anim AVANT onComplete ──── */
  const handleEnter = () => {
    if (exiting) return;
    triggerHaptic("Medium");
    setExiting(true);
    setTimeout(() => { onComplete(); }, T_EXIT_DURATION);
  };

  /* ── Sparks (particules dorées/rouges) ─────────────────────── */
  const sparks = useMemo(() => Array.from({ length: 6 }, (_, i) => ({
    left: `${10 + i * 14 + (i % 2) * 6}%`,
    bottom: `${10 + (i % 3) * 7}%`,
    delay: `${(i * 0.45).toFixed(2)}s`,
    duration: `${(2.8 + (i % 2) * 0.7).toFixed(2)}s`,
    color: i % 2 === 0 ? "#F59E0B" : "#E63946",
  })), []);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-[#060A14] text-white overflow-hidden"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
      role="dialog"
      aria-label="Création de ta carte joueur"
    >
      {/* ─── ACT 1 : loading épuré (sprint WOW-finitions §B) ──────
            Retiré : drop-shadow rouge derrière le logo, scan doré balayant,
            et les 3 coches "Ton sport / Ton équipe / Ton profil".
            Gardé : logo Nexus (flamme X) centré + particules en fond
            (dériv. en dessous, opacity visible dès maintenant) +
            "Chargement" avec 3 points animés. */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center px-8 pointer-events-none"
        style={{
          opacity: showAnticipation ? 1 : 0,
          transition: "opacity 500ms ease-out",
        }}
      >
        <div
          className="relative mb-7"
          style={{ width: 96, height: 96, animation: "nx-wow-flame 1.6s ease-in-out infinite" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/icon-red.svg"
            alt=""
            width={96}
            height={96}
            className="block"
          />
        </div>

        <div className="flex items-center gap-2 text-[14px] font-semibold text-white/60">
          <span>Chargement</span>
          <span className="flex items-end gap-1 mb-0.5">
            <span
              className="w-1 h-1 rounded-full bg-white/60"
              style={{ animation: "nx-wow-load-dot 1.2s ease-in-out 0s infinite" }}
            />
            <span
              className="w-1 h-1 rounded-full bg-white/60"
              style={{ animation: "nx-wow-load-dot 1.2s ease-in-out 0.2s infinite" }}
            />
            <span
              className="w-1 h-1 rounded-full bg-white/60"
              style={{ animation: "nx-wow-load-dot 1.2s ease-in-out 0.4s infinite" }}
            />
          </span>
        </div>
      </div>

      {/* ─── Sparks (visibles AUSSI pendant l'anticipation maintenant —
            sprint WOW-finitions §B) ───────────────────────────────── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: exiting ? 0 : 1,
          transition: "opacity 600ms ease-out",
        }}
        aria-hidden
      >
        {sparks.map((s, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: s.left,
              bottom: s.bottom,
              width: 4, height: 4,
              borderRadius: "50%",
              background: s.color,
              boxShadow: `0 0 8px ${s.color}`,
              opacity: 0,
              animation: `nx-wow-spark ${s.duration} ease-out ${s.delay} infinite`,
            }}
          />
        ))}
      </div>

      {/* ─── ACT 2/3/4 : conteneur carte (mountée dès anticipation finie) ─
            perspective: 1000 pour le tilt 3D enfant. Top généreux (80px)
            pour la respiration. */}
      <div
        className="absolute inset-x-0 flex flex-col items-center"
        style={{
          // Regression undo : depuis le portal vers document.body (fixed inset-0
          // relatif au vrai écran), top:80 mesurait depuis le bord physique →
          // carte trop haute sous le Dynamic Island. On ré-inclut le top-inset
          // pour retrouver "80px sous le haut utilisable" (pré-portal). La pill
          // (top:60vh) se re-centre alors d'elle-même — non touchée.
          top: "calc(env(safe-area-inset-top) + 80px)",
          perspective: 1000,
          opacity: showAnticipation ? 0 : 1,
          transform: `translateY(${cardTranslateY}px) scale(${cardScale})`,
          transformOrigin: "top center",
          transition: "transform 720ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 500ms ease-out",
          pointerEvents: "none",
        }}
      >
        {/* Idle float (continue) — wrapper séparé du tilt + glow */}
        <div className="nx-wow-idle">
          {/* Tilt 3D : inline si gyro présent, fallback auto-tilt CSS */}
          <div
            className={hasGyro ? "" : "nx-wow-auto-tilt"}
            style={hasGyro ? {
              transform: `rotateX(${tilt.y}deg) rotateY(${tilt.x}deg)`,
              transition: "transform 220ms ease-out",
              transformStyle: "preserve-3d",
              willChange: "transform",
            } : { transformStyle: "preserve-3d", willChange: "transform" }}
          >
            {/* Entrance + glow ember (drop-shadow form-fit) */}
            <div
              className="relative"
              style={{
                filter: cardFilter,
                transform: showAnticipation ? "scale(0.84)" : "scale(1)",
                opacity: showAnticipation ? 0 : 1,
                transitionProperty: "transform, opacity, filter",
                transitionDuration: "640ms, 500ms, 500ms",
                transitionTimingFunction: "cubic-bezier(0.34, 1.66, 0.64, 1), ease-out, ease-out",
                willChange: "transform, filter, opacity",
              }}
            >
              <AthletePlayerCard a={cardData} format="compact" />

              {/* Foil shimmer continu (subtil, clip 10px) — actif dès
                  que la carte est visible */}
              {!showAnticipation && (
                <div
                  className="absolute inset-0 pointer-events-none overflow-hidden"
                  style={{ borderRadius: 10 }}
                  aria-hidden
                >
                  <div
                    style={{
                      position: "absolute",
                      top: -30, bottom: -30, left: 0, width: "60%",
                      background: "linear-gradient(110deg, transparent 35%, rgba(255,255,255,0.10) 50%, transparent 65%)",
                      mixBlendMode: "screen",
                      animation: "nx-wow-foil-shimmer 4.8s ease-in-out infinite",
                      willChange: "transform, opacity",
                    }}
                  />
                </div>
              )}

              {/* Foil reveal one-shot sweep — joue à la transition vers ACT 2 */}
              {showCardScene && (
                <div
                  key="foil-reveal"
                  className="absolute inset-0 pointer-events-none overflow-hidden"
                  style={{ borderRadius: 10 }}
                  aria-hidden
                >
                  <div
                    style={{
                      position: "absolute",
                      top: -30, bottom: -30, width: 110,
                      background: "linear-gradient(110deg, transparent 28%, rgba(255,255,255,0.55) 50%, transparent 72%)",
                      animation: "nx-wow-foil-reveal 820ms ease-out forwards",
                      willChange: "transform, opacity",
                    }}
                  />
                </div>
              )}

              {/* Sheen sweep — replay à chaque étoile */}
              {wowStars > 0 && (
                <div
                  key={`sheen-${wowStars}`}
                  className="absolute inset-0 pointer-events-none overflow-hidden"
                  style={{ borderRadius: 10 }}
                  aria-hidden
                >
                  <div
                    style={{
                      position: "absolute",
                      top: -20, bottom: -20, width: 80,
                      background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.42) 50%, transparent 70%)",
                      animation: "nx-wow-sheen 720ms ease-out forwards",
                    }}
                  />
                </div>
              )}

              {/* Vérifié — sonar flash sur le badge */}
              {wowVerified && (
                <div
                  key="verified-flash"
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: 252, top: 4, width: 72, height: 72,
                    borderRadius: "50%",
                    border: "3px solid #29AAFF",
                    background: "transparent",
                    opacity: 0,
                    animation: "nx-wow-verified-flash 700ms ease-out forwards",
                    pointerEvents: "none",
                  }}
                />
              )}
            </div>
          </div>
        </div>

        {/* ─── LE DÉFILÉ — scène du centre ──────────────────────────────
            Un seul badge à la fois, en `lg` (110 px), AVEC son nom. Il est
            monté tant qu'il n'est pas rangé ; l'instant où `badgesRanges`
            le rattrape, il joue sa sortie vers la rangée et la vignette
            apparaît en bas. Deux animations qui se relaient, aucune mesure
            de position — donc rien à recalculer si la rangée bouge.

            HAUTEUR FIXE, ET ELLE EST CALCULÉE : le badge `lg` mesure
            96 (picto) + 10 (gouttière) + ~28 (libellé sur deux lignes, ex.
            « ÉQUIPE D'ÉTOILES ») = 134 px. `h-[136px]` le contient au pixel
            près. Trop généreuse, la boîte jouait le défilé plus bas que
            nécessaire ; absente, le premier badge pousserait tout le reste.

            `mt-1` + `items-start` collent la scène SOUS LA CARTE. Celle-ci ne
            bouge pas : elle est au-dessus dans le flux, rien ici ne la pousse. */}
        <div
          /* 136 -> 172. La scene est dimensionnee A LA MAIN sur le badge
             central : 136 = 96 (icone lg) + 10 (gap) + ~30 (libelle 11px).
             En `xl` : 124 + 10 + ~34 (libelle 13px, deux lignes possibles)
             = 168, arrondi a 172. Sans ce bump le badge agrandi se faisait
             couper par le bas. A recalculer si la taille rebouge. */
          className="relative mt-1 h-[172px]"
          style={{ pointerEvents: "none" }}
        >
          {SHOWCASE_BADGES.map((d, i) => {
            const auCentre = badgeAuCentre === i && badgesRanges <= i;
            const descend  = badgeAuCentre >= i && badgesRanges === i + 1;
            if (!showCardScene || (!auCentre && !descend)) return null;
            return (
              /* Chaque badge occupe TOUTE la scène, en absolu. Sans ça, le
                 sortant et l'entrant coexistent ~240 ms dans le même flux :
                 deux enfants flex, et l'entrant n'est plus au centre — il
                 sautait de côté à chaque relais. */
              <div
                key={d.badge}
                className="absolute inset-0 flex items-start justify-center"
                style={{
                  animation: auCentre
                    ? "nx-wow-badge-slam 300ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards"
                    : "nx-wow-badge-file 240ms cubic-bezier(0.4, 0, 1, 1) forwards",
                }}
              >
                <DistinctionBadge badge={d.badge} libelle={d.libelle} size="xl" />
              </div>
            );
          })}
        </div>

        {/* ─── LE DÉFILÉ — la rangée qui se remplit ─────────────────────
            `md` (44 px) + `gap-3` (12 px) : 5 × 44 + 4 × 12 = 268 px. Tient
            sur 360 px d'écran (328 utiles) comme sur 411 (379 utiles), là où
            la rangée `sm` d'avant en réclamait 560 et se faisait couper.
            Était `xs` (188 px) : lisible mais chétif — `md` est le palier
            ajouté pour cette rangée, et il garde la grammaire compacte de
            `xs` (ni reflet, ni onde, AUCUN libellé) — plus besoin du
            `[&_span]:hidden` qui traînait ici.
            Plafond avant coupure : 5 × W + 48 ≤ 328 → W ≤ 56 px. */}
        <div
          className="-mt-2 flex items-end justify-center gap-3"
          style={{ pointerEvents: "none" }}
        >
          {SHOWCASE_BADGES.slice(0, badgesRanges).map((d) => (
            <div
              key={d.badge}
              style={{
                opacity: showCardScene ? 1 : 0,
                animation: "nx-wow-badge-land 260ms cubic-bezier(0.34, 1.56, 0.64, 1)",
                transition: "opacity 300ms ease-out",
              }}
            >
              <DistinctionBadge badge={d.badge} libelle={d.libelle} size="md" />
            </div>
          ))}
        </div>

        {/* CE QUI REND LA PROJECTION HONNÊTE.
            Les étoiles restent pleines et les cinq badges sont là : la carte
            montre une DÉMO, pas un bilan. Cette ligne le dit, et elle est
            affichée pendant TOUTE la scène — elle ne dépend plus d'une
            redescente des étoiles, qui n'existe plus. C'est elle, avec le
            défilé nommé, qui nomme la projection au lieu de la démentir. */}
        <p
          className="mt-4 text-center text-[12px] text-white/50"
          style={{
            opacity: showCardScene ? 1 : 0,
            transition: "opacity 420ms ease-out",
            pointerEvents: "none",
          }}
        >
          Ton entraîneur t&apos;évaluera.
        </p>
      </div>

      {/* ─── ACT 3 : pill morphing FIXE au CENTRE ───────────────────
            Sprint WOW-finitions §A — la pill ne bouge plus entre les
            scènes B et C. Position fixe à 60vh. L'afterglow se positionne
            sous la pill sans la déplacer (cf bottom du panel afterglow). */}
      <div
        className="absolute inset-x-0 flex justify-center px-6"
        style={{
          top: "60vh",
          opacity: showPipelinePanel ? 1 : 0,
          transform: showPipelinePanel ? "translateY(0)" : "translateY(20px)",
          transition: "opacity 520ms ease-out 150ms, transform 600ms cubic-bezier(0.34, 1.56, 0.64, 1) 150ms",
          pointerEvents: "none",
        }}
      >
        <WowPipelinePill activeIndex={activeStage} />
      </div>

      {/* ─── ACT 4 afterglow : copy + CTA (body 16px leading relaxed) ── */}
      <div
        className="absolute inset-x-0 px-6"
        style={{
          bottom: "calc(env(safe-area-inset-bottom) + 24px)",
          opacity: showAfterglow ? 1 : 0,
          transform: showAfterglow ? "translateY(0)" : "translateY(20px)",
          transition: "opacity 500ms ease-out 100ms, transform 600ms cubic-bezier(0.34, 1.56, 0.64, 1) 100ms",
          pointerEvents: showAfterglow && !exiting ? "auto" : "none",
        }}
      >
        <h2 className="font-head text-[26px] font-black uppercase tracking-tight text-white text-center leading-tight">
          Premier pas accompli.
        </h2>
        <p className="text-center text-[16px] text-white/80 leading-relaxed mt-4 max-w-[360px] mx-auto">
          Bravo — tu viens de lancer ton parcours. Notre objectif : t&apos;accompagner jusqu&apos;à la signature. Peu importe ton niveau, on est là pour t&apos;aider à te faire voir par les recruteurs.
        </p>
        <button
          type="button"
          onClick={handleEnter}
          disabled={exiting}
          className="w-full mt-7 h-14 rounded-2xl bg-[#E63946] text-white font-head font-black text-[14px] uppercase tracking-widest active:scale-[0.97] active:bg-[#D42B22] shadow-[0_8px_24px_rgba(230,57,70,0.35)] transition-transform disabled:opacity-90"
        >
          C&apos;est parti
        </button>
      </div>

      {/* ─── Exit veil (#111317) anti-flash ──────────────────── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "#111317",
          opacity: exiting ? 1 : 0,
          transition: `opacity ${T_EXIT_DURATION}ms cubic-bezier(0.4, 0, 0.2, 1)`,
          zIndex: 80,
        }}
        aria-hidden
      />
    </div>,
    document.body,
  );
}

/* ═══════════════════════════════════════════════════════════════
   WowPipelinePill — local au WOW (sprint b3-fix3 §2)

   UNE seule pill, centrée, dont le TITRE change en cascade selon
   activeIndex (0..6). Couleur interpolée gris (#6B7280) → rouge
   (#E63946) au fil de l'avancée. Pop animation à chaque morphe
   (key sur safe). Quand activeIndex === 6 (Lettre signée), pulse
   infinie pour "vivant".

   Showcase only — pas câblé au vrai pipeline.
═══════════════════════════════════════════════════════════════ */

function WowPipelinePill({ activeIndex }: { activeIndex: number }) {
  const N = PILL_LABELS.length;
  const safe = Math.max(1, Math.min(N, activeIndex || 1));
  const label = PILL_LABELS[safe - 1];
  const isFinal = safe === N;

  // Couleur interpolée gris→rouge selon la progression (safe-1)/(N-1) ∈ [0,1].
  const progress = (safe - 1) / (N - 1);
  const r1 = 107, g1 = 114, b1 = 128; // #6B7280
  const r2 = 230, g2 = 57,  b2 = 70;  // #E63946
  const r = Math.round(r1 + (r2 - r1) * progress);
  const g = Math.round(g1 + (g2 - g1) * progress);
  const b = Math.round(b1 + (b2 - b1) * progress);
  const bg = `rgb(${r}, ${g}, ${b})`;
  const shadowAlpha = 0.22 + progress * 0.28;

  return (
    <div
      key={safe} // remount pour la pop animation à chaque morphe
      className="font-head font-black text-[15px] uppercase tracking-[0.06em] text-white"
      style={{
        background: bg,
        boxShadow: `0 8px 26px rgba(${r}, ${g}, ${b}, ${shadowAlpha}), 0 0 ${isFinal ? 32 : 0}px rgba(${r}, ${g}, ${b}, ${isFinal ? 0.55 : 0})`,
        padding: "12px 22px",
        borderRadius: 9999,
        animation: isFinal
          ? "nx-wow-pill-pulse 1.8s ease-in-out infinite"
          : "nx-wow-pill-pop 420ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        willChange: "transform, opacity, box-shadow",
        opacity: activeIndex === 0 ? 0 : 1,
      }}
    >
      {label}
    </div>
  );
}
