"use client";

/* ═══════════════════════════════════════════════════════════════
   DetailsVisite — « Détails » d'une visite du calendrier (BP 2026-10-18).

   Affiche puis modifie : responsable (recruteur de l'unité OU nom tapé),
   format (en personne / Zoom / téléphone), adresse ou lien Zoom, note.
   Web : fenêtre centrée (thème du recruteur). Appli : feuille du bas
   native, remontée au-dessus du clavier (même idiome que ConfirmSheet).
   Règles : lib/visites/detailsVisite.ts ; données : useDetailsVisites.
═══════════════════════════════════════════════════════════════ */

import { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useKeyboardHeight } from "@/lib/hooks/useKeyboardHeight";
import { messageErreurNexus } from "@/lib/erreurs/messageErreurNexus";
import { nomAuteur, useAuteursUnite } from "@/lib/queries/recruiter/useProcessusUnite";
import { useEnregistrerDetailsVisite } from "@/lib/queries/recruiter/useDetailsVisites";
import type { VisiteUnite } from "@/lib/queries/recruiter/useCalendrierUnite";
import {
  brouillonDepuis, FORMATS_VISITE, LIBELLE_FORMAT, lienCarteAdresse, MAX_ADRESSE, MAX_LIEN,
  MAX_NOTE, MAX_RESPONSABLE, validerVisite,
  type BrouillonVisite, type DetailsVisite as Details,
} from "@/lib/visites/detailsVisite";

const AUTRE = "__autre__";

function dateVisite(iso: string): string {
  const d = new Date(iso);
  const jour = d.toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" });
  const aHeure = !(d.getHours() === 0 && d.getMinutes() === 0);
  return aHeure ? `${jour} à ${d.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}` : jour;
}

/** Le bouton « Détails » des cartes de visite (web et appli). */
export function BoutonDetailsVisite({ onClick, appli = false }: { onClick: () => void; appli?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="bouton-details-visite"
      className={appli
        ? "shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] font-semibold text-[#EDEFF3] active:bg-white/10"
        : "shrink-0 rounded-lg border border-[#262A33] px-3 py-1.5 text-[12.5px] font-semibold text-[#EDEFF3] transition-colors hover:border-[#6B7280]"}
    >
      Détails
    </button>
  );
}

function Ligne({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-2.5">
      <div className="w-[96px] shrink-0 text-[12px] font-bold uppercase tracking-[0.06em] text-[#8A909C]">{libelle}</div>
      <div className="min-w-0 flex-1 break-words text-[14px] text-[#EDEFF3]">{children}</div>
    </div>
  );
}

const champ = "w-full rounded-xl border border-[#262A33] bg-[#111317] px-3 py-2.5 text-[16px] text-[#EDEFF3] placeholder:text-[#4a4d56] focus:border-[#E63946] focus:outline-none";
const etiquette = "mb-1.5 block text-[12px] font-bold uppercase tracking-[0.06em] text-[#8A909C]";

