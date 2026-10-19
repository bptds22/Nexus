"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { isTabBarHidden, isThreadRoute } from "./tabBarVisibility";
import { createClient } from "@/lib/supabase/client";
import { useSubscription } from "@/lib/hooks/useSubscription";
import UpgradeModal from "@/components/ui/UpgradeModal";
import MorePanel from "./MorePanel";
import { loadCoachTaskCounts } from "@/lib/coach/tasks";
import { triggerHaptic } from "@/lib/haptics";
import { countAthleteUnread } from "@/lib/messaging/athleteUnread";
import { entreeVisible, usePeutEvaluer } from "@/lib/partenaires/navigation";
import { surReprise, viderNotificationsLivrees } from "@/lib/push/pastillesAppareil";
import { DEPISTAGE } from "@/lib/gameOn/libelles";
import PersonnaliserBarre from "@/components/mobile/PersonnaliserBarre";
import {
  avecChoixBarre, lireChoixBarre, resoudreBarre, EVENEMENT_BARRE_PERSO, EVENEMENT_OUVRIR_BARRE_PERSO, type RoleBarre,
} from "@/lib/mobile/barrePerso";

/* ─────────────────────────────────────────────────────────────────
   MobileTabBar — bottom navigation bar for Capacitor mobile builds.
   Supports the 3 user roles : recruteur, coach, athlete.

   Affichée UNIQUEMENT si NEXT_PUBLIC_CAPACITOR_BUILD === "true".
   Sur le web, ce composant retourne null → zéro impact.

   Réutilise (dupliqué localement le temps de stabiliser le pattern,
   à factoriser une fois les 3 rôles validés) :
   - meetsRequiredTier + TIER_RANK : copié de RecruiterSidebar
   - LockIcon : copié de RecruiterSidebar
   - Queries de badge : copiées de RecruiterSidebar / CoachSidebar /
     AthleteSidebar (selon le rôle)
───────────────────────────────────────────────────────────────── */

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

/* ── Tier gating (dupliqué de RecruiterSidebar — à factoriser étape 3) ── */
const TIER_RANK: Record<"free" | "pro" | "all_star", number> = {
  free: 0,
  pro: 1,
  all_star: 2,
};

function meetsRequiredTier(
  userTier: "free" | "pro" | "all_star",
  requiredTier: "pro" | "all_star" | undefined,
  isSchoolAdmin: boolean,
  adminBypass: boolean = false,
): boolean {
  if (!requiredTier) return true;
  if (isSchoolAdmin && adminBypass) return true;
  return TIER_RANK[userTier] >= TIER_RANK[requiredTier];
}

/* ── LockIcon (dupliqué de RecruiterSidebar — à factoriser étape 3) ── */
const LockIcon = () => (
  <svg
    width="9"
    height="9"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#6B7280"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="shrink-0 absolute -top-0.5 -right-1"
    aria-hidden
  >
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0110 0v4" />
  </svg>
);

