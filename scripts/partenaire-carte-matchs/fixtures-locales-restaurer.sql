-- LOCAL SEULEMENT (Docker) — remet en état les données de preuve du chantier « carte des
-- matchs partenaires » (2026-10-09). Ne rien lancer de ce fichier en prod.
--
-- Ce que les preuves ont posé en local :
--   · comptes p2.suspendu@preuve.local (SUSPENDED) et p3.revoque@preuve.local (REVOKED),
--     rôle PARTNER, fiche media_partners ;
--   · athlètes fictifs du match d3a…b4001 (Hérons des Battures) : case partenaire cochée
--     pour Caron et Boucher ; Côté coché, ramené à 13 ans, sans consentement parental ;
--     valeurs d'origine gardées dans fx.partenaire_origine ;
--   · match QMFL fictif fa000000-…-000000000630 (« 6:30 PM ») et son ajout par l'unité
--     de r3.collegue ; ajouts et jeton d'agenda de p1.partenaire.
\set ON_ERROR_STOP 1
begin;
update public.athletes a
   set partner_visibility_opt_in = o.partner_visibility_opt_in,
       partner_visibility_parental_consent = o.partner_visibility_parental_consent,
       date_naissance = o.date_naissance
  from fx.partenaire_origine o where o.id = a.id;
delete from public.matchs_ajoutes where game_id = 'fa000000-0000-4000-8000-000000000630';
delete from public.games where id = 'fa000000-0000-4000-8000-000000000630';
delete from public.media_partners where user_id in (select id from public.users where email in ('p2.suspendu@preuve.local', 'p3.revoque@preuve.local'));
delete from auth.users where email in ('p2.suspendu@preuve.local', 'p3.revoque@preuve.local');
drop table fx.partenaire_origine;
drop schema fx;
commit;
