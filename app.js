/* European Party Atlas — reads data/parties.csv (built by the GitHub Action) */
(() => {
const SHEET_ID = "1MAdqaO7SU4uhjjbaDoTGdj7DPZ_NuWvjTnAcrUnTHY8";
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit?gid=0`;
const SOURCES = [
  "data/parties.csv",
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=0&headers=1`, // live fallback
  "data/sample.csv",
];

// Columns shown. Everything from "Documented Links…" onward is ignored by design.
const C = {
  status: "Status", iso: "ISO-2", country: "Country", native: "Name (Native)", name: "Name (English)",
  id: "Europe Elects Entity ID", ver: "Europe Elects Entity Version", verId: "Entity Version ID",
  legal: "National Legal ID", abbr: "Abbreviation", ideo: "Ideological Orientation",
  minority: "Legally Recognized Minority Party", sep: "Separatist", eu: "EU Integration Position",
  started: "Political Activity Started", ep: "Europarty Affiliation", epEnd: "Europarty End", epInt: "Europarty Interest to Join",
};
const SECTIONS = [
  ["Identity", ["Status","Country","Name (Native)","Name (English)","Abbreviation","Europe Elects Entity ID","Europe Elects Entity Version","Entity Version ID","National Legal ID"]],
  ["Profile", ["Ideological Orientation","EU Integration Position","Legally Recognized Minority Party","Separatist"]],
  ["Dates", ["Political Activity Started","Legal Entity Registration","Legal Entity Deregistration","Name Registration","Name Deregistration"]],
  ["European Parliament", ["European Parliament Group","EP Group Start","EP Group End","EP Interest to Join"]],
  ["Europarty", ["Europarty Affiliation","Europarty Start","Europarty End","Europarty Interest to Join"]],
  ["Other assemblies & federations", ["PACE Group","PACE Start","PACE End","International Party Federation","International Affiliation Start","International Affiliation End","Nordic Council Group","Nordic Council Start","Nordic Council End","CIS Affiliation","CIS Start","CIS End","Benelux Affiliation","Benelux Start","Benelux End","CLaRA Membership","CLaRA Start","CLaRA End","CoR Membership","CoR Start","CoR End"]],
];
const KEEP = new Set([...SECTIONS.flatMap(s => s[1]), "ISO-2"]);
const AFF = [
  ["PACE", "PACE Group"], ["EP group", "European Parliament Group"], ["Int'l federation", "International Party Federation"],
  ["Nordic Council", "Nordic Council Group"], ["CoR", "CoR Membership"], ["CLaRA", "CLaRA Membership"],
  ["CIS", "CIS Affiliation"], ["Benelux", "Benelux Affiliation"],
];

// Europarties, coloured by political family (conventional colours; every mark is also labelled).
const EP = [
  ["EPP", "#3d8fe0"], ["PES", "#db3b3b"], ["ALDE", "#e8a800"], ["EDP", "#eb6834"], ["EGP", "#2e9d4a"],
  ["EFA", "#8fbf3c"], ["ECR", "#0a6fa8"], ["PfE", "#2f2a7a"], ["ESN", "#7a5230"], ["EL", "#8e1b3a"],
  ["Volt", "#6b2fa0"], ["ECPM", "#1baf7a"],
];
const EP_COLOR = Object.fromEntries(EP);
const ALIAS = { "PATRIOTS": "PfE", "PATRIOTS.EU": "PfE", "PFE": "PfE", "ID": "PfE", "PEL": "EL", "EUROPEAN LEFT": "EL", "VOLT EUROPA": "Volt" };
const partyKey = v => ALIAS[v.toUpperCase()] || v;
const colorOf = k => EP_COLOR[k] || "#9b9a94";
const EU_ORDER = ["Strongly opposed","Opposed","Somewhat opposed","Neutral","Somewhat in favour","In favour","Strongly in favour"];
const EU_COLOR = ["#d03b3b","#e66767","#f3a9a8","var(--neutral)","#86b6ef","#3987e5","#1c5cab"];

// ISO-2 → ISO 3166 numeric (world-atlas ids); names for codes with no numeric id.
const NUM = {AX:"248",AL:"008",AD:"020",AM:"051",AT:"040",AZ:"031",BY:"112",BE:"056",BA:"070",BG:"100",HR:"191",CY:"196",
CZ:"203",DK:"208",EE:"233",FO:"234",FI:"246",FR:"250",GE:"268",DE:"276",GI:"292",GR:"300",GL:"304",GG:"831",HU:"348",
IS:"352",IE:"372",IM:"833",IT:"380",JE:"832",KZ:"398",LV:"428",LI:"438",LT:"440",LU:"442",MT:"470",MD:"498",MC:"492",
ME:"499",NL:"528",MK:"807",NO:"578",PL:"616",PT:"620",RO:"642",RU:"643",SM:"674",RS:"688",SK:"703",SI:"705",ES:"724",
SE:"752",CH:"756",TR:"792",UA:"804",GB:"826",VA:"336",IL:"376"};
const BY_NAME = {XK:"Kosovo", CY_N:"N. Cyprus"};

const $ = s => document.querySelector(s);
const tip = $("#tip");
const clean = v => { v = (v ?? "").toString().replace(/[​-‍﻿]/g, "").trim(); return v; };
const isNone = v => !v || /^unaffiliated$/i.test(v) || v === "-";
const fmt = d3.format(",");

let ALL = [], VIEW = [], state = { q: "", country: "", status: "active", ep: "", ideo: "", lean: true };
let sort = { key: "country", asc: true }, shown = 100, affTab = 0;

// ---------- load ----------
async function load() {
  for (const url of SOURCES) {
    try {
      const res = await fetch(url, { cache: "no-cache" });
      if (!res.ok) continue;
      const text = await res.text();
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
      const rows = parsed.data.filter(r => clean(r["Europe Elects Entity ID"]) || clean(r["Name (English)"]));
      if (!rows.length) continue;
      const stamp = res.headers.get("last-modified");
      return { rows, url, stamp };
    } catch (e) { /* try next */ }
  }
  throw new Error("No data source reachable");
}

function normalise(r) {
  const o = {};
  for (const k of Object.keys(r)) if (KEEP.has(k)) o[k] = clean(r[k]);
  o._status = (o.Status || "unknown").toLowerCase();
  // current Europarty membership (an end date means it's past); otherwise a stated interest to join
  const mem = (o[C.ep] || "").split(/[,;]/)[0].trim(), int = (o[C.epInt] || "").split(/[,;]/)[0].trim();
  const current = !isNone(mem) && !o[C.epEnd];
  o._lean = !current && !isNone(int) && !/^no$/i.test(int);
  o._ep = current ? partyKey(mem) : o._lean ? partyKey(int) : "";
  let eu = (o[C.eu] || "").toLowerCase();
  o._eu = EU_ORDER.find(x => x.toLowerCase() === eu) || "";
  const y = parseInt((o[C.started] || "").match(/\d{4}/)?.[0], 10);
  o._year = Number.isFinite(y) ? y : null;
  o._ver = parseInt(o[C.ver], 10) || 1;
  o._search = [o[C.name], o[C.native], o[C.abbr], o[C.id], o[C.country], o[C.legal]].join(" ").toLowerCase();
  return o;
}

// ---------- filtering ----------
function apply() {
  const q = state.q.toLowerCase();
  VIEW = ALL.filter(r =>
    (!state.status || r._status === state.status) &&
    (!state.country || r[C.iso] === state.country) &&
    (!state.ep || r._ep === state.ep && (state.lean || !r._lean)) &&
    (!state.ideo || r[C.ideo] === state.ideo) &&
    (!q || r._search.includes(q)));
  shown = 100;
  renderAll();
  syncHash();
}
function syncHash() {
  const h = new URLSearchParams();
  for (const k of ["q", "country", "status", "ep", "ideo"]) if (state[k]) h.set(k, state[k]);
  try { history.replaceState(null, "", "#" + h); } catch {}
}
const epOf = r => (r._ep && (state.lean || !r._lean)) ? r._ep : "";

function fillSelect(sel, values, label) {
  const cur = sel.value;
  sel.innerHTML = `<option value="">${label}</option>` + values.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join("");
  sel.value = cur;
}
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ---------- tooltip ----------
function showTip(ev, html) { tip.innerHTML = html; tip.style.opacity = 1; moveTip(ev); }
function moveTip(ev) {
  const w = tip.offsetWidth, h = tip.offsetHeight;
  let x = ev.clientX + 14, y = ev.clientY + 14;
  if (x + w > innerWidth - 8) x = ev.clientX - w - 14;
  if (y + h > innerHeight - 8) y = ev.clientY - h - 14;
  tip.style.left = x + "px"; tip.style.top = y + "px";
}
const hideTip = () => (tip.style.opacity = 0);

// ---------- KPIs ----------
function renderKPIs() {
  const ids = new Set(VIEW.map(r => r[C.id]));
  const countries = new Set(VIEW.map(r => r[C.iso]).filter(Boolean));
  const withEP = VIEW.filter(r => r._ep && !r._lean).length;
  const sep = VIEW.filter(r => /^yes/i.test(r[C.sep])).length;
  const minority = VIEW.filter(r => /^yes/i.test(r[C.minority])).length;
  const k = [
    [fmt(VIEW.length), "rows in view"], [fmt(ids.size), "distinct entities"], [fmt(countries.size), "countries & territories"],
    [VIEW.length ? Math.round(100 * withEP / VIEW.length) + "%" : "–", "in a Europarty"],
    [fmt(minority), "recognised minority parties"], [fmt(sep), "separatist"],
  ];
  $("#kpis").innerHTML = k.map(([v, l]) => `<div class="kpi"><div class="v">${v}</div><div class="l">${l}</div></div>`).join("");
}

// ---------- map ----------
let world = null;
async function loadWorld() {
  if (world) return world;
  const topo = await d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json");
  world = topojson.feature(topo, topo.objects.countries).features;
  return world;
}
async function renderMap() {
  const el = $("#map");
  let feats;
  try { feats = await loadWorld(); } catch { el.innerHTML = `<p class="sub">Map unavailable offline.</p>`; return; }
  // colour by counts ignoring the country filter, so the map stays useful when one is selected
  const base = ALL.filter(r => (!state.status || r._status === state.status) && (!state.ep || r._ep === state.ep) && (!state.ideo || r[C.ideo] === state.ideo) && (!state.q || r._search.includes(state.q.toLowerCase())));
  const cnt = d3.rollup(base, v => v.length, r => r[C.iso]);
  const iso2ByNum = Object.fromEntries(Object.entries(NUM).map(([a, n]) => [n, a]));
  const iso2ByName = Object.fromEntries(Object.entries(BY_NAME).map(([a, n]) => [n, a]));
  const isoOf = f => iso2ByNum[f.id] || iso2ByName[f.properties.name] || null;
  const names = Object.fromEntries(ALL.map(r => [r[C.iso], r[C.country]]));

  const W = el.clientWidth || 800, H = el.clientHeight || 600;
  const proj = d3.geoConicConformal().rotate([-12, 0]).center([0, 52]).parallels([35, 65]);
  proj.fitExtent([[0, 0], [W, H]], { type: "MultiPoint", coordinates: [[-24, 35], [44, 35], [44, 70], [-24, 70], [10, 71], [10, 34]] });
  const path = d3.geoPath(proj);
  const max = d3.max(cnt.values()) || 1;
  const color = d3.scaleSequentialLog([1, Math.max(2, max)], d3.interpolateRgb("#cde2fb", "#0d366b"));

  const svg = d3.select(el).selectAll("svg").data([0]).join("svg").attr("viewBox", `0 0 ${W} ${H}`);
  svg.selectAll("path.c").data(feats, d => d.id + (d.properties.name || ""))
    .join("path").attr("class", "c").attr("d", path)
    .attr("fill", d => { const n = cnt.get(isoOf(d)); return n ? color(n) : "var(--map-empty)"; })
    .classed("sel", d => state.country && isoOf(d) === state.country)
    .on("mousemove", (ev, d) => {
      const iso = isoOf(d), n = cnt.get(iso) || 0;
      showTip(ev, `<b>${esc(names[iso] || d.properties.name)}</b><br><span class="m">${n ? fmt(n) + " entities" : "No entries in view"}</span>`);
    })
    .on("mouseleave", hideTip)
    .on("click", (ev, d) => { const iso = isoOf(d); if (!cnt.get(iso)) return; setCountry(state.country === iso ? "" : iso); });
  svg.selectAll("path.c.sel").raise();
  $("#map-legend").innerHTML = `<span>1</span><span class="bar" style="background:linear-gradient(90deg,#cde2fb,#0d366b)"></span><span>${fmt(max)} entities (log scale)</span>`;
}
function setCountry(iso) { state.country = iso; $("#f-country").value = iso; apply(); }

// ---------- generic horizontal bars ----------
function hbars(el, data, { color = "var(--accent)", onClick, active, label = d => d.key, valueFmt = fmt } = {}) {
  const host = d3.select(el); host.selectAll("*").remove();
  if (!data.length) { host.append("p").attr("class", "sub").text("Nothing in view."); return; }
  const W = el.clientWidth || 360, row = 24, lw = Math.min(170, W * 0.42), pad = 40;
  const H = data.length * row + 4;
  const x = d3.scaleLinear([0, d3.max(data, d => d.value)], [0, W - lw - pad]);
  const svg = host.append("svg").attr("width", W).attr("height", H);
  const g = svg.selectAll("g").data(data).join("g").attr("transform", (d, i) => `translate(0,${i * row})`);
  g.append("rect").attr("class", "hit").attr("width", W).attr("height", row);
  g.append("text").attr("class", "lbl" + (onClick ? " clickable" : "")).attr("x", lw - 8).attr("y", row / 2).attr("dy", ".35em").attr("text-anchor", "end")
    .text(d => trunc(label(d), 26)).style("font-weight", d => active && active(d) ? 600 : null);
  g.append("rect").attr("x", lw).attr("y", 5).attr("height", row - 10).attr("rx", 3)
    .attr("width", d => Math.max(2, x(d.value))).attr("fill", d => typeof color === "function" ? color(d) : color)
    .attr("opacity", d => active && state.ideo && !active(d) ? 0.35 : 1);
  g.append("text").attr("class", "val").attr("x", d => lw + Math.max(2, x(d.value)) + 6).attr("y", row / 2).attr("dy", ".35em").text(d => valueFmt(d.value));
  g.on("mousemove", (ev, d) => showTip(ev, `<b>${esc(label(d))}</b><br><span class="m">${fmt(d.value)} entities</span>`)).on("mouseleave", hideTip);
  if (onClick) g.style("cursor", "pointer").on("click", (ev, d) => onClick(d));
}
const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

// ---------- EP totals ----------
function hatchDefs(svg) {
  const defs = svg.append("defs");
  [...EP, ["x", "#9b9a94"]].forEach(([k, c], i) => { if (k === "x") i = "x";
    const p = defs.append("pattern").attr("id", "h" + i).attr("patternUnits", "userSpaceOnUse").attr("width", 6).attr("height", 6).attr("patternTransform", "rotate(45)");
    p.append("rect").attr("width", 6).attr("height", 6).attr("fill", c).attr("opacity", 0.35);
    p.append("line").attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 6).attr("stroke", c).attr("stroke-width", 3);
  });
}
const hatchOf = k => { const i = EP.findIndex(e => e[0] === k); return i < 0 ? "url(#hx)" : `url(#h${i})`; };

