"use client";

/**
 * YouTubeFacade — a click-to-load YouTube embed. Shows a lightweight
 * poster + play button first; the real <iframe> (and all YouTube JS)
 * only mounts after the user clicks → no third-party script on initial
 * page load.
 *
 * If `videoId` is empty (asset not yet delivered by BP), the facade
 * renders a "coming soon" placeholder and is not clickable.
 */

import { useState } from "react";

interface YouTubeFacadeProps {
  /** YouTube video id (the part after watch?v=). Empty = placeholder. */
  videoId?: string;
  title: string;
  /** Optional poster image; falls back to YouTube's hqdefault. */
  poster?: string;
  /** Label under the play button when no video id is set yet. */
  placeholderLabel?: string;
  className?: string;
}

export default function YouTubeFacade({
  videoId,
  title,
  poster,
  placeholderLabel,
  className = "",
}: YouTubeFacadeProps) {
  const [playing, setPlaying] = useState(false);
  const hasVideo = Boolean(videoId);
  const posterSrc = poster ?? (hasVideo ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : undefined);

  if (playing && hasVideo) {
    return (
      <div className={`relative aspect-video overflow-hidden rounded-xl bg-black ${className}`}>
        <iframe
          className="absolute inset-0 h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => hasVideo && setPlaying(true)}
      disabled={!hasVideo}
      aria-label={title}
      className={`group relative aspect-video w-full overflow-hidden rounded-xl bg-[#1A1D24] ring-1 ring-white/10 ${
        hasVideo ? "cursor-pointer" : "cursor-default"
      } ${className}`}
    >
      {posterSrc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={posterSrc}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover opacity-70 transition-opacity group-hover:opacity-90"
        />
      )}
      {!posterSrc && (
        <div className="absolute inset-0 bg-gradient-to-br from-[#1A1D24] to-[#0c0e12]" />
      )}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-wl-red text-white shadow-lg transition-transform group-hover:scale-110">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <polygon points="6 4 20 12 6 20 6 4" />
          </svg>
        </span>
        {!hasVideo && placeholderLabel && (
          <span className="px-4 text-center text-[12px] font-bold uppercase tracking-[0.18em] text-[#9CA3AF]">
            {placeholderLabel}
          </span>
        )}
      </div>
    </button>
  );
}
