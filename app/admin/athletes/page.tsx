"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AdminTable, { AdminColumn } from "../_components/AdminTable";
import { embeddedSchool, schoolTypeLabel } from "@/lib/config/schoolTypes";
import { EMBED_COMPTE, inscriptionDeFiche, repartitionComptesAthletes, type InscriptionFiche } from "@/lib/admin/comptesAthletes";

interface AthleteRow {
  id: string;
  first_name: string;
  last_name: string;
  sport_id: string | null;
  school_id: string | null;
  coach_id: string | null;
  annee_diplomation: number | null;
  verified: boolean;
  cote_globale_entraineur: number | null;
  statut_recrutement_override: string | null;
  profile_completion: number | null;
  consentement_parental: boolean | null;
  video_faits_saillants_url: string | null;
  video_match_complet_url: string | null;
  video_entrainement_url: string | null;
  created_at: string;
  // computed
  /** complete = compte + onboarding fini · commencee = compte, onboarding
   *  non fini · sans_compte = fiche semée par un coach, jamais réclamée ·
   *  compte_non_athlete = fiche sur un compte d'un autre rôle (ADMIN…). */
  inscription?: InscriptionFiche;
  sport_name?: string | null;
  school_name?: string | null;
  school_type?: string | null;
  coach_name?: string | null;
  created_at_fmt?: string;
  /* ── VUE UNIFIÉE (décision BP) ──────────────────────────────────────
     La liste par défaut montre TOUS les comptes athlètes, fiches et
     comptes sans fiche mêlés. `kind` dit ce qu'on regarde :
       "fiche"      → une ligne de `athletes`, `id` = athletes.id ;
       "sans_fiche" → un compte sans aucune fiche, `id` = users.id.
     ⚠️ `id` ne désigne donc PAS la même chose selon `kind`. Toute
     navigation ou écriture qui suppose un athlete.id doit tester `kind`
     d'abord — c'est pour ça que le discriminant existe plutôt qu'un
     simple `email != null`. */
  kind?: "fiche" | "sans_fiche";
  /** sans_fiche seulement — la seule identité qu'on ait sur ces comptes. */
  email?: string | null;
  /** sans_fiche seulement — google / apple / email. */
  fournisseur?: string | null;
}

interface UserRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  role: string | null;
  school_id: string | null;
  school_name?: string | null;
  school_type?: string | null;
  created_at: string | null;
}

/** Un compte ATHLETE sans AUCUNE ligne dans `athletes` — l'inscription
 *  inachevée. Lu par la RPC admin_comptes_athletes_sans_fiche (auth.users
 *  n'est pas lisible côté client : fournisseur, connexion, consentement). */
interface SansFicheRow {
  user_id: string;
  email: string | null;
  prenom: string | null;
  nom: string | null;
  fournisseur: string | null;
  inscrit_le: string;
  derniere_connexion: string | null;
  consentement_passe: boolean;
  consentement_le: string | null;
  consentement_marketing: boolean;
  age: number | null;
  doublon_probable: boolean;
  /** Inscrit au registre LCAP (courriel_desabonnements) — exclu des relances. */
  desabonne: boolean;
  relance_statut: "RESERVE" | "ENVOYE" | "ECHEC" | null;
  relance_le: string | null;
}

interface Sport { id: string; nom: string }
interface School { id: string; name: string }

const FILTER_LABELS: Record<string, string> = {
  "non-verifie": "Athlètes non vérifiés",
  "verifie": "Athlètes vérifiés",
  "sans-video": "Athlètes sans vidéo",
  "sans-evaluation": "Athlètes sans évaluation",
  "verifie-sans-evaluation": "Athlètes vérifiés sans évaluation",
  "completion-0-25": "Profil complété à 0 – 25%",
  "completion-26-50": "Profil complété à 26 – 50%",
  "completion-51-75": "Profil complété à 51 – 75%",
  "completion-76-100": "Profil complété à 76 – 100%",
  "pipeline-stagnant": "Athlètes stagnants (30+ jours)",
  "sans-consentement": "Athlètes sans consentement parental",
  "fiche-complete": "Fiche complète",
  "fiche-commencee": "Fiche commencée — onboarding non terminé",
  "sans-fiche": "Inscription inachevée — compte sans fiche",
  "sans-fiche-consentement": "Inscription inachevée — consentement passé",
  "sans-fiche-jamais": "Inscription inachevée — /consentements jamais passé",
  "coach-sans-athletes": "Entraîneurs sans athlètes",
  "recruteur-fantome": "Recruteurs sans activité",
};

const USER_LIST_FILTERS = new Set(["coach-sans-athletes", "recruteur-fantome"]);
/* Les comptes sans fiche ne sont pas des lignes `athletes` : ils ont leur
   propre tableau (pas d'édition en ligne, pas de sport ni d'école). */
const SANS_FICHE_FILTERS = new Set(["sans-fiche", "sans-fiche-consentement", "sans-fiche-jamais"]);
const INSCRIPTION_FILTERS = new Set(["fiche-complete", "fiche-commencee", ...SANS_FICHE_FILTERS]);

const FOURNISSEUR_LABEL: Record<string, string> = { email: "Courriel", apple: "Apple", google: "Google" };

