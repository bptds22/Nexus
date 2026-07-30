"use client";

// components/team-editor/EngageesSection.tsx — S6 « Recrues déjà engagées »
// PLATEFORME : rien à saisir. Les fiches viennent des engagements réels
// (commitment_requests CONFIRMED, scope école + sport), déjà anonymisées par la
// DB pour les mineurs non consentis (Loi 25) — comptés, jamais nommés.
// Aperçu = la VRAIE section DejaEngagees.

import * as React from "react";
import DejaEngageesSection from "@/components/team-page/DejaEngageesSection";
import TeamPreviewShell from "./PreviewShell";
import { previewTeam } from "./teamBridge";
import { useTeamEditor } from "./teamEditorContext";
import { VisibilityToggle, SectionHidden } from "./SectionVisibility";

export default function EngageesSection() {
  const ctx = useTeamEditor();
  const {
    identity, initial, initialPennants, initialCamps, initialNeeds,
    positions, games, commits, assetUrl, hiddenSections,
  } = ctx;
  const hidden = hiddenSections.includes("engagees");

  const named = commits.filter((c) => c.visible_public).length;
  const anonymes = commits.length - named;

  const preview = React.useMemo(() => {
    const team = previewTeam(identity, {
      content: initial, pennants: initialPennants, camps: initialCamps,
      needs: initialNeeds, positions, games, commits, hiddenSections,
      heroUrl: assetUrl(initial.hero_image_path), coachPhotoUrl: assetUrl(initial.headcoach_photo_path),
    });
    return <DejaEngageesSection team={team} />;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, commits, hiddenSections]);

  return (
    <section className="sec">
      <div className="sech">
        <span className="num">6</span><h2>Recrues déjà engagées</h2><span className="tag plat">PLATEFORME</span>
        <VisibilityToggle sectionKey="engagees" />
      </div>
      {hidden ? <SectionHidden sectionKey="engagees" /> : (
        <div className="cols">
          <div>
            <div className="panel aff">
              <div className="pt">LES ENGAGEMENTS NEXUS — AUTOMATIQUE</div>
              <div className="auto">
                <span className="achip"><b>✓</b>Fiches : nom · position · étoiles · école de provenance · promo</span>
                <span className="achip"><b>✓</b>Engagé·e·s en <b style={{ color: "#EDEFF3" }}>{identity.sportNom.toLowerCase() || "ce sport"}</b> au {identity.schoolName}</span>
                <span className="achip"><b>✓</b>{commits.length} engagement{commits.length > 1 ? "s" : ""} confirmé{commits.length > 1 ? "s" : ""}{anonymes > 0 ? ` · ${anonymes} anonymisé${anonymes > 1 ? "s" : ""}` : ""}</span>
              </div>
              <div className="note">
                Libellé honnête : « engagé·e·s en [sport] au [collège] » — le pipeline est au niveau école, on
                n&apos;invente pas l&apos;équipe exacte. <b>Mineurs : seuls les profils consentis sont nommés</b> ;
                les autres comptent sans nom (Loi 25).
              </div>
            </div>
          </div>

          <div className="pv">
            <div className="pvhead">CE QUE L&apos;ATHLÈTE VOIT — LES VRAIES RECRUES</div>
            {named > 0
              ? <TeamPreviewShell>{preview}</TeamPreviewShell>
              : <div className="empty">Aucune recrue nommable pour l&apos;instant — la section n&apos;apparaît pas sur la page publique.</div>}
            <div className="note">
              Le compteur « ✓ X recrues déjà engagées » du widget besoins compte <b>tout le monde</b>,
              anonymes compris.
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
