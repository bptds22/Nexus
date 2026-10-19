"use client";

/* ═══════════════════════════════════════════════════════════════
   MesAthletesMobile — « Mes athlètes » (cartes prospects) dans l'APPLI
   (1.4.5, demande BP : « un feeling natif, pas web »).

   Mêmes données et mêmes règles que la page web (app/partenaire/prospects) :
   tout passe par les RPC de lib/partenaires/prospects ; le statut affiché est
   celui que rend le serveur (masqué, Loi 25) ; aucune puce d'ouverture ; le
   lien n'est affiché qu'une fois (EnvoyerLien) et bâti sur le domaine public
   (adressePublique), jamais sur l'adresse locale de la WebView.

   Fusion du 2026-10-18 (6.1) : c'est la pastille « En attente » de « Mes
   athlètes » (en-tête et pastilles posés par MesAthletesPartenaire). Cartes
   ROUGES comme les cartes prospect du recruteur (SURFACE_PROSPECT) ; plus de
   quota de cartes (BP : aucun maximum) ; les réclamées visibles passent dans
   « Mes évaluations », les autres issues sont repliées sous « Cartes terminées ».

   Canon recruteur copié :
   - rangées rounded-2xl #1A1D24 + bouton ⋮ (RecruteurListesMobile) ; un tap
     ouvre la feuille d'actions iOS (copie locale de ListActionSheet) ;
   - ce qui tue un lien ou une carte passe par ConfirmSheet, avec les MÊMES
     phrases que les confirmations du web ;
   - avis en toasts (useMobileToast), chargement en squelettes.
   Tout ce qui est fixe est porté sur <body> (AnimatedRoute piège le fixed).
═══════════════════════════════════════════════════════════════ */

import NotesDepistageCarte from "@/components/partenaire/NotesDepistageCarte";
import { useComptesDepistagePartenaire } from "@/lib/gameOn/useGameOn";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import FormulaireCarte from "@/components/partenaire/prospects/FormulaireCarte";
import EnvoyerLien from "@/components/partenaire/prospects/EnvoyerLien";
import {
  BandeauRapprochementsPartenaire, FenetreRapprochementsPartenaire, LienRapprochementCarte,
} from "@/components/partenaire/prospects/RapprochementsPartenaire";
import { chargerRapprochements, parCarte, type RapprochementPartenaire } from "@/lib/partenaires/rapprochements";
import { adressePublique } from "@/lib/partage/adressePublique";
import {
  adresseLien,
  chargerCartesTerminees,
  chargerMesCartes,
  genererLien,
  LIBELLE_EVALUATION_TRANSFERT,
  LIBELLE_ISSUE,
  LIBELLE_RAISON_BADGE,
  LIBELLE_STATUT,
  messageErreurCarte,
  revoquerLien,
  supprimerCarte,
  type CartePartenaire,
  type CarteTerminee,
} from "@/lib/partenaires/prospects";
import { SURFACE_PROSPECT } from "@/components/recruteur/cartes/PanneauCarte";
import { estReclameeVisible } from "@/lib/partenaires/vueMesAthletes";
import { ConfirmSheet } from "@/components/shared/settings";
import { EmptyState } from "@/components/mobile/EmptyState";
import { useMobileToast } from "@/components/mobile/MobileToast";
import { triggerHaptic } from "@/lib/haptics";

interface Partenaire { id: string; organizationName: string; peutEvaluer: boolean; approuve: boolean }
type ActionConfirmee = "supprimer" | "nouveau-lien" | "revoquer";

/** Pastille de statut (mêmes tons que le web : neutre / succès / attention). */
const COULEUR_STATUT: Record<CartePartenaire["statut"], string> = {
  A_ENVOYER: "bg-white/[0.08] text-[#c8c8cc]",
  ENVOYEE: "bg-[#22C55E]/15 text-[#4ADE80]",
  CORRESPONDANCE_POSSIBLE: "bg-[#F59E0B]/15 text-[#FCD34D]",
};

