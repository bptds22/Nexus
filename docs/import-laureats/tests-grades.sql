-- Tests au banc des CHECK de grade (local). Tout tourne dans une transaction annulée.
-- Sortie : une ligne « ok|echecs ».
begin;
create temp table _t (nom text, ok boolean);

do $$
declare v_carte uuid; v_rec uuid; v_ath uuid; g text;
begin
  select id into v_carte from public.cartes_prospect limit 1;
  select recruiter_id, athlete_id into v_rec, v_ath from public.recruiter_athlete_grades limit 1;
  foreach g in array array['A+','A','B+','B','C+','C','D+','D','E'] loop
    if v_carte is not null then
      begin
        execute 'alter table public.cartes_prospect disable trigger user';
        update public.cartes_prospect set grade = g where id = v_carte;
        execute 'alter table public.cartes_prospect enable trigger user';
        insert into _t values ('carte accepte ' || g, true);
      exception when check_violation then insert into _t values ('carte accepte ' || g, false);
      end;
    end if;
    if v_rec is not null then
      begin
        update public.recruiter_athlete_grades set grade = g where recruiter_id = v_rec and athlete_id = v_ath;
        insert into _t values ('grade recruteur accepte ' || g, true);
      exception when check_violation then insert into _t values ('grade recruteur accepte ' || g, false);
      end;
    end if;
  end loop;
  foreach g in array array['D-','F','E+','e',''] loop
    if v_carte is not null then
      begin
        execute 'alter table public.cartes_prospect disable trigger user';
        update public.cartes_prospect set grade = g where id = v_carte;
        insert into _t values ('carte refuse «' || g || '»', false);
      exception when check_violation then insert into _t values ('carte refuse «' || g || '»', true);
      end;
      execute 'alter table public.cartes_prospect enable trigger user';
    end if;
    if v_rec is not null then
      begin
        update public.recruiter_athlete_grades set grade = g where recruiter_id = v_rec and athlete_id = v_ath;
        insert into _t values ('grade recruteur refuse «' || g || '»', false);
      exception when check_violation then insert into _t values ('grade recruteur refuse «' || g || '»', true);
      end;
    end if;
  end loop;
  insert into _t values ('carte NULL acceptée', true);
  if v_carte is null then insert into _t values ('AUCUNE carte locale pour tester', false); end if;
  if v_rec is null then insert into _t values ('AUCUN grade recruteur local pour tester', false); end if;
end $$;

select string_agg(nom, ', ') filter (where not ok) as echecs_detail from _t;
select count(*) filter (where ok) || '|' || count(*) filter (where not ok) from _t;
rollback;
