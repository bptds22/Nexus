"use client";

/* ═══════════════════════════════════════════════════════════════
   AbonnementAgenda — « S'abonner à mon agenda » (décision BP 2026-10-01).

   Une adresse PRIVÉE par recruteur Pro : ses relances, les visites et les
   matchs ajoutés par son unité, dans Google Agenda, Outlook ou toute app qui lit
   le webcal://. Mode « partenaire » (BP 2026-10-09) : les matchs que le
   partenaire APPROVED a ajoutés avec « + » sur la carte des matchs (jeton nxp_).

   Le jeton n'est stocké que HACHÉ : l'adresse s'affiche UNE fois, au moment
   où on la crée. Ensuite on ne peut que la remplacer (l'ancienne cesse de
   fonctionner) ou la révoquer. Un compte gratuit n'a pas de flux.

   La boîte est COMPLÈTE (fond, marges, titre) : Paramètres › Agenda la pose
   telle quelle, la modale du Calendrier et de la carte partenaire aussi
   (refonte BP 2026-10-11 — une seule boîte, aucun doublon).
═══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSubscription } from "@/lib/context/SubscriptionProvider";
import {
  AIDE_AGENDA, NOM_CALENDRIER, NOM_CALENDRIER_PARTENAIRE,
  adresseFlux, adresseWebcal, lienGoogle, lienOutlook, lienOutlookPerso,
} from "@/lib/agenda/ics";

interface Etat { actif: boolean; cree_le: string | null; unite_a_jour: boolean; pro: boolean }

/** Recruteur (relances, visites, matchs de l'unité) ou partenaire (ses matchs). */
export type ModeAgenda = "recruteur" | "partenaire";

/** Les RPC de chaque mode : même forme d'appel, tables et règles distinctes. */
const RPC = {
  recruteur: { etat: "agenda_jeton_etat", creer: "agenda_jeton_creer", revoquer: "agenda_jeton_revoquer" },
  partenaire: { etat: "agenda_jeton_partenaire_etat", creer: "agenda_jeton_partenaire_creer", revoquer: "agenda_jeton_partenaire_revoquer" },
} as const;

/** Rouge : l'action principale SEULEMENT (créer, confirmer). */
const btnPlein = "inline-flex items-center justify-center gap-2 rounded-lg bg-[#E63946] px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-[#D42B22] disabled:opacity-50";
/** Les trois choix d'agenda : même taille, même style. */
const btnChoix = "inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#2D3748] bg-[#1A1D24] px-3 py-2.5 text-[14px] font-semibold text-white transition-colors hover:border-[#6B7280] disabled:opacity-50";
const btnContour = "inline-flex items-center justify-center gap-2 rounded-lg border border-[#2D3748] px-4 py-2.5 text-[14px] font-semibold text-[#e0e0e0] transition-colors hover:border-[#6B7280] disabled:opacity-50";
const lienPetit = "text-[13px] text-[#9CA3AF] underline underline-offset-2 hover:text-white";

function dateFr(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" }) : "";
}

function LienAide({ href, testid }: { href: string; testid: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={lienPetit} data-testid={testid}>
      Comment faire ?
    </a>
  );
}

