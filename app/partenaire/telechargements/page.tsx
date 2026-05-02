import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

/* ═══════════════════════════════════════════════════════════════
   /partenaire/telechargements — partner's own download history
   Reads partner_card_downloads (RLS auto-restricts to current
   partner via 'Partners read own download history' policy from
   Phase 1). Most recent 50 downloads, reverse chronological.

   Three "columns" per row: Athlète (photo + name + sport),
   Format pill (Publication blue / Story purple), Date
   (relative French time). Entire row is a Link to the
   athlete profile.
═══════════════════════════════════════════════════════════════ */

type DownloadRow = {
  id: string;
  format: "publication" | "story";
  downloaded_at: string;
  athletes: {
    id: string | null;
    first_name: string | null;
    last_name: string | null;
    photo_url: string | null;
    sport_id: string | null;
    sports: { nom: string | null } | null;
  } | null;
};

const FORMAT_PILL: Record<DownloadRow["format"], { className: string; label: string }> = {
  publication: {
    className: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
    label: "Publication",
  },
  story: {
    className: "bg-purple-500/20 text-purple-400 border border-purple-500/30",
    label: "Story",
  },
};

function formatRelativeFrench(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  if (hours < 24) return `Il y a ${hours} h`;
  if (days === 1) return "Hier";
  if (days < 7) return `Il y a ${days} jours`;
  if (days < 30) return `Il y a ${Math.floor(days / 7)} semaine${Math.floor(days / 7) > 1 ? "s" : ""}`;
  return `Il y a ${Math.floor(days / 30)} mois`;
}

export default async function PartnerTelechargementsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partner_card_downloads")
    .select("id, format, downloaded_at, athletes(id, first_name, last_name, photo_url, sport_id, sports(nom))")
    .order("downloaded_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[partenaire/telechargements] load:", error);
  }
  const downloads: DownloadRow[] = (data ?? []) as unknown as DownloadRow[];

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1100px] mx-auto space-y-6">
      <div>
        <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">Téléchargements</h1>
        <p className="text-[14px] text-[#9CA3AF] mt-1">Historique des cartes téléchargées</p>
      </div>

      {downloads.length === 0 ? (
        <div className="bg-[#1A1D24] border border-[#2D3748] rounded-xl p-10 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#1A1D24] border border-[#2D3748] mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </div>
          <p className="text-[14px] text-white font-bold">Aucun téléchargement pour le moment</p>
          <p className="text-[13px] text-[#9CA3AF] mt-1.5 max-w-md mx-auto">
            Téléchargez la carte officielle d&apos;un athlète pour la publier dans vos contenus.
          </p>
          <Link
            href="/partenaire/athletes"
            className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 bg-[#E63946] hover:bg-[#D42B22] text-white text-[12px] font-bold uppercase tracking-wider rounded-lg transition-colors"
          >
            Parcourir le catalogue d&apos;athlètes
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      ) : (
        <div className="bg-[#1A1D24] border border-[#2D3748] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#2D3748]">
            <h2 className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">
              {downloads.length} téléchargement{downloads.length === 1 ? "" : "s"}
              {downloads.length === 50 && <span className="ml-2 text-[10px] text-[#6b7280] normal-case tracking-normal">(50 plus récents)</span>}
            </h2>
          </div>
          <div className="divide-y divide-[#2D3748]/40">
            {downloads.map((d) => {
              const ath = d.athletes;
              const name = ath ? `${ath.first_name ?? ""} ${ath.last_name ?? ""}`.trim() : "Athlète supprimé";
              const initials = name.split(/\s+/).map((n) => n[0]).slice(0, 2).join("").toUpperCase() || "?";
              const sportName = ath?.sports?.nom ?? null;
              const pill = FORMAT_PILL[d.format];
              const rowInner = (
                <>
                  {ath?.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ath.photo_url} alt={name} className="w-10 h-10 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[#2D3748] flex items-center justify-center text-[12px] font-bold text-white/60 shrink-0">
                      {initials}
                    </div>
                  )}

                  {/* Athlète column — name + sport */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-white truncate">{name}</p>
                    {sportName && (
                      <p className="text-[12px] text-[#9CA3AF] truncate">{sportName}</p>
                    )}
                  </div>

                  {/* Format column */}
                  <span className={`hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${pill.className}`}>
                    {pill.label}
                  </span>

                  {/* Date column */}
                  <span className="text-[11px] text-[#6b7280] tabular-nums shrink-0 sm:w-[110px] sm:text-right">
                    {formatRelativeFrench(d.downloaded_at)}
                  </span>
                </>
              );

              return ath?.id ? (
                <Link
                  key={d.id}
                  href={`/partenaire/athletes/${ath.id}`}
                  className="px-5 py-4 flex items-center gap-4 hover:bg-[#2D3748]/40 transition-colors"
                >
                  {rowInner}
                </Link>
              ) : (
                <div key={d.id} className="px-5 py-4 flex items-center gap-4">
                  {rowInner}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
