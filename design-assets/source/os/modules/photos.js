/* Photos: library, albums, viewer, editor, select, share, trash. All markup holes are {{photos.*}}.
   Photos use generated photography (IMG, see img.json); phScene() CSS compositions remain the fallback.
   phScene / phLook are shared with the Camera module. */
IC.phRotate = IC.phRotate || "M19 12a7 7 0 1 1-2-4.9M19 4v4h-4";
IC.phCrop = IC.phCrop || "M7 3v14h14M3 7h14v14";
IC.phSelect = IC.phSelect || "M21 12a9 9 0 1 1-18 0a9 9 0 1 1 18 0zM8.5 12.5l2.5 2.5 4.5-5";
IC.phAlbums = IC.phAlbums || "M8 3h12v12M4 7h12v14H4z";

/* ---------- scene composer ---------- */
function phRg(w, h, x, y, img) { // image layer covering a w×h (% of frame) box whose top-left is x,y (%)
  var px = w >= 100 ? 0 : x / (100 - w) * 100, py = h >= 100 ? 0 : y / (100 - h) * 100;
  return img + " " + px.toFixed(2) + "% " + py.toFixed(2) + "% / " + w + "% " + h + "% no-repeat";
}
function phR(w, h, x, y, c) { return phRg(w, h, x, y, "linear-gradient(" + c + "," + c + ")"); }
function phE(rx, ry, x, y, c, soft) { return "radial-gradient(ellipse " + rx + "% " + ry + "% at " + x + "% " + y + "%, " + c + " " + (soft ? 0 : 94) + "%, transparent 100%)"; }
function phW(x, y, from, span, c) { return "conic-gradient(from " + from + "deg at " + x + "% " + y + "%, " + c + " 0deg " + (span - 0.6) + "deg, transparent " + span + "deg)"; }
function phFig(x, s, c) { // head + shoulders silhouette; s = 1 mid shot, 2 portrait
  return [phE(8.5 * s, 6.4 * s, x, 100 - 28 * s, c), phE(19 * s, 22 * s, x, 100 + 2 * s, c)];
}
var PH_TONES = [["#EBC9B6", "#B89AB3"], ["#CFE0D3", "#8FAE9C"], ["#D6DDEB", "#9AA8C4"], ["#F0DDB0", "#C99B6A"]];
function phCity(win) {
  var b = [[14, 40, 4, 60, "#1B1C36"], [10, 52, 19, 48, "#22244A"], [16, 34, 30, 66, "#191A31"], [12, 58, 47, 42, "#23254C"], [18, 38, 60, 62, "#1A1B34"], [9, 48, 79, 52, "#20224A"], [12, 30, 89, 70, "#181930"]];
  var L = [phRg(8, 50, 49, 46, "repeating-linear-gradient(to bottom, " + win + " 0 1.2%, transparent 1.2% 4%)"), phRg(6, 44, 21, 52, "repeating-linear-gradient(to bottom, " + win + " 0 1.2%, transparent 1.2% 4.4%)"), phRg(5, 40, 81, 56, "repeating-linear-gradient(to bottom, " + win + " 0 1.2%, transparent 1.2% 5%)")];
  b.forEach(function (r) { L.push(phR(r[0], r[1], r[2], r[3], r[4])); });
  return L;
}
function phQR(x, y) { // 18% x 13.5% box (square in a 3:4 frame): three finder squares + a module field
  var L = [];
  [[x, y], [x + 12, y], [x, y + 9]].forEach(function (f) { L.push(phR(2, 1.5, f[0] + 2, f[1] + 1.5, "#111")); L.push(phR(4, 3, f[0] + 1, f[1] + 0.75, "#FAFAF7")); L.push(phR(6, 4.5, f[0], f[1], "#111")); });
  L.unshift(phRg(9, 6.75, x + 8, y + 6, "repeating-conic-gradient(#111 0 25%, transparent 0 50%)"));
  L.unshift(phR(3, 2.25, x + 8, y + 1, "#111"), phR(1.5, 4.5, x + 7.5, y + 6.75, "#111"), phR(3, 1.1, x + 1.5, y + 6.1, "#111"), phR(1.5, 2.25, x + 15, y + 11.25, "#111"));
  return L;
}
var PH_SCENES = {
  beach: function () { return [phE(7, 5.25, 72, 24, "#FFF6DE"), phE(45, 26, 72, 24, "rgba(255,238,200,.55)", 1), phR(100, 0.6, 0, 57, "rgba(255,255,255,.5)"), phR(100, 0.8, 0, 61.2, "rgba(255,255,255,.75)"), "linear-gradient(to bottom, #8DBFE6 0%, #D2E6EF 45%, #6AA6C6 45.3%, #2E7098 58%, #3F86A8 61.5%, #E8D5B2 62%, #D2B68A 100%)"]; },
  sea: function () { return [phRg(100, 78, 0, 22, "repeating-linear-gradient(176deg, transparent 0 6%, rgba(255,255,255,.4) 6.4% 7.2%, transparent 7.8% 12%)"), "linear-gradient(to bottom, #9CC9E4 0%, #D3E8F1 22%, #3C86AE 22.3%, #1F5F86 100%)"]; },
  sunset: function () { return [phR(100, 36, 0, 64, "#1F1826"), phE(13, 9.75, 50, 64, "#FFE0A6"), phE(75, 32, 50, 64, "rgba(255,170,110,.55)", 1), "linear-gradient(to bottom, #2C2B5C 0%, #78497D 30%, #D9687A 48%, #F4A262 60%, #F9CB82 64%)"]; },
  sunsea: function () { return [phR(12, 30, 44, 64.5, "rgba(255,196,130,.35)"), phRg(100, 36, 0, 64, "linear-gradient(to bottom, #5A3A55, #22192E)"), phE(13, 9.75, 50, 64, "#FFE0A6"), phE(75, 32, 50, 64, "rgba(255,170,110,.55)", 1), "linear-gradient(to bottom, #2C2B5C 0%, #78497D 30%, #D9687A 48%, #F4A262 60%, #F9CB82 64%)"]; },
  mountain: function () { return [phR(100, 20, 0, 80, "#2F4839"), phW(70, 50, 122, 116, "#46624F"), phRg(34, 7, 11, 40, "conic-gradient(from 120deg at 50% 0%, #EEF3F6 0deg 119.4deg, transparent 120deg)"), phW(28, 40, 120, 120, "#7D95A3"), phE(8, 6, 82, 18, "#FFF9EC"), "linear-gradient(to bottom, #A7CAE4 0%, #E6EEF1 75%)"]; },
  lake: function () { return [phR(30, 0.5, 35, 72, "rgba(255,255,255,.35)"), phR(20, 0.5, 50, 79, "rgba(255,255,255,.25)"), phRg(100, 34, 0, 66, "linear-gradient(to bottom, #4B86A6, #1F4C6B)"), phW(64, 44, 122, 116, "#3E5B55"), phRg(34, 6, 13, 38, "conic-gradient(from 120deg at 50% 0%, #EEF3F6 0deg 119.4deg, transparent 120deg)"), phW(30, 38, 120, 120, "#7890A0"), "linear-gradient(to bottom, #B4D0E6 0%, #EEF2F2 66%)"]; },
  forest: function () { return [phR(100, 16, 0, 84, "#33452F"), phW(12, 28, 162, 36, "#2D4731"), phW(34, 20, 160, 40, "#26402B"), phW(58, 30, 163, 34, "#35553A"), phW(80, 22, 160, 40, "#2B4530"), phW(96, 34, 162, 36, "#2F4C34"), "linear-gradient(to bottom, #DDE8D6 0%, #B9CCB0 70%, #8FA884 100%)"]; },
  park: function () { return [phW(56, 62, 168, 24, "#D8C9AC"), phE(10, 7.5, 24, 50, "#3E6B45"), phE(8, 6, 74, 55, "#4B7A4F"), phR(1.6, 10, 23.2, 54, "#4A3A2C"), phR(1.4, 8, 73.3, 58, "#4A3A2C"), phE(90, 20, 30, 68, "#86B06D"), "linear-gradient(to bottom, #94C0E8 0%, #DCEBF4 58%, #7CA864 58.3%, #6C9A58 100%)"]; },
  city: function () { return phCity("rgba(255,210,140,.5)").concat([phE(3, 2.25, 78, 16, "#F5F0E0"), "linear-gradient(to bottom, #161A45 0%, #4B3F82 50%, #D98C86 82%, #F0B48A 100%)"]); },
  night: function () { return phCity("rgba(255,214,150,.75)").concat([phE(2.6, 1.95, 22, 12, "#F5F0E0"), "linear-gradient(to bottom, #05071A 0%, #141838 60%, #2A2458 100%)"]); },
  cafe: function () { return [phE(6.6, 2, 60, 74.6, "#5A3923"), phE(8, 2.6, 60, 74.5, "#FBF8F4"), phE(12, 3.6, 60, 77, "#EDE6DC"), phE(12, 16, 86, 50, "#5E7E52"), phR(10, 10, 81, 60, "#B87A56"), phR(100, 30, 0, 70, "#7B573B"), phR(0.8, 34, 28.6, 14, "#D2B895"), phR(38, 0.8, 10, 30.6, "#D2B895"), phR(38, 34, 10, 14, "#F6EAD6"), "linear-gradient(to bottom, #DCC6A8, #C6A986)"]; },
  food: function () { return [phE(7, 5.25, 44, 46, "#79A552"), phE(6, 4.5, 57, 54, "#E0B04A"), phE(20, 15, 50, 50, "#C8643C"), phE(34, 25.5, 50, 50, "#F6F3EE"), phE(38, 29, 51, 52, "rgba(0,0,0,.2)", 1), phE(4, 3, 84, 16, "#6E4A2E"), phE(6, 4.5, 84, 16, "#EDE7DE"), "repeating-linear-gradient(90deg, #BE8F63 0 12%, #B3845A 12% 24%)"]; },
  whiteboard: function () { return [phR(44, 1, 12, 20, "#2F55D4"), phR(30, 1, 12, 27, "#2F55D4"), phR(36, 1, 12, 34, "#2F55D4"), phR(22, 1, 12, 48, "#D8433B"), phE(10, 7.5, 60, 58, "#F4F4F0"), phE(11.5, 8.6, 60, 58, "#2F55D4"), phR(16, 11, 74, 16, "#FFE173"), phR(16, 11, 74, 30, "#FF9DB6"), phR(16, 11, 22, 66, "#9EE3C4"), phR(100, 5, 0, 90, "#B9BDC3"), phR(100, 90, 0, 0, "#F4F4F0"), "linear-gradient(#DADDE2, #DADDE2)"]; },
  shot: function () { return [phR(80, 2.4, 10, 86, "#E6E6E6"), phR(56, 2.4, 10, 80, "#E6E6E6"), phR(38, 6, 10, 62, "#111111"), phR(30, 6, 60, 62, "#111111"), phR(40, 3, 14, 23, "rgba(255,255,255,.85)"), phR(24, 8, 14, 34, "#FFFFFF"), phR(24, 8, 62, 34, "#FFFFFF"), phR(84, 32, 8, 16, "#0000FF"), phR(100, 5, 0, 0, "#F2F2F2"), "linear-gradient(#FFFFFF, #FFFFFF)"]; },
  shot2: function () { return [phE(3, 2.25, 72, 66, "#FFFFFF"), phR(1.6, 26, 40.2, 40, "#3D5AFE"), phR(33, 1.6, 40, 65.6, "#3D5AFE"), phR(92, 16, 4, 80, "#232323"), phR(100, 1.2, 0, 40, "#2A2A2A"), phR(1.2, 100, 40, 0, "#2A2A2A"), phR(100, 1.2, 0, 66, "#2A2A2A"), phR(1.2, 100, 72, 0, "#2A2A2A"), phR(100, 1.2, 0, 20, "#232323"), "linear-gradient(#141414, #141414)"]; },
  doc: function () { return [phR(40, 1.6, 30, 18, "#222222"), phRg(56, 44, 22, 26, "repeating-linear-gradient(to bottom, #A5A5A5 0 1.6%, transparent 1.6% 7%)"), phR(56, 0.4, 22, 74, "#222222"), phR(30, 2, 48, 78, "#222222"), phR(70, 80, 15, 10, "#FBFAF6"), "linear-gradient(135deg, #5F646B, #474B52)"]; },
  poster: function () { return phQR(64, 66).concat([phRg(38, 12, 22, 66, "repeating-linear-gradient(to bottom, #8A8A8A 0 9%, transparent 9% 28%)"), phR(58, 22, 22, 36, "#0000FF"), phR(40, 4.5, 22, 24, "#111111"), phR(52, 4.5, 22, 16, "#111111"), phR(70, 80, 15, 10, "#FAFAF7"), "linear-gradient(135deg, #6B5A4A, #4E4036)"]); },
  portrait: function (tone) { var t = PH_TONES[tone || 0]; return [phE(70, 50, 28, 20, "rgba(255,255,255,.35)", 1), "linear-gradient(160deg, " + t[0] + ", " + t[1] + ")"]; },
  selfie: function () { return [phR(30, 60, 0, 0, "rgba(255,255,255,.35)"), phE(60, 60, 10, 20, "rgba(255,255,255,.35)", 1), "linear-gradient(90deg, #E4E9EF, #AEB8C6)"]; },
  birthday: function () { return [phE(1.6, 1.8, 50, 58, "#FFD27A"), phR(1, 5, 49.5, 59, "#F4E9D8"), phR(34, 12, 33, 64, "#F7EFE6"), phR(44, 2, 28, 76, "#E9DCCB"), phE(4, 3, 15, 20, "rgba(255,206,120,.55)"), phE(3, 2.25, 82, 14, "rgba(255,206,120,.45)"), phE(5, 3.75, 72, 34, "rgba(255,190,110,.35)"), phE(3, 2.25, 30, 40, "rgba(255,220,150,.4)"), phE(40, 26, 50, 60, "rgba(255,180,90,.25)", 1), "linear-gradient(to bottom, #2B1B16, #4A2E20)"]; }
};
var PH_FIGC = { beach: "#2A2B38", sunsea: "#1A1320", sunset: "#1A1320", mountain: "#26332C", lake: "#23303A", night: "#07081A", birthday: "#6A4431", park: "#2B3A30", portrait: "#262A36", selfie: "#353B48" };
var PH_CACHE = {};
var PH_SCENE_IMG = { park: "cam_park", selfie: "cam_selfie", poster: "cam_poster" };
function phImg(it) { return IMG[it.id] ? it.id : (IMG[PH_SCENE_IMG[it.scene]] ? PH_SCENE_IMG[it.scene] : null); }
function phScene(scene, figs, tone, img) {
  if (img && IMG[img]) return imgBg(img);
  var k = scene + "|" + JSON.stringify(figs || []) + "|" + (tone || 0);
  if (PH_CACHE[k]) return PH_CACHE[k];
  var L = [];
  var c = PH_FIGC[scene] || "#1E2230";
  (figs || []).forEach(function (f) { L = L.concat(phFig(f[0], f[1], f[2] || c)); });
  if (scene === "birthday") L = L.slice(0, 0).concat(PH_SCENES.birthday().slice(0, 4), L, PH_SCENES.birthday().slice(4)); // cake in front of people
  else L = L.concat((PH_SCENES[scene] || PH_SCENES.beach)(tone));
  return (PH_CACHE[k] = L.join(", "));
}
var PH_FILTERS = { none: "none", vivid: "saturate(1.55) contrast(1.08)", warm: "sepia(.3) saturate(1.35) hue-rotate(-8deg)", cool: "saturate(1.1) hue-rotate(14deg) brightness(1.03)", mono: "grayscale(1) contrast(1.05)", fade: "contrast(.78) brightness(1.12) saturate(.75)", noir: "grayscale(1) contrast(1.55) brightness(.88)" };
var PH_FILTER_LIST = [["none", "Original"], ["vivid", "Vivid"], ["warm", "Warm"], ["cool", "Cool"], ["mono", "Mono"], ["fade", "Fade"], ["noir", "Noir"]];
/* ctx "thumb": transform applied after translateY(-50%) in a square cell; "view": fitted 3:4 frame (rotated → letterboxed) */
function phLook(it, ctx, edit, shrink) {
  var e = edit || it.edit || {}; var z = (it.z || 1) * (e.crop ? 1.3 : 1); var r = e.rot || 0;
  if (ctx === "view" && r % 180) z = z * 0.75;
  if (shrink) z = z * 0.86;
  return { bg: phScene(it.scene, it.figs, it.tone, phImg(it)), tf: "scale(" + z + ") rotate(" + r + "deg)", flt: PH_FILTERS[e.filter || "none"] || "none" };
}

