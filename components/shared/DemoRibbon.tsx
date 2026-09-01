import { isShowcaseAthlete } from "@/lib/showcase";

/**
 * Ruban « PROFIL DÉMO ».
 *
 * Signale le profil vitrine — le seul profil identifié au milieu des
 * cartes anonymes pour un recruteur non payant. Le contraste est VOULU
 * (c'est le message de vente), mais il ne doit jamais laisser croire
 * qu'on peut contacter un vrai athlète : d'où le ruban, partout où le
 * profil apparaît identifié.
 *
 * Deux variantes :
 *   - `card`    : pastille compacte, posée près du nom sur une carte de liste
 *   - `profile` : bandeau explicite, en haut de la fiche complète
 *
 * Le texte de `profile` EXPLIQUE, il n'ouvre rien : aucun lien, aucun bouton,
 * aucune branche selon le palier ou l'état du recruteur. Le recruteur qui lit
 * ce bandeau vient de voir une identité en clair au milieu de cartes
 * anonymes ; il lui faut la raison du contraste, pas un appel à l'achat. La
 * raison est double et se dit dans cet ordre : l'athlète est fictif (donc
 * personne à contacter), et les vrais sont protégés parce qu'ils sont
 * MINEURS — la Loi 25 avant le prix. Y ajouter un bouton retournerait
 * l'argument : la protection deviendrait un péage.
 *
 * Palette : ambre RETENU (#F59E0B), déjà présent dans le design via les
 * étoiles de cote. Fonds et bordures à faible opacité — le ruban se lit
 * comme une NOTE, pas comme une alerte. Typo Outfit (`font-head`) comme
 * les autres éléments de titraille.
 */

const AMBRE = "#F59E0B";

export function DemoRibbon({ variant = "card", className = "" }: {
  variant?: "card" | "profile";
  className?: string;
}) {
  if (variant === "profile") {
    return (
      <div
        className={`flex items-start gap-3 rounded-xl px-4 py-3 ${className}`}
        style={{
          background: "rgba(245,158,11,0.07)",
          border: "1px solid rgba(245,158,11,0.28)",
        }}
        role="note"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={AMBRE}
             strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
             className="mt-[2px] shrink-0" aria-hidden>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" /><path d="M12 8h.01" />
        </svg>
        <div className="min-w-0">
          <p className="font-head text-[12px] font-black uppercase tracking-[0.18em]" style={{ color: AMBRE }}>
            Profil démo
          </p>
          <p className="text-[13px] text-[#9CA3AF] leading-snug mt-0.5">
            Cet athlète est fictif : il montre à quoi ressemble une fiche
            complète sur Nexus. Les vrais profils sont protégés — nos athlètes
            sont mineurs, et la Loi 25 nous oblige à ne révéler leur identité
            qu&apos;aux recruteurs vérifiés par notre équipe et abonnés Pro ou
            All&nbsp;Star.
          </p>
        </div>
      </div>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-head text-[10px] font-black uppercase tracking-[0.14em] whitespace-nowrap ${className}`}
      style={{
        background: "rgba(245,158,11,0.10)",
        border: "1px solid rgba(245,158,11,0.30)",
        color: AMBRE,
      }}
      title="Profil de démonstration — athlète fictif"
    >
      Profil démo
    </span>
  );
}

/**
 * Rend le ruban UNIQUEMENT si l'athlète est la vitrine. Évite de répéter
 * la condition sur chaque surface — et garde un seul endroit à modifier
 * quand le repli d'intérim de lib/showcase.ts sera supprimé.
 */
export function DemoRibbonIf({ athleteId, isShowcase, variant, className }: {
  athleteId: string | null | undefined;
  /** `is_showcase` projeté par la RPC. `undefined` = repli d'intérim. */
  isShowcase?: boolean | null;
  variant?: "card" | "profile";
  className?: string;
}) {
  if (!isShowcaseAthlete(athleteId, isShowcase)) return null;
  return <DemoRibbon variant={variant} className={className} />;
}
