-- Rollback de 20261013141550_w0_media_partners_garde_colonnes.sql : retire le trigger et sa
-- fonction. La policy « Partners update own profile » (status + show_on_homepage) reste seule.

drop trigger if exists trg_media_partners_garde_colonnes on public.media_partners;
drop function if exists public.media_partners_garde_colonnes();