/* ── Icons (26px, strokeWidth 1.5 — look léger/aéré façon ESPN/NFL) ── */
const SVG_BASE = "26";
const SVG_PROPS = { width: SVG_BASE, height: SVG_BASE, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const Icons = {
  dashboard: (
    <svg {...SVG_PROPS}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  search: (
    <svg {...SVG_PROPS}><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
  ),
  kanban: (
    <svg {...SVG_PROPS}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </svg>
  ),
  envelope: (
    <svg {...SVG_PROPS}>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  ),
  calendar: (
    <svg {...SVG_PROPS}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  // Dépistage (ex-Game On) : un bouton « lecture » (le match en cours).
  gameOn: (
    <svg {...SVG_PROPS}>
      <circle cx="12" cy="12" r="9" />
      <polygon points="10 8.5 16 12 10 15.5" fill="currentColor" />
    </svg>
  ),
  // Barre personnalisable (BP 2026-10-19) : les écrans qu'on peut y monter.
  heart: (
    <svg {...SVG_PROPS}><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg>
  ),
  carte: (
    <svg {...SVG_PROPS}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>
  ),
  listes: (
    <svg {...SVG_PROPS}><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" /></svg>
  ),
  journal: (
    <svg {...SVG_PROPS}><path d="M4 22h16a2 2 0 002-2V4a2 2 0 00-2-2H8a2 2 0 00-2 2v16a2 2 0 01-2 2zm0 0a2 2 0 01-2-2v-9c0-1.1.9-2 2-2h2" /><path d="M18 14h-8" /><path d="M15 18h-5" /><path d="M10 6h8v4h-8z" /></svg>
  ),
  tendance: (
    <svg {...SVG_PROPS}><path d="M3 17l6-6 4 4 8-8" /><polyline points="14 7 21 7 21 14" /></svg>
  ),
  trophee: (
    <svg {...SVG_PROPS}><path d="M6 9H4a2 2 0 01-2-2V5a2 2 0 012-2h2" /><path d="M18 9h2a2 2 0 002-2V5a2 2 0 00-2-2h-2" /><path d="M6 3h12v6a6 6 0 01-12 0V3z" /><path d="M12 15v3M8 21h8" /></svg>
  ),
  telecharger: (
    <svg {...SVG_PROPS}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
  ),
  more: (
    <svg {...SVG_PROPS}>
      <circle cx="5" cy="12" r="1.6" fill="currentColor" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <circle cx="19" cy="12" r="1.6" fill="currentColor" />
    </svg>
  ),
  /* ── Coach ── */
  users: (
    <svg {...SVG_PROPS}>
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  ),
  layers: (
    <svg {...SVG_PROPS}>
      <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
    </svg>
  ),
  checklist: (
    <svg {...SVG_PROPS}>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3a1 1 0 011-1h4a1 1 0 011 1v1" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
  /* ── Athlete ── */
  flag: (
    <svg {...SVG_PROPS}>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  ),
  user: (
    <svg {...SVG_PROPS}>
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  ),
  eye: (
    <svg {...SVG_PROPS}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  ),
  /* Mortier — repris à l'identique de MorePanel.Icons.cegep : l'onglet
     « Cégeps » remonte du panel vers la barre, l'icône doit suivre pour que
     le déplacement se reconnaisse. */
  cegep: (
    <svg {...SVG_PROPS}>
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5" />
    </svg>
  ),
};

interface TabConfig {
  key: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  requiredTier?: "pro" | "all_star";
  adminBypass?: boolean;
  /** Substring d'URL pour considérer le tab actif (fallback href). */
  activeMatch?: string;
  /** Actif sur le chemin EXACT seulement (accueil d'un portail dont les autres
   *  écrans sont des sous-chemins : /partenaire). */
  exact?: boolean;
}

const RECRUTEUR_TABS: TabConfig[] = [
  { key: "dashboard", label: "Accueil", href: "/recruteur/tableau-de-bord", icon: Icons.dashboard, activeMatch: "/recruteur/tableau-de-bord" },
  // BP 2026-10-18 : sur le téléphone, la barre sert le terrain — Calendrier, Dépistage, Messages.
  // Recherche et Processus passent dans « Plus » (MorePanel). Calendrier et Dépistage sans requiredTier :
  // le gratuit atteint la page et y voit sa porte Pro (FeatureGate), comme dans le panneau Plus.
  { key: "calendrier", label: "Calendrier", href: "/recruteur/calendrier", icon: Icons.calendar, activeMatch: "/recruteur/calendrier" },
  { key: "game-on", label: DEPISTAGE.onglet, href: "/recruteur/game-on", icon: Icons.gameOn, activeMatch: "/recruteur/game-on" },
  { key: "messages", label: "Messages", href: "/recruteur/messages", icon: Icons.envelope, requiredTier: "pro" },
];

const COACH_TABS: TabConfig[] = [
  { key: "dashboard", label: "Accueil", href: "/coach/tableau-de-bord", icon: Icons.dashboard, activeMatch: "/coach/tableau-de-bord" },
  // /coach/athletes couvre la liste + les sous-routes [id] (profil, modifier, apercu)
  { key: "athletes", label: "Mes athlètes", href: "/coach/athletes", icon: Icons.users, activeMatch: "/coach/athletes" },
  { key: "a-traiter", label: "À traiter", href: "/coach/a-traiter", icon: Icons.checklist, activeMatch: "/coach/a-traiter" },
  { key: "messages", label: "Messages", href: "/coach/demandes", icon: Icons.envelope, activeMatch: "/coach/demandes" },
];

const ATHLETE_TABS: TabConfig[] = [
  { key: "dashboard", label: "Accueil", href: "/athlete/dashboard", icon: Icons.dashboard, activeMatch: "/athlete/dashboard" },
  { key: "parcours", label: "Parcours", href: "/athlete/mon-parcours", icon: Icons.flag, activeMatch: "/athlete/mon-parcours" },
  { key: "messages", label: "Messages", href: "/athlete/messages", icon: Icons.envelope, activeMatch: "/athlete/messages" },
  /* « CÉGEPS » PREND LE 4e SLOT, « Mon profil » descend dans le panel Plus
     (échange, pas ajout — la barre reste à CINQ slots, le 5e étant le bouton
     Plus). C'est la destination de valeur du portail athlète : la laisser à
     deux taps sous « Plus » l'enterrait.
     ⚠ Libellé court « Cégeps », pas « Trouve ton cégep » : un onglet doit
     tenir sur UNE ligne sous une icône de 26px.
     ⚠ L'entrée `recherche-cegep` a été RETIRÉE de MorePanel dans le même
     geste. Toute remise en onglet/panel doit vérifier l'autre fichier :
     l'entrée a déjà fait l'aller-retour une fois. */
  { key: "recherche-cegep", label: "Cégeps", href: "/athlete/recherche", icon: Icons.cegep, activeMatch: "/athlete/recherche" },
];

/* Partenaire (1.4.5, B1) — l'accueil, la recherche, et « Mes athlètes » (les deux
   écrans d'évaluation fusionnés le 2026-10-18), montré seulement si `peut_evaluer` (même règle que la barre
   latérale du web : lib/partenaires/navigation.ts). Le reste du portail vit
   dans le panneau Plus. Aucun palier : pas de requiredTier. */
const PARTENAIRE_TABS: TabConfig[] = [
  { key: "dashboard", label: "Accueil", href: "/partenaire", icon: Icons.dashboard, exact: true },
  { key: "athletes", label: "Recherche", href: "/partenaire/athletes", icon: Icons.search, activeMatch: "/partenaire/athletes" },
  // Fusion du 2026-10-18 (6.1) : « Mes athlètes » porte les deux pastilles (En attente / Mes évaluations).
  // Barre : Accueil · Recherche · Mes athlètes · Live · Plus (Live : BP 2026-10-19, partenaire qui évalue).
  { key: "mes-athletes", label: "Mes athlètes", href: "/partenaire/mes-athletes", icon: Icons.users, activeMatch: "/partenaire/mes-athletes|/partenaire/prospects" },
  { key: "depistage", label: DEPISTAGE.onglet, href: "/partenaire/depistage", icon: Icons.gameOn, activeMatch: "/partenaire/depistage" },
];

/* Barre personnalisable (BP 2026-10-19) : tout ce qu'on peut monter dans la barre, par rôle.
   Les onglets par défaut d'abord ; le reste vient du panneau Plus (mêmes routes, mêmes portes Pro). */
const POOL_BY_ROLE: Record<RoleBarre, TabConfig[]> = {
  recruteur: [
    ...RECRUTEUR_TABS,
    { key: "recherche", label: "Recherche", href: "/recruteur/recherche", icon: Icons.search, activeMatch: "/recruteur/recherche" },
    { key: "pipeline", label: "Processus", href: "/recruteur/pipeline", icon: Icons.kanban, activeMatch: "/recruteur/pipeline", requiredTier: "pro" },
    { key: "favoris", label: "Favoris", href: "/recruteur/favoris", icon: Icons.heart, activeMatch: "/recruteur/favoris" },
    { key: "listes", label: "Listes", href: "/recruteur/listes", icon: Icons.listes, activeMatch: "/recruteur/listes" },
    { key: "carte-matchs", label: "Matchs", href: "/recruteur/carte-matchs", icon: Icons.carte, activeMatch: "/recruteur/carte-matchs" },
  ],
  partenaire: [
    ...PARTENAIRE_TABS,
    { key: "newsroom", label: "Newsroom", href: "/partenaire/newsroom", icon: Icons.journal, activeMatch: "/partenaire/newsroom" },
    { key: "tendances", label: "Tendances", href: "/partenaire/tendances", icon: Icons.tendance, activeMatch: "/partenaire/tendances" },
    { key: "classements", label: "Classements", href: "/partenaire/classements", icon: Icons.trophee, activeMatch: "/partenaire/classements" },
    { key: "carte-matchs", label: "Matchs", href: "/partenaire/carte-matchs", icon: Icons.carte, activeMatch: "/partenaire/carte-matchs" },
    { key: "telechargements", label: "Télécharg.", href: "/partenaire/telechargements", icon: Icons.telecharger, activeMatch: "/partenaire/telechargements" },
  ],
  coach: [
    ...COACH_TABS,
    { key: "equipes", label: "Équipes", href: "/coach/equipes", icon: Icons.layers, activeMatch: "/coach/equipes" },
    { key: "transferts", label: "Transferts", href: "/coach/transferts", icon: Icons.users, activeMatch: "/coach/transferts" },
    { key: "activites", label: "Activités", href: "/coach/activites", icon: Icons.checklist, activeMatch: "/coach/activites" },
    { key: "reputation", label: "Réputation", href: "/coach/reputation", icon: Icons.trophee, activeMatch: "/coach/reputation" },
  ],
  athlete: [
    ...ATHLETE_TABS,
    { key: "profil", label: "Profil", href: "/athlete/profil", icon: Icons.user, activeMatch: "/athlete/profil" },
    { key: "visibilite", label: "Visibilité", href: "/athlete/visibilite", icon: Icons.eye, activeMatch: "/athlete/visibilite" },
    { key: "transfert", label: "Mon équipe", href: "/athlete/transfert", icon: Icons.users, activeMatch: "/athlete/transfert" },
    { key: "notifications", label: "Notifs", href: "/athlete/notifications", icon: Icons.checklist, activeMatch: "/athlete/notifications" },
  ],
};

const TABS_BY_ROLE: Record<"recruteur" | "coach" | "athlete" | "partenaire", TabConfig[]> = {
  recruteur: RECRUTEUR_TABS,
  coach: COACH_TABS,
  athlete: ATHLETE_TABS,
  partenaire: PARTENAIRE_TABS,
};

interface MobileTabBarProps {
  role: "recruteur" | "coach" | "athlete" | "partenaire";
}

export default function MobileTabBar({ role }: MobileTabBarProps) {
  const pathname = usePathname();
  // trailingSlash:true → le pathname runtime a un slash final. Normalisé pour
  // les comparaisons EXACTES ci-dessous (les .startsWith restent sur pathname,
  // safe). Sans ça, les guards onboarding/messages se trompent d'écran.
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  const router = useRouter();
  // `tierLoading` distingue « tier pas encore chargé » de « tier = free ».
  // Le Provider défaute tier→"free" avant le fetch : sans ce flag, un All Star
  // voit les cadenas (verrous) une fraction de seconde au login. On ne verrouille
  // donc QU'UNE FOIS le tier réellement chargé — voir `locked` plus bas.
  const { tier, isSchoolAdmin, loading: tierLoading } = useSubscription();
  const peutEvaluer = usePeutEvaluer(IS_CAPACITOR && role === "partenaire");

  // Barre personnalisable (BP 2026-10-19) : le choix du compte (user_metadata), relu à l'enregistrement.
  const roleBarre: RoleBarre = role;
  const [choixBarre, setChoixBarre] = useState<string[] | null>(null);
  const [metaCompte, setMetaCompte] = useState<Record<string, unknown> | null>(null);
  const [personnaliser, setPersonnaliser] = useState(false);
  useEffect(() => {
    if (!roleBarre) return;
    let vivant = true;
    const lire = async () => {
      const { data: { user } } = await createClient().auth.getUser();
      if (!vivant || !user) return;
      setMetaCompte(user.user_metadata ?? null);
      setChoixBarre(lireChoixBarre(user.user_metadata, roleBarre));
    };
    void lire();
    const ouvrir = () => setPersonnaliser(true);
    window.addEventListener(EVENEMENT_BARRE_PERSO, lire);
    window.addEventListener(EVENEMENT_OUVRIR_BARRE_PERSO, ouvrir);
    return () => {
      vivant = false;
      window.removeEventListener(EVENEMENT_BARRE_PERSO, lire);
      window.removeEventListener(EVENEMENT_OUVRIR_BARRE_PERSO, ouvrir);
    };
  }, [roleBarre]);
  const enregistrerBarre = async (cles: string[] | null) => {
    if (!roleBarre) return;
    const { error } = await createClient().auth.updateUser({ data: avecChoixBarre(metaCompte, roleBarre, cles) });
    if (error) return;
    setChoixBarre(cles && cles.length > 0 ? cles : null);
    setPersonnaliser(false);
    window.dispatchEvent(new Event(EVENEMENT_BARRE_PERSO));
  };

  const [moreOpen, setMoreOpen] = useState(false);
  const [upgradeModal, setUpgradeModal] = useState<{ tierId: string; lockedFeatureTitle: string } | null>(null);
  // État clavier — sur une route thread, la tab bar est visible clavier fermé
  // et masquée clavier ouvert (le composer colle alors au clavier).
  const [kbdOpen, setKbdOpen] = useState(false);
  useEffect(() => {
    let show: { remove: () => void } | null = null;
    let hide: { remove: () => void } | null = null;
    (async () => {
      try {
        const { Keyboard } = await import("@capacitor/keyboard");
        show = await Keyboard.addListener("keyboardWillShow", () => setKbdOpen(true));
        hide = await Keyboard.addListener("keyboardWillHide", () => setKbdOpen(false));
      } catch { /* web — no-op */ }
    })();
    return () => { show?.remove(); hide?.remove(); };
  }, []);

  // Stacking-context fix — portal the tab bar to document.body so its z-40
  // escapes the `.hero-playbook` `isolation: isolate` trap created by the
  // athlete/coach/recruiter layout roots. Without this, the local z-40 is
  // sealed inside `.hero-playbook` (auto/0 at body root), so any other
  // body-level portal (editor sticky CTAs, sheets) at z-30+ paints over it.
  // `mounted` is the SSR-safe gate : first render returns null, then after
  // useEffect fires the portal renders client-side only, avoiding hydration
  // mismatches.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Iter 7.42 — Signal global "nx-more-panel" écouté par SaveBarPortal et tout
  // composant body-level qui doit céder la place au panel Plus (sans Context).
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("nx-more-panel", { detail: { open: moreOpen } }));
  }, [moreOpen]);

  /* ── Badges per rôle ──
     - msgBadge : compteur sur le tab Messages (recruteur uniquement)
     - actBadge : compteur affiché à côté de l'item correspondant dans le panel Plus
                  ET drive le dot rouge sur le bouton Plus
     - moreDotActive : indique si le dot doit s'afficher (peut inclure des
                       items hors actBadge, ex: suggestions athlète) */
  const [msgBadge, setMsgBadge] = useState(0);
  const [actBadge, setActBadge] = useState(0);
  // À traiter : non-vérifiés + suggestions EN_ATTENTE. Source/filtres IDENTIQUES
  // au dashboard coach ActionBar (page.tsx L118-122, L141, L153-159) — un seul
  // "à traiter" pour tout le coach mobile.
  const [aTraiterBadge, setATraiterBadge] = useState(0);
  const [moreDotActive, setMoreDotActive] = useState(false);

  useEffect(() => {
    if (!IS_CAPACITOR) return;
    let cancelled = false;

    const loadBadges = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      if (role === "recruteur") {
        const { data: convs } = await supabase
          .from("conversations")
          .select("id")
          .eq("recruiter_id", user.id)
          .eq("status", "ACTIVE");
        const convIds = convs?.map((c) => c.id) || [];
        let msgCount = 0;
        if (convIds.length > 0) {
          const { count } = await supabase
            .from("messages")
            .select("*", { count: "exact", head: true })
            .in("conversation_id", convIds)
            .neq("sender_id", user.id)
            .is("read_at", null);
          msgCount = count ?? 0;
        }
        const { count: actCount } = await supabase
          .from("recruiter_activity_log")
          .select("*", { count: "exact", head: true })
          .eq("recruiter_id", user.id)
          .eq("is_read", false);
        if (cancelled) return;
        setMsgBadge(msgCount);
        setActBadge(actCount ?? 0);
        setMoreDotActive((actCount ?? 0) > 0);
        return;
      }

      if (role === "coach") {
        const { count: actCount } = await supabase
          .from("activities")
          .select("id", { count: "exact", head: true })
          .eq("coach_id", user.id)
          .eq("read", false);

        // ÉTAPE 3c — convergence "à traiter" : on consomme le helper partagé
        // (lib/coach/tasks.loadCoachTaskCounts) à la place de l'ancien calcul
        // inline. Le badge inclut maintenant missingEval (était absent avant),
        // donc le compteur monte chez les coachs qui n'ont pas évalué tous
        // leurs athlètes — intentionnel : le badge doit matcher /coach/a-traiter.
        const counts = await loadCoachTaskCounts(supabase, user.id);

        // Messages non lus (RECRUTEUR_COACH + ATHLETE_COACH + COACH_COACH) →
        // badge VERT du tab Messages. Convs où le coach participe (coach_id OU
        // coach_b_id), read_at IS NULL, sender != moi. Miroir de l'athlète.
        let cMsgUnread = 0;
        const { data: cConvs } = await supabase
          .from("conversations")
          .select("id")
          .or(`coach_id.eq.${user.id},coach_b_id.eq.${user.id}`);
        const cConvIds = (cConvs ?? []).map((c) => (c as { id: string }).id);
        if (cConvIds.length > 0) {
          const { count } = await supabase
            .from("messages")
            .select("*", { count: "exact", head: true })
            .in("conversation_id", cConvIds)
            .neq("sender_id", user.id)
            .is("read_at", null);
          cMsgUnread = count ?? 0;
        }

        if (cancelled) return;
        setMsgBadge(cMsgUnread);
        setActBadge(actCount ?? 0);
        setATraiterBadge(counts.total);
        setMoreDotActive((actCount ?? 0) > 0);
        return;
      }

      if (role === "athlete") {
        // Need athlete.id from athletes table (queries are keyed on athlete_id)
        const { data: athlete } = await supabase
          .from("athletes")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        const athleteId = athlete?.id as string | undefined;
        if (!athleteId || cancelled) {
          setMsgBadge(0);
          setActBadge(0);
          setMoreDotActive(false);
          return;
        }
        // Messages non lus → badge VERT du tab Messages. Même fonction que
        // la barre latérale web (app/athlete/layout.tsx) : un badge juste sur
        // une seule des deux surfaces apprend à l'utilisateur que le compteur
        // ment. Voir lib/messaging/athleteUnread.ts pour l'allowlist de types
        // et le traitement séparé des fils de groupe.
        const aMsgCount = await countAthleteUnread(supabase, user.id, athleteId);
        const [{ count: notifs }, { count: invs }, { count: suggs }] = await Promise.all([
          supabase.from("athlete_notifications").select("id", { count: "exact", head: true }).eq("athlete_id", athleteId).eq("read", false),
          supabase.from("team_invitations").select("id", { count: "exact", head: true }).eq("athlete_id", athleteId).eq("status", "PENDING"),
          supabase.from("athlete_suggestions").select("id", { count: "exact", head: true }).eq("athlete_id", athleteId).eq("status", "EN_ATTENTE"),
        ]);
        if (cancelled) return;
        const notifsCount = (notifs ?? 0) + (invs ?? 0);
        setMsgBadge(aMsgCount);
        setActBadge(notifsCount); // affiché sur l'item "Notifications" du panel
        setMoreDotActive(notifsCount + (suggs ?? 0) > 0);
      }
    };

    loadBadges();

    /* C3 (1.4.5) — les pastilles ne bougeaient qu'au changement de route. Elles se
       recalculent maintenant aussi :
       · sur les deux signaux de lecture, pour TOUS les rôles (le recruteur et le coach
         n'écoutaient pas « notifications-updated », émis par la lecture d'un fil et
         par chaque push reçu) ;
       · à la reprise de l'appli (et le plateau de notifications est vidé : sur
         Android, la pastille de l'icône en dépend) ;
       · toutes les 60 s tant que l'écran est visible (Realtime n'est publié pour
         aucune de ces tables). */
    const handler = () => loadBadges();
    window.addEventListener("activities-updated", handler);
    window.addEventListener("notifications-updated", handler);
    const finReprise = surReprise(() => { void viderNotificationsLivrees(); loadBadges(); });
    const minuterie = window.setInterval(() => { if (document.visibilityState === "visible") loadBadges(); }, 60_000);
    return () => {
      cancelled = true;
      window.removeEventListener("activities-updated", handler);
      window.removeEventListener("notifications-updated", handler);
      finReprise();
      window.clearInterval(minuterie);
    };
  }, [pathname, role]);

  if (!IS_CAPACITOR) return null;

  // Thread de conversation : tab bar VISIBLE clavier fermé, MASQUÉE clavier
  // ouvert (le composer colle alors au clavier). Les AUTRES drill-downs
  // (wizard nouveau, paramètres/réputation/équipes, onboarding) restent
  // masqués en permanence via isTabBarHidden. Source unique : tabBarVisibility.
  if (isThreadRoute(role, normalizedPath)) {
    if (kbdOpen) return null;            // clavier ouvert → masquée
    // sinon : visible (on tombe dans le rendu normal)
  } else if (isTabBarHidden(role, normalizedPath)) {
    return null;
  }

  // SSR-safe portal mount gate — comes AFTER every existing pathname guard
  // so the guards still run on first render (avoiding unnecessary work) and
  // the `mounted` check fires last, right before we try to access
  // `document.body`.
  if (!mounted) return null;

  // Le partenaire ne voit que ce qu'il a le droit d'ouvrir (évaluer) ; la barre choisie, sinon le défaut.
  const visible = (t: TabConfig) => role !== "partenaire" || entreeVisible(t.href, peutEvaluer);
  const poolBarre = roleBarre ? POOL_BY_ROLE[roleBarre].filter(visible) : [];
  const tabs = roleBarre
    ? resoudreBarre(choixBarre, poolBarre, TABS_BY_ROLE[roleBarre].filter(visible))
    : TABS_BY_ROLE[role];

  function isActive(tab: TabConfig): boolean {
    if (tab.exact) return normalizedPath === tab.href;
    const matchStr = tab.activeMatch ?? tab.href;
    const parts = matchStr.split("|");
    return parts.some((p) => pathname === p || pathname.startsWith(p + "/"));
  }

  function handleTabClick(e: React.MouseEvent, tab: TabConfig) {
      /* Retour AVANT le test de verrou, et donc dans les deux cas : l'onglet
         navigue, ou il ouvre la modale d'abonnement. Le doigt a touché quelque
         chose, l'app doit le confirmer — un tap verrouillé qui ne répond pas se
         lit comme un tap perdu. Impact léger : c'est de la navigation, pas une
         action destructive. */
      void triggerHaptic("Light");
      /* `!tierLoading` : tant que le tier n'est pas chargé on ne verrouille pas,
         sinon un onglet légitime clignoterait en verrouillé au montage. */
      const locked = !tierLoading && !meetsRequiredTier(tier, tab.requiredTier, isSchoolAdmin, tab.adminBypass);
    if (locked && tab.requiredTier) {
      e.preventDefault();
      setUpgradeModal({
        tierId: tab.requiredTier === "all_star" ? "rec_allstar" : "rec_pro",
        lockedFeatureTitle: tab.label,
      });
    }
  }

  return createPortal(
    <>
      <nav
        className="fixed z-40 flex"
        style={{
          // Bulle flottante premium (style Instagram) : détachée des bords +
          // décollée du bas, pilule arrondie, fond semi-opaque + blur (le
          // contenu transparaît derrière), ombre douce pour le détachement.
          left: 14,
          right: 14,
          bottom: "calc(env(safe-area-inset-bottom) + 10px)",
          borderRadius: 30,
          background: "rgba(26, 29, 36, 0.85)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.45)",
          overflow: "hidden",
        }}
        aria-label="Navigation principale"
      >
        {tabs.map((tab) => {
          // Pas de cadenas tant que le tier n'est pas chargé (évite le flash free).
          const locked = !tierLoading && !meetsRequiredTier(tier, tab.requiredTier, isSchoolAdmin, tab.adminBypass);
          const active = isActive(tab);
          // Badge par tab key : messages (recruteur), a-traiter (coach).
          const tabBadgeCount =
            tab.key === "messages" ? msgBadge
            : tab.key === "a-traiter" ? aTraiterBadge
            : 0;
          const showBadge = tabBadgeCount > 0 && !locked;
          // Badge Messages VERT (#22C55E) pour athlète ET coach ; les autres rouges.
          const badgeBg = (role === "athlete" || role === "coach") && tab.key === "messages" ? "bg-[#22C55E]" : "bg-[#E63946]";
          const color = active ? "text-[#E63946]" : locked ? "text-[#8a8d96]/60" : "text-[#8a8d96]";
          return (
            <Link
              key={tab.key}
              href={tab.href}
              onClick={(e) => { void triggerHaptic("Light"); handleTabClick(e, tab); }}
              className={`relative flex-1 flex flex-col items-center justify-center gap-1.5 pt-2.5 pb-2 min-h-[64px] ${color} active:bg-white/[0.04] transition-colors`}
              aria-current={active ? "page" : undefined}
            >
              {/* Capsule de fond derrière l'item actif (style pill Instagram). */}
              {active && (
                <span
                  aria-hidden
                  className="absolute inset-x-1.5 top-1.5 bottom-1.5 rounded-2xl bg-[#E63946]/[0.12]"
                />
              )}
              <span className="relative">
                {tab.icon}
                {locked && tab.requiredTier && <LockIcon />}
                {showBadge && (
                  <span className={`absolute -top-1.5 -right-2 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full ${badgeBg} text-white text-[9px] font-black leading-none`}>
                    {tabBadgeCount > 99 ? "99+" : tabBadgeCount}
                  </span>
                )}
              </span>
              <span className="relative text-[11px] font-medium tracking-[0.04em] whitespace-nowrap">{tab.label}</span>
            </Link>
          );
        })}

        {/* "Plus" — ouvre le bottom sheet */}
        <button
          type="button"
          onClick={() => { void triggerHaptic("Light"); setMoreOpen(true); }}
          className={`relative flex-1 flex flex-col items-center justify-center gap-1.5 pt-2.5 pb-2 min-h-[64px] ${moreOpen ? "text-[#E63946]" : "text-[#8a8d96]"} active:bg-white/[0.04] transition-colors`}
          aria-label="Plus d'options"
          aria-expanded={moreOpen}
        >
          {/* Capsule de fond quand le panneau "Plus" est ouvert. */}
          {moreOpen && (
            <span
              aria-hidden
              className="absolute inset-x-1.5 top-1.5 bottom-1.5 rounded-2xl bg-[#E63946]/[0.12]"
            />
          )}
          <span className="relative">
            {Icons.more}
            {moreDotActive && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#E63946]" aria-hidden />
            )}
          </span>
          <span className="relative text-[11px] font-medium tracking-[0.04em] whitespace-nowrap">Plus</span>
        </button>
      </nav>

      {personnaliser && roleBarre && (
        <PersonnaliserBarre
          pool={poolBarre.map((t) => ({ key: t.key, label: t.label, icon: t.icon }))}
          actuels={tabs.map((t) => t.key)}
          onFermer={() => setPersonnaliser(false)}
          onEnregistrer={(cles) => enregistrerBarre(cles)}
          onDefaut={() => enregistrerBarre(null)} />
      )}

      <MorePanel
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        role={role}
        tier={tier}
        tierLoading={tierLoading}
        isSchoolAdmin={isSchoolAdmin}
        actBadge={actBadge}
        onLockedClick={(tierId, label) => setUpgradeModal({ tierId, lockedFeatureTitle: label })}
      />

      {upgradeModal && (
        <UpgradeModal
          open={!!upgradeModal}
          onClose={() => setUpgradeModal(null)}
          role="recruteur"
          tierId={upgradeModal.tierId}
          lockedFeatureTitle={upgradeModal.lockedFeatureTitle}
        />
      )}
    </>,
    document.body,
  );
}