function bucketRecruitmentStatus(raw: string | null | undefined): "OUVERT" | "EN_PROCESSUS" | "RECRUTE" | "RETIRE" | null {
  if (!raw) return null;
  const v = raw.toUpperCase();
  if (v === "OUVERT" || v === "IDENTIFIE") return "OUVERT";
  if (v === "CONTACTE" || v === "EN_DISCUSSION" || v === "VISITE_PLANIFIEE" || v === "EN_PROCESSUS") return "EN_PROCESSUS";
  if (v === "ENGAGE" || v === "LETTRE_SIGNEE" || v === "RECRUTE") return "RECRUTE";
  if (v === "RETIRE") return "RETIRE";
  return null;
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("fr-CA", { year: "numeric", month: "short", day: "numeric" });
}

export default function AdminAthletesPage() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-6 py-8 text-[#6b7280]">Chargement...</div>}>
      <AdminAthletesPageInner />
    </Suspense>
  );
}

const STATUT_FILTERS = new Set(["verifie", "non-verifie"]);
const PROFIL_FILTERS = new Set([
  "sans-video", "sans-evaluation", "verifie-sans-evaluation",
  "completion-0-25", "completion-26-50", "completion-51-75", "completion-76-100",
]);
const RECRUT_FILTERS = new Set(["pipeline-stagnant", "sans-consentement"]);

