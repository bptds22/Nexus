-- ═══════════════════════════════════════════════════════════════════════════
-- M3 — Le 23e badge : `ambassadeur`.
--
-- ⚠⚠ `actif = false`, ET C'EST LA MOITIÉ DU CHANTIER ⚠⚠
--
-- badgesPourSport() (lib/config/badgeCatalogue.ts:209) filtre sur `b.actif`,
-- et les honneurs ne sont JAMAIS filtrés par sport. Un badge actif
-- apparaîtrait donc instantanément dans les SEPT pickers — coach web, admin,
-- athlète, ET LE BINAIRE MOBILE 1.4.x DÉJÀ EN MAGASIN, que personne ne peut
-- corriger. Le catalogue est piloté par la donnée : la ligne suffit, aucun
-- déploiement n'est nécessaire pour qu'il s'affiche partout.
--
-- Concrètement, avec actif = true :
--   · un coach pourrait distribuer « Ambassadeur » à qui il veut ;
--   · un athlète pourrait le SUGGÉRER depuis /athlete/profil ;
--   · la garde « palier 5 » — qui vit dans la RPC de M7, et nulle part
--     ailleurs — serait contournée par les deux chemins existants.
--
-- L'AFFICHAGE, LUI, NE FILTRE PAS. chargerBadgesAthlete lit athlete_badges
-- avec un embed badges(code, libelle) sans clause sur `actif`, et compter()
-- teste cat.byCode.has(code) sur cat.all, non filtré. Donc :
--   invisible dans tous les pickers · visible sur la fiche · compte au plafond
-- C'est exactement le comportement voulu, et il ne coûte AUCUNE modification
-- de BadgePicker.tsx, de badgeCatalogue.ts, ni des sept surfaces. C'est aussi
-- la garde mobile, obtenue sans écrire une ligne de code mobile (protocole
-- web-d'abord).
--
-- famille = 'honneur' : c'est un fait, pas une opinion de coach. Mais le
-- plafond de 5 s'applique quand même — les honneurs n'en sont plus exemptés
-- depuis le 2026-08-26, et ce fichier ne rouvre PAS cette décision. Le badge
-- prend une place, l'athlète choisit de la lui donner ou non (M7).
--
-- requiert_contexte = false : pas de millésime. Le programme n'a pas de
-- saison, et un contexte obligatoire ferait lever badge_contexte_requis sur
-- une pose automatique. contexte_forme reste donc NULL, comme l'exige
-- badges_contexte_forme_coherente.
--
-- ordre = 160 : juste après nexus-x (150), dans la section des honneurs.
--
-- AUCUNE LIGNE badge_sports : un honneur vaut pour tous les sports.
--
-- ── LES GARDE-FOUS D'AOÛT NE CASSENT PAS ────────────────────────────────
-- badges_seed_22 lève sur « ≠ 22 badges » et badges_libelles_du_catalogue_final
-- sur « écart avec le JSON ». Les deux s'exécutent à LEUR rang dans l'ordre des
-- migrations, donc AVANT ce fichier : un `db reset` local reste vert. Ne pas
-- « corriger » ces garde-fous, ils sont justes pour leur date.
--
-- En revanche `badges-catalogue-final.json` N'EXISTE PAS au dépôt, alors qu'une
-- migration le déclare source de vérité. Le 23e badge est donc consigné dans
-- docs/badges-regles-attribution.md — sinon la règle devient invérifiable.
--
-- ── DESSIN ──────────────────────────────────────────────────────────────
-- public/badges/badge-ambassadeur.svg — nexus-x décliné en or #F59E0B.
-- public/story-badges/badge-ambassadeur.svg — GÉNÉRÉ par
-- scripts/gen-story-badges.mjs, jamais écrit à la main.
-- /ma-story est HORS LOT (décision BP) : app/ma-story/taxonomie.ts porte sa
-- PROPRE taxonomie codée en dur, indépendante de cette table, et n'est pas
-- touchée par ce chantier.
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.badges (code, libelle, famille, requiert_contexte, contexte_forme, ordre, actif)
values ('ambassadeur', 'Ambassadeur', 'honneur', false, null, 160, false)
on conflict (code) do update set
  libelle           = excluded.libelle,
  famille           = excluded.famille,
  requiert_contexte = excluded.requiert_contexte,
  contexte_forme    = excluded.contexte_forme,
  ordre             = excluded.ordre,
  actif             = excluded.actif;

comment on column public.badges.actif is
$c$Proposé dans les pickers ou non. badgesPourSport() filtre dessus ;
l'AFFICHAGE, lui, ne filtre pas — un badge inactif reste visible sur la fiche
et compte au plafond.

C'est ce qui permet un badge MÉRITÉ : `ambassadeur` est actif = false pour
qu'aucun coach ni aucun athlète ne puisse le poser par le picker, tout en
restant portable par la RPC ambassadeur_basculer_badge(). Remettre actif =
true sur cette ligne rouvrirait les sept surfaces, binaire mobile compris.$c$;

do $$
declare v_n int; v_actif boolean; v_fam text; v_total int;
begin
  select count(*) into v_total from public.badges;
  if v_total <> 23 then
    raise exception 'NEXUS: % badges au catalogue au lieu de 23.', v_total;
  end if;

  select actif, famille into v_actif, v_fam
    from public.badges where code = 'ambassadeur';
  if v_actif is null then
    raise exception 'NEXUS: le badge ambassadeur n''a pas ete insere.';
  end if;
  if v_actif then
    raise exception 'NEXUS: le badge ambassadeur est ACTIF — il apparaitrait dans les sept pickers, binaire mobile compris.';
  end if;
  if v_fam <> 'honneur' then
    raise exception 'NEXUS: le badge ambassadeur est en famille % au lieu de honneur.', v_fam;
  end if;

  select count(*) into v_n from public.badge_sports bs
    join public.badges b on b.id = bs.badge_id where b.code = 'ambassadeur';
  if v_n <> 0 then
    raise exception 'NEXUS: le badge ambassadeur porte % rattachement(s) de sport — un honneur vaut pour tous les sports.', v_n;
  end if;

  raise notice 'NEXUS: badge ambassadeur au catalogue (honneur, inactif, hors picker). SVG a deposer dans public/badges/.';
end $$;
