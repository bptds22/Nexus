CREATE OR REPLACE FUNCTION public.push_traiter_file(p_maintenant timestamp with time zone DEFAULT now())
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
declare
  g          record;
  v_ids      bigint[];
  v_n        integer;
  v_titre    text;
  v_texte    text;
  v_envoi    bigint;
  v_collapse text;
  v_envoyes  integer := 0;
  v_elements integer := 0;
  v_annules  integer := 0;
  v_pref     integer := 0;
  v_jeton    integer := 0;
  v_k        integer;
begin
  if public.push_heure_calme(p_maintenant) then
    return jsonb_build_object('heures_calmes', true,
                              'en_attente', (select count(*) from public.push_file where statut = 'EN_ATTENTE'));
  end if;

  -- Carte partenaire qui n'attend plus de réponse (caduque, confirmée, infirmée) : rien ne part.
  update public.push_file f
     set statut = 'ANNULE', traite_le = p_maintenant
   where f.statut = 'EN_ATTENTE' and f.genre = 'CARTE_PARTENAIRE'
     and not exists (
       select 1
         from public.athlete_notifications n
         join public.partenaire_prospects_rapprochements r
           on r.carte_id::text = n.metadata->>'carte_id' and r.athlete_id = n.athlete_id
        where n.id::text = f.detail->>'notification_id'
          and not coalesce((n.metadata->>'caduque')::boolean, false)
          and r.statut = 'PROPOSE');
  get diagnostics v_k = row_count;
  v_annules := v_annules + v_k;

  -- Compte qui n'est plus actif : rien ne part.
  update public.push_file f
     set statut = 'ANNULE', traite_le = p_maintenant
    from public.users u
   where f.statut = 'EN_ATTENTE' and u.id = f.user_id and u.status <> 'ACTIF'::public.account_status;
  get diagnostics v_k = row_count;
  v_annules := v_annules + v_k;

  for g in
    select f.user_id, f.cle, max(f.categorie) as categorie, max(f.genre) as genre,
           max(f.source_nom) as source_nom
      from public.push_file f
     where f.statut = 'EN_ATTENTE'
     group by f.user_id, f.cle
    having min(f.cree_le) <= p_maintenant - interval '10 minutes'
     order by min(f.cree_le)
  loop
    select array_agg(s.id order by s.id) into v_ids
      from (select id from public.push_file
             where statut = 'EN_ATTENTE' and user_id = g.user_id and cle = g.cle
             for update skip locked) s;
    if v_ids is null then
      continue;
    end if;
    v_n := array_length(v_ids, 1);

    if exists (select 1 from public.push_preferences p
                where p.user_id = g.user_id and p.categorie = g.categorie and not p.actif) then
      update public.push_file set statut = 'PREFERENCE', traite_le = p_maintenant where id = any (v_ids);
      v_pref := v_pref + v_n;
      continue;
    end if;

    if not exists (select 1 from public.device_tokens d where d.user_id = g.user_id) then
      update public.push_file set statut = 'SANS_JETON', traite_le = p_maintenant where id = any (v_ids);
      v_jeton := v_jeton + v_n;
      continue;
    end if;

    select t.titre, t.texte into v_titre, v_texte
      from public.push_textes(g.genre, g.source_nom, v_n,
                              (select f.detail->>'libelle' from public.push_file f where f.id = v_ids[1])) t;

    insert into public.push_envois (user_id, categorie, cle, titre, texte, collapse_id, nb_elements, envoye_le)
    values (g.user_id, g.categorie, g.cle, v_titre, v_texte, 'nx-en-attente', v_n, p_maintenant)
    returning id into v_envoi;
    -- Une carte proposée de nouveau remplace son push précédent ; le reste ne remplace rien.
    v_collapse := case when g.genre = 'CARTE_PARTENAIRE' then 'nx-' || g.cle else 'nx-envoi-' || v_envoi end;
    update public.push_envois set collapse_id = v_collapse where id = v_envoi;

    perform public.push_to_user(g.user_id, v_titre, v_texte,
              jsonb_build_object('type', 'announcement', 'categorie', g.categorie, 'envoi_id', v_envoi)
                || public.push_destination(g.genre),
              v_collapse);

    update public.push_file set statut = 'ENVOYE', traite_le = p_maintenant, envoi_id = v_envoi
     where id = any (v_ids);
    v_envoyes := v_envoyes + 1;
    v_elements := v_elements + v_n;
  end loop;

  -- Purge : la file traitée est gardée 90 jours, le journal 180.
  delete from public.push_file where statut <> 'EN_ATTENTE' and traite_le < p_maintenant - interval '90 days';
  delete from public.push_envois where envoye_le < p_maintenant - interval '180 days';

  return jsonb_build_object('heures_calmes', false, 'pushs', v_envoyes, 'elements', v_elements,
                            'annules', v_annules, 'preference', v_pref, 'sans_jeton', v_jeton,
                            'en_attente', (select count(*) from public.push_file where statut = 'EN_ATTENTE'));
end;
$function$

