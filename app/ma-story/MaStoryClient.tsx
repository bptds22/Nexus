"use client";

import { useCallback, useRef, useState } from "react";
import styles from "./ma-story.module.css";

/* ═══════════════════════════════════════════════════════════════
   Port 1:1 de ma-story.html (sha256 0fec4119…514fc9).

   Le code canvas ci-dessous reprend la référence fonction par
   fonction — mêmes coordonnées, mêmes couleurs, même ordre d'appel,
   même passe de grain. Trois écarts, tous actés :

   1. La famille de police est résolue à l'exécution depuis
      --font-story (next/font hache le nom de famille ; le littéral
      « Outfit » retomberait silencieusement en police système).
   2. Le pied « NEXUSSPORTS.CA » en texte est remplacé par le
      wordmark blanc dessiné en drawImage — voir chrome().
   3. Le logo est préchargé dans le Promise.all de render(), parce
      que chrome() est synchrone.

   Connu et NON corrigé (fidélité au port) : les URL d'objet créées
   par createObjectURL ne sont jamais révoquées.
═══════════════════════════════════════════════════════════════ */

type Tpl = "match" | "resultat" | "stats" | "travail" | "famille";

type Vals = Record<string, string>;

const TEMPLATES: { id: Tpl; t: string; s: string }[] = [
  { id: "match", t: "Jour de match", s: "L'adversaire, l'heure, le lieu." },
  { id: "resultat", t: "Résultat", s: "Le score final." },
  { id: "stats", t: "Mes stats", s: "Tes chiffres du match." },
  { id: "travail", t: "On travaille", s: "Le gym, la track, le grind." },
  { id: "famille", t: "Fière famille", s: "Pour les parents. 🫶" },
];

const WORDMARK_SRC = "/brand/logo-white.png";

/* Écart acté vs la référence, qui peignait le pied en texte à la
   baseline 1620. Sur « match » et « travail » la dernière ligne rouge
   est peinte à 1618, au même x=140 : elle recouvrait le pied, si bien
   que le branding disparaissait sur 2 gabarits sur 5. Le wordmark est
   donc posé plus bas — base 1670, soit 1630→1670. Il reste dégagé de
   la ligne rouge (~12 px d'air) et hors de la zone basse de 250 px que
   l'UI Instagram recouvre. Uniforme sur les 5 gabarits via chrome(). */
const WORDMARK_BASELINE_Y = 1670;
const WORDMARK_H = 40;
const WORDMARK_X = 140;

function loadWordmark(): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("wordmark introuvable"));
    img.src = WORDMARK_SRC; // même origine → canvas non tainté
  });
}

