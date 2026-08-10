"use client";

/* ═══════════════════════════════════════════════════════════════
   RecruteurMessagesMobile — Liste de conversations (iter 7.8a)
   Feel iOS Messages : large title "Messages", Edit top-left, filtre
   top-right, search bar sticky, items denses avec athlète en vedette
   + coach en sous-titre, dot non-lu, swipe-to-archive, mode Edit
   multi-sélection, filtre bottom sheet (Tous / Non lu / Archivé).

   Gating Free : liste floutée + compte de threads net + tease upgrade.

   Référence design : docs/mobile-design-system.md.

   Phase 1 unification : la chrome (header, search, swipe, edit,
   FilterSheet, lock overlay, EmptyState) vit dans MessagesListShell.
   Ce fichier ne contient plus que :
   - les hooks data (useConversations + archive mutation)
   - le filtre/search local + handlers recruteur
   - le rendu spécifique recruteur (renderRow athlète-first +
     lockTease) passé au shell via les props prévues à cet effet.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import AthletePhotoFill from "@/components/shared/AthletePhotoFill";
import { useConversations, type ThreadData } from "@/lib/queries/recruiter/useConversations";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import { useSubscription } from "@/lib/hooks/useSubscription";
import { useMobileToast } from "@/components/mobile/MobileToast";
import { useDebouncedValue } from "@/lib/utils/useDebouncedValue";
import { createClient } from "@/lib/supabase/client";
import {
  MessagesListShell,
  type FilterOption,
} from "@/components/shared/messaging/MessagesListShell";
import { triggerHaptic, relativeTime } from "@/components/shared/messaging/utils";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

/* ── useArchiveConversation (mutation TanStack inline + optimistic) ── */

