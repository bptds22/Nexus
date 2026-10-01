"use client";

import type { RecruiterSettings } from "@/lib/types/models";

/* ─────────────────────────────────────────────────────────────────
   EtablissementSection — CÉGEP, sport, rôle, divisions

   Cégep et sport en LECTURE SEULE après l'onboarding (risque 2, décision
   BP 2026-10-01) : ils définissent l'unité (cégep × sport) et l'accès au
   tableau blanc de l'unité. La base refuse tout changement fait par le
   recruteur lui-même (policy `users update own` +
   recruteur_rattachement_inchange) ; seul l'admin plateforme les change,
   par changer_rattachement_recruteur.
───────────────────────────────────────────────────────────────── */

const labelCls = "block text-[12px] font-bold tracking-[0.25em] uppercase text-[#6B7280] mb-1.5";
const inputCls = "w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-2.5 text-[14px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors";
const lectureSeuleCls = "w-full bg-[#13151a]/60 border border-[#2a2d36] rounded-lg px-4 py-2.5 text-[14px] text-[#9CA3AF]";

export const MESSAGE_CHANGEMENT_RATTACHEMENT = "Pour changer de cégep ou de sport, écris à info@nexussports.ca";

interface Props {
  form: RecruiterSettings;
  original: RecruiterSettings;
  onUpdate: <K extends keyof RecruiterSettings>(key: K, value: RecruiterSettings[K]) => void;
  onSave: () => void;
  /** Nom affiché du cégep (lecture seule). */
  cegepNom: string;
}

export default function EtablissementSection({ form, original, onUpdate, onSave, cegepNom }: Props) {
  const dirty = form.roleTitle !== original.roleTitle ||
    JSON.stringify(form.divisions) !== JSON.stringify(original.divisions) ||
    JSON.stringify(form.programIds) !== JSON.stringify(original.programIds);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-head text-xl font-black text-white uppercase tracking-tight">Mon établissement</h2>
        <p className="text-[14px] text-[#6b7280] mt-1">Affiliation institutionnelle. Ces données définissent votre contexte dans Nexus.</p>
      </div>

      <div className="space-y-5 max-w-2xl">
        {/* CÉGEP — lecture seule */}
        <div>
          <span className={labelCls}>CÉGEP</span>
          <p className={lectureSeuleCls} data-testid="cegep-lecture-seule">{cegepNom || "—"}</p>
        </div>

        {/* Sport — lecture seule */}
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
            Ton cégep et ton sport définissent ton unité de recrutement.{" "}
            <span className="text-[#e0e0e0]">{MESSAGE_CHANGEMENT_RATTACHEMENT}</span>.
          </p>
        </div>

        {/* Role */}
        <div>
          <label className={labelCls} htmlFor="etab-role">Rôle / Titre</label>
          <input id="etab-role" type="text" value={form.roleTitle} maxLength={80}
            placeholder="Entraîneur-chef, Coordonnateur sportif..."
            onChange={(e) => onUpdate("roleTitle", e.target.value)} className={inputCls} />
        </div>

        {/* Divisions */}
        <div>
          <label className={labelCls}>Division(s) <span className="text-[#E63946]">*</span></label>
          <div className="flex items-center gap-4 mt-1">
            {(["D1", "D2", "D3"] as const).map((d) => {
              const checked = form.divisions.includes(d);
              return (
                <label key={d} className="flex items-center gap-2 cursor-pointer group">
                  <span className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border transition-colors ${checked ? "bg-[#E63946] border-[#E63946]" : "border-[#2a2d36] bg-[#13151a] group-hover:border-[#6B7280]"}`}>
                    {checked && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>}
                  </span>
                  <span className="text-[14px] text-[#e0e0e0]">{d === "D1" ? "Division 1" : d === "D2" ? "Division 2" : "Division 3"}</span>
                </label>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 pt-2">
        <button type="button" onClick={onSave} disabled={!dirty}
          className={`px-6 py-2.5 rounded-lg font-head font-bold text-[14px] uppercase tracking-widest transition-all ${
            dirty ? "bg-[#E63946] text-white hover:bg-[#D42B22] cursor-pointer" : "bg-[#333] text-[#6B7280] cursor-not-allowed"
          }`}>
          Enregistrer
        </button>
      </div>
    </div>
  );
}
