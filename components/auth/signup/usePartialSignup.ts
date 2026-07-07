"use client";

/* ═══════════════════════════════════════════════════════════════
   usePartialSignup — state machine du signup web unifié (Option A).

   Calqué sur le flow natif SignupMobile.tsx (référence prod iOS) :
     Écran 0 Role picker → 1 Compte → 2 Identité(+consents) → 3 Parental.
   Coach/recruteur : 0→1→2→submit. Athlète majeur : 0→1→2→submit.
   Athlète mineur : 0→1→2→3→submit.

   Le hook porte UNIQUEMENT l'état + la validation + la navigation, et
   expose buildSignupArgs() (role/context/metadata prêts pour signUp()).
   Il NE fait aucun appel réseau / DB — l'orchestration (signUp, OAuth,
   router, toasts) reste dans la page (/auth), item 2.
═══════════════════════════════════════════════════════════════ */

import { useState, useCallback } from "react";
import { isAdult } from "@/lib/legal/ageGate";
import { buildConsentMetadata } from "@/lib/legal/persistInitialConsents";

export type SignupRole = "athlete" | "coach_school" | "coach_civil" | "recruiter";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Carte choisie → role DB + users.context (miroir ROLE_MAP web/mobile). */
export function resolveRoleContext(r: SignupRole): {
  role: "ATHLETE" | "COACH" | "RECRUTEUR";
  context?: "scolaire" | "collegial" | "ligue_civile";
} {
  switch (r) {
    case "athlete": return { role: "ATHLETE" };
    case "coach_school": return { role: "COACH", context: "scolaire" };
    case "coach_civil": return { role: "COACH", context: "ligue_civile" };
    case "recruiter": return { role: "RECRUTEUR", context: "collegial" };
  }
}

export interface SignupArgs {
  role: "ATHLETE" | "COACH" | "RECRUTEUR";
  context?: "scolaire" | "collegial" | "ligue_civile";
  firstName: string;
  lastName: string;
  /** raw_user_meta_data : consents + DOB + (ligue_name si civil). Le trigger
   *  handle_new_auth_user ignore les clés inconnues (ligue_name) → aucun
   *  changement DB requis ; l'onboarding pourra la relire pour pré-remplir. */
  metadata: Record<string, unknown>;
  /** Consents bruts pour persistInitialConsents() post-signup (app-side). */
  consents: Record<string, boolean>;
}

