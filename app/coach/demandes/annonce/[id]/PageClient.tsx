"use client";

/* ═══════════════════════════════════════════════════════════════
   Annonce (broadcast) detail — the SENDER's consolidated view.

   Delivery stayed N private 1-on-1 threads. This screen shows the
   announcement ONCE + every recipient's reply, grouped per recipient.
   Tapping a recipient jumps into that individual 1-on-1 thread
   (/coach/demandes/[conversationId]) — the N threads stay fully
   accessible, they're just folded here. Web + Capacitor.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDynamicParam } from "@/lib/platform/useDynamicParam";
import { createClient } from "@/lib/supabase/client";
import AthletePhoto from "@/components/shared/AthletePhoto";
import { loadAnnonceDetail, type AnnonceDetail, type AnnonceRecipient } from "@/lib/queries/coach/loadSenderBroadcasts";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

const NOW = new Date();
function relativeTime(isoStr: string | null): string {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  const mins = Math.floor((NOW.getTime() - d.getTime()) / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Hier";
  if (days < 7) return `Il y a ${days} j`;
  return d.toLocaleDateString("fr-CA", { day: "numeric", month: "long" });
}

const KIND_PILL: Record<AnnonceRecipient["kind"], { label: string; cls: string }> = {
  athlete:   { label: "Athlète",   cls: "bg-[#22C55E]/15 border-[#22C55E]/30 text-[#22C55E]" },
  coach:     { label: "Coach",     cls: "bg-[#14B8A6]/15 border-[#14B8A6]/30 text-[#14B8A6]" },
  recruiter: { label: "Recruteur", cls: "bg-[#E63946]/15 border-[#E63946]/30 text-[#E63946]" },
};

/* ── Recipient row → jumps into the 1-on-1 thread ──────────────── */

function RecipientRow({ r }: { r: AnnonceRecipient }) {
  const pill = KIND_PILL[r.kind];
  const parts = r.name.split(" ");
  return (
    <Link
      href={`/coach/demandes?id=${r.conversationId}`}
      className={`flex items-center gap-3 px-4 sm:px-5 py-3.5 transition-colors hover:bg-[#252D3A] ${
        r.hasUnread ? "bg-[#1E2430]" : "bg-transparent"
      }`}
    >
      {r.kind === "athlete" ? (
        <AthletePhoto photoUrl={r.photoUrl} firstName={parts[0] || ""} lastName={parts[1] || ""} size={40} />
      ) : (
        <div className={`w-10 h-10 rounded-full border flex items-center justify-center shrink-0 ${pill.cls}`}>
          <span className="text-[13px] font-bold">{r.initials}</span>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`text-[14px] truncate ${r.hasUnread ? "text-white font-bold" : "text-[#e0e0e0] font-semibold"}`}>{r.name}</span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border shrink-0 ${pill.cls}`}>{pill.label}</span>
        </div>
        {r.lastReply ? (
          <p className="text-[13px] text-[#9CA3AF] truncate mt-0.5">{r.lastReply}</p>
        ) : (
          <p className="text-[12px] text-[#4a4d56] italic mt-0.5">Aucune réponse</p>
        )}
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        {r.lastReplyAt && <span className="text-[11px] text-[#6b7280]">{relativeTime(r.lastReplyAt)}</span>}
        {r.hasUnread && <span className="w-2 h-2 rounded-full bg-[#8B5CF6]" />}
      </div>
    </Link>
  );
}

/* ── Shared body (announcement once + recipients) ──────────────── */

function AnnonceBody({ d }: { d: AnnonceDetail }) {
  const replied = d.recipients.filter((r) => r.replyCount > 0).length;
  return (
    <div className="max-w-[820px] mx-auto w-full px-4 sm:px-6 py-6 space-y-6">
      {/* Announcement — shown once */}
      <div className="rounded-2xl border border-[#8B5CF6]/30 bg-[#8B5CF6]/[0.07] p-5">
        <div className="flex items-center gap-2 mb-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 11l18-5v12L3 14v-3z" /><path d="M11.6 16.8a3 3 0 11-5.8-1.6" />
          </svg>
          <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#A78BFA]">Ton annonce</span>
          <span className="text-[11px] text-[#6b7280]">· {relativeTime(d.createdAt)}</span>
        </div>
        <p className="text-[15px] text-white leading-relaxed whitespace-pre-wrap">{d.content}</p>
      </div>

      {/* Recipients + replies */}
      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#6b7280]">
            Destinataires · {d.recipientCount}
          </p>
          {replied > 0 && (
            <span className="text-[11px] font-bold text-[#A78BFA]">{replied} réponse{replied > 1 ? "s" : ""}</span>
          )}
        </div>
        {d.recipients.length === 0 ? (
          <p className="text-[13px] text-[#6b7280] px-1 py-3">Aucun destinataire.</p>
        ) : (
          <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] overflow-hidden divide-y divide-[#2D3748]/50">
            {d.recipients.map((r) => <RecipientRow key={r.conversationId} r={r} />)}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE
═══════════════════════════════════════════════════════════════ */

export default function PageClient() {
  const id = useDynamicParam("id");
  const router = useRouter();
  const [detail, setDetail] = useState<AnnonceDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { if (!cancelled) setLoading(false); return; }
        const d = await loadAnnonceDetail(supabase, user.id, id);
        if (!cancelled) setDetail(d);
      } catch (err) {
        console.error("[Annonce] load error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#111317] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#8B5CF6] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="min-h-screen bg-[#111317] flex flex-col items-center justify-center gap-4">
        <p className="text-[#9CA3AF] text-[14px]">Annonce introuvable</p>
        <Link href="/coach/demandes" className="text-[#8B5CF6] text-[14px] font-bold hover:text-[#A78BFA]">Retour aux messages</Link>
      </div>
    );
  }

  const subtitle = `${detail.targetLabel} · Envoyé à ${detail.recipientCount}`;

  if (IS_CAPACITOR) {
    return (
      <div className="min-h-[100dvh] bg-[#111317] text-white flex flex-col">
        <div className="sticky top-0 z-30 bg-[#111317]/95 backdrop-blur-md border-b border-white/[0.06]" style={{ paddingTop: "env(safe-area-inset-top)" }}>
          <div className="flex items-center px-4 py-2 gap-2 min-h-[64px]">
            <button type="button" onClick={() => router.push("/coach/demandes")} aria-label="Retour" className="w-11 h-11 rounded-full flex items-center justify-center active:bg-white/5 flex-shrink-0">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
            <div className="min-w-0">
              <h1 className="font-head text-[18px] font-black text-white uppercase tracking-tight truncate">Annonce</h1>
              <p className="text-[12px] text-[#A78BFA] truncate">{subtitle}</p>
            </div>
          </div>
        </div>
        <div className="flex-1 nx-mobile-pb-tabbar overflow-y-auto">
          <AnnonceBody d={detail} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111317] flex flex-col">
      <div className="bg-[#1A1D24]/80 backdrop-blur-sm border-b border-[#2D3748] sticky top-0 z-30">
        <div className="max-w-[1280px] mx-auto px-6 py-3 flex items-center gap-3">
          <Link href="/coach/demandes" className="text-[13px] text-[#6b7280] hover:text-white transition-colors flex items-center gap-1.5 shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
            Retour
          </Link>
          <div className="min-w-0">
            <p className="text-[14px] font-bold text-white truncate">Annonce</p>
            <p className="text-[12px] text-[#A78BFA] truncate">{subtitle}</p>
          </div>
        </div>
      </div>
      <AnnonceBody d={detail} />
    </div>
  );
}
