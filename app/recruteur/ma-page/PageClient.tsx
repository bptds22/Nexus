"use client";

// app/recruteur/ma-page/PageClient.tsx
//
// « Ma page » — l'éditeur de la page publique du CÉGEP, côté recruteur.
// Le collège est LE SIEN : `users.school_id`, jamais un choix.
//
// ── PÉRIMÈTRE ───────────────────────────────────────────────────────────────
// Rien ici ne permet de désigner un autre établissement. Les équipes listées
// sont filtrées sur `school_id` du compte, et `SchoolPageEditorProvider`
// résout le collège par `users.school_id` dès lors que le compte n'est pas
// admin plateforme (ce qu'un recruteur n'est pas). Le sélecteur de collège du
// portail admin n'existe pas sur cette surface.
// Et si quelqu'un contournait tout ça, la RLS refuserait : can_edit_school_page
// exige `u.school_id = p_school_id`. Vérifié en transaction annulée — écriture
// sur une école tierce : 0 ligne.
//
// ── LE FORFAIT EST GARDÉ PAR LA BASE ────────────────────────────────────────
// `FeatureGate` ci-dessous n'est PAS la protection : c'est de l'affichage. La
// vraie porte est can_edit_school_page, qui exige depuis la migration
// 20260807224410 un abonnement `pro`/`all_star` au statut `active`/`trialing`.
// Avant elle, un recruteur Free pouvait écrire sa page par appel direct
// (démontré : UPDATE 1 ligne, INSERT 1 ligne) — ce n'est plus le cas
// (re-démontré après application : porte false, UPDATE 0 ligne).
//
// ⚠ LES DEUX DOIVENT RESTER D'ACCORD. Si le palier requis change ici, il doit
// changer dans la fonction SQL, et inversement : sinon l'écran s'ouvre et
// l'enregistrement échoue en silence côté RLS. Un directeur (is_school_admin)
// passe la porte SQL quel que soit son forfait — voir la clause 2a.

import * as React from "react";
import PagesTab, { type PagesTabTeam } from "@/components/shared/pages/PagesTab";
import FeatureGate from "@/components/subscription/FeatureGate";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";

const card = "bg-[#1A1D24] border border-[#2D3748] rounded-xl";

export default function MaPageClient() {
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const schoolId = user?.profile.school_id ?? null;

  const [schoolName, setSchoolName] = React.useState("");
  const [teams, setTeams] = React.useState<PagesTabTeam[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (userLoading) return;
    if (!schoolId) { setLoading(false); return; }
    let annule = false;
    (async () => {
      try {
        const client = createClient();
        const [sch, tms] = await Promise.all([
          client.from("schools").select("name").eq("id", schoolId).maybeSingle(),
          // FILTRÉ SUR SON ÉCOLE — c'est la seule liste qu'il verra jamais.
          client.from("teams")
            .select("id, name, division, gender, sports:sport_id(nom)")
            .eq("school_id", schoolId)
            .order("name"),
        ]);
        if (annule) return;
        if (sch.error) throw sch.error;
        if (tms.error) throw tms.error;
        setSchoolName(((sch.data as { name: string } | null)?.name) ?? "Mon collège");
        const rows = (tms.data ?? []) as unknown as {
          id: string; name: string | null; division: string | null; gender: string | null;
          sports: { nom: string | null } | null;
        }[];
        setTeams(rows.filter((r) => r.name).map((r) => ({
          id: r.id,
          nom: r.name as string,
          sport_name: r.sports?.nom ?? null,
          division: r.division,
          gender: r.gender,
        })));
      } catch (e) {
        if (!annule) setErr(e instanceof Error ? e.message : "Chargement impossible");
      } finally {
        if (!annule) setLoading(false);
      }
    })();
    return () => { annule = true; };
  }, [userLoading, schoolId]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <header className="mb-6">
        <h1 className="font-head text-[26px] font-black text-white uppercase tracking-tight">
          Ma page
        </h1>
        <p className="text-[13px] text-[#9CA3AF] mt-1">
          Ce que les athlètes voient de ton établissement et de tes équipes.
        </p>
      </header>

      {/* Pro = le palier à 19,99 $. Le contenu gaté n'est PAS monté sous le
          palier requis : aucune requête ne part, rien ne fuit par le réseau. */}
      <FeatureGate feature="public_page" requiredTier="pro">
        {userLoading || loading ? (
          <div className={`${card} px-4 py-6 text-[13px] text-[#9CA3AF]`}>Chargement…</div>
        ) : err ? (
          <div className={`${card} px-4 py-6 text-[13px] text-[#9CA3AF]`}>{err}</div>
        ) : !schoolId ? (
          // Un recruteur sans établissement n'a pas de page à éditer. Message
          // net plutôt qu'un écran vide : ce n'est pas une panne.
          <div className={`${card} px-4 py-6 text-[13px] text-[#9CA3AF]`}>
            Ton compte n&apos;est rattaché à aucun établissement — il n&apos;y a pas de page à modifier.
          </div>
        ) : (
          <PagesTab schoolId={schoolId} schoolName={schoolName} teams={teams} />
        )}
      </FeatureGate>
    </div>
  );
}
