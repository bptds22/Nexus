import { createClient } from "@/lib/supabase/client";

/**
 * Téléverse une image dans le bucket public `avatars`, sous le dossier
 * de l'UTILISATEUR COURANT (`<auth.uid()>/<timestamp>.<ext>`), et renvoie
 * son URL publique.
 *
 * UN SEUL mécanisme, partagé :
 *   - coach changeant la photo d'un athlète → stockée sous le dossier du
 *     coach (auth.uid() = coach) ;
 *   - athlète changeant SA photo → sous son propre dossier (auth.uid() =
 *     athlète).
 * Dans les deux cas le 1er segment du chemin = auth.uid(), ce qui
 * satisfait la policy INSERT owner-scoped du bucket
 * ("Users upload to own folder under avatars" :
 *  (storage.foldername(name))[1] = auth.uid()::text).
 *
 * Aucune compression / aucun resize — parité avec les sites d'upload
 * existants (coach + onboarding).
 *
 * Renvoie une URL `/object/public/...` propre (jamais `/sign/`), donc
 * compatible avec la contrainte CHECK athletes.photo_url_not_signed.
 *
 * @throws si non authentifié OU si l'upload storage échoue. Les appelants
 *         DOIVENT rendre cette erreur visible (pas de faux succès silencieux).
 */
export async function uploadAvatar(file: File): Promise<string> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié");
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${user.id}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}
