import { useState, useEffect, useMemo } from "react";

/* ── #100AIExperiments · Flight Log ─────────────────────────
   Gantt timeline of the series. Bars span build-start → publish.
   All data editable; persisted via window.storage.
   Tokens match rianago.com v6 (System / Paper).              */

const CATS = {
  game:    { en: "Game",    fr: "Jeu",        c: "#E2573F" },
  web:     { en: "Website", fr: "Site",       c: "#5B8DB8" },
  image:   { en: "Image",   fr: "Image",      c: "#C9A227" },
  agent:   { en: "Agent",   fr: "Agent",      c: "#7A9E7E" },
  edu:     { en: "Education", fr: "Éducation", c: "#A07CB0" },
  tool:    { en: "Tool",    fr: "Outil",      c: "#8A8F98" },
};

/* Pre-filled from our shared history — dates & hours are ESTIMATES
   until you edit them (est:true shows the ~ marker). */
const SEED = [
  { id:"e1",  n:1,  name:"Experiment 1",              cat:"image", start:"2026-06-01", pub:"2026-06-02", hrs:3,  est:true, thread:"Série 1–2" },
  { id:"e2",  n:2,  name:"Experiment 2",              cat:"image", start:"2026-06-03", pub:"2026-06-04", hrs:3,  est:true, thread:"Série 1–2" },
  { id:"e3",  n:3,  name:"Experiment 3",              cat:"web",   start:"2026-06-08", pub:"2026-06-09", hrs:3,  est:true },
  { id:"e4",  n:4,  name:"Career Quiz",               cat:"edu",   start:"2026-06-09", pub:"2026-06-11", hrs:6,  est:true, thread:"École" },
  { id:"e5",  n:5,  name:"Plan de vol · Eurosatory",  cat:"web",   start:"2026-06-10", pub:"2026-06-14", hrs:9,  est:true, thread:"Eurosatory" },
  { id:"e6",  n:6,  name:"CIEL CLAIR",                cat:"game",  start:"2026-06-12", pub:"2026-06-16", hrs:9,  est:true, thread:"Eurosatory" },
  { id:"e7",  n:7,  name:"Eurosatory Hub",            cat:"web",   start:"2026-06-17", pub:"2026-06-18", hrs:3,  est:true, thread:"Eurosatory" },
  { id:"e8",  n:8,  name:"Cosmic Whack-A-Mole",       cat:"game",  start:"2026-06-22", pub:"2026-06-25", hrs:6,  est:true },
  { id:"e9",  n:9,  name:"Agents Infographic",        cat:"edu",   start:"2026-07-01", pub:"2026-07-02", hrs:4,  est:true },
  { id:"e10", n:10, name:"Meeting Survivor",          cat:"game",  start:"2026-07-05", pub:"2026-07-07", hrs:6,  est:true },
  { id:"e11", n:11, name:"La Tapette!",               cat:"game",  start:"2026-07-08", pub:"2026-07-09", hrs:5,  est:true },
  { id:"e12", n:12, name:"Feu d'artifice · 14 juillet", cat:"game", start:"2026-07-10", pub:"2026-07-14", hrs:4, est:true },
];

const T = {
  en: { title:"Flight Log", sub:"Build timeline of the #100AIExperiments series", total:"hours logged", avg:"avg / experiment", shipped:"shipped", edit:"Edit", done:"Done", add:"+ Add experiment", del:"Delete", name:"Name", cat:"Category", start:"Build start", pub:"Published", hrs:"Hours", est:"~ estimated — tap Edit to correct", reset:"Reset to estimates", hint:"Bars span build start → publish date. Number at right = hours of work.", viewFlat:"Timeline", viewGroup:"By category", items:"items", thread:"Series (links experiments)" },
  fr: { title:"Journal de bord", sub:"Chronologie de fabrication de la série #100AIExperiments", total:"heures cumulées", avg:"moy. / expérience", shipped:"publiées", edit:"Modifier", done:"Terminé", add:"+ Ajouter une expérience", del:"Supprimer", name:"Nom", cat:"Catégorie", start:"Début", pub:"Publication", hrs:"Heures", est:"~ estimé — touchez Modifier pour corriger", reset:"Réinitialiser", hint:"Les barres vont du début de fabrication à la publication. Chiffre à droite = heures de travail.", viewFlat:"Chronologie", viewGroup:"Par catégorie", items:"éléments", thread:"Série (relie les expériences)" },
};

