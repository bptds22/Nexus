"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import NexusLogo from "@/components/ui/NexusLogo";
import PlaybookBackground from "@/app/components/PlaybookBackground";

/* Invitation landing page.
   Reads ?token=… from the URL, calls resolve_invitation_token RPC,
   then presents the invitee with two role-picker CTAs that route
   to /auth (athlete) or /auth/pro (coach/recruteur) preserving the
   token + locked email through to signup. */

interface InvitationRow {
  email: string;
  school_id: string | null;
  school_name: string | null;
  locale: string;
  message: string | null;
  inviter_first_name: string | null;
  inviter_last_name: string | null;
  status: string;
  expires_at: string;
}

type ResolveState =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "invalid" }
  | { kind: "valid"; row: InvitationRow };

export default function InvitationPage() {
  return (
    <Suspense>
      <InvitationContent />
    </Suspense>
  );
}

function InvitationContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [state, setState] = useState<ResolveState>(token ? { kind: "loading" } : { kind: "missing" });

  useEffect(() => {
    if (!token) { setState({ kind: "missing" }); return; }
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .rpc("resolve_invitation_token", { p_token: token })
        .single();
      if (cancelled) return;
      if (error || !data) {
        setState({ kind: "invalid" });
        return;
      }
      const row = data as InvitationRow;
      const expiresOk = new Date(row.expires_at).getTime() > Date.now();
      if (row.status !== "PENDING" || !expiresOk) {
        setState({ kind: "invalid" });
        return;
      }
      setState({ kind: "valid", row });
    })();
    return () => { cancelled = true; };
  }, [token]);

  return (
    <div className="hero-playbook bg-[#111317] min-h-screen flex flex-col">
      <PlaybookBackground />

      <div className="relative z-10 pt-8 pb-4 flex justify-center">
        <NexusLogo variant="white" height={36} href="/" priority />
      </div>

      <section className="flex-1 flex items-start justify-center relative px-4 py-8">
        <div className="relative z-10 w-full max-w-[520px]">
          <div className="bg-[#1A1D24] border border-white/5 rounded-xl p-6 sm:p-8">
            {state.kind === "loading" && <LoadingCard />}
            {state.kind === "missing" && <InvalidCard reason="Aucun jeton d'invitation fourni." />}
            {state.kind === "invalid" && <InvalidCard reason="Cette invitation n'est plus valide. Elle a peut-être expiré ou été révoquée." />}
            {state.kind === "valid" && token && <ValidCard token={token} row={state.row} />}
          </div>
        </div>
      </section>
    </div>
  );
}

function LoadingCard() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-8 h-8 border-2 border-[#E63946]/30 border-t-[#E63946] rounded-full animate-spin" />
    </div>
  );
}

function InvalidCard({ reason }: { reason: string }) {
  return (
    <div className="text-center space-y-4">
      <div className="w-12 h-12 rounded-full bg-[#EF4444]/15 flex items-center justify-center mx-auto">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <h1 className="font-head text-xl font-black text-white uppercase tracking-tight">Invitation invalide</h1>
      <p className="text-[14px] text-[#9CA3AF] leading-relaxed">{reason}</p>
      <Link href="/auth" className="inline-block text-[13px] font-bold text-[#E63946] hover:text-[#D42B22] transition-colors">
        Retour à la page de connexion →
      </Link>
    </div>
  );
}

function ValidCard({ token, row }: { token: string; row: InvitationRow }) {
  const inviter = [row.inviter_first_name, row.inviter_last_name].filter(Boolean).join(" ") || "Un membre";
  const schoolPart = row.school_name ? ` de ${row.school_name}` : "";
  const emailQs = `&email=${encodeURIComponent(row.email)}`;
  const athleteHref = `/auth?invitation_token=${encodeURIComponent(token)}${emailQs}`;
  const proHref = `/auth/pro?invitation_token=${encodeURIComponent(token)}${emailQs}`;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">Bonjour! 👋</h1>
        <p className="text-[14px] text-[#9CA3AF] leading-relaxed mt-2">
          <span className="text-white font-bold">{inviter}</span>{schoolPart} vous invite à rejoindre Nexus.
        </p>
        {row.message && (
          <p className="text-[13px] text-[#9CA3AF] italic mt-3 border-l-2 border-[#E63946]/40 pl-3">
            «&nbsp;{row.message}&nbsp;»
          </p>
        )}
      </div>

      <div className="bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-3">
        <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-[#6B7280]">Invitation pour</p>
        <p className="text-[14px] text-white font-mono mt-1">{row.email}</p>
      </div>

      <div className="space-y-3">
        <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-[#9CA3AF]">Comment vous décrivez-vous?</p>
        <Link href={athleteHref}
          className="w-full flex items-start gap-4 p-4 rounded-xl border border-white/10 hover:border-[#E63946] hover:bg-[rgba(230,57,70,0.06)] transition-all text-left">
          <div className="shrink-0 mt-0.5 text-[#E63946]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="6" r="4" /><path d="M4 22a8 8 0 0116 0" />
            </svg>
          </div>
          <div>
            <p className="font-head font-bold text-[14px] uppercase tracking-wide text-white">Je suis un athlète</p>
            <p className="text-[12px] text-[#6B7280] leading-snug mt-0.5">Crée ton profil et rends-toi visible aux recruteurs CÉGEP.</p>
          </div>
        </Link>

        <Link href={proHref}
          className="w-full flex items-start gap-4 p-4 rounded-xl border border-white/10 hover:border-[#E63946] hover:bg-[rgba(230,57,70,0.06)] transition-all text-left">
          <div className="shrink-0 mt-0.5 text-[#E63946]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
            </svg>
          </div>
          <div>
            <p className="font-head font-bold text-[14px] uppercase tracking-wide text-white">Je suis un entraîneur ou recruteur</p>
            <p className="text-[12px] text-[#6B7280] leading-snug mt-0.5">Gère ton équipe, recrute, ou suis tes prospects.</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