/* ── Composition ────────────────────────────────────────────────
   Transposition de la référence. `family` est la pile de polices
   résolue ; F() reconstitue le raccourci CSS que la référence
   écrivait en dur (« 800 96px Outfit »).
──────────────────────────────────────────────────────────────── */
function drawStory(
  ctx: CanvasRenderingContext2D,
  tpl: Tpl,
  vals: Vals,
  photo: HTMLImageElement,
  logo: HTMLImageElement,
  family: string,
) {
  const val = (id: string) => (vals[id] || "").trim();
  const up = (id: string) => val(id).toUpperCase();
  const F = (spec: string) => `${spec} ${family}`;

  function fitCover(img: HTMLImageElement, x: number, y: number, w: number, h: number) {
    const s = Math.max(w / img.width, h / img.height);
    const iw = img.width * s,
      ih = img.height * s;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
    ctx.restore();
  }

  function grain() {
    const d = ctx.getImageData(0, 0, 1080, 1920);
    for (let i = 0; i < d.data.length; i += 16) {
      const n = (Math.random() - 0.5) * 10;
      d.data[i] += n;
      d.data[i + 1] += n;
      d.data[i + 2] += n;
    }
    ctx.putImageData(d, 0, 0);
  }

  function chrome() {
    ctx.fillStyle = "#111317";
    ctx.fillRect(0, 0, 1080, 1920);
    const beam = ctx.createLinearGradient(1080, 0, 300, 1100);
    beam.addColorStop(0, "rgba(255,255,255,0.07)");
    beam.addColorStop(0.5, "rgba(255,255,255,0.02)");
    beam.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(700, 0);
    ctx.lineTo(1080, 0);
    ctx.lineTo(1080, 500);
    ctx.lineTo(340, 1250);
    ctx.closePath();
    ctx.fill();
    ctx.textAlign = "left";
    // Écart 2 : wordmark au lieu de fillText('NEXUSSPORTS.CA', 140, 1620).
    const w = WORDMARK_H * (logo.naturalWidth / logo.naturalHeight);
    ctx.drawImage(logo, WORDMARK_X, WORDMARK_BASELINE_Y - WORDMARK_H, w, WORDMARK_H);
  }

  function eyebrow(text: string, y = 320) {
    ctx.fillStyle = "#9CA3AF";
    ctx.font = F("600 30px");
    ctx.letterSpacing = "4px";
    ctx.fillText(text, 140, y);
    ctx.letterSpacing = "0px";
    ctx.fillStyle = "#E63946";
    ctx.fillRect(140, y + 24, 72, 5);
  }

  function photoBlock(x: number, y: number, w: number, h: number) {
    const glow = ctx.createRadialGradient(x + w / 2, y + h / 2, 100, x + w / 2, y + h / 2, 700);
    glow.addColorStop(0, "rgba(230,57,70,0.10)");
    glow.addColorStop(1, "rgba(230,57,70,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, y - 200, 1080, h + 400);
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.65)";
    ctx.shadowBlur = 70;
    ctx.shadowOffsetY = 28;
    ctx.fillStyle = "#000";
    ctx.fillRect(x, y, w, h);
    ctx.restore();
    fitCover(photo, x, y, w, h);
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = "#E63946";
    ctx.fillRect(x + w - 10, y, 10, h);
  }

  function fitText(text: string, maxW: number, weight: string, startPx: number, minPx: number) {
    let s = startPx;
    ctx.font = F(weight + " " + s + "px");
    while (ctx.measureText(text).width > maxW && s > minPx) {
      s -= 4;
      ctx.font = F(weight + " " + s + "px");
    }
    return s;
  }

  const T: Record<Tpl, () => void> = {
    match() {
      eyebrow("ATHLÈTE NEXUS");
      ctx.fillStyle = "#FFFFFF";
      ctx.font = F("800 96px");
      ctx.fillText("JOUR DE", 140, 470);
      ctx.fillStyle = "#E63946";
      ctx.fillText("MATCH.", 140, 572);
      photoBlock(140, 640, 800, 820);
      const adv = up("adv");
      ctx.fillStyle = "#FFFFFF";
      const vs = adv ? "VS " + adv : "";
      if (vs) {
        fitText(vs, 800, "800", 76, 44);
        ctx.fillText(vs, 140, 1560);
      }
      ctx.fillStyle = "#E63946";
      ctx.font = F("700 38px");
      let l = up("quand");
      if (up("lieu")) l += (l ? "  ·  " : "") + up("lieu");
      if (l) {
        fitText(l, 800, "700", 38, 26);
        ctx.fillText(l, 140, 1618);
      }
    },
    resultat() {
      eyebrow("RÉSULTAT FINAL");
      photoBlock(140, 430, 800, 820);
      const s1 = val("s1") || "0",
        s2 = val("s2") || "0";
      const win = parseInt(s1) > parseInt(s2),
        tie = parseInt(s1) === parseInt(s2);
      const verdict = tie ? "ÉGALITÉ." : win ? "VICTOIRE." : "ON SE REPREND.";
      ctx.fillStyle = win ? "#E63946" : "#FFFFFF";
      fitText(verdict, 800, "800", 110, 54);
      ctx.fillText(verdict, 140, 1390);
      ctx.fillStyle = "#FFFFFF";
      ctx.font = F("800 88px");
      ctx.fillText(s1 + " — " + s2, 140, 1500);
      const adv = up("adv2");
      if (adv) {
        ctx.fillStyle = "#9CA3AF";
        fitText("CONTRE " + adv, 800, "600", 38, 26);
        ctx.fillText("CONTRE " + adv, 140, 1562);
      }
    },
    stats() {
      eyebrow("MES STATS DU MATCH");
      photoBlock(140, 430, 800, 780);
      const name = up("name");
      ctx.fillStyle = "#FFFFFF";
      fitText(name, 800, "800", 72, 44);
      ctx.fillText(name, 140, 1310);
      ctx.fillStyle = "#6B7280";
      ctx.font = F("600 32px");
      const l2 = up("pos") ? up("sport") + "  ·  " + up("pos") : up("sport");
      if (l2) ctx.fillText(l2, 140, 1360);
      const stats = [
        [val("v1"), up("l1")],
        [val("v2"), up("l2")],
        [val("v3"), up("l3")],
      ].filter((s) => s[0]);
      const n = stats.length || 1,
        colW = 800 / n;
      stats.forEach((s, i) => {
        const cx = 140 + i * colW;
        ctx.fillStyle = "#E63946";
        ctx.font = F("800 84px");
        ctx.fillText(s[0], cx, 1500);
        ctx.fillStyle = "#FFFFFF";
        ctx.font = F("600 30px");
        ctx.letterSpacing = "2px";
        ctx.fillText(s[1], cx, 1548);
        ctx.letterSpacing = "0px";
      });
    },
    travail() {
      eyebrow("ATHLÈTE NEXUS");
      ctx.fillStyle = "#FFFFFF";
      ctx.font = F("800 96px");
      ctx.fillText("ON", 140, 470);
      ctx.fillStyle = "#E63946";
      ctx.fillText("TRAVAILLE.", 140, 572);
      photoBlock(140, 640, 800, 820);
      const name = up("name");
      ctx.fillStyle = "#FFFFFF";
      if (name) {
        fitText(name, 800, "800", 72, 44);
        ctx.fillText(name, 140, 1560);
      }
      const obj = up("obj");
      if (obj) {
        ctx.fillStyle = "#E63946";
        fitText(obj, 800, "700", 38, 26);
        ctx.fillText(obj, 140, 1618);
      }
    },
    famille() {
      eyebrow("FIÈRE FAMILLE");
      photoBlock(140, 430, 800, 900);
      const name = up("name");
      ctx.fillStyle = "#FFFFFF";
      fitText(name, 800, "800", 84, 46);
      ctx.fillText(name, 140, 1450);
      ctx.fillStyle = "#E63946";
      ctx.font = F("800 52px");
      ctx.fillText("NOTRE ATHLÈTE.", 140, 1522);
      const sp = up("sportF");
      if (sp) {
        ctx.fillStyle = "#9CA3AF";
        ctx.font = F("600 34px");
        ctx.fillText(sp, 140, 1574);
      }
    },
  };

  chrome();
  T[tpl]();
  grain();
}

