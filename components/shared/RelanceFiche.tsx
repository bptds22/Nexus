"use client";

/* ═══════════════════════════════════════════════════════════════
   RelanceFiche — la date de prochaine relance, sur la fiche athlète
   vue recruteur.

   ── DÉCISION PRODUIT (BP, 2026-09-10) — écrite, jamais héritée ──
   LA DATE SEULE VIT ICI. LA NOTE RESTE AU PIPELINE.

   `docs/pipeline-recruteur-frontieres.md` est explicite : le coach de
   l'athlète, le cégep admin et l'admin lisent la LIGNE ENTIÈRE de
   `recruiter_pipeline` — donc aussi `next_action_at` ET
   `next_action_note`. Le document classe la DATE comme non sensible,
   et le TEXTE LIBRE comme devant migrer vers la table privée au Lot 2.

   Offrir ici un champ de note bien en vue augmenterait le volume de
   texte qu'un recruteur croit privé et que son entraîneur lit. On ne
   met donc que la date. La note continue de se saisir dans Mon
   processus, là où le recruteur a son contexte sous les yeux — et le
   sous-titre le dit, pour que l'absence se lise comme un choix.

   ── COMPOSANT SÉPARÉ, PAS DU JSX DE PLUS ────────────────────────
   AthleteRecruiterProfileBodyMobile ouvre par un `return null` DEVANT
   ses hooks : chacun de ses ~100 hooks est « conditionnel » aux yeux
   d'eslint. Y déclarer l'état de ce bloc en aurait ajouté deux de plus.
   Il vit donc ici, avec sa propre lecture — un aller-retour de plus sur
   une ligne indexée, contre deux violations de moins.

   ── JAMAIS D'ÉDITEUR MORT ───────────────────────────────────────
   Le parent ne monte ce bloc que si le palier autorise le processus ET
   que l'athlète y est déjà. La RLS refuserait l'écriture autrement
   (`user_has_pro()` garde INSERT comme UPDATE), et un bouton qui échoue
   est pire qu'un bouton absent.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useMobileToast } from "@/components/mobile/MobileToast";
import { triggerHaptic } from "@/lib/haptics";

const SOUS_TITRE_FICHE = "La note de relance se saisit dans Mon processus.";

export default function RelanceFiche({ athleteId, sousTitre = SOUS_TITRE_FICHE, className, modeUnite = false }: {
  athleteId: string;
  /** Tableau blanc (lot B2) : la relance est celle du DOSSIER DE L'UNITÉ.
   *  Lecture sur n'importe quelle ligne de l'unité (les lignes sœurs sont
   *  synchronisées), écriture par unite_ecrire_dossier — toujours sur la
   *  ligne de l'acteur, créée au besoin. Absent → comportement d'origine
   *  (sa propre ligne) : la fiche athlète et le mobile ne changent pas. */
  modeUnite?: boolean;
  /** Classes du cadre qui REMPLACENT la marge par défaut (`mt-4`) — la fiche
   *  web aligne ce bloc sur la carte de visite, dans une grille. Absente →
   *  rendu inchangé. */
  className?: string;
  /** Absent → le texte de la fiche athlète. `null` → aucune ligne (le
   *  SlideOver du pipeline : on EST dans Mon processus, la phrase y serait
   *  circulaire). Une chaîne → la remplace. */
  sousTitre?: string | null;
}) {
  const toast = useMobileToast();
  const queryClient = useQueryClient();
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [pret, setPret] = useState(false);

  useEffect(() => {
    let annule = false;
    (async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user || annule) return;
      const { data } = modeUnite
        ? await supabase
            .from("recruiter_pipeline")
            .select("next_action_at")
            .eq("athlete_id", athleteId)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        : await supabase
            .from("recruiter_pipeline")
            .select("next_action_at")
            .eq("recruiter_id", session.user.id)
            .eq("athlete_id", athleteId)
            .maybeSingle();
      if (annule) return;
      const iso = (data?.next_action_at as string | null) ?? null;
      setDate(iso ? String(iso).slice(0, 10) : "");
      setPret(true);
    })();
    return () => { annule = true; };
  }, [athleteId, modeUnite]);

  async function enregistrer() {
    void triggerHaptic("Light");
    const valeur = date || null;
    setSaving(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setSaving(false); return; }
    /* UPDATE, jamais upsert : la ligne existe forcément — le parent ne monte
       ce bloc que pour un athlète déjà dans le processus. */
    const { error } = modeUnite
      ? await supabase.rpc("unite_ecrire_dossier", { p_athlete_id: athleteId, p_champs: { next_action_at: valeur } })
      : await supabase
          .from("recruiter_pipeline")
          .update({ next_action_at: valeur })
          .eq("recruiter_id", session.user.id)
          .eq("athlete_id", athleteId);
    setSaving(false);
    if (error) {
      const refusTier = /permission|policy|row-level/i.test(error.message);
      toast.error({
        message: refusTier ? "Fonctionnalité Pro" : "Relance non enregistrée",
        detail: refusTier ? "Passe à Pro pour gérer ton processus." : undefined,
      });
      return;
    }
    /* Le cache `["pipeline", userId]` (usePipelineCards) porte aussi
       `next_action_at` : sans invalidation, la carte du kanban et l'encart
       Relances du dashboard gardaient l'ancienne date. Monté depuis le
       SlideOver du pipeline, le kanban est juste derrière. */
    void queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    toast.success({ message: valeur ? "Relance enregistrée" : "Relance effacée" });
  }

  return (
    <div className={`rounded-2xl border border-[#2D3748] bg-[#1A1D24] p-4 ${className ?? "mt-4"}`}>
      <div className="flex items-center gap-2 mb-3">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15.5 14" />
        </svg>
        <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#9CA3AF]">
          Prochaine relance
        </h3>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          disabled={saving || !pret}
          aria-label="Date de la prochaine relance"
          className="flex-1 min-w-0 bg-[#111317] border border-white/[0.10] rounded-xl px-3 py-2.5 text-[14px] text-white outline-none focus:border-[#E63946]/40 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => { void enregistrer(); }}
          disabled={saving || !pret}
          className="shrink-0 rounded-xl bg-[#E63946] px-4 py-2.5 text-[12px] font-head font-bold uppercase tracking-wider text-white active:bg-[#D42B22] disabled:opacity-50"
        >
          {saving ? "…" : "Enregistrer"}
        </button>
      </div>
      {sousTitre && (
        <p className="mt-2 text-[11.5px] text-[#6b7280]">
          {sousTitre}
        </p>
      )}
    </div>
  );
}
