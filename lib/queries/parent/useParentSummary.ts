"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/* ═══════════════════════════════════════════════════════════════
   useParentSummary — les deux autres sources de la carte Résumé.

   Le graphe hebdo vient de useChildActivity. Ici : le nombre
   d'autorisations actives et la dernière notification NON LUE.

   Aucune nouvelle RPC, aucune écriture. Mêmes appels que les pages
   Consentements et Notifications, à la lettre.
   ═══════════════════════════════════════════════════════════════ */

/** Les clés d'autorisation que le portail expose au parent. Une clé est
 *  « active » quand elle porte une date d'octroi (non NULL) — c'est déjà
 *  la lecture que fait la page Consentements pour ses bascules. */
const CONSENT_KEYS = [
  "consent_privacy_policy",
  "consent_data_collection",
  "consent_marketing",
  "consent_parental_profile",
  "consent_parental_visibility",
  "consent_parental_partner_visibility",
] as const;

interface ConsentsShape {
  privacy_preferences?: Record<string, string | null>;
  partner_visibility?: { opt_in: boolean | null };
  error?: string;
}

export interface ParentNotif {
  id: string;
  type: string;
  title: string;
  message: string | null;
  created_at: string;
}

export interface ParentSummary {
  /** Nombre d'autorisations actives. null = non chargé / illisible. */
  consentCount: number | null;
  /** La plus récente NON LUE, ou null s'il n'y a rien de nouveau. */
  latestUnread: ParentNotif | null;
  loading: boolean;
}

export function useParentSummary(athleteId: string | null): ParentSummary {
  const [consentCount, setConsentCount] = useState<number | null>(null);
  const [latestUnread, setLatestUnread] = useState<ParentNotif | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!athleteId) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();

      const [{ data: cRes }, { data: nRows }] = await Promise.all([
        supabase.rpc("get_child_consents", { p_athlete_id: athleteId }),
        /* RLS restreint déjà les lignes au parent courant : pas de filtre
           d'appartenance à écrire ici, comme sur la page Notifications. */
        supabase
          .from("parent_notifications")
          .select("id, type, title, message, read, created_at")
          .eq("read", false)
          .order("created_at", { ascending: false })
          .limit(1),
      ]);

      if (cancelled) return;

      const c = cRes as ConsentsShape | null;
      if (c && !c.error) {
        const prefs = c.privacy_preferences ?? {};
        let n = CONSENT_KEYS.filter((k) => !!prefs[k]).length;
        // partner_visibility vit hors de privacy_preferences côté serveur ;
        // la page Consentements le lit séparément, on fait pareil.
        if (c.partner_visibility?.opt_in) n += 1;
        setConsentCount(n);
      }

      const rows = (nRows as ParentNotif[] | null) ?? [];
      setLatestUnread(rows[0] ?? null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [athleteId]);

  return { consentCount, latestUnread, loading };
}

/* ── Libellés de notification — ANONYMES, toujours ────────────────
   Le portail parent ne révèle JAMAIS l'identité d'un recruteur : la page
   Activité le dit explicitement, et la carte Résumé ne peut pas être la
   fuite par laquelle un nom passe. On rend donc un libellé par TYPE, sans
   jamais lire `title`/`message` de la ligne — ces champs sont écrits par
   des triggers et pourraient contenir autre chose demain.

   ⚠️ « Un recruteur a contacté votre enfant » n'est PAS dans cette liste :
   `parent_notifications` n'a que trois types (CHILD_FAVORITED,
   CHILD_PIPELINE_STAGE, CHILD_VISIT_PLANNED), tous émis par des triggers
   sur recruiter_favorites et recruiter_pipeline. Le premier contact vit
   dans `recruiter_contact_notifications`, table que le parent NE PEUT PAS
   lire (RLS : admin + coach uniquement). Voir le rapport de session.     */
export function notifLabel(type: string): string {
  switch (type) {
    case "CHILD_FAVORITED":
      return "Un recruteur a ajouté votre enfant à ses favoris.";
    case "CHILD_PIPELINE_STAGE":
      return "Un recruteur a fait progresser le dossier de votre enfant.";
    case "CHILD_VISIT_PLANNED":
      return "Une visite est planifiée pour votre enfant.";
    default:
      return "Nouvelle activité sur le profil de votre enfant.";
  }
}
