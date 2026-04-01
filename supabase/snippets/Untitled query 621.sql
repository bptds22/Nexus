ALTER TABLE athletes ADD COLUMN statut_recrutement_override TEXT;
ALTER TABLE athletes ADD COLUMN recrutement_override_at TIMESTAMPTZ;
```

The display logic everywhere is:
```
1. Get latest pipeline update: MAX(updated_at) from pipeline WHERE athlete_id = X
2. Get coach override: athletes.recrutement_override_at
3. If override exists AND override_at > latest pipeline update → show override
4. Otherwise → show automatic (highest pipeline status)
```

This way:
- Coach overrides → it shows the coach's choice
- Recruiter makes any change → automatic kicks back in
- Coach sees it changed → can override again

Now add it back to the modifier. Run in Claude Code:
```
In app/coach/athletes/[id]/modifier/page.tsx, add back a recruitment status override in the FINALISATION section.

DB COLUMNS (just added):
- athletes.statut_recrutement_override (TEXT, nullable)
- athletes.recrutement_override_at (TIMESTAMPTZ, nullable)

ADD TO FINALISATION SECTION:
Label: "STATUT DE RECRUTEMENT (CORRECTION)"
Subtitle: "Ce statut sera automatiquement mis à jour par l'activité des recruteurs. Utilisez cette option uniquement pour corriger une erreur."

Dropdown options:
- "— Automatique" (default — clears the override, sets statut_recrutement_override = null)
- "Ouvert"
- "Identifié"
- "Contacté"
- "En discussion"
- "Visite planifiée"
- "Engagé"
- "Lettre signée"

On load: if statut_recrutement_override is not null, select it. Otherwise select "— Automatique".
On save: if "— Automatique" selected, save null. Otherwise save the selected value and set recrutement_override_at = NOW().

Keep "DIVISION PRÉFÉRÉE" dropdown too.

ALSO UPDATE DISPLAY LOGIC everywhere recruitment status is shown:
In app/coach/athletes/page.tsx (roster) and app/coach/athletes/[id]/page.tsx (profile):

1. Query pipeline for automatic status (highest)
2. Query athlete.statut_recrutement_override and athlete.recrutement_override_at
3. Query MAX(updated_at) from pipeline for that athlete
4. If override exists AND recrutement_override_at > max pipeline updated_at → show override value
5. Otherwise → show automatic pipeline status
6. If override is active, show a small "✎" icon next to the pill to indicate it's manually set

Only touch files in app/coach/athletes/.