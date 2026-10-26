# Banc LOCAL de la relance consentement v2 (Docker supabase_db_Nexus). JAMAIS contre la prod.
# Depuis la racine du worktree, dans l'outil PowerShell (pas git-bash : /tmp serait reecrit).
# Migration et rollback passent en UNE transaction avec ON_ERROR_STOP, comme en prod.
# admin_operations est en ajout seulement : les lignes du banc y restent (comptees a la fin).
$db = 'supabase_db_Nexus'
$mig = '20261026150000_relance_consentement_v2.sql'
$rb  = '20261026150000_rollback_relance_consentement_v2.sql'
$script:echecs = 0
docker exec $db rm -rf /tmp/relance | Out-Null
docker exec $db mkdir -p /tmp/relance | Out-Null
docker cp "supabase/migrations/$mig" "${db}:/tmp/relance/$mig" | Out-Null
docker cp "supabase/rollback/$rb" "${db}:/tmp/relance/$rb" | Out-Null
foreach ($f in Get-ChildItem docs/relance-consentement-v2 -Recurse -Filter *.sql) { docker cp $f.FullName "${db}:/tmp/relance/$($f.Name)" | Out-Null }
function Q([string]$sql) { (docker exec -e PGCLIENTENCODING=UTF8 $db psql -U postgres -d postgres -q -v ON_ERROR_STOP=1 -Atc $sql 2>$null | Out-String).Trim() }
function F([string]$fichier, [string[]]$vars = @()) { $a = @('exec','-e','PGCLIENTENCODING=UTF8',$db,'psql','-U','postgres','-d','postgres','-q') + $vars + @('-f',"/tmp/relance/$fichier"); & docker @a 2>$null | Out-Null; return $LASTEXITCODE }
function M([string]$fichier) { return (F $fichier @('-1','-v','ON_ERROR_STOP=1')) }
function Verifier([string]$nom, $vu, $attendu) { if ("$vu" -eq "$attendu") { Write-Output "  OK    $nom = $vu" } else { Write-Output "  ECHEC $nom = $vu (attendu $attendu)"; $script:echecs++ } }
$ops = "(select count(*) from public.admin_operations where operation like 'CONSENTEMENT_V2_%' and id not in (select id from _test_relance_v2.ops_avant))"

Write-Output '== 1. Migration'
Verifier 'application' (M $mig) 0
Verifier 'seconde application refusee' ((M $mig) -ne 0) True
Verifier 'ancienne signature (text) absente' (Q "select to_regprocedure('public.consentement_partenaire_v2_pousser(text)') is null") t
Verifier 'ACL pousser' (Q "select array_agg(split_part(x,'=',1) order by 1) from pg_proc, unnest(proacl::text[]) x where oid='public.consentement_partenaire_v2_pousser(text,uuid)'::regprocedure") '{postgres,service_role}'
Verifier 'ACL relancer' (Q "select array_agg(split_part(x,'=',1) order by 1) from pg_proc, unnest(proacl::text[]) x where oid='public.consentement_partenaire_v2_relancer(text,uuid)'::regprocedure") '{postgres,service_role}'
foreach ($r in 'anon','authenticated') {
  foreach ($fn in 'pousser','relancer') {
    Verifier "$r refuse ($fn)" (Q "set role $r; do `$`$ begin perform public.consentement_partenaire_v2_$fn(null); raise exception 'PASSE'; exception when insufficient_privilege then null; end `$`$; select 'refuse'") refuse
  }
}

Write-Output '== 2. Banc'
Verifier 'banc pose' (F '0-banc.sql' @('-v','ON_ERROR_STOP=1')) 0
$E = Q "select count(*) from public.athletes a join public.users u on u.id=a.user_id left join public.consentement_partenaire_v2 c on c.athlete_id=a.id where coalesce(u.onboarding_complete,false) and a.status in ('ACTIF','EN_ATTENTE') and not (coalesce(a.partner_visibility_opt_in,false) and c.accepte_le is not null and c.accepte_le >= coalesce(a.partner_visibility_opted_in_at,'-infinity')) and c.refuse_le is null and c.demande_parent_le is null and coalesce(c.plus_tard_nb,0) < 3 and c.push_le is null and not exists (select 1 from public.push_preferences p where p.user_id=a.user_id and p.categorie='RAPPELS' and not p.actif)"
Write-Output "  cible calculee independamment : E = $E"
Verifier 'apercu pousser = E' (Q "select public.consentement_partenaire_v2_pousser(null)->>'cibles'") $E