function Contenu({ visite, details, onFermer }: { visite: VisiteUnite; details: Details | null; onFermer: () => void }) {
  const { data: auteurs } = useAuteursUnite();
  const enregistrer = useEnregistrerDetailsVisite();
  const [edition, setEdition] = useState(!details);
  const [b, setB] = useState<BrouillonVisite>(() => brouillonDepuis(details));
  const [autre, setAutre] = useState(() => !!brouillonDepuis(details).responsableNom);
  const [erreur, setErreur] = useState("");

  const liste = Object.values(auteurs ?? {}).sort((x, y) => nomAuteur(x).localeCompare(nomAuteur(y), "fr"));
  const ajoutePar = details?.modifie_par ? nomAuteur(auteurs?.[details.modifie_par]) : "";

  async function sauver() {
    setErreur("");
    const v = validerVisite(autre ? { ...b, responsableId: null } : { ...b, responsableNom: "" }, { id: visite.athleteId, prospect: visite.prospect });
    if (!v.ok) { setErreur(v.erreur); return; }
    try {
      await enregistrer.mutateAsync(v.params);
      setEdition(false);
    } catch (e) {
      setErreur(messageErreurNexus((e as { message?: string })?.message) ?? "La sauvegarde n'a pas fonctionné. Réessaie.");
    }
  }

  return (
    <div className="rounded-2xl border border-[#262A33] bg-[#1A1D24] p-5">
      <div className="mb-3 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#22C55E]">Visite</div>
          <h2 id="titre-details-visite" className="truncate text-[18px] font-bold text-[#EDEFF3]">{visite.fullName}</h2>
          <div className="text-[13px] text-[#8A909C]">{dateVisite(visite.visitAt)}</div>
        </div>
        <button type="button" onClick={onFermer} aria-label="Fermer" className="shrink-0 rounded-lg p-1.5 text-[#8A909C] hover:text-[#EDEFF3]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>

      {!edition && details ? (
        <>
          <div className="divide-y divide-white/[0.06]">
            <Ligne libelle="Responsable">{details.responsable_nom || <span className="text-[#8A909C]">Personne d&apos;indiqué</span>}</Ligne>
            <Ligne libelle="Format">{LIBELLE_FORMAT[details.format]}</Ligne>
            {details.format === "EN_PERSONNE" && (
              <Ligne libelle="Adresse">
                {details.adresse
                  ? <a href={lienCarteAdresse(details.adresse)} target="_blank" rel="noopener noreferrer" className="text-[#EDEFF3] underline underline-offset-2 hover:text-[#E63946]">{details.adresse}</a>
                  : <span className="text-[#8A909C]">Non indiquée</span>}
              </Ligne>
            )}
            {details.format === "ZOOM" && (
              <Ligne libelle="Lien">
                {details.lien
                  ? <a href={details.lien} target="_blank" rel="noopener noreferrer" className="text-[#E63946] underline underline-offset-2">Rejoindre la rencontre</a>
                  : <span className="text-[#8A909C]">Non indiqué</span>}
              </Ligne>
            )}
            {details.note && <Ligne libelle="Note"><span className="whitespace-pre-line">{details.note}</span></Ligne>}
          </div>
          {ajoutePar && <p className="mt-2 text-[12px] text-[#8A909C]">Détails ajoutés par {ajoutePar}</p>}
          <button type="button" onClick={() => setEdition(true)} className="mt-4 w-full rounded-xl bg-[#E63946] py-3 text-[15px] font-bold text-white hover:bg-[#d32f3c]">
            Modifier
          </button>
        </>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); void sauver(); }} className="space-y-4">
          <div>
            <label htmlFor="visite-responsable" className={etiquette}>Responsable</label>
            <select
              id="visite-responsable"
              className={champ}
              value={autre ? AUTRE : b.responsableId ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                if (v === AUTRE) { setAutre(true); setB({ ...b, responsableId: null }); }
                else { setAutre(false); setB({ ...b, responsableId: v || null, responsableNom: "" }); }
              }}
            >
              <option value="">Personne pour l&apos;instant</option>
              {liste.map((a) => <option key={a.id} value={a.id}>{nomAuteur(a)}</option>)}
              <option value={AUTRE}>Autre personne (pas sur Nexus)…</option>
            </select>
            {autre && (
              <input
                className={`${champ} mt-2`}
                value={b.responsableNom}
                maxLength={MAX_RESPONSABLE}
                onChange={(e) => setB({ ...b, responsableNom: e.target.value })}
                placeholder="Nom du coach, ex. Marc Tremblay"
                aria-label="Nom du responsable"
                autoFocus
              />
            )}
          </div>

          <div>
            <span className={etiquette}>Format</span>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Format">
              {FORMATS_VISITE.map((f) => (
                <button
                  key={f.valeur}
                  type="button"
                  role="radio"
                  aria-checked={b.format === f.valeur}
                  onClick={() => setB({ ...b, format: f.valeur })}
                  className={`rounded-xl border py-2.5 text-[13.5px] font-semibold transition-colors ${
                    b.format === f.valeur
                      ? "border-[#E63946] bg-[#E63946]/15 text-[#EDEFF3]"
                      : "border-[#262A33] bg-[#111317] text-[#9CA3AF]"
                  }`}
                >
                  {f.libelle}
                </button>
              ))}
            </div>
          </div>

          {b.format === "EN_PERSONNE" && (
            <div>
              <label htmlFor="visite-adresse" className={etiquette}>Adresse</label>
              <input id="visite-adresse" className={champ} value={b.adresse} maxLength={MAX_ADRESSE}
                onChange={(e) => setB({ ...b, adresse: e.target.value })} placeholder="Ex. 175 rue Principale, Granby" autoComplete="street-address" />
              <p className="mt-1 text-[12px] text-[#8A909C]">Elle suit la visite dans Google Agenda et Outlook.</p>
            </div>
          )}
          {b.format === "ZOOM" && (
            <div>
              <label htmlFor="visite-lien" className={etiquette}>Lien Zoom</label>
              <input id="visite-lien" className={champ} value={b.lien} maxLength={MAX_LIEN} inputMode="url" autoCapitalize="none" autoCorrect="off"
                onChange={(e) => setB({ ...b, lien: e.target.value })} placeholder="https://zoom.us/j/…" />
            </div>
          )}

          <div>
            <label htmlFor="visite-note" className={etiquette}>Note</label>
            <textarea id="visite-note" className={`${champ} min-h-[80px] resize-y`} value={b.note} maxLength={MAX_NOTE}
              onChange={(e) => setB({ ...b, note: e.target.value })} placeholder="Ex. avec les parents, amener le dépliant" />
            <p className="mt-1 text-right text-[11px] text-[#6B7280]">{b.note.length} / {MAX_NOTE}</p>
          </div>

          {erreur && <p role="alert" className="rounded-xl border border-[#E63946]/40 bg-[#E63946]/10 px-3 py-2 text-[13px] text-[#FCA5A5]">{erreur}</p>}

          <div className="flex gap-2">
            {details && (
              <button type="button" onClick={() => { setB(brouillonDepuis(details)); setAutre(!!brouillonDepuis(details).responsableNom); setErreur(""); setEdition(false); }}
                className="flex-1 rounded-xl border border-[#262A33] py-3 text-[15px] font-semibold text-[#EDEFF3]">
                Annuler
              </button>
            )}
            <button type="submit" disabled={enregistrer.isPending}
              className="flex-1 rounded-xl bg-[#E63946] py-3 text-[15px] font-bold text-white hover:bg-[#d32f3c] disabled:opacity-50">
              {enregistrer.isPending ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/** La fenêtre (web) ou la feuille du bas (appli). */
export function FenetreDetailsVisite({
  visite, details, onFermer, appli = false,
}: { visite: VisiteUnite; details: Details | null; onFermer: () => void; appli?: boolean }) {
  // Monté côté client (portail dans <body>) : faux au rendu serveur, vrai ensuite.
  const monte = useSyncExternalStore(() => () => {}, () => true, () => false);
  const kbdH = useKeyboardHeight();
  if (!monte) return null;

  if (appli) {
    return createPortal(
      <>
        <div className="fixed inset-0 z-[70] bg-black/60" style={{ animation: "nx-modal-fade 200ms ease-out forwards" }} onClick={onFermer} aria-hidden />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titre-details-visite"
          className="fixed bottom-0 left-0 right-0 z-[70] max-h-[92dvh] overflow-y-auto px-3"
          style={{
            paddingBottom: kbdH > 0 ? `${kbdH + 12}px` : "calc(env(safe-area-inset-bottom) + 12px)",
            animation: "nx-modal-slideup 280ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
          }}
        >
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/25" aria-hidden />
          <Contenu visite={visite} details={details} onFermer={onFermer} />
        </div>
      </>,
      document.body,
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:items-center" onClick={onFermer}>
      <div role="dialog" aria-modal="true" aria-labelledby="titre-details-visite" className="my-auto w-full max-w-[520px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <Contenu visite={visite} details={details} onFermer={onFermer} />
      </div>
    </div>,
    document.body,
  );
}
