"use client";

/* ═══════════════════════════════════════════════════════════════
   Admin — badges d'un PARTENAIRE (lot W3) : créer, nommer, téléverser
   l'icône, désactiver.

   - Tout passe par admin_enregistrer_badge_partenaire (is_admin() côté
     serveur) ; l'icône va dans le bucket partner-badges, sous le dossier
     du partenaire (le serveur refuse un autre dossier). PNG transparent,
     512 px max : le bucket n'accepte que PNG et WebP (un SVG servi depuis
     le stockage pourrait porter du script).
   - Désactiver un badge le retire des fiches et du choix du partenaire,
     sans toucher les poses (le réactiver les fait réapparaître).
   - Ordre volontaire pour l'icône : upload → écriture du chemin. Le pire
     cas est un fichier orphelin, jamais une icône cassée.
═══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { uploadImage } from "@/lib/upload/uploadImage";
import {
  BUCKET_BADGES_PARTENAIRE,
  chargerBadgesAdmin,
  enregistrerBadgeAdmin,
  type BadgeAdmin,
} from "@/lib/badges/partenaire";

const CACHE_IMMUABLE = "31536000";

async function televerserIcone(partnerId: string, file: File): Promise<string> {
  const res = await uploadImage(file, {
    bucket: BUCKET_BADGES_PARTENAIRE,
    pathBase: `${partnerId}/badge-${Date.now()}`,
    preserveTransparency: true,
    maxDimension: 512,
    maxBytes: 500_000,
    cacheControl: CACHE_IMMUABLE,
  });
  if (!res.ok) throw new Error(res.message);
  return res.path;
}

function messageErreur(e: unknown): string {
  return (e as { message?: string })?.message?.replace(/^NEXUS:\s*/, "") ?? "Action impossible.";
}