function renderEPTotal() {
  const el = $("#ep-total"), host = d3.select(el); host.selectAll("*").remove();
  const keys = [...new Set(VIEW.map(r => r._ep).filter(Boolean))];
  const groups = keys.map(k => {
    const rows = VIEW.filter(r => r._ep === k && (state.lean || !r._lean));
    return { key: k, firm: rows.filter(r => !r._lean).length, lean: rows.filter(r => r._lean).length, color: colorOf(k) };
  }).filter(d => d.firm + d.lean).sort((a, b) => (b.firm + b.lean) - (a.firm + a.lean));
  if (!groups.length) { host.append("p").attr("class", "sub").text("No Europarty members in view."); return; }
  const W = el.clientWidth || 360, row = 30, lw = 92, pad = 50, H = groups.length * row;
  const x = d3.scaleLinear([0, d3.max(groups, d => d.firm + d.lean)], [0, W - lw - pad]);
  const svg = host.append("svg").attr("width", W).attr("height", H); hatchDefs(svg);
  const g = svg.selectAll("g.r").data(groups).join("g").attr("class", "r").attr("transform", (d, i) => `translate(0,${i * row})`).style("cursor", "pointer");
  g.append("rect").attr("class", "hit").attr("width", W).attr("height", row);
  g.append("text").attr("x", lw - 8).attr("y", row / 2).attr("dy", ".35em").attr("text-anchor", "end").text(d => d.key)
    .style("font-weight", d => state.ep === d.key ? 600 : null).style("fill", "var(--ink)");
  g.append("rect").attr("x", lw).attr("y", 6).attr("height", row - 12).attr("rx", 3).attr("width", d => Math.max(2, x(d.firm))).attr("fill", d => d.color);
  g.append("rect").attr("x", d => lw + x(d.firm) + (d.firm ? 2 : 0)).attr("y", 6).attr("height", row - 12).attr("rx", 3)
    .attr("width", d => d.lean ? Math.max(2, x(d.lean) - 2) : 0).attr("fill", d => hatchOf(d.key));
  g.append("text").attr("class", "val").attr("x", d => lw + x(d.firm + d.lean) + 6).attr("y", row / 2).attr("dy", ".35em").text(d => fmt(d.firm + d.lean));
  g.on("mousemove", (ev, d) => showTip(ev, `<b>${d.key}</b><br>${fmt(d.firm)} members<br>${fmt(d.lean)} interested in joining<br><span class="m">Click to filter</span>`))
   .on("mouseleave", hideTip)
   .on("click", (ev, d) => { state.ep = state.ep === d.key ? "" : d.key; $("#f-ep").value = state.ep; apply(); });
}

