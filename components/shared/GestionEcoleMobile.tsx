"use client";

/* ═══════════════════════════════════════════════════════════════
   GestionEcoleMobile — teaser surface for the coach's school
   management feature set.

   Mobile rendering of /coach/ecole. Today the desktop has 6 school
   management routes (Mon école, Mes coachs, Stats école, Analytique,
   Placements, Administration) ; on mobile they were entirely hidden.
   This screen surfaces all 6 as a visible MENU.

   Per the brief : école labels for ALL coaches (no civil variant
   this build — accepted for beta).

   Access rule — l'entraîneur n'a plus de palier payant :
     sections 1-5 : ouvertes à tous
     section 6    : is_school_admin (ce n'est PAS un verrou de
                    palier — c'est un rôle, il reste en place)

   Smart tap behavior :
     - Sections 1-5 → openExternal vers l'URL web
     - Section 6 + not admin → MobileToast info (Réservé aux
       administrateurs)

   Pills :
     - "ADMIN" blue pill on 6 when the coach is not a school admin.
     - Plus de pastille "PRO" : il n'y a plus de palier à marquer.
═══════════════════════════════════════════════════════════════ */

import { useRouter } from "next/navigation";
import { useSubscription } from "@/lib/hooks/useSubscription";
import { useMobileToast } from "@/components/mobile/MobileToast";
import {
  SectionLabel, Group, NavRow,
  openExternal, triggerHaptic,
} from "@/components/shared/settings";
import { Skeleton } from "@/components/ui/Skeleton";

const WEB_BASE = "https://nexussports.ca";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

interface EntryDef {
  key: "mon_ecole" | "coachs" | "stats" | "analytique" | "placements" | "admin";
  label: string;
  sublabel: string;
  webPath: string;
  /** "pro" = sections 1-5 (Pro OR admin to access) ;
   *  "admin" = section 6 (admin only — Pro doesn't unlock). */
  gate: "pro" | "admin";
}

const ENTRIES: EntryDef[] = [
  { key: "mon_ecole",  label: "Mon école",                 sublabel: "Vue d'ensemble : roster, complétion, vues recruteurs", webPath: "/coach/ecole",            gate: "pro" },
  { key: "coachs",     label: "Mes coachs",                sublabel: "Les coachs de ton école",                              webPath: "/coach/ecole/coachs",     gate: "pro" },
  { key: "stats",      label: "Stats école",               sublabel: "Statistiques par sport, processus, CÉGEPs intéressés",  webPath: "/coach/ecole/stats",      gate: "pro" },
  { key: "analytique", label: "Analytique",                sublabel: "Vues, performance par athlète, entonnoir de recrutement", webPath: "/coach/ecole/analytics", gate: "pro" },
  { key: "placements", label: "Placements",                sublabel: "Athlètes recrutés cette saison",                       webPath: "/coach/ecole/placements", gate: "pro" },
  { key: "admin",      label: "Administration de l'école", sublabel: "Gère les directeurs et les accès",                     webPath: "/coach/settings#admin_ecole", gate: "admin" },
];

/* ── Pills ──────────────────────────────────────────────────── */

