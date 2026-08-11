"use client";

/* ═══════════════════════════════════════════════════════════════
   RecruteurProfilMobile — Mon profil mobile (iter 7.39)

   Fusion desktop "Mon profil" + sections "Compte" et "Établissement"
   des Paramètres (DIAG 7.38 §A.6 : redondance supprimée). Toutes les
   colonnes DB lisent/écrivent `users` exactement comme desktop :

   - first_name, last_name, photo_url, phone
   - school_id, title, sport, division, team_name, region

   Email = auth.users.email (readonly).
   Langue : OMISE (i18n pas prêt).
   Save : UPDATE users → invalidate ["currentUser", "recruiterProfile",
   "dashboard","header"] (canon iter 5.3a).

   ⚠️ Rules of Hooks : tous les hooks AVANT early return (canon 7.8d/7.25).
═══════════════════════════════════════════════════════════════ */

import { useState, useEffect, useRef, useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { uploadImage } from "@/lib/upload/uploadImage";
import { MobilePicker, useMobilePicker } from "@/components/mobile/MobilePicker";
import { useMobileToast } from "@/components/mobile/MobileToast";
import { useRecruiterProfile } from "@/lib/queries/recruiter/useRecruiterProfile";
import { useDebouncedValue } from "@/lib/utils/useDebouncedValue";
import { triggerHaptic } from "@/lib/haptics";
import { useSheetKeyboardGeometry } from "@/lib/hooks/useSheetKeyboardGeometry";


const TITLES = [
  "Entraîneur-chef",
  "Entraîneur adjoint",
  "Coordonnateur recrutement",
  "Responsable des sports",
];

const DIVISIONS = ["Division 1", "Division 2", "Division 3"];

const SPORTS = [
  "Athlétisme", "Badminton", "Baseball", "Basketball", "Cheerleading",
  "Cross-country", "Danse", "Flag football", "Escrime", "Football",
  "Futsal", "Golf", "Gymnastique", "Hockey", "Judo", "Karaté", "Natation",
  "Rugby", "Ski alpin", "Ski de fond", "Soccer", "Softball", "Tennis",
  "Tennis de table", "Ultimate frisbee", "Volleyball", "Water-polo",
];

interface FormState {
  firstName: string;
  lastName: string;
  phone: string;
  schoolId: string;
  title: string;
  division: string;
  sport: string;
  teamName: string;
  region: string;
}

const EMPTY_FORM: FormState = {
  firstName: "", lastName: "", phone: "", schoolId: "",
  title: "", division: "", sport: "", teamName: "", region: "",
};

/* ── CEGEP search sheet (1163 écoles → search inline) ────────── */

interface CegepSearchSheetProps {
  open: boolean;
  onClose: () => void;
  currentId: string;
  onPick: (row: CegepRow) => void;
}

interface CegepRow {
  id: string;
  name: string;
  city: string | null;
  // Iter 7.40 §2 — colonnes auto-fill (schools baseline has these all)
  region: string | null;
  team_name: string | null;
  division: string | null;
}

function useCegepList() {
  return useQuery<CegepRow[]>({
    queryKey: ["schools-cegep"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("schools")
        .select("id, name, city, region, team_name, division")
        .eq("type", "CEGEP")
        .order("name");
      if (error) throw error;
      return (data ?? []) as CegepRow[];
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

function CegepSearchSheet({ open, onClose, currentId, onPick }: CegepSearchSheetProps) {
  const kbdStyle = useSheetKeyboardGeometry();
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, 150);
  const { data: cegeps = [] } = useCegepList();

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (!open) setSearch(""); }, [open]);

  const filtered = useMemo(() => {
    const strip = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const q = strip(debounced.trim());
    if (!q) return cegeps.slice(0, 50);
    return cegeps
      .filter((c) => {
        const n = strip(c.name);
        const city = strip(c.city ?? "");
        return n.includes(q) || city.includes(q);
      })
      .slice(0, 80);
  }, [cegeps, debounced]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresenceWrap open={open}>
      <div
        className="fixed inset-0 z-[70] bg-black/60"
        style={{ animation: open ? "nx-modal-fade 200ms ease-out forwards" : undefined }}
        onClick={onClose}
        aria-hidden
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-[70] bg-[#1A1D24] rounded-t-2xl flex flex-col"
        style={{
          /* CLAVIER — la classe `bottom-0` faisait remonter ce sheet via la
             règle globale de globals.css, mais SANS plafonner sa hauteur : il
             sortait par le HAUT (titre + champ hors écran) au lieu d'être
             masqué par le bas. Le hook fait les deux gestes. */
          ...kbdStyle,
          animation: open ? "nx-modal-slideup 280ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards" : undefined,
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Choisir un CÉGEP"
      >
        <div className="flex justify-center pt-3 pb-2 shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>
        <div className="px-4 pb-3 shrink-0">
          <h3 className="text-[15px] font-semibold text-white mb-3 text-center">Choisir un CÉGEP</h3>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un CÉGEP…"
            autoFocus
            className="w-full bg-[#13151a] border border-[#2a2d36] rounded-2xl px-4 py-2.5 text-[16px] text-white placeholder:text-[#6b7280] focus:outline-none focus:border-[#E63946]/50"
          />
        </div>
        <div className="overflow-y-auto flex-1">
          {filtered.length === 0 ? (
            <div className="text-center text-[13px] text-[#6b7280] py-8 px-4">
              Aucun CÉGEP trouvé pour « {search} ».
            </div>
          ) : filtered.map((c) => {
            const selected = c.id === currentId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => { triggerHaptic("Light"); onPick(c); onClose(); }}
                className="w-full flex items-center justify-between px-4 text-left active:bg-white/[0.04]"
                style={{ height: 60, borderTop: "0.5px solid rgba(255,255,255,0.06)" }}
              >
                <span className="flex flex-col min-w-0 flex-1">
                  <span className="text-[14px] font-medium text-white truncate">{c.name}</span>
                  {c.city && <span className="text-[12px] text-[#6b7280] truncate">{c.city}</span>}
                </span>
                {selected && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="ml-3 shrink-0">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </AnimatePresenceWrap>,
    document.body,
  );
}

/* AnimatePresence-style wrapper sans framer (déjà dans MorePanel ailleurs).
   Reste à null quand fermé pour libérer les listeners. */
function AnimatePresenceWrap({ children, open }: { children: ReactNode; open: boolean }) {
  const [render, setRender] = useState(open);
  useEffect(() => {
    if (open) setRender(true);
    else { const t = window.setTimeout(() => setRender(false), 260); return () => window.clearTimeout(t); }
  }, [open]);
  if (!render) return null;
  return <>{children}</>;
}

/* ── Main page ───────────────────────────────────────────────── */

export function RecruteurProfilMobile() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useMobileToast();

  // Hooks AVANT toute condition (canon 7.8d).
  const { data: profile, isLoading } = useRecruiterProfile();
  const { data: cegeps = [] } = useCegepList();

  // Iter 7.41 §1 — Track des valeurs auto-remplies par le DERNIER pick CÉGEP.
  // Au changement de CÉGEP, un champ est remplaçable si :
  //   - il est vide, OU
  //   - sa valeur courante === la valeur auto-remplie par le précédent pick
  // (signal que l'utilisateur n'a pas tapé/modifié manuellement).
  // Sinon = saisie utilisateur → on ne touche pas.
  const lastAutoFillRef = useRef<{ region: string; teamName: string; division: string }>({
    region: "", teamName: "", division: "",
  });

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [original, setOriginal] = useState<FormState>(EMPTY_FORM);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [cegepSheetOpen, setCegepSheetOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pickers (titres, division, sport)
  const titlePicker = useMobilePicker<string | null>(null);
  const divisionPicker = useMobilePicker<string | null>(null);
  const sportPicker = useMobilePicker<string | null>(null);

  // Email = auth user
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!cancelled && user?.email) setEmail(user.email);
    })();
    return () => { cancelled = true; };
  }, []);

  // Init form une fois (canon 5.3a — découplé du refetch background)
  useEffect(() => {
    if (initialized || !profile) return;
    const next: FormState = {
      firstName: profile.first_name || "",
      lastName: profile.last_name || "",
      phone: "", // pas dans useRecruiterProfile, chargé séparément ci-dessous
      schoolId: profile.school_id || "",
      title: profile.title || "",
      division: profile.division || "",
      sport: profile.sport || "",
      teamName: profile.team_name || "",
      region: profile.region || "",
    };
    setForm(next);
    setOriginal(next);
    titlePicker.setValue(next.title || null);
    divisionPicker.setValue(next.division || null);
    sportPicker.setValue(next.sport || null);
    if (profile.photo_url) setAvatarUrl(profile.photo_url);
    setInitialized(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, initialized]);

  // Iter 7.41 §1 — Seed lastAutoFillRef avec les valeurs de l'école COURANTE
  // une fois profile + cegeps chargés. Couvre le cas "j'ouvre l'app, mes
  // valeurs sont celles de mon école actuelle → je change de CÉGEP → on
  // remplace" sans avoir besoin d'avoir pické manuellement avant.
  useEffect(() => {
    if (!initialized) return;
    const school = cegeps.find((c) => c.id === form.schoolId);
    if (!school) return;
    lastAutoFillRef.current = {
      region: school.region || "",
      teamName: school.team_name || "",
      division: school.division || "",
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized, cegeps.length]);

  // Charger phone séparément (pas dans useRecruiterProfile)
  useEffect(() => {
    if (!initialized) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("users").select("phone").eq("id", user.id).single();
      if (cancelled) return;
      const phone = (data?.phone as string) || "";
      setForm((f) => ({ ...f, phone }));
      setOriginal((o) => ({ ...o, phone }));
    })();
    return () => { cancelled = true; };
  }, [initialized]);

  // Sync picker → form
  useEffect(() => {
    if (titlePicker.value !== null && titlePicker.value !== form.title) {
      setForm((f) => ({ ...f, title: String(titlePicker.value) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titlePicker.value]);
  useEffect(() => {
    if (divisionPicker.value !== null && divisionPicker.value !== form.division) {
      setForm((f) => ({ ...f, division: String(divisionPicker.value) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [divisionPicker.value]);
  useEffect(() => {
    if (sportPicker.value !== null && sportPicker.value !== form.sport) {
      setForm((f) => ({ ...f, sport: String(sportPicker.value) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sportPicker.value]);

  const dirty = useMemo(() => {
    return (
      form.firstName !== original.firstName ||
      form.lastName !== original.lastName ||
      form.phone !== original.phone ||
      form.schoolId !== original.schoolId ||
      form.title !== original.title ||
      form.division !== original.division ||
      form.sport !== original.sport ||
      form.teamName !== original.teamName ||
      form.region !== original.region
    );
  }, [form, original]);

  const schoolName = useMemo(() => {
    return cegeps.find((c) => c.id === form.schoolId)?.name || "";
  }, [cegeps, form.schoolId]);

  const initials = (form.firstName[0] || "") + (form.lastName[0] || "");
  const requiredOk = !!(form.firstName && form.lastName && form.schoolId);

  function invalidateProfileCaches() {
    queryClient.invalidateQueries({ queryKey: ["currentUser"] });
    queryClient.invalidateQueries({ queryKey: ["recruiterProfile"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard", "header"] });
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const res = await uploadImage(file, { pathBase: `${user.id}/avatar` });
      if (!res.ok) { toast.error({ message: "Échec upload", detail: res.message }); return; }
      await supabase.from("users").update({ photo_url: res.publicUrl }).eq("id", user.id);
      setAvatarUrl(res.publicUrl);
      invalidateProfileCaches();
      toast.success({ message: "Photo mise à jour" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRemoveAvatar() {
    triggerHaptic("Medium");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("users").update({ photo_url: null }).eq("id", user.id);
    setAvatarUrl(null);
    invalidateProfileCaches();
    toast.success({ message: "Photo supprimée" });
  }

  async function handleSave() {
    if (!dirty || !requiredOk || saving) return;
    triggerHaptic("Medium");
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error({ message: "Non authentifié" }); return; }
      const payload = {
        first_name: form.firstName,
        last_name: form.lastName,
        phone: form.phone || null,
        school_id: form.schoolId || null,
        title: form.title || null,
        division: form.division || null,
        sport: form.sport || null,
        team_name: form.teamName || null,
        region: form.region || null,
      };
      const { error } = await supabase.from("users").update(payload).eq("id", user.id);
      if (error) { toast.error({ message: "Échec de la sauvegarde", detail: error.message }); return; }
      setOriginal(form);
      invalidateProfileCaches();
      toast.success({ message: "Profil sauvegardé" });
    } finally {
      setSaving(false);
    }
  }

  function handleBack() {
    triggerHaptic("Light");
    router.push("/recruteur/tableau-de-bord");
  }

  if (isLoading && !initialized) {
    return (
      <div className="min-h-screen bg-[#111317] text-white pb-[calc(120px+env(safe-area-inset-bottom))] overflow-x-hidden">
        <div className="px-4 pt-10 pb-3 text-[#6b7280] text-[14px]">Chargement…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[#111317] text-white pb-[calc(120px+env(safe-area-inset-bottom))]">
      {/* Header sticky */}
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
            Mon profil
          </h1>
        </div>
      </div>

      {/* HERO photo + identité */}
      <div className="flex flex-col items-center pt-6 pb-6 px-4">
        <button
          type="button"
          onClick={() => { void triggerHaptic("Light"); fileInputRef.current?.click(); }}
          disabled={uploading}
          className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-[#2D3748] active:scale-95 transition-transform"
          aria-label="Changer la photo"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-[#E63946]/15">
              <span className="text-[28px] font-black text-[#E63946]">{initials.toUpperCase() || "?"}</span>
            </div>
          )}
          <span className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-[#E63946] border-2 border-[#111317] flex items-center justify-center">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </span>
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" title="Photo de profil" />
        <p className="mt-3 text-[18px] font-bold text-white">
          {form.firstName || "Prénom"} {form.lastName || "Nom"}
        </p>
        <p className="text-[13px] text-[#9CA3AF] mt-0.5">{form.title || "Titre non défini"}</p>
        {avatarUrl && (
          <button type="button" onClick={() => { void triggerHaptic("Medium"); handleRemoveAvatar(); }} className="mt-2 text-[12px] text-[#E63946] active:text-[#D42B22]">
            Supprimer la photo
          </button>
        )}
      </div>

      {/* IDENTITÉ */}
      <SectionLabel>Identité</SectionLabel>
      <Group>
        <TextRow label="Prénom" value={form.firstName} onChange={(v) => setForm((f) => ({ ...f, firstName: v }))} required />
        <TextRow label="Nom" value={form.lastName} onChange={(v) => setForm((f) => ({ ...f, lastName: v }))} required />
        <TextRow label="Téléphone" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} type="tel" placeholder="(514) 555-0123" />
        <ReadonlyRow label="Courriel" value={email} hint="Modifier — contactez le support" />
      </Group>

      {/* ÉTABLISSEMENT */}
      <SectionLabel>Établissement</SectionLabel>
      <Group>
        <PickerRow
          label="CÉGEP"
          value={schoolName}
          placeholder="Choisir un CÉGEP"
          onTap={() => { triggerHaptic("Light"); setCegepSheetOpen(true); }}
          required
        />
        <PickerRow
          label="Titre"
          value={form.title}
          placeholder="Choisir un titre"
          onTap={titlePicker.openPicker}
        />
        <PickerRow
          label="Division"
          value={form.division}
          placeholder="Choisir une division"
          onTap={divisionPicker.openPicker}
        />
        <PickerRow
          label="Sport"
          value={form.sport}
          placeholder="Choisir un sport"
          onTap={sportPicker.openPicker}
        />
        <TextRow label="Nom d'équipe" value={form.teamName} onChange={(v) => setForm((f) => ({ ...f, teamName: v }))} placeholder="ex : Élans" />
        <TextRow label="Région" value={form.region} onChange={(v) => setForm((f) => ({ ...f, region: v }))} placeholder="ex : Capitale-Nationale" />
      </Group>

      {/* Save bar : iter 7.40 §1 — portal vers document.body pour échapper au
          containing block trap (will-change:transform de AnimatedRoute crée un
          containing block qui avale position:fixed). Slide-up à l'apparition
          dirty=true, slide-down quand clean. */}
      <SaveBarPortal
        visible={dirty && requiredOk}
        saving={saving}
        onSave={handleSave}
      />

      {/* Pickers */}
      <MobilePicker
        open={titlePicker.open}
        onClose={titlePicker.closePicker}
        title="Titre"
        options={TITLES.map((t) => ({ value: t, label: t }))}
        value={titlePicker.value}
        onChange={titlePicker.setValue}
      />
      <MobilePicker
        open={divisionPicker.open}
        onClose={divisionPicker.closePicker}
        title="Division"
        options={DIVISIONS.map((d) => ({ value: d, label: d }))}
        value={divisionPicker.value}
        onChange={divisionPicker.setValue}
      />
      <MobilePicker
        open={sportPicker.open}
        onClose={sportPicker.closePicker}
        title="Sport"
        options={SPORTS.map((s) => ({ value: s, label: s }))}
        value={sportPicker.value}
        onChange={sportPicker.setValue}
      />
      <CegepSearchSheet
        open={cegepSheetOpen}
        onClose={() => setCegepSheetOpen(false)}
        currentId={form.schoolId}
        onPick={(row) => {
          // Iter 7.41 §1 — Remplacement intelligent : un champ est replaceable
          // s'il est vide OU si sa valeur === la valeur posée par le précédent
          // auto-fill (= signal "auto, pas saisie utilisateur"). Sinon, on
          // respecte la saisie utilisateur.
          const last = lastAutoFillRef.current;
          const newRegion = row.region || "";
          const newTeam = row.team_name || "";
          const newDivision = row.division || "";

          setForm((f) => {
            const replaceRegion = f.region === "" || f.region === last.region;
            const replaceTeam = f.teamName === "" || f.teamName === last.teamName;
            const replaceDivision = f.division === "" || f.division === last.division;
            return {
              ...f,
              schoolId: row.id,
              region: replaceRegion ? newRegion : f.region,
              teamName: replaceTeam ? newTeam : f.teamName,
              division: replaceDivision ? newDivision : f.division,
            };
          });
          // Sync picker division uniquement si on l'a remplacée (sinon on
          // toucherait à un choix utilisateur).
          if (form.division === "" || form.division === last.division) {
            divisionPicker.setValue(newDivision || null);
          }
          // Met à jour la mémoire d'auto-fill = ce que ce pick a posé.
          lastAutoFillRef.current = {
            region: newRegion,
            teamName: newTeam,
            division: newDivision,
          };
        }}
      />
      <style jsx global>{`
        @keyframes nx-modal-fade {
          0% { opacity: 0; } 100% { opacity: 1; }
        }
        @keyframes nx-modal-slideup {
          0% { transform: translateY(100%); } 100% { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

/* ── SaveBarPortal (iter 7.40 §1) ────────────────────────────── */
/* Rendue dans document.body pour ÉCHAPPER au containing block trap.
   AnimatedRoute applique will-change: transform sur le wrapper de page,
   ce qui transforme tout descendant position: fixed en "fixed relatif
   au wrapper", pas au viewport. Portal = seule sortie propre. */

function SaveBarPortal({
  visible, saving, onSave,
}: { visible: boolean; saving: boolean; onSave: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [render, setRender] = useState(visible);
  // Iter 7.42 — Écoute le signal global "nx-more-panel" émis par MobileTabBar
  // pour s'effacer (slide-down + masquage) tant que le panel Plus est ouvert.
  // Évite le double-overlay body-level et le bleed du glow rouge sous le
  // backdrop semi-transparent du panel.
  const [morePanelOpen, setMorePanelOpen] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ open?: boolean }>).detail;
      setMorePanelOpen(!!detail?.open);
    };
    window.addEventListener("nx-more-panel", handler);
    return () => window.removeEventListener("nx-more-panel", handler);
  }, []);

  // Effective visibility : dirty/valid AND no panel/overlay en cours.
  const effectiveVisible = visible && !morePanelOpen;

  useEffect(() => {
    if (effectiveVisible) setRender(true);
    else { const t = window.setTimeout(() => setRender(false), 240); return () => window.clearTimeout(t); }
  }, [effectiveVisible]);

  if (!mounted || !render) return null;
  return createPortal(
    <div
      className="fixed left-0 right-0 z-[45] px-4 pt-3 pb-3"
      style={{
        bottom: "calc(64px + env(safe-area-inset-bottom))",
        background: "linear-gradient(180deg, rgba(17,19,23,0) 0%, rgba(17,19,23,0.92) 35%, rgba(17,19,23,0.98) 100%)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        transform: effectiveVisible ? "translateY(0)" : "translateY(120%)",
        transition: "transform 240ms cubic-bezier(0.4, 0, 0.2, 1)",
        pointerEvents: "none",
      }}
    >
      <button
        type="button"
        disabled={saving}
        onClick={onSave}
        className="w-full h-12 rounded-2xl text-[15px] font-semibold bg-[#E63946] text-white active:bg-[#D42B22] shadow-[0_4px_16px_rgba(230,57,70,0.35)] disabled:opacity-60"
        style={{ pointerEvents: "auto" }}
      >
        {saving ? "Sauvegarde…" : "Sauvegarder"}
      </button>
    </div>,
    document.body,
  );
}

/* ── Building blocks (rows iOS) ──────────────────────────────── */

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-4 pt-5 pb-2">
      <span className="text-[11px] font-bold tracking-[0.18em] uppercase text-[#6b7280]">{children}</span>
    </div>
  );
}

function Group({ children }: { children: ReactNode }) {
  return (
    <div className="mx-4 rounded-2xl bg-[#1A1D24] border border-white/[0.06] overflow-hidden">
      {children}
    </div>
  );
}

function TextRow({
  label, value, onChange, placeholder, type = "text", required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="flex items-center px-4" style={{ minHeight: 52, borderTop: "0.5px solid rgba(255,255,255,0.06)" }}>
      <span className="text-[14px] text-[#9CA3AF] w-[110px] shrink-0">
        {label}{required && <span className="text-[#E63946] ml-0.5">*</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-[16px] text-white placeholder:text-[#4a4d56] focus:outline-none py-3 text-right"
      />
    </div>
  );
}

function ReadonlyRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="px-4 py-3" style={{ borderTop: "0.5px solid rgba(255,255,255,0.06)" }}>
      <div className="flex items-center">
        <span className="text-[15px] text-[#9CA3AF] w-[110px] shrink-0">{label}</span>
        <span className="flex-1 text-[16px] text-[#6b7280] text-right truncate">{value || "—"}</span>
      </div>
      {hint && <p className="text-[11px] text-[#4a4d56] mt-1 text-right">{hint}</p>}
    </div>
  );
}

function PickerRow({
  label, value, placeholder, onTap, required,
}: {
  label: string;
  value: string;
  placeholder: string;
  onTap: () => void;
  required?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onTap}
      className="w-full flex items-center px-4 text-left active:bg-white/[0.04]"
      style={{ minHeight: 52, borderTop: "0.5px solid rgba(255,255,255,0.06)" }}
    >
      <span className="text-[15px] text-[#9CA3AF] w-[110px] shrink-0">
        {label}{required && <span className="text-[#E63946] ml-0.5">*</span>}
      </span>
      <span className={`flex-1 text-[16px] truncate text-right ${value ? "text-white" : "text-[#4a4d56]"}`}>
        {value || placeholder}
      </span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-2 shrink-0">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  );
}
