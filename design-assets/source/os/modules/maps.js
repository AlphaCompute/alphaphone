/* Maps. Holes are {{maps.*}}. The map is drawn in SVG (world units = px at scale 1), pins/labels are HTML overlays.
   State keys double as deep links: {query}, {place}, {directions}. */
IC.mapsLoc = IC.mapsLoc || "M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M18 12a6 6 0 1 1-12 0a6 6 0 1 1 12 0zM13.2 12a1.2 1.2 0 1 1-2.4 0a1.2 1.2 0 1 1 2.4 0z";
IC.mapsNav = IC.mapsNav || "M12 3l7 18-7-4-7 4z";
IC.mapsRoute = IC.mapsRoute || "M6 19a2 2 0 1 1 0-.01M18 7a2 2 0 1 1 0-.01M6 17V11a4 4 0 0 1 4-4h6";
IC.mapsCar = IC.mapsCar || "M4 17V13l2-5.5A1.5 1.5 0 0 1 7.4 6.5h9.2A1.5 1.5 0 0 1 18 7.5L20 13v4zM4 13h16M4 17v2.5h3V17M17 17v2.5h3V17M7.5 15h.01M16.5 15h.01";
IC.mapsBus = IC.mapsBus || "M7 3.5h10a2 2 0 0 1 2 2V16a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 16V5.5a2 2 0 0 1 2-2zM5 11h14M8 17.5V20M16 17.5V20M8.5 14.3h.01M15.5 14.3h.01";
IC.mapsWalk = IC.mapsWalk || "M14 4.5a1.5 1.5 0 1 1-3 0a1.5 1.5 0 1 1 3 0zM9 21l2.5-6.5L14 17v4M11.5 14.5L12.5 9l-3 1.5V14M12.5 9l2 3.5 3 1";
IC.mapsBike = IC.mapsBike || "M9 16.5a3.5 3.5 0 1 1-7 0a3.5 3.5 0 1 1 7 0zM22 16.5a3.5 3.5 0 1 1-7 0a3.5 3.5 0 1 1 7 0zM5.5 16.5L9 9.5h6.5l3 7M12.5 16.5L9 9.5M8 7h3M15 6.5h2l-1.5 3";
IC.mapsLeft = IC.mapsLeft || "M16 20v-7.5A3.5 3.5 0 0 0 12.5 9H6M10 5L6 9l4 4";
IC.mapsRight = IC.mapsRight || "M8 20v-7.5A3.5 3.5 0 0 1 11.5 9H18M14 5l4 4-4 4";
IC.mapsStraight = IC.mapsStraight || "M12 20V5M7 10l5-5 5 5";
IC.mapsVol = IC.mapsVol || "M4 9.5h3.5L12 5.5v13l-4.5-4H4zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11";
IC.mapsMute = IC.mapsMute || "M4 9.5h3.5L12 5.5v13l-4.5-4H4zM16 10l4 4M20 10l-4 4";
IC.mapsCup = IC.mapsCup || "M5 9h11v4.5A4.5 4.5 0 0 1 11.5 18h-2A4.5 4.5 0 0 1 5 13.5zM16 10.5h1.5a2.3 2.3 0 0 1 0 4.6H16M8 3.5v2.5M12 3.5v2.5M4 21h13";
IC.mapsFood = IC.mapsFood || "M7 3v7M5 3v5a2 2 0 0 0 4 0V3M7 10v11M17 3c-2.2 1.2-3.2 3.6-3.2 6.5V13H17M17 3v18";
IC.mapsGym = IC.mapsGym || "M7 7v10M4 9.5v5M17 7v10M20 9.5v5M7 12h10";
IC.mapsWork = IC.mapsWork || "M4 8h16v11H4zM9 8V5h6v3M4 13h16";
IC.mapsHome = IC.mapsHome || "M4 11l8-7 8 7M6.5 9v11h11V9";

