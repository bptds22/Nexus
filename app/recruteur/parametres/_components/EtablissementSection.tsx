"use client";

import Link from "next/link";
import type { RecruiterSettings } from "@/lib/types/models";
import { MESSAGE_CHANGEMENT_RATTACHEMENT } from "@/lib/recruteur/parametres";

/* ─────────────────────────────────────────────────────────────────
   EtablissementSection — cégep, sport, titre, division : tout en lecture seule

   Cégep et sport en LECTURE SEULE après l'onboarding (risque 2, décision
   BP 2026-10-01) : ils définissent l'unité (cégep × sport) et l'accès au
   tableau blanc de l'unité. La base refuse tout changement fait par le
   recruteur lui-même (policy `users update own` +
   recruteur_rattachement_inchange) ; seul l'admin plateforme les change,
   par changer_rattachement_recruteur.
───────────────────────────────────────────────────────────────── */

const labelCls = "block text-[12px] font-bold tracking-[0.25em] uppercase text-[#6B7280] mb-1.5";
const lectureSeuleCls = "w-full bg-[#13151a]/60 border border-[#2a2d36] rounded-lg px-4 py-2.5 text-[14px] text-[#9CA3AF]";

interface Props {
  form: RecruiterSettings;
  /** Nom affiché du cégep (lecture seule). */
  cegepNom: string;
}

/* Titre et division ne se modifient qu'à UN endroit : Mon profil (BP 2026-10-01).
   Avant, Paramètres offrait un titre libre et des cases de division sans effet,
   Mon profil une liste de titres et une division unique. */
export default function EtablissementSection({ form, cegepNom }: Props) {
  const division = form.divisions[0] ? form.divisions[0].replace("D", "Division ") : "";
  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-head text-xl font-black text-white uppercase tracking-tight">Mon établissement</h2>
        <p className="text-[14px] text-[#6b7280] mt-1">Ton cégep et ton sport définissent ton unité de recrutement.</p>
      </div>

      <div className="space-y-5 max-w-2xl">
        <div>
          <span className={labelCls}>CÉGEP</span>
          <p className={lectureSeuleCls} data-testid="cegep-lecture-seule">{cegepNom || "—"}</p>
        </div>

        <div>
          <span className={labelCls}>Sport recruté</span>
          <div className="flex flex-wrap gap-2" data-testid="sport-lecture-seule">
            {form.sportIds.length > 0
              ? form.sportIds.map((s) => (
                  <span key={s} className="inline-flex items-center px-3 py-1.5 rounded-full bg-white/[0.06] text-[#e0e0e0] text-[13px] font-bold border border-white/10">{s}</span>
                ))
              : <span className="text-[14px] text-[#6b7280]">—</span>}
          </div>
        </div>

        <div className="bg-white/[0.03] border-l-[3px] border-[#6B7280] rounded-r-lg px-4 py-3" data-testid="message-changement-rattachement">
          <p className="text-[13px] text-[#9CA3AF] leading-relaxed">
            <span className="text-[#e0e0e0]">{MESSAGE_CHANGEMENT_RATTACHEMENT}</span>.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <span className={labelCls}>Titre</span>
            <p className={lectureSeuleCls} data-testid="titre-lecture-seule">{form.roleTitle || "—"}</p>
          </div>
          <div>
            <span className={labelCls}>Division</span>
            <p className={lectureSeuleCls} data-testid="division-lecture-seule">{division || "—"}</p>
          </div>
        </div>
        <Link href="/recruteur/profil" className="inline-block text-[13px] font-bold text-[#E63946] hover:text-white transition-colors" data-testid="lien-mon-profil">
          Modifier le titre et la division dans Mon profil →
        </Link>
      </div>
    </div>
  );
}
