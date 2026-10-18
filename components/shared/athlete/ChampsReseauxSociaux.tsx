"use client";

/* ═══════════════════════════════════════════════════════════════
   ChampsReseauxSociaux — le bloc de SAISIE « Réseaux sociaux » (web),
   décision BP 2026-10-18 : Instagram, Facebook, TikTok, LinkedIn, chacun
   avec son logo. On tape « @pseudo » ou on colle le lien : en quittant le
   champ, la valeur devient l'URL du profil (lib/liensSociaux) ; une saisie
   invalide affiche son erreur sous le champ.

   Les styles viennent de l'écran hôte (labelCls / inputCls) : le bloc
   prend l'apparence du formulaire qui le porte.
═══════════════════════════════════════════════════════════════ */

import { useState } from "react";
import PlateformeIcone from "@/components/shared/PlateformeIcone";
import { RESEAUX, normaliserReseau, type CleReseau } from "@/lib/liensSociaux";

export type ValeursReseaux = Record<CleReseau, string>;

export default function ChampsReseauxSociaux({ valeurs, onChange, labelCls, inputCls, titreCls, titre = "Réseaux sociaux" }: {
  valeurs: ValeursReseaux;
  onChange: (cle: CleReseau, valeur: string) => void;
  labelCls: string;
  inputCls: string;
  /** Classe du titre du bloc ; absent = pas de titre. */
  titreCls?: string;
  titre?: string;
}) {
  const [erreurs, setErreurs] = useState<Partial<Record<CleReseau, string>>>({});
  const valider = (cle: CleReseau) => {
    const r = normaliserReseau(cle, valeurs[cle]);
    if (r.ok) {
      setErreurs((e) => ({ ...e, [cle]: undefined }));
      if ((r.url ?? "") !== valeurs[cle]) onChange(cle, r.url ?? "");
    } else {
      setErreurs((e) => ({ ...e, [cle]: r.erreur }));
    }
  };
  return (
    <div data-testid="champs-reseaux-sociaux">
      {titreCls && <p className={titreCls}>{titre}</p>}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {RESEAUX.map((r) => (
          <div key={r.cle}>
            <label className={labelCls} htmlFor={`reseau-${r.cle}`}>
              <span className="inline-flex items-center gap-2"><PlateformeIcone cle={r.cle} size={16} />{r.libelle}</span>
            </label>
            <input
              id={`reseau-${r.cle}`}
              type="text"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={valeurs[r.cle]}
              onChange={(e) => onChange(r.cle, e.target.value)}
              onBlur={() => valider(r.cle)}
              placeholder="@tonpseudo ou lien"
              aria-invalid={!!erreurs[r.cle]}
              className={inputCls}
            />
            {erreurs[r.cle] && <p className="mt-1.5 text-[12px] text-[#F87171]" role="alert">{erreurs[r.cle]}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
