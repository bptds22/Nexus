'use client';

import { useEffect, useRef, useCallback } from 'react';

/* ─────────────────────────────────────────────────────────────────────
   Each tile covers the full 1440×900 viewBox.
   Different play diagrams per tile → creative variety as you scroll.
───────────────────────────────────────────────────────────────────── */

/* TILE 0 — original: Football I-Form (upper-left) · Basketball Pick-Roll (upper-right) · Hockey PP Umbrella (bottom-center) */
const tile0 = (
  <>
    <g transform="rotate(-4, 230, 390)" stroke="#7B94B0" strokeWidth="2.2" fill="none">
      <circle cx="90"  cy="390" r="20"/>
      <circle cx="140" cy="390" r="20"/>
      <circle cx="190" cy="390" r="20"/>
      <circle cx="240" cy="390" r="20"/>
      <circle cx="290" cy="390" r="20"/>
      <circle cx="370" cy="390" r="20"/>
      <circle cx="18"  cy="390" r="20"/>
      <line x1="90"  y1="370" x2="90"  y2="330"/> <line x1="68"  y1="330" x2="112" y2="330"/>
      <line x1="140" y1="370" x2="140" y2="330"/> <line x1="118" y1="330" x2="162" y2="330"/>
      <line x1="190" y1="370" x2="190" y2="330"/> <line x1="168" y1="330" x2="212" y2="330"/>
      <line x1="240" y1="370" x2="240" y2="330"/> <line x1="218" y1="330" x2="262" y2="330"/>
      <line x1="290" y1="370" x2="290" y2="330"/> <line x1="268" y1="330" x2="312" y2="330"/>
      <line x1="170" y1="418" x2="210" y2="458"/>
      <line x1="210" y1="418" x2="170" y2="458"/>
      <circle cx="190" cy="508" r="20"/>
      <circle cx="190" cy="578" r="20"/>
      <path d="M190,458 C188,490 185,534 183,576" strokeDasharray="8 6"/>
      <path d="M18,370 C16,294 -8,246 -26,268 C-44,290 -35,336 -10,342" strokeWidth="2.5" markerEnd="url(#ah)"/>
      <path d="M370,370 C368,310 320,262 240,248" strokeWidth="2.5" markerEnd="url(#ah)"/>
      <path d="M190,598 C228,630 310,640 374,632" strokeDasharray="10 7" markerEnd="url(#ah2)"/>
      <line x1="190" y1="488" x2="190" y2="436" strokeWidth="2.5" markerEnd="url(#ah2)"/>
    </g>
    <g transform="rotate(3, 1060, 360)" stroke="#7B94B0" strokeWidth="2.2" fill="none">
      <rect x="970" y="80" width="180" height="340" strokeDasharray="12 8" strokeWidth="1.8"/>
      <line x1="970" y1="250" x2="1150" y2="250" strokeDasharray="12 8" strokeWidth="1.8"/>
      <circle cx="1060" cy="94" r="14" strokeWidth="2.4"/>
      <circle cx="1060" cy="500" r="20"/>
      <circle cx="1060" cy="500" r="7" fill="#7B94B0"/>
      <circle cx="1148" cy="306" r="20"/>
      <line x1="1126" y1="290" x2="1170" y2="290" strokeWidth="3.2"/>
      <circle cx="1320" cy="468" r="20"/>
      <circle cx="810"  cy="468" r="20"/>
      <circle cx="1305" cy="610" r="20"/>
      <path d="M1068,481 C1096,434 1144,356 1128,210 C1120,156 1078,106 1062,97" strokeWidth="2.6" markerEnd="url(#ah)"/>
      <path d="M1148,286 C1134,228 1104,152 1068,100" strokeWidth="2.6" markerEnd="url(#ah)"/>
      <path d="M1320,448 C1288,408 1234,358 1180,316" strokeDasharray="10 7" markerEnd="url(#ah2)"/>
      <path d="M1042,484 C984,466 900,462 820,462" strokeDasharray="14 8" markerEnd="url(#ah2)"/>
    </g>
    <g transform="rotate(-2, 720, 760)" stroke="#7B94B0" strokeWidth="2.2" fill="none">
      <rect x="695" y="618" width="50" height="30" strokeWidth="2.6"/>
      <path d="M695,648 Q720,672 745,648" strokeDasharray="6 4" strokeWidth="1.6"/>
      <circle cx="542" cy="762" r="68" strokeDasharray="14 8" strokeWidth="1.6"/>
      <circle cx="898" cy="762" r="68" strokeDasharray="14 8" strokeWidth="1.6"/>
      <line x1="400" y1="868" x2="1040" y2="868" strokeDasharray="16 8" strokeWidth="1.8"/>
      <circle cx="462" cy="722" r="20"/>
      <circle cx="720" cy="696" r="20"/>
      <circle cx="720" cy="696" r="7" fill="#7B94B0"/>
      <circle cx="978" cy="722" r="20"/>
      <circle cx="570" cy="834" r="20"/>
      <circle cx="870" cy="834" r="20"/>
      <path d="M720,676 C720,664 720,654 720,648" strokeWidth="3" markerEnd="url(#ah)"/>
      <path d="M590,834 C720,822 848,830 850,834" strokeDasharray="12 7" markerEnd="url(#ah2)"/>
      <path d="M870,814 C840,770 790,720 730,658" strokeWidth="2.6" markerEnd="url(#ah)"/>
      <path d="M462,702 C500,676 580,660 680,650" strokeWidth="2.4" markerEnd="url(#ah2)"/>
      <path d="M978,702 C940,676 860,660 760,652" strokeDasharray="10 7" markerEnd="url(#ah2)"/>
      <path d="M570,814 C562,784 556,758 550,736" strokeWidth="2.2" markerEnd="url(#ah2)"/>
    </g>
    {/* ── Handwritten text ── */}
    <text x="500" y="120" stroke="#7B94B0" strokeWidth="1.4" fill="none" fontFamily="'Georgia', serif" fontStyle="italic" fontSize="38" opacity="0.75" letterSpacing="3" transform="rotate(-3, 500, 120)">NEXUS</text>
    <text x="1200" y="720" stroke="#7B94B0" strokeWidth="1.2" fill="none" fontFamily="'Georgia', serif" fontStyle="italic" fontSize="26" opacity="0.6" letterSpacing="2" transform="rotate(-6, 1200, 720)">Québec</text>
    <text x="580" y="220" stroke="#7B94B0" strokeWidth="1.3" fill="none" fontFamily="'Georgia', serif" fontStyle="italic" fontSize="30" opacity="0.65" letterSpacing="2" transform="rotate(3, 580, 220)">MVP</text>
    <text x="1250" y="850" stroke="#7B94B0" strokeWidth="1.2" fill="none" fontFamily="'Georgia', serif" fontStyle="italic" fontSize="22" opacity="0.6" letterSpacing="1" transform="rotate(-4, 1250, 850)">Fierté</text>
  </>
);

