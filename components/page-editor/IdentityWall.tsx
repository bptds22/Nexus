"use client";

// components/page-editor/IdentityWall.tsx — S1 « Identité & mur » v2 (MANUEL)
// Logo actuel + remplacer · name-card (surnom/mention/ticker) · GÉO pré-rempli ·
// couleurs + contraste (plancher 2.4) · lettres & mots (init/vertical/devise/
// flèche/tuiles catalogue 14 max 4 + mot perso). PREVIEW = le VRAI ProgramWall
// câblé sur les 14 champs + Ticker.tsx. nbath reste hors-mur (ligne stats).

import * as React from "react";
import ProgramWall from "@/components/program-wall/ProgramWall";
import Ticker from "@/components/program-page/Ticker";
import { ratio, CONTRAST_FLOOR } from "./contrast";
import { WORDS, PROVINCES, GRASSET } from "./fixture";
import { editorToSchool, type EditorIdentityState } from "./wallBridge";
import { useToast } from "./toast";

// Débounce par ÉGALITÉ DE CONTENU (value = clé string stable) : le timer ne se
// relance que quand le contenu change → pas de boucle, et le VRAI mur (lourd :
// filtre SVG) ne re-rend qu'une fois ~180 ms après la dernière frappe. Les
// champs de saisie restent instantanés (controlled) ; seul le mur est débouncé.
function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const id = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return v;
}

