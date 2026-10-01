/* ═══════════════════════════════════════════════════════════════
   exporterMesDonnees — l'export réel des données du recruteur (Loi 25,
   droit à la portabilité), en JSON. Un seul code pour Confidentialité et
   Zone danger (décision BP 2026-10-01 : le bouton « Exporter » de la Zone
   danger ne faisait qu'afficher un toast).
═══════════════════════════════════════════════════════════════ */

import { createClient } from "@/lib/supabase/client";

export async function exporterMesDonnees(): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Session expirée : reconnecte-toi puis réessaie." };

  const [profileRes, favoritesRes, pipelineRes, notesRes, listsRes, reviewsRes, messagesRes] = await Promise.all([
    supabase.from("users").select("*").eq("id", user.id).single(),
    supabase.from("recruiter_favorites").select("athlete_id, created_at").eq("recruiter_id", user.id),
    supabase.from("recruiter_pipeline").select("athlete_id, stage, created_at").eq("recruiter_id", user.id),
    supabase.from("recruiter_notes").select("athlete_id, content, created_at").eq("recruiter_id", user.id),
    supabase.from("recruiter_lists").select("name, description, created_at").eq("recruiter_id", user.id),
    supabase.from("coach_reviews").select("coach_id, note_globale, commentaire, created_at").eq("recruiter_id", user.id),
    supabase.from("messages").select("content, created_at").eq("sender_id", user.id),
  ]);
  if (profileRes.error) return { ok: false, message: "L'export n'a pas pu lire ton profil. Réessaie dans un instant." };

  const exportData = {
    exported_at: new Date().toISOString(),
    user_email: user.email,
    profile: profileRes.data,
    favorites: favoritesRes.data || [],
    pipeline: pipelineRes.data || [],
    notes: notesRes.data || [],
    lists: listsRes.data || [],
    reviews: reviewsRes.data || [],
    messages: messagesRes.data || [],
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `nexus-export-${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  return { ok: true };
}