export function usePartialSignup(opts?: { lockedEmail?: string; initialRole?: SignupRole }) {
  const [screen, setScreen] = useState<0 | 1 | 2 | 3>(opts?.initialRole ? 1 : 0);
  const [pickedRole, setPickedRole] = useState<SignupRole | null>(opts?.initialRole ?? null);

  const [email, setEmail] = useState(opts?.lockedEmail ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthdate, setBirthdate] = useState("");
  // Ligue civile : nom de la ligue/club, capté conditionnellement à l'écran 2.
  const [ligueName, setLigueName] = useState("");
  // Athlète : context école/civil (D1) — users.context requis pour brancher
  // l'onboarding athlète (school path vs civil). Capté conditionnellement écran 2.
  const [athleteContext, setAthleteContext] = useState<"school" | "civil" | null>(null);

  const [consentPolicy, setConsentPolicy] = useState(false);
  const [consentData, setConsentData] = useState(false);
  const [consentMarketing, setConsentMarketing] = useState(false);

  const [parentFirstName, setParentFirstName] = useState("");
  const [parentLastName, setParentLastName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentRelationship, setParentRelationship] = useState("");
  const [consentProfile, setConsentProfile] = useState(false);
  const [consentVisibility, setConsentVisibility] = useState(false);
  const [consentPartnerVisibility, setConsentPartnerVisibility] = useState(false);

  const emailValid = EMAIL_RE.test(email.trim());
  const pwdValid = password.length >= 8;
  const pwdMatches = confirmPassword.length > 0 && confirmPassword === password;
  const userIsAdult = isAdult(birthdate);
  const isAthlete = pickedRole === "athlete";
  const isCivil = pickedRole === "coach_civil";
  const parentEmailValid = EMAIL_RE.test(parentEmail.trim());

  // Écran 1 (compte) : email + pw + confirm.
  const canProceedScreen1 = emailValid && pwdValid && pwdMatches;
  // Écran 2 (identité) : prénom + nom + DOB + consents génériques (+ ligue si civil).
  const canProceedScreen2 =
    canProceedScreen1 &&
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    birthdate.length > 0 &&
    consentPolicy &&
    consentData &&
    (!isCivil || ligueName.trim().length > 0) &&
    (!isAthlete || athleteContext !== null);
  // Un athlète mineur passe par l'écran parental (3).
  const needsParentalScreen = isAthlete && birthdate.length > 0 && !userIsAdult;
  // Submit final.
  const canSubmit = needsParentalScreen
    ? canProceedScreen2 &&
      parentFirstName.trim().length > 0 &&
      parentLastName.trim().length > 0 &&
      parentEmailValid &&
      consentProfile &&
      consentVisibility
    : canProceedScreen2;

  const pickRole = useCallback((r: SignupRole) => {
    setPickedRole(r);
    setScreen(1);
  }, []);

  const next = useCallback(() => {
    setScreen((s) => {
      if (s === 0) return pickedRole ? 1 : 0;
      if (s === 1) return canProceedScreen1 ? 2 : 1;
      if (s === 2) return canProceedScreen2 && needsParentalScreen ? 3 : 2;
      return s;
    });
  }, [pickedRole, canProceedScreen1, canProceedScreen2, needsParentalScreen]);

  const back = useCallback(() => {
    setScreen((s) => (s > 0 ? ((s - 1) as 0 | 1 | 2 | 3) : 0));
  }, []);

  /** Args prêts pour signUp() — aucun write DB ici. */
  const buildSignupArgs = useCallback((): SignupArgs => {
    const rc = pickedRole ? resolveRoleContext(pickedRole) : { role: "ATHLETE" as const };
    // Athlète : context depuis le chooser écran 2 (D1). Autres rôles : context du picker.
    const context = isAthlete
      ? (athleteContext === "school" ? "scolaire" : athleteContext === "civil" ? "ligue_civile" : undefined)
      : rc.context;
    const consents = needsParentalScreen
      ? {
          policy: consentPolicy, data: consentData, marketing: consentMarketing,
          parentalProfile: consentProfile, parentalVisibility: consentVisibility,
          parentalPartnerVisibility: consentPartnerVisibility,
        }
      : { policy: consentPolicy, data: consentData, marketing: consentMarketing };
    const consentMeta = needsParentalScreen
      ? buildConsentMetadata(
          {
            policy: consentPolicy, data: consentData, marketing: consentMarketing,
            parentalProfile: consentProfile, parentalVisibility: consentVisibility,
            parentalPartnerVisibility: consentPartnerVisibility,
          },
          {
            firstName: parentFirstName.trim(), lastName: parentLastName.trim(),
            email: parentEmail.trim(), relationship: parentRelationship,
          },
        )
      : buildConsentMetadata({ policy: consentPolicy, data: consentData, marketing: consentMarketing });
    return {
      role: rc.role,
      context,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      metadata: {
        ...consentMeta,
        ...(birthdate ? { date_naissance: birthdate } : {}),
        ...(isCivil && ligueName.trim() ? { ligue_name: ligueName.trim() } : {}),
      },
      consents,
    };
  }, [
    pickedRole, needsParentalScreen, isAthlete, athleteContext, isCivil, ligueName,
    firstName, lastName, birthdate,
    consentPolicy, consentData, consentMarketing,
    consentProfile, consentVisibility, consentPartnerVisibility,
    parentFirstName, parentLastName, parentEmail, parentRelationship,
  ]);

  return {
    // état machine
    screen, setScreen, pickedRole, pickRole, next, back,
    // dérivés
    isAthlete, isCivil, userIsAdult, needsParentalScreen,
    emailValid, pwdValid, pwdMatches, parentEmailValid,
    canProceedScreen1, canProceedScreen2, canSubmit,
    // champs compte
    email, setEmail, password, setPassword, confirmPassword, setConfirmPassword,
    // champs identité
    firstName, setFirstName, lastName, setLastName, birthdate, setBirthdate,
    ligueName, setLigueName, athleteContext, setAthleteContext,
    // consents génériques
    consentPolicy, setConsentPolicy, consentData, setConsentData,
    consentMarketing, setConsentMarketing,
    // parental
    parentFirstName, setParentFirstName, parentLastName, setParentLastName,
    parentEmail, setParentEmail, parentRelationship, setParentRelationship,
    consentProfile, setConsentProfile, consentVisibility, setConsentVisibility,
    consentPartnerVisibility, setConsentPartnerVisibility,
    // export pour signUp
    buildSignupArgs,
  };
}