export default function IdentityWall({
  nick, setNick, slog, setSlog, init, setInit, nbath, setNbath,
}: {
  nick: string; setNick: (v: string) => void;
  slog: string; setSlog: (v: string) => void;
  init: string; setInit: (v: string) => void;
  nbath: string; setNbath: (v: string) => void;
}) {
  const toast = useToast();
  const g = GRASSET.identity;
  const [tagline, setTagline] = React.useState(g.tagline);
  const [prov, setProv] = React.useState(g.prov);
  const [tick, setTick] = React.useState(g.tick);
  const [ville, setVille] = React.useState(g.ville);
  const [quartier, setQuartier] = React.useState(g.quartier);
  const [rtag, setRtag] = React.useState(g.rtag);
  const [c1, setC1] = React.useState(g.c1);
  const [c2, setC2] = React.useState(g.c2);
  const [c3, setC3] = React.useState(g.c3);
  // init / nbath / slog sont remontés (partagés avec S6 Parcours) — reçus en props.
  const [vword, setVword] = React.useState(g.vword);
  const [dev1, setDev1] = React.useState(g.dev1);
  const [dev2, setDev2] = React.useState(g.dev2);
  const [fla, setFla] = React.useState(g.fla);
  const [flb, setFlb] = React.useState(g.flb);
  const [wcustom, setWcustom] = React.useState("");
  // catalogue de mots (14 + persos ajoutés) + états cochés (défaut 4 premiers).
  const [catalog, setCatalog] = React.useState<{ w: string; custom: boolean }[]>(
    WORDS.map((w) => ({ w, custom: false })),
  );
  const [wordOn, setWordOn] = React.useState<boolean[]>(WORDS.map((_, i) => g.words.includes(i)));

  const upperOn = (fn: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) =>
    fn(e.target.value.toUpperCase());

  const toggleWord = (i: number) => {
    const on = !wordOn[i];
    if (on && wordOn.filter(Boolean).length >= 4) { toast("Maximum 4 mots — décoche pour changer"); return; }
    setWordOn((s) => s.map((v, k) => (k === i ? on : v)));
  };
  const addWord = () => {
    const v = wcustom.trim().toUpperCase();
    if (!v) return;
    const under4 = wordOn.filter(Boolean).length < 4;
    setCatalog((c) => [...c, { w: v, custom: true }]);
    setWordOn((s) => [...s, under4]);
    setWcustom("");
    toast(under4 ? "Mot perso ajouté" : "Ajouté au catalogue — décoche un mot pour l'activer");
  };

  const selectedWords = catalog.filter((_, i) => wordOn[i]).map((c) => c.w);
  const wallInput: EditorIdentityState = {
    nick, slog, tagline, prov, tick, ville, quartier, rtag,
    c1, c2, c3, init, vword, dev1, dev2, fla, flb,
    words: selectedWords, nbath,
  };
  // Le mur suit le contenu débouncé (clé string) — reconstruit seulement quand
  // une valeur change réellement, 180 ms après la dernière frappe.
  const debKey = useDebounced(JSON.stringify(wallInput), 180);
  const school = React.useMemo(
    () => editorToSchool(JSON.parse(debKey) as EditorIdentityState),
    [debKey],
  );
  const tickerText = tick || slog;
  const villeTitle = ville ? ville.charAt(0) + ville.slice(1).toLowerCase() : "—";

  // contraste Principale ↔ fond Nexus (plancher 2.4)
  const r = ratio(c1, "#111317");
  const ok = r >= CONTRAST_FLOOR;

  return (
    <section className="sec">
      <div className="sech"><span className="num">1</span><h2>Identité &amp; mur</h2><span className="tag man">MANUEL</span></div>
      <div className="cols">
        <div>
          <div className="panel" style={{ marginBottom: 14 }}>
            <div className="pt"><span className="n">0</span>IDENTITÉ — AUTOMATIQUE</div>
            <div className="auto">
              <span className="achip"><b>✓</b>Type : Collège privé</span>
              <span className="achip"><b>✓</b>Nom : André-Grasset</span>
            </div>
            <div className="note">Le nom officiel vient du seed Nexus. Une erreur ? Le ⚑ de la fiche Campus (section 3) la signale.</div>
          </div>

          <div className="panel" style={{ marginBottom: 14 }}>
            <div className="pt"><span className="n">1</span>LOGO</div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ width: 74, height: 74, borderRadius: 12, background: "#20242D", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Anton'", fontSize: 26, color: "var(--red)" }}>{init || "AG"}</div>
              <div style={{ flex: 1 }}>
                <span className="achip"><b>✓</b>Logo actuel — hérité de ton compte Nexus</span>
                <div className="note" style={{ marginTop: 6 }}>Chargé automatiquement depuis la réclamation de ton collège (RPRP).</div>
              </div>
            </div>
            {/* Bloc 2 : upload réel */}
            <div className="drop" style={{ marginTop: 12 }} onClick={() => toast("Upload de fichier (câblage Bloc 2)")}><b>Remplacer le logo</b>SVG préféré · PNG accepté · remplace l'actuel partout (mur, hero, name-card)</div>
          </div>

          <div className="panel" style={{ marginBottom: 14 }}>
            <div className="pt"><span className="n">2</span>NAME-CARD — 5 CHAMPS (~40 s)</div>
            <label className="fl">Surnom / nom des équipes (PHÉNIX, NOMADES…)</label>
            <input className="ti" maxLength={14} value={nick} onChange={(e) => setNick(e.target.value)} />
            <label className="fl">Slogan</label>
            <input className="ti" maxLength={40} value={slog} onChange={(e) => setSlog(e.target.value)} />
            <div className="cnt">{slog.length}/40</div>
            <div className="row2">
              <div>
                <label className="fl">Mention sous le nom</label>
                <input className="ti" maxLength={20} value={tagline} onChange={(e) => setTagline(e.target.value)} />
              </div>
              <div>
                <label className="fl">Province (pilote les logos)</label>
                <select className="ti" value={prov} onChange={(e) => setProv(e.target.value)}>
                  {PROVINCES.map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <label className="fl">Ticker — le bandeau défilant en haut de ta page</label>
            <input className="ti" maxLength={60} placeholder="Ex. « Fier programme des Phénix depuis 1927 »" value={tick} onChange={(e) => setTick(e.target.value)} />
            <div className="note">Laisse vide → ton <b>slogan</b> défile à la place.</div>
          </div>

          <div className="panel" style={{ marginBottom: 14 }}>
            <div className="pt"><span className="n">3</span>GÉO — PRÉ-REMPLI PAR NEXUS, MODIFIABLE</div>
            <div className="auto" style={{ marginBottom: 10 }}><span className="achip"><b>✓</b>Rempli depuis l'adresse de ton collège — corrige si ça sonne pas juste</span></div>
            <div className="row2">
              <div>
                <label className="fl" style={{ marginTop: 0 }}>Ville</label>
                <input className="ti" maxLength={18} value={ville} onChange={upperOn(setVille)} style={{ textTransform: "uppercase" }} />
              </div>
              <div>
                <label className="fl" style={{ marginTop: 0 }}>Quartier / secteur</label>
                <input className="ti" maxLength={18} value={quartier} onChange={upperOn(setQuartier)} style={{ textTransform: "uppercase" }} />
              </div>
            </div>
            <div className="row2">
              <div>
                <label className="fl">Code régional (ou texte, ex. « QC »)</label>
                <input className="ti" maxLength={4} value={rtag} onChange={(e) => setRtag(e.target.value)} />
              </div>
              <div></div>
            </div>
          </div>

          <div className="panel" style={{ marginBottom: 14 }}>
            <div className="pt"><span className="n">4</span>COULEURS — 3 SWATCHES + CONTRASTE</div>
            <div className="sw3">
              <div className="sw"><label>Principale</label><input type="color" value={c1} onChange={(e) => setC1(e.target.value)} /></div>
              <div className="sw"><label>Foncée</label><input type="color" value={c2} onChange={(e) => setC2(e.target.value)} /></div>
              <div className="sw"><label>Claire</label><input type="color" value={c3} onChange={(e) => setC3(e.target.value)} /></div>
            </div>
            <div className={"cmeter " + (ok ? "ok" : "bad")}>
              <span className="val">{r.toFixed(2)}</span>
              <span style={{ color: "var(--mut)" }}>contraste Principale ↔ fond Nexus · plancher <b style={{ color: "#B9BFC9" }}>2.4</b></span>
              <span className="cbadge">{ok ? "✓ OK" : "⚠ ÉCLAIRCIE AUTO"}</span>
            </div>
            <div className="note">Sous 2.4, la couleur est <b>éclaircie automatiquement</b> à l'affichage — ta marque reste lisible, le design reste protégé.</div>
          </div>

          <div className="panel" style={{ marginBottom: 14 }}>
            <div className="pt"><span className="n">5</span>LETTRES &amp; MOTS DU MUR — TOUT SE CHANGE</div>
            <div className="auto" style={{ marginBottom: 10 }}><span className="achip"><b>✓</b>Pré-remplis depuis ton collège — chaque mot ici a sa place sur le mur</span></div>
            <div className="row2">
              <div>
                <label className="fl" style={{ marginTop: 0 }}>Initiales (tuile géante)</label>
                <input className="ti" maxLength={3} value={init} onChange={upperOn(setInit)} style={{ textTransform: "uppercase" }} />
              </div>
              <div>
                <label className="fl" style={{ marginTop: 0 }}>Mot vertical (bord du mur)</label>
                <input className="ti" maxLength={12} value={vword} onChange={upperOn(setVword)} style={{ textTransform: "uppercase" }} />
              </div>
            </div>
            <div className="row2">
              <div>
                <label className="fl">Devise — 2 mots</label>
                <div className="nrow" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 0 }}>
                  <input className="ti" maxLength={8} value={dev1} onChange={upperOn(setDev1)} style={{ textTransform: "uppercase" }} />
                  <input className="ti" maxLength={8} value={dev2} onChange={upperOn(setDev2)} style={{ textTransform: "uppercase" }} />
                </div>
              </div>
              <div>
                <label className="fl">Phrase flèche (avant → après)</label>
                <div className="nrow" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 0 }}>
                  <input className="ti" maxLength={10} value={fla} onChange={upperOn(setFla)} style={{ textTransform: "uppercase" }} />
                  <input className="ti" maxLength={10} value={flb} onChange={upperOn(setFlb)} style={{ textTransform: "uppercase" }} />
                </div>
              </div>
            </div>
            <label className="fl">Tuiles-mots (max 4 affichées sur le mur)</label>
            <div className="cklist">
              {catalog.map((c, i) => (
                <div key={c.w + i} className={"ck" + (wordOn[i] ? " on" : "")} onClick={() => toggleWord(i)}>
                  <span className="box">{wordOn[i] ? "✓" : ""}</span>
                  <span>{c.w}{c.custom && <i style={{ color: "#5A616D", fontSize: 10.5 }}> (perso)</i>}</span>
                </div>
              ))}
            </div>
            <label className="fl">Mot perso (si le catalogue suffit pas)</label>
            <div className="nrow" style={{ gridTemplateColumns: "1fr auto" }}>
              <input className="ti" maxLength={12} placeholder="≤ 12 caractères — ex. « KA-POW »" value={wcustom} onChange={(e) => setWcustom(e.target.value.toUpperCase())} style={{ textTransform: "uppercase" }} />
              <button className="btn ghost" onClick={addWord}>Ajouter</button>
            </div>
            <div className="mod">⚠ Mots persos modérés avant publication.</div>
            <div className="note">Max 4 mots affichés. Les mots deviennent les ghosts typographiques du mur.</div>
          </div>

          <div className="panel">
            <div className="pt"><span className="n">6</span>CHIFFRE COLLÈGE — 1 CHAMP</div>
            <label className="fl">Nombre d'étudiants-athlètes (affiché « saisie collège »)</label>
            <input className="ti" maxLength={6} value={nbath} onChange={(e) => setNbath(e.target.value)} />
            <div className="note">Le nombre d'équipes et la région sont AUTO — celui-ci vient de toi.</div>
          </div>
        </div>

        <div className="pv">
          <div className="pvhead">APERÇU LIVE — LE VRAI MUR</div>
          <div className="pe-wallhost">
            <ProgramWall school={school} />
            <div className="pe-tickwrap"><Ticker words={[{ text: tickerText, hot: false }]} /></div>
          </div>
          <div className="note" style={{ marginTop: 12 }}>Aperçu réel — c'est exactement le mur public. Les stats hero (hors-mur) : <b>{GRASSET.statEquipes} équipes · {nbath || "—"} athlètes · {villeTitle}</b></div>
        </div>
      </div>
    </section>
  );
}
