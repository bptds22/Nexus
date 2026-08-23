"use client";

/* ─────────────────────────────────────────────────────────────────
   Admin — Messages de service.

   REMPLACE le bloc « Diffusion » de /admin/settings, qui n'envoyait
   pas de messages : il écrivait des lignes de notification dans TROIS
   tables différentes (athlete_notifications, activities,
   recruiter_activity_log), sans fil, sans historique lisible par le
   destinataire, et sans rien qui ressemble à un envoi atomique — un
   échec en cours de route laissait la moitié des rôles servis.

   Ici, tout passe par la RPC send_admin_message :
   · le droit est relu EN BASE (is_admin()), jamais depuis le client ;
   · l'expéditeur AFFICHÉ est l'identité de service, l'admin humain
     n'est conservé que dans broadcasts.sender_id (qui a décidé) ;
   · un destinataire introuvable ou inactif fait ÉCHOUER l'envoi
     entier — pas d'envoi partiel silencieux ;
   · un seul aller-retour, une seule transaction.

   Ce qui reste côté client est donc du confort : composer, choisir,
   confirmer. Aucun contrôle d'accès ne vit ici.
───────────────────────────────────────────────────────────────── */

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useDebouncedValue } from "@/lib/utils/useDebouncedValue";

const MAX_LEN = 4000; // Identique au plafond de la RPC — l'UI prévient, la base tranche.

type AudienceKind = "everyone" | "all_athletes" | "all_coaches" | "all_recruiters" | "user";
type Category = "service" | "individuel";

const AUDIENCES: { kind: AudienceKind; label: string; hint: string }[] = [
  { kind: "everyone", label: "Tout le monde", hint: "Athlètes actifs, entraîneurs et recruteurs" },
  { kind: "all_athletes", label: "Athlètes", hint: "Fiches au statut ACTIF" },
  { kind: "all_coaches", label: "Entraîneurs", hint: "Comptes ACTIF" },
  { kind: "all_recruiters", label: "Recruteurs", hint: "Comptes ACTIF" },
  { kind: "user", label: "Personnes précises", hint: "Recherche par nom ou courriel" },
];

const ROLE_LABEL: Record<string, string> = {
  ATHLETE: "Athlète",
  COACH: "Entraîneur",
  RECRUTEUR: "Recruteur",
};

interface UserOption {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
}

interface SentBroadcast {
  id: string;
  audience: Record<string, unknown>;
  recipient_count: number;
  created_at: string;
}

function optionLabel(u: UserOption): string {
  const name = `${u.first_name || ""} ${u.last_name || ""}`.trim();
  return name || u.email;
}

function audienceSummary(a: Record<string, unknown>): string {
  const kind = a?.kind as string;
  const found = AUDIENCES.find((x) => x.kind === kind);
  if (kind === "user") {
    const n = Array.isArray(a?.ids) ? (a.ids as unknown[]).length : 0;
    return `${n} personne${n > 1 ? "s" : ""}`;
  }
  return found?.label ?? kind ?? "—";
}

