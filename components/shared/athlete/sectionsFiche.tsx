"use client";

/* ═══════════════════════════════════════════════════════════════
   sectionsFiche — les sections « Infos » de la fiche athlète, sorties telles
   quelles d'AthleteRecruiterProfileBody (lot C0, décision BP 2026-09-24) pour
   être réutilisées par l'onglet « Infos » du panneau latéral du pipeline (C1).

   · Par défaut, le balisage est IDENTIQUE à celui de la fiche (prouvé par
     capture HTML avant / après dans ses trois usages : recruteur, aperçu
     athlète, partenaire ; en gratuit, Pro et vitrine).
   · `compact` (panneau de 420 px) ne touche QUE les grilles, qui suivent la
     largeur de l'ÉCRAN dans la fiche (sm: / lg:) : dans un panneau étroit
     sur grand écran, elles passeraient à 3 ou 4 colonnes serrées.
   · Les verrous sont passés par l'appelant, jamais recalculés ici :
     `verrouille` = lockContent de la fiche (recruteur gratuit hors vitrine),
     `estPartenaire` = viewerMode partenaire.
═══════════════════════════════════════════════════════════════ */

import type { AthleteProfileRecruiterView } from "@/lib/types/models";
import NxIcon from "@/components/ui/NxIcon";
import VideoEmbed from "@/components/ui/VideoEmbed";
import { TeamDetailsBlock, type TeamDetail } from "@/components/shared/athlete/TeamDetailsBlock";
import TeamHistoryBlock from "@/components/shared/athlete/TeamHistoryBlock";

export const sectionLabel = "font-head text-[12px] font-bold tracking-[0.15em] uppercase text-[#9CA3AF] mb-4";
export const cardBase = "bg-[#1A1D24] rounded-xl border border-[#2D3748]";
export const pillBase = "inline-flex items-center gap-1.5 text-[12px] font-bold px-3.5 py-2 rounded-full border";

export function FreeLock() {
  return (
    <div className="bg-[#1A1D24] rounded-xl border border-dashed border-white/10 px-6 py-12 flex flex-col items-center justify-center text-center">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-3">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0110 0v4" />
      </svg>
      <p className="text-[14px] text-[#9CA3AF] font-semibold mb-1">Passe à Pro pour voir</p>
      <p className="text-[13px] text-[#6B7280] max-w-md">Cette section est réservée aux recruteurs Pro.</p>
    </div>
  );
}

export function InfoRow({ label, value, icon }: { label: string; value?: string | number | null; icon?: string }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[#2D3748]/40 last:border-b-0">
      <span className="text-[13px] text-[#9CA3AF] flex items-center gap-2">
        {icon && <NxIcon name={icon} size={14} className="text-[#6B7280]" />}
        {label}
      </span>
      <span className="text-[14px] font-bold text-white">{value}</span>
    </div>
  );
}

function PreferencePill({ active, label: lbl }: { active?: boolean; label: string }) {
  if (active === undefined) return null;
  return (
    <span className={pillBase} style={{ backgroundColor: "rgba(255,255,255,0.10)", borderColor: "rgba(255,255,255,0.25)", color: "#FFFFFF" }}>
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: active ? "#22C55E" : "#6B7280" }} />
      {lbl}
    </span>
  );
}

export function SectionFaitsSaillants({ a, verrouille }: { a: AthleteProfileRecruiterView; verrouille: boolean }) {
  return (
    <>
      {/* ══════════ FAITS SAILLANTS (VIDEO) ══════════ */}
      <section>
        <h2 className={sectionLabel}>Faits saillants</h2>
        {verrouille ? (
          <FreeLock />
        ) : a.highlightVideoUrl || a.fullGameUrl ? (
          <div className="flex flex-col gap-4">
            {a.highlightVideoUrl && (
              <VideoEmbed url={a.highlightVideoUrl} title="Faits saillants" />
            )}
            {a.fullGameUrl && (
              <div>
                <p className="text-[11px] font-semibold tracking-[2px] uppercase text-[#555] mb-3">Match complet</p>
                <VideoEmbed url={a.fullGameUrl} title="Match complet" />
              </div>
            )}
          </div>
        ) : (
          <p className="text-[13px] text-[#555]">Aucune vidéo ajoutée</p>
        )}
      </section>
    </>
  );
}

