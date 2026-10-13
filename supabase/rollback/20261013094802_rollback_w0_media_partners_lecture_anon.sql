-- Rollback de 20261013094802_w0_media_partners_lecture_anon.sql : rend à anon le SELECT de
-- table (état relevé avant, accordé par les default privileges Supabase) et retire les
-- privilèges de colonne devenus redondants.

revoke select (
  id, organization_name, logo_url, card_image_url,
  tier, category, homepage_order, show_on_homepage, status,
  description, about_text, website_url, instagram_handle, tiktok_handle,
  facebook_url, x_url, youtube_url, linkedin_url
) on public.media_partners from anon;

grant select on public.media_partners to anon;