/* ---------- library data ---------- */
var PH_TAGS = { beach: ["beach", "ocean", "sea", "sand"], sea: ["ocean", "sea", "waves", "beach"], sunset: ["sunset", "golden hour", "sky"], sunsea: ["sunset", "ocean", "beach", "sky"], mountain: ["mountain", "hike", "hiking", "trail"], lake: ["lake", "mountain", "water"], forest: ["forest", "trees", "hike", "hiking"], park: ["park", "trees"], city: ["city", "skyline", "dusk"], night: ["night", "city", "rooftop"], cafe: ["coffee", "cafe"], food: ["food", "dinner"], whiteboard: ["whiteboard", "work", "meeting"], shot: ["screenshot"], shot2: ["screenshot", "map"], doc: ["document", "scan"], poster: ["document", "scan", "poster"], portrait: ["portrait"], selfie: ["selfie", "portrait"], birthday: ["birthday", "party", "cake"] };
function phTagsFor(it) {
  var out = (PH_TAGS[it.scene] || []).concat(it.tags || []);
  if (it.place) out = out.concat(it.place.toLowerCase().replace(/[^a-z ]/g, "").split(" "));
  var seen = {}; return out.filter(function (x) { if (!x || seen[x]) return false; seen[x] = 1; return true; });
}
var PH_SEED = (function () {
  var now = new Date(); var dow = now.getDay(); var sat = (dow + 1) % 7 || 7;
  function at(ago, h, m) { var d = new Date(now); d.setDate(d.getDate() - ago); d.setHours(h, m || 0, 0, 0); return d.getTime(); }
  var mid = new Date(now); mid.setHours(0, 1, 0, 0);
  function rel(min) { return Math.max(mid.getTime(), now.getTime() - min * 60000); }
  var R = [
    ["p01", rel(50), "shot", null, "", [], { kind: "shot", tags: ["boarding pass", "flight"] }],
    ["p02", rel(190), "cafe", null, "Tartine", [], {}],
    ["p03", at(1, 14, 20), "whiteboard", null, "Lumen HQ", ["maya", "sam"], {}],
    ["p04", at(1, 19, 5), "city", null, "Embarcadero", [], { tags: ["sunset"] }],
    ["p05", at(sat, 15, 10), "beach", [[42, 1]], "Ocean Beach", ["maya"], { fav: true }],
    ["p06", at(sat, 15, 14), "beach", null, "Ocean Beach", [], {}],
    ["p07", at(sat, 15, 40), "beach", [[36, 1], [63, 1.05, "#33303F"]], "Ocean Beach", ["maya", "priya"], {}],
    ["p08", at(sat, 16, 2), "portrait", [[50, 2]], "Ocean Beach", ["maya"], { fav: true, tone: 0 }],
    ["p09", at(sat, 16, 30), "sea", null, "Ocean Beach", [], { kind: "video", dur: "0:12" }],
    ["p10", at(sat, 18, 58), "sunsea", null, "Ocean Beach", [], { fav: true }],
    ["p11", at(sat, 19, 4), "sunsea", [[40, 0.9], [58, 0.95]], "Ocean Beach", ["maya", "priya"], {}],
    ["p12", at(sat, 20, 30), "food", null, "Nopa", ["maya", "priya"], {}],
    ["p13", at(sat + 1, 21, 40), "night", [[50, 1.3]], "SoMa", ["jordan"], {}],
    ["p14", at(sat + 1, 21, 55), "city", null, "SoMa", [], {}],
    ["p15", at(sat + 6, 9, 30), "mountain", null, "Mt Tamalpais", [], {}],
    ["p16", at(sat + 6, 10, 5), "forest", null, "Mt Tamalpais", [], {}],
    ["p17", at(sat + 6, 11, 20), "mountain", [[38, 1], [61, 0.95, "#1F2A24"]], "Mt Tamalpais", ["sam", "lena"], {}],
    ["p18", at(sat + 6, 11, 40), "portrait", [[50, 2]], "Mt Tamalpais", ["sam"], { tone: 1 }],
    ["p19", at(sat + 6, 12, 10), "mountain", null, "Mt Tamalpais", [], { kind: "video", dur: "0:24" }],
    ["p20", at(16, 19, 30), "birthday", [[30, 1.3]], "Portland", ["dad"], { fav: true }],
    ["p21", at(16, 19, 40), "portrait", [[50, 2]], "Portland", ["dad"], { tone: 3 }],
    ["p22", at(16, 20, 10), "food", null, "Portland", [], { tags: ["birthday"] }],
    ["p23", at(16, 21, 0), "doc", null, "Portland", [], { kind: "doc", tags: ["receipt"] }],
    ["p24", at(18, 8, 10), "lake", null, "Lake Tahoe", [], {}],
    ["p25", at(18, 13, 0), "lake", [[50, 1.1]], "Lake Tahoe", ["priya"], {}],
    ["p26", at(18, 13, 20), "lake", null, "Lake Tahoe", [], { kind: "video", dur: "0:08" }],
    ["p27", at(18, 18, 45), "sunset", null, "Lake Tahoe", [], {}],
    ["p28", at(25, 12, 0), "shot2", null, "", [], { kind: "shot", tags: ["directions"] }],
    ["p29", at(25, 16, 0), "park", [[46, 1]], "Dolores Park", ["lena"], {}],
    ["p30", at(25, 17, 10), "cafe", null, "Four Barrel", [], {}],
    ["p31", at(40, 14, 0), "beach", null, "Santa Cruz", [], {}],
    ["p32", at(40, 19, 10), "sunset", null, "Santa Cruz", [], {}]
  ];
  return R.map(function (r) {
    var x = r[6];
    return { id: r[0], ts: r[1], scene: r[2], figs: r[3], place: r[4], people: r[5], kind: x.kind || "photo", dur: x.dur || "", fav: !!x.fav, tone: x.tone || 0, tags: x.tags || [] };
  }).sort(function (a, b) { return b.ts - a.ts; });
})();