/* TILE 1 — Shotgun Spread (bottom-left) · Fast Break (upper-center) · D-Zone Breakout (upper-right) */
const tile1 = (
  <>
    {/* Football — Shotgun 4-Wide Spread (bottom-left) */}
    <g transform="rotate(-3, 300, 650)" stroke="#7B94B0" strokeWidth="2.2" fill="none">
      {/* OL */}
      <circle cx="210" cy="620" r="20"/> <circle cx="260" cy="620" r="20"/>
      <circle cx="310" cy="620" r="20"/> <circle cx="360" cy="620" r="20"/>
      <circle cx="410" cy="620" r="20"/>
      {/* T-bars */}
      <line x1="210" y1="600" x2="210" y2="560"/> <line x1="188" y1="560" x2="232" y2="560"/>
      <line x1="260" y1="600" x2="260" y2="560"/> <line x1="238" y1="560" x2="282" y2="560"/>
      <line x1="310" y1="600" x2="310" y2="560"/> <line x1="288" y1="560" x2="332" y2="560"/>
      <line x1="360" y1="600" x2="360" y2="560"/> <line x1="338" y1="560" x2="382" y2="560"/>
      <line x1="410" y1="600" x2="410" y2="560"/> <line x1="388" y1="560" x2="432" y2="560"/>
      {/* QB in shotgun */}
      <line x1="288" y1="648" x2="328" y2="688"/> <line x1="328" y1="648" x2="288" y2="688"/>
      {/* 4 WR spread wide */}
      <circle cx="60"  cy="620" r="20"/>
      <circle cx="130" cy="620" r="20"/>
      <circle cx="490" cy="620" r="20"/>
      <circle cx="560" cy="620" r="20"/>
      {/* RB */}
      <circle cx="308" cy="740" r="20"/>
      {/* Go routes outside */}
      <path d="M60,600 C58,530 54,466 50,420" strokeWidth="2.5" markerEnd="url(#ah)"/>
      <path d="M560,600 C562,530 566,466 570,420" strokeWidth="2.5" markerEnd="url(#ah)"/>
      {/* Crossing / in-route inner WR */}
      <path d="M130,600 C160,566 220,548 290,544" strokeDasharray="10 7" markerEnd="url(#ah2)"/>
      <path d="M490,600 C460,566 400,548 330,544" strokeDasharray="10 7" markerEnd="url(#ah2)"/>
      {/* RB screen */}
      <path d="M308,760 C348,778 400,786 450,782" strokeDasharray="8 6" markerEnd="url(#ah2)"/>
    </g>
    {/* ── Handwritten text ── */}
    <text x="960" y="560" stroke="#7B94B0" strokeWidth="1.3" fill="none" fontFamily="'Georgia', serif" fontStyle="italic" fontSize="30" opacity="0.65" letterSpacing="2" transform="rotate(-4, 960, 560)">Étudiant-Athlète</text>
    <text x="120" y="180" stroke="#7B94B0" strokeWidth="1.2" fill="none" fontFamily="'Georgia', serif" fontStyle="italic" fontSize="24" opacity="0.63" letterSpacing="2" transform="rotate(5, 120, 180)">Capitaine</text>
    <text x="700" y="460" stroke="#7B94B0" strokeWidth="1.3" fill="none" fontFamily="'Georgia', serif" fontStyle="italic" fontSize="34" opacity="0.7" letterSpacing="2" transform="rotate(-3, 700, 460)">#1</text>

    {/* Basketball — 3-on-2 Fast Break (upper-center) */}
    <g transform="rotate(2, 720, 220)" stroke="#7B94B0" strokeWidth="2.2" fill="none">
      {/* Half-court hint */}
      <line x1="540" y1="90" x2="900" y2="90" strokeDasharray="14 8" strokeWidth="1.6"/>
      {/* Basket rim */}
      <circle cx="720" cy="46" r="14" strokeWidth="2.4"/>
      {/* Ball handler with puck */}
      <circle cx="720" cy="220" r="20"/>
      <circle cx="720" cy="220" r="7" fill="#7B94B0"/>
      {/* Wings */}
      <circle cx="560" cy="160" r="20"/>
      <circle cx="880" cy="160" r="20"/>
      {/* Trailing big */}
      <circle cx="720" cy="330" r="20"/>
      {/* PG drive */}
      <path d="M720,200 C720,160 720,110 720,60" strokeWidth="2.6" markerEnd="url(#ah)"/>
      {/* Left wing fills lane */}
      <path d="M560,140 C590,100 650,62 706,52" strokeWidth="2.4" markerEnd="url(#ah)"/>
      {/* Right wing fill */}
      <path d="M880,140 C850,100 790,62 734,52" strokeDasharray="10 7" markerEnd="url(#ah2)"/>
      {/* Trailer space */}
      <path d="M720,310 C680,280 630,240 590,200" strokeDasharray="12 7" markerEnd="url(#ah2)"/>
    </g>

    {/* Hockey — D-Zone Breakout (upper-right) */}
    <g transform="rotate(2, 1200, 260)" stroke="#7B94B0" strokeWidth="2.2" fill="none">
      {/* Net */}
      <rect x="1175" y="58" width="50" height="30" strokeWidth="2.4"/>
      <path d="M1175,88 Q1200,108 1225,88" strokeDasharray="6 4" strokeWidth="1.6"/>
      {/* D-zone face-off circles */}
      <circle cx="1080" cy="220" r="55" strokeDasharray="12 8" strokeWidth="1.6"/>
      <circle cx="1320" cy="220" r="55" strokeDasharray="12 8" strokeWidth="1.6"/>
      {/* LD, RD */}
      <circle cx="1100" cy="150" r="20"/>
      <circle cx="1300" cy="150" r="20"/>
      {/* C with puck */}
      <circle cx="1200" cy="270" r="20"/>
      <circle cx="1200" cy="270" r="7" fill="#7B94B0"/>
      {/* LW, RW */}
      <circle cx="1060" cy="360" r="20"/>
      <circle cx="1340" cy="360" r="20"/>
      {/* C → LD first pass */}
      <path d="M1182,256 C1160,216 1130,178 1118,158" strokeWidth="2.4" markerEnd="url(#ah)"/>
      {/* LD breaks up left wall */}
      <path d="M1100,130 C1092,96 1086,68 1080,46" strokeWidth="2.4" markerEnd="url(#ah)"/>
      {/* RD option outlet */}
      <path d="M1300,130 C1308,96 1314,68 1320,46" strokeDasharray="10 7" markerEnd="url(#ah2)"/>
      {/* C → RD alternative */}
      <path d="M1218,258 C1248,218 1274,178 1286,158" strokeDasharray="8 6" markerEnd="url(#ah2)"/>
      {/* RW swings through middle */}
      <path d="M1340,340 C1306,306 1256,280 1220,270" strokeDasharray="10 7" markerEnd="url(#ah2)"/>
    </g>
  </>
);

