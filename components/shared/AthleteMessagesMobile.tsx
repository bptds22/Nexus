"use client";

/* ═══════════════════════════════════════════════════════════════
   AthleteMessagesMobile — Liste de conversations (Phase C — athlète)
   Miroir de CoachDemandesMobile, côté athlète : le CONTREPARTIE est
   le coach / directeur sportif (pas un recruteur).

   Réutilise MessagesListShell (chrome : header, search, swipe-archive,
   edit multi-sélection, FilterSheet, EmptyState). Ce fichier ne porte
   que le hook data athlète + le rendu de ligne (coach-first) + le
   filtre (Tous / Non lu / Archivé).
═══════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import AthletePhotoFill from "@/components/shared/AthletePhotoFill";
import { useAthleteConversations, type AthleteThreadData } from "@/lib/queries/athlete/useAthleteConversations";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import { useMobileToast } from "@/components/mobile/MobileToast";
import { useDebouncedValue } from "@/lib/utils/useDebouncedValue";
import { createClient } from "@/lib/supabase/client";
import { MessagesListShell, type FilterOption } from "@/components/shared/messaging/MessagesListShell";
import { triggerHaptic, relativeTime } from "@/components/shared/messaging/utils";

function useArchiveAthleteConversation() {
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;
  const queryKey = ["conversations", "athlete", userId];

  return useMutation({
    mutationFn: async ({ conversationId, newStatus }: { conversationId: string; newStatus: "ACTIVE" | "ARCHIVE" }) => {
      const supabase = createClient();
      const { error } = await supabase.from("conversations").update({ status: newStatus }).eq("id", conversationId);
      if (error) throw error;
    },
    onMutate: async ({ conversationId, newStatus }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<AthleteThreadData[]>(queryKey);
      queryClient.setQueryData<AthleteThreadData[]>(queryKey, (old) =>
        old ? old.map((t) => (t.id === conversationId ? { ...t, status: newStatus } : t)) : old);
      return { previous };
    },
    onError: (_e, _v, ctx) => { if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous); },
    onSettled: () => { queryClient.invalidateQueries({ queryKey: ["conversations"] }); },
  });
}

type FilterKey = "tous" | "non_lu" | "archive";
const FILTER_OPTIONS: FilterOption<FilterKey>[] = [
  { value: "tous",    label: "Tous" },
  { value: "non_lu",  label: "Non lu" },
  { value: "archive", label: "Archivé" },
];

export function AthleteMessagesMobile() {
  const router = useRouter();
  const toast = useMobileToast();
  const { data: threads = [], isLoading } = useAthleteConversations();
  const archiveMut = useArchiveAthleteConversation();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 200);
  const [filter, setFilter] = useState<FilterKey>("tous");
  const [editMode, setEditMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => { if (threads.length === 0) setEditMode(false); }, [threads.length]);
  useEffect(() => { if (!editMode) setSelected(new Set()); }, [editMode]);

  const filtered = useMemo(() => {
    let list = [...threads];
    if (filter === "non_lu") list = list.filter((t) => t.unreadCount > 0 && t.status !== "ARCHIVE");
    else if (filter === "archive") list = list.filter((t) => t.status === "ARCHIVE");
    else list = list.filter((t) => t.status !== "ARCHIVE");
    if (debouncedSearch.trim().length >= 2) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter((t) =>
        t.coachName.toLowerCase().includes(q) ||
        t.coachSchool.toLowerCase().includes(q) ||
        t.lastMessage.toLowerCase().includes(q));
    }
    return list;
  }, [threads, filter, debouncedSearch]);

  const handleTap = (t: AthleteThreadData) => router.push(`/athlete/messages/${t.id}`);
  const handleToggleSelect = (id: string) => {
    triggerHaptic("Light");
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const handleArchiveSwipe = (t: AthleteThreadData) => {
    const newStatus = t.status === "ARCHIVE" ? "ACTIVE" : "ARCHIVE";
    archiveMut.mutate({ conversationId: t.id, newStatus }, {
      onSuccess: () => {
        triggerHaptic("Medium");
        toast.success({
          message: newStatus === "ARCHIVE" ? "Conversation archivée" : "Conversation réactivée",
          duration: 5000,
          action: { label: "Annuler", onClick: () => archiveMut.mutate({ conversationId: t.id, newStatus: t.status as "ACTIVE" | "ARCHIVE" }) },
        });
      },
      onError: () => toast.error({ message: "Erreur d'archivage" }),
    });
  };
  const handleArchiveSelected = () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    Promise.all(ids.map((id) => archiveMut.mutateAsync({ conversationId: id, newStatus: "ARCHIVE" }))).then(() => {
      triggerHaptic("Medium");
      toast.success({ message: `${ids.length} conversation${ids.length > 1 ? "s archivées" : " archivée"}` });
      setSelected(new Set());
      setEditMode(false);
    }).catch(() => toast.error({ message: "Erreur d'archivage" }));
  };

  const emptyKind = debouncedSearch.length >= 2 ? "search" : filter === "non_lu" ? "non_lu" : filter === "archive" ? "archive" : "all";
  const emptyCopy = {
    all:     { title: "Aucune conversation",           sub: "Écris à un entraîneur ou au directeur sportif de ton école." },
    search:  { title: "Aucun résultat",                sub: "Essaie d'autres termes de recherche." },
    non_lu:  { title: "Tu es à jour",                  sub: "Aucun message non lu." },
    archive: { title: "Aucune conversation archivée",  sub: "Les conversations archivées apparaîtront ici." },
  }[emptyKind];

  /* Coach-first row : avatar coach + nom + (rôle · école) + preview. */
  const renderRow = (t: AthleteThreadData) => {
    const unread = t.unreadCount > 0;
    return (
      <div className="flex items-center gap-3">
        <div className="relative w-[52px] h-[52px] rounded-full overflow-hidden flex-shrink-0 bg-[#2F3440]">
          <AthletePhotoFill photoUrl={t.coachPhotoUrl} firstName={t.coachInitials[0] ?? ""} lastName={t.coachInitials[1] ?? ""} initialsFontSize={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <p className={`text-base truncate ${unread ? "font-bold text-white" : "font-semibold text-white/95"}`}>{t.coachName}</p>
            <span className={`text-[13px] flex-shrink-0 ${unread ? "text-[#22C55E] font-semibold" : "text-white/40"}`}>{relativeTime(t.lastMessageAt)}</span>
          </div>
          <p className="text-[15px] text-white/55 mt-0.5 truncate">{t.coachRole}{t.coachSchool ? ` · ${t.coachSchool}` : ""}</p>
          {t.lastMessage && <p className="text-[15px] text-white/40 mt-0.5 truncate">{t.lastMessage}</p>}
        </div>
      </div>
    );
  };

  return (
    <MessagesListShell<AthleteThreadData>
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
      onCreate={() => router.push("/athlete/messages/nouveau")}
      emptyTitle={emptyCopy.title}
      emptyDescription={emptyCopy.sub}
    />
  );
}
