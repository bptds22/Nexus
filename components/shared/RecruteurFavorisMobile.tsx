"use client";

/* ═══════════════════════════════════════════════════════════════
   RecruteurFavorisMobile — iter 7.9 Section 8
   Page Mes Favoris mobile : MÊME carte visuelle que la Recherche
   (réutilise AthleteCardMobile exporté). Source = useFavoriteAthletesUnite
   (favoris de l'unité pour un Pro, lot 2 de la 1.4.4). Heart = retirer
   (useBasculeFavori, confirmation d'unité). Search locale
   par nom. Pas de filter sheet 7-critères (overkill sur favoris).
═══════════════════════════════════════════════════════════════ */

import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useFavoriteAthletesUnite } from "@/lib/queries/recruiter/useFavoriteAthletes";
import { useBasculeFavori } from "@/components/recruteur/unite/useBasculeFavori";
import { definirFavori } from "@/lib/queries/shared/definirFavori";
import { joindreNoms } from "@/lib/queries/recruiter/useFavorisUnite";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import { useSubscription } from "@/lib/hooks/useSubscription";
import { useMobileToast } from "@/components/mobile/MobileToast";
import { AthleteCardMobile } from "@/components/shared/RecruteurRechercheMobile";
import { useDebouncedValue } from "@/lib/utils/useDebouncedValue";
import { EmptyState as SharedEmptyState } from "@/components/mobile/EmptyState";
import { triggerHaptic } from "@/lib/haptics";


export function RecruteurFavorisMobile() {
  /* TABLEAU BLANC (lot 2 de la 1.4.4, registre §38) : pour un Pro, les
     favoris de l'UNITÉ, avec qui les a posés (useFavoriteAthletesUnite) ;
     un gratuit garde les siens. Le retrait passe par useBasculeFavori, le
     même chemin que le web : un Pro retire POUR L'UNITÉ (et du processus),
     avec une confirmation qui nomme les collègues ou l'étape avancée. */
  const { athletes, favoris, isLoading } = useFavoriteAthletesUnite();
  const { basculer, modale } = useBasculeFavori();
  // `tierLoading` : tant que le tier n'est pas chargé, on ne rend PAS les cartes
  // (le Provider défaute tier→"free" avant le fetch, ce qui anonymiserait les
  // cartes d'un All Star une fraction de seconde au login). Skeleton jusque-là.
  const { loading: tierLoading } = useSubscription();
  const queryClient = useQueryClient();
  const toast = useMobileToast();
  const { data: currentUser } = useCurrentUser();
  const moi = currentUser?.authUser.id ?? null;
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 200);

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return athletes;
    return athletes.filter((a) => {
      // Volontairement sur firstName/lastName, pas fullName : sous masquage
      // les deux sont vides, donc un athlète à identité réservée ne répond à
      // AUCUNE recherche par nom.
      const full = `${a.firstName} ${a.lastName}`.toLowerCase();
      return full.includes(q);
    });
  }, [athletes, debouncedSearch]);

  /* Retrait. Le gratuit garde l'« Annuler » (il ne retire que SON cœur, le
     remettre est sans ambiguïté). Un Pro a confirmé un retrait d'UNITÉ :
     l'annuler ne rendrait que son propre cœur, pas ceux des collègues ni le
     dossier — on ne promet pas ce qu'on ne sait pas défaire. */
  const handleUnfavorite = useCallback(async (athleteId: string) => {
    triggerHaptic("Light");
    const a = athletes.find((x) => x.id === athleteId);
    const res = await basculer(athleteId, true, a?.identityVisible ? `${a.firstName} ${a.lastName}`.trim() : undefined);
    if (!res) return; // confirmation annulée : rien n'a été écrit
    if (!res.ok) { toast.error({ message: "Échec", detail: res.message }); return; }
    if (favoris.modeUnite) {
      toast.success({ message: "Retiré des favoris de l'unité" });
      return;
    }
    toast.success({
      message: "Retiré des favoris",
      duration: 5000,
      action: {
        label: "Annuler",
        onClick: () => {
          void definirFavori(queryClient, athleteId, true).then((r) => {
            if (!r.ok) toast.error({ message: "Échec annulation", detail: r.message });
          });
        },
      },
    });
  }, [athletes, basculer, favoris.modeUnite, queryClient, toast]);

  /** « Aussi chez Marie » : les collègues qui ont mis ce cœur (moi exclu). */
  const aussiChez = useCallback((athleteId: string): string | null => {
    if (!favoris.modeUnite) return null;
    const noms = (favoris.parAthlete[athleteId] ?? []).filter((id) => id !== moi).map(favoris.nom);
    return noms.length > 0 ? joindreNoms(noms) : null;
  }, [favoris, moi]);

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
        {(isLoading || tierLoading) && athletes.length === 0 ? (
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
                      identityVisible: a.identityVisible,
                    }}
                    favDisabled={false}
                    onToggleFav={handleUnfavorite}
                    lastTabKey="favoris"
                  />
                  {aussiChez(a.id) && (
                    <p className="mt-1 px-1 text-[11px] text-[#9CA3AF] truncate">
                      Favori de {aussiChez(a.id)}
                    </p>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
      {modale}
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
