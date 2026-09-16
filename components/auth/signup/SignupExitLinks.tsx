import Link from "next/link";
import { COURRIEL_SUPPORT, MAILTO_SUPPORT } from "@/lib/config/contact";

/* ═══════════════════════════════════════════════════════════════
   SignupExitLinks — la porte de sortie sous un formulaire d'inscription.

   POURQUOI UN COMPOSANT, ET POURQUOI STATIQUE (2026-09-16)

   Les deux pages de réclamation (/claim, /parent/claim) n'avaient AUCUN
   lien sous leur formulaire : le bouton « Créer mon compte » était le
   dernier élément de la page. Un parent ou un athlète déjà inscrit qui
   arrivait par le courriel d'invitation n'avait littéralement nulle part
   où aller — sauf réessayer une inscription qui échouait.

   TROIS recours, du plus autonome au plus humain : se connecter, récupérer
   son mot de passe, écrire à quelqu'un. Le troisième existe parce que les
   deux premiers supposent un compte : quand le blocage vient d'ailleurs —
   invitation expirée, adresse qui ne répond à rien — ils ne mènent nulle
   part, et la page devient une impasse polie.

   ⚠ CE COMPOSANT NE PREND AUCUNE CONDITION, ET C'EST LE POINT.
   La tentation naturelle est de n'afficher « Déjà inscrit ? » QUE
   lorsqu'on a détecté que le compte existe. Ce serait un oracle
   d'énumération : la présence du lien deviendrait la réponse à
   « est-ce que cette adresse a un compte ? », exactement ce que le
   message neutre de translateAuthError existe pour empêcher. Le lien
   s'affiche donc EN PERMANENCE, pour tout le monde, avant même que le
   formulaire soit rempli.

   Si quelqu'un veut un jour le rendre conditionnel : non. Relire ce
   paragraphe. Un lien permanent ne coûte rien ; un lien conditionnel
   annule la mesure anti-énumération de toute la surface signup.

   La destination `/mot-de-passe-oublie` est la page de DEMANDE de
   réinitialisation (celle qui appelle resetPasswordForEmail), pas
   `/auth/reinitialiser` qui est l'atterrissage du lien reçu par
   courriel. Libellé aligné sur `T.login.forgot`
   (lib/i18n/dictionaries.ts:1441).
   ═══════════════════════════════════════════════════════════════ */

/** Le recours HUMAIN, isolé pour vivre aussi hors du bloc « déjà inscrit ? ».
 *
 *  L'écran « Lien invalide » de /parent/claim en a besoin SANS les deux autres
 *  liens : il disait déjà « Contactez-nous pour en recevoir un nouveau » sans
 *  donner la moindre adresse (`app/parent/claim/page.tsx:40`). Un parent dont
 *  l'invitation a expiré n'a aucun compte, aucun mot de passe à récupérer, et
 *  rien à faire de « Connecte-toi » : il lui faut un humain.
 *
 *  L'adresse vient de `lib/config/contact.ts` — une seule définition pour
 *  toute l'app, et le même identifiant sert au `href` et au texte visible,
 *  qui ne peuvent donc plus diverger.
 *
 *  Comme le reste du composant : permanent, inconditionnel. */
export function SignupContactLink({ className = "" }: { className?: string }) {
  return (
    <p className={`text-[11px] text-[#6b7280] text-center leading-snug ${className}`}>
      Toujours bloqué&nbsp;?{" "}
      <a
        href={MAILTO_SUPPORT}
        className="font-bold text-[#9CA3AF] hover:text-[#E63946] transition-colors"
      >
        Écris-nous à {COURRIEL_SUPPORT}
      </a>
    </p>
  );
}

export default function SignupExitLinks({ className = "" }: { className?: string }) {
  const lien = "font-bold text-white hover:text-[#E63946] transition-colors";
  return (
    <div className={className}>
      <p className="text-[12px] text-[#9CA3AF] text-center leading-snug">
        Déjà inscrit&nbsp;?{" "}
        <Link href="/auth" className={lien}>Connecte-toi</Link>
        <span className="mx-1.5 text-[#4a4d56]">·</span>
        <Link href="/mot-de-passe-oublie" className={lien}>Mot de passe oublié&nbsp;?</Link>
      </p>
      <SignupContactLink className="mt-1.5" />
    </div>
  );
}
