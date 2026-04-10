"use client";

interface VideoEmbedProps {
  url: string;
  title?: string;
}

function getEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    // YouTube
    if (u.hostname.includes("youtube.com") && u.searchParams.get("v")) {
      return `https://www.youtube-nocookie.com/embed/${u.searchParams.get("v")}`;
    }
    if (u.hostname === "youtu.be") {
      return `https://www.youtube-nocookie.com/embed${u.pathname}`;
    }
    // Hudl
    if (u.hostname.includes("hudl.com") && u.pathname.includes("/video/")) {
      return url;
    }
  } catch {
    return null;
  }
  return null;
}

export default function VideoEmbed({ url, title }: VideoEmbedProps) {
  const embedUrl = getEmbedUrl(url);

  if (embedUrl && (embedUrl.includes("youtube") || embedUrl.includes("youtu.be"))) {
    return (
      <div className="relative w-full rounded-lg overflow-hidden bg-black" style={{ paddingBottom: "56.25%" }}>
        <iframe
          src={embedUrl}
          title={title || "Video"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 w-full h-full"
        />
      </div>
    );
  }

  // Fallback: external link button
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 bg-[#111317] border border-[#2D3748] rounded-lg px-5 py-4 hover:border-[#E63946]/40 transition-colors group"
    >
      <div className="w-10 h-10 rounded-full bg-[#E63946]/10 flex items-center justify-center flex-shrink-0 group-hover:bg-[#E63946]/20 transition-colors">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#E63946" stroke="none"><polygon points="8 5 19 12 8 19 8 5" /></svg>
      </div>
      <div>
        <p className="text-[13px] font-bold text-white">{title || "Voir la vidéo"}</p>
        <p className="text-[11px] text-[#6b7280] truncate max-w-[300px]">{url}</p>
      </div>
      <svg className="ml-auto text-[#6b7280]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
    </a>
  );
}