Write-Output '== 3. Push 1'
$faux = [int]$E + 1
Verifier "envoi avec attendu=$faux refuse" ((F '1-envoi.sql' @('-v',"attendu=$faux")) -ne 0) True
Verifier 'aucune push_le, aucune operation apres le refus' (Q "select count(*) || '/' || $ops from public.consentement_partenaire_v2 where push_le is not null") '0/0'
Verifier "envoi attendu=$E" (F '1-envoi.sql' @('-v',"attendu=$E")) 0
$op1 = Q "select id from public.admin_operations where operation='CONSENTEMENT_V2_PUSH' and id not in (select id from _test_relance_v2.ops_avant)"
Verifier 'une ligne admin_operations' (Q "select $ops") 1
Verifier 'push_le posees = E' (Q 'select count(*) from public.consentement_partenaire_v2 where push_le is not null') $E
Verifier 'exclus jamais vises (refus, v2, parent, plus tard x3, rappels coupes)' (Q "select count(*) from _test_relance_v2.roles r join public.consentement_partenaire_v2 c using (athlete_id) where r.role in ('REFUSE','V2_ACCEPTE','DEMANDE_PARENT','PLUS_TARD_3','RAPPELS_OFF') and c.push_le is not null") 0
Verifier 'en attente (plus tard x1) vise' (Q "select count(*) from _test_relance_v2.roles r join public.consentement_partenaire_v2 c using (athlete_id) where r.role='PLUS_TARD_1' and c.push_le is not null") 1
$crees = Q "select count(*) from public.consentement_partenaire_v2 c where push_le is not null and athlete_id not in (select athlete_id from _test_relance_v2.cpv2) and athlete_id not in (select athlete_id from _test_relance_v2.roles where role='PLUS_TARD_1')"
Verifier 'lignes_creees journalisees' (Q "select jsonb_array_length(details->'lignes_creees') from public.admin_operations where id='$op1'") $crees

Write-Output '== 4. Idempotence push'
Verifier 'second passage refuse' ((F '1-envoi.sql' @('-v',"attendu=$E")) -ne 0) True
Verifier 'apercu = 0' (Q "select public.consentement_partenaire_v2_pousser(null)->>'cibles'") 0
Verifier 'ENVOYER 0 refuse' (Q "do `$`$ begin perform public.consentement_partenaire_v2_pousser('ENVOYER 0'); raise exception 'PASSE'; exception when raise_exception then if sqlerrm not like 'NEXUS: aucune cible%' then raise; end if; end `$`$; select 'refuse'") refuse
Verifier 'toujours E push_le / 1 operation' (Q "select count(*) || '/' || $ops from public.consentement_partenaire_v2 where push_le is not null") "$E/1"

Write-Output '== 5. Relance J+7'
Verifier 'avant J+7 : apercu relance = 0' (Q "select public.consentement_partenaire_v2_relancer(null)->>'cibles'") 0
# Simulation du temps (banc seulement) : la push recule de 8 jours, et avec elle tout « Plus tard »
# anterieur (sinon un Plus tard d'AVANT la push passerait pour une reponse d'APRES). Remise exacte
# de push_le avant l'annulation.
Q "update public.consentement_partenaire_v2 set push_le = push_le - interval '8 days', plus_tard_le = plus_tard_le - interval '8 days' where push_le is not null" | Out-Null
# Trois repondants depuis la push : accord v2, Non, Plus tard.
Q "update public.consentement_partenaire_v2 c set accepte_le = now() from _test_relance_v2.roles r where r.athlete_id=c.athlete_id and r.role='OPT_IN_V1'; update public.consentement_partenaire_v2 c set refuse_le = now() from _test_relance_v2.roles r where r.athlete_id=c.athlete_id and r.rang=9; update public.consentement_partenaire_v2 c set plus_tard_nb = plus_tard_nb + 1, plus_tard_le = now() from _test_relance_v2.roles r where r.athlete_id=c.athlete_id and r.rang=10" | Out-Null
$R = [int]$E - 3
Verifier 'apercu relance = E - 3 (non-repondants seulement)' (Q "select public.consentement_partenaire_v2_relancer(null)->>'cibles'") $R
Verifier 'heures calmes : envoi refuse' (Q "begin; create or replace function public.push_heure_calme(p_moment timestamptz) returns boolean language sql stable set search_path to 'public' as 'select true'; do `$`$ begin perform public.consentement_partenaire_v2_relancer('ENVOYER $R'); raise exception 'PASSE'; exception when raise_exception then if sqlerrm not like 'NEXUS: heures calmes%' then raise; end if; end `$`$; rollback; select 'refuse'") refuse
Verifier 'heures calmes : fonction d origine intacte' (Q "select public.push_heure_calme('2026-10-26 14:00+00')::text || public.push_heure_calme('2026-10-27 03:00+00')::text") falsetrue
Verifier 'heures calmes : rien ecrit' (Q 'select count(*) from public.consentement_partenaire_v2 where relance_le is not null') 0
Verifier "relance attendu=$R" (F '2-relance-j7.sql' @('-v',"attendu=$R")) 0
$op2 = Q "select id from public.admin_operations where operation='CONSENTEMENT_V2_RELANCE' and id not in (select id from _test_relance_v2.ops_avant)"
Verifier 'relance_le posees = E - 3' (Q 'select count(*) from public.consentement_partenaire_v2 where relance_le is not null') $R
Verifier 'repondants non relances (accord, Non, Plus tard)' (Q "select count(*) from _test_relance_v2.roles r join public.consentement_partenaire_v2 c using (athlete_id) where (r.role='OPT_IN_V1' or r.rang in (9,10)) and c.relance_le is not null") 0
Verifier 'refuses et exclus jamais relances' (Q "select count(*) from public.consentement_partenaire_v2 where relance_le is not null and (refuse_le is not null or push_le is null or demande_parent_le is not null)") 0
Verifier 'second passage relance refuse' ((F '2-relance-j7.sql' @('-v',"attendu=$R")) -ne 0) True
Verifier 'apercu relance = 0' (Q "select public.consentement_partenaire_v2_relancer(null)->>'cibles'") 0
Verifier 'operations : push + relance' (Q "select $ops") 2