export function SectionParcoursEquipes({ a, verrouille, compact = false }: { a: AthleteProfileRecruiterView; compact?: boolean; verrouille: boolean }) {
  return (
    <>
      {/* Parcours d'équipes — remonté AU-DESSUS du profil académique et
          renforcé (en-tête plus grand + accent) : le parcours sportif est
          un signal de premier plan pour le recruteur (#8). Se masque tout
          seul si aucune entrée. Anchor = vraie affiliation Nexus.

          LOT 7 — la garde `!estPartenaire` est retirée (2026-09-03). C'est de
          l'historique sportif public : quelles équipes, quelles saisons,
          quelle ligue. Aucun nom de personne, aucune prose — même nature
          que les badges et les mesures. La donnée n'arrivait PAS déjà
          (contrairement aux badges) : `parcours_equipes` a dû être ajouté
          à la RPC dans la même migration. Le bloc se masque de lui-même
          quand il n'y a ni entrée ni anchor. */}
      {/* Verrouillé au palier gratuit (décision BP 2026-09-23), comme le
          rapport, les vidéos et le profil académique. Le bloc ouvert se rend
          quasi toujours (l'anchor suffit), donc le cadenas aussi. */}
      {verrouille ? (
        <section>
          <h2 className={sectionLabel}>Parcours d&apos;équipes</h2>
          <FreeLock />
        </section>
      ) : (
      <div className={compact ? "rounded-xl border border-[#E63946]/25 bg-[#E63946]/[0.04] p-4" : "rounded-xl border border-[#E63946]/25 bg-[#E63946]/[0.04] p-4 sm:p-5"}>
        <TeamHistoryBlock
          entries={a.teamHistory}
          anchor={{
            teamName: a.isCivil ? (a.teamName || a.leagueName || "") : (a.schoolName || ""),
            sport: a.primarySport,
            position: a.primaryPosition,
            region: a.region,
          }}
          headingClassName="font-head text-[17px] sm:text-[19px] font-black tracking-tight uppercase text-white mb-4 flex items-center gap-2.5 before:content-[''] before:w-1 before:h-5 before:rounded-full before:bg-[#E63946]"
        />
      </div>
      )}
    </>
  );
}

export function SectionProfilAcademique({ a, verrouille, estPartenaire, compact = false }: { a: AthleteProfileRecruiterView; compact?: boolean; verrouille: boolean; estPartenaire: boolean }) {
  return (
    <>
      {/* ══════════ ACADEMIC PROFILE — partner mode swaps for a
          locked placeholder so the redaction reads as
          intentional rather than missing. */}
      {estPartenaire ? (
        <section>
          <h2 className={sectionLabel}>Profil académique</h2>
          <div className="bg-[#1A1D24] rounded-xl border border-dashed border-white/10 px-6 py-12 flex flex-col items-center justify-center text-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-3">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
            <p className="text-[14px] text-[#9CA3AF] font-semibold mb-1">
              Réservé aux recruteurs et coaches
            </p>
            <p className="text-[13px] text-[#6B7280] max-w-md">
              Ces informations académiques ne sont pas partagées avec les partenaires Nexus.
            </p>
          </div>
        </section>
      ) : verrouille ? (
        <section>
          <h2 className={sectionLabel}>Profil académique</h2>
          <FreeLock />
        </section>
      ) : (
        <section>
          <h2 className={sectionLabel}>Profil académique</h2>
          <div className={`${cardBase} overflow-hidden`}>
            <div className={compact ? "grid grid-cols-1 divide-y divide-[#2D3748]/50" : "grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#2D3748]/50"}>
              <div className="p-5 text-center">
                <p className="text-[28px] font-head font-black text-white leading-none">{a.gpa ? `${a.gpa}%` : "—"}</p>
                <p className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#9CA3AF] mt-2">Moyenne générale</p>
              </div>
              <div className="p-5 text-center">
                {(() => {
                  let display = "—";
                  if (a.program && typeof a.program === "string" && a.program.length > 0) {
                    display = a.program;
                  } else {
                    let arr = a.targetCegepProgram;
                    if (typeof arr === "string") { try { arr = JSON.parse(arr as unknown as string); } catch { arr = []; } }
                    if (Array.isArray(arr) && arr.length > 0) display = arr.join(", ");
                  }
                  return <p className="text-[18px] font-bold text-white leading-none mt-1">{display}</p>;
                })()}
                <p className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#9CA3AF] mt-2">Programme visé</p>
              </div>
              <div className="p-5 text-center">
                <p className="text-[18px] font-bold text-white leading-none mt-1">Juin {a.graduationYear}</p>
                <p className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#9CA3AF] mt-2">Graduation</p>
              </div>
            </div>
            <div className="border-t border-[#2D3748]/50 px-5 py-3.5 flex flex-wrap gap-2">
              <PreferencePill active={a.openToRelocate} label="Ouvert à déménager" />
              <PreferencePill active={a.openToPrivate} label="Ouvert au privé" />
              <PreferencePill active={a.openToAnglophone} label="Ouvert anglophone" />
            </div>
          </div>
        </section>
      )}
    </>
  );
}