/* TILE 2 — RPO / Zone Read (upper-left) · 3-on-2 Rush (center) · Motion Offense (bottom-right) */
const tile2 = (
  <>
    {/* Football — RPO / Zone Read (upper-left) */}
    <g transform="rotate(-2, 360, 190)" stroke="#7B94B0" strokeWidth="2.2" fill="none">
      {/* OL — zone-blocking angle */}
      <circle cx="280" cy="190" r="20"/> <circle cx="330" cy="190" r="20"/>
      <circle cx="380" cy="190" r="20"/> <circle cx="430" cy="190" r="20"/>
      <circle cx="480" cy="190" r="20"/>
      {/* Angled zone blocks */}
      <line x1="280" y1="170" x2="258" y2="130"/>
      <line x1="330" y1="170" x2="308" y2="130"/>
      <line x1="380" y1="170" x2="360" y2="130"/>
      <line x1="430" y1="170" x2="450" y2="130"/>
      <line x1="480" y1="170" x2="502" y2="130"/>
      {/* QB under center */}
      <line x1="358" y1="218" x2="398" y2="258"/> <line x1="398" y1="218" x2="358" y2="258"/>
      {/* RB zone carry left */}
      <circle cx="378" cy="290" r="20"/>
      <path d="M368,272 C344,244 312,218 292,200" strokeWidth="2.6" markerEnd="url(#ah)"/>
      {/* WR left motion (dashed pre-snap) */}
      <circle cx="100" cy="190" r="20"/>
      <path d="M120,190 C160,188 200,186 248,186" strokeDasharray="8 6" markerEnd="url(#ah2)"/>
      {/* WR right deep post */}
      <circle cx="640" cy="190" r="20"/>
      <path d="M638,170 C624,114 598,64 566,40" strokeWidth="2.5" markerEnd="url(#ah)"/>
      {/* TE over middle */}
      <circle cx="530" cy="190" r="20"/>
      <path d="M526,170 C514,130 494,94 460,76" strokeDasharray="10 7" markerEnd="url(#ah2)"/>
    </g>

    {/* Hockey — Odd-Man 3-on-2 Rush (center) */}
    <g transform="rotate(3, 720, 460)" stroke="#7B94B0" strokeWidth="2.2" fill="none">
      {/* Blue line */}
      <line x1="480" y1="400" x2="960" y2="400" strokeDasharray="16 8" strokeWidth="1.8"/>
      {/* Net */}
      <rect x="695" y="346" width="50" height="30" strokeWidth="2.4"/>
      <path d="M695,376 Q720,394 745,376" strokeDasharray="6 4" strokeWidth="1.6"/>
      {/* 2 Defenders back */}
      <circle cx="640" cy="440" r="20"/>
      <circle cx="800" cy="440" r="20"/>
      {/* 3 Attackers across blue line */}
      <circle cx="590" cy="540" r="20"/>
      <circle cx="720" cy="540" r="20"/>
      <circle cx="720" cy="540" r="7" fill="#7B94B0"/>
      <circle cx="850" cy="540" r="20"/>
      {/* C drives slot */}
      <path d="M720,520 C720,490 720,450 720,378" strokeWidth="3" markerEnd="url(#ah)"/>
      {/* Left wing cuts to back door */}
      <path d="M590,520 C614,482 658,446 702,386" strokeWidth="2.4" markerEnd="url(#ah)"/>
      {/* Right wing delayed */}
      <path d="M850,520 C826,484 782,450 742,384" strokeDasharray="10 7" markerEnd="url(#ah2)"/>
      {/* Cross-ice pass option */}
      <path d="M704,534 C660,532 618,530 606,530" strokeDasharray="8 6" markerEnd="url(#ah2)"/>
    </g>

    {/* Basketball — Motion Offense (bottom-right) */}
    <g transform="rotate(-3, 1100, 710)" stroke="#7B94B0" strokeWidth="2.2" fill="none">
      {/* Half-court boundary */}
      <rect x="880" y="530" width="440" height="320" strokeDasharray="14 8" strokeWidth="1.6"/>
      {/* Basket */}
      <circle cx="1100" cy="544" r="14" strokeWidth="2.4"/>
      {/* Ball handler top */}
      <circle cx="1100" cy="660" r="20"/>
      <circle cx="1100" cy="660" r="7" fill="#7B94B0"/>
      {/* Wings */}
      <circle cx="930"  cy="616" r="20"/>
      <circle cx="1270" cy="616" r="20"/>
      {/* Corners */}
      <circle cx="920"  cy="798" r="20"/>
      <circle cx="1280" cy="798" r="20"/>
      {/* Ball to left wing */}
      <path d="M1082,648 C1044,630 986,620 948,618" strokeWidth="2.5" markerEnd="url(#ah)"/>
      {/* Left wing dribble drive baseline */}
      <path d="M930,596 C944,562 984,548 1086,546" strokeWidth="2.5" markerEnd="url(#ah)"/>
      {/* Right wing back-door cut */}
      <path d="M1270,596 C1240,558 1180,546 1114,546" strokeDasharray="10 7" markerEnd="url(#ah2)"/>
      {/* Corner skip pass */}
      <path d="M930,618 C958,692 996,762 1060,800" strokeDasharray="12 8" markerEnd="url(#ah2)"/>
      {/* Weak corner pop */}
      <path d="M1280,778 C1290,738 1296,690 1296,650" strokeDasharray="8 6" markerEnd="url(#ah2)"/>
    </g>
    {/* ── Handwritten text ── */}
    <text x="120" y="650" stroke="#7B94B0" strokeWidth="1.3" fill="none" fontFamily="'Georgia', serif" fontStyle="italic" fontSize="32" opacity="0.65" letterSpacing="2" transform="rotate(-3, 120, 650)">Recrutement</text>
    <text x="200" y="800" stroke="#7B94B0" strokeWidth="1.2" fill="none" fontFamily="'Georgia', serif" fontStyle="italic" fontSize="24" opacity="0.6" letterSpacing="2" transform="rotate(2, 200, 800)">RSEQ</text>
    <text x="760" y="140" stroke="#7B94B0" strokeWidth="1.2" fill="none" fontFamily="'Georgia', serif" fontStyle="italic" fontSize="26" opacity="0.63" letterSpacing="2" transform="rotate(-2, 760, 140)">Espoir</text>
    <text x="1340" y="400" stroke="#7B94B0" strokeWidth="1.2" fill="none" fontFamily="'Georgia', serif" fontStyle="italic" fontSize="22" opacity="0.6" letterSpacing="1" transform="rotate(4, 1340, 400)">Stratégie</text>
  </>
);

