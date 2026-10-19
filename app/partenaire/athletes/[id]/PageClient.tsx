"use client";

import {  useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toPng } from "html-to-image";
import { OPTIONS_IMAGE_INJOIGNABLE } from "@/lib/partage/imageInjoignable";
import { createClient } from "@/lib/supabase/client";
import { useDynamicParam } from "@/lib/platform/useDynamicParam";
import { journaliserTelechargement, journaliserVue } from "@/lib/partenaires/journal";
import { enregistrerImage, rendusNecessaires } from "@/lib/partage/enregistrerImage";
/* loadAthleteRaw N'EST PLUS APPELE ICI (2026-08-19, point 5a du chantier RLS
   partenaire). Il projetait 58 colonnes racine via le chemin de donnees COACH,
   dont les 11 interdites : email, telephone, date_naissance, nom_parent,
   telephone_parent, moyenne_generale, programme_cegep_vise,
   regions_cegep_preferees, notes_coach, consentement_parental, et
   rapport_entraineur par l'embed evaluations.

   Il reste partage avec coach, admin, athlete et six composants mobiles — ne
   PAS le modifier. C'est le chemin partenaire qui cesse de l'appeler. */
import AthletePlayerCard from "@/components/shared/AthletePlayerCard";
import AthleteRecruiterProfileBody from "@/components/shared/AthleteRecruiterProfileBody";
import type { AthleteProfileRecruiterView } from "@/lib/types/models";
import { mapPartnerRpcToRecruiterView, type PartnerAthleteRow } from "@/lib/partenaires/carteAthlete";
import EvaluerAthleteModal from "@/components/partenaire/EvaluerAthleteModal";
import ActionsPartenaireFiche from "@/components/partenaire/ActionsPartenaireFiche";
import EnTeteMobilePartenaire, { BoutonRondPartenaire } from "@/components/partenaire/mobile/EnTeteMobilePartenaire";
import FeuilleActionsFiche, { IconeMenu, IconeTelecharger, type ActionFiche } from "@/components/partenaire/mobile/FicheActionsMobile";
import { useMobileToast } from "@/components/mobile/MobileToast";
import {
  chargerContexteEvaluation,
  chargerEvaluationsPartenaires,
  type ContexteEvaluation,
  type EvaluationPartenaire,
} from "@/lib/evaluations/partenaire";
import { lireRetourFiche } from "@/lib/navigation/retourFiche";

/* ═══════════════════════════════════════════════════════════════
   /partenaire/athletes/[id]
   Athlete profile page for partners. RLS gates the read — if
   the athlete isn't partner-eligible, the load fails and we
   render the not-available state.

   Two preview tabs (publication / story) with download buttons.
   Capture is client-side via html-to-image; the download is logged
   BEFORE the PNG saves, by partenaire_journaliser (fonction en base,
   1.4.5 : l'appli n'embarque pas les routes /api/partner/*).
   Dans l'appli : l'id vient de useDynamicParam (shell placeholder),
   et la carte part par la feuille de partage (lib/partage).

   Filename: nexus-{firstname}-{lastname}-{format}.png
═══════════════════════════════════════════════════════════════ */

type CardFormat = "publication" | "story";

/* Appli : chrome natif (en-tête collant + feuille d'actions iOS) au lieu du
   lien « ← Retour », du sélecteur de format et des boutons. Le web est inchangé. */
const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

/* Retour de la fiche dans l'appli : l'écran d'origine peut déposer sa route
   sous cette clé ; à défaut, la recherche d'athlètes. */
const CLE_RETOUR_FICHE = "nexus.partenaire.retourFiche";
const RETOUR_FICHE_DEFAUT = "/partenaire/athletes";
const abonnementVide = () => () => {};
function lireRetourFicheDepuis(): string {
  // BP 2026-10-19 : la page d'où l'on vient (lib/navigation/retourFiche) ; l'ancienne clé en repli.
  let ancienne = RETOUR_FICHE_DEFAUT;
  try { ancienne = window.sessionStorage.getItem(CLE_RETOUR_FICHE) || RETOUR_FICHE_DEFAUT; } catch { /* privé */ }
  return lireRetourFiche("/partenaire", ancienne);
}