function useArchiveConversation() {
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;
  const queryKey = ["conversations", userId];

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
      const previous = queryClient.getQueryData<ThreadData[]>(queryKey);
      queryClient.setQueryData<ThreadData[]>(queryKey, (old) => {
        if (!old) return old;
        return old.map((t) => (t.id === conversationId ? { ...t, status: newStatus } : t));
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

/* ── Filter keyset (recruiter-specific labels) ──────────────── */

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

export function RecruteurMessagesMobile() {
  const router = useRouter();
  const toast = useMobileToast();
  const { data: threads = [], isLoading } = useConversations();
  const { tier, loading: tierLoading } = useSubscription();
  const isFree = tier === "free";
  const archiveMut = useArchiveConversation();
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
    // "Sans réponse" : le dernier message vient du recruteur courant → on attend
    // la réponse du coach (def. (a)). Exclut les archivés.
    else if (filter === "sans_reponse") list = list.filter((t) => t.lastSenderId != null && t.lastSenderId === userId && t.status !== "ARCHIVE");
    else if (filter === "archive") list = list.filter((t) => t.status === "ARCHIVE");
    else list = list.filter((t) => t.status !== "ARCHIVE");

    if (debouncedSearch.trim().length >= 2) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter((t) =>
        t.coachName.toLowerCase().includes(q) ||
        t.athleteName.toLowerCase().includes(q) ||
        t.lastMessage.toLowerCase().includes(q)
      );
    }
    return list;
  }, [threads, filter, debouncedSearch, userId]);

  // Handlers
  const handleTap = (thread: ThreadData) => {
    if (isFree) {
      toast.warning({ message: "Messagerie réservée Pro", detail: "Répondre aux coachs est réservé aux membres Pro" });
      return;
    }
    try { sessionStorage.setItem("lastRecruiterTab", "messages"); } catch { /* no-op */ }
    router.push(`/recruteur/messages/${thread.id}`);
  };

  const handleToggleSelect = (id: string) => {
    triggerHaptic("Light");
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleArchiveSwipe = (thread: ThreadData) => {
    if (isFree) {
      toast.warning({ message: "Action réservée Pro" });
      return;
    }
    const newStatus = thread.status === "ARCHIVE" ? "ACTIVE" : "ARCHIVE";
    archiveMut.mutate(
      { conversationId: thread.id, newStatus },
      {
        onSuccess: () => {
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
    if (selected.size === 0 || isFree) return;
    const ids = Array.from(selected);
    Promise.all(
      ids.map((id) => archiveMut.mutateAsync({ conversationId: id, newStatus: "ARCHIVE" }))
    ).then(() => {
      toast.success({ message: `${ids.length} conversation${ids.length > 1 ? "s archivées" : " archivée"}` });
      setSelected(new Set());
      setEditMode(false);
    }).catch(() => toast.error({ message: "Erreur d'archivage" }));
  };

  const totalThreads = threads.length;
  const loading = isLoading || tierLoading;

  // Empty kind → copy
  const emptyKind: "all" | "search" | "non_lu" | "archive" =
    debouncedSearch.length >= 2 ? "search" :
    filter === "non_lu" ? "non_lu" :
    filter === "archive" ? "archive" : "all";
  const emptyCopy = {
    all:     { title: "Aucune conversation",          sub: "Tes échanges avec les coachs apparaîtront ici." },
    search:  { title: "Aucun résultat",                sub: "Essaie d'autres termes de recherche." },
    non_lu:  { title: "Tu es à jour",                  sub: "Aucun message non lu." },
    archive: { title: "Aucune conversation archivée",  sub: "Les conversations archivées apparaîtront ici." },
  }[emptyKind];

  /* Athlete-first row content (avatar + names + time + last message)
     — passed to the shared shell via renderRowContent. The shell
     handles the selection circle, unread dot, swipe-archive motion,
     and inset separator around this slot. */
  const renderRow = (t: ThreadData) => {
    const unread = t.unreadCount > 0;
    return (
      <div className="flex items-center gap-3">
        <div className="relative w-[52px] h-[52px] rounded-full overflow-hidden flex-shrink-0 bg-[#2F3440]">
          <AthletePhotoFill
            photoUrl={null}
            firstName={t.athleteInitials[0] ?? ""}
            lastName={t.athleteInitials[1] ?? ""}
            initialsFontSize={20}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <p className={`text-base truncate ${unread ? "font-bold text-white" : "font-semibold text-white/95"}`}>
              {t.athleteName}
            </p>
            <span className={`text-[13px] flex-shrink-0 ${unread ? "text-[#3B82F6] font-semibold" : "text-white/40"}`}>
              {relativeTime(t.lastMessageAt)}
            </span>
          </div>
          <p className="text-[15px] text-white/55 mt-0.5 truncate">
            Coach {t.coachName}
          </p>
          <p className="text-[15px] text-white/40 mt-0.5 truncate">
            {t.lastMessage || "Aucun message"}
          </p>
        </div>
      </div>
    );
  };

  /* Free-tier tease card mounted as the shell's lockOverlay. */
  const lockTease = (
    <div className="rounded-2xl bg-[#111317]/85 backdrop-blur-md border border-white/10 px-5 py-5 max-w-[300px] text-center">
      <p className="font-head text-[40px] font-black text-white leading-none">
        {totalThreads}
      </p>
      <p className="text-[12px] uppercase tracking-wider text-white/60 font-semibold mt-1">
        coach{totalThreads !== 1 ? "s" : ""} {totalThreads !== 1 ? "t'attendent" : "t'attend"}
      </p>
      <p className="text-[14px] text-white/85 mt-3 leading-snug">
        {IS_CAPACITOR
          ? "Lecture et réponse réservées aux membres Pro."
          : "Passe à Pro pour lire et répondre."}
      </p>
      {!IS_CAPACITOR && (
        <button
          type="button"
          onClick={() => { triggerHaptic("Light"); router.push("/tarifs"); }}
          className="mt-4 w-full py-2.5 rounded-2xl bg-[#E63946] text-white font-bold text-[14px] active:bg-[#D42B22] transition-colors"
        >
          Voir les forfaits
        </button>
      )}
    </div>
  );

  return (
    <MessagesListShell<ThreadData>
      threads={filtered}
      isLoading={loading}
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
      onCreate={() => router.push("/recruteur/messages/nouveau")}
      createDisabled={isFree}
      onCreateBlocked={() => toast.info({
        message: "Abonnement Pro requis",
        detail: "L'envoi de messages est réservé Pro.",
      })}
      isLocked={isFree}
      lockOverlay={lockTease}
      emptyTitle={emptyCopy.title}
      emptyDescription={emptyCopy.sub}
    />
  );
}
