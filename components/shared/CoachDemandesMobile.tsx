"use client";

/* ═══════════════════════════════════════════════════════════════
   CoachDemandesMobile — Liste de conversations (Phase 2 — coach)
   Feel iOS Messages : large title "Messages", Edit top-left, filtre
   top-right, search bar sticky, items denses avec RECRUTEUR en
   vedette + CÉGEP en sous-titre + "Au sujet de {athlète}", dot
   non-lu, swipe-to-archive, mode Edit multi-sélection, filtre
   bottom sheet (Tous / Non lu / Archivé).

   Différence vs recruteur :
   - Pas de gating Free. Coach peut toujours lire/répondre — les
     coachs sont le canal de distribution (CLAUDE.md : Coach Free =
     "Profile creation, evaluations, verification, always free" +
     useSubscription.ts : can_receive_messages: true sur Free).
   - Row content RECRUTEUR-first (counterparty), pas athlète-first.
   - Filtres simplifiés (3) plutôt que les 5 du desktop, pour
     parité visuelle avec le recruteur.

   Phase 2 unification : la chrome (header, search, swipe, edit,
   FilterSheet, EmptyState) vit dans MessagesListShell. Ce fichier
   ne contient que les hooks data coach + le rendu spécifique
   (recruteur + CÉGEP + sujet athlète).
═══════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import AthletePhotoFill from "@/components/shared/AthletePhotoFill";
import { useCoachConversations, type CoachThreadData } from "@/lib/queries/coach/useCoachConversations";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import { useMobileToast } from "@/components/mobile/MobileToast";
import { useDebouncedValue } from "@/lib/utils/useDebouncedValue";
import { createClient } from "@/lib/supabase/client";
import {
  MessagesListShell,
  type FilterOption,
} from "@/components/shared/messaging/MessagesListShell";
import { triggerHaptic, relativeTime } from "@/components/shared/messaging/utils";

/* ── useArchiveCoachConversation (TanStack + optimistic) ─────── */