/* TILE 3 — Bootleg / Rollout (center-right) · Box Set (bottom-left) · Penalty Kill (bottom-right) */
const tile3 = (
  <>
    {/* Football — Bootleg / Rollout Right (center-right) */}
    <g transform="rotate(4, 1050, 380)" stroke="#7B94B0" strokeWidth="2.2" fill="none">
      {/* OL */}
      <circle cx="960"  cy="360" r="20"/> <circle cx="1010" cy="360" r="20"/>
      <circle cx="1060" cy="360" r="20"/> <circle cx="1110" cy="360" r="20"/>
      <circle cx="1160" cy="360" r="20"/>
      {/* Zone blocks angled right */}
      <line x1="960"  y1="340" x2="940" y2="300"/>
      <line x1="1010" y1="340" x2="990" y2="300"/>
      <line x1="1060" y1="340" x2="1040" y2="300"/>
      <line x1="1110" y1="340" x2="1130" y2="300"/>
      <line x1="1160" y1="340" x2="1182" y2="300"/>
      {/* QB X */}
      <line x1="1038" y1="388" x2="1078" y2="428"/> <line x1="1078" y1="388" x2="1038" y2="428"/>
      {/* QB bootleg rollout right */}
      <path d="M1058,428 C1100,446 1162,450 1218,436" strokeWidth="2.5" markerEnd="url(#ah)"/>
      {/* RB fake inside (dashed) */}
      <circle cx="1058" cy="476" r="20"/>
      <path d="M1050,458 C1034,426 1014,396 998,376" strokeDasharray="8 6" markerEnd="url(#ah2)"/>
      {/* WR left over the top */}
      <circle cx="790" cy="360" r="20"/>
      <path d="M788,340 C780,286 776,240 782,200" strokeWidth="2.5" markerEnd="url(#ah)"/>
      {/* WR right flag corner */}
      <circle cx="1330" cy="360" r="20"/>
      <path d="M1332,340 C1340,290 1360,252 1392,224" strokeWidth="2.5" markerEnd="url(#ah)"/>
      {/* TE seam over middle */}
      <circle cx="1220" cy="360" r="20"/>
      <path d="M1218,340 C1208,300 1196,264 1180,234" strokeDasharray="10 7" markerEnd="url(#ah2)"/>
    </g>

    {/* Basketball — Box Set (bottom-left) */}
    <g transform="rotate(-2, 360, 710)" stroke="#7B94B0" strokeWidth="2.2" fill="none">
      {/* Paint */}
      <rect x="278" y="580" width="164" height="210" strokeDasharray="12 8" strokeWidth="1.6"/>
      {/* Basket */}
      <circle cx="360" cy="582" r="14" strokeWidth="2.4"/>
      {/* PG top with ball */}
      <circle cx="360" cy="710" r="20"/>
      <circle cx="360" cy="710" r="7" fill="#7B94B0"/>
      {/* Box corners */}
      <circle cx="240" cy="650" r="20"/> <circle cx="480" cy="650" r="20"/>
      <circle cx="240" cy="768" r="20"/> <circle cx="480" cy="768" r="20"/>
      {/* PG hits left elbow */}
      <path d="M344,698 C316,672 272,658 258,654" strokeWidth="2.5" markerEnd="url(#ah)"/>
      {/* Right high pops */}
      <path d="M480,630 C440,612 380,600 330,598" strokeDasharray="10 7" markerEnd="url(#ah2)"/>
      {/* Right low baseline cut */}
      <path d="M480,748 C418,748 348,752 258,770" strokeWidth="2.4" markerEnd="url(#ah)"/>
      {/* Left low seal and dive */}
      <path d="M240,788 C256,738 286,676 302,616" strokeDasharray="8 6" markerEnd="url(#ah2)"/>
    </g>

    {/* Hockey — Penalty Kill Box (bottom-right) */}
    <g transform="rotate(-3, 1160, 730)" stroke="#7B94B0" strokeWidth="2.2" fill="none">
      {/* Net (their end) */}
      <rect x="1135" y="576" width="50" height="30" strokeWidth="2.4"/>
      <path d="M1135,606 Q1160,624 1185,606" strokeDasharray="6 4" strokeWidth="1.6"/>
      {/* D-zone face-off circle */}
      <circle cx="1160" cy="730" r="66" strokeDasharray="14 8" strokeWidth="1.6"/>
      {/* PK box — 4 defenders */}
      <circle cx="1060" cy="666" r="20"/>
      <circle cx="1260" cy="666" r="20"/>
      <circle cx="1060" cy="794" r="20"/>
      <circle cx="1260" cy="794" r="20"/>
      {/* PP attackers (3) */}
      <circle cx="1160" cy="850" r="20"/>
      <circle cx="1160" cy="850" r="7" fill="#7B94B0"/>
      <circle cx="990"  cy="756" r="20"/>
      <circle cx="1330" cy="756" r="20"/>
      {/* PP centre passes left */}
      <path d="M1142,840 C1106,810 1060,778 1044,762" strokeWidth="2.4" markerEnd="url(#ah)"/>
      {/* Left shot on net */}
      <path d="M990,736 C1012,698 1054,646 1104,610" strokeWidth="2.6" markerEnd="url(#ah)"/>
      {/* Right outlet option */}
      <path d="M1178,842 C1220,810 1264,782 1314,766" strokeDasharray="10 7" markerEnd="url(#ah2)"/>
      {/* PK breakout attempt */}
      <path d="M1060,646 C1062,618 1094,590 1133,582" strokeDasharray="8 6" markerEnd="url(#ah2)"/>
    </g>
    {/* ── Handwritten text ── */}
    <text x="200" y="100" stroke="#7B94B0" strokeWidth="1.3" fill="none" fontFamily="'Georgia', serif" fontStyle="italic" fontSize="28" opacity="0.65" letterSpacing="2" transform="rotate(-5, 200, 100)">CÉGEP</text>
    <text x="600" y="440" stroke="#7B94B0" strokeWidth="1.2" fill="none" fontFamily="'Georgia', serif" fontStyle="italic" fontSize="22" opacity="0.6" letterSpacing="1" transform="rotate(3, 600, 440)">Talent du Québec</text>
    <text x="100" y="460" stroke="#7B94B0" strokeWidth="1.2" fill="none" fontFamily="'Georgia', serif" fontStyle="italic" fontSize="24" opacity="0.63" letterSpacing="2" transform="rotate(-4, 100, 460)">Relève</text>
    <text x="620" y="160" stroke="#7B94B0" strokeWidth="1.2" fill="none" fontFamily="'Georgia', serif" fontStyle="italic" fontSize="22" opacity="0.6" letterSpacing="1" transform="rotate(2, 620, 160)">Objectif</text>
    <text x="560" y="870" stroke="#7B94B0" strokeWidth="1.3" fill="none" fontFamily="'Georgia', serif" fontStyle="italic" fontSize="26" opacity="0.65" letterSpacing="2" transform="rotate(-3, 560, 870)">Stats</text>
  </>
);

