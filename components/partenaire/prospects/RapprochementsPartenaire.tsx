"use client";

/* ═══════════════════════════════════════════════════════════════
   RapprochementsPartenaire — P2/P3 (1.4.5), « comme le recruteur ».

   · BandeauRapprochementsPartenaire : en tête de « Mes athlètes », comme
     BandeauRapprochements du recruteur (sans nombre — C2) ;
   · LienRapprochementCarte : « Un profil semble correspondre → voir » sur
     la carte ;
   · FenetreRapprochementsPartenaire : la carte et le profil côte à côte,
     Refuser / Accepter (rouge). Modale au web, feuille du bas dans l'appli
     (portée sur <body>).
   Accepter = le transfert de « C'est moi » : ton évaluation et tes badges
   passent sur le profil, la carte se termine (annulable 7 jours par Nexus).
═══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import AthletePhoto from "@/components/shared/AthletePhoto";
import {
  accepterRapprochement, chargerRefusesPartenaire, EVENEMENT_REFUSEES_PARTENAIRE, libelleNiveauPartenaire,
  refuserRapprochement, reproposerRapprochementPartenaire, type RapprochementPartenaire, type RapprochementRefusePartenaire,
} from "@/lib/partenaires/rapprochements";
import { classesBouton } from "@/components/partenaire/kit/KitPartenaire";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

/** Ce que la page sait de la carte (libellés déjà résolus). */
export interface ResumeCarte { nom: string; ecole: string | null; promotion: number | null; sport: string | null }

/** Les refusées du partenaire, relues à chaque refus ou reproposition (BP 2026-10-19). */
function useRefusees(): RapprochementRefusePartenaire[] {
  const [liste, setListe] = useState<RapprochementRefusePartenaire[]>([]);
  useEffect(() => {
    let vivant = true;
    const charger = () => { void chargerRefusesPartenaire(createClient()).then((l) => { if (vivant) setListe(l); }); };
    charger();
    window.addEventListener(EVENEMENT_REFUSEES_PARTENAIRE, charger);
    return () => { vivant = false; window.removeEventListener(EVENEMENT_REFUSEES_PARTENAIRE, charger); };
  }, []);
  return liste;
}
const signalerRefusees = () => window.dispatchEvent(new Event(EVENEMENT_REFUSEES_PARTENAIRE));

export function BandeauRapprochementsPartenaire({ total, onVoir }: { total: number; onVoir: () => void }) {
  const refusees = useRefusees();
  if (total === 0) {
    // Rien à décider, mais des refus à revoir : un lien discret (BP 2026-10-19).
    if (refusees.length === 0) return null;
    return (
      <div className="flex justify-end">
        <button type="button" onClick={onVoir} data-lien-refusees-partenaire
          className="min-h-[36px] text-[12px] font-semibold text-[#9CA3AF] underline hover:text-white">
          Propositions refusées ({refusees.length})
        </button>
      </div>
    );
  }
  return (
    <div role="note" data-bandeau-rapprochements-partenaire
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#3B82F6]/30 bg-[#3B82F6]/[0.07] px-4 py-3">
      <p className="text-[13px] text-[#E5E7EB]">
        <span className="font-bold text-white">{total > 1 ? "Des profils semblent" : "Un profil semble"}</span>{" "}
        correspondre à tes cartes : un athlète déjà inscrit pourrait être l&apos;un de tes jeunes.
      </p>
      <button type="button" onClick={onVoir} className={classesBouton("secondaire", true)}>
        Voir {total > 1 ? "les propositions" : "la proposition"}
      </button>
    </div>
  );
}

