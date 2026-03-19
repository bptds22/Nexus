/**
 * Minimal line-art icons for the Nexus webapp.
 * Replaces emoji usage across profiles and badges.
 * All icons render as inline SVGs with consistent 1.5px stroke.
 */

interface IconProps {
  size?: number;
  className?: string;
}

function svg(
  size: number,
  className: string,
  children: React.ReactNode
) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

/* ── Trait icons ─────────────────────────────────────────── */

export function IconLeadership({ size = 18, className = "" }: IconProps) {
  return svg(size, className, (
    <>
      <path d="M12 2l2 7h7l-5.5 4 2 7L12 16l-5.5 4 2-7L3 9h7z" />
    </>
  ));
}

export function IconDiscipline({ size = 18, className = "" }: IconProps) {
  return svg(size, className, (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </>
  ));
}

export function IconCoachability({ size = 18, className = "" }: IconProps) {
  return svg(size, className, (
    <>
      <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
      <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
    </>
  ));
}

export function IconGameIQ({ size = 18, className = "" }: IconProps) {
  return svg(size, className, (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </>
  ));
}

export function IconCompetitiveness({ size = 18, className = "" }: IconProps) {
  return svg(size, className, (
    <>
      <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </>
  ));
}

export function IconTeamwork({ size = 18, className = "" }: IconProps) {
  return svg(size, className, (
    <>
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </>
  ));
}

export function IconResilience({ size = 18, className = "" }: IconProps) {
  return svg(size, className, (
    <>
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2" />
      <path d="M12 2a10 10 0 000 20" strokeDasharray="4 4" />
      <path d="M12 6v6l4 2" />
    </>
  ));
}

export function IconAttitude({ size = 18, className = "" }: IconProps) {
  return svg(size, className, (
    <>
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
    </>
  ));
}

/* ── Badge / distinction icons ───────────────────────────── */

export function IconCaptain({ size = 18, className = "" }: IconProps) {
  return svg(size, className, (
    <>
      <path d="M12 2L9 9H2l5.5 4-2 7L12 16l6.5 4-2-7L22 9h-7z" />
    </>
  ));
}

export function IconAllStar({ size = 18, className = "" }: IconProps) {
  return svg(size, className, (
    <>
      <circle cx="12" cy="8" r="6" />
      <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" />
    </>
  ));
}

export function IconTarget({ size = 18, className = "" }: IconProps) {
  return svg(size, className, (
    <>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </>
  ));
}

export function IconChart({ size = 18, className = "" }: IconProps) {
  return svg(size, className, (
    <>
      <path d="M18 20V10M12 20V4M6 20v-6" />
    </>
  ));
}

export function IconTrending({ size = 18, className = "" }: IconProps) {
  return svg(size, className, (
    <>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </>
  ));
}

export function IconShield({ size = 18, className = "" }: IconProps) {
  return svg(size, className, (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </>
  ));
}

export function IconTrophy({ size = 18, className = "" }: IconProps) {
  return svg(size, className, (
    <>
      <path d="M6 9H4a2 2 0 01-2-2V5a2 2 0 012-2h2" />
      <path d="M18 9h2a2 2 0 002-2V5a2 2 0 00-2-2h-2" />
      <path d="M6 3h12v6a6 6 0 01-12 0V3z" />
      <path d="M12 15v3" />
      <path d="M8 21h8" />
      <path d="M8 21a1 1 0 01-1-1v-1h10v1a1 1 0 01-1 1H8z" />
    </>
  ));
}

export function IconGoal({ size = 18, className = "" }: IconProps) {
  return svg(size, className, (
    <>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M12 4v16M2 12h20" />
      <path d="M2 4l10 8L2 20" />
      <path d="M22 4l-10 8 10 8" />
    </>
  ));
}

export function IconTimer({ size = 18, className = "" }: IconProps) {
  return svg(size, className, (
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2 2" />
      <path d="M12 5V3" />
      <path d="M10 1h4" />
    </>
  ));
}

/* ── Media icons ──────────────────────────────────────────── */

export function IconPlay({ size = 18, className = "" }: IconProps) {
  return svg(size, className, (
    <polygon points="5 3 19 12 5 21 5 3" />
  ));
}

export function IconFilm({ size = 18, className = "" }: IconProps) {
  return svg(size, className, (
    <>
      <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
      <path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5" />
    </>
  ));
}

export function IconDumbbell({ size = 18, className = "" }: IconProps) {
  return svg(size, className, (
    <>
      <path d="M6.5 6.5h11M5 3h2v18H5zM17 3h2v18h-2z" />
      <path d="M2 7h3v10H2zM19 7h3v10h-3z" />
    </>
  ));
}

export function IconMonitor({ size = 18, className = "" }: IconProps) {
  return svg(size, className, (
    <>
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <path d="M8 21h8M12 17v4" />
    </>
  ));
}

export function IconCamera({ size = 18, className = "" }: IconProps) {
  return svg(size, className, (
    <>
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
      <circle cx="12" cy="13" r="4" />
    </>
  ));
}

/* ── Info row icons ────────────────────────────────────────── */

export function IconCalendar({ size = 18, className = "" }: IconProps) {
  return svg(size, className, (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ));
}