function safeFilenamePart(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function PartnerAthleteProfilePage() {
  // Web : le segment [id] ; appli : le shell `placeholder` + l'id déposé en sessionStorage.
  const id = useDynamicParam("id");
  const router = useRouter();
  const [athlete, setAthlete] = useState<AthleteProfileRecruiterView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFormat, setActiveFormat] = useState<CardFormat>("publication");
  const [downloading, setDownloading] = useState<CardFormat | null>(null);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  /* W2 — « Évaluer ». Le bouton n'existe que si le SERVEUR dit oui
     (partenaire_evaluation_contexte : permission, sport permis, athlète
     éligible et actif). L'écriture refait les mêmes gardes. */
  const [contexteEval, setContexteEval] = useState<ContexteEvaluation | null>(null);
  const [maEvaluation, setMaEvaluation] = useState<EvaluationPartenaire | null>(null);
  const [evalOuverte, setEvalOuverte] = useState(false);

  const captureRefPub = useRef<HTMLDivElement | null>(null);
  const captureRefStory = useRef<HTMLDivElement | null>(null);

  // Appli : feuille d'actions de l'en-tête, toast natif, retour explicite.
  const [feuilleOuverte, setFeuilleOuverte] = useState(false);
  const toastMobile = useMobileToast();
  const retourFiche = useSyncExternalStore(abonnementVide, lireRetourFicheDepuis, () => RETOUR_FICHE_DEFAUT);

  const showToast = (kind: "success" | "error", message: string) => {
    if (IS_CAPACITOR) {
      if (kind === "success") toastMobile.success({ message });
      else toastMobile.error({ message });
      return;
    }
    setToast({ kind, message });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    if (!id || id === "placeholder") return;
    (async () => {
      // Eligibility guard runs first (defense in depth — RLS on
      // athletes also gates the row, but the explicit check gives
      // us a clean error path instead of a silent empty result).
      const supabase = createClient();
      const { data: eligibleResult, error: eligibleErr } = await supabase.rpc(
        "is_partner_eligible_athlete",
        { p_athlete_id: id },
      );
      if (eligibleErr || !eligibleResult) {
        setError("Cet athlète n'est pas disponible pour les partenaires.");
        setLoading(false);
        return;
      }

      /* PROJECTION SERVEUR. La RPC porte son propre gate (is_approved_partner
         ET is_partner_eligible_athlete) et ne rend AUCUNE des 11 colonnes
         interdites — l'age arrive derive, date_naissance ne franchit jamais la
         frontiere. Elle rend 0 ligne si l'appelant n'est pas un partenaire
         approuve, ce qui retombe sur le meme message d'erreur que le garde
         d'eligibilite ci-dessus. */
      const { data: row, error: rpcErr } = await supabase
        .rpc("partner_athlete_profile", { p_athlete_id: id })
        .maybeSingle();
      if (rpcErr || !row) {
        setError("Cet athlète n'est pas disponible pour les partenaires.");
        setLoading(false);
        return;
      }
      setAthlete(mapPartnerRpcToRecruiterView(row as PartnerAthleteRow));
      setLoading(false);

      // W2 — contexte d'évaluation + sa propre évaluation (pré-remplissage).
      chargerContexteEvaluation(supabase, id)
        .then(setContexteEval)
        .catch((e) => console.warn("[partenaire] contexte d'évaluation :", e?.message ?? e));
      chargerEvaluationsPartenaires(supabase, id)
        .then((r) => setMaEvaluation(r.find((e) => e.estLaMienne) ?? null))
        .catch((e) => console.warn("[partenaire] évaluation :", e?.message ?? e));

      // Journal de vue, sans attendre : un journal qui échoue n'empêche pas
      // de lire (la fonction refait les gardes et n'écrit rien si l'une tombe).
      void journaliserVue(supabase, id);
    })();
  }, [id]);

  async function handleDownload(format: CardFormat) {
    if (!athlete) return;
    setDownloading(format);
    try {
      // 1. Log the download server-side first. If logging fails,
      //    abort — we don't ship cards we can't account for.
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showToast("error", "Session expirée — reconnecte-toi.");
        setDownloading(null);
        return;
      }
      const refus = await journaliserTelechargement(supabase, id, format);
      if (refus) {
        showToast("error", refus);
        setDownloading(null);
        return;
      }

      // 2. Wait for fonts so the captured PNG has the right typography
      if (typeof document !== "undefined" && document.fonts) {
        await document.fonts.ready;
      }

      // 3. Capture the off-screen rendering of the matching format
      const node = format === "publication" ? captureRefPub.current : captureRefStory.current;
      if (!node) {
        showToast("error", "Impossible de générer la carte.");
        setDownloading(null);
        return;
      }
      const options = {
        ...OPTIONS_IMAGE_INJOIGNABLE, // photo injoignable : sautée, l'export réussit
        // pixelRatio 1: AthletePlayerCard's outer container already
        // renders at the exact target dimensions (publication =
        // 1080×1350, story = 1080×1920), so no oversampling needed.
        pixelRatio: 1,
        cacheBust: true,
        backgroundColor: undefined,
      };
      // WebView : un 1er rendu « réchauffe » les images embarquées (lib/partage).
      if (rendusNecessaires() === 2) await toPng(node, options);
      const dataUrl = await toPng(node, options);

      // 4. Web : téléchargement ; appli : feuille de partage (Photos, Fichiers…).
      const filename = `nexus-${safeFilenamePart(athlete.firstName)}-${safeFilenamePart(athlete.lastName)}-${format}.png`;
      const issue = await enregistrerImage({ dataUrl, nomFichier: filename, titre: "Carte Nexus", dialogue: "Enregistrer ou partager la carte" });
      if (issue === "echec") { showToast("error", "Impossible d'ouvrir le partage. Réessaie."); return; }

      showToast("success", issue === "partage" ? `Carte ${format} prête.` : `Carte ${format} téléchargée.`);
    } catch (e) {
      console.error("[partner card download]", e);
      showToast("error", "Échec du téléchargement.");
    } finally {
      setDownloading(null);
    }
  }

  if (loading) {
    if (IS_CAPACITOR) {
      return (
        <>
          <EnTeteMobilePartenaire compact titre="Athlète" retour={retourFiche} />
          <div className="px-4 py-6">
            <p className="text-[13px] text-[#6B7280]">Chargement…</p>
          </div>
        </>
      );
    }
    return (
      <div className="px-6 sm:px-10 py-8 max-w-[1100px] mx-auto">
        <p className="text-[13px] text-[#6B7280]">Chargement…</p>
      </div>
    );
  }

  if (error || !athlete) {
    return (
      <>
      {IS_CAPACITOR && <EnTeteMobilePartenaire compact titre="Athlète" retour={retourFiche} />}
      <div className={IS_CAPACITOR ? "px-4 py-6" : "px-6 sm:px-10 py-8 max-w-[800px] mx-auto"}>
        <div className="bg-[#1A1D24] border border-[#2D3748] rounded-xl p-10 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#1A1D24] border border-[#2D3748] mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
          </div>
          <p className="text-[13px] text-[#9CA3AF] font-semibold">{error || "Athlète introuvable."}</p>
          <button type="button" onClick={() => router.push(retourFiche)} className="text-[12px] font-bold text-[#E63946] hover:text-[#D42B22] mt-4">
            ← Retour aux athlètes
          </button>
        </div>
      </div>
      </>
    );
  }

  const nomAthlete = `${athlete.firstName} ${athlete.lastName}`.trim();

  /* Appli : tout ce que la rangée web propose passe par la feuille d'actions
     (mêmes gestionnaires). Les actions de ActionsPartenaireFiche restent
     rendues dans la page : le composant porte sa propre confirmation. */
  const actionsFiche: ActionFiche[] = [
    { label: "Télécharger — publication", icon: <IconeTelecharger />, disabled: downloading !== null, onClick: () => { setFeuilleOuverte(false); void handleDownload("publication"); } },
    { label: "Télécharger — story", icon: <IconeTelecharger />, disabled: downloading !== null, onClick: () => { setFeuilleOuverte(false); void handleDownload("story"); } },
  ];

  const modaleEvaluation = evalOuverte && contexteEval ? (
    <EvaluerAthleteModal
      athleteId={id}
      athleteNom={nomAthlete}
      grilleId={contexteEval.grilleId}
      existante={maEvaluation}
      onClose={() => setEvalOuverte(false)}
      onSaved={() => {
        setEvalOuverte(false);
        showToast("success", "Évaluation enregistrée.");
        chargerEvaluationsPartenaires(createClient(), id)
          .then((r) => setMaEvaluation(r.find((e) => e.estLaMienne) ?? null))
          .catch(() => {});
      }}
      onRetiree={() => {
        setEvalOuverte(false);
        setMaEvaluation(null);
        showToast("success", "Évaluation retirée.");
      }}
    />
  ) : null;

  return (
    <>
    {IS_CAPACITOR && (
      <EnTeteMobilePartenaire
        compact
        titre={nomAthlete || "Athlète"}
        sousTitre={downloading ? "Génération de la carte…" : undefined}
        retour={retourFiche}
        action={
          <BoutonRondPartenaire libelle="Actions" principal={false} onClick={() => setFeuilleOuverte(true)}>
            <IconeMenu />
          </BoutonRondPartenaire>
        }
      />
    )}
    <div className={IS_CAPACITOR ? "px-4 pt-2 pb-6 space-y-5" : "px-6 sm:px-10 py-8 max-w-[1100px] mx-auto space-y-6"}>
      {!IS_CAPACITOR && (
      <Link href={retourFiche} className="text-[12px] font-bold text-[#9CA3AF] hover:text-white transition-colors inline-flex items-center gap-1">
        ← Retour
      </Link>
      )}

      {/* Compact card download — format selector + single button.
          The card itself renders inside the editorial profile body
          below; no need for a separate preview here. */}
      {!IS_CAPACITOR && (
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={activeFormat}
          onChange={(e) => setActiveFormat(e.target.value as CardFormat)}
          aria-label="Format de la carte"
          className="nx-filter-select bg-[#1A1D24] border border-[#2D3748] rounded-lg px-3 py-2 text-[13px] text-white focus:border-[#E63946] outline-none transition-colors"
        >
          <option value="publication">Format publication (1080×1350)</option>
          <option value="story">Format story (1080×1920)</option>
        </select>
        <button
          type="button"
          onClick={() => handleDownload(activeFormat)}
          disabled={downloading !== null}
          className="px-5 py-2.5 bg-[#E63946] hover:bg-[#D42B22] text-white text-[13px] font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {downloading === activeFormat ? "Génération…" : "Télécharger la carte"}
        </button>
        <span className="text-[12px] text-[#6b7280]">PNG haute résolution · enregistrement automatique</span>
      </div>
      )}

      {/* BP 2026-10-19 : deux choix — « Attribuer un badge » et « Évaluation » (le retrait vit dans la fenêtre). */}
      <ActionsPartenaireFiche
        athleteId={id}
        peutEvaluer={!!contexteEval?.peutEvaluer}
        maEvaluation={maEvaluation}
        onEvaluer={() => setEvalOuverte(true)}
        notifier={showToast}
      />

      {/* Appli : la modale (`fixed inset-0`) sort d'AnimatedRoute, conteneur transformé. */}
      {IS_CAPACITOR && modaleEvaluation ? createPortal(modaleEvaluation, document.body) : modaleEvaluation}

      {IS_CAPACITOR && (
        <FeuilleActionsFiche open={feuilleOuverte} onClose={() => setFeuilleOuverte(false)} actions={actionsFiche} />
      )}

      {/* Off-screen full-size renderings for capture (one per format, both kept ready) */}
      <div aria-hidden="true" className="nx-capture-clean" style={{ position: "fixed", left: -99999, top: 0, pointerEvents: "none", zIndex: -1 }}>
        <div ref={captureRefPub}>
          <AthletePlayerCard a={athlete} format="publication" clipOverflow={true} />
        </div>
        <div ref={captureRefStory}>
          <AthletePlayerCard a={athlete} format="story" clipOverflow={true} />
        </div>
      </div>

      {/* Canonical recruiter-style profile body. Partner viewerMode
          hides recruiter-specific UI (no pipeline chip, no
          favorite toggle, no sticky CTA bar), swaps academic
          sections for locked placeholders, hides Réputation du
          coach, and skips the recruiter_athlete_views write so
          partner sessions don't pollute view counts. */}
      <AthleteRecruiterProfileBody athleteId={id} viewerMode="partner" />

      {/* Toast (web — l'appli passe par useMobileToast) */}
      {!IS_CAPACITOR && toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100]">
          <div className={`bg-[#1A1D24] border rounded-lg px-5 py-3 shadow-lg flex items-center gap-3 ${toast.kind === "success" ? "border-[#22C55E]/30" : "border-[#EF4444]/30"}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={toast.kind === "success" ? "#22C55E" : "#EF4444"} strokeWidth="2.5" strokeLinecap="round">
              {toast.kind === "success" ? <path d="M20 6L9 17l-5-5" /> : <><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /></>}
            </svg>
            <span className="text-[13px] font-bold text-white">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
