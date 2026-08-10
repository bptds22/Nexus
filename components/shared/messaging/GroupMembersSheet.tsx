"use client";

/* ═══════════════════════════════════════════════════════════════
   GroupMembersSheet — bottom sheet listant les membres d'un groupe.
   Ouvert au tap sur le header du fil groupe. Les données viennent de
   useGroupThreadMeta (names/roles/initials) : pour un ATHLÈTE, la RLS
   ne renvoie que le STAFF + lui-même (group_participants_select) →
   le sheet ne montre donc jamais les coéquipiers (mineur-safety) ;
   pour le STAFF, tous les membres. Geste vertical seul (pan-y).
═══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import type { GroupMemberRole } from "@/lib/queries/shared/useGroupThread";

export interface GroupMember {
  id: string;
  name: string;
  initials: string;
  role: GroupMemberRole;
  isMe: boolean;
}

export function buildGroupMembers(
  names: Record<string, string>,
  roles: Record<string, GroupMemberRole>,
  initials: Record<string, string>,
  meId: string | undefined,
): GroupMember[] {
  // On itère sur `roles` (= les participants réellement visibles par la RLS),
  // PAS sur `names` : le nom est best-effort (la RLS `users` peut cacher la
  // ligne d'un athlète au staff → nom résolu via `athletes` en amont, sinon
  // « Membre »). Bâtir depuis `names` faisait disparaître tout membre non
  // résolu — c'est ce qui masquait les athlètes côté coach.
  return Object.keys(roles)
    .map((id) => ({
      id,
      name: names[id] || "Membre",
      initials: initials[id] || "?",
      role: roles[id] ?? "ATHLETE",
      isMe: id === meId,
    }))
    // Staff d'abord, puis athlètes ; « Toi » en tête de son groupe.
    .sort((a, b) =>
      a.role !== b.role ? (a.role === "STAFF" ? -1 : 1) : (a.isMe ? -1 : b.isMe ? 1 : a.name.localeCompare(b.name, "fr")),
    );
}

export function GroupMembersSheet({
  open,
  onClose,
  members,
  title = "Membres",
}: {
  open: boolean;
  onClose: () => void;
  members: GroupMember[];
  title?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  let startY = 0;
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 - dragOffset / 600 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }} className="fixed inset-0 z-[55] bg-black/60" onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: dragOffset }} exit={{ y: "100%" }}
            transition={isDragging ? { duration: 0 } : { duration: 0.32, ease: [0.34, 1.56, 0.64, 1] }}
            className="fixed inset-x-0 bottom-0 z-[60] bg-[#111317] rounded-t-2xl flex flex-col"
            style={{ maxHeight: "80dvh", paddingBottom: "env(safe-area-inset-bottom)", touchAction: "pan-y" }}
          >
            <div
              onTouchStart={(e) => { setIsDragging(true); startY = e.touches[0].clientY; }}
              onTouchMove={(e) => { const dy = Math.max(0, e.touches[0].clientY - startY); setDragOffset(dy); }}
              onTouchEnd={() => { if (dragOffset > 100) onClose(); else setDragOffset(0); setIsDragging(false); startY = 0; }}
              className="cursor-grab active:cursor-grabbing"
            >
              <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 rounded-full bg-white/20" /></div>
            </div>
            <div className="px-5 pb-3 shrink-0">
              <h2 className="font-head text-[17px] font-black text-white uppercase tracking-tight">{title}</h2>
              <p className="text-[12px] text-white/45 mt-0.5">{members.length} membre{members.length > 1 ? "s" : ""}</p>
            </div>
            <ul className="flex-1 overflow-y-auto px-4 pb-4 space-y-1.5">
              {members.map((m) => (
                <li key={m.id} className="flex items-center gap-3 p-2.5 rounded-2xl bg-[#1A1D24]">
                  <div className="w-10 h-10 rounded-full bg-[#2F3440] flex items-center justify-center shrink-0">
                    <span className="text-[13px] font-bold text-white/80">{m.initials}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold text-white truncate">
                      {m.name}{m.isMe ? " (toi)" : ""}
                    </p>
                    <p className="text-[12px] text-white/50">{m.role === "STAFF" ? "Entraîneur / staff" : "Athlète"}</p>
                  </div>
                  {m.role === "STAFF" && (
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#818CF8] bg-[#6366F1]/15 rounded-full px-2 py-1 shrink-0">Staff</span>
                  )}
                </li>
              ))}
            </ul>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