export function IconUser({ size = 18, className = "" }: IconProps) {
  return svg(size, className, (
    <>
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ));
}

export function IconMapPin({ size = 18, className = "" }: IconProps) {
  return svg(size, className, (
    <>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </>
  ));
}

export function IconMap({ size = 18, className = "" }: IconProps) {
  return svg(size, className, (
    <>
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <path d="M8 2v16M16 6v16" />
    </>
  ));
}

export function IconBuilding({ size = 18, className = "" }: IconProps) {
  return svg(size, className, (
    <>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M9 22V12h6v10" />
      <path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01" />
    </>
  ));
}

export function IconGradCap({ size = 18, className = "" }: IconProps) {
  return svg(size, className, (
    <>
      <path d="M22 10l-10-5L2 10l10 5 10-5z" />
      <path d="M6 12v5c0 2 3 3 6 3s6-1 6-3v-5" />
      <path d="M22 10v6" />
    </>
  ));
}

export function IconActivity({ size = 18, className = "" }: IconProps) {
  return svg(size, className, (
    <>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </>
  ));
}

export function IconHash({ size = 18, className = "" }: IconProps) {
  return svg(size, className, (
    <>
      <path d="M4 9h16M4 15h16M10 3l-2 18M16 3l-2 18" />
    </>
  ));
}

export function IconFlag({ size = 18, className = "" }: IconProps) {
  return svg(size, className, (
    <>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <path d="M4 22V2" />
    </>
  ));
}

/* ── Problem section icons ─────────────────────────────────── */

export function IconMail({ size = 18, className = "" }: IconProps) {
  return svg(size, className, (
    <>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </>
  ));
}

export function IconEyeOff({ size = 18, className = "" }: IconProps) {
  return svg(size, className, (
    <>
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 11-4.24-4.24" />
      <path d="M1 1l22 22" />
    </>
  ));
}

export function IconFileScatter({ size = 18, className = "" }: IconProps) {
  return svg(size, className, (
    <>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M8 13h2M8 17h2M14 13h2M14 17h2" />
    </>
  ));
}

export function IconSearch({ size = 18, className = "" }: IconProps) {
  return svg(size, className, (
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </>
  ));
}

export function IconPhone({ size = 18, className = "" }: IconProps) {
  return svg(size, className, (
    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
  ));
}

export function IconClock({ size = 18, className = "" }: IconProps) {
  return svg(size, className, (
    <>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </>
  ));
}

export function IconMegaphoneOff({ size = 18, className = "" }: IconProps) {
  return svg(size, className, (
    <>
      <path d="M18.5 3L4 9h3v6l2 3h2l1-2" />
      <path d="M18.5 3v14" />
      <path d="M22 5.5a2.5 2.5 0 010 5" />
      <path d="M1 1l22 22" />
    </>
  ));
}

export function IconWallet({ size = 18, className = "" }: IconProps) {
  return svg(size, className, (
    <>
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <path d="M1 10h22" />
      <circle cx="17" cy="15" r="1" />
    </>
  ));
}

export function IconLayers({ size = 18, className = "" }: IconProps) {
  return svg(size, className, (
    <>
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </>
  ));
}

/* ── Icon map for string-based lookups ────────────────────── */

const ICON_MAP: Record<string, React.FC<IconProps>> = {
  // Traits
  leadership: IconLeadership,
  discipline: IconDiscipline,
  coachability: IconCoachability,
  gameIQ: IconGameIQ,
  competitiveness: IconCompetitiveness,
  teamwork: IconTeamwork,
  resilience: IconResilience,
  attitude: IconAttitude,
  // Badges
  captain: IconCaptain,
  allstar: IconAllStar,
  target: IconTarget,
  chart: IconChart,
  trending: IconTrending,
  shield: IconShield,
  trophy: IconTrophy,
  goal: IconGoal,
  timer: IconTimer,
  // Media
  play: IconPlay,
  film: IconFilm,
  dumbbell: IconDumbbell,
  monitor: IconMonitor,
  camera: IconCamera,
  // Info rows
  calendar: IconCalendar,
  user: IconUser,
  mapPin: IconMapPin,
  map: IconMap,
  building: IconBuilding,
  gradCap: IconGradCap,
  activity: IconActivity,
  hash: IconHash,
  flag: IconFlag,
  layers: IconLayers,
  // Problem section
  mail: IconMail,
  eyeOff: IconEyeOff,
  fileScatter: IconFileScatter,
  search: IconSearch,
  phone: IconPhone,
  clock: IconClock,
  megaphoneOff: IconMegaphoneOff,
  wallet: IconWallet,
};

/**
 * Render a named icon. Falls back to a simple dot if the name isn't found.
 * Usage: <NxIcon name="leadership" size={16} className="text-[#E63946]" />
 */
export default function NxIcon({
  name,
  size = 18,
  className = "text-[#6B7280]",
}: IconProps & { name: string }) {
  const Icon = ICON_MAP[name];
  if (!Icon) {
    return <span className={`inline-block w-2 h-2 rounded-full bg-current ${className}`} />;
  }
  return <Icon size={size} className={className} />;
}