/* ── UI ─────────────────────────────────────────────────────── */

function Field({
  label,
  id,
  maxLength,
  placeholder,
  value,
  onChange,
  inputMode,
}: {
  label: string;
  id: string;
  maxLength: number;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  inputMode?: "numeric";
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <input
        type="text"
        id={id}
        maxLength={maxLength}
        placeholder={placeholder}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export default function MaStoryClient({ fontVariableClass }: { fontVariableClass: string }) {
  const [tpl, setTpl] = useState<Tpl>("match");
  const [vals, setVals] = useState<Vals>({});
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [shown, setShown] = useState(false);
  const [dlHref, setDlHref] = useState<string>("");

  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLImageElement | null>(null);

  const v = (k: string) => vals[k] ?? "";
  const set = (k: string) => (value: string) => setVals((p) => ({ ...p, [k]: value }));

  const onPhoto = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const img = new Image();
    img.onload = () => setPhoto(img);
    img.src = URL.createObjectURL(f);
  }, []);

  const render = useCallback(async () => {
    const canvas = canvasRef.current;
    const root = rootRef.current;
    if (!canvas || !root || !photo) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Écart 1 : famille résolue depuis la variable next/font. On garde la
    // pile complète pour ctx.font (fallback préservé) et la première
    // famille seule pour document.fonts.load, qui matche mal une liste.
    const family =
      getComputedStyle(root).getPropertyValue("--font-story").trim() || "Outfit, sans-serif";
    const first = family.split(",")[0].trim();

    // Écart 3 : le logo entre dans le Promise.all, chrome() étant synchrone.
    const [logo] = await Promise.all([
      logoRef.current ? Promise.resolve(logoRef.current) : loadWordmark(),
      document.fonts.load(`800 100px ${first}`),
      document.fonts.load(`700 40px ${first}`),
      document.fonts.load(`600 40px ${first}`),
      document.fonts.load(`500 30px ${first}`),
    ]);
    logoRef.current = logo;

    drawStory(ctx, tpl, vals, photo, logo, family);

    setShown(true);
    canvas.toBlob((b) => {
      if (b) setDlHref(URL.createObjectURL(b));
    }, "image/png");
    previewRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [photo, tpl, vals]);

  return (
    <div ref={rootRef} className={`${fontVariableClass} ${styles.page}`}>
      <div className={styles.wrap}>
        <div className={styles.eyebrow}>Nexus · Ma story</div>
        <div className={styles.filet} />
        <h1>
          Crée ta story
          <br />
          <span className={styles.r}>d&apos;athlète.</span>
        </h1>
        <p className={styles.sub}>
          Choisis ton format, ajoute ta photo, télécharge. Ta photo reste sur ton appareil — rien
          n&apos;est envoyé nulle part.
        </p>

        <div className={styles.tpls}>
          {TEMPLATES.map((x) => (
            <button
              key={x.id}
              type="button"
              className={`${styles.tpl} ${tpl === x.id ? styles.sel : ""}`}
              onClick={() => setTpl(x.id)}
            >
              <div className={styles.t}>{x.t}</div>
              <div className={styles.s}>{x.s}</div>
            </button>
          ))}
        </div>

        <div className={styles.field}>
          <label>La photo</label>
          <label
            className={`${styles.photoBtn} ${photo ? styles.loaded : ""}`}
            htmlFor="photoInput"
          >
            {photo ? "✓ Photo choisie — en changer" : "📷 Choisir une photo"}
          </label>
          <input type="file" id="photoInput" accept="image/*" onChange={onPhoto} />
        </div>

        <Field
          label={tpl === "famille" ? "Prénom de ton athlète" : "Prénom (et nom si tu veux)"}
          id="name"
          maxLength={26}
          placeholder="Ex. : Mathis T."
          value={v("name")}
          onChange={set("name")}
        />

        {tpl === "stats" && (
          <div className={styles.row}>
            <Field
              label="Sport"
              id="sport"
              maxLength={18}
              placeholder="Ex. : Football"
              value={v("sport")}
              onChange={set("sport")}
            />
            <Field
              label="Position"
              id="pos"
              maxLength={14}
              placeholder="Ex. : WR"
              value={v("pos")}
              onChange={set("pos")}
            />
          </div>
        )}

        {tpl === "match" && (
          <div>
            <Field
              label="Adversaire"
              id="adv"
              maxLength={24}
              placeholder="Ex. : Les Dragons"
              value={v("adv")}
              onChange={set("adv")}
            />
            <div className={styles.row}>
              <Field
                label="Date · Heure"
                id="quand"
                maxLength={22}
                placeholder="Ex. : SAM 14 SEPT · 19 H"
                value={v("quand")}
                onChange={set("quand")}
              />
              <Field
                label="Lieu (optionnel)"
                id="lieu"
                maxLength={22}
                placeholder="Ex. : Stade Hébert"
                value={v("lieu")}
                onChange={set("lieu")}
              />
            </div>
          </div>
        )}

        {tpl === "resultat" && (
          <div>
            <Field
              label="Adversaire"
              id="adv2"
              maxLength={24}
              placeholder="Ex. : Les Dragons"
              value={v("adv2")}
              onChange={set("adv2")}
            />
            <div className={styles.row}>
              <Field
                label="Notre score"
                id="s1"
                maxLength={3}
                inputMode="numeric"
                placeholder="34"
                value={v("s1")}
                onChange={set("s1")}
              />
              <Field
                label="Leur score"
                id="s2"
                maxLength={3}
                inputMode="numeric"
                placeholder="21"
                value={v("s2")}
                onChange={set("s2")}
              />
            </div>
          </div>
        )}

        {tpl === "stats" && (
          <div>
            <div className={styles.row}>
              <Field
                label="Stat 1"
                id="v1"
                maxLength={6}
                placeholder="2"
                value={v("v1")}
                onChange={set("v1")}
              />
              <Field
                label="Libellé"
                id="l1"
                maxLength={14}
                placeholder="TOUCHÉS"
                value={v("l1")}
                onChange={set("l1")}
              />
            </div>
            <div className={styles.row}>
              <Field
                label="Stat 2"
                id="v2"
                maxLength={6}
                placeholder="112"
                value={v("v2")}
                onChange={set("v2")}
              />
              <Field
                label="Libellé"
                id="l2"
                maxLength={14}
                placeholder="VERGES"
                value={v("l2")}
                onChange={set("l2")}
              />
            </div>
            <div className={styles.row}>
              <Field
                label="Stat 3 (optionnel)"
                id="v3"
                maxLength={6}
                placeholder="8"
                value={v("v3")}
                onChange={set("v3")}
              />
              <Field
                label="Libellé"
                id="l3"
                maxLength={14}
                placeholder="RÉCEPTIONS"
                value={v("l3")}
                onChange={set("l3")}
              />
            </div>
          </div>
        )}

        {tpl === "travail" && (
          <Field
            label="Ton objectif (optionnel)"
            id="obj"
            maxLength={30}
            placeholder="Ex. : Prêt pour septembre"
            value={v("obj")}
            onChange={set("obj")}
          />
        )}

        {tpl === "famille" && (
          <Field
            label="Sport (optionnel)"
            id="sportF"
            maxLength={18}
            placeholder="Ex. : Basketball"
            value={v("sportF")}
            onChange={set("sportF")}
          />
        )}

        <button type="button" className={styles.gen} disabled={!photo} onClick={render}>
          Générer ma story
        </button>

        <div
          ref={previewRef}
          className={`${styles.previewWrap} ${shown ? styles.show : ""}`}
        >
          <canvas ref={canvasRef} width={1080} height={1920} />
          <a className={styles.dl} href={dlHref || undefined} download="ma-story-nexus.png">
            ⬇ Télécharger l&apos;image
          </a>
          <p className={styles.hint}>
            Ensuite : Instagram → Story → choisis l&apos;image → publie. Identifie{" "}
            <b>@nexussportsca</b> — on repartage les meilleures.
          </p>
        </div>

        <p className={styles.privacy}>
          🔒 La photo est traitée directement dans ton navigateur et n&apos;est jamais téléversée
          sur nos serveurs. Aucune donnée n&apos;est conservée.
        </p>
      </div>
    </div>
  );
}