const TILES_CONTENT = [tile0, tile1, tile2, tile3];
const TILE_COUNT    = TILES_CONTENT.length;

/* ─────────────────────────────────────────────────────────────────── */

export default function PlaybookBackground() {
  const svgRefs  = useRef<(SVGSVGElement | null)[]>(Array(TILE_COUNT).fill(null));
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);
  const prevLight = useRef<boolean | null>(null);

  const animate = useCallback(() => {
    timeouts.current.forEach(clearTimeout);
    timeouts.current = [];
    document.body.classList.remove('playbook-drawn');

    /* Reset all tiles */
    svgRefs.current.forEach(svg => {
      if (!svg) return;
      Array.from(svg.querySelectorAll<SVGElement>('path, line, circle, rect, text')).forEach(el => {
        el.style.transition = 'none';
        if (el.tagName === 'circle') {
          el.style.opacity   = '0';
          el.style.transform = 'scale(0)';
        } else if (el.hasAttribute('stroke-dasharray')) {
          el.style.opacity = '0';
        } else {
          const len = (el as unknown as SVGGeometryElement).getTotalLength?.() ?? 200;
          el.style.strokeDasharray  = String(len);
          el.style.strokeDashoffset = String(len);
        }
      });
    });

    document.body.getBoundingClientRect(); // force reflow

    /* Animate all tiles simultaneously — text & diagrams in parallel */
    let maxDelay = 0;
    svgRefs.current.forEach(svg => {
      if (!svg) return;
      const allEls = Array.from(svg.querySelectorAll<SVGElement>('path, line, circle, rect, text'));
      const diagramEls = allEls.filter(el => el.tagName !== 'text');
      const textEls    = allEls.filter(el => el.tagName === 'text');

      /* Diagram elements — circles, lines, paths, rects */
      let dDelay = 61;
      diagramEls.forEach(el => {
        const hasDash = el.hasAttribute('stroke-dasharray');
        const d = dDelay;
        if (el.tagName === 'circle') {
          const id = setTimeout(() => {
            el.style.transition    = 'opacity 0.19s ease, transform 0.29s cubic-bezier(0.34,1.56,0.64,1)';
            el.style.opacity       = '';
            el.style.transform     = 'scale(1)';
          }, d);
          timeouts.current.push(id);
          dDelay += 65;
        } else if (hasDash) {
          const id = setTimeout(() => {
            el.style.transition = 'opacity 0.38s ease-in-out';
            el.style.opacity    = '';
          }, d);
          timeouts.current.push(id);
          dDelay += 92;
        } else {
          const len = (el as unknown as SVGGeometryElement).getTotalLength?.() ?? 200;
          const dur = Math.min(1.08, Math.max(0.22, len / 455));
          const id  = setTimeout(() => {
            el.style.transition       = `stroke-dashoffset ${dur}s ease-in-out`;
            el.style.strokeDashoffset = '0';
          }, d);
          timeouts.current.push(id);
          dDelay += Math.round(dur * 459) + 68;
        }
      });

      /* Text elements — animate concurrently, starting at the same base delay */
      let tDelay = 61;
      textEls.forEach(el => {
        const len = (el as unknown as SVGGeometryElement).getTotalLength?.() ?? 300;
        const dur = Math.min(2.15, Math.max(0.9, len / 155));
        const id = setTimeout(() => {
          el.style.transition       = `stroke-dashoffset ${dur}s ease-in-out`;
          el.style.strokeDashoffset = '0';
        }, tDelay);
        timeouts.current.push(id);
        tDelay += Math.round(dur * 382) + 153;
      });

      maxDelay = Math.max(maxDelay, dDelay, tDelay);
    });

    const doneId = setTimeout(() => document.body.classList.add('playbook-drawn'), maxDelay + 300);
    timeouts.current.push(doneId);
  }, []);

  useEffect(() => {
    prevLight.current = document.body.classList.contains('light-mode');
    animate();
    const observer = new MutationObserver(() => {
      const isLight = document.body.classList.contains('light-mode');
      if (isLight !== prevLight.current) {
        prevLight.current = isLight;
        animate();
      }
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => { observer.disconnect(); timeouts.current.forEach(clearTimeout); };
  }, [animate]);

  return (
    <div
      aria-hidden
      className="playbook-bg absolute inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: -1 }}
    >
      {TILES_CONTENT.map((content, i) => (
        <svg
          key={i}
          ref={(el: SVGSVGElement | null) => { svgRefs.current[i] = el; }}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 1440 900"
          width="100%"
          style={{ display: 'block' }}
        >
          {/* Markers defined once in tile 0; global IDs resolve across all inline SVGs */}
          {i === 0 && (
            <defs>
              <marker id="ah"  markerWidth="10" markerHeight="8" refX="10" refY="4" orient="auto">
                <polygon points="0 0, 10 4, 0 8" fill="#7B94B0"/>
              </marker>
              <marker id="ah2" markerWidth="8"  markerHeight="6" refX="8"  refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6"  fill="#7B94B0"/>
              </marker>
            </defs>
          )}
          {content}
        </svg>
      ))}
    </div>
  );
}
