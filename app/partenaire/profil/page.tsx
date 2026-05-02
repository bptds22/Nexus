import { createClient } from "@/lib/supabase/server";

/* ═══════════════════════════════════════════════════════════════
   /partenaire/profil — read-only "Mes informations" view.

   Partners can see what Nexus has on file for their organization
   but cannot self-edit. Admin manages partner info from
   /admin/partenaires. RLS handles partner scoping (partners read
   their own row via the Phase 1 "Partners read own profile"
   policy).
═══════════════════════════════════════════════════════════════ */

type PartnerRow = {
  organization_name: string | null;
  contact_name: string | null;
  contact_email: string | null;
  logo_url: string | null;
  website_url: string | null;
  instagram_handle: string | null;
  facebook_url: string | null;
  tiktok_handle: string | null;
  description: string | null;
  status: "PENDING" | "APPROVED" | "SUSPENDED" | "REVOKED";
  approved_at: string | null;
  created_at: string;
};

const STATUS_BADGE: Record<PartnerRow["status"], { className: string; label: string }> = {
  APPROVED: {
    className: "bg-green-500/20 text-green-400 border-green-500/30",
    label: "Approuvé",
  },
  PENDING: {
    className: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    label: "En attente",
  },
  SUSPENDED: {
    className: "bg-red-500/20 text-red-400 border-red-500/30",
    label: "Suspendu",
  },
  REVOKED: {
    className: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    label: "Révoqué",
  },
};

function formatFrenchDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("fr-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(iso));
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4 py-3 border-b border-[#2D3748]/40 last:border-0">
      <span className="text-[12px] uppercase tracking-wider text-[#9CA3AF] sm:shrink-0">
        {label}
      </span>
      <div className="text-[15px] text-white sm:text-right break-words min-w-0">
        {children}
      </div>
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-[14px] text-[#6B7280] italic">{children}</span>;
}

function ExternalLinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block ml-1.5 -mt-0.5">
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block mr-1.5 -mt-0.5">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block mr-1.5 -mt-0.5">
      <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="inline-block mr-1.5 -mt-0.5">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005.8 20.1a6.34 6.34 0 0010.86-4.43V8.51a8.16 8.16 0 004.77 1.52V6.69h-1.84z" />
    </svg>
  );
}

export default async function PartnerProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: partner } = user
    ? await supabase
        .from("media_partners")
        .select(`
          organization_name,
          contact_name,
          contact_email,
          logo_url,
          website_url,
          instagram_handle,
          facebook_url,
          tiktok_handle,
          description,
          status,
          approved_at,
          created_at
        `)
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };

  if (!partner) {
    return (
      <div className="px-6 sm:px-10 py-8 max-w-[800px] mx-auto">
        <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
          Mes informations
        </h1>
        <div className="bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 mt-6">
          <p className="text-[14px] text-[#EF4444]">
            Profil introuvable. Contactez l&apos;équipe Nexus.
          </p>
        </div>
      </div>
    );
  }

  const p = partner as PartnerRow;
  const statusBadge = STATUS_BADGE[p.status];

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[800px] mx-auto space-y-6">
      <div>
        <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
          Mes informations
        </h1>
        <p className="text-[14px] text-[#9CA3AF] mt-1">
          Informations enregistrées dans Nexus pour votre organisation
        </p>
      </div>

      {/* Section 1 — Identité */}
      <section className="bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6">
        <h2 className="font-head text-[20px] font-bold text-white tracking-tight mb-2">
          Identité
        </h2>
        <div className="divide-y divide-[#2D3748]/40">
          <Row label="Organisation">
            {p.organization_name || <Muted>—</Muted>}
          </Row>
          <Row label="Personne-ressource">
            {p.contact_name || <Muted>—</Muted>}
          </Row>
          <Row label="Courriel">
            {p.contact_email || <Muted>—</Muted>}
          </Row>
          <Row label="Statut">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${statusBadge.className}`}>
              {statusBadge.label}
            </span>
          </Row>
          <Row label="Date d'approbation">
            {formatFrenchDate(p.approved_at)}
          </Row>
          <Row label="Membre depuis">
            {formatFrenchDate(p.created_at)}
          </Row>
        </div>
      </section>

      {/* Section 2 — Présence en ligne */}
      <section className="bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6">
        <h2 className="font-head text-[20px] font-bold text-white tracking-tight mb-2">
          Présence en ligne
        </h2>
        <div className="divide-y divide-[#2D3748]/40">
          <Row label="Logo">
            {p.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.logo_url}
                alt="Logo"
                className="max-w-[120px] max-h-[120px] object-contain bg-[#13151a] border border-[#2a2d36] rounded-md p-1.5"
              />
            ) : (
              <Muted>Aucun logo enregistré</Muted>
            )}
          </Row>
          <Row label="Site web">
            {p.website_url ? (
              <a
                href={p.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#E63946] hover:underline inline-flex items-center"
              >
                <span className="break-all">{p.website_url}</span>
                <ExternalLinkIcon />
              </a>
            ) : (
              "—"
            )}
          </Row>
          <Row label="Instagram">
            {p.instagram_handle ? (
              <a
                href={`https://instagram.com/${p.instagram_handle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#E63946] hover:underline inline-flex items-center"
              >
                <InstagramIcon />
                @{p.instagram_handle}
              </a>
            ) : (
              "—"
            )}
          </Row>
          <Row label="Facebook">
            {p.facebook_url ? (
              <a
                href={p.facebook_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#E63946] hover:underline inline-flex items-center"
              >
                <FacebookIcon />
                <span className="break-all">{p.facebook_url}</span>
              </a>
            ) : (
              "—"
            )}
          </Row>
          <Row label="TikTok">
            {p.tiktok_handle ? (
              <a
                href={`https://tiktok.com/@${p.tiktok_handle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#E63946] hover:underline inline-flex items-center"
              >
                <TikTokIcon />
                @{p.tiktok_handle}
              </a>
            ) : (
              "—"
            )}
          </Row>
          <Row label="Description">
            {p.description ? (
              <p className="text-[14px] text-[#9CA3AF] leading-relaxed whitespace-pre-line">
                {p.description}
              </p>
            ) : (
              <Muted>Aucune description enregistrée</Muted>
            )}
          </Row>
        </div>
      </section>

      <p className="text-[12px] text-[#6B7280] text-center pt-2">
        Pour modifier ces informations, contactez l&apos;équipe Nexus.
      </p>
    </div>
  );
}