function AdminAthletesPageInner() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const filterParam = searchParams?.get("filter") || null;
  const sportParam = searchParams?.get("sport") || null;
  const schoolParam = searchParams?.get("school") || null;

  const [rows, setRows] = useState<AthleteRow[]>([]);
  const [sports, setSports] = useState<Sport[]>([]);
  const [stagnantAthleteIds, setStagnantAthleteIds] = useState<Set<string>>(new Set());
  const [userRows, setUserRows] = useState<UserRow[]>([]);
  const [sansFiche, setSansFiche] = useState<SansFicheRow[]>([]);
  const [sansFicheErreur, setSansFicheErreur] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const isUserView = !!filterParam && USER_LIST_FILTERS.has(filterParam);
  const isSansFicheView = !!filterParam && SANS_FICHE_FILTERS.has(filterParam);

  function setParam(key: "filter" | "sport" | "school", value: string | null) {
    const params = new URLSearchParams(searchParams?.toString() || "");
    // Mutually-exclusive filter groups: clearing an unrelated group isn't needed —
    // each dropdown writes the same `filter` key, so new write replaces old.
    if (value) params.set(key, value);
    else params.delete(key);
    const qs = params.toString();
    router.push(qs ? `/admin/athletes?${qs}` : "/admin/athletes");
  }
  function resetAll() {
    router.push("/admin/athletes");
    setSearchQuery("");
  }
  const statutValue = filterParam && STATUT_FILTERS.has(filterParam) ? filterParam : "";
  const profilValue = filterParam && PROFIL_FILTERS.has(filterParam) ? filterParam : "";
  const recrutValue = filterParam && RECRUT_FILTERS.has(filterParam) ? filterParam : "";
  const inscriptionValue = filterParam && INSCRIPTION_FILTERS.has(filterParam) ? filterParam : "";
  const anyActive = !!filterParam || !!sportParam || !!schoolParam || !!searchQuery.trim();

  useEffect(() => {
    (async () => {
      setLoading(true);

      // `schools` n'est plus chargée en entier : la table dépasse 1000
      // lignes et PostgREST tronquait, ce qui vidait l'établissement de
      // tout compte rattaché au-delà du 1000e nom. L'établissement vient
      // désormais de la jointure, et le menu de filtre se déduit des
      // lignes déjà chargées (cf. schoolsWithAthletes).
      const spRes = await supabase.from("sports").select("id,nom").order("nom");
      setSports((spRes.data as Sport[]) || []);

      if (isUserView) {
        // Branch: fetch users + pipeline + athlete→coach linkage.
        const targetRole = filterParam === "coach-sans-athletes" ? "COACH" : "RECRUTEUR";
        const [uRes, linkRes, pipeRes] = await Promise.all([
          supabase.from("users")
            .select("id,first_name,last_name,email,role,school_id,created_at,schools!school_id(name,type)")
            .eq("role", targetRole),
          supabase.from("athletes").select("coach_id"),
          supabase.from("recruiter_pipeline").select("recruiter_id"),
        ]);

        const coachIdsWithAthletes = new Set<string>();
        for (const a of (linkRes.data || []) as { coach_id: string | null }[]) {
          if (a.coach_id) coachIdsWithAthletes.add(a.coach_id);
        }
        const recruiterIdsActive = new Set<string>();
        for (const p of (pipeRes.data || []) as { recruiter_id: string | null }[]) {
          if (p.recruiter_id) recruiterIdsActive.add(p.recruiter_id);
        }

        const filtered = ((uRes.data || []) as (UserRow & { schools?: unknown })[])
          .filter((u) => filterParam === "coach-sans-athletes"
            ? !coachIdsWithAthletes.has(u.id)
            : !recruiterIdsActive.has(u.id))
          .map((u) => {
            const joined = embeddedSchool(u.schools);
            return {
              ...u,
              school_name: joined?.name ?? null,
              school_type: joined?.type ?? null,
            };
          });

        setUserRows(filtered);
        setRows([]);
        setStagnantAthleteIds(new Set());
        setLoading(false);
        return;
      }

      // Standard athlete view.
      // `compte:user_id(...)` — l'état d'inscription se lit sur le COMPTE
      // (users.onboarding_complete), pas sur la fiche. La policy users
      // « admins read all » (is_admin()) rend l'embed lisible ici.
      const athletesSelect =
        "id,user_id,first_name,last_name,sport_id,school_id,coach_id,annee_diplomation,verified," +
        "cote_globale_entraineur,statut_recrutement_override,profile_completion,consentement_parental," +
        "video_faits_saillants_url,video_match_complet_url,video_entrainement_url,created_at," +
        "sports:sport_id(nom), schools:school_id(name,type), coach:coach_id(first_name,last_name)," +
        EMBED_COMPTE;

      /* Les comptes sans fiche arrivent par une RPC à part : un échec de
         celle-ci (migration pas encore appliquée, par exemple) ne doit pas
         vider la liste des athlètes — on le dit dans l'écran, et on continue. */
      const sansFicheTask = supabase.rpc("admin_comptes_athletes_sans_fiche").then(({ data, error }) => {
        if (error) {
          console.error("[admin/athletes] admin_comptes_athletes_sans_fiche:", error.message);
          setSansFicheErreur(error.message);
          setSansFiche([]);
        } else {
          setSansFicheErreur(null);
          setSansFiche((data as SansFicheRow[]) || []);
        }
      });

      const tasks: PromiseLike<unknown>[] = [
        supabase.from("athletes").select(athletesSelect).order("created_at", { ascending: false }),
        sansFicheTask,
      ];
      if (filterParam === "pipeline-stagnant") {
        const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();
        tasks.push(
          supabase.from("recruiter_pipeline").select("athlete_id").lt("moved_at", cutoff),
        );
      }
      const results = await Promise.all(tasks);
      const aRes = results[0] as { data: unknown[] | null };
      // results[1] = sansFicheTask (état posé dans son .then) ; le pipeline, s'il
      // a été demandé, est en [2].
      const STAGNANT_IDX = 2;

      const mapped: AthleteRow[] = ((aRes.data || []) as Record<string, unknown>[]).map((a) => {
        const coach = a.coach as { first_name?: string; last_name?: string } | null;
        const sportRel = a.sports as { nom?: string } | null;
        const schoolRel = embeddedSchool(a.schools);
        // Même classement que le tableau de bord (lib/admin/comptesAthletes).
        const inscription: AthleteRow["inscription"] = inscriptionDeFiche(a);
        return {
          kind: "fiche" as const,
          inscription,
          id: a.id as string,
          first_name: (a.first_name as string) ?? "",
          last_name: (a.last_name as string) ?? "",
          sport_id: (a.sport_id as string) ?? null,
          school_id: (a.school_id as string) ?? null,
          coach_id: (a.coach_id as string) ?? null,
          annee_diplomation: (a.annee_diplomation as number) ?? null,
          verified: (a.verified as boolean) ?? false,
          cote_globale_entraineur: (a.cote_globale_entraineur as number) ?? null,
          statut_recrutement_override: (a.statut_recrutement_override as string) ?? null,
          profile_completion: (a.profile_completion as number) ?? null,
          consentement_parental: (a.consentement_parental as boolean) ?? null,
          video_faits_saillants_url: (a.video_faits_saillants_url as string) ?? null,
          video_match_complet_url: (a.video_match_complet_url as string) ?? null,
          video_entrainement_url: (a.video_entrainement_url as string) ?? null,
          created_at: a.created_at as string,
          sport_name: sportRel?.nom ?? null,
          school_name: schoolRel?.name ?? null,
          school_type: schoolRel?.type ?? null,
          coach_name: coach ? `${coach.first_name ?? ""} ${coach.last_name ?? ""}`.trim() : null,
          created_at_fmt: formatDate(a.created_at as string),
        };
      });

      if (filterParam === "pipeline-stagnant" && results[STAGNANT_IDX]) {
        const pipeData = results[STAGNANT_IDX] as { data: { athlete_id: string | null }[] | null };
        const ids = new Set<string>();
        for (const p of pipeData.data || []) if (p.athlete_id) ids.add(p.athlete_id);
        setStagnantAthleteIds(ids);
      } else {
        setStagnantAthleteIds(new Set());
      }

      setRows(mapped);
      setUserRows([]);
      setLoading(false);
    })();
  }, [supabase, filterParam, isUserView]);

  const filteredRows = useMemo(() => {
    let list = rows;
    if (filterParam === "non-verifie") list = list.filter((r) => !r.verified);
    else if (filterParam === "verifie") list = list.filter((r) => r.verified);
    else if (filterParam === "sans-video") list = list.filter((r) => !r.video_faits_saillants_url && !r.video_match_complet_url && !r.video_entrainement_url);
    else if (filterParam === "sans-evaluation") list = list.filter((r) => r.cote_globale_entraineur == null);
    else if (filterParam === "verifie-sans-evaluation") list = list.filter((r) => r.verified && r.cote_globale_entraineur == null);
    else if (filterParam === "completion-0-25") list = list.filter((r) => (r.profile_completion ?? 0) >= 0 && (r.profile_completion ?? 0) <= 25);
    else if (filterParam === "completion-26-50") list = list.filter((r) => (r.profile_completion ?? 0) >= 26 && (r.profile_completion ?? 0) <= 50);
    else if (filterParam === "completion-51-75") list = list.filter((r) => (r.profile_completion ?? 0) >= 51 && (r.profile_completion ?? 0) <= 75);
    else if (filterParam === "completion-76-100") list = list.filter((r) => (r.profile_completion ?? 0) >= 76 && (r.profile_completion ?? 0) <= 100);
    else if (filterParam === "sans-consentement") list = list.filter((r) => r.consentement_parental !== true);
    else if (filterParam === "pipeline-stagnant") list = list.filter((r) => stagnantAthleteIds.has(r.id));
    else if (filterParam === "fiche-complete") list = list.filter((r) => r.inscription === "complete");
    else if (filterParam === "fiche-commencee") list = list.filter((r) => r.inscription === "commencee");

    const q = searchQuery.trim().toLowerCase();
    return list.filter((r) => {
      if (sportParam && r.sport_id !== sportParam) return false;
      if (schoolParam && r.school_id !== schoolParam) return false;
      if (q) {
        const full = `${r.first_name} ${r.last_name}`.toLowerCase();
        if (!full.includes(q)) return false;
      }
      return true;
    });
  }, [rows, filterParam, stagnantAthleteIds, sportParam, schoolParam, searchQuery]);

  const sansFicheFiltres = useMemo(() => {
    let list = sansFiche;
    if (filterParam === "sans-fiche-consentement") list = list.filter((r) => r.consentement_passe);
    else if (filterParam === "sans-fiche-jamais") list = list.filter((r) => !r.consentement_passe);
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) =>
      `${r.prenom ?? ""} ${r.nom ?? ""} ${r.email ?? ""}`.toLowerCase().includes(q));
  }, [sansFiche, filterParam, searchQuery]);

  /* ── LA LISTE UNIFIÉE (décision BP) ────────────────────────────────────
     La vue par DÉFAUT montre tous les comptes athlètes ensemble : fiches
     complètes, fiches commencées et comptes sans fiche, triés par date.
     Avant, la liste s'arrêtait aux fiches et les comptes sans fiche
     vivaient dans une section à part sous le tableau : le compteur du haut
     annonçait le vrai total, l'écran en montrait une partie. Le chiffre et
     la liste ne racontaient pas la même chose.

     LA FUSION N'A LIEU QUE SANS FILTRE DE CATÉGORIE, NI SPORT, NI ÉCOLE.
     Un compte sans fiche n'a ni sport ni école : le laisser apparaître sous
     ces filtres serait un faux positif. La RECHERCHE TEXTE, elle, s'applique
     aux deux — chercher un courriel doit trouver le compte qui ne porte
     que ça, et c'est souvent tout ce qu'on a pour le retrouver.

     TRI — `created_at` des deux côtés : `athletes.created_at` pour une
     fiche, `inscrit_le` (le compte) pour un sans-fiche. Ce n'est pas tout à
     fait la même horloge — une fiche semée par un coach date de sa création,
     pas d'une inscription — mais c'est le seul axe commun aux deux, et c'est
     déjà celui sur lequel la liste était triée. */
  const lignesAffichees = useMemo(() => {
    if (filterParam || sportParam || schoolParam) return filteredRows;

    const q = searchQuery.trim().toLowerCase();
    const lignesSansFiche: AthleteRow[] = sansFiche
      .filter((r) =>
        !q || `${r.prenom ?? ""} ${r.nom ?? ""} ${r.email ?? ""}`.toLowerCase().includes(q))
      .map((r) => ({
        kind: "sans_fiche" as const,
        // ⚠️ `id` porte ici un users.id, PAS un athletes.id. Sans danger
        // d'écriture (les dix colonnes sont readonly), mais la navigation
        // est coupée pour ce kind — voir onRowClick plus bas.
        id: r.user_id,
        first_name: r.prenom ?? "",
        last_name: r.nom ?? "",
        email: r.email,
        fournisseur: r.fournisseur,
        sport_id: null, school_id: null, coach_id: null,
        annee_diplomation: null, verified: false,
        cote_globale_entraineur: null, statut_recrutement_override: null,
        profile_completion: null, consentement_parental: null,
        video_faits_saillants_url: null, video_match_complet_url: null,
        video_entrainement_url: null,
        created_at: r.inscrit_le,
        created_at_fmt: formatDate(r.inscrit_le),
      }));

    return [...filteredRows, ...lignesSansFiche].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [filteredRows, sansFiche, filterParam, sportParam, schoolParam, searchQuery]);

  /* Le VRAI total : un compte athlète, avec ou sans fiche. Les fiches sans
     compte (semées par un coach, ou supprimées) ne sont pas des inscriptions —
     elles sont comptées à part pour que le total ne mente dans aucun sens. */
  // Calcul partagé avec /admin/dashboard (lib/admin/comptesAthletes) : les
  // deux écrans ne peuvent pas afficher deux totaux différents.
  const repartition = useMemo(
    () => repartitionComptesAthletes(rows.map((r) => r.inscription), sansFiche.length),
    [rows, sansFiche],
  );

  useEffect(() => {
    if (loading || isUserView) return;
  }, [loading, isUserView, filterParam, sportParam, schoolParam, searchQuery, filteredRows.length]);

  // Schools that actually have at least one athlete (for the dropdown).
  // Déduit des lignes chargées — leur nom vient de la jointure, donc plus
  // besoin d'un select complet de `schools` (qui était tronqué à 1000).
  const schoolsWithAthletes = useMemo(() => {
    const byId = new Map<string, School>();
    for (const r of rows) {
      if (r.school_id && r.school_name && !byId.has(r.school_id)) {
        byId.set(r.school_id, { id: r.school_id, name: r.school_name });
      }
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [rows]);

  const activeLabel = filterParam ? FILTER_LABELS[filterParam] || filterParam : null;
  const activeCount = isUserView ? userRows.length : isSansFicheView ? sansFicheFiltres.length : lignesAffichees.length;

  const columns: AdminColumn<AthleteRow>[] = [
    {
      key: "first_name", label: "Prénom", readonly: true,
      render: (r) => (
        <span className="inline-flex items-center gap-2">
          {/* PAS DE LIEN sur une ligne sans fiche : `id` y est un users.id et
              /admin/athletes/<user_id> ne résout rien. Un lien mort qui a
              l'air vivant est pire que pas de lien. */}
          {r.kind === "sans_fiche" ? (
            <span className="text-[13px] font-bold text-[#c0c4cc]">
              {r.first_name || <span className="text-[#4a4d56]">—</span>}
            </span>
          ) : (
            <Link href={`/admin/athletes/${r.id}`} className="text-[13px] font-bold text-white hover:text-[#E63946] transition-colors" onClick={(e) => e.stopPropagation()}>
              {r.first_name}
            </Link>
          )}
          {r.kind === "sans_fiche" && <InscriptionPill label="Inscription inachevée" />}
          {r.inscription === "commencee" && <InscriptionPill label="Fiche commencée" />}
        </span>
      ),
    },
    {
      key: "last_name", label: "Nom", readonly: true,
      render: (r) => r.kind === "sans_fiche" ? (
        // Le courriel sous le nom : sur ces comptes c'est souvent la SEULE
        // identité disponible (prénom et nom sont vides tant que
        // l'onboarding n'a rien écrit).
        <span className="flex flex-col items-start leading-tight gap-0.5">
          {r.last_name && <span className="text-[13px] font-bold text-[#c0c4cc]">{r.last_name}</span>}
          <span className="text-[12px] text-[#9CA3AF] break-all">{r.email ?? "—"}</span>
          {r.fournisseur && <FournisseurPill fournisseur={r.fournisseur} />}
        </span>
      ) : (
        <Link href={`/admin/athletes/${r.id}`} className="text-[13px] font-bold text-white hover:text-[#E63946] transition-colors" onClick={(e) => e.stopPropagation()}>
          {r.last_name}
        </Link>
      ),
    },
    {
      key: "sport_id", label: "Sport", readonly: true,
      render: (r) => r.sport_name ? <span className="text-[13px] text-[#9CA3AF]">{r.sport_name}</span> : <span className="text-[#4a4d56]">—</span>,
    },
    {
      key: "school_name", label: "Établissement", readonly: true,
      render: (r) => r.school_name ? (
        <span className="flex flex-col items-start leading-tight">
          <span className="text-[13px] text-[#9CA3AF]">{r.school_name}</span>
          {r.school_type && <span className="text-[11px] text-[#6b7280]">{schoolTypeLabel(r.school_type)}</span>}
        </span>
      ) : <span className="text-[#4a4d56]">—</span>,
    },
    { key: "annee_diplomation", label: "Promotion", readonly: true, align: "center" },
    {
      key: "verified", label: "Vérifié", readonly: true, align: "center",
      render: (r) => r.verified
        ? <span className="inline-flex w-5 h-5 rounded-full bg-[#3B82F6]/20 text-[#3B82F6] items-center justify-center text-[12px]">✓</span>
        : <span className="inline-block w-5 h-5 rounded-full border border-[#4a4d56]" />,
    },
    {
      key: "coach_name", label: "Coach", readonly: true,
      render: (r) => r.coach_name ? <span className="text-[13px] text-[#9CA3AF]">{r.coach_name}</span> : <span className="text-[#4a4d56]">—</span>,
    },
    {
      key: "cote_globale_entraineur", label: "Cote globale", readonly: true, align: "center", width: "160px",
      render: (r) => {
        const v = r.cote_globale_entraineur;
        if (v == null) return <span className="text-[#4a4d56]">—</span>;
        const pct = Math.max(0, Math.min(1, v / 5)) * 100;
        return (
          <span className="inline-flex items-center gap-1.5">
            <span className="relative inline-block leading-none" aria-label={`${v} sur 5`}>
              <span className="text-[14px] tracking-[2px] text-[#374151]">★★★★★</span>
              <span className="absolute inset-0 text-[14px] tracking-[2px] text-[#F59E0B] overflow-hidden whitespace-nowrap" style={{ width: `${pct}%` }}>★★★★★</span>
            </span>
            <span className="text-[11px] text-[#9CA3AF] tabular-nums">{v.toFixed(1)}</span>
          </span>
        );
      },
    },
    {
      key: "statut_recrutement_override", label: "Statut recrutement", readonly: true,
      render: (r) => {
        const bucket = bucketRecruitmentStatus(r.statut_recrutement_override);
        if (!bucket) return <span className="text-[#4a4d56]">—</span>;
        const cls =
          bucket === "OUVERT"        ? "bg-green-500/20 text-green-400" :
          bucket === "EN_PROCESSUS"  ? "bg-amber-500/20 text-amber-400" :
          bucket === "RECRUTE"       ? "bg-red-500/20 text-red-400" :
                                       "bg-gray-500/20 text-gray-400";
        const label =
          bucket === "EN_PROCESSUS" ? "EN PROCESSUS" :
          bucket === "RECRUTE"      ? "RECRUTÉ" :
          bucket === "RETIRE"       ? "RETIRÉ" : "OUVERT";
        return <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold ${cls}`}>{label}</span>;
      },
    },
    { key: "created_at_fmt", label: "Créé le", type: "readonly" },
  ];

  const selectBase =
    "bg-[#111317] border border-[#2D3748] rounded-lg px-3 py-2.5 text-[13px] text-white focus:outline-none focus:border-[#E63946]/50";

  function clearFilter() {
    router.push("/admin/athletes");
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">
          Gestion des athlètes
        </h1>
        {isUserView ? (
          <p className="text-[13px] text-[#6b7280] mt-1">{userRows.length} utilisateur(s)</p>
        ) : (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px]">
            <span className="text-white font-bold tabular-nums">{repartition.comptes}</span>
            <span className="text-[#6b7280]">comptes athlètes :</span>
            <RepartitionChip n={repartition.complete} label="fiche complète" onClick={() => setParam("filter", "fiche-complete")} />
            <RepartitionChip n={repartition.commencee} label="fiche commencée" onClick={() => setParam("filter", "fiche-commencee")} />
            <RepartitionChip n={repartition.sansFiche} label="sans fiche" accent onClick={() => setParam("filter", "sans-fiche")} />
            {repartition.sansCompte > 0 && (
              <span className="text-[12px] text-[#6b7280]">
                + {repartition.sansCompte} fiche{repartition.sansCompte > 1 ? "s" : ""} sans compte (semées par un coach ou supprimées)
              </span>
            )}
            {repartition.compteNonAthlete > 0 && (
              <span className="text-[12px] text-[#6b7280]">
                + {repartition.compteNonAthlete} fiche{repartition.compteNonAthlete > 1 ? "s" : ""} sur un compte non athlète (hors total)
              </span>
            )}
          </div>
        )}
        {sansFicheErreur && (
          <p className="mt-2 text-[12px] text-[#F59E0B]">
            Comptes sans fiche indisponibles ({sansFicheErreur}) — le total ci-dessus les omet.
          </p>
        )}
      </div>

      {activeLabel && (
        <div className="flex items-center gap-3 bg-[#3B82F6]/10 border border-[#3B82F6]/30 rounded-xl px-4 py-3">
          <svg className="w-5 h-5 text-[#3B82F6] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" strokeLinecap="round" />
          </svg>
          <p className="flex-1 text-[13px] text-[#93C5FD]">
            Filtre actif : {activeLabel} ({activeCount})
          </p>
          <button
            type="button"
            onClick={clearFilter}
            className="text-[12px] text-white font-bold hover:underline shrink-0"
          >
            ✕ Effacer le filtre
          </button>
        </div>
      )}

      {!isUserView && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <FilterSelect
              title="Inscription"
              value={inscriptionValue}
              onChange={(v) => setParam("filter", v || null)}
              options={[
                { value: "", label: "Inscription — Toutes les fiches" },
                { value: "fiche-complete", label: "Fiche complète" },
                { value: "fiche-commencee", label: "Fiche commencée" },
                { value: "sans-fiche", label: "Inscription inachevée (sans fiche)" },
                { value: "sans-fiche-consentement", label: "↳ consentement passé" },
                { value: "sans-fiche-jamais", label: "↳ /consentements jamais passé" },
              ]}
            />
            <FilterSelect
              title="Statut"
              value={statutValue}
              onChange={(v) => setParam("filter", v || null)}
              options={[
                { value: "", label: "Statut — Tous" },
                { value: "verifie", label: "Vérifiés" },
                { value: "non-verifie", label: "Non vérifiés" },
              ]}
            />
            <FilterSelect
              title="Profil"
              value={profilValue}
              onChange={(v) => setParam("filter", v || null)}
              options={[
                { value: "", label: "Profil — Tous" },
                { value: "sans-video", label: "Sans vidéo" },
                { value: "sans-evaluation", label: "Sans évaluation" },
                { value: "verifie-sans-evaluation", label: "Vérifiés sans évaluation" },
                { value: "completion-0-25", label: "Complétude 0 – 25%" },
                { value: "completion-26-50", label: "Complétude 26 – 50%" },
                { value: "completion-51-75", label: "Complétude 51 – 75%" },
                { value: "completion-76-100", label: "Complétude 76 – 100%" },
              ]}
            />
            <FilterSelect
              title="Recrutement"
              value={recrutValue}
              onChange={(v) => setParam("filter", v || null)}
              options={[
                { value: "", label: "Recrutement — Tous" },
                { value: "pipeline-stagnant", label: "Pipeline stagnant" },
                { value: "sans-consentement", label: "Sans consentement" },
              ]}
            />
            <FilterSelect
              title="Sport"
              value={sportParam || ""}
              onChange={(v) => setParam("sport", v || null)}
              options={[
                { value: "", label: "Tous les sports" },
                ...sports.map((s) => ({ value: s.id, label: s.nom })),
              ]}
            />
            <FilterSelect
              title="École"
              value={schoolParam || ""}
              onChange={(v) => setParam("school", v || null)}
              options={[
                { value: "", label: "Toutes les écoles" },
                ...schoolsWithAthletes.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par nom..."
              className={`${selectBase} w-56`}
            />
            <span className="text-[12px] text-[#9CA3AF] ml-auto">
              <span className="font-bold text-white tabular-nums">{activeCount}</span> résultat{activeCount > 1 ? "s" : ""}
            </span>
            {anyActive && (
              <button
                type="button"
                onClick={resetAll}
                className="text-[12px] text-[#E63946] font-bold hover:underline"
              >
                Réinitialiser les filtres
              </button>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-[#6b7280]">Chargement...</div>
      ) : isUserView ? (
        <UserListTable rows={userRows} />
      ) : isSansFicheView ? (
        <SansFicheTable rows={sansFicheFiltres} />
      ) : lignesAffichees.length === 0 ? (
        <div className="text-center py-12 text-[#6b7280]">Aucun athlète</div>
      ) : (
        <AdminTable<AthleteRow>
          rows={lignesAffichees}
          columns={columns}
          table="athletes"
          searchFields={["first_name", "last_name"]}
          searchPlaceholder="Rechercher un athlète..."
          onRowClick={(r) => {
            // Une ligne sans fiche n'a pas de fiche a ouvrir : son `id` est un
            // users.id, /admin/athletes/<user_id> ne resout rien. On ne
            // navigue pas plutot que d'envoyer l'admin sur une page vide.
            if (r.kind === "sans_fiche") return;
            router.push(`/admin/athletes/${r.id}`);
          }}
          onSaved={(id, patch) => {
            setRows((prev) =>
              prev.map((r) => {
                if (r.id !== id) return r;
                const updated = { ...r, ...patch };
                if (patch.sport_id !== undefined) {
                  updated.sport_name = sports.find((s) => s.id === patch.sport_id)?.nom ?? null;
                }
                return updated;
              }),
            );
          }}
        />
      )}

      {/* LA SECTION SÉPARÉE « Inscriptions inachevées » A ÉTÉ RETIRÉE.
          Elle vivait ici, sous le tableau : la liste montrait les fiches, et
          les comptes sans fiche arrivaient après, dans un second tableau que
          rien n'obligeait à faire défiler. Ces lignes sont désormais FONDUES
          dans la liste principale (`lignesAffichees`), triées avec le reste.
          Le tableau dédié `SansFicheTable` reste utilisé — mais seulement
          quand on ISOLE la catégorie via le filtre « Inscription », où ses
          colonnes propres (consentement, relance, doublon) ont un sens. */}
    </div>
  );
}

/** Fournisseur d'authentification d'un compte sans fiche. Neutre et discret :
 *  c'est une donnée technique utile au diagnostic (un compte Apple qui revient
 *  par courriel crée un DOUBLON), pas un statut à mettre en avant. */
function FournisseurPill({ fournisseur }: { fournisseur: string }) {
  // FOURNISSEUR_LABEL est la table déjà utilisée par SansFicheTable : une
  // seule traduction pour les deux surfaces, sinon « Courriel » ici et
  // « email » là-bas finissent par diverger.
  const label = FOURNISSEUR_LABEL[fournisseur] ?? fournisseur;
  return (
    <span className="inline-flex shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-white/5 border border-white/10 text-[#9CA3AF]">
      {label}
    </span>
  );
}

function InscriptionPill({ label }: { label: string }) {
  // Ambre et non bleu : le bleu est réservé au signal « vérifié » (CLAUDE.md).
  return (
    <span className="inline-flex shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#F59E0B]/15 border border-[#F59E0B]/30 text-[#F59E0B]">
      {label}
    </span>
  );
}

function RepartitionChip({ n, label, accent, onClick }: { n: number; label: string; accent?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] transition-colors ${
        accent ? "border-[#F59E0B]/30 text-[#F59E0B] hover:bg-[#F59E0B]/10" : "border-white/10 text-[#9CA3AF] hover:text-white hover:border-white/20"
      }`}
    >
      <span className="font-bold tabular-nums">{n}</span> {label}
    </button>
  );
}

function SansFicheTable({ rows }: { rows: SansFicheRow[] }) {
  if (rows.length === 0) {
    return <div className="text-center py-12 text-[#6b7280]">Aucun compte sans fiche</div>;
  }
  const th = "text-left px-4 py-3 text-[11px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]";
  return (
    <div className="bg-[#1A1D24] border border-[#2D3748] rounded-lg overflow-x-auto">
      <table className="w-full text-[13px] text-[#E0E0E0]">
        <thead>
          <tr className="bg-[#13151a] border-b border-[#2D3748]">
            <th className={th}>Compte</th>
            <th className={th}>Courriel</th>
            <th className={th}>Fournisseur</th>
            <th className={th}>Inscrit le</th>
            <th className={th}>/consentements</th>
            <th className={th}>Âge déclaré</th>
            <th className={th}>Relance</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const nom = `${r.prenom ?? ""} ${r.nom ?? ""}`.trim() || "—";
            return (
              <tr key={r.user_id} className="border-b border-[#2D3748] hover:bg-[#22252D]">
                <td className="px-4 py-2.5">
                  <span className="flex flex-col items-start gap-1">
                    <span className="text-[13px] font-bold text-white">{nom}</span>
                    <span className="flex flex-wrap gap-1">
                      <InscriptionPill label="Inscription inachevée" />
                      {r.doublon_probable && (
                        <span
                          title="Même nom et même date de naissance qu'une fiche active d'un autre compte"
                          className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/5 border border-white/10 text-[#9CA3AF]"
                        >
                          Doublon probable
                        </span>
                      )}
                    </span>
                  </span>
                </td>
                <td className="px-4 py-2.5 text-[13px] text-[#9CA3AF] break-all">{r.email || "—"}</td>
                <td className="px-4 py-2.5 text-[13px] text-[#9CA3AF]">
                  {r.fournisseur ? FOURNISSEUR_LABEL[r.fournisseur] ?? r.fournisseur : "—"}
                </td>
                <td className="px-4 py-2.5 text-[13px] text-[#9CA3AF] whitespace-nowrap">
                  {formatDate(r.inscrit_le)}
                  <span className="block text-[11px] text-[#6b7280]">
                    {r.derniere_connexion ? `vu ${formatDate(r.derniere_connexion)}` : "jamais connecté"}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-[13px]">
                  {r.consentement_passe
                    ? <span className="text-[#22C55E]">Passé{r.consentement_le ? ` · ${formatDate(r.consentement_le)}` : ""}</span>
                    : <span className="text-[#6b7280]">Jamais passé</span>}
                </td>
                <td className="px-4 py-2.5 text-[13px] text-[#9CA3AF] tabular-nums">
                  {r.age != null ? `${r.age} ans` : "—"}
                </td>
                <td className="px-4 py-2.5 text-[13px] text-[#9CA3AF] whitespace-nowrap">
                  {r.relance_statut === "ENVOYE" ? `Envoyée ${formatDate(r.relance_le)}`
                    : r.relance_statut === "RESERVE" ? "En cours"
                    : r.relance_statut === "ECHEC" ? <span className="text-[#EF4444]">Échec</span>
                    : "—"}
                  {r.desabonne && <span className="block text-[11px] text-[#6b7280]">Désabonné</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FilterSelect({
  title, value, onChange, options,
}: {
  title: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const active = value !== "";
  return (
    <select
      title={title}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`bg-[#1A1D24] border rounded-lg px-3 py-2.5 text-[13px] focus:outline-none transition-colors ${active ? "border-[#E63946]/50 text-[#E63946] font-bold" : "border-white/10 text-white hover:border-white/20"}`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-[#1A1D24] text-white">{o.label}</option>
      ))}
    </select>
  );
}

function UserListTable({ rows }: { rows: UserRow[] }) {
  if (rows.length === 0) {
    return <div className="text-center py-12 text-[#6b7280]">Aucun résultat</div>;
  }
  return (
    <div className="bg-[#1A1D24] border border-[#2D3748] rounded-lg overflow-x-auto">
      <table className="w-full text-[13px] text-[#E0E0E0]">
        <thead>
          <tr className="bg-[#13151a] border-b border-[#2D3748]">
            <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]">Nom</th>
            <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]">Email</th>
            <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]">Établissement</th>
            <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]">Inscrit le</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => {
            const name = `${u.first_name || ""} ${u.last_name || ""}`.trim() || "—";
            return (
              <tr key={u.id} className="border-b border-[#2D3748] hover:bg-[#22252D]">
                <td className="px-4 py-2.5 text-[13px] font-bold text-white">{name}</td>
                <td className="px-4 py-2.5 text-[13px] text-[#9CA3AF]">{u.email || "—"}</td>
                <td className="px-4 py-2.5 text-[13px] text-[#9CA3AF]">
                  {u.school_name ? (
                    <span className="flex flex-col items-start leading-tight">
                      <span>{u.school_name}</span>
                      {u.school_type && <span className="text-[11px] text-[#6b7280]">{schoolTypeLabel(u.school_type)}</span>}
                    </span>
                  ) : "—"}
                </td>
                <td className="px-4 py-2.5 text-[13px] text-[#9CA3AF]">{formatDate(u.created_at)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
