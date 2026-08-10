"use client";

/* ═══════════════════════════════════════════════════════════════
   RecruteurFavorisMobile — iter 7.9 Section 8
   Page Mes Favoris mobile : MÊME carte visuelle que la Recherche
   (réutilise AthleteCardMobile exporté). Source = useFavoriteAthletes.
   Heart = retirer des favoris (optimistic + toast undo). Search locale
   par nom. Pas de filter sheet 7-critères (overkill sur favoris).
═══════════════════════════════════════════════════════════════ */

import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useFavoriteAthletes } from "@/lib/queries/recruiter/useFavoriteAthletes";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import { useSubscription } from "@/lib/hooks/useSubscription";
import { useMobileToast } from "@/components/mobile/MobileToast";
import { AthleteCardMobile } from "@/components/shared/RecruteurRechercheMobile";
import { useDebouncedValue } from "@/lib/utils/useDebouncedValue";
import { EmptyState as SharedEmptyState } from "@/components/mobile/EmptyState";
import { triggerHaptic } from "@/lib/haptics";


export function RecruteurFavorisMobile() {
  const { athletes, isLoading } = useFavoriteAthletes();
  const { tier } = useSubscription();
  const isFree = tier === "free";
  const queryClient = useQueryClient();
  const toast = useMobileToast();
  // Iter 7.11 Section 3.2 — userId nécessaire pour patcher la BONNE queryKey
  // (useFavorites stocke sous ["favorites", userId], pas ["favorites"]).
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 200);

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return athletes;
    return athletes.filter((a) => {
      const full = `${a.firstName} ${a.lastName}`.toLowerCase();
      return full.includes(q);
    });
  }, [athletes, debouncedSearch]);

  // Iter 7.11 Section 3.2 — vraie queryKey du cache useFavorites.
  // Avant : setQueryData(["favorites"], ...) patchait une clé fantôme et
  // n'affectait pas le rendu (la grille lit ["favorites", userId]).
  const favoritesKey = useMemo(() => ["favorites", userId] as const, [userId]);

  const reinsertFavorite = useCallback(async (athleteId: string) => {
    if (!userId) return;
    const supabase = createClient();
    // Optimistic re-add : ré-injecte l'id pour que la carte réapparaisse
    // immédiatement avec son animation d'entrée.
    queryClient.setQueryData<string[]>(favoritesKey, (prev) => {
      const list = prev ?? [];
      return list.includes(athleteId) ? list : [...list, athleteId];
    });
    const { error } = await supabase
      .from("recruiter_favorites")
      .insert({ recruiter_id: userId, athlete_id: athleteId });
    if (error) {
      // Revert : retire à nouveau le faux ajout optimistic.
      queryClient.setQueryData<string[]>(favoritesKey, (prev) =>
        (prev ?? []).filter((id) => id !== athleteId),
      );
      toast.error({ message: "Échec annulation", detail: error.message });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["favoriteCounts"] });
  }, [queryClient, favoritesKey, userId, toast]);

  const handleUnfavorite = useCallback(async (athleteId: string) => {
    triggerHaptic("Light");
    if (!userId) return;
    const supabase = createClient();

    // Snapshot avant patch (pour revert si la DB refuse).
    const previousIds = queryClient.getQueryData<string[]>(favoritesKey);

    // Optimistic : retire l'id de la VRAIE clé (["favorites", userId]). useAthletesByIds
    // re-derive sans cet id → la grille ne contient plus l'athlète → AnimatePresence
    // détecte l'exit et lance l'animation. La carte disparaît IMMÉDIATEMENT.
    queryClient.setQueryData<string[]>(favoritesKey, (prev) =>
      (prev ?? []).filter((id) => id !== athleteId),
    );

    const { data: existing } = await supabase
      .from("recruiter_favorites")
      .select("id")
      .eq("recruiter_id", userId)
      .eq("athlete_id", athleteId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase.from("recruiter_favorites").delete().eq("id", existing.id);
      if (error) {
        // Revert au snapshot pré-tap → la carte réapparaît.
        queryClient.setQueryData<string[]>(favoritesKey, previousIds ?? []);
        toast.error({ message: "Échec", detail: "Impossible de retirer le favori." });
        return;
      }
    }

    queryClient.invalidateQueries({ queryKey: ["favoriteCounts"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard", "kpi"] });

    toast.success({
      message: "Retiré des favoris",
      duration: 5000,
      action: {
        label: "Annuler",
        onClick: () => { reinsertFavorite(athleteId); },
      },
    });
  }, [queryClient, favoritesKey, userId, toast, reinsertFavorite]);

  return (
    <div className="min-h-screen bg-[#111317] text-white nx-mobile-pb-tabbar">
      {/* Header sticky : titre + count */}
      <div
        className="sticky top-0 z-30 bg-[#111317]"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="px-4 pt-3 pb-2 flex items-center justify-between">
          <h1 className="font-head text-[26px] font-black text-white uppercase tracking-tight">
            Mes Favoris
          </h1>
          {!isLoading && athletes.length > 0 && (
            <span className="text-[13px] text-white/55 font-semibold tabular-nums">
              {athletes.length}
            </span>
          )}
        </div>

        {/* Search locale (nom uniquement, pas le filter sheet) */}
        {athletes.length > 0 && (
          <div className="px-4 pb-3">
            <div className="relative">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filtrer par nom"
                className="w-full bg-white/[0.06] rounded-2xl pl-9 pr-9 py-2.5 text-[16px] text-white placeholder:text-white/40 outline-none"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => { void triggerHaptic("Light"); setSearch(""); }}
                  aria-label="Effacer"
                  className="absolute right-0 top-1/2 -translate-y-1/2 nx-mobile-touch-min flex items-center justify-center"
                >
                  <span className="w-6 h-6 rounded-full bg-white/[0.10] flex items-center justify-center active:bg-white/[0.18]">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round">
                      <path d="M18 6L6 18" /><path d="M6 6l12 12" />
                    </svg>
                  </span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="px-4 pt-3">
        {/* Iter 7.54 — skeleton AFFICHÉ UNIQUEMENT au cold load (aucune
            donnée encore). Pendant un refetch déclenché par retrait
            optimistic, athletes.length > 0 (grâce au placeholderData
            de useAthletesByIds) → on saute le skeleton → l'AnimatePresence
            reste montée → exit anim des cartes peut jouer. */}
        {isLoading && athletes.length === 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[4/5] rounded-2xl bg-[#1A1D24] animate-pulse" />
            ))}
          </div>
        ) : athletes.length === 0 ? (
          <EmptyState />
        ) : filtered.length === 0 ? (
          <p className="text-[14px] text-white/55 italic text-center py-12">
            Aucun favori ne correspond à « {debouncedSearch} ».
          </p>
        ) : (
          // Iter 7.10 Section 4 — AnimatePresence (mode "popLayout") + motion.div
          // layout sur chaque carte : retrait optimistic → exit scale/opacity
          // ~250ms cubic-bezier canon, PUIS reflow auto des cartes restantes
          // vers le haut. Si Undo → l'item réapparaît avec l'animation d'entrée
          // (initial → animate). Pattern canon retrait liste mobile.
          <div className="grid grid-cols-2 gap-3">
            <AnimatePresence mode="popLayout">
              {filtered.map((a) => (
                <motion.div
                  key={a.id}
                  layout
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
                >
                  <AthleteCardMobile
                    a={{
                      id: a.id,
                      firstName: a.firstName,
                      lastName: a.lastName,
                      photo: a.photo,
                      position: a.position,
                      sportName: a.sportName,
                      school: a.school,
                      graduationYear: a.graduationYear,
                      stars: a.stars,
                      isVerified: a.isVerified,
                      lastValidation: a.lastValidation,
                      isFavorited: true,
                      jersey: a.jersey,
                      recruitmentStatus: a.recruitmentStatus,
                      committedSchoolName: a.committedSchoolName || null,
                      openToOffers: a.openToOffers,
                      noTeam: a.noTeam,
                    }}
                    isFree={isFree}
                    favDisabled={false}
                    onToggleFav={handleUnfavorite}
                    lastTabKey="favoris"
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <SharedEmptyState
      image="/empty/nexus-empty-shortlist.png"
      title="Aucun favori pour le moment"
      description="Tap le cœur sur une carte de Recherche pour ajouter un athlète à tes favoris. Tu pourras les retrouver ici à tout moment."
    />
  );
}
