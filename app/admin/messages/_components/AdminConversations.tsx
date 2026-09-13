"use client";
/* ─────────────────────────────────────────────────────────────────
   Admin — Conversations (boîte de réception des fils ADMIN_USER).

   Ce que la page « Envoyer » ne fait pas : elle compose et garde
   l'historique des broadcasts, mais ne lit AUCUN fil entrant. Sans
   cet onglet, ouvrir la réponse côté utilisateur reviendrait à lui
   promettre un chemin court vers un interlocuteur qui ne lit pas.

   Rien de neuf en base : `admins read conversations` et
   `admins read messages` (toutes deux `is_admin()`) existent déjà,
   et l'envoi passe par la RPC `send_admin_message` en place. Cet
   écran est du WEB PUR — il n'est pas contraint par le binaire
   mobile et prend effet au merge.

   L'envoi reste borné par la RPC : le droit est relu en base, jamais
   décidé ici.
───────────────────────────────────────────────────────────────── */
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Fil = {
  id: string;
  lastMessageAt: string | null;
  contrepartieId: string | null;
  role: "ATHLETE" | "COACH" | "RECRUTEUR" | "—";
  nom: string;
  apercu: string;
};

type Msg = { id: string; sender_id: string; content: string; created_at: string; retracted_at: string | null };

function quand(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const j = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (j === 0) return d.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" });
  if (j === 1) return "hier";
  if (j < 7) return `il y a ${j} j`;
  return d.toLocaleDateString("fr-CA", { day: "numeric", month: "short" });
}