export default function BadgesPartenaireAdmin({
  partnerId,
  notifier,
}: {
  partnerId: string;
  notifier: (kind: "success" | "error", message: string) => void;
}) {
  const [badges, setBadges] = useState<BadgeAdmin[]>([]);
  const [libelles, setLibelles] = useState<Record<string, string>>({});
  const [nouveau, setNouveau] = useState("");
  const [nouvelleIcone, setNouvelleIcone] = useState<File | null>(null);
  const [occupe, setOccupe] = useState(false);
  /* La page hôte passe un showToast non mémorisé : le lire par ref évite de
     relancer le chargement à chaque rendu. */
  const notifierRef = useRef(notifier);
  notifierRef.current = notifier;

  const charger = useCallback(() => {
    chargerBadgesAdmin(createClient(), partnerId)
      .then((r) => {
        setBadges(r);
        setLibelles(Object.fromEntries(r.map((b) => [b.id, b.libelle])));
      })
      .catch((e) => notifierRef.current("error", messageErreur(e)));
  }, [partnerId]);

  useEffect(() => { charger(); }, [charger]);

  const enregistrer = async (b: BadgeAdmin, patch: Partial<{ libelle: string; iconePath: string | null; actif: boolean }>) => {
    setOccupe(true);
    try {
      await enregistrerBadgeAdmin(createClient(), {
        id: b.id, partnerId,
        libelle: patch.libelle ?? b.libelle,
        iconePath: patch.iconePath !== undefined ? patch.iconePath : b.iconePath,
        actif: patch.actif ?? b.actif,
        ordre: b.ordre,
      });
      charger();
      notifier("success", "Badge enregistré.");
    } catch (e) {
      notifier("error", messageErreur(e));
    } finally {
      setOccupe(false);
    }
  };

  const creer = async () => {
    const libelle = nouveau.trim();
    if (libelle.length < 2) { notifier("error", "Le nom du badge doit avoir au moins 2 caractères."); return; }
    setOccupe(true);
    try {
      const iconePath = nouvelleIcone ? await televerserIcone(partnerId, nouvelleIcone) : null;
      await enregistrerBadgeAdmin(createClient(), {
        id: null, partnerId, libelle, iconePath, actif: true, ordre: badges.length,
      });
      setNouveau("");
      setNouvelleIcone(null);
      charger();
      notifier("success", `Badge « ${libelle} » créé.`);
    } catch (e) {
      notifier("error", messageErreur(e));
    } finally {
      setOccupe(false);
    }
  };

  return (
    <div className="sm:col-span-3 rounded-lg border-l-2 border-[#F59E0B]/40 bg-[#F59E0B]/[0.03] pl-4 py-3 space-y-3" data-admin-badges-partenaire>
      <div>
        <p className="text-[13px] font-bold text-white">Badges du partenaire</p>
        <p className="text-[11px] text-[#6B7280] mt-0.5">
          Posés par ce partenaire seulement (ou un admin), à la fin des distinctions de l&apos;athlète.
          Hors limite des 5 badges. Icône PNG ou WebP, fond transparent conseillé.
        </p>
      </div>

      {badges.length > 0 && (
        <div className="space-y-2">
          {badges.map((b) => (
            <div key={b.id} className="flex items-center gap-3 flex-wrap">
              <div className="w-10 h-10 shrink-0 flex items-center justify-center rounded-md bg-[#13151a] border border-[#2D3748]">
                {b.iconeUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.iconeUrl} alt="" className="max-w-full max-h-full object-contain" />
                ) : (
                  <span className="text-[12px] font-bold text-[#6B7280]">—</span>
                )}
              </div>
              <input
                value={libelles[b.id] ?? b.libelle}
                onChange={(e) => setLibelles((m) => ({ ...m, [b.id]: e.target.value }))}
                maxLength={40}
                aria-label="Nom du badge"
                className="bg-[#1A1D24] border border-[#2D3748] rounded-md px-2 py-1.5 text-[13px] text-white w-[200px]"
              />
              {(libelles[b.id] ?? b.libelle) !== b.libelle && (
                <button type="button" disabled={occupe} onClick={() => void enregistrer(b, { libelle: libelles[b.id] })}
                  className="text-[12px] font-bold text-[#E63946] disabled:opacity-50">Renommer</button>
              )}
              <label className="text-[12px] font-semibold text-[#9CA3AF] hover:text-white cursor-pointer">
                Changer l&apos;icône
                <input type="file" accept="image/png,image/webp" className="hidden" disabled={occupe}
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f) return;
                    try { await enregistrer(b, { iconePath: await televerserIcone(partnerId, f) }); }
                    catch (err) { notifier("error", messageErreur(err)); }
                  }} />
              </label>
              <label className="flex items-center gap-2 text-[12px] text-[#e0e0e0] cursor-pointer">
                <input type="checkbox" checked={b.actif} disabled={occupe}
                  onChange={() => void enregistrer(b, { actif: !b.actif })} className="nx-filter-checkbox" />
                Actif
              </label>
              <span className="text-[11px] text-[#6B7280]">{b.poses} posé{b.poses > 1 ? "s" : ""}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap pt-1">
        <input
          value={nouveau}
          onChange={(e) => setNouveau(e.target.value)}
          maxLength={40}
          placeholder="Nom du nouveau badge"
          className="bg-[#1A1D24] border border-[#2D3748] rounded-md px-2 py-1.5 text-[13px] text-white w-[200px]"
        />
        <label className="text-[12px] font-semibold text-[#9CA3AF] hover:text-white cursor-pointer">
          {nouvelleIcone ? nouvelleIcone.name : "Choisir une icône"}
          <input type="file" accept="image/png,image/webp" className="hidden"
            onChange={(e) => { setNouvelleIcone(e.target.files?.[0] ?? null); e.target.value = ""; }} />
        </label>
        <button type="button" disabled={occupe || nouveau.trim().length < 2} onClick={() => void creer()}
          className="px-3 py-1.5 bg-[#E63946] hover:bg-[#D42B22] text-white text-[12px] font-bold rounded-md disabled:opacity-50">
          Créer le badge
        </button>
      </div>
    </div>
  );
}
