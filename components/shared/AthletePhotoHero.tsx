"use client";

/* ═══════════════════════════════════════════════════════════════
   AthletePhotoHero — bloc photo athlète partagé.

   Extrait verbatim du wizard COACH (AthleteWizardMobile, étape
   Identité) pour que l'éditeur ATHLÈTE réutilise EXACTEMENT le même
   format : carte 16:10 photo plein cadre + fade dégradé en bas,
   invite « Tape pour changer » / « Ajouter une photo », pastille
   « RETIRER », tap n'importe où = picker fichier natif (caméra iOS
   sous Capacitor).

   Présentation pure : pas d'upload ici. Le parent passe l'URL +
   l'état uploading + les handlers (onChange = upload, onRemove =
   efface). `error` optionnel rend une ligne d'erreur sous la carte
   (l'athlète l'utilise ; le coach passe rien → comportement d'avant
   inchangé, l'erreur restant gérée par son toast).
═══════════════════════════════════════════════════════════════ */

export interface AthletePhotoHeroProps {
  /** URL publique courante (vide = état "ajouter"). */
  photoUrl: string;
  /** Upload en cours → invite "Téléversement…". */
  uploading: boolean;
  /** Fichier choisi (null si annulé). */
  onChange: (file: File | null) => void;
  /** Efface la photo (RETIRER). */
  onRemove: () => void;
  /** Erreur d'upload à rendre visiblement sous la carte (optionnel). */
  error?: string | null;
}

export default function AthletePhotoHero({
  photoUrl, uploading, onChange, onRemove, error = null,
}: AthletePhotoHeroProps) {
  return (
    <div>
      {/* Photo hero — card-with-fade (mirrors the recruiter Mon processus
          / athlete card treatment : photo fills the card, a soft gradient
          fades to the card color at the bottom so the prompt text reads
          cleanly over it ; works for both filled and empty states. */}
      <div className="relative w-full aspect-[16/10] rounded-2xl overflow-hidden bg-[#1A1D24] border border-white/[0.06]">
        {photoUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </div>
        )}
        {/* Fade overlay — opaque card color at the bottom, transparent at
            ~70% up. */}
        <div
          className="absolute inset-x-0 bottom-0 h-3/5 pointer-events-none"
          style={{ background: "linear-gradient(to top, #1A1D24 0%, rgba(26,29,36,0.92) 30%, rgba(26,29,36,0.55) 55%, transparent 80%)" }}
        />
        {/* Bottom prompt + actions */}
        <div className="absolute inset-x-0 bottom-0 px-4 pb-3 pt-6 flex items-end justify-between gap-3 z-10">
          <p className="text-[13px] text-white font-semibold leading-tight">
            {uploading
              ? "Téléversement…"
              : photoUrl
                ? "Tape pour changer"
                : "Ajouter une photo · Tape pour choisir"}
          </p>
          {photoUrl && (
            <button type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(); }}
              className="px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-sm text-[10px] font-bold uppercase tracking-wider text-[#E63946] border border-[#E63946]/30 active:bg-[#E63946]/15">
              Retirer
            </button>
          )}
        </div>
        {/* Tap layer — clicking anywhere on the card opens the file
            picker. Sits above the gradient + below the Retirer button. */}
        <label className="absolute inset-0 cursor-pointer">
          <input type="file" accept="image/*" className="sr-only"
            title="Téléverser une photo"
            aria-label="Téléverser une photo"
            onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
        </label>
      </div>
      {error && <p className="mt-2 text-[12px] text-[#EF4444] px-1">{error}</p>}
    </div>
  );
}
