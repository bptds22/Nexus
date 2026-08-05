"use client";

/* ═══════════════════════════════════════════════════════════════
   MonEquipeSection — « Mon équipe » dans /athlete/parametres.

   L'onglet Transfert. Deux chemins vers la même RPC :
     • le code d'équipe (JoinCodeField) — le plus court quand l'entraîneur en
       a donné un ;
     • le picker école → équipe, pour l'athlète qui cherche lui-même.

   Le transfert n'est JAMAIS décidé ici. On appelle apply_team_attachment avec
   confirmTransfer:false ; c'est le serveur qui, en constatant une appartenance
   existante, renvoie TRANSFER_REQUIRES_CONFIRMATION avec l'ancienne et la
   nouvelle équipe. L'écran de confirmation affiche ce que la BASE a constaté —
   un state React périmé ne peut pas le contourner.
═══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import SchoolSelect from "@/components/ui/SchoolSelect";
import JoinCodeField from "@/components/athlete/JoinCodeField";
import TransferConfirmDialog from "@/components/athlete/TransferConfirmDialog";
import { applyTeamAttachment } from "@/lib/queries/athlete/teamAttachment";
import { type TransferConfirmation } from "@/lib/queries/shared/attachmentErrors";
import { taRows } from "@/lib/queries/shared/embeds";

interface CurrentAnchor {
  teamId: string | null;
  teamName: string;
  schoolName: string;
  sportName: string;
  season: string;
}

interface TeamOption {
  id: string;
  name: string;
  season: string | null;
  sport: string;
}

const label = "block text-[12px] font-bold tracking-[0.25em] uppercase text-[#6B7280] mb-1.5";

export default function MonEquipeSection({ onToast }: { onToast?: (m: string) => void }) {
  const [anchor, setAnchor] = useState<CurrentAnchor | null>(null);
  const [loading, setLoading] = useState(true);

  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [pickedTeam, setPickedTeam] = useState<TeamOption | null>(null);
  const [joinCode, setJoinCode] = useState<string | null>(null);

  const [ask, setAsk] = useState<TransferConfirmation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  /* ── État courant ────────────────────────────────────────── */
  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setLoading(false); return; }

    const { data } = await supabase
      .from("athletes")
      .select("id, team_athletes(team_id, teams!team_id(name, season, sports!sport_id(nom), schools!school_id(name)))")
      .eq("user_id", auth.user.id)
      .maybeSingle();

    // taRows : depuis UNIQUE(athlete_id), PostgREST renvoie cet embed en OBJET
    // (ou null), plus en tableau.
    const ta = taRows<Record<string, unknown>>(
      (data as Record<string, unknown> | null)?.team_athletes as never,
    )[0];
    const one = <T,>(v: unknown): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v as T | null));
    const team = one<Record<string, unknown>>(ta?.teams);

    setAnchor(
      team
        ? {
            teamId: (ta?.team_id as string) ?? null,
            teamName: (team.name as string) || "",
            schoolName: one<{ name?: string }>(team.schools)?.name || "",
            sportName: one<{ nom?: string }>(team.sports)?.nom || "",
            season: (team.season as string) || "",
          }
        : null,
    );
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── Équipes de l'école choisie ──────────────────────────── */
  useEffect(() => {
    if (!schoolId) { setTeams([]); return; }
    let alive = true;
    (async () => {
      setTeamsLoading(true);
      const { data } = await createClient()
        .from("teams")
        .select("id, name, season, sports!sport_id(nom)")
        .eq("school_id", schoolId)
        .eq("is_active", true)
        .order("season", { ascending: false })
        .limit(60);
      if (!alive) return;
      setTeams(
        (data ?? []).map((t: Record<string, unknown>) => {
          const sp = Array.isArray(t.sports) ? t.sports[0] : t.sports;
          return {
            id: t.id as string,
            name: (t.name as string) || "",
            season: (t.season as string) ?? null,
            sport: ((sp as { nom?: string } | null)?.nom) || "",
          };
        }),
      );
      setTeamsLoading(false);
    })();
    return () => { alive = false; };
  }, [schoolId]);

  /* ── Rattachement ────────────────────────────────────────── */
  async function attach(teamId: string, code: string | null, confirm: boolean) {
    setBusy(true);
    setError("");
    const outcome = await applyTeamAttachment(createClient(), {
      teamId, joinCode: code, confirmTransfer: confirm,
    });
    setBusy(false);

    if (outcome.status === "needs_confirmation") { setAsk(outcome.confirmation); return; }
    if (outcome.status === "error") { setAsk(null); setError(outcome.message); return; }

    setAsk(null);
    setPickedTeam(null);
    setJoinCode(null);
    setSchoolId(null);
    setDone(
      outcome.payload.no_op
        ? "Tu fais déjà partie de cette équipe."
        : outcome.payload.transferred
          ? "Transfert effectué. Ton ancienne équipe est maintenant dans ton parcours."
          : "Tu as rejoint ton équipe.",
    );
    onToast?.(outcome.payload.no_op ? "Aucun changement" : "Équipe mise à jour");
    await load();                                   // état rafraîchi
  }

  const target = pickedTeam?.id ?? null;

  return (
    <div className="space-y-6">
      {ask && (
        <TransferConfirmDialog
          confirmation={ask}
          cancelLabel="Annuler"
          busy={busy}
          onConfirm={() => attach(ask.target_team_id, joinCode, true)}
          onCancel={() => setAsk(null)}
        />
      )}

      {/* ── Équipe actuelle ─────────────────────────────────── */}
      <section className="rounded-xl border border-[#2D3748] bg-[#1A1D24] p-6">
        <h2 className="font-head mb-4 text-lg font-black uppercase tracking-tight text-white">
          Mon équipe
        </h2>

        {loading ? (
          <div className="h-5 w-48 animate-pulse rounded bg-white/10" />
        ) : anchor ? (
          <>
            <div className="text-[17px] font-semibold text-white">{anchor.teamName}</div>
            <div className="mt-1 text-[13px] text-[#9CA3AF]">
              {[anchor.schoolName, anchor.sportName, anchor.season].filter(Boolean).join(" · ")}
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-[#6b7280]">
              Tu ne peux faire partie que d&apos;une équipe à la fois. En rejoignant
              une nouvelle équipe, celle-ci passe automatiquement dans ton parcours.
            </p>
          </>
        ) : (
          <p className="text-[14px] text-[#9CA3AF]">
            Tu n&apos;es rattaché à aucune équipe pour le moment.
          </p>
        )}
      </section>

      {done ? (
        <div className="rounded-xl border border-[#22C55E]/30 bg-[#22C55E]/10 px-4 py-3 text-[13px] text-[#22C55E]">
          {done}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/10 px-4 py-3 text-[13px] text-[#EF4444]">
          {error}
        </div>
      ) : null}

      {/* ── Changer d'équipe ────────────────────────────────── */}
      <section className="rounded-xl border border-[#2D3748] bg-[#1A1D24] p-6">
        <h3 className="font-head mb-4 text-[15px] font-black uppercase tracking-tight text-white">
          {anchor ? "Changer d'équipe" : "Rejoindre une équipe"}
        </h3>

        <JoinCodeField
          onResolved={(v) => {
            if (v?.team.teamId) {
              setJoinCode(v.code);
              setPickedTeam({
                id: v.team.teamId,
                name: v.team.teamName ?? "",
                season: v.team.season,
                sport: v.team.sportName ?? "",
              });
              setDone("");
            } else {
              setJoinCode(null);
            }
          }}
        />

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-[#2D3748]" />
          <span className="text-[11px] uppercase tracking-wider text-[#4a4d56]">ou</span>
          <div className="h-px flex-1 bg-[#2D3748]" />
        </div>

        <label className={label}>Ton école</label>
        <SchoolSelect
          value={schoolId}
          onChange={(id) => { setSchoolId(id); setPickedTeam(null); setJoinCode(null); setDone(""); }}
          placeholder="Chercher mon école…"
        />

        {schoolId ? (
          <div className="mt-4">
            <label className={label}>Ton équipe</label>
            {teamsLoading ? (
              <p className="text-[13px] text-[#6b7280]">Chargement…</p>
            ) : teams.length === 0 ? (
              <p className="text-[13px] text-[#6b7280]">
                Aucune équipe active pour cette école. Demande un code à ton entraîneur.
              </p>
            ) : (
              <ul className="max-h-64 space-y-2 overflow-y-auto">
                {teams.map((t) => {
                  const selected = pickedTeam?.id === t.id;
                  const current = anchor?.teamId === t.id;
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        disabled={current}
                        onClick={() => { setPickedTeam(t); setJoinCode(null); setDone(""); }}
                        className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                          current
                            ? "cursor-not-allowed border-white/5 bg-[#111317] opacity-50"
                            : selected
                              ? "border-[#E63946] bg-[#E63946]/10"
                              : "border-[#2D3748] bg-[#111317] hover:border-[#4a4d56]"
                        }`}
                      >
                        <div className="text-[14px] font-semibold text-white">{t.name}</div>
                        <div className="text-[12px] text-[#6b7280]">
                          {[t.sport, t.season].filter(Boolean).join(" · ")}
                          {current ? " · équipe actuelle" : ""}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}

        <button
          type="button"
          disabled={!target || busy || target === anchor?.teamId}
          onClick={() => target && attach(target, joinCode, false)}
          className="mt-5 w-full rounded-lg bg-[#E63946] px-4 py-3 font-head text-[13px] font-bold uppercase tracking-widest text-white transition hover:bg-[#D42B22] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "En cours…" : anchor ? "Demander le transfert" : "Rejoindre cette équipe"}
        </button>
      </section>
    </div>
  );
}