export function LienRapprochementCarte({ n, onVoir }: { n: number; onVoir: () => void }) {
  if (n === 0) return null;
  return (
    <button type="button" onClick={onVoir} data-lien-rapprochement
      className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-[#93C5FD] hover:text-white">
      {n > 1 ? "Des profils semblent correspondre" : "Un profil semble correspondre"} → voir
    </button>
  );
}

function Colonne({ titre, lignes, photo }: { titre: string; lignes: { libelle: string; valeur: React.ReactNode }[]; photo?: React.ReactNode }) {
  return (
    <div className="flex-1 min-w-0 rounded-xl border border-white/[0.07] bg-[#13151a] p-4">
      <div className="flex items-center gap-3 mb-3">
        {photo}
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#6b7280]">{titre}</p>
      </div>
      <dl className="space-y-1.5">
        {lignes.map((l) => (
          <div key={l.libelle} className="flex items-baseline justify-between gap-3">
            <dt className="text-[12px] text-[#6b7280] shrink-0">{l.libelle}</dt>
            <dd className="text-[13px] text-white text-right truncate">{l.valeur ?? <span className="text-[#4a4d56]">—</span>}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function FenetreRapprochementsPartenaire({ propositions, carte, onFermer, onDecide }: {
  propositions: RapprochementPartenaire[];
  /** Les libellés de la carte, par identifiant. */
  carte: (carteId: string) => ResumeCarte | null;
  onFermer: () => void;
  /** Après une décision réussie : la page recharge cartes et propositions. */
  onDecide: () => void;
}) {
  const [enCours, setEnCours] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);

  const decider = async (r: RapprochementPartenaire, choix: "accepter" | "refuser") => {
    const cle = `${r.carteId}:${r.athleteId}`;
    setEnCours(cle);
    try {
      const supabase = createClient();
      if (choix === "accepter") await accepterRapprochement(supabase, r);
      else { await refuserRapprochement(supabase, r); signalerRefusees(); }
      const c = carte(r.carteId);
      setMessage({
        ok: true,
        texte: choix === "accepter"
          ? `Accepté : ton évaluation et tes badges passent sur le profil de ${r.prenom} ${r.nom}. L'équipe Nexus peut annuler pendant 7 jours.`
          : `Refusé : ce profil ne sera plus proposé pour « ${c?.nom ?? "ta carte"} ». Tu le retrouves dans « Propositions refusées ».`,
      });
      onDecide();
    } catch (e) {
      const m = (e as { message?: string })?.message ?? "";
      setMessage({ ok: false, texte: m.startsWith("NEXUS:") ? m.replace(/^NEXUS:\s*/, "") : "La décision n'a pas pu être enregistrée. Réessaie." });
    } finally {
      setEnCours(null);
    }
  };

  const contenu = (
    <>
      <h3 id="titre-rapprochements-partenaire" className="font-head text-[18px] font-black text-white uppercase tracking-tight">Profils qui semblent correspondre</h3>
      <p className="text-[13px] text-[#9CA3AF] mt-1">
        Un athlète déjà inscrit sur Nexus semble être l&apos;un de tes jeunes. Compare, puis décide : si tu acceptes, ton évaluation et tes badges passent sur son profil.
      </p>
      {message && <p role="status" className={`mt-3 text-[13px] ${message.ok ? "text-[#E5E7EB]" : "text-[#fca5a5]"}`}>{message.texte}</p>}
      {propositions.length === 0 ? (
        <p className="mt-6 text-[14px] text-[#6b7280]">Aucune proposition en attente.</p>
      ) : propositions.map((r) => {
        const niveau = libelleNiveauPartenaire(r.critere);
        const c = carte(r.carteId);
        const cle = `${r.carteId}:${r.athleteId}`;
        return (
          <section key={cle} className="mt-5 border-t border-white/[0.07] pt-5" data-proposition-partenaire>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${niveau.fort ? "border-white/30 bg-white/5 text-white" : "border-[#F59E0B]/40 bg-[#F59E0B]/10 text-[#FCD34D]"}`}>
                {niveau.texte}
              </span>
              {r.dejaPropose && <span className="text-[12px] text-[#9CA3AF]">· Nexus lui a aussi demandé de confirmer</span>}
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Colonne titre="Ta carte prospect" lignes={[
                { libelle: "Nom", valeur: c?.nom },
                { libelle: "École", valeur: c?.ecole },
                { libelle: "Sport", valeur: c?.sport },
                { libelle: "Promotion", valeur: c?.promotion },
              ]} />
              <Colonne titre="Profil Nexus"
                photo={<div className="relative w-9 h-9 shrink-0"><AthletePhoto photoUrl={r.photoUrl ?? ""} firstName={r.prenom} lastName={r.nom} identityVisible size={36} /></div>}
                lignes={[
                  { libelle: "Nom", valeur: <Link href={`/partenaire/athletes/${r.athleteId}`} className="underline hover:text-[#E63946]">{r.prenom} {r.nom}</Link> },
                  { libelle: "École", valeur: r.ecole },
                  { libelle: "Sport", valeur: r.sport },
                  { libelle: "Promotion", valeur: r.promotion },
                ]} />
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3 mt-4">
              <button type="button" disabled={enCours === cle} onClick={() => void decider(r, "refuser")} className={classesBouton("secondaire")}>
                Refuser
              </button>
              <button type="button" disabled={enCours === cle} onClick={() => void decider(r, "accepter")} className={classesBouton("principal")}
                title="Ton évaluation et tes badges passent sur ce profil ; la carte se termine">
                Accepter
              </button>
            </div>
          </section>
        );
      })}
      <RefuseesPartenaire carte={carte} carteId={propositions.length > 0 && propositions.every((p) => p.carteId === propositions[0].carteId) ? propositions[0].carteId : null}
        onReproposee={(m) => { setMessage({ ok: true, texte: m }); onDecide(); }} />
    </>
  );

  if (typeof document === "undefined") return null;
  return createPortal(
    IS_CAPACITOR ? (
      <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-labelledby="titre-rapprochements-partenaire" data-feuille-rapprochements-partenaire>
        <div className="absolute inset-0 bg-black/60" onClick={onFermer} />
        <div className="absolute inset-x-0 bottom-0 flex max-h-[92vh] flex-col rounded-t-2xl bg-[#1A1D24] border-t border-white/[0.07]"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div className="flex justify-end px-2 pt-2">
            <button type="button" onClick={onFermer} aria-label="Fermer" className="w-11 h-11 rounded-full flex items-center justify-center active:bg-white/[0.08]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="overflow-y-auto px-4 pb-6">{contenu}</div>
        </div>
      </div>
    ) : (
      <div className="fixed inset-0 z-[90] flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="titre-rapprochements-partenaire" data-fenetre-rapprochements-partenaire>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onFermer} />
        <div className="relative bg-[#1A1D24] border border-white/[0.07] rounded-2xl p-6 max-w-3xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
          {contenu}
          <div className="flex justify-end mt-6">
            <button type="button" onClick={onFermer} className={classesBouton("discret")}>Fermer</button>
          </div>
        </div>
      </div>
    ),
    document.body,
  );
}

/** Les propositions refusées, repliées sous les autres : « Proposer de nouveau » les remet en haut. */
function RefuseesPartenaire({ carte, carteId, onReproposee }: {
  carte: (carteId: string) => ResumeCarte | null;
  /** Fenêtre ouverte depuis UNE carte : seulement ses refusées. */
  carteId: string | null;
  onReproposee: (message: string) => void;
}) {
  const toutes = useRefusees();
  const liste = carteId ? toutes.filter((r) => r.carteId === carteId) : toutes;
  const [ouvert, setOuvert] = useState(false);
  const [enCours, setEnCours] = useState<string | null>(null);
  if (liste.length === 0) return null;
  const reproposer = async (r: RapprochementRefusePartenaire) => {
    const cle = `${r.carteId}:${r.athleteId}`;
    setEnCours(cle);
    try {
      await reproposerRapprochementPartenaire(createClient(), r);
      signalerRefusees();
      onReproposee(`« ${r.prenom} ${r.nom} » est de nouveau proposé pour « ${carte(r.carteId)?.nom ?? "ta carte"} » : tu peux l'accepter plus haut.`);
    } finally {
      setEnCours(null);
    }
  };
  return (
    <section className="mt-6 border-t border-white/[0.07] pt-4" data-propositions-refusees-partenaire>
      <button type="button" onClick={() => setOuvert((v) => !v)} aria-expanded={ouvert}
        className="min-h-[40px] text-[12px] font-bold uppercase tracking-[0.12em] text-[#9CA3AF] hover:text-white">
        Propositions refusées ({liste.length}) {ouvert ? "▴" : "▾"}
      </button>
      {ouvert && (
        <ul className="mt-2 space-y-2">
          {liste.map((r) => {
            const cle = `${r.carteId}:${r.athleteId}`;
            return (
              <li key={cle} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-[#13151a] px-3 py-2.5">
                <span className="min-w-0 text-[13px] text-[#c8c8cc]">
                  <span className="font-semibold text-white">{carte(r.carteId)?.nom ?? "Ta carte"}</span> ↔ {r.prenom} {r.nom}
                  <span className="block text-[11px] text-[#6b7280]">
                    {libelleNiveauPartenaire(r.critere).texte}
                    {r.decideLe ? ` · refusé le ${new Date(r.decideLe).toLocaleDateString("fr-CA", { day: "numeric", month: "short" })}` : ""}
                  </span>
                </span>
                <button type="button" disabled={enCours === cle} onClick={() => void reproposer(r)} className={classesBouton("secondaire", true)}>
                  Proposer de nouveau
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