const d2n = (s) => new Date(s + "T00:00:00").getTime();
const DAY = 86400000;
const fmt = (s, lang) => new Date(s + "T00:00:00").toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { day:"numeric", month:"short" });

export default function ExperimentsGantt() {
  const [dark, setDark] = useState(true);
  const [lang, setLang] = useState("en");
  const [rows, setRows] = useState(SEED);
  const [editing, setEditing] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [grouped, setGrouped] = useState(false);
  const [open, setOpen] = useState({ game: true });
  const t = T[lang];

  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get("gantt-experiments");
        if (r?.value) setRows(JSON.parse(r.value));
      } catch (e) { /* first run — seed stays */ }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    (async () => {
      try { await window.storage.set("gantt-experiments", JSON.stringify(rows)); }
      catch (e) { console.error("save failed", e); }
    })();
  }, [rows, loaded]);

  const range = useMemo(() => {
    const min = Math.min(...rows.map(r => d2n(r.start)));
    const max = Math.max(...rows.map(r => d2n(r.pub))) + DAY;
    return { min, span: Math.max(max - min, DAY * 14) };
  }, [rows]);

  const weeks = useMemo(() => {
    const out = [];
    let d = new Date(range.min);
    d.setDate(d.getDate() - d.getDay() + 1); // Monday
    while (d.getTime() < range.min + range.span) {
      out.push(new Date(d)); d = new Date(d.getTime() + 7 * DAY);
    }
    return out;
  }, [range]);

  const totalH = rows.reduce((s, r) => s + (+r.hrs || 0), 0);
  const pct = (ts) => ((ts - range.min) / range.span) * 100;

  const groups = useMemo(() =>
    Object.keys(CATS)
      .map(cat => {
        const items = rows.filter(r => r.cat === cat).sort((a, b) => d2n(a.start) - d2n(b.start));
        if (!items.length) return null;
        return {
          cat, items,
          start: Math.min(...items.map(r => d2n(r.start))),
          end: Math.max(...items.map(r => d2n(r.pub))) + DAY,
          hrs: items.reduce((s, r) => s + (+r.hrs || 0), 0),
          est: items.some(r => r.est),
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.hrs - a.hrs),
  [rows]);
  const upd = (id, k, v) => setRows(rs => rs.map(r => r.id === id ? { ...r, [k]: v, est: false } : r));
  const addRow = () => {
    const n = Math.max(...rows.map(r => r.n)) + 1;
    const today = new Date().toISOString().slice(0, 10);
    const nr = { id:"e" + Date.now(), n, name:"Experiment " + n, cat:"tool", start:today, pub:today, hrs:3, est:false };
    setRows(rs => [...rs, nr]); setEditing(nr.id);
  };

  const th = dark
    ? { bg:"#0A0C10", bg2:"#10141B", line:"rgba(233,230,223,.09)", text:"#E9E6DF", mid:"#A7ABB3", muted:"#6E737D", red:"#E2573F" }
    : { bg:"#F9F7F4", bg2:"#F2EEEA", line:"rgba(26,24,20,.1)", text:"#1A1814", mid:"#5A564E", muted:"#8A857B", red:"#C7452F" };

  const mono = "'JetBrains Mono', monospace";
  const serif = "'Fraunces', Georgia, serif";
  const sans = "'DM Sans', sans-serif";
  const inp = { background:th.bg, color:th.text, border:`1px solid ${th.line}`, borderRadius:6, padding:"6px 8px", fontFamily:sans, fontSize:13, width:"100%" };

  return (
    <div style={{ minHeight:"100vh", background:th.bg, color:th.text, fontFamily:sans, transition:"background .3s" }}>
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=DM+Sans:opsz,wght@9..40,400;9..40,500&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <div style={{ maxWidth:960, margin:"0 auto", padding:"32px 20px 64px" }}>

        {/* header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12, flexWrap:"wrap" }}>
          <div>
            <p style={{ fontFamily:mono, fontSize:11, letterSpacing:"0.14em", color:th.red, textTransform:"uppercase", margin:0 }}>#100AIExperiments</p>
            <h1 style={{ fontFamily:serif, fontWeight:600, fontSize:"clamp(28px,5vw,40px)", margin:"6px 0 4px" }}>{t.title}</h1>
            <p style={{ color:th.mid, fontSize:14, margin:0 }}>{t.sub}</p>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            {[[grouped ? t.viewFlat : t.viewGroup, () => setGrouped(g => !g)], ["EN/FR", () => setLang(l => l === "en" ? "fr" : "en")], [dark ? "☀" : "●", () => setDark(v => !v)]].map(([lbl, fn], i) => (
              <button key={i} onClick={fn} style={{ background: i === 0 ? th.bg2 : "transparent", color: i === 0 ? th.text : th.mid, border:`1px solid ${th.line}`, borderRadius:6, padding:"6px 12px", fontFamily:mono, fontSize:12, cursor:"pointer" }}>{lbl}</button>
            ))}
          </div>
        </div>

        {/* stats strip */}
        <div style={{ display:"flex", gap:0, border:`1px solid ${th.line}`, borderRadius:6, margin:"24px 0 8px", overflow:"hidden" }}>
          {[[rows.length, t.shipped], [totalH + "h", t.total], [(rows.length ? (totalH / rows.length).toFixed(1) : 0) + "h", t.avg]].map(([v, l], i) => (
            <div key={i} style={{ flex:1, padding:"14px 16px", background:i === 1 ? th.bg2 : "transparent", borderLeft:i ? `1px solid ${th.line}` : "none" }}>
              <div style={{ fontFamily:serif, fontSize:26, fontWeight:600, color:i === 1 ? th.red : th.text }}>{v}</div>
              <div style={{ fontFamily:mono, fontSize:10, letterSpacing:"0.1em", textTransform:"uppercase", color:th.muted }}>{l}</div>
            </div>
          ))}
        </div>
        <p style={{ fontFamily:mono, fontSize:11, color:th.muted, margin:"0 0 20px" }}>{t.hint}</p>

        {/* gantt */}
        <div style={{ position:"relative", border:`1px solid ${th.line}`, borderRadius:6, background:th.bg2, padding:"36px 0 12px", overflow:"hidden" }}>
          {weeks.map((w, i) => (
            <div key={i} style={{ position:"absolute", top:0, bottom:0, left:pct(w.getTime()) + "%" }}>
              <div style={{ width:1, height:"100%", background:th.line }} />
              <span style={{ position:"absolute", top:8, left:6, fontFamily:mono, fontSize:10, color:th.muted, whiteSpace:"nowrap" }}>
                {w.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { day:"numeric", month:"short" })}
              </span>
            </div>
          ))}
          {(() => {
            const endPct = (r) => pct(d2n(r.pub) + DAY);
            const seg = (r, top) => {
              const l = pct(d2n(r.start)), wd = Math.max(endPct(r) - l, 1.5);
              const col = CATS[r.cat]?.c || th.mid;
              return (
                <div key={r.id} onClick={(e) => { e.stopPropagation(); setEditing(editing === r.id ? null : r.id); }}
                     style={{ position:"absolute", left:l + "%", width:wd + "%", top, height:20, background:col, opacity:dark ? .9 : 1, borderRadius:6, display:"flex", alignItems:"center", paddingLeft:8, minWidth:56, cursor:"pointer" }}>
                  <span style={{ fontFamily:sans, fontSize:11, fontWeight:500, color:"#fff", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                    #{r.n} {r.name}
                  </span>
                </div>
              );
            };
            const hourTag = (leftPct, top, txt, col, bold) => (
              <span style={{ position:"absolute", left:`calc(${Math.min(leftPct, 84)}% + 8px)`, top, fontFamily:mono, fontSize:11, fontWeight:bold ? 500 : 400, color:col, whiteSpace:"nowrap" }}>{txt}</span>
            );

            /* ── TIMELINE: threads render as expandable envelopes ── */
            if (!grouped) {
              const sorted = [...rows].sort((a, b) => d2n(a.start) - d2n(b.start));
              const lanes = []; const idx = {};
              sorted.forEach(r => {
                const k = (r.thread || "").trim();
                if (k && idx[k] != null) lanes[idx[k]].push(r);
                else { if (k) idx[k] = lanes.length; lanes.push([r]); }
              });
              return lanes.map((items, gi) => {
                if (items.length === 1) {
                  const r = items[0];
                  return (
                    <div key={r.id} style={{ position:"relative", height:34 }}>
                      {seg(r, 7)}
                      {hourTag(endPct(r), 10, (r.est ? "~" : "") + r.hrs + "h", th.mid)}
                    </div>
                  );
                }
                const key = "t:" + items[0].thread, isOpen = !!open[key];
                const col = CATS[items[0].cat]?.c || th.mid;
                const start = d2n(items[0].start);
                const end = Math.max(...items.map(r => d2n(r.pub))) + DAY;
                const l = pct(start), wd = Math.max(pct(end) - l, 2);
                const hrs = items.reduce((s, r) => s + (+r.hrs || 0), 0);
                const est = items.some(r => r.est);
                return (
                  <div key={gi}>
                    <div style={{ position:"relative", height:42 }}>
                      <div onClick={() => setOpen(o => ({ ...o, [key]: !o[key] }))}
                           style={{ position:"absolute", left:l + "%", width:wd + "%", top:6, height:28, border:`1.5px solid ${col}`, background:col + (dark ? "22" : "1A"), borderRadius:6, display:"flex", alignItems:"center", gap:6, padding:"0 8px", minWidth:100, cursor:"pointer" }}>
                        <span style={{ fontFamily:mono, fontSize:10, color:col }}>{isOpen ? "▾" : "▸"}</span>
                        <span style={{ fontFamily:sans, fontSize:11, fontWeight:500, color:th.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                          {items[0].thread} · {items.length}
                        </span>
                      </div>
                      {hourTag(l + wd, 13, (est ? "~" : "") + hrs + "h", col, true)}
                    </div>
                    {isOpen && items.map(r => (
                      <div key={r.id} style={{ position:"relative", height:34 }}>
                        {seg(r, 7)}
                        {hourTag(endPct(r), 10, (r.est ? "~" : "") + r.hrs + "h", th.mid)}
                      </div>
                    ))}
                  </div>
                );
              });
            }

            /* ── BY CATEGORY: one line per category, split into
                  time-proximity clusters (gap ≤ 4 days) ── */
            const GAP = 4 * DAY;
            return groups.map(g => {
              const col = CATS[g.cat].c;
              const clusters = [];
              g.items.forEach(r => {
                const last = clusters[clusters.length - 1];
                if (last && d2n(r.start) - last.end <= GAP) {
                  last.items.push(r); last.end = Math.max(last.end, d2n(r.pub) + DAY);
                } else clusters.push({ items:[r], start:d2n(r.start), end:d2n(r.pub) + DAY });
              });
              return (
                <div key={g.cat}>
                  <div style={{ position:"relative", height:42 }}>
                    {clusters.map((c, ci) => {
                      const key = g.cat + ":" + ci, isOpen = !!open[key];
                      const l = pct(c.start), wd = Math.max(pct(c.end) - l, 2);
                      const h = c.items.reduce((s, r) => s + (+r.hrs || 0), 0);
                      const ce = c.items.some(r => r.est);
                      return (
                        <div key={ci} onClick={() => setOpen(o => ({ ...o, [key]: !o[key] }))}
                             style={{ position:"absolute", left:l + "%", width:wd + "%", top:6, height:28, border:`1.5px solid ${col}`, background:col + (dark ? "22" : "1A"), borderRadius:6, display:"flex", alignItems:"center", gap:6, padding:"0 8px", minWidth:86, cursor:"pointer" }}>
                          <span style={{ fontFamily:mono, fontSize:10, color:col }}>{isOpen ? "▾" : "▸"}</span>
                          <span style={{ fontFamily:sans, fontSize:11, fontWeight:500, color:th.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                            {ci === 0 ? CATS[g.cat][lang] + " · " : "×"}{c.items.length} · {ce ? "~" : ""}{h}h
                          </span>
                        </div>
                      );
                    })}
                    <span style={{ position:"absolute", right:8, top:13, fontFamily:mono, fontSize:12, fontWeight:500, color:col }}>
                      Σ {g.est ? "~" : ""}{g.hrs}h
                    </span>
                  </div>
                  {clusters.map((c, ci) => !!open[g.cat + ":" + ci] && c.items.map(r => (
                    <div key={r.id} style={{ position:"relative", height:34 }}>
                      {seg(r, 7)}
                      {hourTag(endPct(r), 10, (r.est ? "~" : "") + r.hrs + "h", th.mid)}
                    </div>
                  )))}
                  <div style={{ height:6 }} />
                </div>
              );
            });
          })()}
        </div>

        {/* legend */}
        <div style={{ display:"flex", gap:14, flexWrap:"wrap", margin:"14px 2px 24px" }}>
          {Object.entries(CATS).map(([k, v]) => (
            <span key={k} style={{ fontFamily:mono, fontSize:11, color:th.mid, display:"flex", alignItems:"center", gap:6 }}>
              <i style={{ width:10, height:10, borderRadius:3, background:v.c, display:"inline-block" }} />{v[lang]}
            </span>
          ))}
        </div>

        {/* editor */}
        {rows.some(r => r.est) && <p style={{ fontFamily:mono, fontSize:11, color:th.red, margin:"0 0 12px" }}>{t.est}</p>}
        {editing && (() => {
          const r = rows.find(x => x.id === editing); if (!r) return null;
          return (
            <div style={{ border:`1px solid ${th.line}`, borderRadius:6, padding:16, background:th.bg2, marginBottom:16 }}>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:10 }}>
                <label style={{ fontFamily:mono, fontSize:10, color:th.muted, textTransform:"uppercase" }}>{t.name}
                  <input style={inp} value={r.name} onChange={e => upd(r.id, "name", e.target.value)} /></label>
                <label style={{ fontFamily:mono, fontSize:10, color:th.muted, textTransform:"uppercase" }}>{t.cat}
                  <select style={inp} value={r.cat} onChange={e => upd(r.id, "cat", e.target.value)}>
                    {Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{v[lang]}</option>)}
                  </select></label>
                <label style={{ fontFamily:mono, fontSize:10, color:th.muted, textTransform:"uppercase" }}>{t.start}
                  <input type="date" style={inp} value={r.start} onChange={e => upd(r.id, "start", e.target.value)} /></label>
                <label style={{ fontFamily:mono, fontSize:10, color:th.muted, textTransform:"uppercase" }}>{t.pub}
                  <input type="date" style={inp} value={r.pub} onChange={e => upd(r.id, "pub", e.target.value)} /></label>
                <label style={{ fontFamily:mono, fontSize:10, color:th.muted, textTransform:"uppercase" }}>{t.hrs}
                  <input type="number" min="0" step="0.5" style={inp} value={r.hrs} onChange={e => upd(r.id, "hrs", +e.target.value)} /></label>
                <label style={{ fontFamily:mono, fontSize:10, color:th.muted, textTransform:"uppercase" }}>{t.thread}
                  <input style={inp} value={r.thread || ""} placeholder="Eurosatory…" onChange={e => upd(r.id, "thread", e.target.value)} /></label>
              </div>
              <div style={{ display:"flex", gap:8, marginTop:12 }}>
                <button onClick={() => setEditing(null)} style={{ background:th.red, color:"#fff", border:"none", borderRadius:6, padding:"8px 16px", fontFamily:sans, fontSize:13, cursor:"pointer" }}>{t.done}</button>
                <button onClick={() => { setRows(rs => rs.filter(x => x.id !== r.id)); setEditing(null); }} style={{ background:"transparent", color:th.muted, border:`1px solid ${th.line}`, borderRadius:6, padding:"8px 16px", fontFamily:sans, fontSize:13, cursor:"pointer" }}>{t.del}</button>
              </div>
            </div>
          );
        })()}

        <div style={{ display:"flex", gap:8 }}>
          <button onClick={addRow} style={{ background:"transparent", color:th.text, border:`1px solid ${th.line}`, borderRadius:6, padding:"10px 16px", fontFamily:sans, fontSize:13, cursor:"pointer" }}>{t.add}</button>
          <button onClick={() => setRows(SEED)} style={{ background:"transparent", color:th.muted, border:`1px solid ${th.line}`, borderRadius:6, padding:"10px 16px", fontFamily:sans, fontSize:13, cursor:"pointer" }}>{t.reset}</button>
        </div>
      </div>
    </div>
  );
}