/** Un des trois choix : nom, bouton d'action, note, « Comment faire ? ». */
function Choix({ nom, testid, children }: { nom: string; testid: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[#2D3748] bg-[#13151a] p-4" data-testid={testid}>
      <p className="text-[12px] font-bold uppercase tracking-wider text-[#6b7280]">{nom}</p>
      {children}
    </div>
  );
}

export default function AbonnementAgenda({ mode = "recruteur", onFermer }: { mode?: ModeAgenda; onFermer?: () => void }) {
  const partenaire = mode === "partenaire";
  const { tier, loading: tierLoading } = useSubscription();
  // Partenaire : gratuit ; la base n'admet que les APPROVED (refus affiché par l'erreur).
  const estPro = partenaire || tier === "pro" || tier === "all_star";
  const [etat, setEtat] = useState<Etat | null>(null);
  const [jeton, setJeton] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmer, setConfirmer] = useState<"remplacer" | "revoquer" | null>(null);
  const [copie, setCopie] = useState<"adresse" | "apple" | null>(null);

  const relire = useCallback(async () => {
    const { data, error } = await createClient().rpc(RPC[mode].etat);
    if (error) { setErreur("Impossible de lire l'état de ton abonnement. Réessaie dans un instant."); return; }
    const ligne = (Array.isArray(data) ? data[0] : data) as (Partial<Etat> & { admis?: boolean }) | undefined;
    setEtat({
      actif: !!ligne?.actif,
      cree_le: ligne?.cree_le ?? null,
      // Partenaire : pas d'unité — l'adresse vaut tant que le compte est approuvé.
      unite_a_jour: partenaire ? ligne?.admis !== false : !!ligne?.unite_a_jour,
      pro: partenaire ? ligne?.admis !== false : !!ligne?.pro,
    });
  }, [mode, partenaire]);

  // Lecture au montage, hors du rendu synchrone de l'effet.
  useEffect(() => {
    if (!estPro) return;
    const t = window.setTimeout(() => { void relire(); }, 0);
    return () => window.clearTimeout(t);
  }, [estPro, relire]);

  async function creer() {
    setOccupe(true); setErreur(null); setConfirmer(null);
    const { data, error } = await createClient().rpc(RPC[mode].creer);
    setOccupe(false);
    if (error) {
      setErreur(error.code === "22023"
        ? "Ton compte n'a pas encore de cégep et de sport : l'agenda de l'unité n'existe pas."
        : error.code === "42501" && partenaire
        ? "L'agenda est réservé aux partenaires approuvés."
        : "L'adresse n'a pas pu être créée. Réessaie dans un instant.");
      return;
    }
    setJeton(data as string);
    await relire();
  }

  async function revoquer() {
    setOccupe(true); setErreur(null); setConfirmer(null);
    const { error } = await createClient().rpc(RPC[mode].revoquer);
    setOccupe(false);
    if (error) { setErreur("La révocation n'a pas abouti. Réessaie dans un instant."); return; }
    setJeton(null);
    await relire();
  }

  async function copier(texte: string, quoi: "adresse" | "apple") {
    try { await navigator.clipboard.writeText(texte); setCopie(quoi); setTimeout(() => setCopie(null), 2000); }
    catch { setErreur("Copie impossible : sélectionne l'adresse et copie-la à la main."); }
  }

  if (tierLoading) return null;

  const url = estPro && jeton ? adresseFlux(window.location.origin, jeton) : null;
  const nomCalendrier = partenaire ? NOM_CALENDRIER_PARTENAIRE : NOM_CALENDRIER;
  const nouveautes = partenaire ? "les nouveaux matchs" : "les nouveaux événements";

  return (
    <section className="rounded-2xl border border-[#2D3748] bg-[#1A1D24] p-6 font-sans" data-testid="abonnement-agenda">
      <div className="flex items-start justify-between gap-4">
        <h2 id="titre-abonnement-agenda" className="font-head text-xl font-bold uppercase tracking-tight text-white">
          S&apos;abonner à mon agenda
        </h2>
        {onFermer && (
          <button type="button" onClick={onFermer} aria-label="Fermer" className="-mr-1 -mt-1 rounded-lg p-1 text-[#9CA3AF] hover:text-white">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
          </button>
        )}
      </div>

      {!estPro ? (
        <p className="mt-2 text-[14px] text-[#9CA3AF]" data-testid="agenda-gratuit">
          L&apos;abonnement à ton agenda (relances et visites dans Google Agenda ou Outlook) fait partie du forfait Pro.
        </p>
      ) : (
        <>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-[#9CA3AF]">
            {partenaire
              ? "Tes matchs ajoutés avec + apparaissent dans ton agenda, à l'heure de Montréal, et se mettent à jour automatiquement."
              : "Tes relances, les visites et les matchs ajoutés avec + par ton unité apparaissent dans ton agenda, à l'heure de Montréal, et se mettent à jour automatiquement."}
          </p>

          {url ? (
            <div className="mt-6 space-y-5" data-testid="agenda-adresse-nouvelle">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Choix nom="Google Agenda" testid="agenda-choix-google">
                  <a href={lienGoogle(url)} target="_blank" rel="noopener noreferrer" className={btnChoix} data-testid="agenda-google">
                    Ajouter à Google
                  </a>
                  <p className="text-[12.5px] leading-snug text-[#9CA3AF]">
                    Sur ordinateur seulement. Google peut prendre quelques heures avant d&apos;afficher {nouveautes}.
                  </p>
                  <div className="mt-auto"><LienAide href={AIDE_AGENDA.google} testid="agenda-aide-google" /></div>
                </Choix>

                <Choix nom="Outlook" testid="agenda-choix-outlook">
                  <a href={lienOutlook(url, nomCalendrier)} target="_blank" rel="noopener noreferrer" className={btnChoix} data-testid="agenda-outlook">
                    Ajouter à Outlook
                  </a>
                  <p className="text-[12.5px] leading-snug text-[#9CA3AF]">
                    Compte de travail ou d&apos;école. Compte personnel ?{" "}
                    <a href={lienOutlookPerso(url, nomCalendrier)} target="_blank" rel="noopener noreferrer" className="text-[#e0e0e0] underline underline-offset-2 hover:text-white" data-testid="agenda-outlook-perso">
                      Passe par Outlook.com
                    </a>
                  </p>
                  <div className="mt-auto"><LienAide href={AIDE_AGENDA.outlook} testid="agenda-aide-outlook" /></div>
                </Choix>

                <Choix nom="Apple / autre" testid="agenda-choix-apple">
                  <button type="button" onClick={() => void copier(url, "apple")} className={btnChoix} data-testid="agenda-copier-apple">
                    {copie === "apple" ? "Copiée ✓" : "Copier l'adresse"}
                  </button>
                  <p className="text-[12.5px] leading-snug text-[#9CA3AF]">
                    Colle-la dans « Ajouter un calendrier par abonnement ». Sur iPhone ou Mac :{" "}
                    <a href={adresseWebcal(url)} className="text-[#e0e0e0] underline underline-offset-2 hover:text-white" data-testid="agenda-webcal">
                      ouvrir dans Calendrier
                    </a>
                  </p>
                  <div className="mt-auto"><LienAide href={AIDE_AGENDA.apple} testid="agenda-aide-apple" /></div>
                </Choix>
              </div>

              <div>
                <p className="mb-1.5 text-[12px] font-bold uppercase tracking-wider text-[#6b7280]" id="agenda-adresse-libelle">Ton adresse d&apos;abonnement</p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                  <p
                    aria-labelledby="agenda-adresse-libelle"
                    className="min-w-0 flex-1 select-all break-all rounded-lg border border-[#2D3748] bg-[#111317] px-3 py-2.5 font-mono text-[12.5px] leading-relaxed text-[#e0e0e0]"
                    data-testid="agenda-adresse"
                  >
                    {url}
                  </p>
                  <button type="button" onClick={() => void copier(url, "adresse")} className={`${btnContour} shrink-0`} data-testid="agenda-copier">
                    {copie === "adresse" ? "Copiée ✓" : "Copier"}
                  </button>
                </div>
              </div>

              <div className="flex gap-3 rounded-xl border border-[#2D3748] bg-[#111317] px-4 py-3" data-testid="agenda-avertissement">
                <svg className="mt-0.5 shrink-0 text-[#F59E0B]" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
                <div className="text-[13px] leading-snug">
                  <p className="text-[#e0e0e0]">
                    Garde cette adresse pour toi : quiconque l&apos;a voit {partenaire ? "tes matchs" : "tes relances, tes visites et tes matchs"}.
                  </p>
                  <p className="mt-0.5 text-[#9CA3AF]">Elle ne sera plus affichée : pour la retrouver, tu en créeras une nouvelle.</p>
                </div>
              </div>
            </div>
          ) : etat?.actif ? (
            <div className="mt-6 space-y-2 rounded-xl border border-[#2D3748] bg-[#13151a] p-4" data-testid="agenda-actif">
              <p className="text-[14px] text-[#e0e0e0]">Abonnement actif depuis le {dateFr(etat.cree_le)}.</p>
              {!etat.unite_a_jour && !partenaire && (
                <p className="text-[13px] text-[#F59E0B]" data-testid="agenda-unite-changee">
                  Ton cégep ou ton sport a changé depuis : cette adresse ne montre plus rien. Crée une nouvelle adresse.
                </p>
              )}
              <p className="text-[13px] text-[#9CA3AF]">L&apos;adresse n&apos;est jamais réaffichée. Pour l&apos;ajouter à un autre agenda, crée-en une nouvelle.</p>
              <p className="text-[13px] text-[#9CA3AF]">
                Aide :{" "}
                <a href={AIDE_AGENDA.google} target="_blank" rel="noopener noreferrer" className={lienPetit}>Google Agenda</a>
                {" · "}
                <a href={AIDE_AGENDA.outlook} target="_blank" rel="noopener noreferrer" className={lienPetit}>Outlook</a>
                {" · "}
                <a href={AIDE_AGENDA.apple} target="_blank" rel="noopener noreferrer" className={lienPetit}>Apple</a>
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-2">
              <button type="button" disabled={occupe || !etat} onClick={() => void creer()} className={btnPlein} data-testid="agenda-creer">
                {occupe ? "Création…" : "Créer mon adresse d'abonnement"}
              </button>
              <p className="text-[13px] text-[#9CA3AF]">Ensuite, tu choisis ton agenda : Google, Outlook ou Apple.</p>
            </div>
          )}

          {confirmer ? (
            <div className="mt-6 space-y-3 rounded-xl border border-[#E63946]/40 bg-[#E63946]/[0.06] p-4" role="alertdialog" aria-labelledby="agenda-confirmation-texte" data-testid="agenda-confirmation">
              <p id="agenda-confirmation-texte" className="text-[14px] text-[#e0e0e0]">
                {confirmer === "remplacer"
                  ? "L'adresse actuelle cessera de fonctionner dans tous les agendas où tu l'as ajoutée. Continuer ?"
                  : "Ton agenda ne recevra plus rien : l'adresse cessera de fonctionner partout. Continuer ?"}
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={occupe} onClick={() => void (confirmer === "remplacer" ? creer() : revoquer())} className={btnPlein} data-testid="agenda-confirmer">
                  {confirmer === "remplacer" ? "Remplacer l'adresse" : "Révoquer l'adresse"}
                </button>
                <button type="button" onClick={() => setConfirmer(null)} className={btnContour}>Annuler</button>
              </div>
            </div>
          ) : etat?.actif ? (
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[#2D3748] pt-4">
              <button type="button" disabled={occupe} onClick={() => setConfirmer("remplacer")} className={`${lienPetit} disabled:opacity-50`} data-testid="agenda-remplacer">
                Créer une nouvelle adresse
              </button>
              <button type="button" disabled={occupe} onClick={() => setConfirmer("revoquer")} className="text-[13px] text-[#E63946]/80 underline underline-offset-2 hover:text-[#E63946] disabled:opacity-50" data-testid="agenda-revoquer">
                Révoquer
              </button>
            </div>
          ) : null}

          {erreur && <p className="mt-4 text-[13px] text-[#F59E0B]" role="alert" data-testid="agenda-erreur">{erreur}</p>}
        </>
      )}
    </section>
  );
}