function useArchiveCoachConversation() {
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;
  const queryKey = ["conversations", "coach", userId];

  return useMutation({
    mutationFn: async ({ conversationId, newStatus }: { conversationId: string; newStatus: "ACTIVE" | "ARCHIVE" }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("conversations")
        .update({ status: newStatus })
        .eq("id", conversationId);
      if (error) throw error;
    },
    onMutate: async ({ conversationId, newStatus }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<CoachThreadData[]>(queryKey);
      queryClient.setQueryData<CoachThreadData[]>(queryKey, (old) => {
        if (!old) return old;
        return old.map((t) => (t.id === conversationId ? { ...t, status: newStatus } : t));
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => {
      // Prefix invalidation — keeps both coach + recruiter caches honest.
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

/* ── Filter keyset (parité recruteur — 3 filtres simples) ──── */

type FilterKey = "tous" | "non_lu" | "sans_reponse" | "archive";

const FILTER_OPTIONS: FilterOption<FilterKey>[] = [
  { value: "tous",         label: "Tous" },
  { value: "non_lu",       label: "Non lu" },
  { value: "sans_reponse", label: "Sans réponse" },
  { value: "archive",      label: "Archivé" },
];

/* ═══════════════════════════════════════════════════════════════
   MAIN
═══════════════════════════════════════════════════════════════ */

export function CoachDemandesMobile() {
  const router = useRouter();
  const toast = useMobileToast();
  const { data: threads = [], isLoading } = useCoachConversations();
  const archiveMut = useArchiveCoachConversation();
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;

  // States
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 200);
  const [filter, setFilter] = useState<FilterKey>("tous");
  const [editMode, setEditMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Sortie d'edit mode si pas de threads
  useEffect(() => { if (threads.length === 0) setEditMode(false); }, [threads.length]);
  useEffect(() => { if (!editMode) setSelected(new Set()); }, [editMode]);

  // Filtre + recherche local
  const filtered = useMemo(() => {
    let list = [...threads];
    if (filter === "non_lu") list = list.filter((t) => t.unreadCount > 0 && t.status !== "ARCHIVE");
    // "Sans réponse" : le dernier message vient du coach courant → on attend
    // la réponse du recruteur (def. (a)). Exclut les archivés.
    else if (filter === "sans_reponse") list = list.filter((t) => t.lastSenderId != null && t.lastSenderId === userId && t.status !== "ARCHIVE");
    else if (filter === "archive") list = list.filter((t) => t.status === "ARCHIVE");
    else list = list.filter((t) => t.status !== "ARCHIVE");

    if (debouncedSearch.trim().length >= 2) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter((t) =>
        t.recruiterName.toLowerCase().includes(q) ||
        t.recruiterCegep.toLowerCase().includes(q) ||
        t.athleteName.toLowerCase().includes(q) ||
        t.lastMessage.toLowerCase().includes(q)
      );
    }
    return list;
  }, [threads, filter, debouncedSearch, userId]);

  // Handlers
  const handleTap = (thread: CoachThreadData) => {
    try { sessionStorage.setItem("lastCoachTab", "demandes"); } catch { /* no-op */ }
    router.push(`/coach/demandes/${thread.id}`);
  };

  const handleToggleSelect = (id: string) => {
    triggerHaptic("Light");
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleArchiveSwipe = (thread: CoachThreadData) => {
    const newStatus = thread.status === "ARCHIVE" ? "ACTIVE" : "ARCHIVE";
    archiveMut.mutate(
      { conversationId: thread.id, newStatus },
      {
        onSuccess: () => {
          triggerHaptic("Medium");
          toast.success({
            message: newStatus === "ARCHIVE" ? "Conversation archivée" : "Conversation réactivée",
            duration: 5000,
            action: {
              label: "Annuler",
              onClick: () => {
                archiveMut.mutate({ conversationId: thread.id, newStatus: thread.status as "ACTIVE" | "ARCHIVE" });
              },
            },
          });
        },
        onError: () => toast.error({ message: "Erreur d'archivage" }),
      }
    );
  };

  const handleArchiveSelected = () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    Promise.all(
      ids.map((id) => archiveMut.mutateAsync({ conversationId: id, newStatus: "ARCHIVE" }))
    ).then(() => {
      triggerHaptic("Medium");
      toast.success({ message: `${ids.length} conversation${ids.length > 1 ? "s archivées" : " archivée"}` });
      setSelected(new Set());
      setEditMode(false);
    }).catch(() => toast.error({ message: "Erreur d'archivage" }));
  };

  // Empty kind → copy
  const emptyKind: "all" | "search" | "non_lu" | "archive" =
    debouncedSearch.length >= 2 ? "search" :
    filter === "non_lu" ? "non_lu" :
    filter === "archive" ? "archive" : "all";
  const emptyCopy = {
    all:     { title: "Aucune demande",                 sub: "Les demandes de recruteurs apparaîtront ici." },
    search:  { title: "Aucun résultat",                  sub: "Essaie d'autres termes de recherche." },
    non_lu:  { title: "Tu es à jour",                    sub: "Aucune demande non lue." },
    archive: { title: "Aucune conversation archivée",    sub: "Les conversations archivées apparaîtront ici." },
  }[emptyKind];

  /* Recruiter-first row content. Avatar = recruiter photo/initials.
     Primary line = recruiter name. Secondary = their CÉGEP. Context
     = "Au sujet de {athlete}". Time + last message preview.
     The shell handles selection circle, unread dot, swipe-archive
     motion, and inset separator around this slot. */
  const renderRow = (t: CoachThreadData) => {
    const unread = t.unreadCount > 0;
    return (
      <div className="flex items-center gap-3">
        <div className="relative w-[52px] h-[52px] rounded-full overflow-hidden flex-shrink-0 bg-[#2F3440]">
          <AthletePhotoFill
            photoUrl={t.recruiterPhotoUrl}
            firstName={t.recruiterInitials[0] ?? ""}
            lastName={t.recruiterInitials[1] ?? ""}
            initialsFontSize={20}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <p className={`text-base truncate ${unread ? "font-bold text-white" : "font-semibold text-white/95"}`}>
              {t.recruiterName}
            </p>
            <span className={`text-[13px] flex-shrink-0 ${unread ? "text-[#3B82F6] font-semibold" : "text-white/40"}`}>
              {relativeTime(t.lastMessageAt)}
            </span>
          </div>
          {t.recruiterCegep && (
            <p className="text-[15px] text-white/55 mt-0.5 truncate">
              {t.recruiterCegep}
            </p>
          )}
          <p className="text-[13px] text-white/45 mt-0.5 truncate">
            Au sujet de {t.athleteName}
          </p>
          {t.lastMessage && (
            <p className="text-[15px] text-white/40 mt-0.5 truncate">
              {t.lastMessage}
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <MessagesListShell<CoachThreadData>
      threads={filtered}
      isLoading={isLoading}
      getId={(t) => t.id}
      getUnread={(t) => t.unreadCount > 0}
      getStatus={(t) => (t.status === "ARCHIVE" ? "ARCHIVE" : "ACTIVE")}
      renderRowContent={renderRow}
      filterOptions={FILTER_OPTIONS as unknown as FilterOption<string>[]}
      filter={filter}
      onFilterChange={(v) => setFilter(v as FilterKey)}
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="Rechercher"
      editMode={editMode}
      onToggleEdit={() => setEditMode((v) => !v)}
      selectedIds={selected}
      onToggleSelect={handleToggleSelect}
      onBulkArchive={handleArchiveSelected}
      onTapThread={handleTap}
      onSwipeArchive={handleArchiveSwipe}
      title="Messages"
      onCreate={() => router.push("/coach/demandes/nouveau")}
      emptyTitle={emptyCopy.title}
      emptyDescription={emptyCopy.sub}
    />
  );
}