Write-Output '== 6. Annulations'
Verifier 'rollback de schema refuse (relance partie)' ((M $rb) -ne 0) True
Verifier 'schema intact apres ce refus' (Q "select to_regprocedure('public.consentement_partenaire_v2_relancer(text,uuid)') is not null") t
Verifier 'annulation push refusee tant que la relance tient' ((F '3-rollback-envoi.sql' @('-v',"op=$op1")) -ne 0) True
Verifier 'annulation relance' (F '4-rollback-relance.sql' @('-v',"op=$op2")) 0
Verifier 'relance_le toutes vides' (Q 'select count(*) from public.consentement_partenaire_v2 where relance_le is not null') 0
Verifier 'annulation relance rejouee refusee' ((F '4-rollback-relance.sql' @('-v',"op=$op2")) -ne 0) True
Q "update public.consentement_partenaire_v2 set push_le = push_le + interval '8 days', plus_tard_le = plus_tard_le + interval '8 days' where push_le is not null" | Out-Null
Verifier 'annulation push' (F '3-rollback-envoi.sql' @('-v',"op=$op1")) 0
Verifier 'push_le toutes vides' (Q 'select count(*) from public.consentement_partenaire_v2 where push_le is not null') 0
Verifier 'lignes restantes = avant + 3 repondants' (Q "select (select count(*) from public.consentement_partenaire_v2) - (select count(*) from _test_relance_v2.cpv2) - (select count(*) from _test_relance_v2.roles where role in ('REFUSE','V2_ACCEPTE','DEMANDE_PARENT','PLUS_TARD_3','PLUS_TARD_1'))") 3
Verifier 'reponses des repondants gardees' (Q "select count(*) from _test_relance_v2.roles r join public.consentement_partenaire_v2 c using (athlete_id) where (r.role='OPT_IN_V1' and c.accepte_le is not null) or (r.rang=9 and c.refuse_le is not null) or (r.rang=10 and c.plus_tard_le is not null)") 3
Verifier 'annulation push rejouee refusee' ((F '3-rollback-envoi.sql' @('-v',"op=$op1")) -ne 0) True

Write-Output '== 7. Un seul athlete (forme du test sur nexus.onboarding)'
$x = Q "select athlete_id from _test_relance_v2.roles where role='OPT_IN_V1_B'"
Verifier 'apercu pour un athlete = 1' (Q "select public.consentement_partenaire_v2_pousser(null, '$x')->>'cibles'") 1
Verifier 'envoi a un athlete' (F '1-envoi.sql' @('-v','attendu=1','-v',"athlete=$x")) 0
Verifier 'seul cet athlete a push_le' (Q "select string_agg(athlete_id::text, ',') from public.consentement_partenaire_v2 where push_le is not null") $x
Verifier 'cible globale = E - 3 (accord + Non + cet athlete)' (Q "select public.consentement_partenaire_v2_pousser(null)->>'cibles'") ([int]$E - 3)
$op3 = Q "select id from public.admin_operations where operation='CONSENTEMENT_V2_PUSH' and details->>'athlete' = '$x' and id not in (select id from _test_relance_v2.ops_avant)"
Verifier 'annulation du test a un athlete' (F '3-rollback-envoi.sql' @('-v',"op=$op3")) 0
Verifier 'cible globale revenue a E - 2' (Q "select public.consentement_partenaire_v2_pousser(null)->>'cibles'") ([int]$E - 2)

Write-Output '== 8. Restauration et rollback de schema'
Verifier 'banc defait, instantane identique' (F '9-restaurer.sql' @('-v','ON_ERROR_STOP=1')) 0
Verifier 'rollback de schema' (M $rb) 0
Verifier 'corps d origine restaure (md5)' (Q "select md5(replace(prosrc,E'\r','')) from pg_proc where oid='public.consentement_partenaire_v2_pousser(text)'::regprocedure") '1b1dde6903bfc8d1b63d7ed6c31fec2f'
Verifier 'ACL d origine' (Q "select array_agg(split_part(x,'=',1) order by 1) from pg_proc, unnest(proacl::text[]) x where oid='public.consentement_partenaire_v2_pousser(text)'::regprocedure") '{postgres,service_role}'
Verifier 'reapplication apres rollback' (M $mig) 0
Verifier 'rollback final (base locale = prod)' (M $rb) 0
Verifier 'relance_le absente a la fin' (Q "select count(*) from information_schema.columns where table_name='consentement_partenaire_v2' and column_name='relance_le'") 0
Write-Output "== ECHECS : $script:echecs"
