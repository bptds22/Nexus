"use client";

/* ═══════════════════════════════════════════════════════════════
   MonEquipeSection — « Mon équipe », monté par /athlete/transfert.

   Il a longtemps été un ONGLET de /athlete/parametres. Il n'en est plus un :
   enfoui là, il n'existait pas sur mobile (cette route bascule sur
   AthleteParametresMobile, qui ne l'a jamais porté). Il a désormais sa route
   à lui, la même sur les deux plateformes, et c'est elle que vise le lien du
   courriel d'invitation de transfert.

   Deux chemins vers la même RPC :
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
import { loadSchools, type SchoolRow } from "@/lib/queries/schools/allSchools";
import { SearchSheet } from "@/components/mobile/SearchSheet";
import JoinCodeField from "@/components/athlete/JoinCodeField";
import TransferConfirmDialog from "@/components/athlete/TransferConfirmDialog";
import { applyTeamAttachment } from "@/lib/queries/athlete/teamAttachment";
import { type TransferConfirmation } from "@/lib/queries/shared/attachmentErrors";
import { taRows } from "@/lib/queries/shared/embeds";
import { teamDetails } from "@/lib/config/teamLabel";

interface CurrentAnchor {
  teamId: string | null;
  teamName: string;
  /** Nom de l'école OU du club — même table `schools`. */
  orgName: string;
  /** Détails déjà mis en forme par teamDetails(). */
  details: string;
}

interface TeamOption {
  id: string;
  name: string;
  season: string | null;
  sport: string;
  // Détails discriminants : sans eux, deux « Dragons » de la même école sont
  // indistinguables dans la liste (cf. lib/config/teamLabel.ts).
  //
  // OPTIONNELS À DESSEIN. Une équipe issue du picker les porte toujours (la
  // requête `teams` les sélectionne). Une équipe issue d'un CODE ne les a pas :
  // resolve_team_join_token ne les retourne pas encore, et `teams` n'est pas
  // lisible en anon. teamDetails() omet proprement ce qui manque, donc la
  // carte du code affiche moins de détails que la liste — sans planter.
  // Le GATE proposé au rapport supprime cet écart.
  age_group?: string | null;
  division?: string | null;
  gender?: string | null;
  league?: string | null;
}

const label = "block text-[12px] font-bold tracking-[0.25em] uppercase text-[#6B7280] mb-1.5";

/* ── MOBILE : pickers en bottom-sheet ──────────────────────────────────────
   Le web garde ses pickers INLINE, inchangés. Sur iOS ils sont inutilisables :
   SchoolSelect ancre sa liste en `absolute top-full` (SchoolSelect.tsx:156),
   donc sous le champ — c'est-à-dire SOUS le clavier, qui occupe le bas du
   viewport. L'athlète tape à l'aveugle et ne peut rien sélectionner.

   SearchSheet règle ça par construction : plein écran au-dessus du clavier,
   input 16px (anti-zoom iOS), safe-area gérée. C'est le même composant que les
   quatre pickers de l'onboarding mobile — aucune extraction, il est déjà
   générique et découplé (components/mobile/SearchSheet.tsx).

   Le guard vit ICI plutôt que dans un fichier MonEquipeSectionMobile : seul le
   picker diverge, et la logique d'attachement/transfert en dessous est la
   partie délicate — la dupliquer coûterait plus cher que ce ternaire. */
const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

/** Ligne d'organisation pour le sheet mobile.
 *
 *  C'est le SchoolRow partagé (lib/queries/schools/allSchools), désormais
 *  honnête : son `type` porte les TROIS valeurs canoniques, LIGUE_CIVILE
 *  comprise. Le type local qui vivait ici n'avait de raison d'être que
 *  parce que celui de SchoolSelect mentait — ce n'est plus le cas. */
