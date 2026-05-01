import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

/* ═══════════════════════════════════════════════════════════════
   /partenaire/athletes — listing of partner-eligible athletes
   Reads top_athletes_view (already filters via the eligibility
   helper). Simple grid of athlete cards linking to the
   per-athlete profile page where downloads happen.
═══════════════════════════════════════════════════════════════ */

type AthleteRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  cote_globale_entraineur: number | null;
  annee_diplomation: number | null;
  region: string | null;
  photo_url: string | null;
  sport_name: string | null;
  position_name: string | null;
  school_name: string | null;
};

function StarRow({ rating }: { rating: number | null }) {
  const r = Math.round(rating ?? 0);
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width="11" height="11" viewBox="0 0 24 24" fill={i <= r ? "#F59E0B" : "#374151"} stroke="none">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </div>
  );
}

export default async function PartnerAthletesPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("top_athletes_view")
    .select("*")
    .limit(100);

  if (error) {
    console.error("[partenaire/athletes] load:", error);
  }
  const athletes: AthleteRow[] = (data ?? []) as unknown as AthleteRow[];

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1200px] mx-auto space-y-6">
      <div>
        <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">Athlètes</h1>
        <p className="text-[14px] text-[#9CA3AF] mt-1">
          {athletes.length} athlète{athletes.length === 1 ? "" : "s"} disponible{athletes.length === 1 ? "" : "s"} pour publication
        </p>
      </div>

      {athletes.length === 0 ? (
        <div className="bg-[#1A1D24] border border-[#2D3748] rounded-xl p-10 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#1A1D24] border border-[#2D3748] mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
            </svg>
          </div>
          <p className="text-[13px] text-[#9CA3AF] font-semibold">Aucun athlète disponible pour le moment.</p>
          <p className="text-[12px] text-[#6b7280] mt-1.5">
            Les athlètes apparaissent ici une fois qu&apos;ils ont activé leur visibilité publique et obtenu une cote-coach.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {athletes.map((a) => {
            const name = `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim();
            const initials = name.split(/\s+/).map((n) => n[0]).slice(0, 2).join("").toUpperCase() || "?";
            return (
              <Link
                key={a.id}
                href={`/partenaire/athletes/${a.id}`}
                className="bg-[#1A1D24] rounded-xl border border-[#2D3748] hover:border-[#E63946]/30 hover:shadow-[0_0_24px_rgba(230,57,70,0.10)] transition-all duration-300 overflow-hidden group flex flex-col"
              >
                <div className="relative h-[180px] bg-[#2F3440] overflow-hidden">
                  {a.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.photo_url} alt={name} className="w-full h-full object-cover object-[center_15%]" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-[40px] font-head font-black text-white/10">{initials}</span>
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 h-1/2" style={{ background: "linear-gradient(to top, rgba(26,29,36,0.95), transparent)" }} />
                  <div className="absolute top-3 right-3 z-10 flex items-center gap-0.5 bg-black/70 backdrop-blur-md rounded-full px-2.5 py-1.5">
                    <StarRow rating={a.cote_globale_entraineur} />
                    <span className="text-[11px] font-bold text-[#F59E0B] ml-1.5">{(a.cote_globale_entraineur ?? 0).toFixed(1)}</span>
                  </div>
                </div>

                <div className="p-4 flex flex-col flex-1 gap-1">
                  <p className="text-[15px] font-bold text-white group-hover:text-[#E63946] transition-colors">{name}</p>
                  <p className="text-[12px] text-[#9CA3AF] truncate">
                    {[a.sport_name, a.position_name].filter(Boolean).join(" · ") || "—"}
                  </p>
                  <p className="text-[11px] text-[#6b7280] truncate">
                    {a.school_name || "—"}{a.region ? ` · ${a.region}` : ""}
                  </p>
                  {a.annee_diplomation && (
                    <p className="text-[11px] font-bold text-[#E63946] mt-1">Promotion {a.annee_diplomation}</p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
