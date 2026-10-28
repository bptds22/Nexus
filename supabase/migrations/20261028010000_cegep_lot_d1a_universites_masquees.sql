-- NON APPLIQUÉE EN PROD. Chantier cégep, LOT D1a (avant l'import D1) : les universités et leurs équipes sont
-- INVISIBLES pour tout le monde sauf l'admin, quel que soit l'écran (web, mobile 1.4.5 déjà installé, qui lit
-- la base directement).
--
-- Pourquoi : « schools public read » (true) rend toute école lisible par tous, et « Recruiters see teams »
-- rend toute équipe lisible par un recruteur. Plusieurs listes du web et du mobile lisent les écoles sans
-- filtre de type (modifier une fiche côté coach, paramètres et profil du recruteur, Mon équipe, sélecteur
-- d'école sans filterType…) : sans ce lot, les 12 universités y apparaîtraient dès l'import.
--
--   1. ids_universites() : la liste des écoles UNIVERSITE, lue SANS RLS (sinon la policy des équipes,
--      qui la consulte, serait elle-même aveuglée par celle des écoles).
--   2. Policies RESTRICTIVE « universites_masquees » en SELECT, pour tous les rôles, sur schools et teams :
--      une ligne universitaire n'est lisible que par un admin (is_admin()). La liste est calculée une
--      fois par requête (sous-requête scalaire), pas ligne par ligne.
--   Le lot D2 (recruteur universitaire) élargira ces deux policies, derrière lancement_universitaire.
-- Hors de portée de ce lot, et vérifié à part : les fonctions SECURITY DEFINER (aucune ne liste écoles ou
-- équipes sans passer par une fiche, un compte, un match ou un identifiant connu) et les pages lues avec la
-- clé service (/college : correctif web livré avant D1).
-- Aucune ligne modifiée.

do $garde$
begin
  if to_regprocedure('public.ids_universites()') is not null
     or exists (select 1 from pg_policies where policyname = 'universites_masquees') then
    raise exception 'NEXUS: 20261028010000 déjà appliquée';
  end if;
  if to_regprocedure('public.verrou_universites()') is null then
    raise exception 'NEXUS: préalable D0 (20261028000000) absent';
  end if;
end $garde$;

create function public.ids_universites()
returns uuid[]
language sql
stable
security definer
set search_path = public
set row_security = off
as $function$
  select coalesce(array_agg(s.id), '{}') from public.schools s where s.type = 'UNIVERSITE';
$function$;

comment on function public.ids_universites() is
  'Lot D1a cégep : identifiants des écoles UNIVERSITE, lus sans RLS (sert aux policies universites_masquees).';

create policy universites_masquees on public.schools
  as restrictive for select to public
  using (type <> 'UNIVERSITE' or (select public.is_admin()));

create policy universites_masquees on public.teams
  as restrictive for select to public
  using ((select public.is_admin()) or not (school_id = any ((select public.ids_universites())::uuid[])));

-- La policy des équipes s'évalue avec les droits de l'appelant : anon et authenticated doivent pouvoir
-- l'exécuter. Elle ne rend que des identifiants d'écoles, déjà lisibles par l'admin seulement.
revoke all on function public.ids_universites() from public;
grant execute on function public.ids_universites() to anon, authenticated, service_role;

do $garde$
begin
  if (select count(*) from pg_policies where policyname = 'universites_masquees' and permissive = 'RESTRICTIVE'
         and cmd = 'SELECT' and tablename in ('schools', 'teams')) <> 2 then
    raise exception 'NEXUS: les deux policies universites_masquees ne sont pas en place';
  end if;
  raise notice 'NEXUS: lot D1a cégep — universités et équipes universitaires masquées (admin seulement)';
end $garde$;