export function SectionInfosPersonnelles({ a }: { a: AthleteProfileRecruiterView }) {
  return (
    <>
      {/* ── Personal Info ─────────────────────────────── */}
      <section className="nx-slide-section">
        <h2 className={sectionLabel}>Informations personnelles</h2>
        <div className={`${cardBase} p-5`}>
          <InfoRow label="Âge" value={`${a.age} ans`} icon="calendar" />
          <InfoRow label="Genre" value={a.gender === "M" ? "Masculin" : a.gender === "F" ? "Féminin" : "Autre"} icon="user" />
          <InfoRow label="Graduation" value={a.graduationYear} icon="gradCap" />
        </div>
      </section>
    </>
  );
}

export function SectionMesures({ a, compact = false }: { a: AthleteProfileRecruiterView; compact?: boolean }) {
  const measures: { label: string; value?: string }[] = [
    { label: "Taille", value: a.heightDisplay },
    { label: "Poids", value: a.weightDisplay },
    { label: "Envergure", value: a.wingspan },
    { label: "Main", value: a.handSize },
    { label: "Main dom.", value: a.dominantHand },
    { label: "Pied dom.", value: a.dominantFoot },
  ];
  const hasMeasures = measures.some((m) => m.value);
  return (
    <>
      {/* ── Physical Measurements ──────────────────────
          `hasMeasures` reprend l'idiome deja applique deux sections
          plus bas a `hasTests` et `hasMedia`. Sans lui, la section
          rendait un titre au-dessus d'une grille VIDE des que l'athlete
          n'a aucune mensuration — 24 des 48 fiches eligibles partenaire
          sont dans ce cas (releve prod 2026-09-03). Le mode detaille
          etant desormais ouvert au partenaire, la coquille serait
          devenue visible ; elle disparait pour les deux portails. */}
      {hasMeasures && (
      <section className="nx-slide-section">
        <h2 className={sectionLabel}>Mesures physiques</h2>
        <div className={`${cardBase} overflow-hidden`}>
          <div className={compact ? "grid grid-cols-2 divide-x divide-y divide-[#2D3748]/40" : "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 divide-x divide-y divide-[#2D3748]/40"}>
            {measures.filter(m => m.value).map((m) => (
              <div key={m.label} className="p-4 text-center">
                <p className="text-[22px] font-head font-black text-white leading-none">{m.value}</p>
                <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mt-2">{m.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      )}
    </>
  );
}

export function SectionTests({ a, compact = false }: { a: AthleteProfileRecruiterView; compact?: boolean }) {
  const tests: { label: string; value?: string }[] = [
    { label: "40 verges", value: a.fortyYard },
    { label: "Saut vertical", value: a.verticalJump },
    { label: "Saut en longueur", value: a.broadJump },
    { label: "Bench press", value: a.benchPress },
    { label: "Navette / Agilité", value: a.shuttleAgility },
    { label: "100m sprint", value: a.sprint100m },
  ];
  const hasTests = tests.some((t) => t.value);
  return (
    <>
      {/* ── Athletic Tests ───────────────────────────── */}
      {hasTests && (
        <section className="nx-slide-section">
          <h2 className={sectionLabel}>Tests athlétiques</h2>
          <div className={`${cardBase} overflow-hidden`}>
            <div className={compact ? "grid grid-cols-2 divide-x divide-y divide-[#2D3748]/40" : "grid grid-cols-2 sm:grid-cols-3 divide-x divide-y divide-[#2D3748]/40"}>
              {tests.filter((t) => t.value).map((t) => (
                <div key={t.label} className="p-4 text-center">
                  <p className="text-[22px] font-head font-black text-white leading-none">{t.value}</p>
                  <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mt-2">{t.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}

export function SectionInfosSportives({ a, estPartenaire, teamDetails }: { a: AthleteProfileRecruiterView; estPartenaire: boolean; teamDetails: TeamDetail[] }) {
  return (
    <>
      {/* ── Sport Info ───────────────────────────────── */}
      <section className="nx-slide-section">
        <h2 className={sectionLabel}>Informations sportives</h2>
        <div className={`${cardBase} p-5`}>
          <InfoRow label="Sport principal" value={a.primarySport} icon="activity" />
          <InfoRow label="Position" value={a.primaryPosition} icon="target" />
          <InfoRow label="Numéro" value={a.jerseyNumber ? `#${a.jerseyNumber}` : undefined} icon="hash" />
          {/* a.teamName / a.leagueName / a.teamLevel rows were
              civil-only via mapToRecruiterView (empty for école).
              Replaced by the generalized TeamDetailsBlock below,
              which surfaces team detail for BOTH école and civil
              from the team_athletes → teams join.

              MASQUÉ POUR LE PARTENAIRE — et c'est un masquage, pas un
              oubli. Ce bloc lit `team_athletes → teams` (division,
              saison, club), que la RPC ne projette pas ; il aurait donc
              reçu un tableau vide et affiché « Aucune équipe rattachée »
              à un partenaire regardant un athlète qui EST dans une
              équipe. Une phrase fausse est pire qu'une section absente.
              Le parcours d'équipes, lui, est ouvert (lot 7) : il porte
              l'historique, pas la fiche technique de l'équipe.
              ROUVRIR = AJOUTER team_athletes à la RPC. */}
          {!estPartenaire && <TeamDetailsBlock teams={teamDetails} />}
        </div>
      </section>
    </>
  );
}

export function SectionDetailsAcademiques({ a, estPartenaire }: { a: AthleteProfileRecruiterView; estPartenaire: boolean }) {
  return (
    <>
      {/* ── Academic Details (extended) ──────────────── */}
      {estPartenaire && (
        <section className="nx-slide-section">
          <h2 className={sectionLabel}>Détails académiques</h2>
          <div className="bg-[#1A1D24] rounded-xl border border-dashed border-white/10 px-6 py-12 flex flex-col items-center justify-center text-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-3">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
            <p className="text-[14px] text-[#9CA3AF] font-semibold mb-1">
              Réservé aux recruteurs et coaches
            </p>
            <p className="text-[13px] text-[#6B7280] max-w-md">
              Ces informations académiques ne sont pas partagées avec les partenaires Nexus.
            </p>
          </div>
        </section>
      )}
      {!estPartenaire && (a.strongSubjects?.length > 0 || a.academicHonors?.length > 0 || a.preferredRegions?.length > 0 || (Array.isArray(a.targetCegepProgram) && a.targetCegepProgram.length > 0)) && (
        <section className="nx-slide-section">
          <h2 className={sectionLabel}>Détails académiques</h2>
          <div className={`${cardBase} p-5 space-y-4`}>
            {(() => {
              let prog = a.targetCegepProgram;
              if (typeof prog === "string") { try { prog = JSON.parse(prog as unknown as string); } catch { prog = []; } }
              if (Array.isArray(prog) && prog.length > 0) {
                return (
                  <div>
                    <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mb-2">Programme CÉGEP visé</p>
                    <div className="flex flex-wrap gap-2">
                      {prog.map((p: string) => (
                        <span key={p} className="text-[12px] font-bold px-3 py-1.5 rounded-full bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/20">{p}</span>
                      ))}
                    </div>
                  </div>
                );
              }
              return null;
            })()}
            {a.strongSubjects?.length > 0 && (
              <div>
                <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mb-2">Matières fortes</p>
                <div className="flex flex-wrap gap-2">
                  {a.strongSubjects.map((s) => (
                    <span key={s} className="text-[12px] font-bold px-3 py-1.5 rounded-full bg-white/5 text-white border border-[#2D3748]">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {a.academicHonors?.length > 0 && (
              <div>
                <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mb-2">Mentions académiques</p>
                <div className="flex flex-wrap gap-2">
                  {a.academicHonors.map((h) => (
                    <span key={h} className="text-[12px] font-bold px-3 py-1.5 rounded-full bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20">{h}</span>
                  ))}
                </div>
              </div>
            )}
            {a.preferredRegions?.length > 0 && (
              <div>
                <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mb-2">Régions CÉGEP préférées</p>
                <div className="flex flex-wrap gap-2">
                  {a.preferredRegions.map((r) => (
                    <span key={r} className="text-[12px] font-bold px-3 py-1.5 rounded-full bg-white/5 text-[#c8c8cc] border border-[#2D3748]">{r}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </>
  );
}

export function SectionMediasLiens({ a, verrouille, compact = false }: { a: AthleteProfileRecruiterView; compact?: boolean; verrouille: boolean }) {
  const mediaLinks: { label: string; url?: string; iconName: string }[] = [
    { label: "Faits saillants", url: a.highlightVideoUrl, iconName: "play" },
    { label: "Match complet", url: a.fullGameUrl, iconName: "film" },
    { label: "Entraînement", url: a.practiceVideoUrl, iconName: "dumbbell" },
    { label: "Hudl", url: a.hudlUrl, iconName: "chart" },
    { label: "YouTube", url: a.youtubeUrl, iconName: "monitor" },
    { label: "Instagram", url: a.instagramUrl, iconName: "camera" },
  ];
  const hasMedia = mediaLinks.some((m) => m.url);
  return (
    <>
      {/* ── Media & Links ────────────────────────────── */}
      {/* Verrouillé au palier gratuit (décision BP 2026-09-23). Avant, la
          section n'avait AUCUN verrou : un recruteur gratuit ouvrait ici
          les vidéos que « Faits saillants » lui cadenasse, et l'Instagram
          d'un athlète dont le nom lui est masqué — ce qui le démasque.
          Cadenas seulement s'il y a des liens : pas de promesse vide. */}
      {hasMedia && verrouille && (
        <section className="nx-slide-section">
          <h2 className={sectionLabel}>Médias & liens</h2>
          <FreeLock />
        </section>
      )}
      {hasMedia && !verrouille && (
        <section className="nx-slide-section">
          <h2 className={sectionLabel}>Médias & liens</h2>
          <div className={`${cardBase} p-5`}>
            <div className={compact ? "grid grid-cols-1 gap-3" : "grid grid-cols-1 sm:grid-cols-2 gap-3"}>
              {mediaLinks.filter((m) => m.url).map((m) => (
                <a
                  key={m.label}
                  href={m.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-lg border border-[#2D3748]/50 bg-white/[0.02] hover:border-[#E63946]/40 hover:bg-[#E63946]/5 transition-all group"
                >
                  <NxIcon name={m.iconName} size={18} className="text-[#6B7280] group-hover:text-[#E63946] transition-colors" />
                  <span className="text-[14px] font-bold text-[#c8c8cc] group-hover:text-white transition-colors">{m.label}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="ml-auto text-[#6b7280] group-hover:text-[#E63946] transition-colors">
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
