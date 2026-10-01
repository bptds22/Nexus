"use client";

/* ═══════════════════════════════════════════════════════════════
   AbonnementAgenda — « S'abonner à mon agenda » (décision BP 2026-10-01).

   Une adresse PRIVÉE par recruteur Pro : ses relances et les visites de son
   unité, dans Google Agenda, Outlook ou toute app qui lit le webcal://.

   Le jeton n'est stocké que HACHÉ : l'adresse s'affiche UNE fois, au moment
   où on la crée. Ensuite on ne peut que la remplacer (l'ancienne cesse de
   fonctionner) ou la révoquer. Un compte gratuit n'a pas de flux.
   Utilisé dans Paramètres (section Agenda) et dans le Calendrier (modale).
═══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSubscription } from "@/lib/context/SubscriptionProvider";
import { adresseFlux, adresseWebcal, lienGoogle, lienOutlook, lienOutlookPerso } from "@/lib/agenda/ics";

interface Etat { actif: boolean; cree_le: string | null; unite_a_jour: boolean; pro: boolean }

const btnPlein = "inline-flex items-center justify-center gap-2 rounded-lg bg-[#E63946] px-4 py-2.5 text-[13px] font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#D42B22] disabled:opacity-50";
const btnContour = "inline-flex items-center justify-center gap-2 rounded-lg border border-[#2D3748] px-4 py-2.5 text-[13px] font-semibold text-[#e0e0e0] transition-colors hover:border-[#6B7280] disabled:opacity-50";

function dateFr(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" }) : "";
}

export default function AbonnementAgenda() {
  const { tier, loading: tierLoading } = useSubscription();
  const estPro = tier === "pro" || tier === "all_star";
  const [etat, setEtat] = useState<Etat | null>(null);
  const [jeton, setJeton] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmer, setConfirmer] = useState<"remplacer" | "revoquer" | null>(null);
  const [copie, setCopie] = useState(false);

  const relire = useCallback(async () => {
    const { data, error } = await createClient().rpc("agenda_jeton_etat");
    if (error) { setErreur("Impossible de lire l'état de ton abonnement. Réessaie dans un instant."); return; }
    const ligne = (Array.isArray(data) ? data[0] : data) as Etat | undefined;
    setEtat(ligne ?? { actif: false, cree_le: null, unite_a_jour: false, pro: false });
  }, []);

  // Lecture au montage, hors du rendu synchrone de l'effet.
  useEffect(() => {
    if (!estPro) return;
    const t = window.setTimeout(() => { void relire(); }, 0);
    return () => window.clearTimeout(t);
  }, [estPro, relire]);

  async function creer() {
    setOccupe(true); setErreur(null); setConfirmer(null);
    const { data, error } = await createClient().rpc("agenda_jeton_creer");
    setOccupe(false);
    if (error) {
      setErreur(error.code === "22023"
        ? "Ton compte n'a pas encore de cégep et de sport : l'agenda de l'unité n'existe pas."
        : "L'adresse n'a pas pu être créée. Réessaie dans un instant.");
      return;
    }
    setJeton(data as string);
    await relire();
  }

  async function revoquer() {
    setOccupe(true); setErreur(null); setConfirmer(null);
    const { error } = await createClient().rpc("agenda_jeton_revoquer");
    setOccupe(false);
    if (error) { setErreur("La révocation n'a pas abouti. Réessaie dans un instant."); return; }
    setJeton(null);
    await relire();
  }

  async function copier(texte: string) {
    try { await navigator.clipboard.writeText(texte); setCopie(true); setTimeout(() => setCopie(false), 2000); }
    catch { setErreur("Copie impossible : sélectionne l'adresse et copie-la à la main."); }
  }

  if (tierLoading) return null;
  if (!estPro) {
    return (
      <p className="text-[14px] text-[#9CA3AF]" data-testid="agenda-gratuit">
        L&apos;abonnement à ton agenda (relances et visites dans Google Agenda ou Outlook) fait partie du forfait Pro.
      </p>
    );
  }

  const url = jeton ? adresseFlux(window.location.origin, jeton) : null;

  return (
    <div className="space-y-4" data-testid="abonnement-agenda">
      <p className="text-[14px] text-[#9CA3AF] max-w-xl">
        Tes <span className="text-[#e0e0e0]">relances</span> et les <span className="text-[#e0e0e0]">visites</span> de ton unité,
        dans ton agenda, mis à jour automatiquement. Les matchs n&apos;y sont pas.
      </p>

      {url ? (
        <div className="space-y-3 rounded-xl border border-[#2D3748] bg-[#13151a] p-4" data-testid="agenda-adresse-nouvelle">
          <div className="flex flex-wrap gap-2">
            <a href={lienGoogle(url)} target="_blank" rel="noopener noreferrer" className={btnPlein} data-testid="agenda-google">Ajouter à Google Agenda</a>
            <a href={lienOutlook(url)} target="_blank" rel="noopener noreferrer" className={btnContour} data-testid="agenda-outlook">Ajouter à Outlook</a>
          </div>
          <a href={lienOutlookPerso(url)} target="_blank" rel="noopener noreferrer" className="inline-block text-[12px] text-[#9CA3AF] underline hover:text-[#e0e0e0]">
            Outlook.com (compte personnel)
          </a>
          <div>
            <label className="block text-[12px] font-bold uppercase tracking-wider text-[#6b7280] mb-1.5" htmlFor="agenda-webcal">Adresse à copier (Apple Calendrier, autres apps)</label>
            <div className="flex gap-2">
              <input id="agenda-webcal" readOnly value={adresseWebcal(url)} onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 rounded-lg border border-[#2D3748] bg-[#111317] px-3 py-2 font-mono text-[12px] text-[#e0e0e0]" data-testid="agenda-webcal" />
              <button type="button" onClick={() => void copier(adresseWebcal(url))} className={btnContour}>{copie ? "Copiée ✓" : "Copier"}</button>
            </div>
          </div>
          <p className="text-[12.5px] text-[#F59E0B]">
            Garde cette adresse pour toi : quiconque l&apos;a voit tes relances et tes visites. Elle ne sera plus affichée —
            pour la retrouver, tu en créeras une nouvelle.
          </p>
        </div>
      ) : etat?.actif ? (
        <div className="space-y-1 rounded-xl border border-[#2D3748] bg-[#13151a] p-4" data-testid="agenda-actif">
          <p className="text-[14px] text-[#e0e0e0]">Abonnement actif depuis le {dateFr(etat.cree_le)}.</p>
          {!etat.unite_a_jour && (
            <p className="text-[13px] text-[#F59E0B]" data-testid="agenda-unite-changee">
              Ton cégep ou ton sport a changé depuis : cette adresse ne montre plus rien. Crée une nouvelle adresse.
            </p>
          )}
          <p className="text-[12.5px] text-[#9CA3AF]">L&apos;adresse n&apos;est jamais réaffichée. Pour l&apos;ajouter à un autre agenda, crée-en une nouvelle.</p>
        </div>
      ) : null}

      {confirmer ? (
        <div className="space-y-3 rounded-xl border border-[#E63946]/40 bg-[#E63946]/[0.06] p-4" role="alertdialog" data-testid="agenda-confirmation">
          <p className="text-[14px] text-[#e0e0e0]">
            {confirmer === "remplacer"
              ? "L'adresse actuelle cessera de fonctionner dans tous les agendas où tu l'as ajoutée. Continuer ?"
              : "Ton agenda ne recevra plus rien : l'adresse cessera de fonctionner partout. Continuer ?"}
          </p>
          <div className="flex gap-2">
            <button type="button" disabled={occupe} onClick={() => void (confirmer === "remplacer" ? creer() : revoquer())} className={btnPlein}>
              {confirmer === "remplacer" ? "Remplacer l'adresse" : "Révoquer"}
            </button>
            <button type="button" onClick={() => setConfirmer(null)} className={btnContour}>Annuler</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {!etat?.actif ? (
            <button type="button" disabled={occupe || !etat} onClick={() => void creer()} className={btnPlein} data-testid="agenda-creer">
              {occupe ? "Création…" : "Créer mon adresse d'abonnement"}
            </button>
          ) : (
            <>
              <button type="button" disabled={occupe} onClick={() => setConfirmer("remplacer")} className={btnContour} data-testid="agenda-remplacer">
                Créer une nouvelle adresse
              </button>
              <button type="button" disabled={occupe} onClick={() => setConfirmer("revoquer")} className={`${btnContour} text-[#E63946]`} data-testid="agenda-revoquer">
                Révoquer
              </button>
            </>
          )}
        </div>
      )}

      {erreur && <p className="text-[13px] text-[#F59E0B]" role="alert" data-testid="agenda-erreur">{erreur}</p>}
    </div>
  );
}
