-- Remise à zéro des invitations d'UNE adresse, puis relance de l'invitation
-- d'UNE carte (décision BP 2026-09-30, motif « test BP »).
-- Gabarit : __ADRESSE__, __CARTE__, __MOTIF__, __ATTENDUES__ (remplacés avant exécution).
-- Opération d'ADMIN, sur GO explicite de BP : elle ENVOIE un courriel réel (étape 5).
-- Exécution : sed sur les quatre marqueurs, puis `supabase db query --linked -f`.
-- Une seule transaction ; toute garde qui échoue annule TOUT (rien n'est envoyé :
-- pg_net n'expédie qu'après COMMIT).
begin;

create temp table p as select lower(btrim('__ADRESSE__')) as adresse,
                             public.empreinte_courriel(lower(btrim('__ADRESSE__'))) as emp,
                             '__CARTE__'::uuid as carte, '__MOTIF__'::text as motif, __ATTENDUES__::int as attendues;

-- ── Gardes ──
do $$
declare v record; n int;
begin
  select * into v from p;
  if (select count(*) from public.cartes_prospect c where lower(btrim(c.courriel)) = v.adresse) <> 1
     or not exists (select 1 from public.cartes_prospect c where c.id = v.carte and lower(btrim(c.courriel)) = v.adresse) then
    raise exception 'NEXUS: il faut exactement UNE carte à cette adresse, et que ce soit celle-ci';
  end if;
  select count(*) into n from public.cartes_prospect_invitations where empreinte = v.emp;
  if n <> v.attendues then raise exception 'NEXUS: % ligne(s) d''invitation pour cette adresse, % attendue(s)', n, v.attendues; end if;
  if exists (select 1 from pg_trigger where tgrelid = 'public.cartes_prospect_invitations'::regclass and not tgisinternal) then
    raise exception 'NEXUS: un trigger est apparu sur cartes_prospect_invitations';
  end if;
end $$;

create temp table avant_autres as
  select count(*) as n, md5(coalesce(string_agg(id::text || statut || coalesce(motif, ''), '|' order by id), '')) as h
    from public.cartes_prospect_invitations where empreinte <> (select emp from p);

-- ── 1. Journal (avant la suppression : on y garde le détail des lignes retirées) ──
insert into public.cartes_prospect_journal (carte_id, acteur, action, details)
select (select carte from p), null, 'INVITATION_REINITIALISEE',
       jsonb_build_object('motif', (select motif from p),
                          'lignes_retirees', jsonb_agg(jsonb_build_object('id', i.id, 'carte_id', i.carte_id, 'statut', i.statut,
                              'motif', i.motif, 'resend_id', i.resend_id, 'created_at', i.created_at, 'envoye_le', i.envoye_le) order by i.created_at))
  from public.cartes_prospect_invitations i where i.empreinte = (select emp from p);

-- ── 2. Retrait des lignes de CETTE adresse (les rappels suivent par cascade) ──
delete from public.cartes_prospect_invitations where empreinte = (select emp from p);

-- ── 3. La carte redevient « jamais invitée » ──
select set_config('nexus.invitation_carte', 'on', true);
update public.cartes_prospect
   set invitation_etat = null, invitee_le = null, renvois_invitation = 0, dernier_renvoi_le = null
 where id = (select carte from p);
select set_config('nexus.invitation_carte', '', true);

-- ── 4. Éligibilité, comme le trigger de création ──
do $$
declare v record;
begin
  select * into v from p;
  if exists (select 1 from public.athletes a where lower(btrim(a.email)) = v.adresse)
     or exists (select 1 from public.users u where lower(btrim(u.email)) = v.adresse)
     or exists (select 1 from auth.users au where lower(btrim(au.email)) = v.adresse) then
    raise exception 'NEXUS: un compte existe à cette adresse';
  end if;
  if exists (select 1 from public.courriel_desabonnements_adresses d where d.empreinte = v.emp) then
    raise exception 'NEXUS: adresse désabonnée';
  end if;
  if exists (select 1 from public.cartes_prospect_invitations i where i.empreinte = v.emp) then
    raise exception 'NEXUS: une ligne d''invitation subsiste';
  end if;
end $$;

-- ── 5. Relance : une ligne A_ENVOYER, UN appel à envoyer_invitation_carte ──
create temp table relance (id uuid, created_at timestamptz);
with x as (
  insert into public.cartes_prospect_invitations (carte_id, unite_cegep_id, empreinte, statut)
  select c.id, c.unite_cegep_id, (select emp from p), 'A_ENVOYER' from public.cartes_prospect c where c.id = (select carte from p)
  returning id, created_at)
insert into relance select * from x;
select public.envoyer_invitation_carte((select id from relance));

-- ── Contre-vérifications avant COMMIT ──
do $$
begin
  if (select count(*) from relance) <> 1 then raise exception 'NEXUS: relance ≠ 1 ligne'; end if;
  if (select (count(*), md5(coalesce(string_agg(id::text || statut || coalesce(motif, ''), '|' order by id), '')))
        from public.cartes_prospect_invitations where empreinte <> (select emp from p))
     is distinct from (select (n, h) from avant_autres) then
    raise exception 'NEXUS: une autre adresse a été touchée';
  end if;
end $$;

commit;