var MAPS_ME = [608, 832];
var MAPS_WW = 1200, MAPS_WH = 3200;
var MAPS_H = { 640: "Mission St", 704: "Howard St", 832: "Folsom St", 896: "Harrison St", 1216: "18th St", 1344: "Liberty St" };
var MAPS_V = { 768: "2nd St", 704: "3rd St", 640: "4th St", 576: "5th St", 512: "7th St", 384: "Valencia St", 320: "Guerrero St" };
var MAPS_MODES = [["drive", "mapsCar", "Drive"], ["transit", "mapsBus", "Transit"], ["walk", "mapsWalk", "Walk"], ["bike", "mapsBike", "Bike"]];
/* min: [drive, transit, walk, bike]; open: [from, to] in hours, null = 24h, "none" = no hours (home) */
var MAPS_PLACES = [
  { id: "tartine", name: "Tartine", cat: "Bakery", area: "Guerrero St", addr: "600 Guerrero St", x: 320, y: 1216, icon: "mapsFood", mi: 1.9, min: [11, 22, 38, 13], open: [7.5, 17], phone: "(415) 555-0172", web: "tartinebakery.com", pid: "priya", tags: "lunch bakery food bread cafe priya tartine",
    pts: [[608, 832], [384, 832], [384, 1216], [320, 1216]] },
  { id: "gym", name: "Equinox SoMa", cat: "Gym", area: "4th St", addr: "4th St & Howard St", x: 640, y: 704, icon: "mapsGym", mi: 0.4, min: [3, 6, 8, 3], open: [5, 22], phone: "(415) 555-0126", web: "equinox.com", tags: "gym workout fitness equinox",
    pts: [[608, 832], [640, 832], [640, 704]] },
  { id: "lumen", name: "Lumen studio", cat: "Office", area: "2nd St", addr: "2nd St & Mission St", x: 768, y: 640, icon: "mapsWork", mi: 0.6, min: [4, 9, 12, 5], open: [9, 19], pid: "maya", phone: "(415) 555-0190", web: "lumen.example", tags: "work office studio lumen maya",
    pts: [[608, 832], [768, 832], [768, 640]] },
  { id: "home", name: "Home", cat: "Home", area: "Liberty St", addr: "Liberty St, Dolores Heights", x: 224, y: 1344, icon: "mapsHome", mi: 2.4, min: [13, 26, 48, 16], open: "none", tags: "home house",
    pts: [[608, 832], [384, 832], [384, 1344], [224, 1344]] },
  { id: "sightglass", name: "Sightglass Coffee", cat: "Coffee", area: "7th St", addr: "270 7th St", x: 512, y: 896, icon: "mapsCup", mi: 0.3, min: [3, 5, 6, 2], open: [7, 18], phone: "(415) 555-0181", web: "sightglasscoffee.com", tags: "coffee cafe espresso",
    pts: [[608, 832], [576, 832], [576, 896], [512, 896]] },
  { id: "bluebottle", name: "Blue Bottle Coffee", cat: "Coffee", area: "Mint Plaza", addr: "66 Mint St", x: 576, y: 704, icon: "mapsCup", mi: 0.4, min: [3, 6, 8, 3], open: [7, 17], phone: "(415) 555-0115", web: "bluebottlecoffee.com", tags: "coffee cafe espresso",
    pts: [[608, 832], [576, 832], [576, 704]] },
  { id: "philz", name: "Philz Coffee", cat: "Coffee", area: "3rd St", addr: "3rd St & Harrison St", x: 704, y: 896, icon: "mapsCup", mi: 0.2, min: [2, 5, 5, 2], open: [6, 20], phone: "(415) 555-0163", web: "philzcoffee.com", tags: "coffee cafe espresso",
    pts: [[608, 832], [704, 832], [704, 896]] },
  { id: "sfo", name: "SFO", cat: "Airport", area: "San Francisco International", addr: "San Francisco International Airport", x: 780, y: 3040, icon: "plane", mi: 13.4, min: [22, 41, 270, 80], open: null, phone: "(650) 555-0100", web: "flysfo.com", tags: "airport sfo flight plane",
    pts: [[608, 832], [640, 832], [640, 960], [680, 1100], [640, 1500], [560, 1900], [620, 2400], [760, 2850], [780, 3040]] }
];
var MAPS_GRID = (function () {
  var d = ""; var x, y;
  for (x = 0; x <= MAPS_WW; x += 64) d += "M" + x + " 0V1700";
  for (y = 0; y <= 1700; y += 64) d += "M0 " + y + "H" + MAPS_WW;
  for (x = 0; x <= MAPS_WW; x += 128) d += "M" + x + " 1700V" + MAPS_WH;
  for (y = 1792; y <= MAPS_WH; y += 128) d += "M0 " + y + "H" + MAPS_WW;
  return d;
})();
var MAPS_MAJOR = "M150 1060L880 250M0 832H1000M0 640H1000M640 0V960M384 600V1700M0 1120H900M0 1216H700";
var MAPS_FWY = "M700 300L660 800L640 960L680 1100L640 1500L560 1900L620 2400L760 2850L790 3200";
var MAPS_WATER = "M770 0C810 260 812 520 804 720S830 1030 880 1300S990 1720 960 2120S870 2700 900 3200L1200 3200L1200 0Z";
var MAPS_PARKS = "M136 1224h112v112h-112zM648 712h112v48h-112zM60 380h150v90h-150z";
var MAPS_RWY = "M690 2990L860 3090M720 3100L850 2975";
var MAPS_LABELS = [
  { t: "Folsom St", x: 470, y: 832 }, { t: "Mission St", x: 400, y: 640 }, { t: "Valencia St", x: 384, y: 1030, r: 90 },
  { t: "Market St", x: 420, y: 760, r: -48 }, { t: "US-101", x: 655, y: 1300, r: 84 }, { t: "18th St", x: 520, y: 1216 }, { t: "SoMa", x: 470, y: 1000, big: true },
  { t: "Mission", x: 250, y: 1060, big: true }
];
var MAPS_DRAG = { on: false, t: 0 };

