# Migrations mises de côté (non appliquées, à ne PAS lancer telles quelles)

- **20260720120000_notify_parent_marketing.sql** — shelvée le 2026-07-24.
  Trigger de notification marketing lié au consentement parental. Non appliquée
  en prod (fonction+trigger confirmés absents). Attend une investigation Loi 25
  jamais faite : OÙ et QUAND le flag de consentement s'écrit avant que ce trigger
  ne se déclenche. Chantier dédié post-Bloc 2 — ne pas appliquer aveuglément.
