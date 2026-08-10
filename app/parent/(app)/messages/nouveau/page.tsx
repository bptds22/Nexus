"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import ParentStaffPicker from "@/components/messaging/ParentStaffPicker";
import type { StaffOption } from "@/components/messaging/SchoolStaffPicker";
import { findOrCreateParentCoachConversation } from "@/lib/queries/messaging/createParentCoachConversation";

/* ═══════════════════════════════════════════════════════════════
   Parent — Nouveau message. Pick MY child (get_my_children) → pick a
   staff member of that child's school/club (list_messageable_staff_for_child,
   mirrors the RLS) → find-or-create the PARENT_COACH thread → route in.
═══════════════════════════════════════════════════════════════ */

interface Child {
  athlete_id: string;
  first_name: string | null;
  last_name: string | null;
  photo_url: string | null;
  sport: string | null;
  school: string | null;
}

export default function ParentNouveauMessagePage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [parentId, setParentId] = useState<string | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [childId, setChildId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }
        setParentId(user.id);
        const { data } = await supabase.rpc("get_my_children");
        const rows = (data as Child[] | null) ?? [];
        setChildren(rows);
        if (rows.length === 1) setChildId(rows[0].athlete_id);
      } catch (err) {
        console.error("[ParentNouveau] load failed:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleSelect(staff: StaffOption) {
    if (!parentId || !childId || busyId) return;
    setBusyId(staff.id);
    setError(null);
    const supabase = createClient();
    const { conversationId, error: err } = await findOrCreateParentCoachConversation(supabase, {
      parentId,
      coachId: staff.id,
      athleteId: childId,
    });
    if (err || !conversationId) {
      const code = (err as { code?: string } | undefined)?.code;
      const isRls = code === "42501" || /permission denied|row-level security|policy/i.test((err as { message?: string } | undefined)?.message ?? "");
      setError(isRls ? "Vous ne pouvez écrire qu'au personnel de l'école de votre enfant." : ((err as { message?: string } | undefined)?.message || "Impossible d'ouvrir la conversation."));
      setBusyId(null);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
    router.push(`/parent/messages?id=${conversationId}`);
  }

  const childName = (c: Child) => `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Mon enfant";

  return (
    <div className="space-y-6">
      <div>
        <Link href="/parent/messages" className="inline-flex items-center gap-1.5 text-[14px] text-[#9CA3AF] hover:text-white transition-colors mb-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          Retour aux messages
        </Link>
        <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">Nouveau message</h1>
        <p className="text-[14px] text-[#9CA3AF] mt-1">Écrivez à un membre du personnel de l&apos;école de votre enfant.</p>
      </div>

      {error && <div className="rounded-lg border border-[#EF4444]/40 bg-[#EF4444]/10 px-4 py-3 text-[13px] text-[#FCA5A5]">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-12"><div className="w-7 h-7 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" /></div>
      ) : children.length === 0 ? (
        <div className="bg-[#13151a] border border-[#2D3748] rounded-lg p-5"><p className="text-[14px] text-[#9CA3AF]">Aucun enfant associé à ce compte.</p></div>
      ) : (
        <div className="space-y-5">
          {/* Child selector (only when >1 child) */}
          {children.length > 1 && (
            <div>
              <h2 className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#6b7280] mb-2">Pour quel enfant&nbsp;?</h2>
              <div className="flex flex-wrap gap-2">
                {children.map((c) => (
                  <button
                    key={c.athlete_id}
                    type="button"
                    onClick={() => setChildId(c.athlete_id)}
                    className={`px-3.5 py-1.5 rounded-full text-[13px] font-semibold border transition-colors ${
                      childId === c.athlete_id ? "bg-[#E63946]/15 border-[#E63946]/40 text-[#E63946]" : "bg-[#13151a] border-[#2D3748] text-[#9CA3AF] hover:text-white"
                    }`}
                  >
                    {childName(c)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {childId && (
            <div>
              <h2 className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#6b7280] mb-2">À qui voulez-vous écrire&nbsp;?</h2>
              <ParentStaffPicker childId={childId} onSelect={handleSelect} busyId={busyId} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