/** Les phrases des confirmations du web, découpées en titre + message. */
const CONFIRMATIONS: Record<ActionConfirmee, { titre: string; message: string; bouton: string; variante: "danger" | "warning" }> = {
  supprimer: { titre: "Supprimer cette carte ?", message: "Le lien cessera de fonctionner.", bouton: "Supprimer", variante: "danger" },
  revoquer: { titre: "Révoquer le lien ?", message: "Le jeune ne pourra plus l'ouvrir.", bouton: "Révoquer le lien", variante: "warning" },
  "nouveau-lien": { titre: "Créer un nouveau lien ?", message: "L'ancien cessera de fonctionner.", bouton: "Nouveau lien", variante: "warning" },
};

function dateCourte(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" });
}
function joursRestants(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

/** Vrai seulement après l'hydratation : un portail n'est jamais rendu au serveur. */
function useMonte(): boolean {
  return useSyncExternalStore(() => () => {}, () => true, () => false);
}

function Etoiles({ cote }: { cote: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Cote ${cote.toFixed(1)} sur 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width="13" height="13" viewBox="0 0 24 24" fill={i <= Math.round(cote) ? "#F59E0B" : "#4a4d56"}>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
      <span className="ml-1 text-[12px] text-[#9CA3AF]">{cote.toFixed(1)}</span>
    </span>
  );
}

/* ── Feuille d'actions iOS (copie locale de ListActionSheet) ───── */

interface ActionFeuille {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

function FeuilleActions({ open, titre, onClose, actions }: {
  open: boolean;
  titre?: string;
  onClose: () => void;
  actions: ActionFeuille[];
}) {
  const monte = useMonte();
  if (!monte) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/60"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.28, ease: [0.34, 1.56, 0.64, 1] }}
            className="fixed inset-x-3 bottom-3 z-[75] flex flex-col gap-2"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            role="dialog" aria-modal="true" data-feuille-actions-carte
          >
            <div className="rounded-2xl bg-[#1A1D24] overflow-hidden">
              {titre && (
                <p className="px-4 py-3 text-center text-[13px] font-semibold text-[#9CA3AF] border-b border-white/[0.06] truncate">{titre}</p>
              )}
              {actions.map((a, idx) => (
                <button
                  key={a.label}
                  type="button"
                  disabled={a.disabled}
                  onClick={a.disabled ? undefined : () => { void triggerHaptic("Light"); a.onClick(); }}
                  className={`w-full flex items-center gap-3 px-4 h-14 text-left transition-colors ${
                    idx > 0 ? "border-t border-white/[0.06]" : ""
                  } ${a.disabled ? "opacity-40" : "active:bg-white/[0.04]"}`}
                >
                  <span className="flex-shrink-0">{a.icon}</span>
                  <span className={`text-[15px] font-medium ${a.destructive ? "text-[#E63946]" : "text-white"}`}>{a.label}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl bg-[#1A1D24] h-14 text-[15px] font-bold text-white active:bg-white/[0.04] transition-colors"
            >
              Annuler
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

const icone = (d: ReactNode, couleur = "#FFFFFF") => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={couleur} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);
const ICONES = {
  texto: icone(<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />),
  nouveau: icone(<><path d="M23 4v6h-6" /><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" /></>),
  modifier: icone(<><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z" /></>),
  revoquer: icone(<><circle cx="12" cy="12" r="10" /><path d="M4.93 4.93l14.14 14.14" /></>),
  supprimer: icone(<><path d="M3 6h18" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" /></>, "#E63946"),
};

/* ── Rangée d'une carte active ────────────────────────────────── */

function RangeeCarte({ c, noms, occupe, nbRapprochements, nbDepistage = 0, onOptions, onVoirRapprochements }: {
  c: CartePartenaire;
  noms: { sports: Record<string, string>; positions: Record<string, string>; ecoles: Record<string, string>; equipes: Record<string, string> };
  occupe: boolean;
  nbRapprochements: number;
  /** Notes de dépistage liées à la carte (BP 2026-10-19). */
  nbDepistage?: number;
  onOptions: () => void;
  onVoirRapprochements: () => void;
}) {
  const lieu = [c.teamId ? noms.equipes[c.teamId] : null, c.schoolId ? noms.ecoles[c.schoolId] : null].filter(Boolean).join(" · ");
  const jours = joursRestants(c.expireLe);
  const nbBadges = c.badgesPartenaire.length + c.badgesNexus.length;
  return (
    <div className={`relative rounded-2xl overflow-hidden border border-[#E63946]/25 ${occupe ? "opacity-60" : ""}`}
      style={{ backgroundColor: SURFACE_PROSPECT }} data-carte-prospect={c.id}>
      <button
        type="button"
        disabled={occupe}
        onClick={() => { void triggerHaptic("Light"); onOptions(); }}
        className="w-full text-left pl-4 pr-12 pt-4 pb-3 active:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[16px] font-bold text-white truncate">{c.prenom} {c.nom}</p>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${COULEUR_STATUT[c.statut]}`} data-statut={c.statut}>
            {LIBELLE_STATUT[c.statut]}
          </span>
        </div>
        <p className="text-[14px] text-white/70 mt-1 truncate">
          {[noms.sports[c.sportId], c.positionId ? noms.positions[c.positionId] : null, c.promotion ? `Promotion ${c.promotion}` : null].filter(Boolean).join(" · ")}
        </p>
        {lieu && <p className="text-[13px] text-white/50 mt-0.5 truncate">{lieu}</p>}
        <div className="flex items-center gap-3 flex-wrap mt-2">
          {c.coteGlobale != null ? <Etoiles cote={c.coteGlobale} /> : <span className="text-[12px] text-[#6b7280]">Sans évaluation</span>}
          {nbBadges > 0 && (
            <span className="text-[12px] text-[#F59E0B]">{nbBadges} badge{nbBadges > 1 ? "s" : ""}</span>
          )}
        </div>
        <p className={`text-[11px] mt-2 ${jours <= 7 ? "text-[#F59E0B]" : "text-white/40"}`}>
          Expire le {dateCourte(c.expireLe)}{jours <= 7 ? ` (${jours} j)` : ""}
        </p>
      </button>
      <button
        type="button"
        disabled={occupe}
        onClick={() => { void triggerHaptic("Light"); onOptions(); }}
        aria-label="Plus d'options"
        className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-white/55 active:bg-white/[0.08]"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>
      {/* P2/P3 : c'est le partenaire qui décide, comme le recruteur. Hors du bouton de la rangée. */}
      {nbRapprochements > 0 && (
        <div className="px-4 pb-3 -mt-2">
          <LienRapprochementCarte n={nbRapprochements} onVoir={onVoirRapprochements} />
        </div>
      )}
      {nbDepistage > 0 && (
        <div className="px-4 pb-3 -mt-2">
          <NotesDepistageCarte carteId={c.id} nb={nbDepistage} />
        </div>
      )}
    </div>
  );
}

/* ── Rangée d'une carte terminée ──────────────────────────────── */

function RangeeTerminee({ t }: { t: CarteTerminee }) {
  return (
    <div className="bg-[#1A1D24] rounded-2xl px-4 py-4" data-terminee={t.issue}>
      <p className="text-[15px] font-semibold text-white">
        {t.issue === "RECLAMEE" && !t.profilVisible ? "Réclamée — profil non visible" : LIBELLE_ISSUE[t.issue]}
      </p>
      <p className="text-[12px] text-white/40 mt-1">
        Carte du {dateCourte(t.creeLe)} · terminée le {dateCourte(t.termineeLe)}
      </p>
      {t.profilVisible && (
        <div className="mt-3 rounded-xl bg-[#111317] border border-white/[0.06] px-3 py-2.5" data-reclamee-visible>
          <p className="text-[14px] font-semibold text-white">{`${t.prenom ?? ""} ${t.nom ?? ""}`.trim()}</p>
          <p className="text-[12px] text-[#9CA3AF]">
            {[t.sport, t.poste, t.ecole].filter(Boolean).join(" · ") || "—"}
          </p>
          <p className="text-[12px] text-[#c8c8cc] mt-1.5">
            {t.evaluation ? LIBELLE_EVALUATION_TRANSFERT[t.evaluation] ?? t.evaluation : "—"}
          </p>
          {t.badges.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {t.badges.map((b, i) => (
                <li key={i} className="text-[12px]">
                  <span className={b.transfere ? "text-[#22C55E]" : "text-[#F59E0B]"}>
                    {b.transfere ? "✓ Badge transféré" : "Badge sauté"}
                  </span>
                  <span className="text-white"> : {b.libelle ?? "—"}</span>
                  {!b.transfere && b.raison && (
                    <span className="text-[#9CA3AF]"> ({LIBELLE_RAISON_BADGE[b.raison] ?? b.raison})</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {t.profilVisible && t.athleteId && (
        <Link href={`/partenaire/athletes/${t.athleteId}`} onClick={() => { void triggerHaptic("Light"); }}
          className="mt-3 flex items-center justify-center h-11 rounded-xl bg-white/[0.06] active:bg-white/[0.10] text-[14px] font-semibold text-white">
          Voir sa fiche
        </Link>
      )}
    </div>
  );
}

function Squelettes() {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-28 rounded-2xl bg-[#1A1D24] animate-pulse" />
      ))}
    </div>
  );
}

/* ── Écran ────────────────────────────────────────────────────── */

export default function MesAthletesMobile({ propositionsSeulement = false, onToutVoir }: {
  /** Venue de « À confirmer » (Accueil) : seulement les cartes avec une proposition. */
  propositionsSeulement?: boolean;
  onToutVoir?: () => void;
}) {
  const toast = useMobileToast();
  const [partenaire, setPartenaire] = useState<Partenaire | null>(null);
  const [sportsPermis, setSportsPermis] = useState<{ id: string; nom: string }[]>([]);
  const [cartes, setCartes] = useState<CartePartenaire[]>([]);
  const [terminees, setTerminees] = useState<CarteTerminee[]>([]);
  const [noms, setNoms] = useState<{ sports: Record<string, string>; positions: Record<string, string>; ecoles: Record<string, string>; equipes: Record<string, string> }>({ sports: {}, positions: {}, ecoles: {}, equipes: {} });
  const [chargement, setChargement] = useState(true);
  const [erreurChargement, setErreurChargement] = useState(false);
  const [terminesOuvertes, setTerminesOuvertes] = useState(false);
  const [formulaire, setFormulaire] = useState<{ carte: CartePartenaire | null } | null>(null);
  const [lien, setLien] = useState<{ carteId: string; adresse: string; evalue: boolean } | null>(null);
  // P2/P3 (1.4.5) : correspondances possibles de mes cartes, et la fenêtre ouverte (une carte, ou toutes).
  const [rapprochements, setRapprochements] = useState<RapprochementPartenaire[]>([]);
  const [fenetre, setFenetre] = useState<{ carteId?: string } | null>(null);
  const [menu, setMenu] = useState<CartePartenaire | null>(null);
  const [confirmation, setConfirmation] = useState<{ carteId: string; action: ActionConfirmee } | null>(null);
  const [occupe, setOccupe] = useState<string | null>(null);

  const charger = useCallback(async () => {
    const supabase = createClient();
    try {
      const [c, t] = await Promise.all([chargerMesCartes(supabase), chargerCartesTerminees(supabase)]);
      setCartes(c);
      setTerminees(t);
      // Lecture en échec (migration pas encore en prod) : aucune proposition, l'écran reste utilisable.
      setRapprochements(await chargerRapprochements(supabase).catch(() => []));
      // Libellés lisibles : sports, positions, établissements et équipes des cartes.
      const ids = (f: (x: CartePartenaire) => string | null) => [...new Set(c.map(f).filter((x): x is string => !!x))];
      const [sp, po, ec, eq] = await Promise.all([
        supabase.from("sports").select("id, nom"),
        ids((x) => x.positionId).length ? supabase.from("positions").select("id, nom, abreviation").in("id", ids((x) => x.positionId)) : Promise.resolve({ data: [] }),
        ids((x) => x.schoolId).length ? supabase.from("schools").select("id, name").in("id", ids((x) => x.schoolId)) : Promise.resolve({ data: [] }),
        ids((x) => x.teamId).length ? supabase.from("teams").select("id, name, age_group, division").in("id", ids((x) => x.teamId)) : Promise.resolve({ data: [] }),
      ]);
      setNoms({
        sports: Object.fromEntries(((sp.data ?? []) as { id: string; nom: string }[]).map((r) => [r.id, r.nom])),
        positions: Object.fromEntries(((po.data ?? []) as { id: string; nom: string }[]).map((r) => [r.id, r.nom])),
        ecoles: Object.fromEntries(((ec.data ?? []) as { id: string; name: string }[]).map((r) => [r.id, r.name])),
        equipes: Object.fromEntries(((eq.data ?? []) as { id: string; name: string; age_group: string | null; division: string | null }[])
          .map((r) => [r.id, [r.age_group, r.division].filter(Boolean).join(" ") || r.name])),
      });
      setErreurChargement(false);
    } catch (e) {
      console.error("[prospects mobile] chargement :", (e as { message?: string })?.message ?? e);
      setErreurChargement(true);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: mp } = await supabase.from("media_partners")
        .select("id, organization_name, peut_evaluer, status").eq("user_id", user.id).maybeSingle();
      if (mp) {
        setPartenaire({ id: mp.id as string, organizationName: (mp.organization_name as string) ?? "", peutEvaluer: !!mp.peut_evaluer, approuve: mp.status === "APPROVED" });
        const { data: permis } = await supabase.from("partenaire_sports_permis")
          .select("sport_id, sports!sport_id(nom)").eq("partner_id", mp.id);
        setSportsPermis(((permis ?? []) as { sport_id: string; sports: { nom: string } | { nom: string }[] | null }[])
          .map((r) => ({ id: r.sport_id, nom: (Array.isArray(r.sports) ? r.sports[0]?.nom : r.sports?.nom) ?? "" }))
          .sort((a, b) => a.nom.localeCompare(b.nom, "fr")));
      }
      await charger();
      setChargement(false);
    })();
  }, [charger]);

  const autorise = !!partenaire?.peutEvaluer && partenaire.approuve && sportsPermis.length > 0;

  const nouvelleCarte = () => setFormulaire({ carte: null });

  const envoyer = async (carteId: string) => {
    setOccupe(carteId);
    setConfirmation(null);
    try {
      const jeton = await genererLien(createClient(), carteId);
      // Domaine public (NEXT_PUBLIC_APP_URL), jamais l'adresse locale de la WebView de l'appli.
      // Le texto ne dit « t'a évalué » que si la carte porte une évaluation.
      const evalue = cartes.find((c) => c.id === carteId)?.coteGlobale != null;
      setLien({ carteId, adresse: adresseLien(adressePublique(), jeton), evalue });
      await charger();
    } catch (e) {
      toast.error({ message: messageErreurCarte(e, "Le lien n'a pas pu être créé."), duration: 3000 });
    } finally {
      setOccupe(null);
    }
  };

  const revoquer = async (carteId: string) => {
    setOccupe(carteId);
    setConfirmation(null);
    try {
      await revoquerLien(createClient(), carteId);
      toast.success({ message: "Lien révoqué", detail: "Il ne fonctionne plus." });
      await charger();
    } catch (e) {
      toast.error({ message: messageErreurCarte(e, "Le lien n'a pas pu être révoqué."), duration: 3000 });
    } finally {
      setOccupe(null);
    }
  };

  const supprimer = async (carteId: string) => {
    setOccupe(carteId);
    setConfirmation(null);
    try {
      await supprimerCarte(createClient(), carteId);
      toast.success({ message: "Carte supprimée." });
      await charger();
    } catch (e) {
      toast.error({ message: messageErreurCarte(e, "La carte n'a pas pu être supprimée."), duration: 3000 });
    } finally {
      setOccupe(null);
    }
  };

  const confirmer = () => {
    if (!confirmation) return;
    const { carteId, action } = confirmation;
    void (action === "supprimer" ? supprimer(carteId) : action === "revoquer" ? revoquer(carteId) : envoyer(carteId));
  };

  const demander = (carteId: string, action: ActionConfirmee) => {
    setMenu(null);
    setConfirmation({ carteId, action });
  };

  const actionsMenu = (c: CartePartenaire): ActionFeuille[] => {
    const lienEnvoye = c.statut !== "A_ENVOYER";
    const bloque = occupe === c.id;
    return [
      lienEnvoye
        ? { label: "Nouveau lien", icon: ICONES.nouveau, disabled: bloque, onClick: () => demander(c.id, "nouveau-lien") }
        : { label: "Envoyer par texto", icon: ICONES.texto, disabled: bloque, onClick: () => { setMenu(null); void envoyer(c.id); } },
      { label: "Modifier", icon: ICONES.modifier, disabled: bloque, onClick: () => { setMenu(null); setFormulaire({ carte: c }); } },
      ...(lienEnvoye
        ? [{ label: "Révoquer le lien", icon: ICONES.revoquer, disabled: bloque, onClick: () => demander(c.id, "revoquer") }]
        : []),
      { label: "Supprimer", icon: ICONES.supprimer, destructive: true, disabled: bloque, onClick: () => demander(c.id, "supprimer") },
    ];
  };

  const nbParCarte = useMemo(() => parCarte(rapprochements), [rapprochements]);
  const comptesDepistage = useComptesDepistagePartenaire().data;
  // Les réclamations dont le jeune est visible vivent dans « Mes évaluations » (6.1).
  const terminesTries = useMemo(() => [...terminees].filter((t) => !estReclameeVisible(t))
    .sort((a, b) => b.termineeLe.localeCompare(a.termineeLe)), [terminees]);
  const cartesVisibles = useMemo(() => (propositionsSeulement ? cartes.filter((c) => (nbParCarte.get(c.id) ?? 0) > 0) : cartes),
    [cartes, nbParCarte, propositionsSeulement]);
  const textesConfirmation = confirmation ? CONFIRMATIONS[confirmation.action] : null;

  return (
    <div className="text-white" data-page-prospects-mobile data-vue-attente>
      <div className="px-4 pt-3 pb-6">
        {chargement ? (
          <Squelettes />
        ) : (
          <>
            {rapprochements.length > 0 && (
              <div className="mb-4"><BandeauRapprochementsPartenaire total={rapprochements.length} onVoir={() => setFenetre({})} /></div>
            )}

            {!autorise ? (
              <EmptyState
                image="/empty/nexus-empty-shortlist.png"
                title="Les cartes prospects sont réservées aux partenaires évaluateurs."
                description={partenaire && !partenaire.approuve
                  ? "Ton organisation n'est pas encore approuvée."
                  : "Ton organisation n'a pas encore la permission d'évaluer, ou aucun sport ne lui est attribué. Écris à l'équipe Nexus pour en parler."}
              />
            ) : erreurChargement ? (
              <div className="flex flex-col items-center justify-center px-6 py-16 text-center gap-4">
                <p className="text-[14px] text-white/70 max-w-sm">
                  Tes cartes n&apos;ont pas pu être chargées. Vérifie ta connexion.
                </p>
                <button
                  type="button"
                  onClick={() => { void triggerHaptic("Light"); void charger(); }}
                  className="px-5 h-11 bg-[#E63946] active:bg-[#D42B22] text-white font-bold uppercase tracking-widest text-[13px] rounded-xl"
                >
                  Réessayer
                </button>
              </div>
            ) : (
              <>
                <button type="button" onClick={() => { void triggerHaptic("Medium"); nouvelleCarte(); }}
                  className="mb-4 w-full h-12 rounded-2xl bg-[#E63946] active:bg-[#D42B22] text-white text-[15px] font-bold flex items-center justify-center gap-2"
                  data-nouvelle-carte>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
                  Nouvelle carte
                </button>
                {propositionsSeulement && (
                  <div className="mb-3 flex items-center gap-2" data-filtre-propositions>
                    <span className="px-3 py-1.5 rounded-full text-[12px] font-bold bg-[#E63946]/15 text-white border border-[#E63946]/40">Propositions à confirmer seulement</span>
                    {onToutVoir && (
                      <button type="button" onClick={() => { void triggerHaptic("Light"); onToutVoir(); }}
                        className="min-h-[36px] px-2 text-[13px] font-bold text-[#9CA3AF] active:text-white">Tout voir</button>
                    )}
                  </div>
                )}

                {cartesVisibles.length === 0 ? (
                  propositionsSeulement ? (
                    <EmptyState image="/empty/nexus-empty-vues.png" title="Aucune proposition à confirmer"
                      description="Toutes les correspondances possibles ont été traitées." />
                  ) : (
                    <EmptyState
                      image="/empty/nexus-empty-shortlist.png"
                      title="Aucune carte pour l'instant"
                      description="Crée ta première carte, puis envoie le lien au jeune par texto."
                      action={{ label: "Créer ma première carte", onClick: () => { void triggerHaptic("Medium"); nouvelleCarte(); } }}
                    />
                  )
                ) : (
                    <div className="space-y-3">
                      {cartesVisibles.map((c) => (
                        <RangeeCarte
                          key={c.id}
                          c={c}
                          noms={noms}
                          occupe={occupe === c.id}
                          nbRapprochements={nbParCarte.get(c.id) ?? 0}
                          nbDepistage={comptesDepistage?.get(c.id) ?? 0}
                          onOptions={() => setMenu(c)}
                          onVoirRapprochements={() => setFenetre({ carteId: c.id })}
                        />
                      ))}
                    </div>
                )}

                {terminesTries.length > 0 && !propositionsSeulement && (
                  <div className="mt-6" data-section-terminees>
                    <button type="button" aria-expanded={terminesOuvertes}
                      onClick={() => { void triggerHaptic("Light"); setTerminesOuvertes((v) => !v); }}
                      className="w-full flex items-center justify-between px-1 min-h-[44px] text-[13px] font-bold uppercase tracking-[0.12em] text-white/60">
                      Cartes terminées ({terminesTries.length})
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                        className={`transition-transform ${terminesOuvertes ? "rotate-180" : ""}`}><path d="M6 9l6 6 6-6" /></svg>
                    </button>
                    {terminesOuvertes && (
                      <>
                        <p className="text-[12px] text-white/40 mb-3 px-1">
                          Les cartes expirées ou retirées restent sans nom. Une carte réclamée passe dans « Mes évaluations ».
                        </p>
                        <div className="space-y-3">
                          {terminesTries.map((t) => <RangeeTerminee key={`${t.carteId}-${t.termineeLe}`} t={t} />)}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      <FeuilleActions
        open={!!menu}
        titre={menu ? `${menu.prenom} ${menu.nom}` : undefined}
        onClose={() => setMenu(null)}
        actions={menu ? actionsMenu(menu) : []}
      />
      <ConfirmSheet
        open={!!confirmation}
        onClose={() => setConfirmation(null)}
        title={textesConfirmation?.titre ?? ""}
        message={textesConfirmation?.message ?? ""}
        confirmLabel={textesConfirmation?.bouton ?? ""}
        variant={textesConfirmation?.variante ?? "danger"}
        confirmDisabled={!!confirmation && occupe === confirmation.carteId}
        onConfirm={confirmer}
      />

      {fenetre && (
        <FenetreRapprochementsPartenaire
          propositions={fenetre.carteId ? rapprochements.filter((r) => r.carteId === fenetre.carteId) : rapprochements}
          carte={(id) => {
            const c = cartes.find((x) => x.id === id);
            if (!c) return null;
            return { nom: `${c.prenom} ${c.nom}`, ecole: c.schoolId ? noms.ecoles[c.schoolId] ?? null : null, promotion: c.promotion, sport: noms.sports[c.sportId] ?? null };
          }}
          onFermer={() => setFenetre(null)}
          onDecide={() => void charger()}
        />
      )}
      {formulaire && (
        <FormulaireCarte
          sports={sportsPermis}
          carte={formulaire.carte}
          onClose={() => setFormulaire(null)}
          onEnregistree={(_id, nouvelle) => {
            setFormulaire(null);
            if (nouvelle) toast.success({ message: "Carte créée.", detail: "Envoie-lui maintenant le lien." });
            else toast.success({ message: "Carte enregistrée." });
            void charger();
          }}
        />
      )}
      {lien && partenaire && (
        <EnvoyerLien organisation={partenaire.organizationName} adresse={lien.adresse} evalue={lien.evalue}
          onClose={() => setLien(null)} />
      )}
    </div>
  );
}