// ---------- left–right spectrum ----------
// Ideological orientation → position on a 0 (far-left) … 10 (far-right) scale. Unmatched labels are listed as "not placed".
const LR_RULES = [
  [/far[- ]?left|communis|marxis|trotsk|anti-capital/i, 0.6],
  [/far[- ]?right|neo-?fascis|ultra-?national/i, 9.4],
  [/centre[- ]?left|center[- ]?left|social[- ]?democra|labou?r/i, 3.4],
  [/centre[- ]?right|center[- ]?right|christian[- ]?democra|liberal[- ]?conservat/i, 6.6],
  [/left[- ]?wing|democratic socialis|socialis|eco-?socialis/i, 1.8],
  [/right[- ]?wing|national[- ]?conservat|nationalis|monarchis|right[- ]?populis|sovereign/i, 8.2],
  [/green|ecolog|environment/i, 2.8],
  [/agrarian/i, 5.6],
  [/liberal|libertarian/i, 5.6],
  [/conservat/i, 7.3],
  [/centris|centre|center|pro-?europe/i, 5.0],
];
const LR_TICKS = [[0.6, "Far-left"], [1.8, "Left"], [3.4, "Centre-left"], [5, "Centre"], [6.6, "Centre-right"], [8.2, "Right"], [9.4, "Far-right"]];
const hash = str => { let h = 2166136261; for (const ch of String(str)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const lrOf = r => { const v = r[C.ideo] || ""; for (const [re, x] of LR_RULES) if (re.test(v)) return x; return null; };

// EP group ring colours (actual EP group membership).
const EPG = [["EPP", "#3d8fe0"], ["S&D", "#db3b3b"], ["RE", "#e8a800"], ["Greens/EFA", "#2e9d4a"], ["ECR", "#0a6fa8"], ["PfE", "#2f2a7a"], ["ESN", "#7a5230"], ["Left", "#8e1b3a"], ["NI", "#9b9a94"]];
const EPG_COLOR = Object.fromEntries(EPG);
const EPG_ALIAS = { "RENEW": "RE", "RENEW EUROPE": "RE", "GREENS": "Greens/EFA", "GUE/NGL": "Left", "THE LEFT": "Left", "PATRIOTS": "PfE", "PATRIOTS FOR EUROPE": "PfE", "NON-INSCRITS": "NI" };
const epgOf = r => { const v = (r["European Parliament Group"] || "").trim(); if (isNone(v) || r["EP Group End"]) return ""; return EPG_ALIAS[v.toUpperCase()] || v; };

function renderSpectrum() {
  const fillSw = (c, o = 1) => `<i style="background:${c};opacity:${o};border-radius:50%"></i>`;
  const ringSw = c => `<i style="background:transparent;border:3px solid ${c};border-radius:50%;width:12px;height:12px"></i>`;
  $("#lr-legend").innerHTML =
    `<div><b>Fill · Europarty</b> ${EP.map(([k, c]) => `<span>${fillSw(c)}${k}</span>`).join("")}<span>${fillSw("#9b9a94")}Other</span><span>${fillSw("var(--neutral)")}None</span>${state.lean ? `<span>${fillSw("#3d8fe0", 0.35)}faded = interest to join</span>` : ""}</div>` +
    `<div><b>Ring · EP group</b> ${EPG.map(([k, c]) => `<span>${ringSw(c)}${k}</span>`).join("")}<span><i style="border:1px solid var(--muted);border-radius:50%;width:10px;height:10px"></i>none</span></div>`;

  const el = $("#lr"), host = d3.select(el); host.selectAll("*").remove();
  const placed = VIEW.filter(r => lrOf(r) != null), unplaced = VIEW.length - placed.length;
  const unplacedLabels = d3.rollups(VIEW.filter(r => lrOf(r) == null), v => v.length, r => r[C.ideo] || "not recorded").sort((a, b) => b[1] - a[1]);
  $("#lr-note").textContent = unplaced ? `${fmt(unplaced)} not placed (${unplacedLabels.slice(0, 4).map(([k, n]) => `${k} ${n}`).join(", ")}${unplacedLabels.length > 4 ? ", …" : ""}).` : "";
  if (!placed.length) { host.append("p").attr("class", "sub").text("No parties with a left–right placement in view."); return; }

  const W = el.clientWidth || 900, lw = Math.min(150, W * 0.3), pr = 16, top = 26;
  const R = placed.length > 900 ? 3.5 : placed.length > 350 ? 4.5 : 6;
  const x = d3.scaleLinear([0, 10], [lw + R + 4, W - pr - R]);
  const unit = x(1) - x(0), jx = Math.max(R, unit * 0.22), jmax = Math.max(R * 1.5, unit * 0.4); // horizontal scatter range
  // Rows = EU integration stance (most in favour on top), plus a band for parties with no recorded stance.
  const BANDS = [...EU_ORDER].reverse().concat(["No stance recorded"]);
  const groups = BANDS.map((name, bi) => ({ name, bi, rows: placed.filter(r => (r._eu || "No stance recorded") === name) }));

  // Each band is a beeswarm: dots pulled to their ideology position, collisions spread them up and down.
  let y0 = top;
  for (const g of groups) {
    // Stable pseudo-random jitter per party, so dots don't jump around between renders.
    const nodes = g.rows.map(r => {
      const h = hash(r[C.verId] || r[C.id] || r[C.name]);
      const tx = x(lrOf(r)) + (((h % 1000) / 1000) - 0.5) * jx * 2;
      return { r, tx, x: tx, y: ((((h >> 10) % 1000) / 1000) - 0.5) * 2 * R };
    });
    if (nodes.length) {
      const sim = d3.forceSimulation(nodes).force("x", d3.forceX(d => d.tx).strength(0.12)).force("y", d3.forceY(0).strength(0.05))
        .force("c", d3.forceCollide(R + 1.8).iterations(2)).stop();
      for (let i = 0; i < 220; i++) {
        sim.tick();
        nodes.forEach(n => (n.x = Math.max(n.tx - jmax, Math.min(n.tx + jmax, n.x)))); // stay near the ideology column
      }
      nodes.forEach(n => (n.x = Math.max(lw + R + 4, Math.min(W - pr - R, n.x))));
    }
    const [mn, mx] = nodes.length ? d3.extent(nodes, n => n.y) : [0, 0];
    const h = Math.max(36, mx - mn + 2 * R + 14);
    nodes.forEach(n => (n.y = y0 + h / 2 + n.y - (mn + mx) / 2));
    Object.assign(g, { nodes, y: y0, h }); y0 += h;
  }
  const H = y0 + 6;
  const svg = host.append("svg").attr("width", W).attr("height", H);

  // column grid (left–right) and row bands (EU stance)
  svg.append("g").selectAll("rect").data(groups).join("rect").attr("x", lw).attr("width", W - lw).attr("y", d => d.y).attr("height", d => d.h)
    .attr("fill", d => (d.bi % 2 ? "var(--wash)" : "transparent")).attr("opacity", 0.6);
  svg.append("g").attr("class", "grid").selectAll("line").data(LR_TICKS).join("line")
    .attr("x1", d => x(d[0])).attr("x2", d => x(d[0])).attr("y1", top - 4).attr("y2", H);
  svg.append("g").selectAll("text").data(LR_TICKS).join("text").attr("x", d => x(d[0])).attr("y", 14).attr("text-anchor", "middle")
    .style("fill", "var(--muted)").style("font-size", "11px").text(d => d[1]);

  const row = svg.selectAll("g.row").data(groups).join("g").attr("class", "row");
  row.append("rect").attr("x", lw - 10).attr("width", 4).attr("rx", 2).attr("y", d => d.y + 6).attr("height", d => d.h - 12)
    .attr("fill", d => d.bi < 7 ? EU_COLOR[6 - d.bi] : "transparent");
  row.append("text").attr("x", lw - 18).attr("y", d => d.y + d.h / 2).attr("dy", ".35em").attr("text-anchor", "end")
    .style("fill", d => d.bi < 7 ? "var(--ink-2)" : "var(--muted)").text(d => d.name);
  row.append("text").attr("x", W - pr).attr("y", d => d.y + 12).attr("text-anchor", "end").style("fill", "var(--muted)").style("font-size", "11px")
    .text(d => d.rows.length ? "n=" + d.rows.length : "");
  svg.append("text").attr("x", lw - 18).attr("y", 14).attr("text-anchor", "end").style("fill", "var(--muted)").style("font-size", "11px").text("EU stance");

  const nodes = groups.flatMap(g => g.nodes);
  svg.append("g").selectAll("circle").data(nodes).join("circle")
    .attr("cx", n => n.x).attr("cy", n => n.y).attr("r", R)
    .attr("fill", n => n.r._ep ? colorOf(n.r._ep) : "var(--neutral)")
    .attr("fill-opacity", n => n.r._lean ? 0.35 : 1)
    .attr("stroke", n => { const g = epgOf(n.r); return g ? (EPG_COLOR[g] || "#9b9a94") : "var(--muted)"; })
    .attr("stroke-width", n => (epgOf(n.r) ? 3 : 1))
    .style("cursor", "pointer")
    .on("mousemove", (ev, n) => {
      const r = n.r, g = epgOf(r);
      showTip(ev, `<b>${esc(r[C.name])}</b>${r[C.abbr] ? ` (${esc(r[C.abbr])})` : ""}<br><span class="m">${esc(r[C.country])} · ${esc(r[C.ideo])}</span><br>EU stance: ${esc(r._eu || "not recorded")}<br>Europarty: ${r._ep ? esc(r._ep) + (r._lean ? " (interest to join)" : "") : "none"}<br>EP group: ${g ? esc(g) : "none"}`);
    })
    .on("mouseleave", hideTip).on("click", (ev, n) => openDrawer(n.r));
}

// ---------- affiliations ----------
function renderAff() {
  $("#aff-tabs").innerHTML = AFF.map(([l], i) => `<button role="tab" aria-selected="${i === affTab}" data-i="${i}">${l}</button>`).join("");
  $("#aff-tabs").querySelectorAll("button").forEach(b => b.onclick = () => { affTab = +b.dataset.i; renderAff(); });
  const col = AFF[affTab][1];
  const vals = VIEW.flatMap(r => (r[col] || "").split(/[,;]/).map(s => s.trim()).filter(s => !isNone(s)));
  const data = d3.rollups(vals, v => v.length, d => d).map(([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value);
  hbars($("#aff"), data, { color: "var(--accent)" });
}

// ---------- table ----------
const COLS = [
  ["country", "Country", r => r[C.country]],
  ["abbr", "Abbr.", r => r[C.abbr]],
  ["name", "Party", r => r[C.name]],
  ["ideo", "Ideology", r => r[C.ideo]],
  ["eu", "EU stance", r => r._eu],
  ["ep", "Europarty", r => (r._ep ? r._ep + (r._lean ? " (interested)" : "") : "")],
  ["epg", "EP group", r => isNone(r["European Parliament Group"]) ? "" : r["European Parliament Group"]],
  ["year", "Since", r => r._year ?? ""],
  ["status", "Status", r => r._status],
];
function renderTable() {
  const get = COLS.find(c => c[0] === sort.key)[2];
  const rows = VIEW.slice().sort((a, b) => { const r = d3.ascending(get(a) || "￿", get(b) || "￿"); return sort.asc ? r : -r; });
  $("#tbl thead").innerHTML = "<tr>" + COLS.map(([k, l]) => `<th data-k="${k}" class="${sort.key === k ? "sorted" + (sort.asc ? " asc" : "") : ""}">${l}</th>`).join("") + "</tr>";
  $("#tbl thead").querySelectorAll("th").forEach(th => th.onclick = () => { const k = th.dataset.k; sort = { key: k, asc: sort.key === k ? !sort.asc : true }; renderTable(); });
  $("#tbl tbody").innerHTML = rows.slice(0, shown).map((r, i) => `<tr data-i="${ALL.indexOf(r)}">
    <td>${esc(r[C.country])}</td><td><b>${esc(r[C.abbr])}</b></td>
    <td>${esc(r[C.name])}<br><span class="native">${esc(trunc(r[C.native] || "", 48))}</span></td>
    <td>${esc(r[C.ideo])}</td><td>${esc(r._eu)}</td>
    <td>${r._ep ? `<span class="pill"><i style="background:${colorOf(r._ep)}"></i>${esc(r._ep)}${r._lean ? ' <span class="native">interested</span>' : ""}</span>` : ""}</td>
    <td>${esc(isNone(r["European Parliament Group"]) ? "" : r["European Parliament Group"])}</td>
    <td class="num">${r._year ?? ""}</td><td><span class="status">${esc(r._status)}</span></td></tr>`).join("");
  $("#tbl tbody").querySelectorAll("tr").forEach(tr => tr.onclick = () => openDrawer(ALL[+tr.dataset.i]));
  $("#tbl-count").textContent = `${fmt(rows.length)} rows · showing ${fmt(Math.min(shown, rows.length))}. Click a row for full details and version history.`;
  $("#more").style.display = rows.length > shown ? "block" : "none";
}

// ---------- drawer ----------
function openDrawer(r) {
  const versions = ALL.filter(x => x[C.id] === r[C.id]).sort((a, b) => a._ver - b._ver);
  const val = v => (v ? esc(v) : '<span style="color:var(--muted)">—</span>');
  $("#drawer-body").innerHTML = `
    <h3>${esc(r[C.name])} ${r[C.abbr] ? `<span style="color:var(--muted);font-weight:400">(${esc(r[C.abbr])})</span>` : ""}</h3>
    <div class="native">${esc(r[C.native])} · ${esc(r[C.country])}</div>
    ${versions.length > 1 ? `<h4>Version history</h4>${versions.map(v => `<div class="ver ${v === r ? "cur" : ""}" data-i="${ALL.indexOf(v)}"><b>v${v._ver}</b> · ${esc(v[C.native])} · <span class="status">${esc(v._status)}</span> ${v._ep ? "· " + esc(v._ep) + (v._lean ? " (interested)" : "") : ""}</div>`).join("")}` : ""}
    ${SECTIONS.map(([t, ks]) => {
      const items = ks.filter(k => t === "Identity" || t === "Profile" || (r[k] && !isNone(r[k])));
      if (!items.length) return "";
      return `<h4>${t}</h4><dl>${items.map(k => `<dt>${esc(k)}</dt><dd>${val(r[k])}</dd>`).join("")}</dl>`;
    }).join("")}`;
  $("#drawer-body").querySelectorAll(".ver").forEach(el => el.onclick = () => openDrawer(ALL[+el.dataset.i]));
  $("#drawer").classList.add("open"); $("#drawer").setAttribute("aria-hidden", "false");
}
const closeDrawer = () => { $("#drawer").classList.remove("open"); $("#drawer").setAttribute("aria-hidden", "true"); };

function renderAll() { renderKPIs(); renderMap(); renderEPTotal(); renderSpectrum(); renderAff(); renderTable(); }

// ---------- boot ----------
async function boot() {
  $("#src-link").href = SHEET_URL;
  // theme toggle
  try { const t = localStorage.getItem("theme"); if (t) document.documentElement.dataset.theme = t; } catch {}
  $("#theme").onclick = () => {
    const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.dataset.theme = dark ? "light" : "dark";
    try { localStorage.setItem("theme", document.documentElement.dataset.theme); } catch {}
  };

  let data;
  try { data = await load(); } catch (e) { $("#data-stamp").textContent = "could not load data"; return; }
  ALL = data.rows.map(normalise);
  const fromSample = data.url.includes("sample");
  $("#data-stamp").textContent = `${fmt(ALL.length)} rows${fromSample ? " (sample data)" : ""}${data.stamp ? " · updated " + new Date(data.stamp).toLocaleDateString() : ""}`;

  const countries = [...d3.rollup(ALL, v => v[0][C.country], r => r[C.iso])].filter(([k]) => k).sort((a, b) => d3.ascending(a[1], b[1]));
  fillSelect($("#f-country"), countries.map(([iso, n]) => [iso, n]), "All countries");
  const statuses = d3.rollups(ALL, v => v.length, r => r._status).sort((a, b) => b[1] - a[1]);
  $("#f-status").innerHTML = `<option value="">All statuses</option>` + statuses.map(([s, n]) => `<option value="${esc(s)}">${esc(s)} (${n})</option>`).join("");
  if (!statuses.some(s => s[0] === "active")) state.status = "";
  $("#f-status").value = state.status;
  const eps = [...new Set(ALL.map(r => r._ep).filter(Boolean))].sort((a, b) => (EP.findIndex(e => e[0] === a) + 1 || 99) - (EP.findIndex(e => e[0] === b) + 1 || 99));
  fillSelect($("#f-ep"), eps.map(e => [e, e]), "All Europarties");
  const ideos = [...new Set(ALL.map(r => r[C.ideo]).filter(Boolean))].sort();
  fillSelect($("#f-ideo"), ideos.map(e => [e, e]), "All ideologies");

  // URL state (shareable links)
  const p = new URLSearchParams(location.hash.slice(1));
  for (const k of ["q", "country", "status", "ep", "ideo"]) if (p.has(k)) state[k] = p.get(k);
  $("#q").value = state.q; $("#f-country").value = state.country; $("#f-status").value = state.status; $("#f-ep").value = state.ep; $("#f-ideo").value = state.ideo;

  const on = (sel, k, ev = "change") => $(sel).addEventListener(ev, e => { state[k] = e.target.value; apply(); });
  on("#q", "q", "input"); on("#f-country", "country"); on("#f-status", "status"); on("#f-ep", "ep"); on("#f-ideo", "ideo");
  $("#f-lean").onchange = e => { state.lean = e.target.checked; apply(); };
  $("#reset").onclick = () => { state = { q: "", country: "", status: statuses.some(s => s[0] === "active") ? "active" : "", ep: "", ideo: "", lean: true };
    $("#q").value = ""; ["#f-country", "#f-ep", "#f-ideo"].forEach(s => $(s).value = ""); $("#f-status").value = state.status; $("#f-lean").checked = true; apply(); };
  $("#more").onclick = () => { shown += 200; renderTable(); };
  $("#drawer-close").onclick = closeDrawer;
  addEventListener("keydown", e => e.key === "Escape" && closeDrawer());
  let t; addEventListener("resize", () => { clearTimeout(t); t = setTimeout(renderAll, 150); });
  apply();
}
boot();
})();