/* ---------- helpers ---------- */
function phSort(l) { return l.slice().sort(function (a, b) { return b.ts - a.ts; }); }
function phDayKey(ts) { var d = new Date(ts); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
function phAgo(ts, now) { var a = new Date(ts); a.setHours(0, 0, 0, 0); var b = new Date(now); b.setHours(0, 0, 0, 0); return Math.round((b - a) / 864e5); }
function phDayLabel(ts, now) {
  var n = phAgo(ts, now); var d = new Date(ts);
  if (n === 0) return "Today"; if (n === 1) return "Yesterday"; if (n > 1 && n < 7) return DAYS[d.getDay()];
  return MONS[d.getMonth()].slice(0, 3) + " " + d.getDate() + (d.getFullYear() !== new Date(now).getFullYear() ? ", " + d.getFullYear() : "");
}
function phTime(ts) { var d = new Date(ts); return fmtT(d.getHours() + d.getMinutes() / 60) + (d.getHours() < 12 ? " AM" : " PM"); }
function phFullDate(ts) { var d = new Date(ts); return DAYS[d.getDay()] + ", " + MONS[d.getMonth()].slice(0, 3) + " " + d.getDate(); }
function phFirst(api, id) { var p = api.person(id); return p ? p.name.split(" ")[0] : id; }
function phPersonWord(w) { w = (w || "").toLowerCase(); if (w === "father" || w === "dad") return person("dad"); for (var i = 0; i < PEOPLE.length; i++) { var p = PEOPLE[i]; if (p.id === w || p.name.split(" ")[0].toLowerCase() === w) return p; } return null; }
function phLatest(list, kind) { var l = phSort(list).filter(function (it) { return it.kind === (kind || "photo"); }); return l[0] || null; }
function phSecs(dur) { var p = String(dur || "0:05").split(":"); return (+p[0] || 0) * 60 + (+p[1] || 0); }

var PH_STOP = "photo photos picture pictures pic pics find show me my of at the from on in with and all some any search for get pull up see this album make an a called named new create start that those these video's taken".split(" ");
var PH_WD = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
function phParse(t, list, now) {
  var q = { people: [], tags: [], days: null, kind: null, fav: false }; var lab = { day: "", kind: "" }; var any = false;
  var words = t.toLowerCase().replace(/'s\b/g, "").replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  var used = {};
  var vocab = {}; list.forEach(function (it) { phTagsFor(it).forEach(function (tag) { tag.split(" ").forEach(function (w) { vocab[w] = 1; }); }); });
  PEOPLE.forEach(function (p) {
    var f = p.name.split(" ")[0].toLowerCase();
    words.forEach(function (w, i) { if (w === f || w === p.id || (p.id === "dad" && w === "father")) { if (q.people.indexOf(p.id) < 0) q.people.push(p.id); used[i] = 1; any = true; } });
  });
  var nowD = new Date(now); var dow = nowD.getDay();
  function daysAgo(n) { var d = new Date(now); d.setDate(d.getDate() - n); return phDayKey(d.getTime()); }
  words.forEach(function (w, i) {
    if (used[i]) return;
    var wd = PH_WD.indexOf(w);
    if (w === "today") { q.days = [daysAgo(0)]; lab.day = "Today"; used[i] = 1; any = true; }
    else if (w === "yesterday") { q.days = [daysAgo(1)]; lab.day = "Yesterday"; used[i] = 1; any = true; }
    else if (wd >= 0) { var n = (dow - wd + 7) % 7 || 7; q.days = [daysAgo(n)]; lab.day = cap(w); used[i] = 1; any = true; }
    else if (w === "weekend") { var s = (dow + 1) % 7 || 7; q.days = [daysAgo(s), daysAgo(s - 1)]; lab.day = "Weekend"; used[i] = 1; any = true; }
    else if (/^videos?$|^clips?$/.test(w)) { q.kind = "video"; lab.kind = "Videos"; used[i] = 1; any = true; }
    else if (/^screenshots?$/.test(w)) { q.kind = "shot"; lab.kind = "Screenshots"; used[i] = 1; any = true; }
    else if (/^(scans?|documents?|docs?)$/.test(w)) { q.kind = "doc"; lab.kind = "Documents"; used[i] = 1; any = true; }
    else if (/^(favou?rites?|liked|best|starred)$/.test(w)) { q.fav = true; lab.kind = "Favorites"; used[i] = 1; any = true; }
    else if (MONS.map(function (m) { return m.toLowerCase(); }).indexOf(w) >= 0) { var mi = MONS.map(function (m) { return m.toLowerCase(); }).indexOf(w); q.month = mi; lab.day = MONS[mi]; used[i] = 1; any = true; }
  });
  words.forEach(function (w, i) {
    if (used[i] || PH_STOP.indexOf(w) >= 0 || w === "last" || w === "week") return;
    var hit = vocab[w] ? w : (w.slice(-1) === "s" && vocab[w.slice(0, -1)] ? w.slice(0, -1) : null);
    if (hit && q.tags.indexOf(hit) < 0) { q.tags.push(hit); any = true; }
  });
  if (!any) return null;
  var label = q.people.map(function (id) { var p = person(id); return p ? p.name.split(" ")[0] : id; })
    .concat(q.tags.length ? [q.tags.map(cap).join(" ")] : []).concat(lab.day ? [lab.day] : []).concat(lab.kind ? [lab.kind] : []);
  return { q: q, label: label.join(" · ") };
}
function phMatch(it, q) {
  if (!q) return true;
  for (var i = 0; i < q.people.length; i++) if ((it.people || []).indexOf(q.people[i]) < 0) return false;
  if (q.tags.length) { var tw = {}; phTagsFor(it).forEach(function (t) { t.split(" ").forEach(function (w) { tw[w] = 1; }); }); for (var j = 0; j < q.tags.length; j++) if (!tw[q.tags[j]]) return false; }
  if (q.days && q.days.indexOf(phDayKey(it.ts)) < 0) return false;
  if (q.month != null && new Date(it.ts).getMonth() !== q.month) return false;
  if (q.kind && it.kind !== q.kind) return false;
  if (q.fav && !it.fav) return false;
  return true;
}
var PH_DESC = {
  beach: "Ocean Beach in the afternoon: low tide, a long line of surf and a pale sky.",
  sea: "A short clip of waves rolling in, shot from the sand.",
  sunset: "A sunset, the sun halfway under the horizon.",
  sunsea: "Sunset over the water, with a warm streak of light on the waves.",
  mountain: "A mountain ridge with a snow-dusted peak behind it.",
  lake: "A still lake with mountains behind it and light on the water.",
  forest: "Tall pines on the trail.",
  park: "A park on a clear afternoon: lawn, two trees and a path up the hill.",
  city: "The skyline at dusk, lights coming on.",
  night: "A rooftop at night with the city lit up behind.",
  cafe: "A coffee on the table by a sunny window.",
  food: "Dinner from above: a tomato dish with greens, and a coffee on the side.",
  whiteboard: "A whiteboard from a working session: three bullet lines, a circled idea and some sticky notes.",
  shot: "A screenshot of a boarding pass.",
  shot2: "A screenshot of walking directions on a map.",
  doc: "A receipt. The total is at the bottom.",
  poster: "A scanned poster for Open Studio at Lumen, with a QR code.",
  portrait: "A portrait against a soft backdrop.",
  selfie: "A selfie in window light.",
  birthday: "A birthday cake with one candle, in a warm, dim room."
};
function phDescribe(it, api, now) {
  var who = (it.people || []).map(function (id) { return phFirst(api, id); });
  var s = PH_DESC[it.scene] || "A photo.";
  if (who.length) s = (who.length === 1 ? who[0] + ". " : who.slice(0, -1).join(", ") + " and " + who[who.length - 1] + ". ") + s;
  return s + " " + phDayLabel(it.ts, now) + (it.place ? " at " + it.place : "") + ", " + phTime(it.ts) + ".";
}
function phBack(st, api) {
  if (st.sheet) { api.set({ sheet: null }); return true; }
  if (st.edit) { api.set({ edit: null }); return true; }
  if (st.open) { if (st.from && ((api.S && api.S.stack) || []).length) return false; api.set({ open: null, playing: false, from: null }); return true; }
  if (st.sel) { api.set({ sel: null }); return true; }
  if (st.album) { api.set({ album: null }); return true; }
  if (st.searching) { api.set({ searching: false, q: "" }); return true; }
  if (st.filter) { api.set({ filter: null }); return true; }
  if (st.tab === "alb") { api.set({ tab: "lib" }); return true; }
  return false;
}
function phDelete(ids, api, extra) {
  var s = api.get("photos"); var t = Date.now();
  var gone = s.list.filter(function (it) { return ids.indexOf(it.id) >= 0; }).map(function (it) { return Object.assign({}, it, { del: t }); });
  api.set(Object.assign({ list: s.list.filter(function (it) { return ids.indexOf(it.id) < 0; }), trash: gone.concat(s.trash || []), sel: null, sheet: null }, extra || {}));
  var n = gone.length; var what = n > 1 ? n + (gone.every(function (it) { return it.kind === "video"; }) ? " videos" : " photos") : (gone[0] && gone[0].kind === "video" ? "Video" : "Photo");
  api.toast(what + " deleted", { undo: function () { phRestore(ids, api); } });
}
function phRestore(ids, api) {
  var s = api.get("photos");
  var back = (s.trash || []).filter(function (it) { return ids.indexOf(it.id) >= 0; }).map(function (it) { var c = Object.assign({}, it); delete c.del; return c; });
  api.set({ list: phSort(s.list.concat(back)), trash: (s.trash || []).filter(function (it) { return ids.indexOf(it.id) < 0; }) });
}
var PH_T = { lp: null, fired: false };
/* live search: every word must prefix-match a person, tag/place word, day word, month or type */
function phLiveMatch(it, words, now) {
  if (!words.length) return true;
  var bag = phTagsFor(it).join(" ").split(" ");
  (it.people || []).forEach(function (id) { var p = person(id); if (p) bag = bag.concat(p.name.toLowerCase().split(" ")); if (id === "dad") bag.push("father"); });
  var d = new Date(it.ts); bag.push(DAYS[d.getDay()].toLowerCase(), MONS[d.getMonth()].toLowerCase(), phDayLabel(it.ts, now).toLowerCase());
  var ago = phAgo(it.ts, now); if (ago === 0) bag.push("today"); if (ago === 1) bag.push("yesterday"); if (d.getDay() === 0 || d.getDay() === 6) bag.push("weekend");
  bag.push({ video: "videos", shot: "screenshots", doc: "documents scans", photo: "photos" }[it.kind] || "");
  if (it.fav) bag.push("favorites");
  bag = bag.join(" ").split(" ").filter(Boolean);
  return words.every(function (w) { var w2 = w.length > 3 && w.slice(-1) === "s" ? w.slice(0, -1) : w; return bag.some(function (b) { return b.indexOf(w) === 0 || b.indexOf(w2) === 0; }); });
}
function phWords(q) { return String(q || "").toLowerCase().replace(/'s\b/g, "").replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(function (w) { return w && ["of", "at", "the", "in", "on", "from", "with", "and", "photos", "photo", "pictures", "pics", "my", "a"].indexOf(w) < 0; }); }
var PH_SHARE = ["maya", "priya", "dad", "jordan", "sam", "lena"];

registerView("photos", {
  title: "Photos", icon: "photo", aliases: ["gallery", "pictures"],
  chat: "hidden",
  state: { list: PH_SEED, trash: [], albums: [], tab: "lib", filter: null, searching: false, q: "", album: null, open: null, seq: null, chrome: true, sheet: null, shareIds: null, edit: null, sel: null, from: "link", vx: 0, vt: true, playing: false, ppos: 0 },
  persist: ["list", "trash", "albums"],
  jumps: [[null, "Photos"], ["viewer", "Photo viewer"], ["albums", "Albums"], ["search", "Photo search"]],
  preset: function (sub, api) {
    if (sub === "viewer") return { open: "p05", from: null };
    if (sub === "albums") return { tab: "alb" };
    if (sub === "search") { var r = phParse("maya beach", api.st.list || PH_SEED, api.now.getTime()); return { filter: r }; }
  },
  immersive: function (st) { if (st.open) return { dark: true, noPill: true }; if (st.sel || st.sheet || st.searching) return { noPill: true }; return null; },
  back: phBack,
  suggestions: function (st) {
    if (st.open) return ["What's in this photo?", "Send this to Maya", "Make it warmer"];
    return ["Photos of Maya at the beach", "Show Saturday's photos", "Make an album of the hike"];
  },
  voicePhrase: "Find photos of Maya at the beach",
  actions: {
    sendPhoto: function (card, api) { api.toast("Sent to " + (card.to || "").split(" ")[0]); }
  },
  reply: function (t, raw, api) {
    var st = api.st; var list = st.list || []; var now = api.now.getTime(); var m;
    var cur = null; if (api.active && st.open) list.forEach(function (it) { if (it.id === st.open) cur = it; });
    if (cur) {
      if (/what'?s in|describe|what is this|who('s| is) (in )?this|where (was|is) this|tell me about/.test(t)) return { text: phDescribe(cur, api, now) };
      if (/\b(favou?rite|heart|love) (this|it)\b/.test(t)) return { text: "Added to favorites.", then: function () { var s = api.get("photos"); api.set({ list: s.list.map(function (it) { return it.id === cur.id ? Object.assign({}, it, { fav: true }) : it; }) }); } };
      if (/\b(delete|trash|remove)\b.*\b(this|it)\b/.test(t)) return { text: "Deleted. It's in Recently deleted for 30 days.", then: function () { phDelete([cur.id], api, { open: null }); } };
      var fm = t.match(/\b(warm|warmer|vivid|brighter|cool|cooler|black and white|b&w|mono|noir|fade|faded|vintage|original|undo)\b/);
      if (fm && /\b(make|apply|filter|edit|more|turn|go|try|it|this)\b/.test(t)) {
        var f = { warm: "warm", warmer: "warm", vivid: "vivid", brighter: "vivid", cool: "cool", cooler: "cool", "black and white": "mono", "b&w": "mono", mono: "mono", noir: "noir", fade: "fade", faded: "fade", vintage: "fade", original: "none", undo: "none" }[fm[1]];
        return { text: f === "none" ? "Back to the original." : "Done. Tap edit to fine-tune it.", then: function () { var s = api.get("photos"); api.set({ list: s.list.map(function (it) { return it.id === cur.id ? Object.assign({}, it, { edit: Object.assign({}, it.edit || {}, { filter: f }) }) : it; }) }); } };
      }
    }
    if ((m = t.match(/\b(send|share|text)\b(.*)\bto\s+([a-z]+)/)) && /\b(photo|picture|pic|video|selfie|this|it|shot)\b/.test(m[2])) {
      var p = phPersonWord(m[3]);
      var it = (cur && /\b(this|it)\b/.test(m[2])) ? cur : phLatest(list, /\bvideo\b/.test(m[2]) ? "video" : "photo");
      if (p && it) return { text: "Here it is. Send?", card: { type: "draft", to: p.name, body: (it.kind === "video" ? "Video" : "Photo") + " · " + (it.place ? it.place + ", " : "") + phDayLabel(it.ts, now), act: { mod: "photos", fn: "sendPhoto" }, pid: p.id, photo: it.id } };
    }
    if ((m = t.match(/\b(make|create|start|new)\b.*\balbum\b\s*(?:of|with|for|from)?\s*(.*)$/))) {
      var rest = m[2] || ""; var nm = null; var nmm = rest.match(/\b(?:called|named)\s+(.+)$/);
      if (nmm) { nm = nmm[1].replace(/["“”]/g, "").trim(); rest = rest.slice(0, nmm.index); }
      var r = phParse(rest, list, now);
      if (!r) return { text: "Which photos? Try “make an album of the hike”." };
      var ids = phSort(list).filter(function (x) { return phMatch(x, r.q); }).map(function (x) { return x.id; });
      if (!ids.length) return { text: "I couldn't find photos for that album." };
      var name = nm ? cap(nm) : r.label.replace(/ · /g, " ");
      var aid = "a" + Date.now();
      return { text: "Made “" + name + "” with " + ids.length + (ids.length === 1 ? " photo." : " photos."), card: { type: "generic", icon: "photo", title: name, sub: ids.length + " photos", go: { view: "photos", patch: { tab: "alb", album: "user:" + aid, open: null } } },
        then: function () { var s = api.get("photos"); api.setView("photos", { albums: [{ id: aid, name: name, ids: ids }].concat(s.albums || []) }); },
        nav: { view: "photos", patch: { tab: "alb", album: "user:" + aid, open: null, sel: null, filter: null } } };
    }
    var photoWord = /\b(photos?|pictures?|pics|videos?|screenshots?|selfies?|shots)\b/.test(t);
    if (photoWord || (api.active && !st.open)) {
      var res = phParse(t, list, now);
      if (res) {
        var n = list.filter(function (x) { return phMatch(x, res.q); }).length;
        var patch = { filter: res, tab: "lib", album: null, open: null, sel: null, sheet: null, edit: null };
        if (!n) return { text: "Nothing matches “" + res.label + "”." };
        return { text: n === 1 ? "One match." : n + " photos.", card: { type: "generic", icon: "photo", title: res.label, sub: n + (n === 1 ? " photo" : " photos"), go: { view: "photos", patch: patch } }, nav: { view: "photos", patch: patch } };
      }
    }
    return null;
  },
  render: function (st, api) {
    var now = api.now.getTime();
    var list = phSort(st.list || []);
    var secure = !!api.secure;
    if (secure) { var sess = api.get("camera").session || []; list = list.filter(function (it) { return sess.indexOf(it.id) >= 0; }); }
    var byId = {}; list.forEach(function (it) { byId[it.id] = it; });
    var sel = st.sel; var selecting = !!sel;
    var dark = api.theme === "dark";

    function thumb(it, seqIds, trashMode) {
      var on = selecting && sel.indexOf(it.id) >= 0;
      var v = phLook(it, "thumb", null, on);
      return {
        bg: v.bg, tf: v.tf, flt: v.flt, vid: it.kind === "video" && !selecting, dur: it.dur, fav: !!it.fav && !trashMode && !selecting, selecting: selecting && !trashMode, on: on,
        dim: trashMode ? "opacity:.6" : "",
        selCss: on ? "background:var(--acc);box-shadow:0 0 0 2px #ffffff" : "background:rgba(0,0,0,.18);box-shadow:inset 0 0 0 2px #ffffff",
        alt: (trashMode ? "Restore " : "") + (it.kind === "video" ? "Video" : "Photo") + ", " + phDayLabel(it.ts, now) + (it.place ? ", " + it.place : ""),
        tap: function () {
          if (PH_T.fired) { PH_T.fired = false; return; }
          if (trashMode) { phRestore([it.id], api); api.toast("Restored"); return; }
          var s = api.get("photos");
          if (s.sel) { var i = s.sel.indexOf(it.id); api.set({ sel: i >= 0 ? s.sel.filter(function (x) { return x !== it.id; }) : s.sel.concat([it.id]) }); return; }
          api.set({ open: it.id, seq: seqIds, chrome: true, sheet: null, edit: null, from: null, playing: false, vx: 0 });
        },
        pd: function () {
          clearTimeout(PH_T.lp); PH_T.fired = false; if (trashMode) return;
          var stop = function () { clearTimeout(PH_T.lp); window.removeEventListener("pointerup", stop, true); window.removeEventListener("pointercancel", stop, true); };
          window.addEventListener("pointerup", stop, true); window.addEventListener("pointercancel", stop, true);
          PH_T.lp = setTimeout(function () { stop(); PH_T.fired = true; var s = api.get("photos").sel || []; if (s.indexOf(it.id) < 0) s = s.concat([it.id]); api.set({ sel: s }); }, 480);
        },
        pu: function () { clearTimeout(PH_T.lp); }
      };
    }

    /* library */
    var fq = st.filter ? st.filter.q : null;
    var words = st.searching ? phWords(st.q) : [];
    var shown = list.filter(function (it) { return phMatch(it, fq) && phLiveMatch(it, words, now); });
    var seqIds = shown.map(function (it) { return it.id; });
    var groups = []; var gi = {};
    shown.forEach(function (it) {
      var k = phDayKey(it.ts);
      if (gi[k] == null) { gi[k] = groups.length; groups.push({ label: phDayLabel(it.ts, now), pc: {}, items: [] }); }
      var g = groups[gi[k]]; g.items.push(thumb(it, seqIds)); if (it.place) g.pc[it.place] = (g.pc[it.place] || 0) + 1;
    });
    groups.forEach(function (g) { g.place = Object.keys(g.pc).sort(function (a, b) { return g.pc[b] - g.pc[a]; }).slice(0, 2).join(", "); });

    /* albums */
    function albumItems(key) {
      if (key === "fav") return list.filter(function (it) { return it.fav; });
      if (key === "video" || key === "shot" || key === "doc") return list.filter(function (it) { return it.kind === key; });
      if (key === "trash") return (st.trash || []).slice().sort(function (a, b) { return b.del - a.del; });
      var p = key.indexOf(":"); var kind = key.slice(0, p), val = key.slice(p + 1);
      if (kind === "place") return list.filter(function (it) { return it.place === val; });
      if (kind === "person") return list.filter(function (it) { return (it.people || []).indexOf(val) >= 0; });
      if (kind === "user") { var a = (st.albums || []).filter(function (x) { return x.id === val; })[0]; return a ? a.ids.map(function (id) { return byId[id]; }).filter(Boolean) : []; }
      return [];
    }
    function albumName(key) {
      var N = { fav: "Favorites", video: "Videos", shot: "Screenshots", doc: "Documents", trash: "Recently deleted" };
      if (N[key]) return N[key];
      var p = key.indexOf(":"); var kind = key.slice(0, p), val = key.slice(p + 1);
      if (kind === "place") return val;
      if (kind === "person") { var pp = api.person(val); return pp ? pp.name : val; }
      if (kind === "user") { var a = (st.albums || []).filter(function (x) { return x.id === val; })[0]; return a ? a.name : "Album"; }
      return "";
    }
    function tile(key) {
      var items = albumItems(key); if (!items.length) return null;
      var cov = items.filter(function (it) { return it.kind === "photo" && it.scene !== "portrait" && it.scene !== "selfie"; })[0] || items[0]; var c = phLook(cov, "thumb");
      return { name: albumName(key), count: items.length, bg: c.bg, tf: c.tf, flt: c.flt, open: function () { api.set({ album: key }); } };
    }
    var keys = (st.albums || []).map(function (a) { return "user:" + a.id; }).concat(["fav", "video"]);
    var pc = {}; list.forEach(function (it) { if (it.place) pc[it.place] = (pc[it.place] || 0) + 1; });
    Object.keys(pc).filter(function (p) { return pc[p] >= 3; }).forEach(function (p) { keys.push("place:" + p); });
    keys = keys.concat(["shot", "doc"]);
    var tiles = keys.map(tile).filter(Boolean);
    var ppl = api.people.map(function (p) {
      var mine = list.filter(function (it) { return (it.people || []).indexOf(p.id) >= 0; }); if (!mine.length) return null;
      var cover = mine.filter(function (it) { return it.scene === "portrait" || (it.people.length === 1 && it.figs); })[0] || mine[0];
      var c = phLook(cover, "thumb");
      return { first: p.name.split(" ")[0], name: p.name, bg: c.bg, tf: c.tf, open: function () { api.set({ album: "person:" + p.id }); } };
    }).filter(Boolean);

    var alb = null;
    if (st.album) {
      var aItems = albumItems(st.album); var isTrash = st.album === "trash"; var aSeq = aItems.map(function (it) { return it.id; });
      alb = {
        title: albumName(st.album), isTrash: isTrash, notTrash: !isTrash, count: aItems.length, empty: !aItems.length,
        items: aItems.map(function (it) { return thumb(it, aSeq, isTrash); }),
        close: function () { api.set({ album: null }); },
        emptyTrash: function () { api.set({ sheet: "empty" }); }
      };
    }

    /* viewer */
    var cur = st.open ? byId[st.open] : null; var vw = null;
    /* leave the viewer the same way the ‹ button does (shell back: returns to Camera / the calling app when we came from one) */
    var phExitViewer = function () { var b = document.querySelector('[aria-label="Back from photo"]'); if (b) b.click(); };
    if (cur) {
      var seq = (st.seq || list.map(function (it) { return it.id; })).filter(function (id) { return byId[id]; });
      var idx = seq.indexOf(cur.id); if (idx < 0) { seq = list.map(function (it) { return it.id; }); idx = seq.indexOf(cur.id); }
      var look = phLook(cur, "view", st.edit || null);
      var go = function (dir) {
        var ni = idx + dir;
        if (ni < 0 || ni >= seq.length) { api.set({ vx: -dir * 26, vt: false }); api.later(function () { api.set({ vx: 0, vt: true }); }, 40); return; }
        api.set({ open: seq[ni], vx: dir * 90, vt: false, playing: false, ppos: 0, sheet: null }); api.later(function () { api.set({ vx: 0, vt: true }); }, 30);
      };
      var sw = api.sw(function (dx, dy) {  // edges / top / bottom zones are the shell's; we take the rest
        if (Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
        else if (dy > 0) phExitViewer();
        else if (!secure) api.set({ sheet: "info", chrome: true });
        else return false;
      });
      var ed = st.edit || null;
      var people = (cur.people || []).map(function (id) { var p = api.person(id); return p ? { ini: p.ini, first: p.name.split(" ")[0], label: "Open " + p.name, open: function () { api.open("contacts", { open: id }); } } : null; }).filter(Boolean);
      vw = {
        bg: look.bg, tf: look.tf, flt: look.flt,
        slide: "transform: translateX(" + (st.vx || 0) + "px); opacity: " + (st.vx ? 0.35 : 1) + "; transition: " + (st.vt ? "transform .32s cubic-bezier(.19,1,.22,1), opacity .25s" : "none"),
        day: phDayLabel(cur.ts, now), sub: [cur.place, phTime(cur.ts)].filter(Boolean).join(" · "),
        chromeOp: st.chrome ? 1 : 0, chromePE: st.chrome ? "auto" : "none",
        favIcon: cur.fav ? "fill: currentColor" : "", favLabel: cur.fav ? "Remove from favorites" : "Add to favorites",
        vid: cur.kind === "video", playBtn: cur.kind === "video" && !st.playing, playing: !!st.playing,
        prog: "width: " + (st.ppos || 0) + "%; transition: " + (st.ppos ? "width " + phSecs(cur.dur) + "s linear" : "none"),
        dur: cur.dur,
        down: function (e) { try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {} sw.down(e); },
        up: sw.up,
        tap: function () { if (api.swallowed()) return; api.set({ chrome: !api.get("photos").chrome }); },
        share: function () { api.set({ sheet: "share", shareIds: [cur.id] }); },
        fav: function () { var s = api.get("photos"); var on = !cur.fav; api.set({ list: s.list.map(function (it) { return it.id === cur.id ? Object.assign({}, it, { fav: on }) : it; }) }); },
        edit: function () { api.set({ edit: Object.assign({ rot: 0, crop: false, filter: "none" }, cur.edit || {}), sheet: null, playing: false }); },
        info: function () { api.set({ sheet: "info" }); },
        del: function () { var next = seq[idx + 1] || seq[idx - 1] || (secure ? "none" : null); phDelete([cur.id], api, { open: next, seq: seq.filter(function (x) { return x !== cur.id; }) }); },
        notSecure: !secure,
        ask: function () { api.send("What's in this photo?"); },
        play: function () { api.set({ playing: true, ppos: 0 }); api.later(function () { api.set({ ppos: 100 }); }, 40); api.later(function () { var s = api.get("photos"); if (s.open === cur.id) api.set({ playing: false, ppos: 0 }); }, phSecs(cur.dur) * 1000 + 120); },
        pause: function () { api.set({ playing: false, ppos: 0 }); },
        info2: {
          date: phFullDate(cur.ts), time: phTime(cur.ts) + (cur.kind === "video" ? " · Video " + cur.dur : ""),
          hasPlace: !!cur.place, place: cur.place, placeLabel: "Show " + cur.place + " in Maps",
          openPlace: function () { api.open("maps", { query: cur.place }); },
          hasPeople: people.length > 0, people: people, desc: PH_DESC[cur.scene] || ""
        }
      };
      if (ed) {
        var el = phLook(cur, "view", ed);
        vw.ed = {
          bg: el.bg, tf: el.tf, flt: el.flt,
          cropCss: ed.crop ? "background:#ffffff;color:#000000" : "background:rgba(255,255,255,.12);color:#ffffff",
          cropOn: !!ed.crop,
          rotate: function () { var e2 = api.get("photos").edit; api.set({ edit: Object.assign({}, e2, { rot: ((e2.rot || 0) + 90) % 360 }) }); },
          crop: function () { var e2 = api.get("photos").edit; api.set({ edit: Object.assign({}, e2, { crop: !e2.crop }) }); },
          filters: PH_FILTER_LIST.map(function (f) {
            var fl = phLook(cur, "thumb", { filter: f[0] });
            var on = (ed.filter || "none") === f[0];
            return { label: f[1], bg: fl.bg, flt: fl.flt, on: on, ring: on ? "box-shadow: 0 0 0 2px #000000, 0 0 0 4px #ffffff" : "", lc: on ? "#ffffff" : "rgba(255,255,255,.6)", pick: function () { var e2 = api.get("photos").edit; api.set({ edit: Object.assign({}, e2, { filter: f[0] }) }); } };
          }),
          cancel: function () { api.set({ edit: null }); },
          save: function () { var s = api.get("photos"); var e2 = s.edit; var clean = (!e2.rot && !e2.crop && (e2.filter || "none") === "none") ? null : e2; api.set({ edit: null, list: s.list.map(function (it) { return it.id === cur.id ? Object.assign({}, it, { edit: clean }) : it; }) }); api.toast("Saved"); }
        };
      }
    }

    /* share sheet */
    var shareIds = st.shareIds || []; var nShare = shareIds.length;
    var closeSheet = function () { api.set({ sheet: null }); };
    var share = {
      people: PH_SHARE.map(function (id) {
        var p = api.person(id); if (!p) return null;
        return { ini: p.ini, first: p.name.split(" ")[0], label: "Send to " + p.name, send: function () { api.set({ sheet: null, sel: null }); api.toast(nShare > 1 ? "Sent " + nShare + " to " + p.name.split(" ")[0] : "Sent to " + p.name.split(" ")[0]); } };
      }).filter(Boolean),
      apps: [
        ["bubble", "Messages", function () { api.set({ sheet: null, sel: null }); api.open("messages", { compose: true }); }],
        ["mail", "Mail", function () { api.set({ sheet: null, sel: null }); api.open("inbox", { compose: { subject: nShare > 1 ? nShare + " photos" : "Photo", body: "" } }); }],
        ["link", "Copy link", function () { api.set({ sheet: null, sel: null }); api.toast("Link copied"); }],
        ["folder", "Files", function () { api.set({ sheet: null, sel: null }); api.toast("Saved to Files"); }]
      ].map(function (a) { return { d: IC[a[0]], label: a[1], go: a[2] }; })
    };

    var nSel = sel ? sel.length : 0;
    return {
      hdr: !selecting && !st.searching, isLib: st.tab !== "alb" || !!st.searching, isAlb: st.tab === "alb" && !st.searching, libTab: st.tab !== "alb",
      title: st.tab === "alb" ? "Albums" : "Photos",
      tabs: [["lib", "Library", IC.photo], ["alb", "Albums", IC.phAlbums]].map(function (t) { var on = (st.tab || "lib") === t[0]; return { label: t[1], d: t[2], on: on, css: on ? "background:var(--fg);color:var(--bg)" : "color:var(--fg)", pick: function () { api.set({ tab: t[0], sel: null }); } }; }),
      searching: !!st.searching, q: st.q || "", hasQ: !!(st.q || "").trim(), askLabel: "Ask " + api.name + ": “" + (st.q || "").trim() + "”",
      search: function () { api.set({ searching: true, q: "", sel: null, album: null }); },
      onQ: function (e) { api.set({ q: e.target.value }); },
      closeSearch: function () { api.set({ searching: false, q: "" }); },
      askQ: function () { var q = (api.get("photos").q || "").trim(); if (q) api.send(q); },
      searchRef: function (el) { if (el && document.activeElement !== el && !el.dataset.f) { el.dataset.f = "1"; try { el.focus(); } catch (e) {} } },
      selStart: function () { api.set({ sel: [] }); },
      hasFilter: !!st.filter && st.tab !== "alb" && !st.searching, filterLabel: st.filter ? st.filter.label : "", filterN: shown.length,
      clearFilter: function () { api.set({ filter: null }); },
      groups: groups, empty: !shown.length, secure: secure,
      people: ppl, hasPeople: ppl.length > 0, tiles: tiles, trashN: (st.trash || []).length,
      openTrash: function () { api.set({ album: "trash" }); },
      album: !!alb, alb: alb,
      selecting: selecting, selN: nSel === 0 ? "Select" : String(nSel), selNone: nSel === 0,
      selDim: nSel === 0 ? "opacity:.35;pointer-events:none" : "",
      selCancel: function () { api.set({ sel: null }); },
      selShare: function () { var s = api.get("photos"); if (s.sel && s.sel.length) api.set({ sheet: "share", shareIds: s.sel }); },
      selFav: function () { var s = api.get("photos"); var ids = s.sel || []; var all = s.list.filter(function (it) { return ids.indexOf(it.id) >= 0; }).every(function (it) { return it.fav; }); api.set({ sel: null, list: s.list.map(function (it) { return ids.indexOf(it.id) >= 0 ? Object.assign({}, it, { fav: !all }) : it; }) }); api.toast(all ? "Removed from favorites" : "Added to favorites"); },
      selDel: function () { var s = api.get("photos"); if (s.sel && s.sel.length) phDelete(s.sel, api); },
      viewing: !!vw, v: vw, editing: !!(vw && vw.ed), viewEmpty: !!st.open && !cur,
      trashAsk: function () { api.set({ sheet: "empty" }); }, emptyOpen: st.sheet === "empty", trashCount: (st.trash || []).length === 1 ? "1 item" : (st.trash || []).length + " items",
      emptyNow: function () { api.set({ trash: [], sheet: null }); api.toast("Deleted forever"); },
      infoOpen: !!vw && st.sheet === "info", shareOpen: st.sheet === "share",
      share: share, closeSheet: closeSheet, shareTitle: nShare > 1 ? nShare + " photos" : "",
      dark: dark
    };
  }
});