function mapsPlace(id) { if (!id) return null; if (String(id).indexOf("addr:") === 0) return mapsAddr(String(id).slice(5)); for (var i = 0; i < MAPS_PLACES.length; i++) if (MAPS_PLACES[i].id === id) return MAPS_PLACES[i]; return null; }
/* street-address "geocoder": SF streets land on the drawn grid, other cities get a far pin */
var MAPS_STREETS = { valencia: [384, "v"], guerrero: [320, "v"], dolores: [256, "v"], folsom: [832, "h"], mission: [640, "h"], howard: [704, "h"], harrison: [896, "h"], liberty: [1344, "h"], "18th": [1216, "h"], "2nd": [768, "v"], "3rd": [704, "v"], "4th": [640, "v"], "5th": [576, "v"], "7th": [512, "v"] };
var MAPS_FAR = [
  [/mountain view|palo alto/, 36, [48, 95, 720, 190], [[608, 832], [640, 832], [640, 960], [680, 1100], [640, 1500], [560, 1900], [620, 2400], [760, 2850], [700, 3190]]],
  [/new york|brooklyn|\bny\b/, 2900, null, [[608, 832], [1190, 700]]],
  [/portland|seattle/, 635, null, [[608, 832], [560, 10]]],
  [/oakland|berkeley/, 11, [22, 35, 220, 60], [[608, 832], [640, 832], [640, 400], [1190, 380]]]
];
function mapsIsAddr(q) { return /^\s*\d+[a-z]?\s+\S+.*\b(st|street|ave|avenue|blvd|rd|road|way|pl|ln|dr|ct)\b/i.test(q || ""); }
function mapsAddr(a) {
  var parts = a.split(","); var street = parts[0].trim(); var city = (parts.slice(1).join(",").trim()) || "San Francisco";
  var low = a.toLowerCase(); var num = parseInt(street, 10) || 100;
  var base = { id: "addr:" + a, name: street, cat: "Address", area: city, addr: a, icon: "pin", open: "none", tags: "", addrPin: true };
  for (var i = 0; i < MAPS_FAR.length; i++) if (MAPS_FAR[i][0].test(low)) {
    var f = MAPS_FAR[i]; var end = f[3][f[3].length - 1];
    return Object.assign(base, { x: end[0], y: end[1], mi: f[1], min: f[2] || [0, 0, 0, 0], far: !f[2], pts: f[3] });
  }
  var key = null; Object.keys(MAPS_STREETS).forEach(function (k) { if (!key && new RegExp("\\b" + k + "\\b").test(low)) key = k; });
  var x, y;
  if (key && MAPS_STREETS[key][1] === "v") { x = MAPS_STREETS[key][0]; y = Math.max(900, Math.min(2000, Math.round(1120 + (num - 500) / 100 * 64))); }
  else if (key) { y = MAPS_STREETS[key][0]; x = Math.max(64, Math.min(780, Math.round(800 - num / 100 * 64))); }
  else { var h = 0; for (var j = 0; j < low.length; j++) h = (h * 31 + low.charCodeAt(j)) >>> 0; x = 256 + (h % 8) * 64; y = 960 + ((h >> 3) % 8) * 64; }
  var pts = [[608, 832]]; if (x !== 608) pts.push([x, 832]); if (y !== 832) pts.push([x, y]);
  var u = Math.abs(x - 608) + Math.abs(y - 832); var mi = Math.max(0.1, Math.round(u / 35) / 10);
  return Object.assign(base, { x: x, y: y, mi: mi, pts: pts, min: [Math.round(3 + mi * 4), Math.round(6 + mi * 8), Math.max(2, Math.round(mi * 20)), Math.max(1, Math.round(mi * 6))] });
}
function mapsModeI(m) { for (var i = 0; i < MAPS_MODES.length; i++) if (MAPS_MODES[i][0] === m) return i; return 0; }
function mapsFmtMin(m) { m = Math.max(1, Math.round(m)); if (m >= 60) { var h = Math.floor(m / 60), r = m % 60; return h + " h" + (r ? " " + r : ""); } return m + " min"; }
function mapsClock(d) { var h = d.getHours(); return (h % 12 || 12) + ":" + pad2(d.getMinutes()) + " " + (h < 12 ? "AM" : "PM"); }
function mapsEta(api, min) { return mapsClock(new Date(api.now.getTime() + min * 60000)); }
function mapsHr(t) { var h = Math.floor(t), m = Math.round((t - h) * 60); return (h % 12 || 12) + (m ? ":" + pad2(m) : "") + " " + (h < 12 || h === 24 ? "AM" : "PM"); }
function mapsHours(p, now) {
  if (p.open === "none") return null;
  if (!p.open) return { open: true, text: "24 hours" };
  var t = now.getHours() + now.getMinutes() / 60;
  if (t >= p.open[0] && t < p.open[1]) return { open: true, text: "until " + mapsHr(p.open[1]) };
  return { open: false, text: "opens " + mapsHr(p.open[0]) };
}
function mapsMi(mi) { return (mi >= 100 ? String(Math.round(mi)).replace(/\B(?=(\d{3})+(?!\d))/g, ",") : mi.toFixed(1)); }
function mapsDist(mi) { if (mi < 0.1) return Math.max(50, Math.round(mi * 5280 / 50) * 50) + " ft"; return mapsMi(mi) + " mi"; }
function mapsLen(pts) { var c = [0]; for (var i = 1; i < pts.length; i++) c.push(c[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return c; }
function mapsAt(pts, d) {
  var c = mapsLen(pts);
  for (var i = 1; i < pts.length; i++) if (d <= c[i]) { var f = (d - c[i - 1]) / ((c[i] - c[i - 1]) || 1); return { x: pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, y: pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f, i: i }; }
  var l = pts[pts.length - 1]; return { x: l[0], y: l[1], i: pts.length - 1 };
}
function mapsStreet(a, b) { if (a[1] === b[1] && MAPS_H[a[1]]) return MAPS_H[a[1]]; if (a[0] === b[0] && MAPS_V[a[0]]) return MAPS_V[a[0]]; if (a[1] !== b[1] && a[0] !== b[0]) return "US-101 S"; return "local road"; }
function mapsSteps(p) {
  var pts = p.pts; var c = mapsLen(pts); var out = [];
  for (var i = 1; i < pts.length - 1; i++) {
    var ax = pts[i][0] - pts[i - 1][0], ay = pts[i][1] - pts[i - 1][1], bx = pts[i + 1][0] - pts[i][0], by = pts[i + 1][1] - pts[i][1];
    var ang = Math.atan2(ax * by - ay * bx, ax * bx + ay * by) * 180 / Math.PI;
    if (Math.abs(ang) < 35) continue;
    out.push({ at: c[i], turn: ang < 0 ? "left" : "right", street: mapsStreet(pts[i], pts[i + 1]) });
  }
  out.push({ at: c[c.length - 1], turn: "arrive", street: p.name });
  return out;
}
function mapsPath(pts) { return pts.map(function (q, i) { return (i ? "L" : "M") + Math.round(q[0]) + " " + Math.round(q[1]); }).join(""); }
function mapsMatch(t) {
  if (/tartine|priya|lunch/.test(t)) return "tartine";
  if (/\bgym\b|equinox|workout/.test(t)) return "gym";
  if (/lumen|maya'?s (office|studio|work)|\bstudio\b|\bwork\b|\boffice\b/.test(t)) return "lumen";
  if (/\bhome\b/.test(t)) return "home";
  if (/\bsfo\b|airport/.test(t)) return "sfo";
  if (/sightglass/.test(t)) return "sightglass";
  if (/blue bottle/.test(t)) return "bluebottle";
  if (/philz/.test(t)) return "philz";
  return null;
}
function mapsSearch(q) {
  q = (q || "").toLowerCase().trim(); if (!q) return [];
  var words = q.split(/\s+/).filter(function (w) { return w && ["near", "nearby", "me", "the", "a", "find", "around"].indexOf(w) < 0; });
  if (!words.length) return [];
  return MAPS_PLACES.filter(function (p) {
    var hay = (p.name + " " + p.cat + " " + p.area + " " + p.tags).toLowerCase();
    return words.every(function (w) { return hay.indexOf(w) >= 0 || (w === "food" && /bakery|food/.test(hay)); });
  }).sort(function (a, b) { return a.mi - b.mi; });
}
function mapsNavTick(api) {
  var s = api.get("maps"); if (!s.nav) { api.stopBg(); return; }
  var p = mapsPlace(s.directions); if (!p) return;
  var total = mapsLen(p.pts).pop();
  var prog = Math.min(1, (s.prog || 0) + 1 / 34);
  var before = mapsStepIdx(p, s.prog || 0), after = mapsStepIdx(p, prog);
  api.set({ prog: prog });
  if (s.voice && after !== before) { var st = mapsSteps(p)[after]; if (st) api.toast(st.turn === "arrive" ? "Arriving at " + p.name : "Turn " + st.turn + " onto " + st.street); }
  if (prog >= 1) api.stopBg();
}
function mapsStepIdx(p, prog) { var total = mapsLen(p.pts).pop(); var d = prog * total; var steps = mapsSteps(p); for (var i = 0; i < steps.length; i++) if (steps[i].at > d + 0.5) return i; return steps.length - 1; }
function mapsStartNav(api, id) { api.set({ nav: true, directions: id, prog: 0, pan: null }); api.stopBg(); api.everyBg(function () { mapsNavTick(api); }, 850); }
function mapsEndNav(api) { var s = api.get("maps"); api.stopBg(); api.set({ nav: false, prog: 0, directions: null, place: s.directions, pan: null }); }
function mapsGoPatch(id, mode) { return { query: null, place: id, directions: id, nav: false, prog: 0, pan: null, mode: mode || "drive" }; }

registerView("maps", {
  title: "Maps", icon: "pin", aliases: ["map", "directions", "navigation"],
  chat: "hidden",
  state: { query: null, sheet: "half", place: null, directions: null, mode: "drive", nav: false, prog: 0, voice: true, pan: null, saved: ["tartine"] },
  persist: ["saved", "voice"],
  jumps: [[null, "Maps"], ["search", "Search results"], ["place", "Place"], ["route", "Directions"], ["nav", "Navigation"]],
  preset: function (sub, api) {
    if (sub === "search") return { query: "coffee", sheet: "half" };
    if (sub === "place") return { place: "tartine" };
    if (sub === "route") return { place: "tartine", directions: "tartine" };
    if (sub === "nav") { api.later(function () { mapsStartNav(api, "tartine"); api.set({ prog: 0.2 }); }, 30); return { place: "tartine", directions: "tartine" }; }
  },
  immersive: function (st) { return st.nav ? { dark: true, noPill: true } : null; },
  ongoing: function (st) {
    if (!st.nav) return null; var p = mapsPlace(st.directions); if (!p) return null;
    if ((st.prog || 0) >= 1) return { label: "Arrived", icon: "pin" };
    var stp = mapsSteps(p)[mapsStepIdx(p, st.prog || 0)];
    return { label: mapsFmtMin(p.min[mapsModeI(st.mode)] * (1 - (st.prog || 0))), icon: stp.turn === "left" ? "mapsLeft" : (stp.turn === "right" ? "mapsRight" : "pin") };
  },
  back: function (st, api) {
    if (st.nav) return false;
    /* opened from another app (cross-app back stack): back returns there instead of walking maps' own layers */
    if ((api.S.stack || []).length && (st.directions || st.place || st.query != null)) { api.set({ directions: null, place: null, query: null, pan: null }); return false; }
    if (st.directions) { api.set({ directions: null, place: st.place || st.directions, pan: null }); return true; }
    if (st.place) { api.set({ place: null, pan: null }); return true; }
    if (st.query != null) { api.set({ query: null, pan: null }); return true; }
    return false;
  },
  suggestions: function (st) {
    if (st.nav) return ["Share my ETA with Maya", "How long left?", "Find coffee on the way"];
    var p = mapsPlace(st.directions || st.place);
    if (p) return ["Share my ETA with " + (p.pid ? person(p.pid).name.split(" ")[0] : "Maya"), "How long to walk there?", "Find coffee nearby"];
    return ["Directions to Tartine", "How long to the gym?", "Find coffee nearby"];
  },
  voicePhrase: "How long to the gym?",
  reply: function (t, raw, api) {
    var st = api.get("maps");
    var modeOf = function () { return /\bwalk/.test(t) ? "walk" : (/\bbike|cycl/.test(t) ? "bike" : (/transit|\bbus\b|train|muni|bart/.test(t) ? "transit" : "drive")); };
    /* share ETA */
    if (/\b(share|send)\b.*\beta\b|\blet (\w+) know i'?m (on my way|coming|close)/.test(t)) {
      var who = null; PEOPLE.forEach(function (p) { if (!who && t.indexOf(p.name.split(" ")[0].toLowerCase()) >= 0) who = p; });
      who = who || person("maya");
      var dst = mapsPlace(st.directions) || mapsPlace(who.id === "priya" ? "tartine" : "lumen");
      var left = dst.min[mapsModeI(st.mode)] * (st.nav ? 1 - (st.prog || 0) : 1);
      var body = "On my way to " + dst.name + ". Arriving around " + mapsEta(api, left) + " (" + mapsFmtMin(left) + ").";
      return { text: "Here's your ETA for " + who.name.split(" ")[0] + ".", card: { type: "draft", to: who.name, pid: who.id, body: body, act: { mod: "messages", fn: "sendDraft" } } };
    }
    var id = mapsMatch(t);
    if (id && /\b(directions?|navigate|take me|route|get me|drive (me )?to|walk (me )?to|bike to|how do i get|head(ing)? to|go to)\b/.test(t)) {
      var p = mapsPlace(id); var mode = modeOf(); var m = p.min[mapsModeI(mode)];
      return { text: mapsFmtMin(m) + " to " + p.name + (mode === "drive" ? "" : " by " + mode) + ". You'd arrive at " + mapsEta(api, m) + ".",
        card: { type: "generic", icon: "mapsRoute", title: p.name, sub: mapsFmtMin(m) + " · " + mapsMi(p.mi) + " mi", go: { view: "maps", patch: mapsGoPatch(id, mode) } },
        nav: { view: "maps", patch: mapsGoPatch(id, mode) } };
    }
    if (id && /\bhow (long|far)\b|\beta\b|time to get/.test(t)) {
      var q = mapsPlace(id);
      var txt = q.name + " is " + mapsFmtMin(q.min[0]) + " by car, " + mapsFmtMin(q.min[2]) + " on foot.";
      if (/walk/.test(t)) txt = mapsFmtMin(q.min[2]) + " on foot to " + q.name + ", " + mapsMi(q.mi) + " mi.";
      if (id === "gym") txt += " Leave by 7:20 for your 7:30 session.";
      return { text: txt, card: { type: "generic", icon: "mapsRoute", title: q.name, sub: mapsMi(q.mi) + " mi · " + q.area, go: { view: "maps", patch: mapsGoPatch(id, /walk/.test(t) ? "walk" : "drive") } } };
    }
    if (/\b(coffee|cafe|espresso)\b/.test(t) && /\b(find|nearby|near|around|closest|nearest|any|where|on the way)\b/.test(t)) {
      var res = mapsSearch("coffee");
      return { text: res.length + " within a short walk. " + res[0].name + " is closest.", nav: { view: "maps", patch: { query: "coffee", sheet: "half", place: null, directions: null, nav: false } },
        card: { type: "agenda", go: { view: "maps", patch: { query: "coffee", sheet: "half", place: null, directions: null, nav: false } }, rows: res.map(function (r) { return { time: r.min[2] + " min", title: r.name }; }) } };
    }
    if (/where am i|my location/.test(t)) return { text: "Folsom St near 4th, in SoMa.", nav: { view: "maps", patch: { query: null, place: null, directions: null, nav: false, pan: null } } };
    if (st.nav && /how (long|much) (left|longer)|when will i (get|arrive)/.test(t)) {
      var d = mapsPlace(st.directions); var l = d.min[mapsModeI(st.mode)] * (1 - (st.prog || 0));
      return { text: mapsFmtMin(l) + " left. You'll get to " + d.name + " at " + mapsEta(api, l) + "." };
    }
    return null;
  },
  render: function (st, api) {
    if (st.query && mapsIsAddr(st.query) && !st.place && !st.directions) api.later(function () { var s0 = api.get("maps"); if (s0.query && mapsIsAddr(s0.query) && !s0.place) api.set({ place: "addr:" + s0.query.trim(), query: null, pan: null }); }, 0);
    var dark = api.theme === "dark" || st.nav;
    var C = dark ? { land: "#101010", minor: "#1C1C1C", major: "#282828", fwy: "#333333", fwyE: "#1A1A1A", water: "#0A1022", park: "#0D1A12", rwy: "#222222", route: "#4A58FF", done: "#3A3A3A", halo: "#101010", label: "#7A7A7A" }
                 : { land: "#EFEFEC", minor: "#FFFFFF", major: "#FFFFFF", fwy: "#FFFFFF", fwyE: "#D9D9D4", water: "#D3DCEA", park: "#DCE6D4", rwy: "#DADAD6", route: "#0000FF", done: "#B8B8B8", halo: "#EFEFEC", label: "#8A8A86" };
    var mi = mapsModeI(st.mode);
    var place = mapsPlace(st.place);
    var dst = mapsPlace(st.directions);
    var results = st.query != null ? mapsSearch(st.query) : [];
    var mode = st.nav ? "nav" : (dst ? "dir" : (place ? "place" : (st.query != null ? "results" : "base")));
    var SH = { peek: 250, half: 520, full: 811 };
    var sheetH = mode === "results" ? SH[st.sheet || "half"] : (mode === "place" ? 372 : (mode === "dir" ? 300 : 0));

    /* camera */
    var cx = MAPS_ME[0] + 36, cy = MAPS_ME[1] - 40, s = 1, fy = (170 + 805) / 2;
    var fit = function (pts, top, bot, maxS) {
      var xs = pts.map(function (q) { return q[0]; }), ys = pts.map(function (q) { return q[1]; });
      var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
      s = Math.min(330 / Math.max(1, x1 - x0), (bot - top - 90) / Math.max(1, y1 - y0), maxS);
      cx = (x0 + x1) / 2; cy = (y0 + y1) / 2; fy = (top + bot) / 2;
    };
    var navPt = null, stepI = 0, steps = [], total = 0;
    if (mode === "nav") {
      total = mapsLen(dst.pts).pop(); navPt = mapsAt(dst.pts, (st.prog || 0) * total);
      steps = mapsSteps(dst); stepI = mapsStepIdx(dst, st.prog || 0);
      s = 1.5; cx = navPt.x; cy = navPt.y; fy = 560;
    } else if (mode === "dir") fit(dst.pts, 214, 915 - sheetH, 1.4);
    else if (mode === "place" && !place.far) { cx = place.x; cy = place.y; s = place.id === "sfo" ? 0.9 : 1.15; fy = (110 + 915 - sheetH) / 2; }
    else if (mode === "results" && results.length) fit(results.map(function (r) { return [r.x, r.y]; }).concat([MAPS_ME]), 110, 915 - Math.min(sheetH, 520), 1.3);
    var pan = st.pan || { x: 0, y: 0 };
    var tx = 206 - cx * s + pan.x, ty = fy - cy * s + pan.y;
    var scr = function (x, y) { return { l: Math.round(x * s + tx), t: Math.round(y * s + ty) }; };
    var tr = "translate(" + tx.toFixed(1) + "px," + ty.toFixed(1) + "px) scale(" + s.toFixed(3) + ")";

    /* route */
    var routeD = "", doneD = "", routeDash = "";
    var rp = mode === "dir" || mode === "nav" ? dst : null;
    if (rp) {
      if (mode === "nav") {
        var cut = [navPt.x, navPt.y];
        doneD = mapsPath(rp.pts.slice(0, navPt.i).concat([cut]));
        routeD = mapsPath([cut].concat(rp.pts.slice(navPt.i)));
      } else routeD = mapsPath(rp.pts);
      routeDash = st.mode === "walk" ? "stroke-dasharray: 1 11" : (st.mode === "transit" ? "stroke-dasharray: 12 8" : "");
    }

    /* pins */
    var tapGuard = function () { return Date.now() - MAPS_DRAG.t < 400; };
    var pinList = [];
    if (mode === "base") { ["home", "lumen"].concat(st.saved || []).forEach(function (id) { if (pinList.indexOf(id) < 0) pinList.push(id); }); }
    else if (mode === "results") pinList = results.map(function (r) { return r.id; });
    else if (mode === "place") pinList = place.far ? [] : [place.id];
    else pinList = [dst.id];
    var pins = pinList.map(function (id) {
      var p = mapsPlace(id); var o = scr(p.x, p.y); var big = mode !== "base" && mode !== "results";
      return { l: o.l, t: o.t, d: IC[p.icon], name: p.name, sz: big ? 44 : 34, off: big ? -22 : -17, isz: big ? 20 : 16,
        css: big ? "background: var(--acc); color: #fff; box-shadow: 0 0 0 3px #fff, 0 6px 18px rgba(0,0,0,.25)" : "background: var(--bg); color: var(--fg); box-shadow: 0 0 0 1.5px var(--line), 0 4px 12px var(--shc)",
        tap: function () { if (tapGuard() || mode === "nav" || mode === "dir") return; api.set({ place: id, pan: null }); } };
    });
    var me = navPt ? scr(navPt.x, navPt.y) : scr(MAPS_ME[0], MAPS_ME[1]);
    var labels = s < 0.62 ? [] : MAPS_LABELS.filter(function (L) { return L.big || !(mode === "dir" || mode === "nav"); }).map(function (L) { var o = scr(L.x, L.y); return { t: L.t, l: o.l, top: o.t, css: "transform: translate(-50%,-50%) rotate(" + (L.r || 0) + "deg); font-size: " + (L.big ? 13 : 11) + "px; " + (L.big ? "letter-spacing: .18em; text-transform: uppercase; font-weight: 600;" : "font-weight: 500;") + " color: " + C.label + "; text-shadow: 0 0 3px " + C.halo + ", 0 0 3px " + C.halo }; });

    /* map pan (release-based) */
    var mapDown = function (e) {
      var sc = e.currentTarget.closest ? e.currentTarget.closest("[data-screen]") : null; var r = (sc || e.currentTarget).getBoundingClientRect(); var k = r.width / 412 || 1;
      MAPS_DRAG = { on: true, x: e.clientX, y: e.clientY, k: k, px: (e.clientX - r.left) / k, py: (e.clientY - r.top) / k, t: MAPS_DRAG.t };
    };
    var mapUp = function (e) {
      var d = MAPS_DRAG; if (!d.on) return; d.on = false;
      if (d.px < 30 || d.px > 382 || d.py < 90 || d.py > 872) return;
      var dx = (e.clientX - d.x) / d.k, dy = (e.clientY - d.y) / d.k;
      if (Math.abs(dx) + Math.abs(dy) < 12) return;
      d.t = Date.now(); var p0 = api.get("maps").pan || { x: 0, y: 0 }; api.set({ pan: { x: p0.x + dx, y: p0.y + dy } });
    };

    /* saved chips */
    var chips = ["home", "lumen"].concat((st.saved || []).filter(function (id) { return id !== "home" && id !== "lumen"; })).map(function (id) {
      var p = mapsPlace(id);
      return { label: id === "lumen" ? "Work" : p.name, d: IC[p.icon], go: function () { api.set({ place: id, pan: null }); } };
    });
    var cats = [["Coffee", "mapsCup", "coffee"], ["Food", "mapsFood", "food"], ["Gym", "mapsGym", "gym"]].map(function (c) {
      return { label: c[0], d: IC[c[1]], go: function () { api.set({ query: c[2], sheet: "half", place: null, pan: null }); } };
    });

    var row = function (p) {
      var h = mapsHours(p, api.now);
      return { name: p.name, d: IC[p.icon], sub: p.cat + " · " + mapsMi(p.mi) + " mi" + (h ? " · " + (h.open ? "Open" : "Closed") : ""), go: function () { api.set({ place: p.id, pan: null }); } };
    };
    var savedRows = ["home", "lumen"].concat((st.saved || []).filter(function (id) { return id !== "home" && id !== "lumen"; })).map(function (id) { var r = row(mapsPlace(id)); if (id === "lumen") r.name = "Work · Lumen studio"; return r; });
    var q = st.query || "";
    var sheetSw = api.sw(function (dx, dy) {
      var order = ["peek", "half", "full"]; var i = order.indexOf(st.sheet || "half");
      if (Math.abs(dy) < Math.abs(dx)) return;
      if (dy < 0) i = Math.min(2, i + 1); else if (i === 0) { api.set({ query: null, pan: null }); return; } else i = i - 1;
      api.set({ sheet: order[i] });
    });

    /* place card */
    var pc = null;
    if (place) {
      var ph = mapsHours(place, api.now); var saved = (st.saved || []).indexOf(place.id) >= 0 || place.id === "home" || place.id === "lumen";
      pc = {
        name: place.name, meta: place.cat + " · " + place.area + " · " + mapsMi(place.mi) + " mi", addr: place.addr, d: IC[place.icon],
        hasHours: !!ph, openTxt: ph ? (ph.open ? "Open" : "Closed") : "", hoursTxt: ph ? ph.text : "", openCss: ph && ph.open ? "color: var(--fg)" : "color: var(--mut)",
        min: mapsFmtMin(place.min[0]),
        hasPhone: !!place.phone, canDir: !place.far, hasWeb: !!place.web, fixed: place.id === "home" || place.id === "lumen",
        saved: saved, starD: IC.star, starCss: saved ? "color: var(--acct)" : "", starFill: saved ? "fill: currentColor" : "", saveLabel: saved ? "Remove from saved" : "Save",
        close: function () { api.set({ place: null, pan: null }); },
        dirs: function () { api.set({ directions: place.id, pan: null }); },
        call: function () { api.open("phone", { call: null, num: place.phone }); },
        save: function () {
          if (place.id === "home" || place.id === "lumen") { api.toast(place.id === "home" ? "Home is always saved" : "Work is always saved"); return; }
          var l = (st.saved || []).slice(); var i = l.indexOf(place.id);
          api.set({ saved: i >= 0 ? l.filter(function (x) { return x !== place.id; }) : l.concat([place.id]) });
          if (i >= 0) api.toast(place.name + " removed from saved", { undo: function () { var cur = api.get("maps").saved || []; if (cur.indexOf(place.id) < 0) api.set({ saved: cur.concat([place.id]) }); } });
          else api.toast(place.name + " saved");
        },
        share: function () { api.open("messages", { compose: true, text: place.name + ", " + place.addr }); },
        web: function () { api.open("browser", { url: place.web, newTab: true }); }
      };
    }

    /* directions */
    var dr = null;
    if (dst) {
      var m = dst.min[mi]; var left = m * (1 - (mode === "nav" ? (st.prog || 0) : 0));
      var via = []; mapsSteps(dst).forEach(function (x) { if (x.turn !== "arrive" && via.indexOf(x.street) < 0) via.push(x.street); });
      var first = dst.pts[1][1] === dst.pts[0][1] ? MAPS_H[dst.pts[0][1]] : "4th St";
      dr = {
        name: dst.name, d: IC[dst.icon], min: mapsFmtMin(m), meta: mapsMi(dst.mi) + " mi · " + mapsEta(api, m),
        via: "via " + [first].concat(via).filter(function (v, i, a) { return a.indexOf(v) === i; }).slice(0, 2).join(" and "),
        modes: MAPS_MODES.map(function (md, i) {
          var on = i === mi;
          return { d: IC[md[1]], label: md[2] + ", " + mapsFmtMin(dst.min[i]), t: mapsFmtMin(dst.min[i]), css: on ? "background: var(--acc); color: #fff" : "background: var(--s2); color: var(--fg)", go: function () { api.set({ mode: md[0] }); } };
        }),
        close: function () { api.set({ directions: null, place: dst.id, pan: null }); },
        start: function () { mapsStartNav(api, dst.id); },
        shareEta: function () {
          var who = person(dst.pid || "maya");
          api.say("Here's your ETA for " + who.name.split(" ")[0] + ".", { type: "draft", to: who.name, pid: who.id, body: "On my way to " + dst.name + ". Arriving around " + mapsEta(api, m) + " (" + mapsFmtMin(m) + ").", act: { mod: "messages", fn: "sendDraft" } });
        },
        shareLabel: "Share ETA with " + person(dst.pid || "maya").name.split(" ")[0]
      };
      if (mode === "nav") {
        var cur = steps[stepI]; var nxt = steps[stepI + 1];
        var dUnits = Math.max(0, cur.at - (st.prog || 0) * total); var k = dst.mi / total;
        var arrived = (st.prog || 0) >= 1;
        dr.nav = {
          arrived: arrived, going: !arrived,
          icon: cur.turn === "left" ? IC.mapsLeft : (cur.turn === "right" ? IC.mapsRight : IC.pin),
          dist: arrived ? "" : mapsDist(dUnits * k),
          street: arrived ? dst.name : (cur.turn === "arrive" ? dst.name : cur.street),
          hasThen: !arrived && !!nxt, thenD: nxt ? (nxt.turn === "left" ? IC.mapsLeft : (nxt.turn === "right" ? IC.mapsRight : IC.pin)) : IC.pin,
          left: arrived ? "Arrived" : mapsFmtMin(left),
          meta: arrived ? dst.addr : mapsDist(dst.mi * (1 - (st.prog || 0))) + " · " + mapsEta(api, left),
          voiceD: st.voice ? IC.mapsVol : IC.mapsMute, voiceLabel: st.voice ? "Mute voice guidance" : "Turn on voice guidance",
          voice: function () { var v = !api.get("maps").voice; api.set({ voice: v }); api.toast(v ? "Voice guidance on" : "Voice guidance off"); },
          ask: function () { api.chat(""); },
          end: function () { mapsEndNav(api); }
        };
      }
    }

    return {
      mode: mode, isBase: mode === "base", isResults: mode === "results", isPlace: mode === "place", isDir: mode === "dir", isNav: mode === "nav",
      showSearch: mode === "base" || mode === "results" || mode === "place",
      C: C, tr: tr, W: MAPS_WW, H: MAPS_WH, grid: MAPS_GRID, major: MAPS_MAJOR, fwy: MAPS_FWY, water: MAPS_WATER, parks: MAPS_PARKS, rwy: MAPS_RWY,
      routeD: routeD, doneD: doneD, hasRoute: !!routeD, routeDash: routeDash,
      pins: pins, labels: labels, meL: me.l, meT: me.t, meTr: mode === "nav" ? ".8s linear" : ".6s cubic-bezier(.19,1,.22,1)",
      mapDown: mapDown, mapUp: mapUp,
      q: place ? place.name : q, hasQ: q.length > 0 && !place, searchIcon: mode === "base" ? IC.search : IC.back, searchLabel: mode === "base" ? "Search" : "Back",
      searchLead: function () { if (mode === "base") api.set({ query: "", sheet: "half", pan: null }); else VIEWS.maps.back(api.get("maps"), api); },
      onQ: function (e) { api.set({ query: e.target.value, place: null, sheet: (st.sheet === "peek" ? "half" : st.sheet) || "half", pan: null }); },
      focusQ: function () { if (st.query == null || place) api.set({ query: st.query || "", place: null, sheet: st.sheet || "half", pan: null }); },
      qKey: function (e) { if (e.key === "Enter") { var q0 = api.get("maps").query || ""; if (mapsIsAddr(q0)) { api.set({ place: "addr:" + q0.trim(), query: null, pan: null }); return; } var r = mapsSearch(q0); if (r.length === 1) api.set({ place: r[0].id, pan: null }); else api.set({ sheet: "half" }); if (e.target && e.target.blur) e.target.blur(); } },
      clearQ: function () { api.set({ query: "", place: null, sheet: "half", pan: null }); },
      chips: chips, cats: cats,
      recenter: function () { api.set({ pan: null }); }, recBottom: (mode === "results" ? Math.min(sheetH, 520) : (sheetH || 110)) + 14, showRec: mode !== "results" || st.sheet !== "full",
      recCss: st.pan ? "color: var(--acct)" : "",
      sheetH: sheetH, sheetSw: { down: function (e) { try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {} sheetSw.down(e); }, up: sheetSw.up }, sheetTap: function () { if (api.swallowed()) return; var o = ["peek", "half", "full"]; api.set({ sheet: o[(o.indexOf(st.sheet || "half") + 1) % 3] }); },
      results: results.map(row), hasResults: results.length > 0, noResults: q.trim().length > 0 && !results.length, emptyQ: !q.trim(),
      savedRows: savedRows,
      askAlpha: function () { api.send(q); },
      noResTxt: "Ask " + api.name + ": \u201c" + q + "\u201d",
      pc: pc, dr: dr
    };
  }
});