export default function AdminConversations() {
  const [fils, setFils] = useState<Fil[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState<Fil | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [reponse, setReponse] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [serviceId, setServiceId] = useState<string | null>(null);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    const supabase = createClient();

    const { data: svc } = await supabase
      .from("users").select("id").eq("is_service_identity", true).maybeSingle();
    setServiceId(svc?.id ?? null);

    /* Tri par activité récente : c'est l'ordre d'un support — le fil qui
       vient de bouger passe devant, pas le plus ancien. */
    const { data, error } = await supabase
      .from("conversations")
      .select("id, last_message_at, athlete_id, coach_id, recruiter_id")
      .eq("conversation_type", "ADMIN_USER")
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(200);
    if (error) { setErreur(error.message); setChargement(false); return; }

    const lignes = data ?? [];
    // Les athlètes passent par athletes.user_id ; coach et recruteur sont
    // déjà des user_id. Deux résolutions, un seul aller-retour chacune.
    const athleteIds = lignes.map((c) => c.athlete_id).filter(Boolean) as string[];
    const userIds = lignes.flatMap((c) => [c.coach_id, c.recruiter_id]).filter(Boolean) as string[];

    const athMap = new Map<string, { userId: string | null; nom: string }>();
    if (athleteIds.length) {
      const { data: a } = await supabase
        .from("athletes").select("id, user_id, first_name, last_name").in("id", athleteIds);
      (a ?? []).forEach((r) => athMap.set(r.id, {
        userId: r.user_id,
        nom: `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || "Athlète",
      }));
    }
    const uMap = new Map<string, string>();
    if (userIds.length) {
      const { data: u } = await supabase
        .from("users").select("id, first_name, last_name").in("id", userIds);
      (u ?? []).forEach((r) => uMap.set(r.id, `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || "Utilisateur"));
    }

    const { data: derniers } = await supabase
      .from("messages")
      .select("conversation_id, content, created_at")
      .in("conversation_id", lignes.map((c) => c.id))
      .order("created_at", { ascending: false });
    const apercuMap = new Map<string, string>();
    (derniers ?? []).forEach((m) => {
      if (!apercuMap.has(m.conversation_id)) apercuMap.set(m.conversation_id, m.content ?? "");
    });

    setFils(lignes.map((c) => {
      const ath = c.athlete_id ? athMap.get(c.athlete_id) : null;
      const role: Fil["role"] = c.athlete_id ? "ATHLETE" : c.coach_id ? "COACH" : c.recruiter_id ? "RECRUTEUR" : "—";
      const nom = ath?.nom ?? (c.coach_id ? uMap.get(c.coach_id) : c.recruiter_id ? uMap.get(c.recruiter_id) : null) ?? "—";
      return {
        id: c.id,
        lastMessageAt: c.last_message_at,
        contrepartieId: ath?.userId ?? c.coach_id ?? c.recruiter_id ?? null,
        role, nom,
        apercu: (apercuMap.get(c.id) ?? "").slice(0, 120),
      };
    }));
    setChargement(false);
  }, []);

  useEffect(() => { void charger(); }, [charger]);

  const ouvrir = async (f: Fil) => {
    setOuvert(f); setMsgs([]); setReponse("");
    const supabase = createClient();
    const { data } = await supabase
      .from("messages")
      .select("id, sender_id, content, created_at, retracted_at")
      .eq("conversation_id", f.id)
      .order("created_at", { ascending: true });
    setMsgs((data ?? []) as Msg[]);
  };

  const repondre = async () => {
    if (!ouvert || !reponse.trim() || !ouvert.contrepartieId) return;
    setEnvoi(true);
    const supabase = createClient();
    /* La RPC existante, pas un INSERT direct : le droit est relu en base
       (is_admin()) et l'expéditeur affiché reste l'identité de service. */
    const { error } = await supabase.rpc("send_admin_message", {
      /* Signature réelle : (p_audience jsonb, p_content text). Même forme
         d'audience que l'onglet Envoyer — { kind, category, ids }. La
         catégorie est « individuel » : c'est une réponse à une personne,
         pas un message de service diffusé. */
      p_audience: { kind: "user", category: "individuel", ids: [ouvert.contrepartieId] },
      p_content: reponse.trim(),
    });
    setEnvoi(false);
    if (error) { setErreur(error.message); return; }
    setReponse("");
    await ouvrir(ouvert);
    await charger();
  };

  if (chargement) return <p className="text-[13px] text-[#6b7280]">Chargement…</p>;

  return (
    <div className="space-y-4">
      {erreur && (
        <p className="text-[13px] text-[#FCA5A5] bg-[#2A1416] border border-[#E63946] rounded-lg px-4 py-3">{erreur}</p>
      )}

      {!ouvert ? (
        <section className="bg-[#1A1D24] border border-[#2D3748] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#2D3748] flex items-center justify-between">
            <h2 className="font-head text-[13px] font-black text-white uppercase tracking-[0.15em]">
              Fils ouverts
            </h2>
            <span className="text-[12px] text-[#6b7280]">{fils.length}</span>
          </div>
          {fils.length === 0 ? (
            <p className="px-6 py-8 text-[13px] text-[#6b7280]">Aucune conversation.</p>
          ) : (
            <ul className="divide-y divide-[#2D3748]">
              {fils.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => void ouvrir(f)}
                    className="w-full text-left px-6 py-4 hover:bg-[#20242D] transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[14px] font-bold text-white truncate">{f.nom}</span>
                      <span className="text-[11px] text-[#6b7280] shrink-0">{quand(f.lastMessageAt)}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-black uppercase tracking-[0.15em] text-[#6b7280]">{f.role}</span>
                      <span className="text-[12px] text-[#9CA3AF] truncate">{f.apercu}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <section className="bg-[#1A1D24] border border-[#2D3748] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#2D3748] flex items-center gap-3">
            <button
              type="button"
              onClick={() => setOuvert(null)}
              className="text-[12px] font-bold uppercase tracking-wider text-[#E63946] hover:text-[#ff4d5a]"
            >
              ← Retour
            </button>
            <span className="text-[14px] font-bold text-white truncate">{ouvert.nom}</span>
            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-[#6b7280]">{ouvert.role}</span>
          </div>

          <div className="px-6 py-5 space-y-3 max-h-[52vh] overflow-y-auto">
            {msgs.length === 0 ? (
              <p className="text-[13px] text-[#6b7280]">Aucun message.</p>
            ) : msgs.map((m) => {
              const duService = serviceId != null && m.sender_id === serviceId;
              return (
                <div key={m.id} className={`flex ${duService ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-xl px-3.5 py-2.5 ${duService ? "bg-[#E63946]" : "bg-[#262628]"}`}>
                    <p className="text-[14px] text-white leading-relaxed whitespace-pre-wrap">
                      {m.retracted_at ? <em className="text-[#9CA3AF]">Message retiré</em> : m.content}
                    </p>
                    <p className="text-[10px] text-white/50 mt-1">{quand(m.created_at)}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="px-6 py-4 border-t border-[#2D3748] flex items-end gap-2">
            <textarea
              value={reponse}
              onChange={(e) => setReponse(e.target.value)}
              rows={2}
              placeholder="Répondre…"
              className="flex-1 resize-none rounded-xl border border-[#2D3748] bg-[#111317] px-3.5 py-2.5 text-[14px] text-white placeholder:text-[#6b7280] focus:outline-none focus:border-[#4a4d56]"
            />
            <button
              type="button"
              onClick={() => void repondre()}
              disabled={envoi || !reponse.trim() || !ouvert.contrepartieId}
              className="shrink-0 rounded-xl px-4 py-2.5 text-[13px] font-bold text-white bg-[#E63946] disabled:opacity-40"
            >
              {envoi ? "Envoi…" : "Envoyer"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