function AdminPill() {
  return (
    <span
      className="inline-flex items-center h-6 px-2.5 rounded-full text-[10px] font-black uppercase tracking-[0.12em]"
      style={{
        color: "#3B82F6",
        backgroundColor: "rgba(59,130,246,0.12)",
        border: "1px solid rgba(59,130,246,0.35)",
      }}
    >
      Admin
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN
═══════════════════════════════════════════════════════════════ */

export function GestionEcoleMobile() {
  const router = useRouter();
  const toast = useMobileToast();
  // `isSchoolAdmin` gouverne encore la section 6 — c'est un rôle,
  // pas un palier d'abonnement. Plus aucune lecture de `tier` ici.
  const { isSchoolAdmin, loading } = useSubscription();

  function handleBack() {
    triggerHaptic("Light");
    router.push("/coach/tableau-de-bord");
  }

  function handleTap(e: EntryDef) {
    triggerHaptic("Light");

    if (e.gate === "admin") {
      // Section 6 — admin only. Pro doesn't unlock it.
      if (!isSchoolAdmin) {
        toast.info({
          message: "Réservé aux administrateurs",
          detail: "Cette section est gérée par les directeurs de l'école.",
        });
        return;
      }
      if (IS_CAPACITOR) {
        toast.info({ message: "Disponible sur la version web", detail: "Cette section se gère sur nexussports.ca." });
        return;
      }
      openExternal(`${WEB_BASE}${e.webPath}`);
      return;
    }

    // Sections 1-5 — ouvertes à tous les entraîneurs.
    if (IS_CAPACITOR) {
      toast.info({ message: "Disponible sur la version web", detail: "Cette section se gère sur nexussports.ca." });
      return;
    }
    openExternal(`${WEB_BASE}${e.webPath}`);
  }

  if (loading) {
    return (
      <div className="min-h-screen w-full overflow-x-hidden bg-[#111317] text-white nx-mobile-pb-tabbar">
        {/* Sticky header shell */}
        <div className="sticky top-0 z-30 bg-[#111317]" style={{ paddingTop: "env(safe-area-inset-top)" }}>
          <div className="h-11 flex items-center px-4">
            <Skeleton className="w-32 h-5 rounded-full mx-auto" />
          </div>
        </div>
        {/* Intro bandeau */}
        <div className="px-4 pt-6 pb-2">
          <Skeleton className="w-full h-20 rounded-2xl" />
        </div>
        {/* "Vue d'ensemble" group — 5 Pro-gated rows */}
        <div className="px-4 pt-5">
          <Skeleton className="w-32 h-3 rounded-full mb-3" />
          <Skeleton className="w-full h-[280px] rounded-2xl" />
        </div>
        {/* "Administration" group — 1 row */}
        <div className="px-4 pt-5">
          <Skeleton className="w-32 h-3 rounded-full mb-3" />
          <Skeleton className="w-full h-14 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[#111317] text-white nx-mobile-pb-tabbar">
      {/* Sticky header */}
      <div className="sticky top-0 z-30 bg-[#111317]" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="h-11 flex items-center px-4">
          <button
            type="button"
            aria-label="Retour"
            onClick={handleBack}
            className="w-11 h-11 rounded-full flex items-center justify-center active:bg-white/[0.08] text-[#8a8d96]"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h1 className="flex-1 text-center font-head text-[17px] font-black text-white uppercase tracking-tight pr-9">
            Gestion d'école
          </h1>
        </div>
      </div>

      {/* Intro bandeau */}
      <div className="px-4 pt-6 pb-2">
        <div className="rounded-2xl bg-[#1A1D24] border border-white/[0.06] p-4">
          <p className="text-[13px] text-[#9CA3AF] leading-relaxed">
            Tes fonctionnalités de gestion d&apos;école se gèrent sur la version web de Nexus.
          </p>
        </div>
      </div>

      {/* Cinq entrées, ouvertes à tous */}
      <SectionLabel>Vue d&apos;ensemble</SectionLabel>
      <Group>
        {ENTRIES.filter((e) => e.gate === "pro").map((e, idx) => (
          <NavRow
            key={e.key}
            isFirst={idx === 0}
            label={e.label}
            sublabel={e.sublabel}
            rightChevron="none"
            onTap={() => handleTap(e)}
          />
        ))}
      </Group>

      {/* Admin entry (separate group — distinct gate) */}
      <SectionLabel>Administration</SectionLabel>
      <Group>
        {ENTRIES.filter((e) => e.gate === "admin").map((e) => {
          const showPill = !isSchoolAdmin;
          return (
            <NavRow
              key={e.key}
              isFirst
              label={e.label}
              sublabel={e.sublabel}
              rightChevron={isSchoolAdmin ? "none" : "chevron"}
              rightAccessory={showPill ? <AdminPill /> : undefined}
              onTap={() => handleTap(e)}
            />
          );
        })}
      </Group>

      {/* Note d'accès — l'administration reste liée au rôle. */}
      {!isSchoolAdmin && (
        <div className="px-6 pt-3 pb-6 text-[11px] text-[#6b7280] leading-5">
          <p>
            L&apos;administration de l&apos;école est réservée aux directeurs.
          </p>
        </div>
      )}

      <div className="h-8" />
    </div>
  );
}