export default function AdminMessagesPage() {
  const supabase = useMemo(() => createClient(), []);

  const [kind, setKind] = useState<AudienceKind>("everyone");
  const [category, setCategory] = useState<Category>("service");
  const [content, setContent] = useState("");
  const [picked, setPicked] = useState<UserOption[]>([]);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [results, setResults] = useState<UserOption[]>([]);

  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [history, setHistory] = useState<SentBroadcast[]>([]);
  const [historyVersion, setHistoryVersion] = useState(0);

  /* Historique — `broadcasts` n'est lisible que par SON expéditeur
     (policy broadcast_sender_read). C'est donc « mes envois », pas
     « les envois de la plateforme ». Élargir demanderait une policy
     admin dédiée : hors périmètre de ce lot, et volontairement dit
     ici plutôt que laissé à découvrir. */
  useEffect(() => {
    (async () => {
      const { data, error: err } = await supabase
        .from("broadcasts")
        .select("id, audience, recipient_count, created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      if (err) {
        console.error("[AdminMessages] history error:", err.message);
        return;
      }
      setHistory((data || []) as SentBroadcast[]);
    })();
  }, [supabase, historyVersion]);

  /* Recherche de destinataires — bornée aux trois rôles que la RPC sait
     servir. Un ADMIN ou un PARTNER sélectionné ici ferait échouer
     l'envoi entier au contrôle « destinataire introuvable ou inactif » :
     autant ne pas le proposer. L'identité de service est exclue pour la
     même raison — elle ne s'écrit pas à elle-même. */
  useEffect(() => {
    if (kind !== "user") return;
    const q = debouncedSearch.trim();
    // Pas de setResults([]) synchrone ici : vider l'état depuis le corps
    // d'un effet déclenche une cascade de rendus (react-hooks/set-state-in-effect).
    // L'affichage est borné par `visibleResults` en dessous — un reste
    // périmé dans `results` ne peut pas apparaître.
    if (q.length < 2) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("users")
        .select("id, email, first_name, last_name, role")
        .in("role", ["ATHLETE", "COACH", "RECRUTEUR"])
        .eq("status", "ACTIF")
        .eq("is_service_identity", false)
        .or(`email.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
        .limit(10);
      if (!cancelled) setResults((data || []) as UserOption[]);
    })();
    return () => { cancelled = true; };
  }, [supabase, debouncedSearch, kind]);

  /* Une recherche trop courte n'affiche rien, quel que soit le contenu de
     `results` (voir l'effet ci-dessus). */
  const visibleResults = debouncedSearch.trim().length >= 2 ? results : [];

  const trimmed = content.trim();
  const tooLong = content.length > MAX_LEN;
  const missingRecipients = kind === "user" && picked.length === 0;
  const canSend = trimmed.length > 0 && !tooLong && !missingRecipients && !sending;

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  }

  async function send() {
    if (!canSend) return;
    setSending(true);
    setError(null);

    const audience: Record<string, unknown> = { kind, category };
    if (kind === "user") audience.ids = picked.map((p) => p.id);

    const { data, error: err } = await supabase.rpc("send_admin_message", {
      p_audience: audience,
      p_content: trimmed,
    });

    setSending(false);

    if (err) {
      /* Les messages de la RPC sont préfixés « NEXUS: » précisément pour
         atteindre cet écran. On les affiche tels quels — ils disent ce
         qui a échoué et confirment que RIEN n'est parti (un RAISE annule
         la transaction, ligne d'audit comprise). */
      setError(err.message || "Envoi impossible.");
      setConfirming(false);
      return;
    }

    const sent = (data as { sent?: number } | null)?.sent ?? 0;
    showToast(`Message envoyé à ${sent} destinataire${sent > 1 ? "s" : ""}.`);
    setContent("");
    setPicked([]);
    setSearch("");
    setConfirming(false);
    setHistoryVersion((v) => v + 1);
  }

  const selectedAudience = AUDIENCES.find((a) => a.kind === kind)!;

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">
          Messages de service
        </h1>
        <p className="text-[13px] text-[#6b7280] mt-1">
          Envoyé sous l&apos;identité <span className="text-[#9CA3AF] font-semibold">Équipe Nexus</span>.
          Le destinataire le reçoit dans sa messagerie, en lecture seule.
        </p>
      </div>

      {/* ── Audience ─────────────────────────────────────────── */}
      <section className="bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 space-y-4">
        <h2 className="font-head text-[13px] font-black text-white uppercase tracking-[0.15em]">
          Destinataires
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {AUDIENCES.map((a) => (
            <button
              key={a.kind}
              type="button"
              onClick={() => setKind(a.kind)}
              className={`text-left px-4 py-3 rounded-lg border transition-colors ${
                kind === a.kind
                  ? "border-[#E63946] bg-[#E63946]/10"
                  : "border-[#2D3748] bg-[#111317] hover:border-[#4a4d56]"
              }`}
            >
              <p className={`text-[13px] font-bold ${kind === a.kind ? "text-white" : "text-[#e0e0e0]"}`}>{a.label}</p>
              <p className="text-[11px] text-[#6b7280] mt-0.5">{a.hint}</p>
            </button>
          ))}
        </div>

        {kind === "user" && (
          <div className="space-y-3 pt-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par nom ou courriel…"
              className="w-full bg-[#111317] border border-[#2D3748] rounded-lg px-4 py-2.5 text-[13px] text-[#e0e0e0] placeholder:text-[#6b7280] focus:border-[#E63946] outline-none transition-colors"
            />
            {visibleResults.length > 0 && (
              <ul className="rounded-lg border border-[#2D3748] divide-y divide-[#2D3748]/60 overflow-hidden">
                {visibleResults
                  .filter((r) => !picked.some((p) => p.id === r.id))
                  .map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => { setPicked((prev) => [...prev, r]); setSearch(""); setResults([]); }}
                        className="w-full text-left px-4 py-2.5 bg-[#111317] hover:bg-[#1E2430] transition-colors flex items-center justify-between gap-3"
                      >
                        <span className="min-w-0">
                          <span className="block text-[13px] text-white truncate">{optionLabel(r)}</span>
                          <span className="block text-[11px] text-[#6b7280] truncate">{r.email}</span>
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF] shrink-0">
                          {ROLE_LABEL[r.role] ?? r.role}
                        </span>
                      </button>
                    </li>
                  ))}
              </ul>
            )}
            {picked.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {picked.map((p) => (
                  <span key={p.id} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#111317] border border-[#2D3748] text-[12px] text-[#e0e0e0]">
                    {optionLabel(p)}
                    <button
                      type="button"
                      onClick={() => setPicked((prev) => prev.filter((x) => x.id !== p.id))}
                      className="text-[#6b7280] hover:text-white transition-colors"
                      aria-label={`Retirer ${optionLabel(p)}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Message ──────────────────────────────────────────── */}
      <section className="bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-head text-[13px] font-black text-white uppercase tracking-[0.15em]">
            Message
          </h2>
          <span className={`text-[11px] font-semibold ${tooLong ? "text-[#E63946]" : "text-[#6b7280]"}`}>
            {content.length} / {MAX_LEN}
          </span>
        </div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={7}
          placeholder="Écrire le message…"
          className="w-full bg-[#111317] border border-[#2D3748] rounded-lg px-4 py-3 text-[14px] text-[#e0e0e0] placeholder:text-[#6b7280] focus:border-[#E63946] outline-none transition-colors resize-none"
        />

        <div>
          <label className="block text-[11px] font-bold text-[#6b7280] uppercase tracking-wider mb-2">
            Catégorie
          </label>
          <div className="flex gap-2">
            {(["service", "individuel"] as Category[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`px-4 py-2 rounded-lg text-[12px] font-bold uppercase tracking-wider border transition-colors ${
                  category === c
                    ? "border-[#E63946] bg-[#E63946]/10 text-white"
                    : "border-[#2D3748] bg-[#111317] text-[#9CA3AF] hover:border-[#4a4d56]"
                }`}
              >
                {c === "service" ? "Service" : "Individuel"}
              </button>
            ))}
          </div>
          {/* La catégorie voyage dans broadcasts.audience et reste
              atteignable depuis n'importe quel message via
              messages.broadcast_id — c'est elle qui permettra d'arbitrer
              la notification des parents de mineurs sans migration. */}
          <p className="text-[11px] text-[#6b7280] mt-2 leading-relaxed">
            Conservée avec l&apos;envoi. Servira à arbitrer plus tard qui est notifié
            (par exemple les parents d&apos;un mineur) sans changer le schéma.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-[#E63946]/40 bg-[#E63946]/10 px-4 py-3">
            <p className="text-[13px] text-[#ffb3b9] leading-relaxed">{error}</p>
            <p className="text-[11px] text-[#9CA3AF] mt-1.5">Rien n&apos;a été envoyé.</p>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="text-[12px] text-[#6b7280]">
            {missingRecipients
              ? "Choisis au moins un destinataire."
              : `Audience : ${selectedAudience.label}`}
          </p>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={!canSend}
            className="px-5 py-2.5 rounded-lg bg-[#E63946] text-white font-bold text-[13px] uppercase tracking-wider hover:bg-[#D42B22] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Envoyer
          </button>
        </div>
      </section>

      {/* ── Historique ───────────────────────────────────────── */}
      {history.length > 0 && (
        <section className="bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6">
          <h2 className="font-head text-[13px] font-black text-white uppercase tracking-[0.15em] mb-1">
            Mes derniers envois
          </h2>
          <p className="text-[11px] text-[#6b7280] mb-4">
            Seuls tes propres envois sont visibles ici.
          </p>
          <ul className="space-y-2">
            {history.map((h) => (
              <li key={h.id} className="px-3 py-2.5 rounded-lg bg-[#111317] border border-white/5 flex items-center justify-between gap-3">
                <span className="text-[12px] text-[#e0e0e0]">
                  {audienceSummary(h.audience)}
                  <span className="text-[#6b7280]"> · {h.recipient_count} destinataire{h.recipient_count > 1 ? "s" : ""}</span>
                </span>
                <span className="text-[11px] text-[#6b7280] shrink-0">
                  {new Date(h.created_at).toLocaleString("fr-CA", { dateStyle: "short", timeStyle: "short" })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Confirmation ─────────────────────────────────────── */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !sending && setConfirming(false)} />
          <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 w-full max-w-[480px] shadow-2xl mx-4">
            <h2 className="font-head text-[16px] font-black text-white uppercase mb-3">
              Envoyer le message
            </h2>
            <p className="text-[13px] text-[#9CA3AF] mb-4 leading-relaxed">
              Envoyer à <span className="font-bold text-white">
                {kind === "user" ? `${picked.length} personne${picked.length > 1 ? "s" : ""}` : selectedAudience.label}
              </span>, sous l&apos;identité <span className="font-bold text-white">Équipe Nexus</span>.
              Un message envoyé ne peut pas être repris.
            </p>
            <div className="bg-[#111317] border border-white/5 rounded-lg px-3 py-2.5 mb-6 max-h-[180px] overflow-y-auto">
              <p className="text-[13px] text-[#E0E0E0] leading-snug whitespace-pre-wrap">{trimmed}</p>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={sending}
                className="px-4 py-2.5 text-[13px] font-bold text-[#9CA3AF] hover:text-white transition-colors disabled:opacity-40"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={send}
                disabled={sending}
                className="px-5 py-2.5 rounded-lg bg-[#E63946] text-white font-bold text-[13px] uppercase tracking-wider hover:bg-[#D42B22] disabled:opacity-40 transition-colors"
              >
                {sending ? "Envoi…" : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl bg-[#22C55E] text-[#0b0d10] text-[13px] font-bold shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  );
}