type OrgOption = SchoolRow;

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

  /* ── MOBILE : état des deux sheets. Inerte sur le web. ─────────────────── */
  const [orgSheetOpen, setOrgSheetOpen] = useState(false);
  const [orgSearch, setOrgSearch] = useState("");
  const [orgName, setOrgName] = useState("");
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(false);
  const [teamSheetOpen, setTeamSheetOpen] = useState(false);
  const [teamSearch, setTeamSearch] = useState("");

  /* ── État courant ────────────────────────────────────────── */
  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setLoading(false); return; }

    const { data } = await supabase
      .from("athletes")
      .select("id, team_athletes(team_id, teams!team_id(name, season, age_group, division, gender, league, sports!sport_id(nom), schools!school_id(name)))")
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
            orgName: one<{ name?: string }>(team.schools)?.name || "",
            details: teamDetails({
              sport: one<{ nom?: string }>(team.sports)?.nom ?? null,
              age_group: (team.age_group as string) ?? null,
              division: (team.division as string) ?? null,
              gender: (team.gender as string) ?? null,
              season: (team.season as string) ?? null,
              league: (team.league as string) ?? null,
            }),
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
        .select("id, name, season, age_group, division, gender, league, sports!sport_id(nom)")
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
            age_group: (t.age_group as string) ?? null,
            division: (t.division as string) ?? null,
            gender: (t.gender as string) ?? null,
            league: (t.league as string) ?? null,
          };
        }),
      );
      setTeamsLoading(false);
    })();
    return () => { alive = false; };
  }, [schoolId]);

  /* ── MOBILE : chargement des organisations, à l'ouverture du sheet ───────
     SANS FILTRE DE TYPE, délibérément. `schools` héberge AUSSI les clubs
     civils (type LIGUE_CIVILE) : filtrer sur SECONDAIRE — comme le fait
     l'onboarding (AthleteOnboardingMobile:625) — ferait DISPARAÎTRE leur club
     de l'écran de transfert. C'est le même choix que SchoolSelect côté web,
     dont la requête ne filtre pas non plus.

     PAGINATION OBLIGATOIRE — via `loadSchools()`, la MÊME implémentation que
     SchoolSelect. La requête écrite à la main ici n'avait pas de `.range()` :
     PostgREST plafonnait à 1000 lignes sur les 1199 de la table, et tout ce
     qui suit le rang alphabétique 1000 était introuvable (« Wildcats
     Laurentides-Lanaudière », rang 1198). Ne jamais rouvrir une requête
     `.from("schools")` ici. */
  useEffect(() => {
    if (!IS_CAPACITOR || !orgSheetOpen || orgs.length > 0) return;
    let alive = true;
    (async () => {
      setOrgsLoading(true);
      const rows = await loadSchools();
      if (!alive) return;
      setOrgs(rows);
      setOrgsLoading(false);
    })();
    return () => { alive = false; };
  }, [orgSheetOpen, orgs.length]);

  /* Filtrage client, comme SchoolSelect : la table tient en mémoire et la
     recherche doit rester instantanée sous le doigt. */
  const orgsVisibles = orgSearch.trim()
    ? orgs.filter((o) => {
        const q = orgSearch.trim().toLowerCase();
        return o.name.toLowerCase().includes(q) || (o.city ?? "").toLowerCase().includes(q);
      })
    : orgs;

  const teamsVisibles = teamSearch.trim()
    ? teams.filter((t) => {
        const q = teamSearch.trim().toLowerCase();
        return t.name.toLowerCase().includes(q) || teamDetails(t).toLowerCase().includes(q);
      })
    : teams;

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
              {[anchor.orgName, anchor.details].filter(Boolean).join(" · ")}
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

        {/* Vocabulaire neutre : `schools` héberge AUSSI les clubs civils
            (type LIGUE_CIVILE), et SchoolSelect charge la table sans filtre de
            type — un athlète de ligue civile trouve donc son club ici et ne
            doit jamais lire le mot « école » tout court. */}
        <label className={label}>Ton école ou ton club</label>
        {IS_CAPACITOR ? (
          /* Mobile : bouton-champ qui ouvre le sheet. Même allure que le
             picker inline pour que rien ne saute à l'œil d'une plateforme
             à l'autre. */
          <button
            type="button"
            onClick={() => setOrgSheetOpen(true)}
            className="flex h-11 w-full items-center justify-between rounded-lg border border-[#2D3748] bg-[#111317] px-4 text-left transition active:bg-[#1A1D24]"
          >
            <span className={`truncate text-[14px] ${orgName ? "text-white" : "text-[#4a4d56]"}`}>
              {orgName || "Cherche ton école ou ton club…"}
            </span>
            <span className="ml-2 shrink-0 text-[#6b7280]">▾</span>
          </button>
        ) : (
          <SchoolSelect
            value={schoolId}
            onChange={(id) => { setSchoolId(id); setPickedTeam(null); setJoinCode(null); setDone(""); }}
            placeholder="Cherche ton école ou ton club…"
          />
        )}

        {schoolId ? (
          <div className="mt-4">
            <label className={label}>Ton équipe</label>
            {teamsLoading ? (
              <p className="text-[13px] text-[#6b7280]">Chargement…</p>
            ) : teams.length === 0 ? (
              <p className="text-[13px] text-[#6b7280]">
                Aucune équipe active ici. Demande un code à ton entraîneur.
              </p>
            ) : IS_CAPACITOR ? (
              /* Mobile : même traitement que l'organisation. La liste vivait
                 sous le champ, donc sous le clavier dès qu'il s'ouvrait. */
              <button
                type="button"
                onClick={() => setTeamSheetOpen(true)}
                className="flex h-11 w-full items-center justify-between rounded-lg border border-[#2D3748] bg-[#111317] px-4 text-left transition active:bg-[#1A1D24]"
              >
                <span className={`truncate text-[14px] ${pickedTeam ? "text-white" : "text-[#4a4d56]"}`}>
                  {pickedTeam ? pickedTeam.name : "Choisis ton équipe…"}
                </span>
                <span className="ml-2 shrink-0 text-[#6b7280]">▾</span>
              </button>
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
                          {teamDetails(t)}
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

      {/* ── MOBILE : les deux sheets. `IS_CAPACITOR` est une constante de
          build, donc ces blocs sont éliminés du bundle web. ─────────────── */}
      {IS_CAPACITOR && (
        <>
          <SearchSheet<OrgOption>
            open={orgSheetOpen}
            onClose={() => setOrgSheetOpen(false)}
            title="Mon école ou mon club"
            searchPlaceholder="Rechercher…"
            searchValue={orgSearch}
            onSearchChange={setOrgSearch}
            items={orgsVisibles}
            loading={orgsLoading}
            keyOf={(o) => o.id}
            onSelect={(o) => {
              // MÊME réinitialisation que le onChange de SchoolSelect côté web :
              // changer d'organisation invalide l'équipe choisie ET le code.
              setSchoolId(o.id);
              setOrgName(o.name);
              setPickedTeam(null);
              setJoinCode(null);
              setDone("");
              setTeamSearch("");
            }}
            renderItem={(o, onTap) => (
              <button
                type="button"
                onClick={onTap}
                className="w-full rounded-2xl bg-[#1A1D24] p-3 text-left transition-colors active:bg-[#22262e]"
              >
                <p className="truncate text-[16px] font-semibold text-white">{o.name}</p>
                {o.city && <p className="truncate text-[13px] text-white/55">{o.city}</p>}
              </button>
            )}
          />

          <SearchSheet<TeamOption>
            open={teamSheetOpen}
            onClose={() => setTeamSheetOpen(false)}
            title="Mon équipe"
            searchPlaceholder="Rechercher une équipe…"
            searchValue={teamSearch}
            onSearchChange={setTeamSearch}
            items={teamsVisibles}
            loading={teamsLoading}
            keyOf={(t) => t.id}
            onSelect={(t) => {
              // L'équipe actuelle reste non sélectionnable : c'est déjà
              // l'ancrage, la rejoindre n'aurait aucun sens.
              if (anchor?.teamId === t.id) return;
              setPickedTeam(t);
              setJoinCode(null);
              setDone("");
            }}
            renderItem={(t, onTap) => {
              const courante = anchor?.teamId === t.id;
              return (
                <button
                  type="button"
                  onClick={courante ? undefined : onTap}
                  disabled={courante}
                  className={`w-full rounded-2xl p-3 text-left transition-colors ${
                    courante
                      ? "cursor-not-allowed bg-[#111317] opacity-50"
                      : "bg-[#1A1D24] active:bg-[#22262e]"
                  }`}
                >
                  <p className="truncate text-[16px] font-semibold text-white">{t.name}</p>
                  <p className="truncate text-[13px] text-white/55">
                    {teamDetails(t)}
                    {courante ? " · équipe actuelle" : ""}
                  </p>
                </button>
              );
            }}
          />
        </>
      )}
    </div>
  );
}
