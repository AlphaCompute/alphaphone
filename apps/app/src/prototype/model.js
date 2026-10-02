import { isMvpView, DEFERRED_MVP_VIEWS, deferredMvpPrompt } from "./mvp-features";
import React from "react";
import { DCLogic } from "./dc-lite.js";


var IC = {
  inbox: "M3 13h5l1.5 3h5l1.5-3h5M5.5 5h13L21 13v6H3v-6z",
  cal: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  notes: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5",
  globe: "M21 12a9 9 0 1 1-18 0a9 9 0 1 1 18 0zM3 12h18M12 3c2.6 2.6 3.6 5.6 3.6 9s-1 6.4-3.6 9M12 3c-2.6 2.6-3.6 5.6-3.6 9s1 6.4 3.6 9",
  flow: "M4 4h6v6H4zM14 14h6v6h-6zM7 10v3a4 4 0 0 0 4 4h3M17 10V7h-4M15 5l2 2-2 2",
  gear: "M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4",
  mic: "M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3",
  send: "M12 19V5M6 11l6-6 6 6",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  back: "M15 5l-7 7 7 7",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z",
  camera: "M4 8h3l2-3h6l2 3h3v11H4zM15.5 13.5a3.5 3.5 0 1 1-7 0a3.5 3.5 0 1 1 7 0z",
  bell: "M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 21h4",
  wifi: "M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01",
  bt: "M7 7l10 10-5 4V3l5 4L7 17",
  moon: "M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z",
  lock: "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  x: "M6 6l12 12M18 6L6 18",
  down: "M6 9l6 6 6-6",
  up: "M6 15l6-6 6 6",
  right: "M9 6l6 6-6 6",
  kbd: "M3 7h18v10H3zM7 11h.01M11 11h.01M15 11h.01M8 14h8",
  stop: "M7 7h10v10H7z",
  user: "M16 8a4 4 0 1 1-8 0a4 4 0 1 1 8 0zM4 21a8 8 0 0 1 16 0",
  folder: "M3 6h6l2 2h10v11H3z",
  wallet: "M3 7h16v12H3zM3 7l12-4v4M15 13h2",
  pin: "M12 21s7-6 7-12a7 7 0 0 0-14 0c0 6 7 12 7 12zM14 9a2 2 0 1 1-4 0a2 2 0 1 1 4 0z",
  plane: "M10 14L3 11l18-7-7 18-3-7zM10 14l5-5",
  wave: "M4 10v4M8 6v12M12 9v6M16 4v16M20 10v4",
  check: "M5 12l5 5 9-10",
  play: "M8 5l11 7-11 7z",
  expand: "M14 4h6v6M10 20H4v-6M20 4l-6 6M4 20l6-6",
  shrink: "M4 14h6v6M20 10h-6V4M10 14l-6 6M14 10l6-6",
  sun: "M16 12a4 4 0 1 1-8 0a4 4 0 1 1 8 0zM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6L19 19M5 19l1.4-1.4M17.6 6.4L19 5",
  heart: "M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z",
  chip: "M7 7h10v10H7zM10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  code: "M8 7l-5 5 5 5M16 7l5 5-5 5",
  info: "M21 12a9 9 0 1 1-18 0a9 9 0 1 1 18 0zM12 11v5M12 8h.01",
  grid: "M5 5h5v5H5zM14 5h5v5h-5zM5 14h5v5H5zM14 14h5v5h-5z",
  reply: "M9 14L4 9l5-5M4 9h10a6 6 0 0 1 6 6v4",
  archive: "M3 4h18v4H3zM5 8v12h14V8M10 12h4",
  clock: "M21 12a9 9 0 1 1-18 0a9 9 0 1 1 18 0zM12 7v5l3 2",
  bubble: "M4 5h16v11H9l-5 4z",
  mail: "M3 6h18v12H3zM3 7l9 6 9-6",
  video: "M3 7h12v10H3zM15 10l6-3v10l-6-3",
  fp: "M7.5 19c-1-1.8-1.5-3.8-1.5-6a6 6 0 0 1 12 0M12 12.5v3c0 1.8.6 3.6 1.5 5M9 13a3 3 0 0 1 6 0c0 2.2.5 4.3 1.6 6.2M4.6 9A8 8 0 0 1 19.4 9",
  torch: "M8 3h8v4l-2 3v11h-4V10L8 7z",
  sweep: "M4 7h16M7 12h10M10 17h4",
  pause: "M8 5v14M16 5v14",
  bookmark: "M6 3h12v18l-6-4-6 4z",
  photo: "M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15.5 9h.01",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
  edit: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  share: "M12 3v12M7 8l5-5 5 5M5 14v6h14v-6",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  search: "M18 11a7 7 0 1 1-14 0a7 7 0 1 1 14 0zM16 16l4 4",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z",
  pill: "M8 9h8a3 3 0 0 1 0 6H8a3 3 0 0 1 0-6z",
  half: "M4 4h16v16H4zM4 12h16",
  spark: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18",
  dial: "M6 6h.01M12 6h.01M18 6h.01M6 12h.01M12 12h.01M18 12h.01M6 18h.01M12 18h.01M18 18h.01"
};
var DARK = { bg: "#000000", s1: "#0B0B0B", s2: "#151515", s3: "#262626", line: "#262626", fg: "#FFFFFF", mut: "#8F8F8F", acct: "#8A93FF", scrim: "rgba(0,0,0,.55)", frame: "#161616", shc: "rgba(0,0,0,.45)" };
var LIGHT = { bg: "#FFFFFF", s1: "#FAFAFA", s2: "#F3F3F3", s3: "#E6E6E6", line: "#E3E3E3", fg: "#000000", mut: "#6B6B6B", acct: "#0000FF", scrim: "rgba(0,0,0,.18)", frame: "#DCDCDC", shc: "rgba(0,0,0,.12)" };
var DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
var MONS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/* Shared people directory. Every app refers to people by id. */
/* Generated photography. build.py fills IMG from img.json (canvas: asset URLs; site: ./img/<key>.webp). */
var IMG = {"p01":"./img/p01.webp","p02":"./img/p02.webp","p03":"./img/p03.webp","p04":"./img/p04.webp","p05":"./img/p05.webp","p06":"./img/p06.webp","p07":"./img/p07.webp","p08":"./img/p08.webp","p09":"./img/p09.webp","p10":"./img/p10.webp","p11":"./img/p11.webp","p12":"./img/p12.webp","p13":"./img/p13.webp","p14":"./img/p14.webp","p15":"./img/p15.webp","p16":"./img/p16.webp","p17":"./img/p17.webp","p18":"./img/p18.webp","p19":"./img/p19.webp","p20":"./img/p20.webp","p21":"./img/p21.webp","p22":"./img/p22.webp","p23":"./img/p23.webp","p24":"./img/p24.webp","p25":"./img/p25.webp","p26":"./img/p26.webp","p27":"./img/p27.webp","p28":"./img/p28.webp","p29":"./img/p29.webp","p30":"./img/p30.webp","p31":"./img/p31.webp","p32":"./img/p32.webp","cam_park":"./img/cam_park.webp","cam_selfie":"./img/cam_selfie.webp","cam_poster":"./img/cam_poster.webp","msg0":"./img/msg0.webp","msg1":"./img/msg1.webp","msg2":"./img/msg2.webp","msg3":"./img/msg3.webp","news":"./img/news.webp","enclave":"./img/enclave.webp","nopa":"./img/nopa.webp"};
function imgBg(key, fallback) { return IMG[key] ? "url(" + IMG[key] + ") center / cover no-repeat" : fallback; }
var PEOPLE = [
  { id: "maya", name: "Maya Chen", ini: "MC", phone: "(415) 555-0132", email: "maya@lumen.example", fav: true, note: "Design lead at Lumen" },
  { id: "jordan", name: "Jordan Park", ini: "JP", phone: "(212) 555-0187", email: "jordan@northpoint.example", fav: true, note: "Partner, Northpoint" },
  { id: "priya", name: "Priya Nair", ini: "PN", phone: "(650) 555-0144", email: "priya@nair.example", fav: true, note: "" },
  { id: "sam", name: "Sam Okafor", ini: "SO", phone: "(510) 555-0199", email: "sam@okafor.example", fav: false, note: "" },
  { id: "lena", name: "Lena Ruiz", ini: "LR", phone: "(718) 555-0121", email: "lena@ruiz.example", fav: false, note: "" },
  { id: "dad", name: "Dad", ini: "D", phone: "(503) 555-0110", email: "", fav: true, note: "" }
];
function person(id) { for (var i = 0; i < PEOPLE.length; i++) if (PEOPLE[i].id === id) return PEOPLE[i]; return null; }
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function pad2(n) { return String(n).padStart(2, "0"); }
function fmtT(t) { var h = Math.floor(t); var m = Math.round((t - h) * 60); var hh = h % 12 || 12; return hh + ":" + pad2(m); }

/* Each app registers itself here. See CONTRACT.md. */
var VIEWS = {};
var ORDER = [];
function registerView(key, def) { VIEWS[key] = def; if (isMvpView(key)) ORDER.push(key); }

/* ===== module: phone ===== */
/* Phone (dialer). Holes are {{phone.*}}. Tabs: Recents (with favorites row), Keypad, Voicemail.
   Call screen + incoming screen are immersive overlays. Recents/voicemail persist. */
IC.phoneIn = IC.phoneIn || "M17 7L7 17M7 10v7h7";
IC.phoneOut = IC.phoneOut || "M7 17L17 7M10 7h7v7";
IC.phoneVm = IC.phoneVm || "M10 12a3.5 3.5 0 1 1-7 0a3.5 3.5 0 1 1 7 0zM21 12a3.5 3.5 0 1 1-7 0a3.5 3.5 0 1 1 7 0zM6.5 15.5h11";
IC.phoneMute = IC.phoneMute || "M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3M4 4l16 16";
IC.phoneSpk = IC.phoneSpk || "M4 9h4l5-4v14l-5-4H4zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12";
IC.phoneAddP = IC.phoneAddP || "M14 8a4 4 0 1 1-8 0a4 4 0 1 1 8 0zM2 21a8 8 0 0 1 12.5-6.6M19 14v6M16 17h6";
IC.phoneDel = IC.phoneDel || "M9 6h11v12H9l-6-6zM12 9.5l5 5M17 9.5l-5 5";

var PN_REC = [
  { id: "r1", pid: "maya", dir: "missed", ago: 12, dur: 0 },
  { id: "r2", pid: null, num: "(628) 555-0199", dir: "in", ago: 52, dur: 24, screened: true, note: "Spam: car warranty. Declined for you." },
  { id: "r3", pid: "jordan", dir: "out", ago: 190, dur: 740, note: "Pro-rata to 15%. He sends the revised sheet tonight." },
  { id: "r4", pid: "dad", dir: "in", ago: 1300, dur: 1260 },
  { id: "r5", pid: "priya", dir: "out", ago: 1570, dur: 95 },
  { id: "r6", pid: "sam", dir: "missed", ago: 3000, dur: 0 },
  { id: "r7", pid: "lena", dir: "in", ago: 4500, dur: 300 }
];
var PN_VM = [
  { id: "v1", pid: "maya", ago: 11, dur: 18, heard: false, gist: "she wants to push the review to 3:30", text: "Hey, it's Maya. Quick one: can we push the review to 3:30? I want to get the prototype on the device first. Call me back." },
  { id: "v2", pid: "dad", ago: 1320, dur: 34, heard: true, gist: "are you coming up for the weekend?", text: "Hi kiddo, just checking in. Mom wants to know if you're coming up for the weekend. No rush, call when you can." },
  { id: "v3", pid: null, num: "(212) 555-0100", label: "Dr. Patel's office", ago: 2900, dur: 22, heard: true, gist: "confirm Thursday at 10 AM", text: "This is Dr. Patel's office confirming your appointment Thursday at 10 AM. Please call back to confirm." }
];
/* live transcript Alpha writes when you turn it on during a call */
var PN_SCRIPT = {
  maya: { lines: [["them", "Hey, got a sec?"], ["you", "Yeah, what's up?"], ["them", "Can we do the review at 3:30 instead?"], ["you", "Works. Bring the prototype."], ["them", "Will do. See you then."]], sum: "Review moved to 3:30. Maya brings the prototype." },
  jordan: { lines: [["them", "Saw the redlines?"], ["you", "Yes. Pro-rata is the sticking point."], ["them", "I can get us to 15%."], ["you", "Do it. Send the revised sheet."]], sum: "Pro-rata at 15%. Jordan sends the revised sheet." },
  dad: { lines: [["them", "Hey kiddo!"], ["you", "Hi Dad. Got your message."], ["them", "Coming up this weekend?"], ["you", "Saturday morning, probably."]], sum: "Visiting Saturday morning." },
  _: { lines: [["them", "Hi, thanks for calling back."], ["you", "Of course. What do you need?"], ["them", "Just confirming Thursday."], ["you", "Thursday works."]], sum: "Confirmed Thursday." }
};
var PN_SCREEN = [["alpha", "Hi, this is {name}, answering for you. What's it about?"], ["them", "Hey, it's Maya. I'm running ten minutes late for three."], ["alpha", "Got it, I'll pass it on. Anything else?"], ["them", "Nope, that's it. Thanks!"]];
var PN_REPLIES = ["Can't talk now. Call you later?", "On my way.", "Running a few minutes late."];
var PN = { live: null, boot: null, lastTab: "recents" };

function pnPeople(api) { var c = api.get("contacts"); return (c && c.list) || PEOPLE; }
function pnWho(api, id) { if (!id) return null; var l = pnPeople(api); for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return person(id); }
function pnDigits(s) { return String(s || "").replace(/\D/g, ""); }
function pnFmt(s) {
  var d = pnDigits(s); if (d.length === 11 && d[0] === "1") d = d.slice(1);
  if (d.length <= 3) return d; if (d.length <= 6) return "(" + d.slice(0, 3) + ") " + d.slice(3);
  if (d.length <= 10) return "(" + d.slice(0, 3) + ") " + d.slice(3, 6) + "-" + d.slice(6); return d;
}
function pnByNum(api, num) { var d = pnDigits(num); if (d.length < 7) return null; var l = pnPeople(api); for (var i = 0; i < l.length; i++) { var pd = pnDigits(l[i].phone); if (pd && (pd === d || (d.length >= 10 && pd.slice(-10) === d.slice(-10)))) return l[i]; } return null; }
function pnFirst(p) { return p.first || String(p.name || "").split(" ")[0]; }
function pnIni(p, num) { return p ? (p.ini || "#") : "#"; }
function pnFind(t, api) {
  var best = null, len = 0;
  pnPeople(api).forEach(function (p) {
    [p.id, String(p.name || "").toLowerCase(), pnFirst(p).toLowerCase(), String(p.last || "").toLowerCase()].forEach(function (n) {
      if (!n || n.length < 2) return;
      var re = new RegExp("\\b" + n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b");
      if (re.test(t) && n.length > len) { best = p; len = n.length; }
    });
  });
  return best;
}
function pnRel(ms, now) {
  var d = new Date(ms); var n = new Date(now);
  var day = function (x) { return new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime(); };
  var diff = Math.round((day(n) - day(d)) / 864e5);
  if (diff === 0) return fmtT(d.getHours() + d.getMinutes() / 60) + (d.getHours() < 12 ? " AM" : " PM");
  if (diff === 1) return "Yesterday";
  if (diff < 7) return DAYS[d.getDay()];
  return MONS[d.getMonth()].slice(0, 3) + " " + d.getDate();
}
function pnAt(e, now) { return e.at || (now - (e.ago || 0) * 60000); }
function pnDur(s) { return s < 60 ? s + " s" : Math.round(s / 60) + " min"; }
function pnClock(s) { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ":" + pad2(s % 60); }
function pnWant(st) { return st.call || (st.num ? "#" + pnDigits(st.num) : null); }

function pnStart(api, pid, num, opt) {
  opt = opt || {};
  var id = pid || "#" + pnDigits(num);
  if (PN.live && PN.live !== id) pnEnd(api, { quiet: true });
  api.stop(); api.stopBg();
  PN.live = id;
  var now = Date.now();
  api.set({ call: pid || null, num: pid ? "" : pnFmt(num), callWho: id, callAt: now, liveAt: opt.live ? now : null, dir: opt.dir || "out",
    mute: false, spk: false, hold: false, kp: false, kpd: "", ai: !!opt.ai, aiN: 0, aiC: 0, min: false, incoming: null, ring: null, rs: false, tick: now, ret: opt.ret || api.get("phone").ret || null });
  if (!opt.live) api.laterBg(function () { var s = api.get("phone"); if (s.callWho === id && !s.liveAt) api.set({ liveAt: Date.now() }); }, 2400);
  api.everyBg(function () {
    var s = api.get("phone"); if (s.callWho !== id) return;
    var p = { tick: Date.now() };
    if (s.ai && s.liveAt && !s.hold) { var sc = PN_SCRIPT[s.call] || PN_SCRIPT._; p.aiC = (s.aiC || 0) + 1; if (p.aiC % 2 === 1 && (s.aiN || 0) < sc.lines.length) p.aiN = (s.aiN || 0) + 1; }
    api.set(p);
  }, 1000);
}
function pnEnd(api, opt) {
  opt = opt || {};
  if (!PN.live) return;
  var s = api.get("phone");
  var dur = s.liveAt ? Math.round((Date.now() - s.liveAt) / 1000) : 0;
  var sc = PN_SCRIPT[s.call] || PN_SCRIPT._;
  var note = s.ai && s.aiN > 0 ? sc.sum : "";
  var e = { id: "r" + Date.now(), pid: s.call || null, num: s.num || "", dir: s.dir || "out", at: Date.now(), dur: dur, note: note };
  api.set({ recents: [e].concat(s.recents || []), call: null, num: "", callWho: null, callAt: null, liveAt: null, ai: false, aiN: 0, kp: false, min: false, hold: false, mute: false, spk: false, ret: null, tab: PN.lastTab || s.tab });
  PN.live = null; api.stopBg();
  if (opt.quiet) return;
  if (note) api.toast(api.name + " saved notes from the call");
  /* started from another app's detail (e.g. a contact): hang up returns there, and drop it from the back stack */
  if (s.ret && api.isActive()) { var stack = (api.S.stack || []).slice(); if (stack[stack.length - 1] === s.ret.view) stack.pop(); api.open(s.ret.view, s.ret.patch); api.shell({ stack: stack }); }
}
function pnRingEnd(api, entry, patch) {
  var s = api.get("phone");
  if (!s.incoming) return;
  api.set(Object.assign({}, patch || {}, { incoming: null, ring: null, rs: false, scrN: 0, recents: [Object.assign({ id: "r" + crypto.randomUUID(), pid: s.incoming, at: Date.now(), dur: 0 }, entry)].concat(s.recents || []) }));
  api.stopBg();
}
function pnDecline(api, why) {
  var s = api.get("phone"); var pid = s.incoming;
  if (!pid) return;
  var patch = why ? {} : { vms: [{ id: "v" + crypto.randomUUID(), pid: pid, at: Date.now(), dur: 12, heard: false, gist: "she's running ten minutes late", text: "Hey, it's Maya. Running ten minutes late for three. See you soon!" }].concat(s.vms || []) };
  pnRingEnd(api, { dir: "missed", note: why || "" }, patch);
  if (!why) api.toast("New voicemail from " + pnFirst(pnWho(api, pid)));
}

registerView("phone", {
  title: "Phone", icon: "phone", aliases: ["dialer", "calls", "recents", "voicemail", "keypad"],
  state: { tab: "recents", dial: "", recents: PN_REC, vms: PN_VM, vmOpen: null, playing: null, vpos: 0, call: null, num: "", callWho: null, incoming: null, ring: null, rs: false, scrN: 0, min: false },
  persist: ["recents", "vms"],
  jumps: [[null, "Phone"], ["keypad", "Keypad"], ["voicemail", "Voicemail"], ["call", "In call"], ["incoming", "Incoming call"]],
  preset: function (sub) {
    if (sub === "keypad") return { tab: "keypad" };
    if (sub === "voicemail") return { tab: "voicemail", vmOpen: "v1" };
    if (sub === "call") return { call: "maya" };
    if (sub === "incoming") return { incoming: "maya", ring: "ring" };
  },
  badge: function (st) { return (st.vms || []).some(function (v) { return !v.heard; }); },
  immersive: function (st) { return (pnWant(st) && !st.min) || st.incoming ? { dark: true, noPill: true } : null; },
  back: function (st, api) {
    if (st.incoming) { if (st.rs) api.set({ rs: false }); return true; }
    if (pnWant(st) && !st.min) { if (st.kp) api.set({ kp: false }); else api.set({ min: true }); return true; }
    if (st.vmOpen) { if (st.playing) api.stop(); api.set({ vmOpen: null, playing: null, vpos: 0 }); return true; }
    return false;
  },
  /* calls and ringing keep going in the background: status-bar chip returns here */
  ongoing: function (st, api) {
    if (st.incoming) { var ip = pnWho(api, st.incoming); return { label: (st.ring === "screen" ? api.name + " · " : "Incoming · ") + (ip ? pnFirst(ip) : "Unknown"), icon: "phone", color: "#1e9e4a" }; }
    if (st.callWho) return { label: st.liveAt ? (st.hold ? "Hold " : "") + pnClock((Date.now() - st.liveAt) / 1000) : "Calling…", icon: "phone", color: "#1e9e4a" };
    return null;
  },
  onLeave: function (api) {
    var st = api.st;
    var p = {};
    if (st.playing) p.playing = null;
    if (st.callWho && st.min) p.min = false;
    if (st.rs) p.rs = false;
    api.set(p); PN.boot = null;
  },
  suggestions: function (st) {
    if (st.tab === "voicemail") return ["Summarize my voicemail", "Call Maya back", "Who called?"];
    if (st.tab === "keypad") return ["Call Dad", "Call Dr. Patel's office"];
    return ["Who called?", "Check voicemail", "Call Maya"];
  },
  voicePhrase: "Call Maya",
  actions: {
    hangup: function (card, api) { pnEnd(api); }
  },
  reply: function (t, raw, api) {
    var st = api.st;
    if (PN.live && /\b(hang up|end (the )?call)\b/.test(t)) return { text: "Ended.", then: function () { pnEnd(api); } };
    if (PN.live && /\b(take notes|transcri)/.test(t)) return { text: "Taking notes. You'll find them in Recents.", then: function () { api.set({ ai: true, min: false }); } };
    if (/\b(voice ?mail)/.test(t)) {
      var vms = st.vms || [];
      var nu = vms.filter(function (v) { return !v.heard; });
      var lead = nu[0] || vms[0];
      if (!lead) return { text: "No voicemail.", nav: { view: "phone", patch: { tab: "voicemail" } } };
      var lp = pnWho(api, lead.pid);
      var txt = (nu.length ? (nu.length === 1 ? "One new, from " : nu.length + " new. Latest from ") : "Nothing new. Last one from ") + (lp ? pnFirst(lp) : lead.label || lead.num) + ": " + (lead.gist || lead.text) + ".";
      return { text: txt, card: { type: "digest", go: { view: "phone", patch: { tab: "voicemail", vmOpen: lead.id } }, rows: vms.slice(0, 3).map(function (v) { var p = pnWho(api, v.pid); return { ini: pnIni(p), who: p ? p.name : v.label || v.num, text: v.text }; }) } };
    }
    if (/who (called|rang)|missed call|recent calls|call log/.test(t)) {
      var now = api.now.getTime();
      var rows = (st.recents || []).slice(0, 4).map(function (e) { var p = pnWho(api, e.pid); return { ini: pnIni(p), who: p ? p.name : e.num, text: (e.dir === "missed" ? "Missed" : e.dir === "in" ? "Incoming" : "Outgoing") + " · " + pnRel(pnAt(e, now), now) + (e.note ? " · " + e.note : "") }; });
      var missed = (st.recents || []).filter(function (e) { return e.dir === "missed"; });
      var mp = missed[0] ? pnWho(api, missed[0].pid) : null;
      return { text: missed.length ? "You missed " + (mp ? pnFirst(mp) : "a call") + (missed.length > 1 ? " and " + (missed.length - 1) + " more." : ".") : "No missed calls.", card: { type: "digest", rows: rows, go: { view: "phone", patch: { tab: "recents" } } } };
    }
    var m = t.match(/\b(call|ring|dial)\b\s+(.*)$/);
    if (!m) return null;
    var rest = m[2];
    var p = null, num = "";
    if (/^(back|them back|him back|her back)\b/.test(rest) || /\b(call|ring) \w+ back\b/.test(t) && !pnFind(rest, api)) {
      var lm = (st.recents || []).filter(function (e) { return e.dir === "missed"; })[0] || (st.vms || [])[0];
      if (lm) { p = pnWho(api, lm.pid); num = p ? "" : lm.num; }
    }
    if (!p && !num) p = pnFind(rest, api);
    if (!p && !num) {
      var dn = pnDigits(rest); if (dn.length >= 7) num = pnFmt(dn);
      else { var v3 = (st.vms || []).filter(function (v) { return v.label && rest.indexOf(v.label.toLowerCase().split(" ")[1] || "~") >= 0; })[0]; if (v3) num = v3.num; }
    }
    if (!p && !num) return null;
    var who = p ? p.name : num;
    return { text: "Calling " + (p ? pnFirst(p) : num) + ".", card: { type: "call", who: who, ini: p ? p.ini : "#", act: { mod: "phone", fn: "hangup" } },
      nav: { view: "phone", patch: p ? { call: p.id, num: "" } : { call: null, num: num }, chat: "hidden" } };
  },
  render: function (st, api) {
    var now = api.now.getTime();
    var tab = st.tab === "favorites" ? "recents" : (st.tab || "recents");
    var want = pnWant(st);
    /* deep link {call} / {num}: start the call once */
    if (want && st.callWho !== want && !st.incoming && PN.boot !== want) {
      PN.boot = want;
      api.later(function () { PN.boot = null; var s = api.get("phone"); if (pnWant(s) === want && s.callWho !== want) { PN.lastTab = tab; pnStart(api, s.call, s.num); } }, 0);
    }
    var callFrom = function (pid, num) { return function () { if (api.swallowed()) return; PN.lastTab = tab; pnStart(api, pid, num); }; };
    var tabDefs = [["recents", IC.clock, "Recents"], ["keypad", IC.dial, "Keypad"], ["voicemail", IC.phoneVm, "Voicemail"]];
    var unheard = (st.vms || []).filter(function (v) { return !v.heard; }).length;
    var tabs = tabDefs.map(function (d) {
      var on = tab === d[0];
      return { d: d[1], label: d[2], on: on, dot: d[0] === "voicemail" && unheard > 0 && !on, css: on ? "background:var(--fg);color:var(--bg)" : "color:var(--fg)",
        pick: function () { api.stop(); api.set({ tab: d[0], vmOpen: null, playing: null, vpos: 0 }); } };
    });

    /* recents */
    var favs = pnPeople(api).filter(function (p) { return p.fav; }).map(function (p) { return { ini: p.ini, first: pnFirst(p), label: "Call " + p.name, call: callFrom(p.id) }; });
    var recents = (st.recents || []).map(function (e) {
      var p = pnWho(api, e.pid); var missed = e.dir === "missed";
      return {
        ini: pnIni(p), who: p ? p.name : e.num, nameCss: missed ? "color:var(--acct)" : "",
        dirD: e.dir === "out" ? IC.phoneOut : IC.phoneIn, dirCss: missed ? "color:var(--acct)" : "color:var(--mut)",
        sub: pnRel(pnAt(e, now), now) + (e.dur ? " · " + pnDur(e.dur) : ""),
        note: e.note || "", hasNote: !!e.note,
        label: "Call " + (p ? p.name : e.num),
        call: callFrom(e.pid, e.num),
        infoLabel: p ? p.name + " info" : "Add " + e.num + " to contacts", infoD: p ? IC.info : IC.phoneAddP,
        info: function () { if (p) api.open("contacts", { open: p.id }); else api.open("contacts", { add: { phone: e.num } }); }
      };
    });

    /* keypad */
    var dial = st.dial || "";
    var dd = pnDigits(dial);
    var match = null;
    if (dd.length >= 3) pnPeople(api).forEach(function (p) { if (!match && pnDigits(p.phone).indexOf(dd) >= 0) match = p; });
    var KEYS = [["1", ""], ["2", "ABC"], ["3", "DEF"], ["4", "GHI"], ["5", "JKL"], ["6", "MNO"], ["7", "PQRS"], ["8", "TUV"], ["9", "WXYZ"], ["*", ""], ["0", "+"], ["#", ""]];
    if (!match && dd.length >= 2) {
      var t9 = {}; KEYS.forEach(function (k) { k[1].split("").forEach(function (c) { t9[c.toLowerCase()] = k[0]; }); });
      pnPeople(api).forEach(function (p) { if (match) return; var nm = pnFirst(p).toLowerCase().split("").map(function (c) { return t9[c] || ""; }).join(""); if (nm.indexOf(dd) === 0) match = p; });
    }
    var keys = KEYS.map(function (k) { return { d: k[0], sub: k[1], label: k[0], press: function () { api.set({ dial: (api.get("phone").dial || "") + k[0] }); } }; });
    var dkeys = KEYS.map(function (k) { return { d: k[0], sub: k[1], label: "Tone " + k[0], press: function () { var s = api.get("phone"); api.set({ kpd: (s.kpd || "") + k[0] }); } }; });

    /* voicemail */
    var vms = (st.vms || []).map(function (v, i) {
      var p = pnWho(api, v.pid); var open = st.vmOpen === v.id; var playing = st.playing === v.id;
      var pos = open ? (st.vpos || 0) : 0;
      return {
        ini: pnIni(p), who: p ? p.name : (v.label || v.num), time: pnRel(pnAt(v, now), now), dur: pnClock(v.dur), text: v.text,
        unheard: !v.heard, open: open, closed: !open, bgCss: open ? "background:var(--s2)" : "", avBg: open ? "var(--s3)" : "var(--s2)", textColor: open ? "var(--fg)" : "var(--mut)", nameCss: v.heard ? "" : "font-weight: 700",
        textCss: open ? "" : "display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden",
        toggle: function () { var s = api.get("phone"); if (s.playing) api.stop(); api.set({ vmOpen: open ? null : v.id, playing: null, vpos: 0, vms: s.vms.map(function (x) { return x.id === v.id ? Object.assign({}, x, { heard: true }) : x; }) }); },
        playD: playing ? IC.pause : IC.play, playLabel: playing ? "Pause" : "Play",
        prog: Math.round(pos * 1000) / 10, posT: pnClock(pos * v.dur),
        play: function () {
          var s = api.get("phone");
          if (s.playing === v.id) { api.stop(); api.set({ playing: null }); return; }
          api.stop();
          api.set({ playing: v.id, vpos: (s.vpos || 0) >= 0.99 ? 0 : (s.vpos || 0) });
          api.every(function () { var s2 = api.get("phone"); if (s2.playing !== v.id) return; var np = (s2.vpos || 0) + 0.25 / v.dur; if (np >= 1) { api.stop(); api.set({ playing: null, vpos: 1 }); } else api.set({ vpos: np }); }, 250);
        },
        call: callFrom(v.pid, v.num),
        msgLabel: "Message " + (p ? p.name : v.label || v.num), hasMsg: !!p, hasAdd: !p,
        addLabel: "Add " + (v.label || v.num) + " to contacts",
        add: function () { var nm = String(v.label || "").split(" "); api.open("contacts", { add: { first: v.label ? v.label : "", phone: v.num } }); },
        msg: function () { if (p) api.open("messages", { thread: p.id }); },
        del: function () {
          var s = api.get("phone"); api.stop();
          api.set({ vms: s.vms.filter(function (x) { return x.id !== v.id; }), vmOpen: null, playing: null, vpos: 0 });
          var restore = function () {
            var l = (api.get("phone").vms || []).slice();
            if (!l.some(function (item) { return item.id === v.id; })) l.splice(Math.min(i, l.length), 0, v);
            try { api.set({ vms: l }); }
            catch (error) { api.toast("Voicemail could not be restored. Try Undo again.", { undo: restore }); }
          };
          api.toast("Voicemail from " + (p ? pnFirst(p) : (v.label || v.num)) + " deleted", { undo: restore });
        }
      };
    });

    /* call screen */
    var inCall = !!want;
    var cp = inCall ? pnWho(api, st.call) : null;
    var cnum = cp ? "" : (st.num || "");
    var live = !!st.liveAt;
    var el = live ? (Date.now() - st.liveAt) / 1000 : 0;
    var status = !live ? "Calling…" : (st.hold ? "On hold · " : "") + pnClock(el);
    var sc = PN_SCRIPT[st.call] || PN_SCRIPT._;
    var themName = cp ? pnFirst(cp) : "Caller";
    var lines = sc.lines.slice(0, st.aiN || 0).map(function (l) { return { who: l[0] === "you" ? "You" : themName, text: l[1], css: l[0] === "you" ? "color:#8F8F8F" : "color:#FFFFFF" }; }).slice(-5);
    var ctrl = function (key, d, label, on, extra) {
      return { d: d, label: label, on: !!on, css: on ? (key === "ai" ? "background:var(--acc);color:#fff" : "background:#FFFFFF;color:#000000") : "background:rgba(255,255,255,.12);color:#FFFFFF", glyph: key === "ai", icon: key !== "ai",
        toggle: function () { var s = api.get("phone"); var p = {}; p[key] = !s[key]; if (key === "ai" && p.ai) p.kp = false; api.set(p); if (key === "ai" && p.ai) api.toast(api.name + " is taking notes"); } };
    };
    var controls = inCall ? [
      ctrl("mute", IC.phoneMute, st.mute ? "Unmute" : "Mute", st.mute),
      ctrl("kp", IC.dial, st.kp ? "Hide keypad" : "Show keypad", st.kp),
      ctrl("spk", IC.phoneSpk, "Speaker", st.spk),
      ctrl("hold", IC.pause, st.hold ? "Resume" : "Hold", st.hold),
      ctrl("ai", null, st.ai ? api.name + " notes off" : api.name + " takes notes", st.ai)
    ] : [];

    /* incoming */
    var ip = st.incoming ? pnWho(api, st.incoming) : null;
    var screening = st.ring === "screen";
    var scrLines = PN_SCREEN.slice(0, st.scrN || 0).map(function (l) { return { who: l[0] === "alpha" ? api.name : (ip ? pnFirst(ip) : "Caller"), text: l[1].replace("{name}", api.name), css: l[0] === "alpha" ? "color:#8F8F8F" : "color:#FFFFFF" }; });
    var scrDone = screening && (st.scrN || 0) >= PN_SCREEN.length;

    return {
      tab: tab, title: tab === "keypad" ? "Keypad" : (tab === "voicemail" ? "Voicemail" : "Recents"),
      tabs: tabs, isRecents: tab === "recents", isKeypad: tab === "keypad", isVm: tab === "voicemail",
      favs: favs, hasFavs: favs.length > 0, recents: recents, noRecents: recents.length === 0,
      addContact: function () { api.open("contacts", { add: true }); },
      dial: pnFmt(dial) || dial, hasDial: dial.length > 0, noDial: dial.length === 0, dialSize: dial.length > 11 ? 30 : 38,
      match: match ? { ini: match.ini, name: match.name, num: match.phone, pick: function () { api.set({ dial: pnDigits(match.phone) }); } } : null,
      hasMatch: !!match, keys: keys, dkeys: dkeys,
      delKey: function () { var d = api.get("phone").dial || ""; api.set({ dial: d.slice(0, -1) }); },
      clearKey: function () { api.set({ dial: "" }); },
      dialCall: function () {
        var d = api.get("phone").dial || "";
        if (!d) { var last = (api.get("phone").recents || []).filter(function (e) { return e.dir === "out"; })[0]; if (last) api.set({ dial: last.pid ? pnDigits((pnWho(api, last.pid) || {}).phone) : pnDigits(last.num) }); return; }
        PN.lastTab = "keypad";
        var mp = pnByNum(api, d);
        api.set({ dial: "" });
        pnStart(api, mp ? mp.id : null, mp ? "" : d);
      },
      vms: vms, noVms: vms.length === 0,

      inCall: inCall, callFull: inCall && !st.min, banner: inCall && !!st.min,
      cName: cp ? cp.name : cnum, cIni: cp ? cp.ini : "#", cStatus: status, calling: inCall && !live,
      showAvatar: inCall && !st.kp && !(st.ai && lines.length), showLines: inCall && !st.kp && st.ai && lines.length > 0, lines: lines,
      aiOn: inCall && st.ai, aiWait: inCall && st.ai && !lines.length && !st.kp,
      showDkp: inCall && !!st.kp, kpd: st.kpd || "", controls: controls,
      endCall: function () { pnEnd(api); },
      restore: function () { api.set({ min: false }); },

      ringing: !!st.incoming, rName: ip ? ip.name : "Unknown", rIni: ip ? ip.ini : "#", rSub: ip ? ip.phone : "",
      rCtx: "Probably about the 3:00 design review",
      isRing: !!st.incoming && !screening, isScreen: screening, scrLines: scrLines, scrDone: scrDone, scrLive: screening && !scrDone,
      scrSum: "Maya's running ten minutes late for 3:00.",
      accept: function () { var s = api.get("phone"); PN.lastTab = tab; pnStart(api, s.incoming, "", { dir: "in", live: true }); },
      decline: function () { pnDecline(api); },
      endScreen: function () { pnRingEnd(api, { dir: "in", screened: true, dur: (api.get("phone").scrN || 0) * 2, note: "Maya's running ten minutes late for 3:00." }); api.toast(api.name + " saved the message"); },
      alphaAnswer: function () {
        api.stopBg(); api.set({ ring: "screen", scrN: 1 });
        api.everyBg(function () { var s = api.get("phone"); if (s.ring !== "screen") return; if ((s.scrN || 0) < PN_SCREEN.length) api.set({ scrN: (s.scrN || 0) + 1 }); }, 1900);
      },
      rsOpen: !!st.rs, openReply: function () { api.set({ rs: true }); }, closeReply: function () { api.set({ rs: false }); },
      replies: PN_REPLIES.map(function (r) { return { text: r, send: function () { var s = api.get("phone"); var pp = pnWho(api, s.incoming); pnDecline(api, "Replied: " + r); api.toast("Sent to " + (pp ? pnFirst(pp) : "caller")); } }; }),
      writeReply: function () { var s = api.get("phone"); var pid = s.incoming; pnDecline(api, "Declined with a message"); api.open("messages", { compose: pid }); }
    };
  }
});

/* ===== module: messages ===== */
/* Messages: SMS / RCS. Holes are {{messages.*}}. */
IC.msgUnread = IC.msgUnread || "M15 12a3 3 0 1 1-6 0a3 3 0 1 1 6 0z";

var MSG_PHOTOS = [
  "linear-gradient(160deg,#F2B880 0%,#D9785B 55%,#4B3B6B 100%)",
  "linear-gradient(200deg,#9AD0EC 0%,#4F86C6 60%,#233D6E 100%)",
  "linear-gradient(170deg,#C7E3B0 0%,#6FA56B 55%,#2F4F3A 100%)",
  "linear-gradient(150deg,#F5E1C8 0%,#C9A27A 60%,#6B4E3A 100%)"
];
// k = minutes since midnight today (negative = yesterday)
var MSG_SEED = {
  maya: [
    { me: false, text: "Pushed the new flows to Figma", k: -330 },
    { me: true, text: "Looks great. Review tomorrow?", k: -322 },
    { me: false, text: "Yes! Put it on the calendar", k: -321 },
    { me: true, text: "Design review is at 3", k: 750 },
    { me: false, text: "Still on for 3? I can bring the prototype.", k: 844 }
  ],
  priya: [
    { me: true, text: "Saturday was so fun", k: -600 },
    { me: false, text: "Right?? Lunch Tuesday?", k: -590 },
    { me: true, text: "Yes. Tartine at 1", k: -588 },
    { me: false, text: "Sent you the photos from Saturday", k: 700 },
    { me: false, photo: 0, k: 700 },
    { me: false, photo: 1, k: 700 }
  ],
  jordan: [
    { me: false, text: "Can we do 4:30 instead of 4?", k: 615 },
    { me: true, text: "Works.", k: 618 }
  ],
  sam: [
    { me: false, text: "Running 10 min late to standup", k: 562 },
    { me: true, text: "No worries", k: 563 }
  ],
  dad: [
    { me: false, text: "Did you see the game last night?", k: -700 },
    { me: true, text: "Missed it! Call you Sunday", k: -650 },
    { me: false, text: "Ok. Love you", k: -640 }
  ]
};
var MSG_SMART = {
  maya: [["See you at 3", "Yes, see you at 3. Bring the prototype!"], ["Bring it", "Yes, bring it. Can't wait to try it."], ["Running 5 late", "Running 5 late, start without me."]],
  priya: [["These are great", "These are great, thank you!"], ["Send the rest?", "Love these. Send the rest?"], ["Tuesday still on?", "Still on for Tuesday at 1?"]],
  jordan: [["Works", "Works for me."], ["Can we do 5?", "Can we push to 5?"]],
  dad: [["Love you too", "Love you too, Dad."], ["Call Sunday?", "Call you Sunday?"]],
  sam: [["No worries", "No worries."], ["Thanks", "Thanks!"]]
};
var MSG_BOT = {
  maya: ["Perfect. See you at 3.", "Bringing the new build too, it's much faster.", "Ha, ok. On my way."],
  priya: ["Glad you like them!", "More coming tonight."],
  jordan: ["Great, talk then.", "Sounds good."],
  sam: ["Cool.", "On it."],
  dad: ["Talk soon kiddo.", "Love you."]
};
var MSG_GENERIC = [["Sounds good", "Sounds good."], ["Thanks!", "Thanks!"]];

function msgPeople(api) { var c = api.get("contacts") || {}; return (c.list && c.list.length) ? c.list : api.people; }
function msgWho(api, pid, st) {
  var l = msgPeople(api);
  for (var i = 0; i < l.length; i++) if (l[i].id === pid) return l[i];
  var p = api.person(pid); if (p) return p;
  var ex = ((st || api.get("messages")).extra || []).filter(function (x) { return x.id === pid; })[0];
  if (ex) return ex;
  return { id: pid, name: String(pid).replace(/^n:/, ""), ini: "#", phone: String(pid).replace(/^n:/, "") };
}
function msgFind(api, word) {
  if (!word) return null; word = word.toLowerCase().replace(/[^a-z]/g, "");
  return msgPeople(api).filter(function (p) { return p.id === word || p.name.toLowerCase().split(" ")[0] === word; })[0] || null;
}
function msgFirst(p) { return String(p.name).split(" ")[0]; }
function msgFmt(k) {
  if (k < 0) return "Yesterday";
  var h = Math.floor(k / 60) % 24, m = k % 60;
  return (h % 12 || 12) + ":" + pad2(m) + (h < 12 ? " AM" : " PM");
}
function msgMaxK(threads) { var mx = 0; Object.keys(threads).forEach(function (p) { threads[p].forEach(function (m) { if (m.k > mx) mx = m.k; }); }); return mx; }
function msgNowK(api, threads) { var d = api.now; return Math.max(d.getHours() * 60 + d.getMinutes(), msgMaxK(threads) + 1); }
function msgLastIn(list) { for (var i = list.length - 1; i >= 0; i--) if (!list[i].me && list[i].text) return list[i]; return null; }

function msgPush(api, pid, msgs) {
  var st = api.get("messages"); var th = Object.assign({}, st.threads);
  if (!Array.isArray(msgs)) msgs = [msgs];
  var k0 = msgNowK(api, st.threads);
  msgs = msgs.map(function (x) { return Object.assign({ k: k0 }, x); });
  var msg = msgs[msgs.length - 1];
  th[pid] = (th[pid] || []).concat(msgs);
  var patch = { threads: th };
  var viewing = api.get("messages").thread === pid && api.S.view === "messages";
  if (!msg.me && !viewing) { var u = Object.assign({}, st.unread); u[pid] = (u[pid] || 0) + 1; patch.unread = u; }
  api.set(patch);
}
function msgFiles(api, ids) {
  var fl = VIEWS.files ? ((api.get("files") || {}).files || []) : [];
  return (ids || []).map(function (id) { var f = fl.filter(function (x) { return x.id === id; })[0]; return f ? { id: f.id, name: f.name, size: f.size } : null; }).filter(Boolean);
}
function msgSend(api, pid, text, photo, files) {
  var out = (files || []).map(function (f) { return { me: true, file: f.name, fid: f.id, size: f.size }; });
  var names = (files || []).map(function (f) { return f.name; }).join(", ");
  if (photo != null) out.push({ me: true, photo: photo });
  else if (text && text !== names) out.push({ me: true, text: text });
  if (!out.length) return;
  out = out.map(function (m) { return Object.assign({ id: crypto.randomUUID() }, m); });
  var sentId = out[out.length - 1].id;
  msgPush(api, pid, out);
  var stillSent = function () { return (api.get("messages").threads[pid] || []).some(function (m) { return m.id === sentId; }); };
  var st = api.get("messages");
  var bot = MSG_BOT[pid]; if (!bot) return;
  var n = (st.botI || {})[pid] || 0; if (n >= bot.length) return;
  var bi = Object.assign({}, st.botI); bi[pid] = n + 1; api.set({ botI: bi });
  api.later(function () { if (stillSent()) api.set({ typing: pid }); }, 900);
  api.later(function () { if (!stillSent()) return; api.set({ typing: null }); msgPush(api, pid, { me: false, text: bot[n] }); }, 2600);
}
function msgDraftCard(api, pid) {
  var st = api.get("messages"); var p = msgWho(api, pid, st);
  var sm = MSG_SMART[pid] || MSG_GENERIC;
  return { type: "draft", to: p.name, body: sm[0][1], pid: pid, act: { mod: "messages", fn: "sendDraft" } };
}
function msgOpenThread(api, pid, local) {
  var st = api.get("messages"); var u = Object.assign({}, st.unread); delete u[pid];
  api.set({ thread: pid, compose: null, unread: u, tray: false, q: "", local: local !== false });
}

registerView("messages", {
  title: "Messages", icon: "bubble", aliases: ["texts", "sms", "text"],
  chat: "hidden",
  state: { threads: MSG_SEED, unread: { maya: 1, priya: 3 }, extra: [], botI: {}, thread: null, compose: null, text: "", attach: null, tray: false, typing: null, q: "", sq: null, local: false, slide: null },
  persist: ["threads", "unread", "extra"],
  jumps: [[null, "Messages"], ["thread", "Thread"], ["new", "New message"]],
  preset: function (sub) {
    if (sub === "thread") return { thread: "maya" };
    if (sub === "new") return { compose: true };
  },
  badge: function (st) { var u = st.unread || {}; return Object.keys(u).some(function (k) { return u[k] > 0; }); },
  immersive: function (st) { return (st.thread || typeof st.compose === "string") ? { noPill: true, toastBottom: 104 } : null; },
  back: function (st, api) {
    if (st.tray) { api.set({ tray: false }); return true; }
    // Opened from this app's list: back to the list. Deep-linked (contacts, shade, chat, share): hand back to the shell's stack.
    if (st.thread || st.compose) { var u = Object.assign({}, st.unread); var tp = st.thread || st.compose; if (typeof tp === "string") delete u[tp]; api.set({ thread: null, compose: null, text: "", attach: null, q: "", unread: u }); return !!st.local; }
    if (st.sq != null) { api.set({ sq: null }); return true; }
    return false;
  },
  onLeave: function (api) {
    var st = api.st; var tp = st.thread || (typeof st.compose === "string" ? st.compose : null);
    if (tp) { var u = Object.assign({}, st.unread); delete u[tp]; api.set({ unread: u, typing: null }); }
  },
  suggestions: function (st, api) {
    var tp = st.thread || (typeof st.compose === "string" ? st.compose : null);
    if (tp) { var f = msgFirst(msgWho(api, tp, st)); return ["Reply for me", "What did " + f + " say?", "Tell " + f + " I'm 5 min late"]; }
    return ["Text Maya I'm running late", "What did Priya send?", "Any new texts?"];
  },
  voicePhrase: "Text Maya I'm running five minutes late",
  reply: function (t, raw, api) {
    var st = api.st; var m, p;
    var here = api.active;
    var tp = st.thread || (typeof st.compose === "string" ? st.compose : null);
    // text <person> <body> / tell <person> <body>
    m = t.match(/^(?:text|message|sms|tell)\s+(\w+)[\s,:]*(?:that\s+|saying\s+)?(.*)$/);
    if (m && (p = msgFind(api, m[1]))) {
      var body = m[2] ? raw.trim().slice(raw.trim().length - m[2].length).trim() : "";
      if (!body) return { text: "Opening " + msgFirst(p) + ".", nav: { view: "messages", patch: { thread: p.id } } };
      body = cap(body.replace(/\bi'm\b/gi, "I'm").replace(/\bim\b/gi, "I'm"));
      if (!/[.!?]$/.test(body)) body += ".";
      return { text: "Here's a text to " + msgFirst(p) + ".", card: { type: "draft", to: p.name, body: body, pid: p.id, act: { mod: "messages", fn: "sendDraft" } } };
    }
    // reply for me (in thread) / reply to <person>
    if (here && tp && /^(reply for me|draft a reply|reply|write (a )?reply)/.test(t)) return { text: "Here's a reply to " + msgFirst(msgWho(api, tp, st)) + ".", card: msgDraftCard(api, tp) };
    m = t.match(/reply to (\w+)/);
    if (m && (p = msgFind(api, m[1])) && (st.threads || {})[p.id] && !/e-?mail/.test(t)) return { text: "Here's a reply to " + msgFirst(p) + ".", card: msgDraftCard(api, p.id) };
    // what did <person> send/say
    m = t.match(/what did (\w+) (send|say|text|write|want)|(\w+)'s (texts|messages)/);
    if (m && (p = msgFind(api, m[1] || m[3])) && (st.threads || {})[p.id]) {
      var list = st.threads[p.id]; var inc = list.filter(function (x) { return !x.me; });
      var photos = inc.filter(function (x) { return x.photo != null && x.k === inc[inc.length - 1].k; }).length;
      var last = msgLastIn(list);
      var txt = last ? msgFirst(p) + ", " + msgFmt(last.k) + ": \u201c" + last.text + "\u201d" : msgFirst(p) + " hasn't texted.";
      if (photos) txt += " Plus " + (photos === 1 ? "a photo" : photos + " photos") + ".";
      return { text: txt, card: { type: "generic", icon: "bubble", title: p.name, sub: last ? last.text : "", go: { view: "messages", patch: { thread: p.id } } } };
    }
    // search texts
    m = t.match(/(?:find|search(?: for)?|look for)\s+(?:my\s+)?(?:texts?|messages)\s+(?:about|from|with|mentioning)\s+(.+)/);
    if (m) {
      var q = m[1].replace(/[?.]$/, "").trim(); var qp = msgFind(api, q.split(" ")[0]);
      var hits = Object.keys(st.threads || {}).filter(function (id) { return (qp && qp.id === id) || st.threads[id].some(function (x) { return (x.text || "").toLowerCase().indexOf(q) >= 0; }); });
      if (!hits.length) return { text: "No texts match \u201c" + q + "\u201d." };
      return { text: hits.length === 1 ? "One conversation." : hits.length + " conversations.", card: { type: "digest", rows: hits.map(function (id) { var w = msgWho(api, id, st); var x = st.threads[id].filter(function (y) { return (y.text || "").toLowerCase().indexOf(q) >= 0; }).pop() || msgLastIn(st.threads[id]) || {}; return { ini: w.ini, who: w.name, text: x.text || "Photo", go: { view: "messages", patch: { thread: id } } }; }), go: { view: "messages", patch: { sq: q } } } };
    }
    // unread texts
    if (/(new|unread|any) (texts|messages|sms)|texts\?$/.test(t)) {
      var u = st.unread || {}; var ids = Object.keys(u).filter(function (k) { return u[k] > 0; });
      if (!ids.length) return { text: "No new texts." };
      return { text: ids.length === 1 ? "One new conversation." : ids.length + " people texted.", card: { type: "digest", rows: ids.map(function (id) { var w = msgWho(api, id, st); var l = msgLastIn(st.threads[id] || []); return { ini: w.ini, who: w.name, text: l ? l.text : "Photo" }; }), go: { view: "messages" } } };
    }
    return null;
  },
  actions: {
    sendDraft: function (card, api) {
      var pid = card.pid;
      if (!pid) { var f = msgFind(api, String(card.to || "").split(" ")[0]); pid = f ? f.id : null; }
      if (!pid) { api.toast("No thread for " + card.to); return; }
      msgSend(api, pid, card.body);
      var st = api.get("messages"); var u = Object.assign({}, st.unread); delete u[pid]; api.set({ unread: u });
      api.toast("Sent to " + msgFirst(msgWho(api, pid)));
    }
  },
  render: function (st, api) {
    var threads = st.threads || {};
    var unread = st.unread || {};
    var ids = Object.keys(threads).filter(function (id) { return threads[id].length; });
    ids.sort(function (a, b) { var la = threads[a][threads[a].length - 1].k, lb = threads[b][threads[b].length - 1].k; return lb - la; });
    var sq = (st.sq || "").trim().toLowerCase();
    if (sq) ids = ids.filter(function (id) {
      var w = msgWho(api, id, st);
      return (w.name + " " + (w.phone || "") + " " + threads[id].map(function (m) { return m.text || m.file || ""; }).join(" ")).toLowerCase().indexOf(sq) >= 0;
    });
    var convos = ids.map(function (id) {
      var w = msgWho(api, id, st); var l = threads[id][threads[id].length - 1];
      var un = (unread[id] || 0) > 0;
      var prev = l.photo != null ? "Photo" : (l.file || l.text);
      if (sq && !(w.name.toLowerCase().indexOf(sq) >= 0)) { var hit = threads[id].filter(function (m) { return (m.text || "").toLowerCase().indexOf(sq) >= 0; }).pop(); if (hit) { prev = hit.text; l = hit; } }
      var s = api.sw(function (dx, dy) {
        if (Math.abs(dy) > Math.abs(dx)) return false;
        if (dx < 0) {
          api.set({ slide: { id: id, x: -412 } });
          api.later(function () {
            var s2 = api.get("messages"); var savedThread = s2.threads[id], savedUnread = s2.unread[id];
            var th = Object.assign({}, s2.threads); delete th[id]; var uu = Object.assign({}, s2.unread); delete uu[id];
            try { api.set({ slide: null, threads: th, unread: uu, typing: s2.typing === id ? null : s2.typing }); }
            catch (error) { api.set({ slide: null }); api.toast("Conversation could not be deleted. Try again."); return; }
            var restore = function () {
              var current = api.get("messages");
              if (current.threads[id]) { api.toast("A new conversation already exists. Your newer messages were kept."); return; }
              var restored = Object.assign({}, current.threads); restored[id] = savedThread;
              var restoredUnread = Object.assign({}, current.unread); if (savedUnread !== undefined) restoredUnread[id] = savedUnread;
              try { api.setView("messages", { threads: restored, unread: restoredUnread }); }
              catch (error) { api.toast("Conversation could not be restored. Try Undo again.", { undo: restore }); }
            };
            api.toast("Conversation with " + msgFirst(w) + " deleted", { undo: restore });
          }, 260);
        } else {
          var s3 = api.get("messages"); var uu2 = Object.assign({}, s3.unread);
          if (uu2[id] > 0) delete uu2[id]; else uu2[id] = 1;
          api.set({ unread: uu2 });
        }
      });
      return {
        ini: w.ini, name: w.name, last: (l.me ? "You: " : "") + prev, time: msgFmt(l.k),
        nameW: un ? "700" : "500", lastCss: un ? "color:var(--fg);font-weight:600" : "color:var(--mut)", dot: un ? "var(--acct)" : "transparent",
        label: (un ? "Unread, " : "") + w.name,
        down: s.down, up: s.up, tx: st.slide && st.slide.id === id ? st.slide.x : 0,
        open: function () { if (api.swallowed()) return; msgOpenThread(api, id); }
      };
    });

    var tp = st.thread || (typeof st.compose === "string" ? st.compose : null);
    var th = null;
    if (tp) {
      var w = msgWho(api, tp, st); var list = threads[tp] || [];
      var bubbles = list.map(function (m, i) {
        var prev = list[i - 1], next = list[i + 1];
        var sep = !prev || m.k - prev.k >= 60;
        var joinNext = next && next.me === m.me && next.k - m.k < 60;
        var r = m.me ? (joinNext ? "20px 20px 6px 20px" : "20px 20px 6px 20px") : "20px 20px 20px 6px";
        var isPhoto = m.photo != null, isFile = !!m.file;
        return {
          sep: sep, sepLabel: sep ? (m.k < 0 ? "Yesterday " : "") + msgFmt(m.k < 0 ? m.k + 1440 : m.k) : "",
          text: m.text || "", isText: !isPhoto && !isFile, isPhoto: isPhoto, isFile: isFile, file: m.file || "", size: m.size || "",
          openFile: function () { if (VIEWS.files && m.fid) api.open("files", { open: m.fid }); else api.toast(m.file); },
          row: "justify-content:" + (m.me ? "flex-end" : "flex-start") + ";margin-top:" + (sep ? "4px" : (prev && prev.me === m.me ? "3px" : "12px")),
          css: (m.me ? "background:var(--acc);color:#fff;" : "background:var(--s2);color:var(--fg);") + "border-radius:" + r,
          photoCss: "background:" + imgBg("msg" + ((m.photo || 0) % MSG_PHOTOS.length), MSG_PHOTOS[(m.photo || 0) % MSG_PHOTOS.length]) + ";border-radius:" + r,
          openPhoto: function () { if (VIEWS.photos) api.open("photos"); else api.toast("Photo"); }
        };
      });
      var lastIn = list.length && !list[list.length - 1].me ? list[list.length - 1] : null;
      var sm = lastIn ? (MSG_SMART[tp] && (st.botI || {})[tp] ? MSG_GENERIC : (MSG_SMART[tp] || MSG_GENERIC)) : [];
      var atts = msgFiles(api, st.attach);
      var send = function (text) {
        var s2 = api.get("messages"); var fs = text != null ? [] : msgFiles(api, s2.attach);
        var tx = String(text != null ? text : s2.text).trim(); if (!tx && !fs.length) return;
        msgSend(api, tp, tx, null, fs); api.set({ text: "", tray: false, attach: text != null ? s2.attach : null });
      };
      th = {
        name: w.name, ini: w.ini, bubbles: bubbles, typing: st.typing === tp,
        who: function () { if (api.person(tp) || msgPeople(api).some(function (p) { return p.id === tp; })) api.open("contacts", { open: tp }); else api.open("contacts", { add: true }); },
        call: function () { api.open("phone", { call: tp }); },
        smart: sm.map(function (s) { return { label: s[0], go: function () { send(s[1]); } }; }),
        hasSmart: !st.tray && !atts.length,
        ask: function () { api.say("Here's a reply to " + msgFirst(w) + ".", msgDraftCard(api, tp)); },
        atts: atts.map(function (f) { return { name: f.name, rm: function () { api.set({ attach: (api.get("messages").attach || []).filter(function (x) { return x !== f.id; }) }); } }; }),
        hasAtts: atts.length > 0,
        text: st.text || "", hasText: !!(st.text || "").trim(),
        sendCss: ((st.text || "").trim() || atts.length) ? "background:var(--acc);color:#fff" : "background:var(--s2);color:var(--mut)",
        onText: function (e) { api.set({ text: e.target.value }); },
        onKey: function (e) { if (e.key === "Enter") { e.preventDefault(); send(); } },
        send: function () { send(); },
        tray: !!st.tray, trayCss: st.tray ? "background:var(--fg);color:var(--bg);transform:rotate(45deg)" : "background:var(--s2);color:var(--fg)",
        toggleTray: function () { api.set({ tray: !api.get("messages").tray }); },
        camera: function () { api.open("camera", { mode: "photo" }); },
        photos: MSG_PHOTOS.map(function (g, i) { return { css: "background:" + imgBg("msg" + i, g), label: "Send photo " + (i + 1), pick: function () { msgSend(api, tp, null, i); api.set({ tray: false }); } }; })
      };
    }

    var pick = null;
    if (st.compose === true) {
      var q = (st.q || "").trim().toLowerCase();
      var digits = q.replace(/[^0-9]/g, "");
      var numOnly = /^[0-9()+\-\s.]+$/.test(q) && digits.length >= 3;
      var ppl = msgPeople(api).filter(function (p) { return !q || p.name.toLowerCase().indexOf(q) >= 0 || (digits && String(p.phone || "").replace(/[^0-9]/g, "").indexOf(digits) >= 0); });
      var goNum = function () {
        if (!numOnly) return;
        var id = "n:" + digits; var s2 = api.get("messages");
        var ex = (s2.extra || []).filter(function (x) { return x.id !== id; }).concat([{ id: id, name: st.q.trim(), ini: "#", phone: st.q.trim() }]);
        var thr = Object.assign({}, s2.threads); if (!thr[id]) thr[id] = [];
        api.set({ extra: ex, threads: thr }); msgOpenThread(api, id, st.local);
      };
      pick = {
        q: st.q || "",
        onQ: function (e) { api.set({ q: e.target.value }); },
        onKey: function (e) { if (e.key === "Enter") { e.preventDefault(); if (numOnly) goNum(); else if (ppl[0]) msgOpenThread(api, ppl[0].id, st.local); } },
        people: ppl.map(function (p) { return { ini: p.ini, name: p.name, phone: p.phone, go: function () { msgOpenThread(api, p.id, st.local); } }; }),
        isNum: numOnly, num: (st.q || "").trim(), goNum: goNum
      };
    }

    return {
      convos: convos,
      newMsg: function () { api.set({ compose: true, q: "", local: true }); },
      searching: st.sq != null, notSearching: st.sq == null, sq: st.sq || "", hasSq: !!sq, empty: convos.length === 0,
      emptyIcon: sq ? IC.search : IC.bubble, emptyText: sq ? "No results" : "No messages",
      openSearch: function () { api.set({ sq: "" }); },
      closeSearch: function () { api.set({ sq: null }); },
      onSq: function (e) { api.set({ sq: e.target.value }); },
      askSq: function () { var q0 = (api.get("messages").sq || "").trim(); api.set({ sq: null }); api.send(/text|message|sent|said|say/i.test(q0) ? q0 : "Find texts about " + q0); },
      inThread: !!th, t: th,
      picking: !!pick, p: pick
    };
  }
});

/* ===== module: inbox ===== */
/* Inbox: email only, across accounts. Holes are {{inbox.*}}. */
IC.inboxFwd = IC.inboxFwd || "M15 14l5-5-5-5M20 9H10a6 6 0 0 0-6 6v4";
IC.inboxClip = IC.inboxClip || "M20 11.5l-8.2 8.2a5 5 0 0 1-7.1-7.1l8.6-8.6a3.4 3.4 0 0 1 4.8 4.8l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8";

var INBOX_ACCTS = [
  { id: "personal", label: "Personal", provider: "google", address: "me@gmail.example", mail: true, calendar: true, contacts: true },
  { id: "work", label: "Work", provider: "microsoft", address: "me@alphacompute.example", mail: true, calendar: true, contacts: true }
];
var INBOX_SEED = [
  { id: 2, pid: "jordan", acct: "work", k: 793, time: "1:12 PM", unread: true, subj: "Revised term sheet",
    body: "Hi,\n\nAttached is the revised term sheet. We moved on the pro-rata and tightened the board language as discussed.\n\nNeed your eyes by Friday so we can get it to counsel. Happy to walk through it on our 4:30.\n\nJordan",
    atts: [{ name: "Term sheet v3.pdf", size: "212 KB", file: "termsheet" }],
    gist: "Revised term sheet, needs your eyes by Friday", draft: "Thanks Jordan. Reading it tonight, notes to you by Friday." },
  { id: 1, pid: "maya", acct: "work", k: 768, time: "12:48 PM", unread: true, subj: "Notes for the 3:00 review",
    body: "Notes for this afternoon attached. Pages 6 to 9 are the new onboarding flow, that's where I'd love your call.\n\nMaya",
    atts: [{ name: "Design review notes.pdf", size: "1.1 MB", file: "designnotes" }],
    gist: "Notes for the 3:00 review, wants your call on the onboarding pages", draft: "Thanks Maya, reading now. The onboarding pages look strong." },
  { id: 4, pid: "lena", acct: "personal", k: 570, time: "9:30 AM", unread: true, subj: "Dinner Friday?",
    body: "We're doing tacos at ours on Friday around 7. Bring nothing but yourself. Sam's coming too.\n\nL",
    gist: "Tacos at hers Friday at 7", draft: "Count me in. See you Friday at 7!" },
  { id: 5, pid: "sam", acct: "work", k: 588, time: "9:48 AM", unread: false, subj: "Standup notes",
    body: "Quick notes from standup:\n\n- Build 0.9 goes to beta testers Thursday\n- Enclave attestation is green on all devices\n- Maya owns the onboarding copy\n\nSam",
    gist: "Standup notes, beta build Thursday", draft: "Thanks Sam, all good on my side." },
  { id: 3, name: "GPU Reserve", ini: "GR", email: "no-reply@gpureserve.example", acct: "work", k: 545, time: "9:05 AM", unread: false, subj: "Reservation confirmed · Oct 2",
    body: "Your reservation for 8 × H200 on October 2, 09:00 to 21:00 PT is confirmed.\n\nReference GR-20417.",
    gist: "GPU reservation confirmed for Oct 2", draft: "Thanks, confirmed." },
  { id: 6, name: "Tartine", ini: "T", email: "hello@tartine.example", acct: "personal", k: 492, time: "8:12 AM", unread: false, subj: "Table for 2 at 1:00",
    body: "See you today at 1:00 PM. Table for 2 under your name, Guerrero St.\n\nReply to this email to change your booking.",
    gist: "Lunch booking at 1:00 confirmed", draft: "Thanks, see you at 1." },
  { id: 7, name: "Alaska Airlines", ini: "AS", email: "trips@alaskaair.example", acct: "personal", k: -300, time: "Yesterday", unread: false, subj: "Your trip to Portland",
    body: "SFO to PDX, Saturday Oct 4, 8:40 AM. Seat 7A.\n\nCheck-in opens 24 hours before departure.",
    gist: "Portland flight Saturday 8:40 AM", draft: "Thanks." }
];

function inboxAccts(api) {
  var s = api.get("settings") || {};
  var a = (s.accounts || []).filter(function (x) { return x.mail !== false; });
  return a.length ? a : INBOX_ACCTS;
}
function inboxAcctLabel(a) {
  if (a.label) return a.label;
  if (/^(personal|work|school|home)$/.test(a.id)) return cap(a.id);
  var dom = String(a.address || "").split("@")[1] || a.provider || a.id;
  return cap(dom.split(".")[0]);
}
function inboxAcctOf(accts, id) {
  for (var i = 0; i < accts.length; i++) if (accts[i].id === id) return accts[i];
  for (var j = 0; j < accts.length; j++) if (String(accts[j].label || "").toLowerCase() === id) return accts[j];
  return id === "work" && accts[1] ? accts[1] : accts[0];
}
function inboxPeople(api) { var c = api.get("contacts") || {}; return (c.list && c.list.length) ? c.list : api.people; }
function inboxPerson(api, id) { var l = inboxPeople(api); for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return api.person(id); }
function inboxWho(api, m) {
  var p = m.pid ? inboxPerson(api, m.pid) : null;
  if (p) return { name: p.name, ini: p.ini, email: p.email };
  var nm = m.name || cap(String(m.pid || m.email || "Unknown"));
  return { name: nm, ini: m.ini || nm.charAt(0).toUpperCase(), email: m.email || "" };
}
function inboxFind(api, word) {
  if (!word) return null; word = word.toLowerCase();
  return inboxPeople(api).filter(function (p) { return p.id === word || p.name.toLowerCase().split(" ")[0] === word || p.name.toLowerCase() === word; })[0] || null;
}
function inboxClock(d) { var h = d.getHours(); return (h % 12 || 12) + ":" + pad2(d.getMinutes()) + (h < 12 ? " AM" : " PM"); }
function inboxLive(st) { return (st.mails || []).filter(function (m) { return !m.arch && !m.del; }); }
function inboxMail(st, id) {
  var l = (st.mails || []).concat(st.sent || []);
  for (var i = 0; i < l.length; i++) if (String(l[i].id) === String(id)) return l[i];
  return null;
}
function inboxFiles(api) { var f = VIEWS.files ? (api.get("files") || {}).files : null; return f || []; }
function inboxOpenFile(api, a) {
  var hit = inboxFiles(api).filter(function (f) { return f.id === a.file; })[0];
  if (hit) api.open("files", { open: a.file }); else api.toast(a.name);
}
function inboxAttOf(api, ids) {
  var fl = inboxFiles(api);
  return (ids || []).map(function (id) { var f = fl.filter(function (x) { return x.id === id; })[0]; return f ? { name: f.name, size: f.size, file: f.id } : null; }).filter(Boolean);
}
function inboxRecips(to) { if (!to) return []; return Array.isArray(to) ? to.slice() : [to]; }
function inboxRecipName(api, r) { if (typeof r === "string" && r.indexOf("@") >= 0) return r; var p = inboxPerson(api, r); return p ? p.name : r; }
function inboxMarkRead(api, id) {
  var st = api.get("inbox");
  api.set({ mails: (st.mails || []).map(function (m) { return String(m.id) === String(id) && m.unread ? Object.assign({}, m, { unread: false }) : m; }) });
}
function inboxUndo(api, msg, snap) {
  api.toast(msg, { undo: function () { if (api.isActive()) api.set(snap); else api.open("inbox", snap); } });
}
function inboxDraftLabel(api, c) {
  var r = inboxRecips(c && c.to)[0];
  return r ? "Draft to " + inboxRecipName(api, r).split(" ")[0] + " discarded" : "Draft discarded";
}
function inboxDraftCard(api, m) {
  var w = inboxWho(api, m);
  return { type: "draft", to: w.name, body: m.draft || "Thanks, noted.", act: { mod: "inbox", fn: "sendDraft" }, mid: m.id, pid: m.pid || null, subject: "Re: " + m.subj };
}
function inboxSendMail(api, to, subj, body, acct, replyTo, atts) {
  var st = api.get("inbox");
  var s = { id: "s" + Date.now(), sent: true, to: to, acct: acct || "personal", subj: subj || "(no subject)", body: body || "", time: inboxClock(api.now), k: 2000 + (st.sent || []).length, atts: atts || [] };
  var patch = { sent: [s].concat(st.sent || []) };
  if (replyTo != null) patch.mails = (st.mails || []).map(function (m) { return String(m.id) === String(replyTo) ? Object.assign({}, m, { unread: false, replied: true }) : m; });
  api.set(patch);
  return s;
}

registerView("inbox", {
  title: "Inbox", icon: "mail", aliases: ["email", "mail", "gmail"],
  chat: "hidden",
  state: { mails: INBOX_SEED, sent: [], acct: "all", open: null, openLocal: false, compose: null, composeLocal: false, slide: null, toQ: "", q: null },
  persist: ["mails", "sent"],
  jumps: [[null, "Inbox"], ["mail", "Email"], ["compose", "Compose"]],
  preset: function (sub) {
    if (sub === "mail") return { open: 2 };
    if (sub === "compose") return { compose: { to: "jordan", subject: "Re: Revised term sheet", body: "" } };
  },
  badge: function (st) { return inboxLive(st).some(function (m) { return m.unread; }); },
  immersive: function (st) { return st.compose ? { noPill: true } : null; },
  // Sub-pages opened in-app close back to the list; deep-linked ones (from another app, the shade, chat) hand back to the shell.
  back: function (st, api) {
    if (st.compose) {
      api.set({ compose: null, toQ: "" }); inboxUndo(api, inboxDraftLabel(api, st.compose), { compose: st.compose, composeLocal: true });
      return !!st.composeLocal;
    }
    if (st.open != null) { inboxMarkRead(api, st.open); api.set({ open: null }); return !!st.openLocal; }
    if (st.q != null) { api.set({ q: null }); return true; }
    return false;
  },
  onLeave: function (api) { if (api.st.open != null) inboxMarkRead(api, api.st.open); },
  suggestions: function (st) {
    if (st.compose) return ["Write this for me", "Make it shorter"];
    if (st.open != null) return ["Draft a reply", "Summarize this email", "Forward to Maya"];
    return ["Summarize my inbox", "Reply to Jordan", "Archive the rest"];
  },
  voicePhrase: "Summarize my inbox",
  reply: function (t, raw, api) {
    var st = api.st; var here = api.active;
    var live = inboxLive(st);
    var cur = st.open != null ? inboxMail(st, st.open) : null;
    var m;

    // inside an open email
    if (here && cur && !cur.sent) {
      if (/draft a reply|reply for me|write (a )?reply|^reply$/.test(t)) return { text: "Here's a reply to " + inboxWho(api, cur).name.split(" ")[0] + ".", card: inboxDraftCard(api, cur) };
      if (/summar|tl;?dr|what does (it|this) say/.test(t)) return { text: cur.gist + ".", card: { type: "summary", bullets: cur.body.split(/\n+/).filter(function (l) { return l.length > 24; }).slice(0, 3) } };
      m = t.match(/^forward (?:this |it )?to (\w+)/);
      if (m) { var fp = inboxFind(api, m[1]); if (fp) return { text: "Forwarding to " + fp.name.split(" ")[0] + ".", nav: { view: "inbox", patch: { compose: { to: fp.id, subject: "Fwd: " + cur.subj, body: "\n\n---\n" + cur.body, acct: cur.acct, atts: cur.atts || [] } } } }; }
    }
    if (here && st.compose && /write this|draft (it|this)|make it shorter|shorter/.test(t)) {
      var c = st.compose; var rn = inboxRecips(c.to)[0]; var who = rn ? inboxRecipName(api, rn).split(" ")[0] : "there";
      var body = /shorter/.test(t) ? "Hi " + who + ", quick one: " + (c.subject || "following up") + ". Thoughts?" : "Hi " + who + ",\n\nFollowing up on " + (c.subject || "our conversation").replace(/^(re|fwd): /i, "") + ". Let me know what works.\n\nThanks";
      return { text: "Done. It's in the draft.", then: function () { api.set({ compose: Object.assign({}, api.get("inbox").compose || c, { body: body }) }); } };
    }

    // summarize
    if (/(summar|catch me up|brief me|what'?s new).*(inbox|e-?mail|mail)|(inbox|e-?mail|mail).*summar/.test(t) || (here && /^summar/.test(t))) {
      var un = live.filter(function (x) { return x.unread; });
      if (!un.length) return { text: "Nothing unread. You're clear." };
      var dl = un.filter(function (x) { return /by (mon|tues|wednes|thurs|fri)day/i.test(x.gist); })[0];
      return { text: un.length + " unread." + (dl ? " " + inboxWho(api, dl).name.split(" ")[0] + "'s has a deadline." : ""), card: { type: "summary", bullets: un.map(function (x) { return inboxWho(api, x).name.split(" ")[0] + " · " + x.gist; }), go: { view: "inbox" } } };
    }
    // unread count
    if (/(unread|new) (e-?mails?|mail)|any (e-?mails?|mail)/.test(t)) {
      var n = live.filter(function (x) { return x.unread; });
      return { text: n.length ? n.length + " unread emails." : "No unread email.", card: n.length ? { type: "digest", rows: n.map(function (x) { var w = inboxWho(api, x); return { ini: w.ini, who: w.name, text: x.subj }; }), go: { view: "inbox" } } : null };
    }
    // archive the rest
    if (/archive (the )?(rest|read|all|everything|everything else|read ones)/.test(t) && (here || /mail|inbox/.test(t))) {
      var rd = live.filter(function (x) { return !x.unread; });
      if (!rd.length) return { text: "Nothing to archive." };
      return { text: "Archived " + rd.length + ". Only unread left.", then: function () {
        var s2 = api.get("inbox"); var ids = rd.map(function (x) { return x.id; });
        api.set({ mails: s2.mails.map(function (x) { return ids.indexOf(x.id) >= 0 ? Object.assign({}, x, { arch: true }) : x; }) });
      } };
    }
    // email <person> [about|saying] ...
    m = t.match(/^(?:e-?mail|send an e-?mail to|write an e-?mail to|write to)\s+(\w+)\s*(about|re|saying|that|to say)?\s*(.*)$/);
    if (m) {
      var p = inboxFind(api, m[1]);
      if (p && p.email) {
        var tail = m[3] ? raw.slice(raw.toLowerCase().lastIndexOf(m[3])).trim() : "";
        if (!tail) return { text: "New email to " + p.name.split(" ")[0] + ".", nav: { view: "inbox", patch: { compose: { to: p.id, subject: "", body: "" } } } };
        var saying = m[2] === "saying" || m[2] === "that" || m[2] === "to say";
        var bodyTxt = saying ? cap(tail.replace(/[.]?$/, ".")) : "Hi " + p.name.split(" ")[0] + ", quick note about " + tail.replace(/[.]$/, "") + ". Do you have time this week?";
        return { text: "Drafted to " + p.name.split(" ")[0] + ".", card: { type: "draft", to: p.name, body: bodyTxt, pid: p.id, subject: saying ? "Quick note" : cap(tail), act: { mod: "inbox", fn: "sendDraft" } } };
      }
    }
    // reply to <person> (email)
    m = t.match(/reply to (\w+)/);
    if (m && (here || /e-?mail|mail/.test(t))) {
      var rp = inboxFind(api, m[1]);
      var hit = rp ? live.filter(function (x) { return x.pid === rp.id; })[0] : null;
      if (hit) return { text: "Here's a reply to " + rp.name.split(" ")[0] + ".", card: inboxDraftCard(api, hit) };
    }
    // find / search email
    m = t.match(/(?:find|search|look for|show)\s+(?:my\s+|the\s+)?(?:e-?mails?|mail)\s+(?:from|about|with)\s+(.+)|(?:e-?mails?|mail) (?:from|about) (.+)/) || (here ? t.match(/^(?:find|search(?: for)?)\s+(.+)/) : null);
    if (m) {
      var q = (m[1] || m[2] || "").replace(/[?.]$/, "").trim();
      var qp = inboxFind(api, q);
      var res = (st.mails || []).filter(function (x) {
        if (x.del) return false;
        if (qp && x.pid === qp.id) return true;
        var w = inboxWho(api, x);
        return (x.subj + " " + x.body + " " + w.name).toLowerCase().indexOf(q) >= 0;
      });
      if (!res.length) return { text: "No email matches “" + q + "”." };
      if (res.length === 1) return { text: "Found it.", card: { type: "generic", icon: "mail", title: res[0].subj, sub: inboxWho(api, res[0]).name + " · " + res[0].time, go: { view: "inbox", patch: { open: res[0].id } } } };
      return { text: res.length + " emails.", card: { type: "digest", rows: res.map(function (x) { var w = inboxWho(api, x); return { ini: w.ini, who: w.name, text: x.subj }; }), go: { view: "inbox" } } };
    }
    if (/term sheet (e-?mail|mail)|jordan'?s (e-?mail|mail)/.test(t)) return { text: "Jordan's revised term sheet.", nav: { view: "inbox", patch: { open: 2 } } };
    return null;
  },
  actions: {
    sendDraft: function (card, api) {
      var to = card.pid || null;
      var src = card.mid != null ? inboxMail(api.get("inbox"), card.mid) : null;
      if (!to && src) to = src.pid || src.email;
      inboxSendMail(api, to ? [to] : [], card.subject || (src ? "Re: " + src.subj : ""), card.body, src ? src.acct : "personal", card.mid);
      api.toast("Sent to " + String(card.to || "").split(" ")[0]);
    }
  },
  render: function (st, api) {
    var accts = inboxAccts(api);
    var multi = accts.length > 1;
    var isSent = st.acct === "sent";
    var chips = [{ id: "all", label: "All" }].concat(accts.map(function (a) { return { id: a.id, label: inboxAcctLabel(a) }; })).map(function (c) {
      var on = st.acct === c.id;
      return { label: c.label, on: on, css: on ? "background:var(--fg);color:var(--bg)" : "background:var(--s2);color:var(--fg)", pick: function () { api.set({ acct: c.id }); } };
    });
    if (!multi) chips = chips.slice(0, 1);
    chips.push({ label: "Sent", on: isSent, css: isSent ? "background:var(--fg);color:var(--bg)" : "background:var(--s2);color:var(--fg)", pick: function () { api.set({ acct: isSent ? "all" : "sent" }); } });
    var searching = st.q != null; var sq = (st.q || "").trim().toLowerCase();

    var list;
    if (isSent) list = (st.sent || []).slice();
    else {
      list = inboxLive(st).filter(function (m) { return st.acct === "all" || inboxAcctOf(accts, m.acct).id === st.acct; });
      list.sort(function (a, b) { return (b.unread ? 1 : 0) - (a.unread ? 1 : 0) || b.k - a.k; });
    }
    if (sq) list = list.filter(function (m) {
      var nm = m.sent ? inboxRecips(m.to).map(function (r) { return inboxRecipName(api, r); }).join(" ") : inboxWho(api, m).name;
      return (nm + " " + m.subj + " " + m.body).toLowerCase().indexOf(sq) >= 0;
    });
    var rows = list.map(function (m) {
      var w = m.sent ? { name: inboxRecips(m.to).map(function (r) { return inboxRecipName(api, r); }).join(", ") || "No recipient", ini: "" } : inboxWho(api, m);
      if (m.sent) { var r0 = inboxRecips(m.to)[0]; var p0 = r0 ? inboxPerson(api, r0) : null; w.ini = p0 ? p0.ini : (r0 ? r0.charAt(0).toUpperCase() : "?"); }
      var s = api.sw(function (dx, dy) {
        if (m.sent || Math.abs(dx) < Math.abs(dy)) return false;
        if (dx < 0) {
          api.set({ slide: { id: m.id, x: -412 } });
          api.later(function () {
            var s2 = api.get("inbox"); var snap = s2.mails;
            api.set({ slide: null, mails: s2.mails.map(function (x) { return x.id === m.id ? Object.assign({}, x, { arch: true, unread: false }) : x; }) });
            inboxUndo(api, m.subj + " archived", { mails: snap });
          }, 260);
        } else {
          api.say("Here's a reply to " + w.name.split(" ")[0] + ".", inboxDraftCard(api, m));
        }
      });
      var unread = !!m.unread;
      return {
        ini: w.ini, name: w.name, subj: m.subj, snip: String(m.body).replace(/\s+/g, " ").slice(0, 90), time: m.time,
        nameW: unread ? "700" : "500", subjCss: unread ? "color:var(--fg);font-weight:600" : "color:var(--fg)",
        dot: unread ? "var(--acct)" : "transparent", clip: !!(m.atts && m.atts.length),
        label: (unread ? "Unread, " : "") + w.name + ", " + m.subj,
        down: s.down, up: s.up,
        tx: st.slide && st.slide.id === m.id ? st.slide.x : 0,
        open: function () { if (api.swallowed()) return; api.set({ open: m.id, openLocal: true }); }
      };
    });

    // detail
    var cur = st.open != null ? inboxMail(st, st.open) : null;
    var det = null;
    if (cur) {
      var cw = cur.sent ? { name: inboxRecips(cur.to).map(function (r) { return inboxRecipName(api, r); }).join(", "), ini: "" } : inboxWho(api, cur);
      if (cur.sent) { var cr = inboxRecips(cur.to)[0]; var cp = cr ? inboxPerson(api, cr) : null; cw.ini = cp ? cp.ini : "?"; }
      var ca = inboxAcctOf(accts, cur.acct);
      var close = function () { inboxMarkRead(api, cur.id); api.set({ open: null }); };
      var remove = function (flag, msg) {
        var s2 = api.get("inbox"); var snap = { mails: s2.mails.map(function (x) { return x.id === cur.id ? Object.assign({}, x, { unread: false }) : x; }), sent: s2.sent, open: cur.id, openLocal: true };
        if (cur.sent) api.set({ open: null, sent: (s2.sent || []).filter(function (x) { return x.id !== cur.id; }) });
        else api.set({ open: null, mails: s2.mails.map(function (x) { if (x.id !== cur.id) return x; var y = Object.assign({}, x, { unread: false }); y[flag] = true; return y; }) });
        inboxUndo(api, msg, snap);
      };
      det = {
        subj: cur.subj, name: cw.name, ini: cw.ini, body: cur.body, time: cur.time,
        meta: (cur.sent ? "From " : "To ") + (multi ? inboxAcctLabel(ca) : ca.address) + " · " + cur.time,
        hasAtt: !!(cur.atts && cur.atts.length), atts: (cur.atts || []).map(function (a) { return { name: a.name, size: a.size, open: function () { inboxOpenFile(api, a); } }; }),
        canArchive: !cur.sent, hasPerson: !!cur.pid, noPerson: !cur.pid,
        close: close,
        archive: function () { remove("arch", cur.subj + " archived"); },
        del: function () { remove("del", cur.subj + " deleted"); },
        canAsk: !cur.sent,
        who: function () { if (cur.pid) api.open("contacts", { open: cur.pid }); },
        reply: function () {
          inboxMarkRead(api, cur.id);
          var to = cur.sent ? inboxRecips(cur.to) : [cur.pid || cur.email];
          api.set({ compose: { to: to, subject: /^re: /i.test(cur.subj) ? cur.subj : "Re: " + cur.subj, body: "", acct: cur.acct, replyTo: cur.sent ? null : cur.id }, composeLocal: true, toQ: "" });
        },
        forward: function () {
          api.set({ compose: { to: [], subject: "Fwd: " + cur.subj, body: "\n\n---\n" + cw.name + ", " + cur.time + "\n" + cur.body, acct: cur.acct, atts: cur.atts || [] }, composeLocal: true, toQ: "" });
        },
        ask: function () {
          api.say("Here's a reply to " + cw.name.split(" ")[0] + ".", inboxDraftCard(api, cur));
        }
      };
    }

    // compose
    var cmp = null;
    if (st.compose) {
      var c0 = st.compose === true ? {} : st.compose;
      var to = inboxRecips(c0.to);
      var fromMail = to[0] ? (st.mails || []).filter(function (x) { return x.pid === to[0] || x.email === to[0]; })[0] : null;
      var acctId = c0.acct || (fromMail && inboxAcctOf(accts, fromMail.acct).id) || (accts[0] && accts[0].id);
      var fa = inboxAcctOf(accts, acctId);
      var upd = function (p) { var cc = api.get("inbox").compose; cc = cc === true ? {} : (cc || {}); api.set({ compose: Object.assign({}, cc, { to: inboxRecips(cc.to) }, p) }); };
      var q = (st.toQ || "").trim().toLowerCase();
      var sugg = inboxPeople(api).filter(function (p) {
        if (!p.email || to.indexOf(p.id) >= 0) return false;
        if (!q) return to.length === 0;
        return p.name.toLowerCase().indexOf(q) >= 0 || p.email.toLowerCase().indexOf(q) >= 0;
      }).slice(0, 6).map(function (p) {
        return { ini: p.ini, name: p.name, email: p.email, pick: function () { upd({ to: inboxRecips((api.get("inbox").compose || {}).to).concat([p.id]) }); api.set({ toQ: "" }); } };
      });
      var rawAddr = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q) ? q : "";
      var addRaw = function () { if (!rawAddr) return; upd({ to: to.concat([rawAddr]) }); api.set({ toQ: "" }); };
      cmp = {
        chips: to.map(function (r, i) { return { name: inboxRecipName(api, r), rm: function () { var n = to.slice(); n.splice(i, 1); upd({ to: n }); } }; }),
        toQ: st.toQ || "", toPh: to.length ? "Add" : "To",
        onTo: function (e) { api.set({ toQ: e.target.value }); },
        toKey: function (e) { if (e.key === "Enter") { e.preventDefault(); if (rawAddr) addRaw(); else if (sugg[0]) sugg[0].pick(); } },
        sugg: sugg, hasSugg: sugg.length > 0, rawAddr: rawAddr, hasRaw: !!rawAddr, addRaw: addRaw,
        subject: c0.subject || "", body: c0.body || "",
        atts: (c0.atts || []).concat(inboxAttOf(api, c0.attach)).map(function (a, i) { return { name: a.name, rm: function () { var cc = api.get("inbox").compose || {}; var all = (cc.atts || []).concat(inboxAttOf(api, cc.attach)); all.splice(i, 1); upd({ atts: all, attach: [] }); } }; }),
        hasAtts: ((c0.atts || []).length + (c0.attach || []).length) > 0,
        onSubj: function (e) { upd({ subject: e.target.value }); },
        onBody: function (e) { upd({ body: e.target.value }); },
        multi: multi, from: fa.address,
        cycleFrom: function () { var i = accts.indexOf(fa); upd({ acct: accts[(i + 1) % accts.length].id }); },
        close: function () { var loc = st.composeLocal; api.set({ compose: null, toQ: "" }); inboxUndo(api, inboxDraftLabel(api, st.compose), { compose: st.compose, composeLocal: true }); },
        send: function () {
          var cc = api.get("inbox").compose; cc = cc === true ? {} : cc;
          var rs = inboxRecips(cc.to);
          if (rawAddr) rs = rs.concat([rawAddr]);
          if (!rs.length) { api.toast("Add a recipient"); return; }
          inboxSendMail(api, rs, cc.subject, cc.body, acctId, cc.replyTo, (cc.atts || []).concat(inboxAttOf(api, cc.attach)));
          api.set({ compose: null, toQ: "" });
          api.toast("Sent to " + inboxRecipName(api, rs[0]).split(" ")[0] + (rs.length > 1 ? " +" + (rs.length - 1) : ""));
        }
      };
    }

    return {
      chips: chips,
      searching: searching, notSearching: !searching, q: st.q || "", hasQ: !!sq,
      openSearch: function () { api.set({ q: "" }); },
      closeSearch: function () { api.set({ q: null }); },
      onQ: function (e) { api.set({ q: e.target.value }); },
      askQ: function () { var q0 = (api.get("inbox").q || "").trim(); api.set({ q: null }); api.send(/mail|inbox/i.test(q0) ? q0 : "Find emails about " + q0); },
      addAcct: function () { api.open("settings", { page: "accounts", adding: true }); },
      compose: function () { api.set({ compose: { to: [], subject: "", body: "", acct: st.acct !== "all" && st.acct !== "sent" ? st.acct : null }, composeLocal: true, toQ: "" }); },
      rows: rows, empty: rows.length === 0,
      emptyIcon: sq ? IC.search : (isSent ? IC.send : IC.mail),
      emptyText: sq ? "No results" : (isSent ? "Nothing sent" : "No mail"),
      emptyAdd: !sq && !isSent,
      detail: !!det, d: det,
      composing: !!cmp, c: cmp
    };
  }
});

/* ===== module: calendar ===== */
/* Calendar. Day timeline + week strip, month panel (tap the title), event detail, create/edit form,
   invites, per-account calendars. All markup holes are {{calendar.*}}.
   Events are stored with a day offset from today (`off`); repeating events recur from that day. */
IC.calRepeat = IC.calRepeat || "M4 11a7 7 0 0 1 12.5-4.3M20 13a7 7 0 0 1-12.5 4.3M17 3v4h-4M7 21v-4h4";
IC.calToday = IC.calToday || "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M12 15h.01";
IC.calNote = IC.calNote || "M5 7h14M5 12h14M5 17h9";

var CAL_SEED = [
  { id: "c1", off: -14, t: 9.5, d: 0.5, title: "Standup", cal: "work", repeat: "weekdays", video: "meet.lumen.example/standup", where: "", who: ["maya", "sam"], rsvp: { maya: "yes", sam: "yes" }, notes: "" },
  { id: "c2", off: 0, t: 11, d: 1.5, title: "Deep work", cal: "work", hold: true, where: "", who: [], notes: "Enclave copy, then the onboarding flow." },
  { id: "c3", off: 0, t: 13, d: 1, title: "Lunch · Priya", cal: "personal", where: "Tartine, Guerrero St", who: ["priya"], rsvp: { priya: "yes" }, notes: "" },
  { id: "c4", off: 0, t: 15, d: 1, title: "Design review", cal: "work", key: true, video: "meet.lumen.example/design-review", where: "", who: ["maya", "jordan", "sam", "lena"], rsvp: { maya: "yes", jordan: "maybe", sam: "yes", lena: "yes" }, notes: "Walk through the onboarding prototype. Decide on the enclave copy before Friday." },
  { id: "c5", off: 0, t: 16.5, d: 0.5, title: "Jordan · term sheet", cal: "work", where: "Phone", who: ["jordan"], rsvp: { jordan: "yes" }, notes: "Revised term sheet is in your inbox." },
  { id: "c6", off: 0, t: 19.5, d: 1, title: "Gym", cal: "personal", where: "Equinox SoMa", who: [], notes: "" },
  { id: "c11", off: -1, t: 8.5, d: 0.5, title: "Coffee · Lena", cal: "personal", where: "Sightglass, 7th St", who: ["lena"], notes: "" },
  { id: "c12", off: -1, t: 14, d: 1, title: "Roadmap review", cal: "work", video: "meet.lumen.example/roadmap", where: "", who: ["maya", "sam"], notes: "" },
  { id: "c8", off: 1, t: 10, d: 0.5, title: "1:1 · Maya", cal: "work", video: "meet.lumen.example/maya", where: "", who: ["maya"], notes: "" },
  { id: "c9", off: 1, t: 14, d: 1, title: "Dentist", cal: "personal", where: "Mission Dental, Valencia St", who: [], alert: 60, notes: "" },
  { id: "c13", off: 2, t: 9, d: 2, title: "Board prep", cal: "work", where: "Lumen HQ, 3rd floor", who: ["jordan", "maya"], notes: "" },
  { id: "c14", off: 2, t: 19, d: 1.5, title: "Dinner · Dad", cal: "personal", where: "Zuni Café", who: ["dad"], notes: "" },
  { id: "c10", off: 3, t: 19, d: 2, title: "Northpoint partner dinner", cal: "work", where: "Nopa, Divisadero St", who: ["jordan", "priya"], invite: { from: "jordan", status: "pending" }, notes: "Partners and founders, informal. Jordan would like you to say a few words about the enclave." },
  { id: "c15", off: 4, t: 13, d: 1, title: "Offsite planning", cal: "work", video: "meet.lumen.example/offsite", where: "", who: ["maya", "lena"], notes: "" },
  { id: "c16", off: 5, t: 10, d: 2, title: "Farmers market", cal: "personal", where: "Ferry Building", who: ["priya"], notes: "" }
];
var CAL_COLORS = { acc: "var(--acct)", fg: "var(--fg)", mut: "var(--mut)" };
var CAL_COLOR_ORDER = ["acc", "fg", "mut"];
var CAL_REPEAT = [["none", "Once"], ["daily", "Daily"], ["weekdays", "Weekdays"], ["weekly", "Weekly"]];
var CAL_ALERT = [[null, "None"], [0, "At start"], [10, "10 min"], [60, "1 hour"]];
var CAL_PENDING = null;
var CAL_H0 = 7, CAL_H1 = 23, CAL_PX = 56;

function calAmpm(t) { t = ((t % 24) + 24) % 24; var h = Math.floor(t); var m = Math.round((t - h) * 60); if (m === 60) { h++; m = 0; } return (h % 12 || 12) + ":" + pad2(m) + " " + (h >= 12 && h < 24 ? "PM" : "AM"); }
function calRange(t, d) {
  var a = calAmpm(t), b = calAmpm(t + d);
  if (a.slice(-2) === b.slice(-2)) a = a.slice(0, -3);
  return a + " – " + b;
}
function calDur(d) { var h = Math.floor(d), m = Math.round((d - h) * 60); return (h ? h + " h" : "") + (h && m ? " " : "") + (m ? m + " min" : ""); }
function calDate(api, off) { var d = new Date(api.now); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + off); return d; }
function calDow(api, off) { return (calDate(api, off).getDay() + 6) % 7; }
function calDayName(api, off) {
  if (off === 0) return "Today"; if (off === 1) return "Tomorrow"; if (off === -1) return "Yesterday";
  var d = calDate(api, off); return DAYS[d.getDay()].slice(0, 3) + ", " + MONS[d.getMonth()].slice(0, 3) + " " + d.getDate();
}
function calOccurs(e, off, api) {
  if (e.off === off) return true;
  if (!e.repeat || e.repeat === "none" || off < e.off) return false;
  if (e.repeat === "daily") return true;
  if (e.repeat === "weekdays") return calDow(api, off) < 5;
  if (e.repeat === "weekly") return (off - e.off) % 7 === 0;
  return false;
}
function calEvents(api) { var st = api.get("calendar"); return st.events || CAL_SEED; }
function calFind(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
function calPeople(api) { var c = api.get("contacts"); return (c && c.list && c.list.length) ? c.list : PEOPLE; }
function calPerson(api, id) { var l = calPeople(api); for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return api.person(id) || { id: id, name: id, ini: id.slice(0, 2).toUpperCase() }; }
function calCals(st, api) {
  var accts = (api.get("settings") || {}).accounts;
  var list = [{ id: "personal", name: "Personal", sub: "", color: "fg" }, { id: "work", name: "Work", sub: "", color: "acc" }];
  if (Array.isArray(accts)) {
    accts.filter(function (a) { return a && a.calendar !== false; }).forEach(function (a, i) {
      if (i < 2) list[i].sub = a.address || a.provider || "";
      else list.push({ id: a.id || ("acct" + i), name: a.provider || "Calendar", sub: a.address || "", color: "mut" });
    });
  } else { list[0].sub = "Google"; list[1].sub = "Lumen"; }
  var prefs = st.calPrefs || {};
  return list.map(function (c) { var p = prefs[c.id] || {}; return Object.assign({}, c, { on: p.on !== false, color: p.color || c.color }); });
}
function calDayOf(t, api) {
  var dm = t.match(/\b(today|tonight|tomorrow|(next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/);
  if (!dm) return null;
  if (dm[1] === "today" || dm[1] === "tonight") return 0;
  if (dm[1] === "tomorrow") return 1;
  var names = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  var want = names.indexOf(dm[3]); var cur = calDow(api, 0); var n = (want - cur + 7) % 7;
  if (n === 0) n = 7;
  return n;
}
function calTimeOf(t, ref) {
  if (/\bnoon\b/.test(t)) return 12;
  var m = t.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/) || t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if (!m) return null;
  var h = +m[1] % 24, mi = m[2] ? +m[2] : 0;
  if (m[3] === "pm" && h < 12) h += 12; else if (m[3] === "am" && h === 12) h = 0;
  else if (!m[3] && h < 12) { if (ref != null) { if (ref >= 12 && h < 12) h += 12; } else if (h < 8) h += 12; }
  return h + mi / 60;
}
function calIsFlowTalk(t) { return /^(turn|switch) (on|off)\b|^(pause|disable|enable|resume|run)\b|why did|morning brief|protect focus|receipts to files|weekly review|^(every|whenever|each)\b|\bevery (day|weekday|morning|evening|week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|\bwhenever\b|workflow|automat/.test(t); }
function calMatch(list, t, api) {
  var best = null, bestScore = 0;
  list.forEach(function (e) {
    var words = e.title.toLowerCase().replace(/[·]/g, " ").split(/\s+/).filter(function (w) { return w.length > 2; });
    var s = 0; words.forEach(function (w) { if (t.indexOf(w) >= 0) s++; });
    if (s > 0 && e.off === 0) s += 0.5;
    if (s > bestScore) { bestScore = s; best = e; }
  });
  return best;
}
function calPrep(e, api) {
  if (e.id === "c4") return ["Maya is bringing the onboarding prototype. Her last note asks for a call on the enclave copy.", "Jordan is a maybe; his revised term sheet landed at 1:12 and may come up.", "Open question from Friday: ship keys-on-device doc before or after the dry run."];
  var who = (e.who || []).map(function (id) { return calPerson(api, id).name.split(" ")[0]; });
  var b = [];
  if (who.length) b.push("With " + who.join(", ") + ". Your last thread with " + who[0] + " was about scheduling this.");
  if (e.notes) b.push(e.notes);
  b.push(e.video ? "Video link is ready. I'll remind you 5 minutes before." : (e.where ? "It's at " + e.where + ". Leave 15 minutes early." : "Nothing else to prep."));
  return b;
}

registerView("calendar", {
  title: "Calendar", icon: "cal", aliases: ["schedule", "agenda"],
  state: { day: 0, open: null, openDay: null, month: null, form: null, add: null, events: CAL_SEED, calPrefs: {} },
  persist: ["events", "calPrefs"],
  jumps: [[null, "Calendar"], ["event", "Event"], ["new", "New event"], ["month", "Month"], ["invite", "Invite"], ["add", "Add from app"]],
  preset: function (sub, api) {
    if (sub === "event") return { open: "c4", openDay: 0 };
    if (sub === "invite") return { open: "c10", openDay: 3 };
    if (sub === "month") return { month: 0 };
    if (sub === "add") return { add: { title: "Flight to JFK", off: 4, t: 8, d: 5.5, where: "SFO Terminal 2", notes: "UA 1542 · Seat 14C", cal: "personal" } };
    if (sub === "new") return { form: { id: null, title: "", off: 0, t: 17, d: 1, where: "", video: false, who: [], cal: "work", repeat: "none", alert: 10, notes: "" } };
  },
  badge: function (st) { return (st.events || CAL_SEED).some(function (e) { return e.invite && e.invite.status === "pending"; }); },
  suggestions: function (st) {
    if (st.form) return ["Lunch with Priya next Tuesday at 1", "Find me an hour to focus"];
    if (st.open) { var e = calFind(st.events || CAL_SEED, st.open); if (e) return ["Prep me for " + e.title, "Move " + e.title + " to tomorrow", "Cancel " + e.title]; }
    return ["What does my afternoon look like?", "Find me an hour to focus", "Move gym to tomorrow", "Lunch with Priya next Tuesday at 1"];
  },
  voicePhrase: "Find me an hour to focus",
  back: function (st, api) {
    if (st.form && st.form.pq != null) { api.set({ form: Object.assign({}, st.form, { pq: null }) }); return true; }
    if (st.form) { api.set({ form: null }); return true; }
    if (st.open) { var oe = calFind(st.events || CAL_SEED, st.open); api.set({ open: null, openDay: null, day: st.openDay != null ? st.openDay : (oe ? oe.off : st.day) }); return true; }
    if (st.month != null) { api.set({ month: null }); return true; }
    return false;
  },
  actions: {
    add: function (card, api) {
      var ev = Object.assign({ id: "e" + Date.now() }, card.ev);
      var list = calEvents(api);
      if (!calFind(list, ev.id)) api.set({ events: list.concat([ev]) });
      api.toast("Added to calendar");
      api.open("calendar", { day: ev.off, open: null, month: null, form: null });
    },
    restore: function (card, api) {
      var list = calEvents(api);
      if (!calFind(list, card.ev.id)) api.set({ events: list.concat([card.ev]) });
      api.toast("Restored " + card.ev.title);
    },
    savePrep: function (card, api) { api.toast("Pinned to " + (card.evTitle || "the event")); }
  },
  reply: function (t, raw, api) {
    if (calIsFlowTalk(t)) return null;
    var st = api.get("calendar"); var list = calEvents(api);
    var cur = st.open ? calFind(list, st.open) : null;
    var setList = function (l) { api.setView("calendar", { events: l }); };

    // invites
    if (/\b(accept|decline|rsvp)\b/.test(t) && /invite|dinner|jordan|northpoint|it\b/.test(t)) {
      var inv = list.filter(function (e) { return e.invite && e.invite.status === "pending"; })[0] || (cur && cur.invite ? cur : null);
      if (!inv) return null;
      var yes = !/decline/.test(t);
      return { text: yes ? "Accepted. I told " + calPerson(api, inv.invite.from).name.split(" ")[0] + " you'll be there." : "Declined with a short note.", card: { type: "event", time: calDayName(api, inv.off) + " · " + calRange(inv.t, inv.d), title: inv.title, go: { view: "calendar", patch: { day: inv.off, open: inv.id, openDay: inv.off } } },
        then: function () { setList(calEvents(api).map(function (e) { return e.id === inv.id ? Object.assign({}, e, { invite: Object.assign({}, e.invite, { status: yes ? "yes" : "declined" }) }) : e; })); } };
    }

    // prep
    var pm = t.match(/prep(?:are)?\s+(?:me\s+)?for\s+(.+)|what should i prep for\s+(.+)/);
    if (pm || (/^prep\b/.test(t) && cur)) {
      var target = pm ? calMatch(list, pm[1] || pm[2] || "", api) : cur;
      if (!target && cur) target = cur;
      if (!target) return null;
      var bullets = calPrep(target, api);
      return { text: "Here's what matters for " + target.title + ".", card: { type: "summary", bullets: bullets, evTitle: target.title, act: { mod: "calendar", fn: "savePrep" } },
        then: function () { setList(calEvents(api).map(function (e) { return e.id === target.id ? Object.assign({}, e, { prep: bullets }) : e; })); } };
    }

    // create: "lunch with priya next tuesday at 1"
    var dining = /\b(a table|table for|reserv\w*|restaurant|booking at|opentable)\b/.test(t);
    var act = dining ? null : t.match(/\b(lunch|dinner|coffee|breakfast|drinks|call|meeting|sync|catch up|walk|1:1)\b/);
    var addVerb = !dining && /^(add|schedule|book|set up|put)\b/.test(t) && !/\b(flight|hotel|ride|uber|lyft|car|ticket)s?\b/.test(t);
    if ((act || addVerb) && (/\bwith\b/.test(t) || addVerb) && (calTimeOf(t) != null || calDayOf(t, api) != null)) {
      var who = calPeople(api).filter(function (p) { var f = p.name.split(" ")[0].toLowerCase(); return new RegExp("\\b" + f + "\\b").test(t); }).map(function (p) { return p.id; });
      var off = calDayOf(t, api); if (off == null) off = 0;
      var tm = calTimeOf(t); if (tm == null) tm = act && act[1] === "lunch" ? 12.5 : (act && act[1] === "dinner" ? 19 : 10);
      var kind = act ? cap(act[1]) : "Meeting";
      var title = who.length ? kind + " · " + who.map(function (id) { return calPerson(api, id).name.split(" ")[0]; }).join(", ") : kind;
      var d = /lunch|dinner/.test(kind.toLowerCase()) ? 1 : (/coffee|call|sync|1:1/.test(kind.toLowerCase()) ? 0.5 : 1);
      var nid = "e" + Date.now();
      var ev = { id: nid, off: off, t: tm, d: d, title: title, cal: /lunch|dinner|drinks|walk|breakfast/.test(kind.toLowerCase()) ? "personal" : "work", where: "", who: who, notes: "", alert: 10 };
      var clash = list.filter(function (e) { return calOccurs(e, off, api) && e.t < tm + d && e.t + e.d > tm; })[0];
      return { text: (clash ? "That overlaps " + clash.title + ". " : "You're free then. ") + "Add it?", card: { type: "event", time: calDayName(api, off) + " · " + calRange(tm, d), title: title, ev: ev, act: { mod: "calendar", fn: "add" }, go: { view: "calendar", patch: { day: off, open: nid, openDay: off } } } };
    }

    // move
    var mv = t.match(/\b(move|push|reschedule|shift)\b\s+(.+?)\s+(to|until|till)\s+(.+)/);
    if (mv) {
      var e1 = /\b(this|it)\b/.test(mv[2]) && cur ? cur : calMatch(list, mv[2], api);
      if (!e1) return null;
      var nd = calDayOf(mv[4], api); var nt = calTimeOf(mv[4].indexOf("at") >= 0 || /am|pm/.test(mv[4]) ? mv[4] : "at " + mv[4], e1.t);
      if (nd == null && nt == null) return null;
      var patch = { off: nd == null ? e1.off : nd, t: nt == null ? e1.t : nt, repeat: "none" };
      var dn = calDayName(api, patch.off); if (/^(Today|Tomorrow|Yesterday)$/.test(dn)) dn = dn.toLowerCase();
      return { text: "Moved " + e1.title + " to " + dn + ", " + calAmpm(patch.t) + ".", card: { type: "event", time: calDayName(api, patch.off) + " · " + calRange(patch.t, e1.d), title: e1.title, go: { view: "calendar", patch: { day: patch.off, open: e1.id, openDay: patch.off } } },
        then: function () { setList(calEvents(api).map(function (e) { return e.id === e1.id ? Object.assign({}, e, patch) : e; })); } };
    }

    // cancel
    var cm = t.match(/\b(cancel|delete|remove|clear)\b\s+(?:my\s+|the\s+)?(.+)/);
    if (cm && !/workflow|note|mail|message/.test(t)) {
      var e2 = /^(this|it)\b/.test(cm[2]) && cur ? cur : calMatch(list, cm[2], api);
      if (!e2) return null;
      var snap = Object.assign({}, e2);
      return { text: "Cancelled " + e2.title + (e2.who && e2.who.length ? " and let " + e2.who.map(function (id) { return calPerson(api, id).name.split(" ")[0]; }).join(", ") + " know." : "."), card: { type: "generic", icon: "reply", title: e2.title, sub: "Cancelled · tap to restore", ev: snap, act: { mod: "calendar", fn: "restore" } },
        then: function () { setList(calEvents(api).filter(function (e) { return e.id !== e2.id; })); var s2 = api.get("calendar"); if (s2.open === e2.id) api.setView("calendar", { open: null }); } };
    }

    // focus
    if (/\bfocus\b|an hour|free time|deep work|heads.?down/.test(t)) {
      var now = api.now.getHours() + api.now.getMinutes() / 60;
      var day0 = list.filter(function (e) { return calOccurs(e, 0, api); });
      var s = Math.max(9, Math.ceil(now * 2) / 2), slot = null, sOff = 0;
      for (var dd = 0; dd < 3 && slot == null; dd++) {
        var evs = list.filter(function (e) { return calOccurs(e, dd, api); });
        for (var x = dd === 0 ? s : 9; x + 1 <= 18; x += 0.5) {
          if (!evs.some(function (e) { return e.t < x + 1 && e.t + e.d > x; })) { slot = x; sOff = dd; break; }
        }
      }
      if (slot == null) return { text: "No clear hour in the next three days. Want me to shorten something?" };
      var id = "f" + Date.now();
      return { text: "You're free " + calRange(slot, 1).replace(/:00/g, "") + (sOff ? " " + calDayName(api, sOff).toLowerCase() : "") + ". I held it and I'll silence notifications.", card: { type: "event", time: calDayName(api, sOff) + " · " + calRange(slot, 1), title: "Focus", go: { view: "calendar", patch: { day: sOff, open: id, openDay: sOff } } },
        then: function () { setList(calEvents(api).concat([{ id: id, off: sOff, t: slot, d: 1, title: "Focus", cal: "work", hold: true, where: "", who: [], notes: "Held by " + api.name + ". Notifications silenced." }])); } };
    }

    // agenda
    if (/afternoon|this morning|tonight|this evening|my day|schedule|calendar|what's next|whats next|agenda|tomorrow look|on today|plan my/.test(t)) {
      var dOff = /tomorrow/.test(t) ? 1 : 0;
      var now2 = api.now.getHours() + api.now.getMinutes() / 60;
      var from = /afternoon/.test(t) ? 12 : (/tonight|evening/.test(t) ? 17 : (/morning/.test(t) ? 0 : (dOff ? 0 : now2)));
      var to = /morning/.test(t) ? 12 : (/afternoon/.test(t) ? 17.5 : 24);
      var rows = list.filter(function (e) { return calOccurs(e, dOff, api) && e.t + e.d > from && e.t < to && !(e.invite && e.invite.status !== "yes"); }).sort(function (a, b) { return a.t - b.t; });
      if (!rows.length) return { text: "Nothing on " + (dOff ? "tomorrow" : "the calendar") + " for then. It's yours.", card: null };
      var key = rows.filter(function (e) { return e.key; })[0];
      var n = ["Nothing", "One thing", "Two things", "Three things", "Four things", "Five things", "Six things"][rows.length] || rows.length + " things";
      return { text: n + (dOff ? " tomorrow." : (/afternoon/.test(t) ? " this afternoon." : (/tonight|evening/.test(t) ? " tonight." : (/morning/.test(t) ? " this morning." : " left.")))) + (key ? " " + key.title + " is the one to prep for." : ""), card: { type: "agenda", go: { view: "calendar", patch: { day: dOff, open: null } }, rows: rows.map(function (e) { return { time: fmtT(e.t), title: e.title, key: !!e.key }; }) } };
    }
    return null;
  },
  render: function (st, api) {
    if (st.add && CAL_PENDING !== st.add) {
      CAL_PENDING = st.add; var a = st.add;
      api.later(function () {
        var l = calEvents(api); var id = a.id || "e" + Date.now();
        var ne = { id: id, off: a.off || 0, t: a.t == null ? 9 : a.t, d: a.d || 1, title: a.title || "New event", where: a.where || "", who: a.who || [], cal: a.cal || "personal", notes: a.notes || "", alert: a.alert == null ? 10 : a.alert };
        if (a.video) ne.video = a.video;
        api.setView("calendar", { add: null, events: calFind(l, id) ? l : l.concat([ne]), day: ne.off, open: id, openDay: ne.off, form: null, month: null });
        api.toast("Added to calendar");
      }, 0);
    }
    var list = st.events || CAL_SEED;
    var sel = st.day || 0;
    var cals = calCals(st, api);
    var calOf = function (id) { for (var i = 0; i < cals.length; i++) if (cals[i].id === id) return cals[i]; return cals[0]; };
    var visible = function (e) { return calOf(e.cal).on && !(e.invite && e.invite.status === "declined"); };
    var on = function (off) { return list.filter(function (e) { return visible(e) && calOccurs(e, off, api); }); };
    var set = function (p) { api.set(p); };
    var today = calDate(api, 0);
    var selDate = calDate(api, sel);

    // week strip (week containing the selected day)
    var sdow = calDow(api, sel);
    var week = "MTWTFSS".split("").map(function (l, i) {
      var off = sel - sdow + i; var dt = calDate(api, off);
      var cs = off === 0 ? "background:var(--acc);color:#fff" : (off === sel ? "box-shadow:inset 0 0 0 1.5px var(--fg)" : "");
      return { l: l, n: dt.getDate(), cs: cs, dot: on(off).length ? (off === 0 ? "var(--acct)" : "var(--mut)") : "transparent", pick: function () { set({ day: off }); } };
    });

    // timeline
    var evs = on(sel).slice().sort(function (a, b) { return a.t - b.t || b.d - a.d; });
    var lanes = []; var laneOf = {};
    evs.forEach(function (e) { for (var i = 0; i <= lanes.length; i++) { if (lanes[i] == null || lanes[i] <= e.t + 0.001) { lanes[i] = e.t + e.d; laneOf[e.id] = i; break; } } });
    var W = 412 - 60 - 16;
    var events = evs.map(function (e) {
      var n = 1; evs.forEach(function (o) { if (o !== e && o.t < e.t + e.d && o.t + o.d > e.t) n = Math.max(n, Math.max(laneOf[o.id], laneOf[e.id]) + 1); });
      var w = W / n; var c = calOf(e.cal);
      var pending = e.invite && e.invite.status === "pending";
      var css = e.key ? "background:var(--acc);color:#fff" : (e.hold || pending ? "background:var(--bg);box-shadow:inset 0 0 0 1.5px " + (pending ? "var(--mut)" : "var(--acct)") : "background:var(--s2)");
      if (pending) css += ";border:1.5px dashed var(--mut);box-shadow:none";
      var h = Math.max(24, e.d * CAL_PX - 4); var short = h < 40;
      return {
        title: e.title, time: fmtT(e.t), top: (e.t - CAL_H0) * CAL_PX + 8, h: h, left: 60 + laneOf[e.id] * w, w: w - 4,
        css: css + (short ? ";align-items:center;padding-top:0;padding-bottom:0" : ""),
        stripe: e.key || e.hold || pending ? "transparent" : CAL_COLORS[c.color],
        sub: !short && e.d >= 1 ? (e.where || (e.video ? "Video call" : "")) : "", showTime: w >= 150,
        open: function () { if (api.swallowed()) return; set({ open: e.id, openDay: sel }); }
      };
    });
    var hours = []; for (var h = CAL_H0; h <= CAL_H1; h++) hours.push({ top: (h - CAL_H0) * CAL_PX + 8, label: h === 12 ? "Noon" : (h % 12 || 12) + (h < 12 ? " am" : " pm"), lt: (h - CAL_H0) * CAL_PX });
    var nowT = api.now.getHours() + api.now.getMinutes() / 60;
    var sw = api.sw(function (dx, dy) { if (Math.abs(dx) < Math.abs(dy) * 1.2) return false; set({ day: sel + (dx < 0 ? 1 : -1) }); }, { axis: "x" });
    var tlDown = sw.down, tlUp = sw.up;

    // pending invites
    var invites = list.filter(function (e) { return e.invite && e.invite.status === "pending" && calOf(e.cal).on; }).map(function (e) {
      var p = calPerson(api, e.invite.from);
      var rs = function (s) { return function () { set({ events: list.map(function (x) { return x.id === e.id ? Object.assign({}, x, { invite: Object.assign({}, x.invite, { status: s }) }) : x; }) }); api.toast(s === "yes" ? "Accepted · " + p.name.split(" ")[0] + " will see it" : "Declined"); }; };
      return { ini: p.ini, title: e.title, when: calDayName(api, e.off) + " · " + calAmpm(e.t), open: function () { set({ day: e.off, open: e.id, openDay: e.off }); }, accept: rs("yes"), decline: rs("declined") };
    });

    // month panel
    var monthOpen = st.month != null;
    var mBase = new Date(selDate); mBase.setDate(1); mBase.setMonth(mBase.getMonth() + (st.month || 0));
    var mStartDow = (mBase.getDay() + 6) % 7;
    var gridStart = new Date(mBase); gridStart.setDate(1 - mStartDow);
    var mdays = [];
    for (var i = 0; i < 42; i++) {
      var gd = new Date(gridStart); gd.setDate(gridStart.getDate() + i); gd.setHours(12, 0, 0, 0);
      (function (gd) {
        var off = Math.round((gd - today) / 864e5);
        var inM = gd.getMonth() === mBase.getMonth();
        var has = on(off).length > 0;
        var cs = off === 0 ? "background:var(--acc);color:#fff" : (off === sel ? "box-shadow:inset 0 0 0 1.5px var(--fg)" : "");
        mdays.push({ n: gd.getDate(), cs: cs + (inM ? "" : ";opacity:.35"), dot: has ? (off === 0 ? "var(--acct)" : "var(--fg)") : "transparent", pick: function () { set({ day: off, month: null }); }, label: DAYS[gd.getDay()] + " " + MONS[gd.getMonth()] + " " + gd.getDate() });
      })(gd);
    }
    var lastRow = mdays.slice(35).every(function (d) { return d.cs.indexOf("opacity") >= 0; });
    if (lastRow) mdays = mdays.slice(0, 35);
    var calRows = cals.map(function (c) {
      var patch = function (p) { var pr = Object.assign({}, st.calPrefs || {}); pr[c.id] = Object.assign({}, pr[c.id] || {}, p); set({ calPrefs: pr }); };
      return { name: c.name, sub: c.sub, on: c.on, sw: CAL_COLORS[c.color], track: api.track(c.on), kx: api.kx(c.on), dim: c.on ? "" : "opacity:.5",
        toggle: function () { patch({ on: !c.on }); },
        color: function () { patch({ color: CAL_COLOR_ORDER[(CAL_COLOR_ORDER.indexOf(c.color) + 1) % CAL_COLOR_ORDER.length] }); } };
    });

    // detail
    var ev = st.open ? calFind(list, st.open) : null;
    var evDay = ev ? (st.openDay != null && calOccurs(ev, st.openDay, api) ? st.openDay : ev.off) : 0;
    var undo = function (label, ev) {
      api.toast(label, { undo: function () { var l = calEvents(api); if (!calFind(l, ev.id)) api.setView("calendar", { events: l.concat([ev]) }); } });
    };
    var formFrom = function (e, off) { return { id: e ? e.id : null, title: e ? e.title : "", off: e ? (e.repeat && e.repeat !== "none" ? e.off : off) : off, t: e ? e.t : 17, d: e ? e.d : 1, where: e ? (e.where === "Phone" ? "Phone" : e.where || "") : "", video: e ? !!e.video : false, who: e ? (e.who || []).slice() : [], cal: e ? e.cal : "work", repeat: e ? e.repeat || "none" : "none", alert: e ? (e.alert == null ? null : e.alert) : 10, notes: e ? e.notes || "" : "" }; };
    var D = null;
    if (ev) {
      var c = calOf(ev.cal);
      var isInvite = !!ev.invite;
      var rsvp = ev.invite ? ev.invite.status : null;
      var rsvpBtn = function (s, label) { var act = rsvp === s; return { label: label, css: act ? (s === "declined" ? "background:var(--fg);color:var(--bg)" : "background:var(--acc);color:#fff") : "background:var(--s2)", go: function () { set({ events: list.map(function (x) { return x.id === ev.id ? Object.assign({}, x, { invite: Object.assign({}, x.invite, { status: s }) }) : x; }) }); api.toast(s === "yes" ? "Going · " + calPerson(api, ev.invite.from).name.split(" ")[0] + " will see it" : (s === "maybe" ? "Maybe" : "Declined")); } }; };
      var isPhone = ev.where === "Phone";
      var repeatLabel = ev.repeat && ev.repeat !== "none" ? CAL_REPEAT.filter(function (r) { return r[0] === ev.repeat; })[0][1] : "";
      var alertLabel = ev.alert == null ? "" : (ev.alert === 0 ? "Alert at start" : (ev.alert >= 60 ? ev.alert / 60 + " hour before" : ev.alert + " min before"));
      D = {
        title: ev.title, when: calRange(ev.t, ev.d), day: calDayName(api, evDay) + (repeatLabel ? " · " + repeatLabel : ""),
        dot: CAL_COLORS[c.color], calName: c.name,
        recurringReminder: false, reminderPolicy: "", reminderHistory: [], reminderDone: function () {}, reminderSnooze: function () {},
        hasWhere: !!ev.where, where: isPhone ? "Call " + calPerson(api, (ev.who || [])[0] || "jordan").name.split(" ")[0] : ev.where, whereIcon: isPhone ? IC.phone : IC.pin,
        goWhere: function () { if (isPhone) api.open("phone", { call: (ev.who || [])[0] || "jordan" }); else api.open("maps", { query: ev.where }); },
        hasVideo: !!ev.video, video: ev.video, join: function () { api.toast("Joining " + ev.title); },
        hasAlert: !!alertLabel, alertLabel: alertLabel,
        hasPeople: (ev.who || []).length > 0,
        people: (ev.who || []).map(function (id) { var p = calPerson(api, id); var r = (ev.rsvp || {})[id]; return { ini: p.ini, name: p.name, st: ev.invite && ev.invite.from === id ? "Organizer" : (r === "maybe" ? "Maybe" : (r === "no" ? "Declined" : (r === "yes" ? "" : "Invited"))), open: function () { api.open("contacts", { open: id }); } }; }),
        hasNotes: !!ev.notes, notes: ev.notes,
        isInvite: isInvite, from: isInvite ? calPerson(api, ev.invite.from).ini : "",
        rsvp: isInvite ? [rsvpBtn("yes", "Going"), rsvpBtn("maybe", "Maybe"), rsvpBtn("declined", "No")] : [],
        hasPrep: !!(ev.prep && ev.prep.length), prep: ev.prep || [], noPrep: !(ev.prep && ev.prep.length),
        ask: function () { api.send("Prep me for " + ev.title); },
        close: function () { set({ open: null, openDay: null, day: evDay }); },
        edit: function () { set({ form: formFrom(ev, evDay) }); },
        del: function () { set({ events: list.filter(function (x) { return x.id !== ev.id; }), open: null, openDay: null, day: evDay }); undo(ev.title + " deleted", ev); }
      };
    }

    // form
    var f = st.form; var F = null;
    if (f) {
      var fp = function (p) { set({ form: Object.assign({}, f, p) }); };
      var dayChips = [];
      var first = Math.min(0, f.off);
      for (var k = first; k < first + 21; k++) (function (k) {
        var dt = calDate(api, k); var act = k === f.off;
        dayChips.push({ top: k === 0 ? "Today" : DAYS[dt.getDay()].slice(0, 3), n: dt.getDate(), css: act ? "background:var(--acc);color:#fff" : "background:var(--s2)", pick: function () { fp({ off: k }); }, label: calDayName(api, k) });
      })(k);
      var chosen = f.who.map(function (id) { var p = calPerson(api, id); return { ini: p.ini, first: p.name.split(" ")[0], label: "Remove " + p.name, remove: function () { fp({ who: f.who.filter(function (x) { return x !== id; }) }); } }; });
      var q = (f.pq || "").toLowerCase().trim();
      var sugg = f.pq == null ? [] : calPeople(api).filter(function (p) { return f.who.indexOf(p.id) < 0 && (!q || p.name.toLowerCase().indexOf(q) >= 0 || (p.email || "").toLowerCase().indexOf(q) >= 0); }).slice(0, 4).map(function (p) {
        return { ini: p.ini, name: p.name, sub: p.email || p.phone || "", pick: function () { fp({ who: f.who.concat([p.id]), pq: null }); } };
      });
      var chip = function (on) { return on ? "background:var(--fg);color:var(--bg)" : "background:var(--bg)"; };
      F = {
        isNew: !f.id, title: f.title, where: f.where, notes: f.notes,
        onTitle: function (e) { fp({ title: e.target.value }); },
        onWhere: function (e) { fp({ where: e.target.value }); },
        onNotes: function (e) { fp({ notes: e.target.value }); },
        days: dayChips,
        start: calAmpm(f.t), end: calAmpm(f.t + f.d), dur: calDur(f.d),
        sMinus: function () { fp({ t: Math.max(0, f.t - 0.25) }); }, sPlus: function () { fp({ t: Math.min(23.5 - f.d, f.t + 0.25) }); },
        eMinus: function () { fp({ d: Math.max(0.25, f.d - 0.25) }); }, ePlus: function () { fp({ d: Math.min(24 - f.t, f.d + 0.25) }); },
        video: f.video, vTrack: api.track(f.video), vKx: api.kx(f.video), toggleVideo: function () { fp({ video: !f.video }); },
        chosen: chosen, hasChosen: chosen.length > 0,
        picking: f.pq != null, notPicking: f.pq == null, pq: f.pq || "", sugg: sugg, noSugg: f.pq != null && sugg.length === 0,
        openPick: function () { fp({ pq: "" }); }, closePick: function () { fp({ pq: null }); },
        onPq: function (e) { fp({ pq: e.target.value }); },
        pqKey: function (e) { if (e.key === "Enter" && sugg.length) { e.preventDefault(); sugg[0].pick(); } if (e.key === "Escape") fp({ pq: null }); },
        valid: !!(f.title || "").trim(), saveOff: !(f.title || "").trim(), saveCss: (f.title || "").trim() ? "background:var(--acc);color:#fff" : "background:var(--s2);color:var(--mut)",
        cals: cals.map(function (c) { return { name: c.name, dot: CAL_COLORS[c.color], css: chip(f.cal === c.id), pick: function () { fp({ cal: c.id }); } }; }),
        repeats: CAL_REPEAT.map(function (r) { return { label: r[1], css: chip(f.repeat === r[0]), pick: function () { fp({ repeat: r[0] }); } }; }),
        alerts: CAL_ALERT.map(function (a) { return { label: a[1], css: chip(f.alert === a[0]), pick: function () { fp({ alert: a[0] }); } }; }),
        cancel: function () { set({ form: null }); },
        save: function () {
          var title = (f.title || "").trim();
          if (!title) return;
          var old = f.id ? calFind(list, f.id) : null;
          var ne = Object.assign({}, old || {}, { id: f.id || "e" + Date.now(), off: f.off, t: f.t, d: f.d, title: title, where: (f.where || "").trim(), who: f.who, cal: f.cal, repeat: f.repeat, alert: f.alert, notes: (f.notes || "").trim() });
          if (f.video && !ne.video) ne.video = "meet.lumen.example/" + title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
          if (!f.video) delete ne.video;
          var nl = old ? list.map(function (x) { return x.id === old.id ? ne : x; }) : list.concat([ne]);
          if (old) { set({ events: nl, form: null, day: f.off, openDay: f.off }); api.toast("Saved"); }
          else { set({ events: nl, form: null, day: f.off, open: null }); api.toast("Added " + title); }
        }
      };
    }

    return {
      attendeeChoices: calPeople(api).map(function (person) { return { id: person.id, name: person.name }; }),
      month: monthOpen ? MONS[mBase.getMonth()] + (mBase.getFullYear() !== today.getFullYear() ? " " + mBase.getFullYear() : "") : MONS[selDate.getMonth()] + (selDate.getFullYear() !== today.getFullYear() ? " " + selDate.getFullYear() : ""),
      dayMode: !monthOpen,
      dayName: calDayName(api, sel),
      emptyText: "Free all day", week: week, events: events, hours: hours, empty: evs.length === 0 && sel !== 0,
      showNow: sel === 0 && nowT >= CAL_H0 && nowT <= CAL_H1, nowTop: (nowT - CAL_H0) * CAL_PX + 8,
      tlDown: tlDown, tlUp: tlUp,
      notToday: sel !== 0, goToday: function () { set({ day: 0, month: null }); },
      toggleMonth: function () { set({ month: monthOpen ? null : 0 }); },
      newEvent: function () { var nx = sel === 0 ? Math.min(21, Math.ceil(nowT + 0.01)) : 10; set({ form: Object.assign(formFrom(null, sel), { t: nx }), month: null }); },
      hasInvites: invites.length > 0 && !monthOpen, invites: invites,
      monthOpen: monthOpen, mTitle: MONS[mBase.getMonth()] + (mBase.getFullYear() !== today.getFullYear() ? " " + mBase.getFullYear() : ""),
      mdays: mdays, mPrev: function () { set({ month: (st.month || 0) - 1 }); }, mNext: function () { set({ month: (st.month || 0) + 1 }); },
      closeMonth: function () { set({ month: null }); }, calRows: calRows, chevron: monthOpen ? IC.up : IC.down,
      detail: !!D, ev: D,
      form: !!F, f: F,
      noop: function () {}
    };
  }
});

/* ===== module: browser ===== */
/* Browser. Agentic: chat about the page, or ask it to act (fill a form), with a confirm step before anything irreversible. */
IC.brTabs = IC.brTabs || "M5 7h11v12H5zM8 4h11v12";
IC.brUser = IC.brUser || "M16 8a4 4 0 1 1-8 0a4 4 0 1 1 8 0zM4 21a8 8 0 0 1 16 0";

var BR_NEWS = "news.example/on-device-agents", BR_ENC = "enclave.example/keys-in-hardware", BR_BOOK = "tables.example/nopa";
var BR_PAGES = {};
BR_PAGES[BR_NEWS] = { kind: "news", title: "The case for on-device agents", host: "news.example", path: "/on-device-agents", tile: "#000000",
  snip: "An assistant that lives on your phone sees everything you do. The question is who else gets to see it.", kw: "agents on-device ai assistant privacy phone news",
  points: ["Keeping model and memory on the phone means nobody else sees your data", "Hardware-held keys make every agent action signed and checkable", "The interface should get quieter: one conversation, the right card at the right time"] };
BR_PAGES[BR_ENC] = { kind: "enclave", title: "Keys that never leave the chip", host: "enclave.example", path: "/keys-in-hardware", tile: "#0000FF",
  snip: "A secure enclave is a small, sealed part of the processor. Keys are created inside it and never read out.", kw: "enclave keys hardware security chip secure",
  points: ["Enclave keys are created inside the chip and can't be read out", "Signed actions prove they came from your device", "The phone becomes the root of trust, not a server"] };
BR_PAGES[BR_BOOK] = { kind: "book", title: "Nopa · Book a table", host: "tables.example", path: "/nopa", tile: "#17352A",
  snip: "Californian, wood-fired. 560 Divisadero St. Tables tonight from 6:00.", kw: "nopa restaurant dinner table book reservation food eat tonight",
  points: ["Nopa, 560 Divisadero St, Californian and wood-fired", "Tables tonight from 6:00 to 8:30", "Bookings are held for 15 minutes"] };
var BR_TIMES = ["6:00", "6:30", "7:00", "7:30", "8:00", "8:30"];
var BR_DATES = [["tonight", "Tonight"], ["tomorrow", "Tomorrow"], ["fri", "Fri"]];
var BR_ME = { name: "Alex Kim", phone: "(415) 555-0100" };
var BR_NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 };

function brPage(url) {
  if (!url || url === "newtab") return { kind: "newtab", title: "New tab", host: "", path: "", tile: "var(--s3)" };
  if (BR_PAGES[url]) return Object.assign({ url: url }, BR_PAGES[url]);
  if (url.indexOf("search.example") !== 0 && /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(url)) {
    var dom = url.split("/")[0], sub = url.split("/").slice(1).join("/"); var nm = cap(dom.split(".")[0].replace(/-/g, " "));
    return { kind: "generic", url: url, host: dom, path: sub ? "/" + sub : "", title: sub ? cap(sub.split("/")[0].replace(/-/g, " ")) + " · " + nm : nm, name: nm, ini: nm.charAt(0), tile: "var(--s3)",
      links: [["about", "About"], ["hours", "Hours & location"], ["contact", "Contact"]].map(function (l) { return { url: dom + "/" + l[0], label: l[1] }; }) };
  }
  var q = url.indexOf("search.example") === 0 ? decodeURIComponent((url.split("?q=")[1] || "").replace(/\+/g, " ")) : url;
  return { kind: "search", q: q, title: q, host: "search.example", path: "/?q=" + q, tile: "var(--s3)", url: url };
}
function brNorm(raw) {
  var s = String(raw || "").trim(); var l = s.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
  if (!l) return null;
  if (BR_PAGES[l]) return l;
  var keys = Object.keys(BR_PAGES);
  for (var i = 0; i < keys.length; i++) if (keys[i].indexOf(l) === 0 || (l.indexOf("/") < 0 && keys[i].split("/")[0] === l)) return keys[i];
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/.test(l)) return l;
  return "search.example/?q=" + encodeURIComponent(s.replace(/^https?:\/\//, ""));
}
function brResults(q) {
  var words = String(q || "").toLowerCase().split(/\W+/).filter(function (w) { return w.length > 2; });
  var keys = Object.keys(BR_PAGES);
  var hit = keys.filter(function (k) { var p = BR_PAGES[k]; var hay = (p.title + " " + p.kw + " " + p.host).toLowerCase(); return words.some(function (w) { return hay.indexOf(w) >= 0; }); });
  var rest = keys.filter(function (k) { return hit.indexOf(k) < 0; });
  return hit.concat(rest);
}
function brGo(api, url) {
  if (!url) return;
  var s = api.get("browser");
  var tabs = s.tabs.map(function (t) { return t.id === s.cur ? { id: t.id, hist: t.hist.slice(0, t.pos + 1).concat([url]), pos: t.pos + 1 } : t; });
  var visits = url === "newtab" ? s.visits : [url].concat(s.visits.filter(function (v) { return v !== url; })).slice(0, 12);
  api.set({ tabs: tabs, visits: visits, editing: false, menu: false, hl: 0, lib: null, tabsOpen: false });
  api.later(function () { try { var c = document.querySelector("[data-bscroll]"); if (c) c.scrollTop = 0; } catch (e) {} }, 30);
}
function brNoScroll() { try { if (window.scrollX || window.scrollY) window.scrollTo(0, 0); var sc = document.querySelector("[data-screen]"); if (sc && (sc.scrollTop || sc.scrollLeft)) { sc.scrollTop = 0; sc.scrollLeft = 0; } } catch (e) {} }
function brCurUrl(s) { var t = s.tabs.filter(function (x) { return x.id === s.cur; })[0] || s.tabs[s.tabs.length - 1]; return t ? t.hist[t.pos] : "newtab"; }
function brPos(name) {
  try {
    var el = document.querySelector('[data-bk="' + name + '"]'); var sc = document.querySelector("[data-screen]"); var box = document.querySelector("[data-bscroll]");
    if (!el || !sc) return null;
    var k = sc.getBoundingClientRect().width / 412;
    if (box) { var br = box.getBoundingClientRect(), er = el.getBoundingClientRect(); var over = er.bottom - (br.bottom - 150 * k); if (over > 0) box.scrollTop += over / k; if (er.top < br.top + 60 * k) box.scrollTop -= (br.top + 60 * k - er.top) / k; }
    var r = el.getBoundingClientRect(), s = sc.getBoundingClientRect();
    return { cx: (r.left - s.left) / k + Math.min(r.width / k / 2, 70) - 11, cy: (r.top - s.top) / k + r.height / k / 2 - 11 };
  } catch (e) { return null; }
}
function brAg(api, patch) { var s = api.get("browser"); if (!s.ag) return; api.set({ ag: Object.assign({}, s.ag, patch) }); }
function brSaveNote(api, title, bullets) {
  if (VIEWS.notes) {
    var n = api.get("notes");
    if (Array.isArray(n.list)) { api.setView("notes", { list: [{ id: "n" + Date.now(), kind: "text", title: title, body: bullets.join("\n"), pinned: false, when: "Now" }].concat(n.list) }); }
  }
  api.toast("Saved to Notes");
}
function brParseBook(t) {
  var m = t.match(/\bfor (\d+|one|two|three|four|five|six|seven|eight)\b/); var party = m ? (BR_NUM[m[1]] || +m[1]) : 2;
  var tm = t.match(/\bat (\d{1,2})(?::(\d{2}))?\s*(am|pm)?/); var time = tm ? (+tm[1] > 12 ? +tm[1] - 12 : +tm[1]) + ":" + (tm[2] || "00") : "7:30";
  var date = /tomorrow/.test(t) ? "tomorrow" : (/friday|\bfri\b/.test(t) ? "fri" : "tonight");
  return { party: Math.max(1, Math.min(12, party)), time: time, date: date };
}
function brStartBook(api, o) {
  api.stop();
  var s = api.get("browser");
  if (brCurUrl(s) !== BR_BOOK) brGo(api, BR_BOOK);
  var dl = (BR_DATES.filter(function (d) { return d[0] === o.date; })[0] || BR_DATES[0])[1];
  api.set({ ag: { task: "book", text: "Opening tables.example", cx: 196, cy: 260 }, confirm: null, booked: null, share: false, menu: false, editing: false, tabsOpen: false, lib: null,
    bk: { party: 2, date: "tonight", time: null, name: "", phone: "" }, want: o });
  var t = 0;
  var step = function (ms, fn) { t += ms; api.later(function () { if (!api.get("browser").ag) return; fn(); }, t); };
  var type = function (field, val) { for (var i = 1; i <= val.length; i++) (function (i) { step(i === 1 ? 250 : 40, function () { var b = Object.assign({}, api.get("browser").bk); b[field] = val.slice(0, i); api.set({ bk: b }); }); })(i); };
  var move = function (target, text, bkPatch) { return function () { var p = brPos(target) || {}; var s2 = api.get("browser"); api.set({ ag: Object.assign({}, s2.ag, p, { text: text }), bk: Object.assign({}, s2.bk, bkPatch || {}) }); }; };
  step(1100, move("party", "Party of " + o.party));
  step(700, function () { var b = Object.assign({}, api.get("browser").bk, { party: o.party }); api.set({ bk: b }); });
  step(900, move("d-" + o.date, dl, { date: o.date }));
  step(1000, move("t-" + o.time, o.time + " PM", { time: o.time }));
  step(1000, move("name", "Your name"));
  type("name", BR_ME.name);
  step(500, move("phone", "Your number"));
  type("phone", BR_ME.phone);
  step(600, move("submit", "Waiting for your OK"));
  step(500, function () { var s2 = api.get("browser"); api.set({ confirm: { party: o.party, date: dl, time: o.time + " PM", name: s2.bk.name, phone: s2.bk.phone } }); });
}
function brFinishBook(api) {
  var s = api.get("browser"); var b = s.bk;
  var dl = (BR_DATES.filter(function (d) { return d[0] === b.date; })[0] || BR_DATES[0])[1];
  var booked = { party: b.party, date: dl, time: b.time + " PM", name: b.name, code: "NP-" + (4000 + Math.floor(Math.random() * 900)) };
  api.set({ booked: booked, confirm: null, ag: null });
  api.toast("Booked · Nopa, " + booked.time);
}
function brStartPoints(api) {
  api.stop();
  var s = api.get("browser"); var pg = brPage(brCurUrl(s));
  if (!pg.points) { api.toast("Nothing to save here"); return; }
  api.set({ ag: { task: "points", text: "Reading the page", cx: 200, cy: 330 }, hl: 0, menu: false });
  var t = 0; var step = function (ms, fn) { t += ms; api.later(function () { if (!api.get("browser").ag) return; fn(); }, t); };
  [1, 2, 3].forEach(function (i) { step(1100, function () { var p = brPos("p" + i) || {}; api.set({ hl: i, ag: Object.assign({}, api.get("browser").ag, p, { text: "Key point " + i + " of 3" }) }); }); });
  step(1200, function () { api.set({ ag: null }); brSaveNote(api, pg.title + " · key points", pg.points); });
}

registerView("browser", {
  title: "Browser", icon: "globe", aliases: ["web", "internet", "chrome"],
  chat: "input", placeholder: "Ask about this page",
  state: {
    newTab: false,
    tabs: [{ id: "t1", hist: [BR_NEWS], pos: 0 }, { id: "t2", hist: [BR_ENC], pos: 0 }], cur: "t1",
    marks: [BR_ENC], visits: [BR_NEWS, BR_ENC, BR_BOOK],
    bk: { party: 2, date: "tonight", time: null, name: "", phone: "" }, booked: null,
    editing: false, addr: "", tabsOpen: false, menu: false, lib: null, share: false, ag: null, confirm: null, hl: 0, url: null, want: null
  },
  persist: ["tabs", "cur", "marks", "visits", "bk", "booked"],
  jumps: [[null, "Browser"], ["book", "Booking page"], ["tabs", "Tabs"], ["agent", "Agent booking"]],
  preset: function (sub, api) {
    if (sub === "book") return { url: BR_BOOK };
    if (sub === "tabs") return { tabsOpen: true };
    if (sub === "agent") { api.later(function () { brStartBook(api, { party: 2, time: "7:30", date: "tonight" }); }, 120); return {}; }
  },
  immersive: function (st) { return (st.confirm || st.share) ? { noPill: true } : null; },
  suggestions: function (st) {
    var pg = brPage(brCurUrl(st));
    if (pg.kind === "book") return ["Book a table for 2 at 7:30", "Summarize this page"];
    if (pg.kind === "newtab" || pg.kind === "search") return ["Book a table for 2 at 7:30", "Go to enclave.example"];
    return ["Summarize this page", "Save the key points to Notes", "Book a table for 2 at 7:30"];
  },
  voicePhrase: "Summarize this page",
  back: function (st, api) {
    if (st.share) { api.set({ share: false }); return true; }
    if (st.menu) { api.set({ menu: false }); return true; }
    if (st.confirm) { api.set({ confirm: null, ag: null }); api.toast("Not booked. The form is yours."); return true; }
    if (st.ag) { api.stop(); api.set({ ag: null }); api.toast("You're in control"); return true; }
    if (st.editing) { api.set({ editing: false }); return true; }
    if (st.lib) { api.set({ lib: null }); return true; }
    if (st.tabsOpen) { api.set({ tabsOpen: false }); return true; }
    var t = st.tabs.filter(function (x) { return x.id === st.cur; })[0];
    if (t && t.pos === 0 && t.ext) {
      var rest = st.tabs.filter(function (x) { return x.id !== t.id; });
      if (rest.length) api.set({ tabs: rest, cur: rest[rest.length - 1].id }); else { var nid = "t" + Date.now(); api.set({ tabs: [{ id: nid, hist: ["newtab"], pos: 0 }], cur: nid }); }
      return false;
    }
    if (t && t.pos > 0) { api.set({ tabs: st.tabs.map(function (x) { return x.id === t.id ? Object.assign({}, x, { pos: x.pos - 1 }) : x; }), hl: 0 }); return true; }
    return false;
  },
  actions: {
    saveNote: function (card, api) { brSaveNote(api, card.title || "Key points", card.bullets || []); }
  },
  reply: function (t, raw, api) {
    var st = api.get("browser"); var here = api.active; var pg = brPage(brCurUrl(st)); var m;
    if (/\bbook (me )?(a )?table\b|\btable for (\d+|two|three|four|five|six)\b|\breserv(e|ation) (a table|at nopa|for)/.test(t)) {
      var o = brParseBook(t);
      return { text: "On it. I'll fill in the booking and check with you before I submit.", 
        then: function () { if (!api.isActive()) api.open("browser", null, "input"); api.shell({ chat: "input" }); brStartBook(api, o); } };
    }
    if (here && st.ag && /^(stop|cancel|wait|hold on)\b/.test(t)) return { text: "Stopped. You're in control.", then: function () { api.stop(); api.set({ ag: null, confirm: null }); api.shell({ chat: "input" }); } };
    if (here && st.confirm && /^(yes|confirm|book it|go ahead|do it)\b/.test(t)) return { text: "Booking now.", then: function () { api.shell({ chat: "input" }); brAg(api, { text: "Booking…" }); api.set({ confirm: null }); api.later(function () { brFinishBook(api); }, 900); } };
    if (here && /\b(save|keep)\b.*\b(key points|highlights|notes?)\b|\bhighlight (the )?key/.test(t)) {
      if (!pg.points) return { text: "Open a page first." };
      return { text: "Reading it now. Watch the page.", then: function () { api.shell({ chat: "input" }); brStartPoints(api); } };
    }
    if (here && /\bsummar|\btl;?dr\b|\bkey points\b|\bwhat('s| is) this (page|article) about\b|\bthe gist\b/.test(t)) {
      if (!pg.points) return { text: pg.kind === "search" ? "Search results for “" + pg.q + "”. Tap one and I'll read it." : "This tab is empty. Tell me where to go." };
      var saveAct = VIEWS.notes && VIEWS.notes.actions && VIEWS.notes.actions.save ? { mod: "notes", fn: "save" } : { mod: "browser", fn: "saveNote" };
      return { text: "Three things from " + pg.host + ".", card: { type: "summary", title: pg.title + " · key points", bullets: pg.points, act: saveAct } };
    }
    if (here && /\bread (it |this |the page |this page )?(out )?(aloud|to me)\b/.test(t)) return { text: "Reading " + pg.host + " aloud.", then: function () { api.toast("Reading aloud · " + (pg.host || "page")); } };
    if (here && /\bbookmark\b/.test(t)) return { text: "Bookmarked.", then: function () { var s = api.get("browser"); var u = brCurUrl(s); if (s.marks.indexOf(u) < 0) api.set({ marks: [u].concat(s.marks) }); } };
    if (here && /\bnew tab\b/.test(t)) return { text: "New tab.", then: function () { var s = api.get("browser"); var id = "t" + Date.now(); api.set({ tabs: s.tabs.concat([{ id: id, hist: ["newtab"], pos: 0 }]), cur: id, tabsOpen: false }); } };
    if (here && (m = t.match(/\bshare (this|the page|it)(?: with (\w+))?/))) {
      var who = m[2] ? PEOPLE.filter(function (p) { return p.name.toLowerCase().split(" ")[0] === m[2] || p.id === m[2]; })[0] : null;
      if (who) return { text: "Here's a message to " + who.name.split(" ")[0] + ".", nav: { view: "messages", patch: { compose: who.id, text: pg.title + " " + (pg.host + pg.path) } } };
      return { text: "Pick who to send it to.", then: function () { api.shell({ chat: "input" }); api.set({ share: true }); } };
    }
    if ((m = t.match(/^(?:go to|open|visit|browse to)\s+((?:[\w-]+\.)+[a-z]{2,}(?:\/\S*)?)\s*$/))) {
      var u = brNorm(m[1]);
      return { text: "Opening " + m[1] + ".",  then: function () { if (!api.isActive()) api.open("browser", null, "input"); api.shell({ chat: "input" }); brGo(api, u); } };
    }
    if ((m = raw.match(/^(?:search|google|look up)(?: the web)?(?: for)?\s+(.+)$/i)) && (here || /\bweb\b/i.test(raw))) {
      var qq = m[1].trim();
      return { text: "Searching for “" + qq + "”.",  then: function () { if (!api.isActive()) api.open("browser", null, "input"); api.shell({ chat: "input" }); brGo(api, "search.example/?q=" + encodeURIComponent(qq)); } };
    }
    return null;
  },
  render: function (st, api) {
    var set = api.set;
    if (st.url) api.later(function () {
      var s = api.get("browser"); if (!s.url) return; var u = brNorm(s.url) || s.url;
      if (s.newTab) { var id = "t" + Date.now(); var visits = [u].concat(s.visits.filter(function (v) { return v !== u; })).slice(0, 12); api.set({ url: null, newTab: false, tabs: s.tabs.concat([{ id: id, hist: [u], pos: 0, ext: true }]), cur: id, visits: visits, editing: false, tabsOpen: false, lib: null, menu: false }); return; }
      api.set({ url: null }); brGo(api, u);
    }, 0);
    var tab = st.tabs.filter(function (x) { return x.id === st.cur; })[0] || st.tabs[st.tabs.length - 1];
    var url = tab ? tab.hist[tab.pos] : "newtab"; var pg = brPage(url);
    var canBack = tab && tab.pos > 0, canFwd = tab && tab.pos < tab.hist.length - 1;
    var marked = st.marks.indexOf(url) >= 0;
    var stepTab = function (d) { return function () { var s = api.get("browser"); set({ tabs: s.tabs.map(function (x) { return x.id === s.cur ? Object.assign({}, x, { pos: Math.max(0, Math.min(x.hist.length - 1, x.pos + d)) }) : x; }), hl: 0 }); }; };
    var link = function (u) { return function () { brGo(api, u); }; };
    var hlCss = function (i) { return st.hl >= i ? "background:rgba(90,100,255,.2);box-shadow:0 0 0 5px rgba(90,100,255,.2)" : ""; };
    var newTab = function () { var s = api.get("browser"); var id = "t" + Date.now(); set({ tabs: s.tabs.concat([{ id: id, hist: ["newtab"], pos: 0 }]), cur: id, tabsOpen: false, editing: true, addr: "" }); };

    /* address editing + suggestions */
    var addr = st.addr || ""; var al = addr.toLowerCase().trim();
    var pool = []; st.marks.concat(st.visits).concat(Object.keys(BR_PAGES)).forEach(function (u) { if (pool.indexOf(u) < 0 && u !== "newtab") pool.push(u); });
    var sugg = pool.filter(function (u) { if (!al) return true; var p = brPage(u); return (u + " " + p.title).toLowerCase().indexOf(al) >= 0; }).slice(0, 5).map(function (u) {
      var p = brPage(u); return { title: p.title, url: p.host + p.path, d: st.marks.indexOf(u) >= 0 ? IC.star : IC.clock, go: link(u) };
    });
    if (al) sugg.unshift({ title: "Search “" + addr.trim() + "”", url: "search.example", d: IC.search, go: link("search.example/?q=" + encodeURIComponent(addr.trim())) });

    /* booking page */
    var bk = st.bk; var agBook = st.ag && st.ag.task === "book";
    var times = BR_TIMES.slice(); if (bk.time && times.indexOf(bk.time) < 0) times.push(bk.time);
    var chip = function (on) { return on ? "background:var(--acc);color:#fff" : "background:var(--s2)"; };
    var canBook = !!(bk.time && bk.name.trim() && bk.phone.trim());
    var bkSet = function (p) { var b = Object.assign({}, api.get("browser").bk, p); set({ bk: b }); };

    /* search results */
    var results = pg.kind === "search" ? brResults(pg.q).map(function (u) { var p = BR_PAGES[u]; return { title: p.title, host: p.host + p.path, snip: p.snip, go: link(u) }; }) : [];

    /* recent sites for new tab */
    var recents = st.visits.slice(0, 6).map(function (u) { var p = brPage(u); return { ini: (p.host || "?").charAt(0).toUpperCase(), host: p.host, go: link(u), css: "background:" + (p.tile && p.tile.indexOf("var") < 0 ? p.tile + ";color:#fff" : "var(--s2)") }; });

    /* tabs */
    var tabCards = st.tabs.map(function (x) {
      var p = brPage(x.hist[x.pos]); var on = x.id === st.cur;
      return { title: p.title, host: p.host || "New tab", css: on ? "box-shadow:inset 0 0 0 2px var(--acc)" : "", prev: "background:" + imgBg({ news: "news", enclave: "enclave", book: "nopa" }[p.kind] || "-", p.tile), aria: "Switch to " + p.title, closeAria: "Close " + p.title,
        pick: function () { set({ cur: x.id, tabsOpen: false }); },
        close: function () {
          var s = api.get("browser"); var rest = s.tabs.filter(function (y) { return y.id !== x.id; });
          if (!rest.length) { var id = "t" + Date.now(); set({ tabs: [{ id: id, hist: ["newtab"], pos: 0 }], cur: id }); return; }
          set({ tabs: rest, cur: s.cur === x.id ? rest[rest.length - 1].id : s.cur });
        } };
    });

    /* library */
    var libRows = (st.lib === "history" ? st.visits : st.marks).map(function (u) {
      var p = brPage(u);
      return { title: p.title, host: p.host + p.path, ini: (p.host || "?").charAt(0).toUpperCase(), css: "background:" + (p.tile && p.tile.indexOf("var") < 0 ? p.tile + ";color:#fff" : "var(--s3)"), go: link(u),
        canRemove: st.lib !== "history", removeAria: "Remove bookmark " + p.title, remove: function () { var s = api.get("browser"); set({ marks: s.marks.filter(function (x) { return x !== u; }) }); } };
    });

    var ag = st.ag;
    var people = PEOPLE.filter(function (p) { return p.fav && p.phone; }).slice(0, 4).map(function (p) {
      return { ini: p.ini, name: p.name.split(" ")[0], aria: "Share with " + p.name, go: function () { set({ share: false }); api.open("messages", { compose: p.id, text: pg.title + " " + pg.host + pg.path }); } };
    });
    var cf = st.confirm;

    return {
      rootRef: function () { brNoScroll(); },
      pg: pg, heroNews: imgBg("news", "#000"), heroEnc: imgBg("enclave", "#0000FF"), heroBook: imgBg("nopa", "#17352A"), heroArt: IMG.news ? "none" : "block", isNews: pg.kind === "news", isEnc: pg.kind === "enclave", isBook: pg.kind === "book", isSearch: pg.kind === "search", isNew: pg.kind === "newtab", isGeneric: pg.kind === "generic", genLinks: (pg.links || []).map(function (l) { return { label: l.label, host: l.url, go: link(l.url) }; }),
      host: pg.host || "Search or type address", hostCss: pg.host ? "" : "color:var(--mut)", path: pg.path, hasLock: !!pg.host,
      backOp: canBack ? 1 : 0.3, fwdOp: canFwd ? 1 : 0.3, goBack: stepTab(-1), goFwd: stepTab(1),
      nTabs: st.tabs.length, openTabs: function () { set({ tabsOpen: true, menu: false, editing: false }); }, closeTabs: function () { set({ tabsOpen: false }); },
      tabsTitle: st.tabs.length === 1 ? "1 tab" : st.tabs.length + " tabs", tabCards: tabCards, newTab: newTab, tabsOpen: st.tabsOpen,
      editing: st.editing, notEditing: !st.editing, addr: addr,
      startEdit: function () { if (api.get("browser").ag) return; set({ editing: true, addr: pg.kind === "search" ? pg.q : (pg.host ? pg.host + pg.path : ""), menu: false }); },
      cancelEdit: function () { set({ editing: false }); },
      onAddr: function (e) { set({ addr: e.target.value }); },
      onAddrKey: function (e) { if (e.key === "Enter") { e.preventDefault(); var u = brNorm(e.target.value); if (u) brGo(api, u); } if (e.key === "Escape") set({ editing: false }); },
      focusRef: function (el) { if (el && !el._brf) { el._brf = 1; try { el.focus({ preventScroll: true }); el.select(); } catch (e) {} } },
      sugg: sugg,
      menu: st.menu, toggleMenu: function () { set({ menu: !api.get("browser").menu, editing: false }); }, closeMenu: function () { set({ menu: false }); },
      markIcon: IC.star, markFill: marked ? "currentColor" : "none", markLabel: marked ? "Bookmarked" : "Bookmark",
      toggleMark: function () { var s = api.get("browser"); var on = s.marks.indexOf(url) >= 0; if (!pg.host) return; set({ marks: on ? s.marks.filter(function (x) { return x !== url; }) : [url].concat(s.marks), menu: false }); api.toast(on ? "Bookmark removed" : "Bookmarked"); },
      openLib: function () { set({ lib: "bookmarks", menu: false }); }, lib: !!st.lib, closeLib: function () { set({ lib: null }); },
      libMarks: function () { set({ lib: "bookmarks" }); }, libHist: function () { set({ lib: "history" }); },
      libMarksCss: st.lib !== "history" ? "background:var(--acc);color:#fff" : "color:var(--mut)", libHistCss: st.lib === "history" ? "background:var(--acc);color:#fff" : "color:var(--mut)",
      libRows: libRows, libEmpty: !libRows.length, libIsHist: st.lib === "history" && libRows.length > 0, clearHist: function () { set({ visits: [] }); api.toast("History cleared"); },
      openShare: function () { set({ share: true, menu: false }); }, share: st.share, closeShare: function () { set({ share: false }); }, people: people,
      copyLink: function () { set({ share: false }); api.toast("Link copied"); },
      readAloud: function () { set({ menu: false }); api.toast("Reading aloud · " + (pg.host || "page")); },
      openNews: link(BR_NEWS), openEnc: link(BR_ENC), openBook: link(BR_BOOK),
      hl1: hlCss(1), hl2: hlCss(2), hl3: hlCss(3),
      results: results, q: pg.q || "", recents: recents,
      // booking
      party: bk.party, partyDown: function () { bkSet({ party: Math.max(1, api.get("browser").bk.party - 1) }); }, partyUp: function () { bkSet({ party: Math.min(12, api.get("browser").bk.party + 1) }); },
      dates: BR_DATES.map(function (d) { return { label: d[1], key: "d-" + d[0], css: chip(bk.date === d[0]), on: bk.date === d[0], pick: function () { bkSet({ date: d[0] }); } }; }),
      times: times.map(function (x) { return { label: x, key: "t-" + x, css: chip(bk.time === x), on: bk.time === x, aria: x + " PM", pick: function () { bkSet({ time: x }); } }; }),
      bkName: bk.name, bkPhone: bk.phone, onName: function (e) { bkSet({ name: e.target.value }); }, onPhone: function (e) { bkSet({ phone: e.target.value }); },
      fieldCss: agBook ? "box-shadow:inset 0 0 0 1.5px var(--acct)" : "",
      bookCss: canBook ? "background:var(--acc);color:#fff" : "background:var(--s3);color:var(--mut)", canBookNot: !canBook,
      bookNow: function () { if (!canBook || api.get("browser").ag) return; brFinishBook(api); },
      booked: st.booked, isBooked: !!st.booked, notBooked: !st.booked,
      rebook: function () { set({ booked: null }); },
      // agent
      agOn: !!ag, agText: ag ? ag.text : "", curX: ag ? ag.cx : 0, curY: ag ? ag.cy : 0,
      outline: ag ? "inset 0 0 0 3px var(--acc)" : "none",
      stopAg: function () { api.stop(); set({ ag: null, confirm: null }); api.toast("You're in control"); },
      confirm: !!cf, cf: cf || {},
      cfOk: function () { brAg(api, { text: "Booking…" }); set({ confirm: null }); api.later(function () { brFinishBook(api); }, 900); },
      cfNo: function () { set({ confirm: null, ag: null }); api.toast("Not booked. The form is yours."); }
    };
  }
});

/* ===== module: camera ===== */
/* Camera: photo / video / scan. Immersive. Captures are prepended to Photos' shared list.
   Scenes come from phScene()/phLook() in the Photos module (CSS compositions, no images). All holes are {{camera.*}}. */
IC.camFlash = IC.camFlash || "M13 3L5 14h6l-1 7 8-11h-6l1-7z";
IC.camFlashOff = IC.camFlashOff || "M13 3L9.5 8M8 10l-3 4h6l-1 7 3.2-4.4M15 13.6L18 10h-6l1-7M3 3l18 18";
IC.camFlip = IC.camFlip || "M4 12a8 8 0 0 1 13.7-5.6L20 9M20 4v5h-5M20 12a8 8 0 0 1-13.7 5.6L4 15M4 20v-5h5";
IC.camScan = IC.camScan || "M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M7 12h10";

var CAM = { live: false, scan: false, lp: null, long: false, g: null };
var CAM_ZOOM = [[".5", 1], ["1×", 1.35], ["2", 2], ["5", 3.4]];
var CAM_MODES = [["video", "Video"], ["photo", "Photo"], ["scan", "Scan"]];
var CAM_DRIFT = [[0, 0], [-5, 3], [3, -4], [-2, -6], [4, 2]];
function camScene(st) { return st.mode === "scan" ? "poster" : (st.front ? "selfie" : "park"); }
function camFigs(st) { return st.mode !== "scan" && st.front ? [[50, 2.2]] : null; }
function camPoster(now) {
  var d = new Date(now); var add = (5 - d.getDay() + 7) % 7 || 7; d.setDate(d.getDate() + add);
  return { day: DAYS[d.getDay()].slice(0, 3) + ", " + MONS[d.getMonth()].slice(0, 3) + " " + d.getDate(), short: DAYS[d.getDay()].slice(0, 3) + " 6 PM" };
}
function camSave(api, item) {
  var ph = api.get("photos");
  api.setView("photos", { list: [item].concat(ph.list || []) });
  api.set({ session: [item.id].concat(api.get("camera").session || []) });   // this session's captures (all secure mode may show)
}
function camFlashFx(api) { api.set({ fl: 1 }); api.later(function () { api.set({ fl: 0 }); }, 90); }
function camStopRec(api) {
  var s = api.get("camera"); if (!s.rec) return;
  var sec = Math.max(1, Math.floor((Date.now() - s.recAt) / 1000));
  camSave(api, { id: "c" + Date.now(), ts: Date.now(), kind: "video", dur: Math.floor(sec / 60) + ":" + pad2(sec % 60), scene: camScene(s), figs: camFigs(s), place: "Dolores Park", people: [], tags: s.front ? ["selfie"] : [], fav: false, z: s.front ? 1 : CAM_ZOOM[s.zoom][1] });
  api.set({ rec: false, recAt: 0 }); api.stopBg();
}
function camAsk(api) {
  var s = api.get("camera");
  if (api.secure) { var k = Date.now(); api.set({ said: camDescribe(s, Date.now()), saidK: k }); api.later(function () { if (api.get("camera").saidK === k) api.set({ said: "" }); }, 7000); return; }
  api.send(s.mode === "scan" ? "What does it say?" : "What am I looking at?");
}
function camRecLabel(st) { var sec = Math.max(0, Math.floor((Date.now() - st.recAt) / 1000)); return Math.floor(sec / 60) + ":" + pad2(sec % 60); }
function camSaveScan(api, quiet) {
  var s = api.get("camera");
  camSave(api, { id: "c" + Date.now(), ts: Date.now(), kind: "doc", scene: "poster", figs: null, place: "Lumen HQ", people: [], tags: ["open studio", "lumen"], fav: false, z: 1 });
  if (!quiet) camFlashFx(api);
  return s;
}
function camDescribe(st, now) {
  if (st.mode === "scan") { var p = camPoster(now); return "A poster: Open Studio at Lumen, " + p.day + " at 6 PM, 1 Market St. The QR code goes to the RSVP page."; }
  if (st.front) return "That's you, with soft window light from the left. Good light for a selfie.";
  return "A park on a clear afternoon: lawn, two trees and a path up the hill. Plenty of light, no flash needed.";
}

registerView("camera", {
  title: "Camera", icon: "camera", aliases: ["cam"],
  chat: "hidden",
  state: { mode: "photo", front: false, flash: false, zoom: 1, rec: false, recAt: 0, tick: 0, fl: 0, focus: null, found: false, flip: false, session: [], said: "" },
  ongoing: function (st) { return st.rec ? { label: camRecLabel(st), icon: "video", color: "#E53935" } : null; },
  jumps: [[null, "Camera"], ["video", "Video"], ["scan", "Scan"]],
  preset: function (sub) { if (sub) return { mode: sub }; },
  immersive: function () { return { dark: true, noPill: true }; },
  back: function (st, api) { if (st.rec) { camStopRec(api); return true; } return false; },
  onLeave: function (api) { if (api.secure && api.get("camera").rec) camStopRec(api); CAM.live = false; CAM.scan = false; clearTimeout(CAM.lp); },  // recording keeps going in the background (ongoing chip) except from the lock screen
  suggestions: function (st) {
    if (st.mode === "scan") return ["What does it say?", "Add it to my calendar", "Save it to Files"];
    return ["What am I looking at?", "Take a selfie", "Scan a document"];
  },
  voicePhrase: "What am I looking at?",
  actions: {
    addEvent: function (card, api) { api.toast("Added to Calendar"); }
  },
  reply: function (t, raw, api) {
    var st = api.st; var now = api.now.getTime();
    if (api.active) {
      if (/what (am i|do you|is (this|that)|'s (this|that))|what.*(see|looking)|read (this|it)|what does it say|describe/.test(t)) {
        if (st.mode === "scan") { var p = camPoster(now); return { text: camDescribe(st, now), card: { type: "event", time: p.day + " · 6:00 PM", title: "Open Studio · Lumen", act: { mod: "camera", fn: "addEvent" } } }; }
        return { text: camDescribe(st, now) };
      }
      if (st.mode === "scan" && /calendar|add (it|the event|event)/.test(t)) return { text: "Added Open Studio to your calendar.", then: function () { api.toast("Added to Calendar"); } };
      if (st.mode === "scan" && /files|save (it|this)/.test(t)) return { text: "Saved to Files, under Scans.", then: function () { camSaveScan(api, true); api.toast("Saved to Files"); } };
      if (/\b(take|snap|shoot)\b.*\bselfie\b/.test(t)) return { text: "Smile.", then: function () { api.set({ mode: "photo", front: true }); api.later(function () { api.set({ fl: 1 }); var s = api.get("camera"); camSave(api, { id: "c" + Date.now(), ts: Date.now(), kind: "photo", scene: "selfie", figs: [[50, 2.2]], place: "Dolores Park", people: [], tags: ["selfie"], fav: false, z: 1 }); api.later(function () { api.set({ fl: 0 }); }, 90); }, 900); } };
      if (/\b(take|snap|shoot)\b.*\b(photo|picture|pic|shot)\b/.test(t)) return { text: "Got it.", then: function () { var s = api.get("camera"); camFlashFx(api); camSave(api, { id: "c" + Date.now(), ts: Date.now(), kind: "photo", scene: camScene(s), figs: camFigs(s), place: "Dolores Park", people: [], tags: s.front ? ["selfie"] : [], fav: false, z: s.front ? 1 : CAM_ZOOM[s.zoom][1] }); } };
    }
    if (/\b(take|snap)\b.*\bselfie\b/.test(t)) return { text: "Front camera's ready.", nav: { view: "camera", patch: { mode: "photo", front: true } } };
    if (/\b(take|snap|shoot)\b.*\b(photo|picture|pic)\b|\bopen (the )?camera\b/.test(t)) return { text: "Camera's ready.", nav: { view: "camera", patch: { mode: "photo" } } };
    if (/\b(record|film|shoot)\b.*\bvideo\b/.test(t)) return { text: "Tap the red button to start.", nav: { view: "camera", patch: { mode: "video" } } };
    if (/\bscan\b.*\b(document|doc|receipt|qr|code|poster|page|this|a|it)\b/.test(t)) return { text: "Point it at the page. I'll read it.", nav: { view: "camera", patch: { mode: "scan", found: false } } };
    return null;
  },
  render: function (st, api) {
    var now = api.now.getTime();
    if (!CAM.live) { CAM.live = true; api.every(function () { var s = api.get("camera"); if (!s.rec) api.set({ tick: (s.tick || 0) + 1 }); }, 1000); }
    if (st.mode === "scan" && !st.found && !CAM.scan) { CAM.scan = true; api.later(function () { CAM.scan = false; if (api.get("camera").mode === "scan") api.set({ found: true }); }, 1100); }
    var isScan = st.mode === "scan", isVideo = st.mode === "video";
    var front = st.front && !isScan;
    var zs = isScan ? 0.8 : (front ? 1.05 : CAM_ZOOM[st.zoom][1]);
    var dr = CAM_DRIFT[Math.floor((st.tick || 0) / 2) % CAM_DRIFT.length];
    var bg = phScene(camScene(st), camFigs(st), 0, PH_SCENE_IMG[camScene(st)]);
    var setMode = function (m) { var s = api.get("camera"); if (s.rec) camStopRec(api); if (s.mode !== m) api.set({ mode: m, found: false }); };
    var modeIdx = CAM_MODES.map(function (m) { return m[0]; }).indexOf(st.mode);

    var ph = api.get("photos"); var sess = st.session || [];
    var last = (ph.list || []).filter(function (it) { return !api.secure || sess.indexOf(it.id) >= 0; })[0] || null;
    var lastLook = last ? phLook(last, "thumb") : null;
    var poster = camPoster(now);

    function pt(e) { var sc = e.currentTarget.closest("[data-screen]"); var r = sc.getBoundingClientRect(); var s = r.width / 412 || 1; return { x: (e.clientX - r.left) / s, y: (e.clientY - r.top) / s }; }
    return {
      bg: bg, vfBg: isScan ? "linear-gradient(135deg, #6B5A4A, #4E4036)" : "#111111",
      drift: "transform: translate(" + dr[0] + "px, calc(-50% + " + dr[1] + "px))",
      zoomCss: "transform: scale(" + zs + ")" + (front ? " scaleX(-1)" : "") + "; filter: " + (st.flip ? "blur(14px) brightness(.7)" : "none"),
      flOp: st.fl ? (st.flash ? 1 : 0.85) : 0, flTr: st.fl ? "none" : "opacity .45s",
      hasFocus: !!st.focus, focus: st.focus ? "left: " + (st.focus.x - 34) + "px; top: " + (st.focus.y - 34) + "px" : "",
      flashIcon: st.flash ? IC.camFlash : IC.camFlashOff, flashLabel: st.flash ? "Flash on" : "Flash off",
      toggleFlash: function () { api.set({ flash: !api.get("camera").flash }); },
      rec: st.rec, recTime: st.rec ? camRecLabel(st) : "",
      said: st.said || "", hasSaid: !!st.said, clearSaid: function () { api.set({ said: "" }); },
      showZoom: !isScan && !front,
      zooms: CAM_ZOOM.map(function (z, i) {
        var on = st.zoom === i;
        return { label: z[0], aria: "Zoom " + z[0].replace("×", "") + "x", css: on ? "background:#ffffff;color:#000000;width:40px;height:40px;font-size:13px" : "background:rgba(0,0,0,.4);color:#ffffff;width:34px;height:34px;font-size:12px", pick: function () { api.set({ zoom: i }); } };
      }),
      scanFound: isScan && st.found, scanning: isScan && !st.found,
      posterDay: poster.short,
      addEvent: function () { api.toast("Added to Calendar · " + poster.short); },
      saveFiles: function () { camSaveScan(api); api.toast("Saved to Files"); },
      openLink: function () { api.open("browser", { url: "lumen.example/open-studio" }); },
      modes: CAM_MODES.map(function (m) {
        var on = st.mode === m[0];
        return { label: m[1], css: on ? "color:#ffffff" : "color:rgba(255,255,255,.55)", dot: on ? 1 : 0, pick: function () { setMode(m[0]); } };
      }),
      innerCss: isVideo ? (st.rec ? "width:30px;height:30px;border-radius:8px;background:#E53935" : "width:62px;height:62px;border-radius:31px;background:#E53935") : "width:62px;height:62px;border-radius:31px;background:#ffffff",
      scanGlyph: isScan,
      shutterLabel: isVideo ? (st.rec ? "Stop recording" : "Start recording") : (isScan ? "Save scan" : "Take photo"),
      shutter: function () {
        var s = api.get("camera");
        if (s.mode === "video") { if (s.rec) camStopRec(api); else { api.set({ rec: true, recAt: Date.now() }); api.everyBg(function () { var c = api.get("camera"); api.set({ tick: (c.tick || 0) + 1 }); }, 1000); } return; }
        if (s.mode === "scan") { camSaveScan(api); api.toast("Scan saved"); return; }
        camFlashFx(api);
        camSave(api, { id: "c" + Date.now(), ts: Date.now(), kind: "photo", scene: camScene(s), figs: camFigs(s), place: "Dolores Park", people: [], tags: s.front ? ["selfie"] : [], fav: false, z: s.front ? 1 : CAM_ZOOM[s.zoom][1] });
      },
      hasLast: !!last, lastBg: lastLook ? lastLook.bg : "", lastTf: lastLook ? lastLook.tf : "", lastFlt: lastLook ? lastLook.flt : "none",
      openLast: function () { if (last) api.open("photos", { open: last.id, from: "camera", seq: api.secure ? sess.slice() : null, chrome: true, sheet: null, edit: null, sel: null, searching: false }); },
      showFlip: !isScan && !st.rec, noFlip: isScan || !!st.rec, noLast: !last,
      flip: function () { api.set({ front: !api.get("camera").front, flip: true }); api.later(function () { api.set({ flip: false }); }, 260); },
      ask: function () { camAsk(api); },
      vfDown: function (e) {
        CAM.g = pt(e); CAM.long = false; clearTimeout(CAM.lp); try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
        CAM.lp = setTimeout(function () { CAM.long = true; camAsk(api); }, 650);
      },
      vfUp: function (e) {
        clearTimeout(CAM.lp); var g = CAM.g; CAM.g = null; if (!g || CAM.long) return;
        var p = pt(e); var dx = p.x - g.x, dy = p.y - g.y;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) && g.x > 30 && g.x < 382) {
          var ni = modeIdx + (dx < 0 ? 1 : -1); if (ni >= 0 && ni < CAM_MODES.length) setMode(CAM_MODES[ni][0]); return;
        }
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
          var k = Date.now(); api.set({ focus: { x: g.x, y: g.y - 96, k: k } });
          api.later(function () { var s = api.get("camera"); if (s.focus && s.focus.k === k) api.set({ focus: null }); }, 1100);
        }
      },
      vfLeave: function () { clearTimeout(CAM.lp); CAM.g = null; }
    };
  }
});

/* ===== module: photos ===== */
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

/* ===== module: maps ===== */
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
      nativeModeMetadata: MAPS_MODES.map(function (md) { return { mode: md[0], d: IC[md[1]], label: md[2] }; }),
      notNative: true, mode: mode, isBase: mode === "base", isResults: mode === "results", isPlace: mode === "place", isDir: mode === "dir", isNav: mode === "nav",
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

/* ===== module: notes ===== */
/* Notes: text, checklist, voice (live transcription + Alpha summary), link clips. Holes are {{notes.*}}. */
IC.notesPin = IC.notesPin || "M9 3h6l-1 6 4 4H6l4-4zM12 13v8";
IC.notesList = IC.notesList || "M10 6h10M10 12h10M10 18h10M4 6l1.5 1.5L8 5M4 12l1.5 1.5L8 11M4 18l1.5 1.5L8 17";
IC.notesBox = IC.notesBox || "M5 5h14v14H5z";
IC.notesRecDot = IC.notesRecDot || "M12 7.5a4.5 4.5 0 1 1 0 9a4.5 4.5 0 1 1 0-9zM12 10a2 2 0 1 1 0 4a2 2 0 1 1 0-4z";
IC.notesWave = IC.notesWave || "M3 12h2M7 8v8M11 5v14M15 9v6M19 11v2M21 12h0";
var NOTES_RED = "#E5484D";

var NOTES_SEED = [
  { id: "sync", kind: "voice", title: "Design sync", when: "Yesterday · 4:10 PM", dur: 408, pinned: false,
    lines: [
      { s: "maya", t: "Okay, lock screen first. Notifications stay as icons until you unlock.", at: 0 },
      { s: "me", t: "Agreed. Voice still works locked, but the answers stay vague.", at: 42 },
      { s: "sam", t: "What about the chat over other apps?", at: 90 },
      { s: "maya", t: "Four heights. Pill, input, half, full. You drag between them.", at: 125 },
      { s: "me", t: "Let's cut the mark button from the recorder. Nobody used it.", at: 190 },
      { s: "sam", t: "I'll wire the new recorder into Notes by Thursday.", at: 242 },
      { s: "maya", t: "I'll send the prototype to the team tonight.", at: 315 },
      { s: "me", t: "And I'll book a review with Jordan for next week.", at: 390 }
    ],
    summary: ["Notifications stay as icons until unlock", "Voice works while locked; answers stay vague", "Chat has four heights: pill, input, half, full", "The recorder drops the mark button"],
    actions: [{ t: "Sam · wire the recorder into Notes by Thursday", done: false }, { t: "Maya · send the prototype to the team tonight", done: true }, { t: "Book a review with Jordan next week", done: false }] },
  { id: "enclave", kind: "text", title: "Enclave launch", body: "Confirm attestation flow\nShip the keys-on-device doc\nDry run Friday", pinned: true, when: "Today" },
  { id: "groceries", kind: "list", title: "Groceries", items: [{ t: "Oat milk", done: true }, { t: "Espresso beans", done: false }, { t: "Lemons", done: false }, { t: "Sourdough from Tartine", done: false }], pinned: false, when: "Today" },
  { id: "agents", kind: "link", title: "The case for on-device agents", url: "news.example/on-device-agents", domain: "news.example", when: "Mon",
    clips: ["Keys that never leave the device change what an assistant can be trusted with.", "Latency drops below the threshold where talking feels like thinking.", "The phone becomes the agent's body, not just its screen."] },
  { id: "gifts", kind: "text", title: "Gift ideas · Priya", body: "Film camera, ceramics class.\nShe mentioned the print show at SFMOMA.", pinned: false, when: "Sun" },
  { id: "landlord", kind: "text", title: "Radiator", body: "Call the landlord Friday. Bedroom radiator clanks all night.", pinned: false, when: "Sep 22" }
];

/* scripted live transcript for a new recording; each line may add a summary bullet or an action item */
var NOTES_LIVE = [
  { s: "me", t: "Quick standup. Maya, where is the prototype?" },
  { s: "maya", t: "Home and chat are done. Notes and Files land today.", sum: "Home and chat are done; Notes and Files land today" },
  { s: "sam", t: "The on-device model is twice as fast after the quantization pass.", sum: "On-device model is 2x faster after quantization" },
  { s: "me", t: "Great. Let's demo that at the design review at three.", act: "Demo the faster model at the 3:00 design review" },
  { s: "maya", t: "I need the final lock screen copy by noon.", act: "Sam · final lock screen copy to Maya by noon" },
  { s: "sam", t: "I'll send it. Jordan also wants term sheet notes before four thirty.", sum: "Jordan needs term sheet notes before 4:30" },
  { s: "me", t: "I'll review the term sheet over lunch.", act: "Review the term sheet over lunch" }
];
var NOTES_DICT = ["Ask Jordan about the board seat before signing.", "Pick up the dry cleaning on Thursday.", "Idea: let Alpha draft the weekly review from calendar and notes."];
var NOTES_WAVE = []; (function () { for (var i = 0; i < 56; i++) NOTES_WAVE.push(Math.round(8 + 26 * Math.abs(Math.sin(i * 0.9) * Math.cos(i * 0.37)) + (i % 3) * 3)); })();
var NT = { pend: false, recI: null, playI: null, dicI: null, dIdx: 0, undoT: null };

function notesFmt(sec) { sec = Math.max(0, Math.floor(sec)); return Math.floor(sec / 60) + ":" + pad2(sec % 60); }
function notesNowLabel(d) { var h = d.getHours(); return (h % 12 || 12) + ":" + pad2(d.getMinutes()) + (h < 12 ? " AM" : " PM"); }
function notesFind(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
function notesUpd(api, id, patch) {
  var s = api.get("notes");
  return api.set({ list: s.list.map(function (n) { return n.id === id ? Object.assign({}, n, typeof patch === "function" ? patch(n) : patch) : n; }) });
}
function notesEmpty(n) {
  if (!n) return false;
  if (n.kind === "text") return !String(n.title || "").trim() && !String(n.body || "").trim();
  if (n.kind === "list") return !String(n.title || "").trim() && !(n.items || []).some(function (i) { return String(i.t).trim(); });
  return false;
}
function notesStopTimers() { clearInterval(NT.playI); clearInterval(NT.dicI); NT.playI = null; NT.dicI = null; }
function notesClose(api) {
  var s = api.get("notes"); notesStopTimers();
  var n = notesFind(s.list, s.open);
  var patch = { open: null, sheet: null, playing: false, dict: false, newItem: "" };
  if (n && notesEmpty(n)) patch.list = s.list.filter(function (x) { return x.id !== n.id; });
  api.set(patch);
}
function notesUndoable(api, note, idx, label) {
  api.toast(label, { undo: function () { var s = api.get("notes"); if (notesFind(s.list, note.id)) return; var l = s.list.slice(); l.splice(Math.min(idx, l.length), 0, note); api.set({ list: l }); } });
}
async function notesDelete(api, id) {
  var s = api.get("notes"); notesStopTimers();
  var idx = -1; s.list.forEach(function (n, i) { if (n.id === id) idx = i; });
  if (idx < 0) return;
  var note = s.list[idx];
  if(await api.set({ list: s.list.filter(function (n) { return n.id !== id; }), open: null, sheet: null, playing: false, dict: false })===false)return;
  notesUndoable(api, note, idx, (note.title || "Note") + " deleted");
}
function notesNew(api, kind) {
  var id = "n" + Date.now();
  var n = kind === "list" ? { id: id, kind: "list", title: "", items: [], pinned: false, when: "Now" } : { id: id, kind: "text", title: "", body: "", pinned: false, when: "Now" };
  var s = api.get("notes");
  api.set({ list: [n].concat(s.list), open: id, compose: false, q: null });
}
function notesStartRec(api) {
  notesStopTimers();
  api.set({ record: false, open: null, sheet: null, q: null, rec: { tick: 0, paused: false, levels: [] } });
  api.stopBg();
  NT.recI = api.everyBg(function () {
    var s = api.get("notes"); var r = s.rec; if (!r || r.paused) return;
    var t = r.tick + 1;
    var speaking = t >= NOTES_T0 && ((t - NOTES_T0) % NOTES_STEP) < 9 && notesLiveCount(t) <= NOTES_LIVE.length && t < NOTES_T0 + NOTES_LIVE.length * NOTES_STEP;
    var lv = speaking ? 0.3 + 0.7 * Math.abs(Math.sin(t * 1.7) * Math.cos(t * 0.53)) : 0.08 + 0.1 * Math.abs(Math.sin(t));
    api.set({ rec: Object.assign({}, r, { tick: t, levels: r.levels.concat([lv]).slice(-44) }) });
  }, 250);
}
var NOTES_T0 = 2, NOTES_STEP = 12;
function notesLiveCount(tick) { return Math.max(0, Math.min(NOTES_LIVE.length, Math.floor((tick - NOTES_T0) / NOTES_STEP) + 1)); }
function notesBuildRec(api, r) {
  var n = notesLiveCount(r.tick); var got = NOTES_LIVE.slice(0, n);
  var sum = [], acts = [];
  got.forEach(function (l) { if (l.sum) sum.push(l.sum); if (l.act) acts.push({ t: l.act, done: false }); });
  if (!sum.length && got.length) sum.push("Short check-in, nothing decided yet");
  return { id: "r" + Date.now(), kind: "voice", title: got.length ? "Standup" : "Recording", when: "Today · " + notesNowLabel(api.now), dur: Math.round(r.tick / 4), pinned: false,
    lines: got.map(function (l, i) { return { s: l.s, t: l.t, at: Math.round((NOTES_T0 + i * NOTES_STEP) / 4) }; }), summary: sum, actions: acts, fresh: true };
}
function notesStopRec(api, quiet) {
  api.stopBg(); NT.recI = null;
  var s = api.get("notes"); if (!s.rec) return;
  var note = notesBuildRec(api, s.rec);
  api.set({ rec: null, list: [note].concat(s.list), open: quiet ? null : note.id, proc: quiet ? null : note.id, pos: 0, playing: false });
  if (quiet) api.toast("Recording saved to Notes");
  else api.later(function () { api.set({ proc: null }); }, 1500);
}
function notesDiscardRec(api) {
  api.stopBg(); NT.recI = null;
  var s = api.get("notes"); if (!s.rec) return;
  var note = notesBuildRec(api, s.rec);
  api.set({ rec: null });
  notesUndoable(api, note, 0, "Recording discarded");
}
function notesLast(list) { for (var i = 0; i < list.length; i++) if (list[i].kind === "voice") return list[i]; return null; }
function notesShare(api, n, via) {
  var parts = n.kind === "voice" ? n.summary.concat(n.actions.map(function (a) { return "Next: " + a.t; }))
    : n.kind === "list" ? n.items.map(function (i) { return (i.done ? "Done: " : "") + i.t; })
    : n.kind === "link" ? [n.url] : String(n.body || "").split("\n").filter(function (l) { return l.trim(); });
  var body = parts.map(function (l) { return "· " + l; }).join("\n");
  var line = (n.title ? n.title + ": " : "") + parts.join("; ");
  var to = null;
  if (n.kind === "voice") (n.lines || []).forEach(function (l) { if (!to && l.s !== "me") to = l.s; });
  api.set({ sheet: null });
  if (via === "mail" && VIEWS.inbox) return api.open("inbox", { compose: { to: to, subject: n.title || "Note", body: body } });
  if (via === "msg" && VIEWS.messages) return api.open("messages", { compose: to || true, text: line });
  api.toast(via === "mail" ? "Email draft ready" : "Message draft ready");
}

registerView("notes", {
  title: "Notes", icon: "notes", aliases: ["note", "recorder", "memos"],
  chat: "hidden",
  state: { list: NOTES_SEED, open: null, q: null, rec: null, record: false, compose: false, proc: null, sheet: null, pos: 0, playing: false, dict: false, newItem: "" },
  persist: ["list"],
  jumps: [[null, "Notes"], ["editor", "Note editor"], ["rec", "Recording"], ["voice", "Voice note"]],
  preset: function (sub) {
    if (sub === "editor") return { open: "enclave" };
    if (sub === "rec") return { record: true };
    if (sub === "voice") return { open: "sync" };
  },
  immersive: function (st) { return st.rec || st.record || st.sheet ? { noPill: true } : null; },
  back: function (st, api) {
    if (st.rec) { notesStopRec(api); return true; }
    if (st.sheet) { api.set({ sheet: null }); return true; }
    if (st.open) { notesClose(api); return true; }
    if (st.q !== null && st.q !== undefined) { api.set({ q: null }); return true; }
    return false;
  },
  onLeave: function () { notesStopTimers(); },
  ongoing: function (st) { return st.rec ? { label: notesFmt(st.rec.tick / 4), icon: "notesRecDot", color: NOTES_RED } : null; },
  suggestions: function (st, api) {
    var n = st.open ? notesFind(st.list, st.open) : null;
    if (n && n.kind === "voice") {
      var pid = null; (n.lines || []).forEach(function (l) { if (!pid && l.s !== "me") pid = l.s; });
      var p = pid ? api.person(pid) : null;
      return p && n.actions.length ? ["Share the action items with " + p.name.split(" ")[0], "What did we decide?"] : ["What did we decide?"];
    }
    if (n && n.kind === "text") return ["Make this a checklist", "Summarize this note"];
    return ["Start recording", "Summarize my last recording", "Take a note: call the landlord Friday"];
  },
  voicePhrase: "Start recording",
  actions: {
    save: function (card, api) {
      var body = card.body || (card.bullets || []).join("\n");
      var s = api.get("notes");
      api.set({ list: [{ id: "n" + Date.now(), kind: "text", title: card.title || "Key points", body: body, pinned: false, when: "Now" }].concat(s.list) });
      api.toast("Saved to Notes");
    },
    sendShare: function (card, api) { api.toast("Sent to " + card.to.split(" ")[0]); }
  },
  reply: function (t, raw, api) {
    var st = api.get("notes");
    var m = raw.match(/^\s*(?:please\s+)?(?:take a note|make a note|note|jot down|write down|remember)\b(?:\s+(?:that|to))?\s*[:,]?\s*(.+)$/i);
    if (m && m[1].trim()) {
      var text = m[1].trim().replace(/\.$/, ""); var id = "n" + Date.now();
      var title = text.length <= 44 ? cap(text) : cap(text.split(/\s+/).slice(0, 5).join(" ")) + "…";
      var note = { id: id, kind: "text", title: title, body: text.length <= 44 ? "" : cap(text) + ".", pinned: false, when: "Now" };
      return { text: /^\s*remember/i.test(raw) ? "I'll remember. It's in Notes." : "Saved to Notes.", card: { type: "note", body: cap(text), go: { view: "notes", patch: { open: id } } },
        then: function () { var s = api.get("notes"); api.set({ list: [note].concat(s.list) }); } };
    }
    var fm = raw.match(/(?:find|search|show)\s+(?:my\s+)?notes?\s+(?:about|on|for|with|mentioning)\s+(.+)$/i);
    if (fm) {
      var term = fm[1].trim().replace(/[?.!]$/, ""); var tl = term.toLowerCase();
      var hits = st.list.filter(function (n) { return [n.title, n.body, (n.items || []).map(function (i) { return i.t; }).join(" "), (n.lines || []).map(function (l) { return l.t; }).join(" "), (n.summary || []).join(" ")].join(" ").toLowerCase().indexOf(tl) >= 0; });
      if (!hits.length) return { text: "No notes mention \u201c" + term + "\u201d." };
      return { text: hits.length === 1 ? "One note: " + (hits[0].title || "Untitled") + "." : hits.length + " notes mention \u201c" + term + "\u201d.", nav: { view: "notes", patch: hits.length === 1 ? { open: hits[0].id, q: null } : { q: term, open: null } } };
    }
    if (/(start|begin)\s+(a\s+)?(recording|transcri)|record (this|the) (meeting|call)|^record$|^transcribe/.test(t)) {
      return { text: "Recording. I'll transcribe as we go and summarize when you stop.", nav: { view: "notes", patch: { record: true } } };
    }
    if (/design sync/.test(t) && /decide|decision|agree|summar|what/.test(t)) {
      var d = notesFind(st.list, "sync");
      if (d) return { text: "Four decisions and three follow-ups.", card: { type: "summary", bullets: d.summary.concat(d.actions.map(function (a) { return "Next: " + a.t; })), go: { view: "notes", patch: { open: "sync" } } } };
    }
    if (/summar|recap|what did we (decide|say)/.test(t) && /(last|latest|recent)?\s*(recording|meeting|voice note|memo|standup)/.test(t) || (api.active && /what did we decide/.test(t))) {
      var cur = api.active && st.open ? notesFind(st.list, st.open) : null;
      var r = cur && cur.kind === "voice" ? cur : notesLast(st.list);
      if (r) return { text: r.title + ", " + notesFmt(r.dur) + ".", card: { type: "summary", bullets: r.summary.concat(r.actions.map(function (a) { return "Next: " + a.t; })), go: { view: "notes", patch: { open: r.id } } } };
    }
    if (api.active && st.open) {
      var n = notesFind(st.list, st.open);
      if (n && n.kind === "text" && /checklist|to-?do list|make .*list/.test(t)) {
        return { text: "Done. Each line is now a checkbox.", then: function () { notesUpd(api, n.id, function (x) { return { kind: "list", items: String(x.body || "").split("\n").filter(function (l) { return l.trim(); }).map(function (l) { return { t: l.trim(), done: false }; }), body: "" }; }); } };
      }
      if (n && /summar/.test(t) && n.kind !== "voice") {
        var src = n.kind === "list" ? n.items.map(function (i) { return i.t + (i.done ? " (done)" : ""); }) : n.kind === "link" ? n.clips : String(n.body || "").split(/\n|\.\s/).filter(function (l) { return l.trim(); });
        return { text: n.title || "This note", card: { type: "summary", bullets: src.slice(0, 4), title: (n.title || "Note") + " · summary", act: { mod: "notes", fn: "save" } } };
      }
      if (n && n.kind === "voice" && /share|send/.test(t) && /action|follow|item|summary|notes/.test(t)) {
        var pid = null; n.lines.forEach(function (l) { if (!pid && l.s !== "me") pid = l.s; }); var p = api.person(pid) || { name: "Maya Chen" };
        return { text: "Here's a draft to " + p.name.split(" ")[0] + ".", card: { type: "draft", to: p.name, pid: pid, body: "From " + n.title + ": " + n.actions.map(function (a) { return a.t; }).join("; ") + ".", act: { mod: VIEWS.messages && VIEWS.messages.actions && VIEWS.messages.actions.sendDraft ? "messages" : "notes", fn: VIEWS.messages && VIEWS.messages.actions && VIEWS.messages.actions.sendDraft ? "sendDraft" : "sendShare" } } };
      }
    }
    return null;
  },

  render: function (st, api) {
    if (!NT.pend && (st.record || st.compose)) {
      NT.pend = true;
      setTimeout(function () { NT.pend = false; var s = api.get("notes"); if (s.record) notesStartRec(api); else if (s.compose) notesNew(api, "text"); }, 0);
    }
    var list = st.list || [];
    var q = st.q == null ? null : String(st.q).toLowerCase().trim();
    var shown = list.filter(function (n) {
      if (!q) return true;
      var hay = [n.title, n.body, n.domain, (n.items || []).map(function (i) { return i.t; }).join(" "), (n.lines || []).map(function (l) { return l.t; }).join(" "), (n.summary || []).join(" ")].join(" ").toLowerCase();
      return hay.indexOf(q) >= 0;
    });
    shown = shown.filter(function (n) { return n.pinned; }).concat(shown.filter(function (n) { return !n.pinned; }));
    var cards = shown.map(function (n) {
      var items = (n.items || []).slice(0, 5).map(function (i) { return { t: i.t, css: i.done ? "text-decoration: line-through; color: var(--mut)" : "", box: i.done ? "background: var(--fg); box-shadow: none" : "box-shadow: inset 0 0 0 1.5px var(--mut)", done: i.done }; });
      var more = (n.items || []).length - items.length;
      var bars = NOTES_WAVE.slice(0, 22);
      return {
        id: n.id, title: n.title || "Untitled", hasTitle: true, body: n.kind === "text" ? String(n.body || "").slice(0, 180) : "", hasBody: n.kind === "text" && !!String(n.body || "").trim(),
        isList: n.kind === "list", isVoice: n.kind === "voice", isLink: n.kind === "link", items: items, more: more > 0 ? "+" + more : "", hasMore: more > 0,
        bars: bars, dur: n.kind === "voice" ? notesFmt(n.dur) + (n.actions && n.actions.length ? " · " + n.actions.length + " to-dos" : "") : "", domain: n.domain || "",
        pinned: !!n.pinned, open: function () { notesStopTimers(); api.set({ open: n.id, pos: 0, playing: false, sheet: null }); }
      };
    });
    var colL = [], colR = [];
    cards.forEach(function (c, i) { (i % 2 ? colR : colL).push(c); });

    /* open note */
    var n = st.open ? notesFind(list, st.open) : null;
    var isEdit = !!n && (n.kind === "text" || n.kind === "list");
    var ed = null, vo = null, lk = null;
    var common = n ? {
      close: function () { notesClose(api); },
      pinIcon: IC.notesPin, pinCss: n.pinned ? "color: var(--acct)" : "", pinLabel: n.pinned ? "Unpin" : "Pin",
      pin: async function () { if(await notesUpd(api, n.id, { pinned: !n.pinned })!==false) api.toast(n.pinned ? "Unpinned" : "Pinned"); },
      share: function () { api.set({ sheet: "share" }); },
      del: function () { notesDelete(api, n.id); },
      title: n.title || "",
      onTitle: function (e) { notesUpd(api, n.id, { title: e.target.value }); }
    } : null;
    if (isEdit) {
      ed = Object.assign({}, common, {
        isText: n.kind === "text", isList: n.kind === "list",
        body: n.body || "",
        onBody: function (e) { notesUpd(api, n.id, { body: e.target.value }); },
        listCss: n.kind === "list" ? "color: var(--acct)" : "", listLabel: n.kind === "list" ? "Turn into text" : "Turn into checklist",
        toggleList: function () {
          if (n.kind === "text") notesUpd(api, n.id, { kind: "list", body: "", items: String(n.body || "").split("\n").filter(function (l) { return l.trim(); }).map(function (l) { return { t: l.trim(), done: false }; }) });
          else notesUpd(api, n.id, { kind: "text", items: [], body: (n.items || []).map(function (i) { return i.t; }).join("\n") });
        },
        items: (n.items || []).map(function (it, i) {
          return {
            t: it.t, done: it.done, css: it.done ? "text-decoration: line-through; color: var(--mut)" : "",
            box: it.done ? "background: var(--fg); color: var(--bg)" : "box-shadow: inset 0 0 0 1.5px var(--mut); color: transparent",
            label: (it.done ? "Uncheck " : "Check ") + (it.t || "item"),
            toggle: function () { notesUpd(api, n.id, function (x) { return { items: x.items.map(function (y, j) { return j === i ? Object.assign({}, y, { done: !y.done }) : y; }) }; }); },
            onText: function (e) { var v = e.target.value; notesUpd(api, n.id, function (x) { return { items: x.items.map(function (y, j) { return j === i ? Object.assign({}, y, { t: v }) : y; }) }; }); },
            remove: function () { notesUpd(api, n.id, function (x) { return { items: x.items.filter(function (y, j) { return j !== i; }) }; }); }
          };
        }),
        newItem: st.newItem || "",
        onNew: function (e) { api.set({ newItem: e.target.value }); },
        addItem: function () { var v = String(api.get("notes").newItem || "").trim(); if (!v) return; notesUpd(api, n.id, function (x) { return { items: (x.items || []).concat([{ t: v, done: false }]) }; }); api.set({ newItem: "" }); },
        newKey: function (e) { if (e.key === "Enter") { e.preventDefault(); var v = String(api.get("notes").newItem || "").trim(); if (!v) return; notesUpd(api, n.id, function (x) { return { items: (x.items || []).concat([{ t: v, done: false }]) }; }); api.set({ newItem: "" }); } },
        dict: !!st.dict, notDict: !st.dict,
        dictLabel: st.dict ? "Stop dictation" : "Dictate", dictCss: st.dict ? "background: var(--acc); color: #fff" : "",
        dictate: function () {
          if (api.get("notes").dict) { clearInterval(NT.dicI); NT.dicI = null; api.set({ dict: false }); return; }
          var phrase = NOTES_DICT[NT.dIdx++ % NOTES_DICT.length]; var i = 0; var id = n.id;
          api.set({ dict: true });
          clearInterval(NT.dicI);
          NT.dicI = api.every(function () {
            var cur = notesFind(api.get("notes").list, id); if (!cur) { clearInterval(NT.dicI); return; }
            i++;
            var ch = phrase.charAt(i - 1);
            if (cur.kind === "list") {
              var its = (cur.items || []).slice();
              if (i === 1) its.push({ t: ch, done: false }); else { var L = its.length - 1; its[L] = Object.assign({}, its[L], { t: its[L].t + ch }); }
              notesUpd(api, id, { items: its });
            } else {
              var b = String(cur.body || "");
              if (i === 1 && b && !/\s$/.test(b)) b += /[.!?]$/.test(b) ? " " : "\n";
              notesUpd(api, id, { body: b + ch });
            }
            if (i >= phrase.length) { clearInterval(NT.dicI); NT.dicI = null; api.later(function () { api.set({ dict: false }); }, 400); }
          }, 38);
        }
      });
    }
    if (n && n.kind === "voice") {
      var pos = st.pos || 0; var frac = n.dur ? Math.min(1, pos / n.dur) : 0;
      var bars = NOTES_WAVE.map(function (h, i) { return { h: h, c: i / NOTES_WAVE.length < frac ? "var(--acct)" : "var(--s3)" }; });
      var nextIdx = -1; (n.lines || []).forEach(function (l, i) { if (l.at <= pos) nextIdx = i; });
      vo = Object.assign({}, common, {
        meta: n.when + " · " + notesFmt(n.dur), bars: bars,
        time: notesFmt(pos) + " / " + notesFmt(n.dur),
        playIcon: st.playing ? IC.pause : IC.play, playLabel: st.playing ? "Pause" : "Play", playCss: st.playing ? "" : "fill: currentColor",
        play: function () {
          if (api.get("notes").playing) { clearInterval(NT.playI); NT.playI = null; api.set({ playing: false }); return; }
          var start = (api.get("notes").pos || 0) >= n.dur ? 0 : (api.get("notes").pos || 0);
          api.set({ playing: true, pos: start });
          clearInterval(NT.playI);
          NT.playI = api.every(function () {
            var s = api.get("notes"); var p = (s.pos || 0) + 2;
            if (p >= n.dur) { clearInterval(NT.playI); NT.playI = null; api.set({ pos: n.dur, playing: false }); return; }
            api.set({ pos: p });
          }, 250);
        },
        proc: st.proc === n.id, ready: st.proc !== n.id,
        summary: n.summary || [], noSummary: !(n.summary || []).length,
        hasActions: (n.actions || []).length > 0,
        actCount: (n.actions || []).length === 1 ? "1 action item" : (n.actions || []).length + " action items",
        actions: (n.actions || []).map(function (a, i) {
          return { t: a.t, css: a.done ? "text-decoration: line-through; color: var(--mut)" : "", box: a.done ? "background: var(--fg); color: var(--bg)" : "box-shadow: inset 0 0 0 1.5px var(--mut); color: transparent", label: (a.done ? "Uncheck " : "Check ") + a.t,
            toggle: function () { notesUpd(api, n.id, function (x) { return { actions: x.actions.map(function (y, j) { return j === i ? Object.assign({}, y, { done: !y.done }) : y; }) }; }); } };
        }),
        calIcon: n.onCal ? IC.check : IC.cal, calLabel: n.onCal ? "Added to calendar" : "Add action items to calendar", calText: n.onCal ? "On calendar" : "Add to calendar",
        toCal: function () {
          if (n.onCal) return;
          notesUpd(api, n.id, { onCal: true });
          var open = n.actions.filter(function (a) { return !a.done; }).length;
          api.toast(open + (open === 1 ? " action item" : " action items") + " added to Calendar");
        },
        lines: (n.lines || []).map(function (l, i) {
          var p = l.s === "me" ? null : api.person(l.s);
          return { ini: p ? p.ini : "You", who: p ? p.name.split(" ")[0] : "You", t: l.t, at: notesFmt(l.at),
            chip: l.s === "me" ? "background: var(--acc); color: #fff" : "background: var(--s3); color: var(--fg)",
            css: i === nextIdx && pos > 0 ? "color: var(--fg)" : (pos > 0 ? "color: var(--mut)" : ""),
            seek: function () { api.set({ pos: l.at }); } };
        }),
        empty: !(n.lines || []).length
      });
    }
    if (n && n.kind === "link") {
      lk = Object.assign({}, common, {
        clips: n.clips || [], domain: n.domain, when: n.when,
        visit: function () { if (VIEWS.browser) api.open("browser", { url: n.url }); else api.toast("Opening " + n.domain); }
      });
    }

    /* recorder */
    var r = st.rec;
    var rec = null;
    if (r) {
      var cnt = notesLiveCount(r.tick);
      var within = r.tick - NOTES_T0 - (cnt - 1) * NOTES_STEP;
      var lines = NOTES_LIVE.slice(0, cnt).map(function (l, i) {
        var p = l.s === "me" ? null : api.person(l.s);
        var tx = i === cnt - 1 && within < 9 ? l.t.slice(0, Math.max(1, Math.round(l.t.length * (within + 1) / 9))) : l.t;
        return { ini: p ? p.ini : "You", t: tx, chip: l.s === "me" ? "background: var(--acc); color: #fff" : "background: var(--s3); color: var(--fg)", css: i === cnt - 1 ? "" : "color: var(--mut)" };
      }).reverse();
      var lv = r.levels.slice(); while (lv.length < 44) lv.unshift(0.06);
      rec = {
        clock: notesFmt(r.tick / 4), paused: r.paused, live: !r.paused,
        primaryLabel: "Stop and save", primaryIcon: IC.stop,
        clockCss: r.paused ? "opacity: .4" : "",
        levels: lv.map(function (v) { return { h: Math.round(4 + v * 64) }; }),
        lines: lines, dotCss: r.paused ? "background: var(--mut)" : "background: " + NOTES_RED,
        pauseIcon: r.paused ? IC.mic : IC.pause, pauseLabel: r.paused ? "Resume" : "Pause",
        toggle: function () { var s = api.get("notes"); if (s.rec) api.set({ rec: Object.assign({}, s.rec, { paused: !s.rec.paused }) }); },
        stop: function () { notesStopRec(api); },
        discard: function () { notesDiscardRec(api); }
      };
    }

    var shareSheet = st.sheet === "share" && !!n;
    return {
      searching: st.q !== null && st.q !== undefined, notSearching: st.q === null || st.q === undefined,
      q: st.q || "",
      onQ: function (e) { api.set({ q: e.target.value }); },
      search: function () { api.set({ q: "" }); },
      endSearch: function () { api.set({ q: null }); },
      newNote: function () { notesNew(api, "text"); },
      record: function () { notesStartRec(api); },
      colL: colL, colR: colR, none: cards.length === 0,
      emptyText: q ? "No matches" : "No notes yet. Create a note to get started.",
      askQ: "Ask " + api.name + ": “" + String(st.q || "").trim() + "”", hasQ: !!q,
      askSearch: function () { var qq = String(api.get("notes").q || "").trim(); api.set({ q: null }); api.send("Find my notes about " + qq); },
      isEdit: isEdit, ed: ed, isVoice: !!vo, vo: vo, isLink: !!lk, lk: lk,
      recording: !!rec, rec: rec,
      shareSheet: shareSheet,
      closeSheet: function () { api.set({ sheet: null }); },
      shareMsg: function () { notesShare(api, n, "msg"); },
      shareMail: function () { notesShare(api, n, "mail"); }
    };
  }
});

/* ===== module: contacts ===== */
/* Contacts. Holes are {{contacts.*}}. Working copy of people lives in st.list (persisted);
   other apps can read api.get("contacts").list and fall back to PEOPLE. */
IC.contactsGift = IC.contactsGift || "M4 11h16v9H4zM3 8h18v3H3zM12 8v12M12 8c-1.5-3-5-3.5-5-1.5S12 8 12 8zM12 8c1.5-3 5-3.5 5-1.5S12 8 12 8z";
IC.contactsNote = IC.contactsNote || "M5 6h14M5 10h14M5 14h9M5 18h6";

var CT_EXTRA = {
  maya: { address: "1450 Valencia St, San Francisco", birthday: "Mar 14" },
  jordan: { address: "88 Greenwich St, New York", birthday: "Nov 2" },
  priya: { address: "212 Castro St, Mountain View", birthday: "Jul 9" },
  sam: { address: "", birthday: "Jan 27" },
  lena: { address: "31 Bedford Ave, Brooklyn", birthday: "" },
  dad: { address: "2210 NE Alberta St, Portland", birthday: "Oct 11" }
};
var CT_MORE = [
  { id: "ana", first: "Ana", last: "Torres", phone: "(415) 555-0171", email: "ana@torres.example", address: "", birthday: "May 3", note: "Climbing partner", fav: false },
  { id: "ben", first: "Ben", last: "Adler", phone: "(415) 555-0163", email: "ben@adler.example", address: "", birthday: "", note: "Accountant", fav: false },
  { id: "kenji", first: "Kenji", last: "Sato", phone: "(206) 555-0148", email: "kenji@sato.example", address: "", birthday: "Dec 5", note: "", fav: false },
  { id: "olivia", first: "Olivia", last: "Brooks", phone: "(415) 555-0126", email: "olivia@brooks.example", address: "77 Dolores St, San Francisco", birthday: "", note: "Landlord", fav: false }
];
function ctIni(first, last) { var s = ((first || "").charAt(0) + (last || "").charAt(0)).toUpperCase(); return s || "#"; }
function ctMake(p) { var name = ((p.first || "") + " " + (p.last || "")).trim(); return Object.assign({}, p, { name: name || p.phone || "No name", ini: ctIni(p.first, p.last) }); }
var CT_SEED = PEOPLE.map(function (p) {
  var parts = p.name.split(" ");
  return Object.assign({}, p, { first: parts[0], last: parts.slice(1).join(" "), address: "", birthday: "" }, CT_EXTRA[p.id] || {});
}).concat(CT_MORE.map(ctMake));

var CT_FIELDS = ["first", "last", "phone", "email", "address", "birthday", "note"];
function ctList(api) { return api.get("contacts").list || CT_SEED; }
function ctGet(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
function ctFind(t, list) {
  var best = null, len = 0;
  list.forEach(function (p) {
    [p.id, (p.name || "").toLowerCase(), (p.first || "").toLowerCase(), (p.last || "").toLowerCase()].forEach(function (n) {
      if (!n || n.length < 2) return;
      var re = new RegExp("\\b" + n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?:'s)?\\b");
      if (re.test(t) && n.length > len) { best = p; len = n.length; }
    });
  });
  return best;
}
function ctForm(s, list) {
  if (s.form) return s.form;
  var f = {}; CT_FIELDS.forEach(function (k) { f[k] = ""; });
  var p = s.edit ? ctGet(list, s.edit) : null;
  if (p) CT_FIELDS.forEach(function (k) { f[k] = p[k] || ""; });
  if (s.add && typeof s.add === "object") CT_FIELDS.forEach(function (k) { if (s.add[k]) f[k] = s.add[k]; });
  return f;
}
function ctBday(b, now) {
  if (!b) return "";
  var m = MONS.map(function (x) { return x.slice(0, 3).toLowerCase(); }).indexOf(b.slice(0, 3).toLowerCase());
  var d = parseInt(b.replace(/\D/g, ""), 10);
  if (m < 0 || !d) return b;
  var n = new Date(now); var next = new Date(n.getFullYear(), m, d);
  var today = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  if (next < today) next = new Date(n.getFullYear() + 1, m, d);
  var days = Math.round((next - today) / 864e5);
  return MONS[m] + " " + d + (days === 0 ? " · today" : days <= 30 ? " · in " + days + (days === 1 ? " day" : " days") : "");
}
function ctLastCall(api, id) {
  var ph = api.get("phone"); var r = (ph.recents || []).filter(function (e) { return e.pid === id; })[0];
  return r || null;
}
function ctContext(api, p) {
  var bits = [];
  var r = ctLastCall(api, p.id);
  var now = api.now.getTime();
  if (r && typeof pnRel === "function") bits.push((r.dir === "missed" ? "Missed call " : "Last call ") + pnRel(pnAt(r, now), now).replace(/^(\d)/, "at $1").replace(/^Yesterday/, "yesterday"));
  if (r && r.note) bits.push(r.note);
  var vm = (api.get("phone").vms || []).filter(function (v) { return v.pid === p.id && !v.heard; })[0];
  if (vm) bits.push("Left a voicemail: " + (vm.gist || "listen in Phone"));
  if (!bits.length && p.note) bits.push(p.note);
  var out = bits.join(". ").replace(/\.\./g, ".");
  return out && !/[.!?]$/.test(out) ? out + "." : out;
}
function ctSave(api) {
  var s = api.get("contacts"); var l = s.list || CT_SEED; var f = ctForm(s, l);
  var clean = {}; CT_FIELDS.forEach(function (k) { clean[k] = String(f[k] || "").trim(); });
  if (!clean.first && !clean.last && !clean.phone) { api.toast("Add a name or number"); return false; }
  if (clean.phone && typeof pnFmt === "function" && clean.phone.replace(/\D/g, "").length === 10) clean.phone = pnFmt(clean.phone);
  if (s.edit) {
    api.set({ list: l.map(function (x) { return x.id === s.edit ? ctMake(Object.assign({}, x, clean)) : x; }), edit: null, add: null, form: null, open: s.edit });
  } else {
    var np = ctMake(Object.assign({ id: "contact-" + crypto.randomUUID(), fav: false }, clean));
    api.set({ list: l.concat([np]), edit: null, add: null, form: null, open: np.id, q: "" });
  }
  api.toast("Saved");
  return true;
}
function ctDeleted(api, p, idx) {
  var restore = function () {
    var l = ctList(api).slice();
    if (!ctGet(l, p.id)) l.splice(idx < 0 ? l.length : Math.min(idx, l.length), 0, p);
    try { api.setView("contacts", { list: l }); }
    catch (error) { api.toast("Contact could not be restored. Try Undo again.", { undo: restore }); return; }
    if (api.isActive()) api.setView("contacts", { open: p.id });
  };
  api.toast(p.name + " deleted", { undo: restore });
}

registerView("contacts", {
  title: "Contacts", icon: "user", aliases: ["people", "address book"],
  state: { list: CT_SEED, q: "", searching: false, open: null, edit: null, add: null, form: null },
  persist: ["list"],
  jumps: [[null, "Contacts"], ["detail", "Contact"], ["edit", "Edit contact"]],
  preset: function (sub) {
    if (sub === "detail") return { open: "maya" };
    if (sub === "edit") return { open: "jordan", edit: "jordan" };
  },
  back: function (st, api) {
    if (st.edit || st.add) { api.set({ edit: null, add: null, form: null, open: st.edit || st.open }); return true; }
    if (st.open) { api.set({ open: null }); return true; }
    if (st.searching || st.q) { api.set({ q: "", searching: false }); return true; }
    return false;
  },
  suggestions: function (st, api) {
    var p = st.open ? ctGet(st.list || CT_SEED, st.open) : null;
    if (st.edit || st.add) return ["Save it", "Discard changes"];
    if (p) return ["Catch me up on " + p.first, "Text " + p.first, "Edit " + p.first + "'s email"];
    return ["What's Maya's number?", "Add a contact Alex Kim 415 555 0100", "When is Dad's birthday?"];
  },
  voicePhrase: "What's Maya's number?",
  reply: function (t, raw, api) {
    var st = api.st; var list = ctList(api);
    if (api.active && (st.edit || st.add)) {
      if (/^(save|done|save it|looks good)\b/.test(t)) return { text: "Saved.", then: function () { ctSave(api); } };
      if (/^(discard|cancel|never ?mind)\b/.test(t)) return { text: "Discarded.", then: function () { var s = api.get("contacts"); api.set({ edit: null, add: null, form: null, open: s.edit || s.open }); } };
    }
    /* add */
    if (/\b(add|new|save|create)\b.*\bcontact\b|\bsave\b.*\bnumber\b/.test(t)) {
      var em = (raw.match(/[\w.+-]+@[\w-]+\.[\w.]+/) || [""])[0];
      var ph = (raw.replace(em, "").match(/\+?\d[\d\s().-]{5,}\d/) || [""])[0];
      var name = raw.replace(em, "").replace(ph, "").replace(/^.*?\bcontact\b\s*(for|named|called)?\s*/i, "").replace(/\b(with|number|phone|email|at|and)\b/gi, " ").replace(/[^A-Za-z' -]/g, " ").replace(/\s+/g, " ").trim();
      if (!name && !ph) return { text: "Opening a new contact.", nav: { view: "contacts", patch: { add: true, open: null } } };
      var parts = name.split(" ").filter(Boolean).map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); });
      var np = ctMake({ id: "contact-" + crypto.randomUUID(), first: parts[0] || "", last: parts.slice(1).join(" "), phone: ph && typeof pnFmt === "function" ? pnFmt(ph) : ph.trim(), email: em, address: "", birthday: "", note: "", fav: false });
      return { text: "Saved " + np.name + ".", card: { type: "generic", icon: "user", title: np.name, sub: np.phone || np.email || "No number yet", go: { view: "contacts", patch: { open: np.id } } },
        then: function () { api.setView("contacts", { list: ctList(api).concat([np]) }); } };
    }
    var p = ctFind(t, list);
    if (!p) return null;
    var f = p.first || p.name;
    /* edits */
    var ed = t.match(/\b(edit|change|update|set|fix)\b.*?\b(email|e-mail|number|phone|address|birthday|note)\b/);
    if (ed) {
      var field = /mail/.test(ed[2]) ? "email" : /number|phone/.test(ed[2]) ? "phone" : ed[2];
      var to = raw.match(/\bto\s+(.+)$/i);
      if (to && ed[1] !== "edit") {
        var val = to[1].trim().replace(/[.]$/, ""); if (field === "phone" && typeof pnFmt === "function") val = pnFmt(val);
        return { text: "Updated " + f + "'s " + (field === "phone" ? "number" : field) + ".", card: { type: "generic", icon: field === "email" ? "mail" : field === "phone" ? "phone" : field === "address" ? "pin" : "user", title: p.name, sub: val, go: { view: "contacts", patch: { open: p.id } } },
          then: function () { api.setView("contacts", { list: ctList(api).map(function (x) { if (x.id !== p.id) return x; var y = Object.assign({}, x); y[field] = val; return y; }) }); } };
      }
      return { text: "Here's " + f + ".", nav: { view: "contacts", patch: { open: p.id, edit: p.id, form: null } } };
    }
    if (/\b(delete|remove)\b.*\bcontact|\b(delete|remove)\b.*\bfrom (my )?contacts/.test(t)) {
      return { text: "Removed " + p.name + ". Undo from Contacts.", then: function () {
        var l = ctList(api); var idx = l.indexOf(ctGet(l, p.id));
        api.setView("contacts", { list: l.filter(function (x) { return x.id !== p.id; }), open: null });
        ctDeleted(api, p, idx);
      } };
    }
    var card = function (icon, sub) { return { type: "generic", icon: icon, title: p.name, sub: sub, go: { view: "contacts", patch: { open: p.id } } }; };
    if (/\b(number|phone number|cell|mobile)\b/.test(t) && !/\b(call|dial)\b/.test(t)) return p.phone ? { text: f + "'s number is " + p.phone + ".", card: card("phone", p.phone) } : { text: "I don't have a number for " + f + ".", nav: { view: "contacts", patch: { open: p.id, edit: p.id } } };
    if (/\b(email|e-mail) (address)?\b/.test(t) && /\bwhat|'s email|email for|email address\b/.test(t)) return p.email ? { text: f + "'s email is " + p.email + ".", card: card("mail", p.email) } : { text: "No email for " + f + " yet." };
    if (/\baddress\b|where does .* live|where .* lives/.test(t)) return p.address ? { text: f + " lives at " + p.address + ".", card: { type: "generic", icon: "pin", title: p.name, sub: p.address, go: { view: "maps", patch: { query: p.address } } } } : { text: "I don't have an address for " + f + "." };
    if (/\bbirthday\b/.test(t)) { var b = ctBday(p.birthday, api.now.getTime()); return b ? { text: f + "'s birthday is " + b.replace(" · ", ", ") + ".", card: card("contactsGift", b) } : { text: "No birthday saved for " + f + "." }; }
    if (/catch me up on|what's new with|tell me about|who is\b/.test(t)) {
      var ctx = ctContext(api, p);
      return { text: (p.note && ctx.indexOf(p.note) < 0 ? p.note + ". " : "") + (ctx || "Nothing new from " + f + ".") , card: card("user", p.phone || p.email) };
    }
    return null;
  },
  render: function (st, api) {
    var list = st.list || CT_SEED;
    var now = api.now.getTime();
    var q = (st.q || "").trim().toLowerCase(); var qd = q.replace(/\D/g, "");
    var hits = list.filter(function (p) {
      if (!q) return true;
      if ((p.name + " " + (p.email || "") + " " + (p.note || "")).toLowerCase().indexOf(q) >= 0) return true;
      return qd.length >= 3 && String(p.phone || "").replace(/\D/g, "").indexOf(qd) >= 0;
    }).slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
    var groups = []; var cur = null;
    hits.forEach(function (p) {
      var L = /[a-z]/i.test(p.name.charAt(0)) ? p.name.charAt(0).toUpperCase() : "#";
      if (!cur || cur.letter !== L) { cur = { letter: L, rows: [] }; groups.push(cur); }
      cur.rows.push({ ini: p.ini, name: p.name, open: function () { api.set({ open: p.id }); } });
    });
    var favs = (q || st.searching) ? [] : list.filter(function (p) { return p.fav; }).map(function (p) { return { ini: p.ini, first: p.first || p.name, label: p.name, open: function () { api.set({ open: p.id }); } }; });

    var p = st.open ? ctGet(list, st.open) : null;
    var d = null;
    if (p) {
      var acts = [];
      if (p.phone) acts.push({ d: IC.phone, label: "Call " + p.name, go: function () { api.open("phone", { call: p.id, ret: { view: "contacts", patch: { open: p.id } } }); } });
      if (p.phone) acts.push({ d: IC.bubble, label: "Message " + p.name, go: function () { api.open("messages", { thread: p.id }); } });
      if (p.email) acts.push({ d: IC.mail, label: "Email " + p.name, go: function () { api.open("inbox", { compose: { to: p.id } }); } });
      if (p.address) acts.push({ d: IC.pin, label: "Directions to " + p.name, go: function () { api.open("maps", { query: p.address }); } });
      var fields = [];
      if (p.phone) fields.push({ d: IC.phone, v: p.phone });
      if (p.email) fields.push({ d: IC.mail, v: p.email });
      if (p.address) fields.push({ d: IC.pin, v: p.address });
      if (p.birthday) fields.push({ d: IC.contactsGift, v: ctBday(p.birthday, now) });
      if (p.note) fields.push({ d: IC.contactsNote, v: p.note });
      var ctx = ctContext(api, p);
      d = {
        ini: p.ini, name: p.name, acts: acts, hasActs: acts.length > 0, fields: fields, hasFields: fields.length > 0,
        ctx: ctx, hasCtx: !!ctx && ctx !== p.note,
        ask: function () { api.send("Catch me up on " + (p.first || p.name)); },
        fav: !!p.fav, favLabel: p.fav ? "Remove from favorites" : "Add to favorites", favCss: p.fav ? "color: var(--acct); fill: currentColor" : "",
        toggleFav: function () { api.set({ list: api.get("contacts").list.map(function (x) { return x.id === p.id ? Object.assign({}, x, { fav: !x.fav }) : x; }) }); },
        edit: function () { api.set({ edit: p.id, form: null }); },
        del: function () {
          var l = api.get("contacts").list; var idx = l.indexOf(ctGet(l, p.id));
          api.set({ list: l.filter(function (x) { return x.id !== p.id; }), open: null });
          ctDeleted(api, p, idx);
        },
        close: function () { api.set({ open: null }); }
      };
    }

    var editing = !!(st.edit || st.add);
    var form = editing ? ctForm(st, list) : null;
    var input = function (k, ph, icon, type) {
      return { k: k, ph: ph, d: icon, hasIcon: !!icon, type: type || "text", v: form[k] || "",
        change: function (e) { var s = api.get("contacts"); var f = Object.assign({}, ctForm(s, s.list || CT_SEED)); f[k] = e.target.value; api.set({ form: f }); } };
    };
    var canSave = editing && !!(form.first.trim() || form.last.trim() || form.phone.trim());
    return {
      q: st.q || "", hasQ: !!q, qRaw: (st.q || "").trim(),
      searching: !!st.searching, notSearching: !st.searching,
      openSearch: function () { api.set({ searching: true }); },
      closeSearch: function () { api.set({ searching: false, q: "" }); },
      searchRef: function (el) { if (el && document.activeElement !== el && !el.dataset.f) { el.dataset.f = "1"; try { el.focus(); } catch (e) {} } },
      onQ: function (e) { api.set({ q: e.target.value }); },
      askQ: function () { api.send((api.get("contacts").q || "").trim()); },
      favs: favs, hasFavs: favs.length > 0, groups: groups, noHits: hits.length === 0 && !!q,
      addNew: function () { var s0 = api.get("contacts"); var qq = s0.searching ? (s0.q || "").trim() : ""; api.set({ add: !qq ? true : (/\d{3}/.test(qq) ? { phone: qq } : { first: qq.charAt(0).toUpperCase() + qq.slice(1) }), form: null, q: "", searching: false }); },
      detail: !!d, d: d,
      editing: editing,
      eIni: form ? ctIni(form.first, form.last) : "", eHasIni: !!form && ctIni(form.first, form.last) !== "#", eNoIni: !!form && ctIni(form.first, form.last) === "#",
      nameInputs: form ? [input("first", "First name", IC.user), input("last", "Last name", "")] : [],
      inputs: form ? [input("phone", "Phone", IC.phone, "tel"), input("email", "Email", IC.mail, "email"), input("address", "Address", IC.pin), input("birthday", "Birthday", IC.contactsGift), input("note", "Note", IC.contactsNote)] : [],
      saveCss: canSave ? "background: var(--acc); color: #fff" : "background: var(--s2); color: var(--mut)", canSave: canSave, cantSave: !canSave,
      cancelEdit: function () { var s = api.get("contacts"); api.set({ edit: null, add: null, form: null, open: s.edit || s.open }); },
      save: function () { ctSave(api); }
    };
  }
});

/* ===== module: files ===== */
/* Files: locations, folders, preview, rename/move/share/delete, select mode, Ask Alpha. Holes are {{files.*}}. */
IC.filesDown = IC.filesDown || "M12 4v11M7 10l5 5 5-5M5 20h14";
IC.filesReceipt = IC.filesReceipt || "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3";
IC.filesPdf = IC.filesPdf || "M6 3h9l4 4v14H6zM14 3v5h5M9 12h6v5H9z";
IC.filesDoc = IC.filesDoc || "M6 3h9l4 4v14H6zM14 3v5h5";
IC.filesSort = IC.filesSort || "M7 4v16M4 17l3 3 3-3M13 6h8M13 12h6M13 18h4";
IC.filesRows = IC.filesRows || "M4 6h16M4 12h16M4 18h16";
IC.filesSelect = IC.filesSelect || "M21 12a9 9 0 1 1-18 0a9 9 0 1 1 18 0zM8 12l3 3 5-6";
IC.filesMove = IC.filesMove || "M3 6h6l2 2h10v11H3zM10 13.5h6M13.5 11l2.5 2.5-2.5 2.5";
IC.filesDisk = IC.filesDisk || "M4 5h16v14H4zM4 15h16M16 17.5h.01";
IC.filesZip = IC.filesZip || "M6 3h12v18H6zM12 3v2M12 7v2M12 11v2M10.5 15h3v3h-3z";

var FILES_FOLDERS = [
  { id: "Downloads", icon: "filesDown" },
  { id: "Documents", icon: "folder" },
  { id: "Receipts", icon: "filesReceipt" },
  { id: "Recordings", icon: "wave" },
  { id: "Northpoint", icon: "folder", parent: "Documents" }
];
var FILES_TYPES = {
  pdf: { label: "PDF", icon: "filesPdf" },
  doc: { label: "Document", icon: "notes" },
  image: { label: "Image", icon: "photo" },
  audio: { label: "Audio", icon: "wave" },
  archive: { label: "Archive", icon: "filesZip" }
};
var FILES_SEED = [
  { id: "tartine", name: "Tartine receipt.jpg", type: "image", folder: "Receipts", size: "1.8 MB", when: "Today", scan: "receipt",
    receipt: { shop: "TARTINE", rows: [["Morning bun", "5.25"], ["Country loaf", "14.00"], ["Cappuccino x2", "11.50"], ["Tip", "7.75"]], total: "38.50" },
    sum: ["Tartine Bakery, today at 1:48 PM", "Total $38.50, paid with the Visa ending 4417", "Filed under Meals for the September report"] },
  { id: "termsheet", name: "Northpoint_TermSheet_v3.pdf", type: "pdf", folder: "Downloads", size: "212 KB", when: "Today", from: "jordan",
    heading: "Summary of Terms", rows: [["Issuer", "Alpha Compute, Inc."], ["Security", "Series A Preferred"], ["Amount", "$8,000,000"], ["Pre-money", "$32,000,000"], ["Liquidation", "1x, non-participating"], ["Board", "2 common · 1 investor · 1 independent"], ["No-shop", "30 days"]], pages: 4,
    sum: ["$8M Series A at a $32M pre-money, led by Northpoint", "1x non-participating liquidation preference", "Board of four: two common, one investor, one independent", "30-day no-shop; changed from v2: option pool now 12%"] },
  { id: "designnotes", name: "Design review notes.pdf", type: "pdf", folder: "Documents", size: "1.1 MB", when: "Today",
    heading: "Design review", rows: [["Date", "Today, 3:00 PM"], ["With", "Maya, Jordan, Sam, Lena"], ["Scope", "Lock screen, chat, Notes"]], pages: 2,
    sum: ["Review of lock screen, chat heights and the new Notes recorder", "Open question: how vague should locked voice answers be", "Maya to bring the prototype"] },
  { id: "memo", name: "Voice memo · landlord.m4a", type: "audio", folder: "Recordings", size: "2.4 MB", when: "Yesterday", dur: 72,
    sum: ["Reminder to call the landlord on Friday", "Bedroom radiator clanks at night", "Ask about the lease renewal date"] },
  { id: "equinox", name: "Equinox · September.pdf", type: "pdf", folder: "Receipts", size: "96 KB", when: "Sep 26",
    heading: "Equinox SoMa", rows: [["Membership", "September"], ["Amount", "$215.00"], ["Card", "Visa · 4417"]], pages: 1,
    sum: ["Equinox SoMa membership for September", "$215.00 charged to the Visa ending 4417", "Renews October 26"] },
  { id: "proto", name: "Prototype v7.zip", type: "archive", folder: "Downloads", size: "48 MB", when: "Sep 25",
    contents: ["Main.dc.html", "shell.js", "modules/", "assets/", "README.md"],
    sum: ["Prototype build 7 from Maya", "5 items, mostly the shell and app modules", "Newer than the build on your home screen"] },
  { id: "roadmap", name: "Q4 roadmap.docx", type: "doc", folder: "Documents", size: "220 KB", when: "Sep 24",
    heading: "Q4 roadmap", rows: [["October", "Notes, Files, Wallet"], ["November", "Workflows beta"], ["December", "Enclave launch"]], pages: 3,
    sum: ["Three launches: apps in October, Workflows in November, Enclave in December", "Hiring two on-device ML engineers", "Risk: model size on older phones"] },
  { id: "boarding", name: "Boarding pass SFO–JFK.pdf", type: "pdf", folder: "Downloads", size: "180 KB", when: "Sep 20",
    heading: "Boarding pass", rows: [["Flight", "UA 1542"], ["Date", "Oct 9 · 7:05 AM"], ["Seat", "14A"], ["Gate", "F12"]], pages: 1,
    sum: ["UA 1542, SFO to JFK, Oct 9 at 7:05 AM", "Seat 14A, gate F12, boarding 6:25", "Already in your calendar"] },
  { id: "deck", name: "Series A deck v12.pdf", type: "pdf", folder: "Northpoint", size: "6.2 MB", when: "Sep 18",
    heading: "Alpha Compute", rows: [["Slides", "18"], ["For", "Northpoint partners"]], pages: 18,
    sum: ["18 slides: problem, device, agent, traction, raise", "Ask: $8M Series A", "Traction slide still shows August numbers"] },
  { id: "sideletter", name: "Side letter draft.docx", type: "doc", folder: "Northpoint", size: "64 KB", when: "Sep 17",
    heading: "Side letter", rows: [["Parties", "Northpoint, Alpha Compute"], ["Status", "Draft"]], pages: 2,
    sum: ["Information rights for Northpoint", "Pro-rata in the next round", "Still a draft; not signed"] },
  { id: "img2041", name: "IMG_2041.jpg", type: "image", folder: "Downloads", size: "3.1 MB", when: "Sep 14", scan: "photo",
    sum: ["Photo of Ocean Beach at sunset", "Taken Sep 14 at 7:12 PM", "Also in Photos"] }
];
var FL = { undoT: null, playI: null };

function filesFind(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
function filesSplit(name) { var i = name.lastIndexOf("."); return i > 0 ? [name.slice(0, i), name.slice(i)] : [name, ""]; }
function filesUndoable(api, entries, label) {
  api.toast(label, { undo: function () {
    var l = api.get("files").files.slice();
    entries.slice().sort(function (a, b) { return a.idx - b.idx; }).forEach(function (e) { if (!filesFind(l, e.f.id)) l.splice(Math.min(e.idx, l.length), 0, e.f); });
    api.set({ files: l });
  } });
}
function filesNorm(x) { return String(x || "").toLowerCase().replace(/[^a-z0-9]+/g, ""); }
function filesRemove(api, ids) {
  var s = api.get("files"); var entries = [];
  s.files.forEach(function (f, i) { if (ids.indexOf(f.id) >= 0) entries.push({ f: f, idx: i }); });
  clearInterval(FL.playI);
  api.set({ files: s.files.filter(function (f) { return ids.indexOf(f.id) < 0; }), open: null, sel: null, sheet: null, renaming: false, playing: false });
  filesUndoable(api, entries, entries.length === 1 ? entries[0].f.name + " deleted" : entries.length + " files deleted");
}
function filesShare(api, ids, via) {
  var s = api.get("files"); var fs = s.files.filter(function (f) { return ids.indexOf(f.id) >= 0; });
  var names = fs.map(function (f) { return f.name; });
  var to = fs.length === 1 && fs[0].from ? fs[0].from : null;
  api.set({ sheet: null, sel: null });
  if (via === "mail" && VIEWS.inbox) return api.open("inbox", { compose: { to: to, subject: names.length === 1 ? filesSplit(names[0])[0] : names.length + " files", body: "Attached: " + names.join(", "), attach: ids } });
  if (via === "msg" && VIEWS.messages) return api.open("messages", { compose: to || true, text: names.join(", "), attach: ids });
  api.toast("Ready to share");
}
function filesCount(list, folder) { return list.filter(function (f) { return f.folder === folder; }).length + FILES_FOLDERS.filter(function (d) { return d.parent === folder; }).length; }

registerView("files", {
  title: "Files", icon: "folder", aliases: ["downloads", "documents", "file"],
  chat: "hidden",
  state: { files: FILES_SEED, folder: null, open: null, grid: false, sort: "recent", sel: null, sheet: null, renaming: false, rn: "", q: null, menu: false, asked: {}, asking: null, playing: false, pos: 0 },
  persist: ["files", "grid", "sort"],
  jumps: [[null, "Files"], ["folder", "Folder"], ["preview", "File preview"]],
  preset: function (sub) {
    if (sub === "folder") return { folder: "Downloads" };
    if (sub === "preview") return { folder: "Downloads", open: "termsheet" };
  },
  immersive: function (st) { return st.sheet ? { noPill: true } : null; },
  back: function (st, api) {
    if (st.sheet) { api.set({ sheet: null }); return true; }
    if (st.menu) { api.set({ menu: false }); return true; }
    if (st.renaming) { api.set({ renaming: false }); return true; }
    if (st.open) { clearInterval(FL.playI); api.set({ open: null, playing: false, pos: 0 }); return true; }
    if (st.sel) { api.set({ sel: null }); return true; }
    if (st.folder) { var d = null; FILES_FOLDERS.forEach(function (x) { if (x.id === st.folder) d = x; }); api.set({ folder: d && d.parent ? d.parent : null }); return true; }
    if (st.q !== null && st.q !== undefined) { api.set({ q: null }); return true; }
    return false;
  },
  onLeave: function () { clearInterval(FL.playI); },
  suggestions: function (st) {
    if (st.open) return ["Summarize this file", "Send this to Jordan"];
    if (st.folder === "Receipts") return ["Total my receipts this month", "Find the term sheet"];
    return ["Find the term sheet", "Show my receipts", "What's taking up space?"];
  },
  voicePhrase: "Find the term sheet",
  reply: function (t, raw, api) {
    var st = api.get("files");
    var cur = api.active && st.open ? filesFind(st.files, st.open) : null;
    if (/term ?sheet/.test(t) && /\b(find|where|open|show|pull up|get)\b/.test(t) && !/summar/.test(t)) {
      var ts = filesFind(st.files, "termsheet");
      if (ts) return { text: "In " + ts.folder + ", from Jordan's email this afternoon.", card: { type: "generic", icon: "filesDoc", title: ts.name, sub: ts.folder + " · " + ts.size, go: { view: "files", patch: { open: "termsheet" } } }, nav: { view: "files", patch: { open: "termsheet" } } };
    }
    var ff = raw.match(/^\s*(?:find|where(?:'s| is))\s+(?:the\s+|my\s+)?(?:file\s+)?(.+?)\s*(?:file)?\??$/i);
    if (ff && !/\bnotes?\b/i.test(raw)) {
      var nq = filesNorm(ff[1].replace(/^(named|called)\s+/i, ""));
      var hit = nq.length > 2 ? st.files.filter(function (x) { return filesNorm(x.name).indexOf(nq) >= 0 || nq.indexOf(filesNorm(filesSplit(x.name)[0])) >= 0; })[0] : null;
      if (hit) return { text: "In " + hit.folder + ".", card: { type: "generic", icon: "filesDoc", title: hit.name, sub: hit.folder + " · " + hit.size, go: { view: "files", patch: { open: hit.id } } }, nav: { view: "files", patch: { open: hit.id, q: null } } };
    }
    if (/receipts?/.test(t) && /\b(show|find|open|my|where|total)\b/.test(t)) {
      var rs = st.files.filter(function (f) { return f.folder === "Receipts"; });
      return { text: /total/.test(t) ? "$253.50 across " + rs.length + " receipts this month." : rs.length + " receipts: Tartine $38.50 and Equinox $215.00.", card: { type: "generic", icon: "filesReceipt", title: "Receipts", sub: rs.length + " files · $253.50", go: { view: "files", patch: { folder: "Receipts" } } }, nav: { view: "files", patch: { folder: "Receipts", open: null } } };
    }
    if (/summar|what'?s in|tl;?dr|key points/.test(t) && (cur || /\b(pdf|file|document|doc|term sheet|receipt)\b/.test(t))) {
      var f = cur || (/receipt/.test(t) ? filesFind(st.files, "tartine") : /term sheet/.test(t) || /pdf/.test(t) ? filesFind(st.files, "termsheet") : null);
      if (f && f.sum) return { text: f.name, card: { type: "summary", title: filesSplit(f.name)[0] + " · summary", bullets: f.sum, act: VIEWS.notes ? { mod: "notes", fn: "save" } : null },
        then: function () { var a = Object.assign({}, api.get("files").asked); a[f.id] = true; api.set({ asked: a }); } };
    }
    if (/taking up space|storage|free up/.test(t)) {
      return { text: "38 GB used of 256. Biggest: Prototype v7.zip at 48 MB and 12 GB of video in Photos.", card: { type: "generic", icon: "filesDisk", title: "218 GB free", sub: "Prototype v7.zip · 48 MB", go: { view: "files", patch: { folder: "Downloads" } } } };
    }
    if (cur && /send (this|it)|share (this|it)/.test(t)) {
      var pid = /jordan/.test(t) ? "jordan" : /maya/.test(t) ? "maya" : /priya/.test(t) ? "priya" : cur.from || "jordan";
      var p = api.person(pid);
      return { text: "Draft to " + p.name.split(" ")[0] + " with " + cur.name + " attached.", card: { type: "draft", to: p.name, pid: pid, body: "Here's " + filesSplit(cur.name)[0] + ". Let me know if anything's off.", act: VIEWS.messages && VIEWS.messages.actions && VIEWS.messages.actions.sendDraft ? { mod: "messages", fn: "sendDraft" } : null } };
    }
    return null;
  },

  render: function (st, api) {
    var files = st.files || [];
    var sel = st.sel;
    var isSel = !!sel;
    function row(f) {
      var ty = FILES_TYPES[f.type] || FILES_TYPES.pdf;
      var on = isSel && sel.indexOf(f.id) >= 0;
      return {
        id: f.id, name: f.name, sub: (f.type === "pdf" ? "PDF" : ty.label) + " · " + f.size + " · " + f.when,
        chip: "", d: IC[ty.icon], isFile: true, isFolder: false,
        selOn: on, selOff: isSel && !on, rowCss: on ? "background: var(--s2)" : "",
        label: isSel ? ((on ? "Deselect " : "Select ") + f.name) : "Open " + f.name,
        tap: function () {
          if (isSel) { var cur = api.get("files").sel || []; api.set({ sel: cur.indexOf(f.id) >= 0 ? cur.filter(function (x) { return x !== f.id; }) : cur.concat([f.id]) }); return; }
          clearInterval(FL.playI); api.set({ open: f.id, renaming: false, playing: false, pos: 0 });
        }
      };
    }
    function folderRow(d) {
      var n = filesCount(files, d.id);
      return { id: d.id, name: d.id, sub: n === 1 ? "1 item" : n + " items", chip: "", d: IC[d.icon] || IC.folder, isFile: false, isFolder: true, selOn: false, selOff: false, rowCss: isSel ? "opacity: .4" : "",
        label: "Open " + d.id, tap: function () { if (isSel) return; api.set({ folder: d.id }); } };
    }
    function sorted(arr) {
      if (st.sort === "name") return arr.slice().sort(function (a, b) { return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1; });
      return arr;
    }

    /* top level */
    var locs = FILES_FOLDERS.filter(function (d) { return !d.parent; }).map(function (d) {
      var n = filesCount(files, d.id);
      return { name: d.id, d: IC[d.icon], sub: n === 1 ? "1 item" : n + " items", go: function () { api.set({ folder: d.id, q: null }); } };
    });
    locs.push({ name: "Photos", d: IC.photo, sub: "2,184", go: function () { if (VIEWS.photos) api.open("photos"); else api.toast("Opening Photos"); } });
    var q = st.q == null ? null : String(st.q).toLowerCase().trim();
    var results = q ? files.filter(function (f) { return filesNorm(f.name + " " + f.folder + " " + (FILES_TYPES[f.type] || {}).label).indexOf(filesNorm(q)) >= 0; }).map(row) : [];

    /* folder */
    var fd = null;
    if (st.folder) {
      var subs = FILES_FOLDERS.filter(function (d) { return d.parent === st.folder; }).map(folderRow);
      var items = subs.concat(sorted(files.filter(function (f) { return f.folder === st.folder; })).map(row));
      fd = {
        name: st.folder, items: items, empty: items.length === 0,
        close: function () { var d = null; FILES_FOLDERS.forEach(function (x) { if (x.id === st.folder) d = x; }); api.set({ folder: d && d.parent ? d.parent : null, sel: null }); },
        viewIcon: st.grid ? IC.filesRows : IC.grid, viewLabel: st.grid ? "Show as list" : "Show as grid",
        toggleView: function () { api.set({ grid: !st.grid }); },
        openMenu: function () { api.set({ menu: true }); },
        menuRows: [["list", IC.filesRows, "List", !st.grid, { grid: false }], ["grid", IC.grid, "Grid", !!st.grid, { grid: true }], ["recent", IC.clock, "Newest first", st.sort !== "name", { sort: "recent" }], ["name", IC.filesSort, "Name", st.sort === "name", { sort: "name" }]].map(function (m) {
          return { label: m[2], d: m[1], on: m[3], go: function () { api.set(Object.assign({ menu: false }, m[4])); } };
        }),
        sortLabel: st.sort === "name" ? "Sort by date" : "Sort by name", sortCss: st.sort === "name" ? "color: var(--acct)" : "",
        toggleSort: function () { var nx = st.sort === "name" ? "recent" : "name"; api.set({ sort: nx }); api.toast(nx === "name" ? "Sorted by name" : "Sorted by date"); },
        select: function () { api.set({ sel: [] }); }
      };
    }
    var selCount = isSel ? sel.length : 0;

    /* preview */
    var f = st.open ? filesFind(files, st.open) : null;
    var pv = null;
    if (f) {
      var ty = FILES_TYPES[f.type] || FILES_TYPES.pdf;
      var parts = filesSplit(f.name);
      var paper = api.theme === "dark" ? "#E9E9E9" : "#FFFFFF";
      var pages = [];
      if (f.type === "pdf" || f.type === "doc") {
        for (var p = 0; p < Math.min(f.pages || 1, 2); p++) {
          var lines = []; for (var l = 0; l < (p === 0 ? 8 : 14); l++) lines.push({ w: (l * 37 % 35) + 60 });
          pages.push({ first: p === 0, rest: p > 0, heading: f.heading || parts[0], rows: (f.rows || []).map(function (r) { return { k: r[0], v: r[1] }; }), lines: lines, num: (p + 1) + " / " + (f.pages || 1) });
        }
      }
      var fromP = f.from ? api.person(f.from) : null;
      var asked = !!(st.asked || {})[f.id];
      var wave = []; for (var w = 0; w < 48; w++) wave.push({ h: Math.round(8 + 40 * Math.abs(Math.sin(w * 0.7) * Math.cos(w * 0.29))), c: f.dur && w / 48 < (st.pos || 0) / f.dur ? "var(--acct)" : "var(--s3)" });
      pv = {
        name: f.name, base: parts[0], ext: parts[1],
        meta: (f.type === "pdf" ? "PDF" : ty.label) + " · " + f.size + (fromP ? " · from " + fromP.name.split(" ")[0] : "") + " · " + f.folder,
        d: IC[ty.icon],
        isPages: pages.length > 0, pages: pages, paper: paper,
        isReceipt: f.scan === "receipt", isPhoto: f.scan === "photo", photoBg: imgBg("p10", "linear-gradient(180deg, #F4B26B 0%, #E57A5A 45%, #6D5A8C 62%, #2F4A6B 63%, #1E3550 100%)"), photoSun: IMG.p10 ? "none" : "block", isAudio: f.type === "audio", isArchive: f.type === "archive",
        receipt: f.receipt ? { shop: f.receipt.shop, rows: f.receipt.rows.map(function (r) { return { k: r[0], v: r[1] }; }), total: f.receipt.total } : null,
        contents: (f.contents || []).map(function (c) { return { name: c, d: /\/$/.test(c) ? IC.folder : IC.filesDoc }; }),
        wave: wave, time: Math.floor((st.pos || 0) / 60) + ":" + pad2(Math.floor(st.pos || 0) % 60) + " / " + Math.floor((f.dur || 0) / 60) + ":" + pad2((f.dur || 0) % 60),
        playIcon: st.playing ? IC.pause : IC.play, playLabel: st.playing ? "Pause" : "Play", playCss: st.playing ? "" : "fill: currentColor",
        play: function () {
          if (api.get("files").playing) { clearInterval(FL.playI); api.set({ playing: false }); return; }
          api.set({ playing: true, pos: (st.pos || 0) >= f.dur ? 0 : (st.pos || 0) });
          clearInterval(FL.playI);
          FL.playI = api.every(function () { var s = api.get("files"); var np = (s.pos || 0) + 1; if (np >= f.dur) { clearInterval(FL.playI); api.set({ pos: f.dur, playing: false }); return; } api.set({ pos: np }); }, 250);
        },
        transcribe: function () {
          if (!VIEWS.notes) return api.toast("Transcribing");
          var id = "memo-" + f.id;
          if (notesFind((api.get("notes").list || []), id)) return api.open("notes", { open: id });
          var note = { id: id, kind: "voice", title: "Landlord", when: "Yesterday · 6:20 PM", dur: f.dur, pinned: false,
            lines: [{ s: "me", t: "Note to self: call the landlord Friday.", at: 0 }, { s: "me", t: "The bedroom radiator clanks all night, and ask when the lease renewal is due.", at: 6 }],
            summary: f.sum.slice(0, 2), actions: [{ t: "Call the landlord Friday", done: false }, { t: "Ask about the lease renewal date", done: false }] };
          api.setView("notes", { list: [note].concat(api.get("notes").list || []) });
          api.open("notes", { open: id });
        },
        renaming: !!st.renaming, notRenaming: !st.renaming,
        rn: st.rn,
        startRename: function () { api.set({ renaming: true, rn: parts[0] }); },
        onRn: function (e) { api.set({ rn: e.target.value }); },
        saveRn: function () {
          var v = String(api.get("files").rn || "").trim();
          if (v) api.set({ files: api.get("files").files.map(function (x) { return x.id === f.id ? Object.assign({}, x, { name: v + parts[1] }) : x; }), renaming: false });
          else api.set({ renaming: false });
        },
        rnKey: function (e) {
          if (e.key === "Enter") { e.preventDefault(); var v = String(api.get("files").rn || "").trim(); if (v) api.set({ files: api.get("files").files.map(function (x) { return x.id === f.id ? Object.assign({}, x, { name: v + parts[1] }) : x; }), renaming: false }); else api.set({ renaming: false }); }
          if (e.key === "Escape") api.set({ renaming: false });
        },
        close: function () { clearInterval(FL.playI); api.set({ open: null, renaming: false, playing: false, pos: 0 }); },
        share: function () { api.set({ sheet: "share", renaming: false }); },
        move: function () { api.set({ sheet: "move", renaming: false }); },
        del: function () { filesRemove(api, [f.id]); },
        asked: asked, asking: st.asking === f.id, canAsk: !asked && st.asking !== f.id,
        sum: f.sum || [],
        askLabel: "Summarize",
        ask: function () { api.set({ asking: f.id }); api.later(function () { var a = Object.assign({}, api.get("files").asked); a[f.id] = true; api.set({ asked: a, asking: null }); }, 1100); },
        saveSum: function () { if (VIEWS.notes && VIEWS.notes.actions) VIEWS.notes.actions.save({ title: parts[0] + " · summary", bullets: f.sum }, api); else api.toast("Saved to Notes"); }
      };
    }

    /* sheets */
    var targetIds = f ? [f.id] : (sel || []);
    var curFolder = f ? f.folder : st.folder;
    var moveTo = FILES_FOLDERS.map(function (d) {
      var here = d.id === curFolder;
      return { name: d.id, d: IC[d.icon] || IC.folder, here: here, notHere: !here, sub: d.parent ? d.parent : "",
        go: function () {
          if (here) { api.set({ sheet: null }); return; }
          var ids = targetIds.slice();
          api.set({ files: api.get("files").files.map(function (x) { return ids.indexOf(x.id) >= 0 ? Object.assign({}, x, { folder: d.id }) : x; }), sheet: null, sel: null });
          api.toast((ids.length === 1 ? "Moved" : ids.length + " files moved") + " to " + d.id);
        } };
    });

    return {
      top: !st.folder, searching: st.q !== null && st.q !== undefined, notSearching: st.q === null || st.q === undefined,
      q: st.q || "", onQ: function (e) { api.set({ q: e.target.value }); }, search: function () { api.set({ q: "" }); }, endSearch: function () { api.set({ q: null }); },
      hasQuery: !!q, noQuery: !q, results: results, noResults: !!q && results.length === 0,
      locs: locs, recent: files.slice(0, 5).map(row),
      storageW: "15%",
      inFolder: !!fd, fd: fd,
      isList: !st.grid, isGrid: !!st.grid,
      isSel: isSel, notSel: !isSel, selCount: selCount === 0 ? "Select" : String(selCount), hasSel: selCount > 0, selOp: selCount > 0 ? "1" : ".35",
      exitSel: function () { api.set({ sel: null }); },
      selAll: function () { api.set({ sel: files.filter(function (x) { return x.folder === st.folder; }).map(function (x) { return x.id; }) }); },
      selShare: function () { if (selCount) api.set({ sheet: "share" }); },
      selMove: function () { if (selCount) api.set({ sheet: "move" }); },
      selDel: function () { if (selCount) filesRemove(api, sel.slice()); },
      isPreview: !!pv, pv: pv,
      moveSheet: st.sheet === "move", shareSheet: st.sheet === "share", moveTo: moveTo,
      closeSheet: function () { api.set({ sheet: null }); },
      shareMsg: function () { filesShare(api, targetIds, "msg"); },
      shareMail: function () { filesShare(api, targetIds, "mail"); },
      menuOpen: !!st.menu && !!fd, closeMenu: function () { api.set({ menu: false }); },
      askQ: "Ask " + api.name + ": \u201c" + String(st.q || "").trim() + "\u201d",
      askSearch: function () { var qq = String(api.get("files").q || "").trim(); api.set({ q: null }); api.send("Find the file " + qq); }
    };
  }
});

/* ===== module: wallet ===== */
/* Wallet. Holes are {{wallet.*}}. Deep links: {open: cardId|"bp"|"ticket"|"transit"}, {pay: true, card?: cardId}, {add: true}. */
IC.walTap = IC.walTap || "M6 9.5a4 4 0 0 1 0 5M9.5 7a7.5 7.5 0 0 1 0 10M13 4.5a11 11 0 0 1 0 15";
IC.walCard = IC.walCard || "M3 6h18v12H3zM3 10h18M7 14.5h4";
IC.walScan = IC.walScan || "M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M4 12h16";
IC.walTicket = IC.walTicket || "M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4zM14.5 7v2M14.5 11v2M14.5 15v2";
IC.walBus = IC.walBus || "M7 3.5h10a2 2 0 0 1 2 2V16a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 16V5.5a2 2 0 0 1 2-2zM5 11h14M8 17.5V20M16 17.5V20M8.5 14.3h.01M15.5 14.3h.01";
IC.walCup = IC.walCup || "M5 9h11v4.5A4.5 4.5 0 0 1 11.5 18h-2A4.5 4.5 0 0 1 5 13.5zM16 10.5h1.5a2.3 2.3 0 0 1 0 4.6H16M8 3.5v2.5M12 3.5v2.5M4 21h13";
IC.walFood = IC.walFood || "M7 3v7M5 3v5a2 2 0 0 0 4 0V3M7 10v11M17 3c-2.2 1.2-3.2 3.6-3.2 6.5V13H17M17 3v18";
IC.walGym = IC.walGym || "M7 7v10M4 9.5v5M17 7v10M20 9.5v5M7 12h10";
IC.walBag = IC.walBag || "M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2";
IC.walUnlock = IC.walUnlock || "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 6.8-1.2";

var WAL_CARDS = [
  { id: "stone", name: "Household", last4: "0359", kind: "Debit", bg: "#D9D7D0", fg: "#000000", def: false, locked: false, tx: [
    { id: "s1", m: "Rainbow Grocery", a: 92.40, d: 6, icon: "walBag" },
    { id: "s2", m: "Cole Hardware", a: 23.10, d: 12, icon: "walBag" }] },
  { id: "work", name: "Work", last4: "7703", kind: "Credit", bg: "#1F1F1F", fg: "#FFFFFF", def: false, locked: false, tx: [
    { id: "w1", m: "GPU Reserve", a: 120.00, d: 1, icon: "chip", note: "Compute credits" },
    { id: "w2", m: "Philz Coffee", a: 7.25, d: 2, icon: "walCup" },
    { id: "w3", m: "Flight SFO to JFK", a: 389.00, d: 4, icon: "plane" },
    { id: "w4", m: "GPU Reserve", a: 480.00, d: 6, icon: "chip", note: "Compute credits" },
    { id: "w5", m: "GPU Reserve", a: 120.00, d: 13, icon: "chip", note: "Compute credits" }] },
  { id: "blue", name: "Alpha Blue", last4: "4821", kind: "Debit", bg: "#0000FF", fg: "#FFFFFF", def: true, locked: false, tx: [
    { id: "b1", m: "Tartine", a: 38.50, d: 0, icon: "walFood" },
    { id: "b2", m: "Sightglass Coffee", a: 6.50, d: 1, icon: "walCup" },
    { id: "b3", m: "Equinox SoMa", a: 210.00, d: 2, icon: "walGym", note: "Monthly membership" },
    { id: "b4", m: "Rainbow Grocery", a: 64.18, d: 3, icon: "walBag" },
    { id: "b5", m: "Transit reload", a: 20.00, d: 5, icon: "walBus" },
    { id: "b6", m: "Blue Bottle Coffee", a: 5.75, d: 8, icon: "walCup" },
    { id: "b7", m: "Tartine", a: 24.00, d: 11, icon: "walFood" }] }
];
var WAL_TRIPS = [
  { id: "r1", m: "Bus · 4th St & Folsom St", a: 2.50, d: 0 },
  { id: "r2", m: "Train · Civic Center", a: 2.50, d: 1 },
  { id: "r3", m: "Bus · 16th St & Valencia St", a: 2.50, d: 3 }
];
var WAL_MERCH = [["Sightglass Coffee", 6.50, "walCup"], ["Blue Bottle Coffee", 5.75, "walCup"], ["Philz Coffee", 7.25, "walCup"]];
var WAL_NEW_BG = ["#0C0C61", "#3A3A3A", "#5B5BD6"];

function walMoney(a) { return "$" + a.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
function walDay(d, now) {
  if (d === 0) return "Today"; if (d === 1) return "Yesterday";
  var dt = new Date(now.getTime() - d * 86400000);
  return d < 7 ? DAYS[dt.getDay()] : MONS[dt.getMonth()].slice(0, 3) + " " + dt.getDate();
}
function walDate(off, now) { var dt = new Date(now.getTime() + off * 86400000); return DAYS[dt.getDay()].slice(0, 3) + ", " + MONS[dt.getMonth()].slice(0, 3) + " " + dt.getDate(); }
function walCard(cards, id) { for (var i = 0; i < cards.length; i++) if (cards[i].id === id) return cards[i]; return null; }
function walDefault(cards) { for (var i = 0; i < cards.length; i++) if (cards[i].def) return cards[i]; return cards[cards.length - 1] || null; }
function walPayable(cards) { return cards.filter(function (c) { return !c.locked; }); }
function walFind(t, cards) {
  if (/\bwork\b|business|company/.test(t)) return "work";
  if (/household|joint|house\b/.test(t)) return "stone";
  if (/alpha blue|\bblue\b|personal|debit/.test(t)) return "blue";
  var m = t.match(/(\d{4})\b/); if (m) { var hit = cards.filter(function (c) { return c.last4 === m[1]; })[0]; if (hit) return hit.id; }
  return null;
}
function walQR(seed) {
  var n = 25, d = ""; var h = 0; for (var i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  var rnd = function () { h = (h * 1103515245 + 12345) >>> 0; return (h >>> 16) & 1; };
  var finder = function (x, y) {
    var ins = function (ox, oy) { var dx = x - ox, dy = y - oy; if (dx < 0 || dy < 0 || dx > 6 || dy > 6) return null; return dx === 0 || dy === 0 || dx === 6 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4); };
    var r = ins(0, 0); if (r !== null) return r; r = ins(n - 7, 0); if (r !== null) return r; r = ins(0, n - 7); if (r !== null) return r;
    if ((x === 7 && (y <= 7 || y >= n - 8)) || (y === 7 && (x <= 7 || x >= n - 8)) || (x === n - 8 && y <= 7) || (y === n - 8 && x <= 7)) return false;
    return null;
  };
  for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) { var f = finder(x, y); var on = f === null ? (y === 6 || x === 6 ? (x + y) % 2 === 0 : rnd() === 1) : f; if (on) d += "M" + x + " " + y + "h1v1h-1z"; }
  return d;
}
var WAL_QR = { bp: walQR("SFOJFK1482-14A"), ticket: walQR("NIGHTSIGNALS-GA-0412") };
function walWeek(cards, only) {
  var total = 0, n = 0, by = {};
  cards.forEach(function (c) { if (only && c.id !== only) return; c.tx.forEach(function (x) { if (x.d < 7) { total += x.a; n++; by[x.m] = (by[x.m] || 0) + x.a; } }); });
  var top = Object.keys(by).sort(function (a, b) { return by[b] - by[a]; });
  return { total: total, n: n, top: top, by: by };
}
function walAddTx(api, cardId, tx, patch) {
  var cards = api.get("wallet").cards.map(function (c) { return c.id === cardId ? Object.assign({}, c, { tx: [tx].concat(c.tx) }) : c; });
  api.set(Object.assign({}, patch || {}, { cards: cards }));
}
function walFmtNum(v) { var d = v.replace(/\D/g, "").slice(0, 19); return d.replace(/(\d{4})(?=\d)/g, "$1 "); }
function walLuhn(d) { var sum = 0; for (var i = 0; i < d.length; i++) { var x = +d.charAt(d.length - 1 - i); if (i % 2) { x *= 2; if (x > 9) x -= 9; } sum += x; } return d.length > 0 && sum % 10 === 0; }
function walFmtExp(v) { var d = v.replace(/\D/g, "").slice(0, 4); return d.length > 2 ? d.slice(0, 2) + "/" + d.slice(2) : d; }

registerView("wallet", {
  title: "Wallet", icon: "wallet", aliases: ["pay", "cards", "passes"],
  chat: "hidden",
  state: { cards: WAL_CARDS, open: null, pay: false, card: null, stage: "auth", paid: null, add: null, form: { num: "", exp: "", name: "", cvv: "" }, code: "", transit: 23.40, trips: WAL_TRIPS, calAdded: {}, pays: 0 },
  persist: ["cards", "transit", "trips", "calAdded", "pays"],
  jumps: [[null, "Wallet"], ["card", "Card"], ["pay", "Pay"], ["secure", "Pay from lock"], ["add", "Add card"], ["pass", "Boarding pass"]],
  preset: function (sub, api) {
    if (sub === "card") return { open: "blue" };
    if (sub === "pay") return { pay: true, stage: "auth" };
    if (sub === "secure") { api.shell({ secure: true }); return { pay: true, stage: "auth" }; }
    if (sub === "add") return { add: "form", form: { num: "4000 1234 5678 9017", exp: "11/29", name: "", cvv: "" } };
    if (sub === "pass") return { open: "bp" };
  },
  badge: function () { return false; },
  immersive: function (st, api) {
    if (st.pay || st.add === "scan" || api.secure) return { dark: true, noPill: true };
    return null;
  },
  back: function (st, api) {
    if (api.secure) { api.stop(); api.set({ pay: false, stage: "auth", card: null }); return false; }
    if (st.pay) { api.stop(); api.set({ pay: false, stage: "auth", card: null }); return true; }
    if (st.add) { api.stop(); var a = st.add === true ? "pick" : st.add; api.set({ add: a === "verify" ? "form" : (a === "pick" ? null : "pick"), code: "" }); return true; }
    if (st.open) { api.set({ open: null }); return true; }
    return false;
  },
  onLeave: function (api) { api.stop(); },
  suggestions: function (st) {
    if (st.open === "bp") return ["When should I leave for SFO?", "Directions to SFO"];
    if (st.open && st.open !== "ticket" && st.open !== "transit") return ["How much did I spend on this card?", "Lock this card"];
    return ["How much did I spend this week?", "Show my boarding pass", "Pay with my work card"];
  },
  voicePhrase: "How much did I spend this week?",
  reply: function (t, raw, api) {
    var st = api.get("wallet"); var cards = st.cards;
    if (/\b(spend|spent|spending)\b/.test(t)) {
      var only = walFind(t, cards) || (/this card/.test(t) && st.open && walCard(cards, st.open) ? st.open : null);
      var w = walWeek(cards, only); var c = only ? walCard(cards, only) : null;
      var top = w.top[0];
      var bullets = [walMoney(w.total) + " across " + w.n + " purchases" + (c ? " on " + c.name : "")];
      if (top) bullets.push(top + " was the biggest: " + walMoney(w.by[top]));
      if (!only && w.by["Equinox SoMa"]) bullets.push("Equinox renewed at " + walMoney(w.by["Equinox SoMa"]) + ", as usual");
      if (!only || only === "work") { var g = w.by["GPU Reserve"]; if (g && top !== "GPU Reserve") bullets.push("GPU Reserve: " + walMoney(g)); }
      return { text: walMoney(w.total) + " this week" + (c ? " on " + c.name : "") + (top ? ", mostly " + top + "." : "."), card: { type: "summary", bullets: bullets, go: { view: "wallet", patch: only ? { open: only } : {} } } };
    }
    var pm = t.match(/\bpay (with|using) (?:my |the )?(.+)$/) || (/^(tap to )?pay( now| here)?[.!]?$|contactless/.test(t) ? [t, "", ""] : null);
    if (pm && !/\bpay (for|back|someone|him|her|them|\w+ \$)/.test(t)) {
      var id = walFind(pm[2] || "", cards); var cd = id ? walCard(cards, id) : walDefault(cards);
      if (!cd) return null;
      if (cd.locked) return { text: cd.name + " is locked. Unlock it first?", nav: { view: "wallet", patch: { open: cd.id } } };
      return { text: cd.name + " is ready. Hold near the reader.", nav: { view: "wallet", patch: { pay: true, card: cd.id, stage: "auth", open: null, add: null }, chat: "hidden" } };
    }
    if (/boarding pass|my flight|flight pass|\bgate\b.*flight|which gate/.test(t)) {
      return { text: "Gate B12, seat 14A. Boarding at 7:25 AM " + walDate(3, api.now).split(",")[0] + ".", card: { type: "generic", icon: "plane", title: "SFO to JFK", sub: walDate(3, api.now) + " · 8:05 AM · Gate B12", go: { view: "wallet", patch: { open: "bp", pay: false, add: null } } },
        nav: { view: "wallet", patch: { open: "bp", pay: false, add: null } } };
    }
    if (/\badd (a |my |new |another )?(credit |debit )?card\b/.test(t)) return { text: "Scan it or type it in.", nav: { view: "wallet", patch: { add: "pick", open: null, pay: false } } };
    if (/transit (card|balance)|\bfare balance/.test(t)) return { text: "Transit has " + walMoney(st.transit) + ".", card: { type: "generic", icon: "walBus", title: "Transit", sub: walMoney(st.transit), go: { view: "wallet", patch: { open: "transit" } } } };
    var lk = t.match(/\b(lock|freeze|unlock|unfreeze)\b (?:my |this |the )?(.*)card/);
    if (lk) {
      var lid = walFind(lk[2], cards) || (st.open && walCard(cards, st.open) ? st.open : null);
      if (!lid) return null;
      var on = /^(lock|freeze)$/.test(lk[1]); var lc = walCard(cards, lid);
      return { text: lc.name + " is " + (on ? "locked. Nothing can be charged until you unlock it." : "unlocked."),
        then: function () { api.set({ cards: api.get("wallet").cards.map(function (c) { return c.id === lid ? Object.assign({}, c, { locked: on }) : c; }) }); } };
    }
    return null;
  },
  render: function (st, api) {
    var cards = st.cards || []; var now = api.now;
    var set = function (p) { api.set(p); };
    var upd = function (id, p) { set({ cards: api.get("wallet").cards.map(function (c) { return c.id === id ? Object.assign({}, c, p) : c; }) }); };
    var vis = function (c) {
      return { name: c.name, last4: "•••• " + c.last4, kind: c.kind, locked: c.locked, unlocked: !c.locked,
        css: "background: " + c.bg + "; color: " + c.fg + (c.locked ? "; filter: saturate(.25) brightness(.85)" : ""),
        chip: c.fg === "#000000" ? "rgba(0,0,0,.16)" : "rgba(255,255,255,.28)" };
    };
    /* stack: default card in front (last) */
    var order = cards.filter(function (c) { return !c.def; }).concat(cards.filter(function (c) { return c.def; }));
    var stack = order.map(function (c, i) {
      return Object.assign(vis(c), { mt: i === 0 ? 0 : -174, label: c.name + " card ending " + c.last4, open: function () { set({ open: c.id }); } });
    });
    var passes = [
      { id: "bp", title: "SFO → JFK", sub: walDate(3, now) + " · 8:05 AM", d: IC.plane, iconCss: "background: var(--acc); color: #fff", right: "" },
      { id: "ticket", title: "Night Signals", sub: walDate(4, now) + " · 8:00 PM", d: IC.walTicket, iconCss: "background: var(--s3)", right: "" },
      { id: "transit", title: "Transit", sub: "Tap at the gate", d: IC.walBus, iconCss: "background: var(--s3)", right: walMoney(st.transit) }
    ].map(function (p) { return Object.assign(p, { go: function () { set({ open: p.id }); } }); });

    /* detail */
    var oc = st.open ? walCard(cards, st.open) : null;
    var det = null;
    if (oc) {
      det = Object.assign(vis(oc), {
        tx: oc.tx.map(function (x) { return { m: x.m, sub: walDay(x.d, now) + (x.note ? " · " + x.note : ""), amt: walMoney(x.a), d: IC[x.icon] || IC.walCard }; }),
        hasTx: oc.tx.length > 0,
        lockTrack: api.track(oc.locked), lockKx: api.kx(oc.locked), lockOn: oc.locked,
        defTrack: api.track(oc.def), defKx: api.kx(oc.def), defOn: oc.def,
        pay: function () { if (oc.locked) { api.toast("Unlock the card to pay"); return; } set({ pay: true, card: oc.id, stage: "auth" }); },
        ask: function () { api.send("How much did I spend on my " + oc.name + " card this week?"); },
        lock: function () { upd(oc.id, { locked: !oc.locked }); api.toast(oc.name + (oc.locked ? " unlocked" : " locked")); },
        setDef: function () { if (oc.def) { api.toast("Already your default"); return; } set({ cards: api.get("wallet").cards.map(function (c) { return Object.assign({}, c, { def: c.id === oc.id }); }) }); api.toast(oc.name + " is now your default"); },
        remove: function () {
          var before = api.get("wallet").cards;
          var rest = before.filter(function (c) { return c.id !== oc.id; });
          if (oc.def && rest.length) rest = rest.map(function (c, i) { return Object.assign({}, c, { def: i === rest.length - 1 }); });
          set({ cards: rest, open: null });
          api.toast(oc.name + " •••• " + oc.last4 + " removed", { undo: function () { api.set({ cards: before }); } });
        },
        close: function () { set({ open: null }); }
      });
    }

    /* passes */
    var pass = st.open === "bp" || st.open === "ticket" || st.open === "transit" ? st.open : null;
    var calOn = !!(st.calAdded || {})[pass];
    var ps = pass ? {
      isBp: pass === "bp", isTicket: pass === "ticket", isTransit: pass === "transit",
      date3: walDate(3, now), date4: walDate(4, now), qr: WAL_QR[pass] || "",
      calOn: calOn, calOff: !calOn,
      addCal: function () {
        var c = Object.assign({}, api.get("wallet").calAdded || {}); c[pass] = true; set({ calAdded: c });
        api.open("calendar", { add: pass === "bp" ? { title: "Flight SFO → JFK", off: 3, t: 8 + 5 / 60, d: 5.6, where: "SFO · Gate B12 · Seat 14A", cal: "personal" } : { title: "Night Signals", off: 4, t: 20, d: 3, where: "The Warfield, 982 Market St", cal: "personal" } });
      },
      dirs: function () { api.open("maps", { query: null, place: null, directions: "sfo", nav: false, mode: "drive" }); },
      balance: walMoney(st.transit),
      trips: (st.trips || []).map(function (r) { return { m: r.m, sub: walDay(r.d, now), amt: "−" + walMoney(r.a) }; }),
      reload: function () {
        var s2 = api.get("wallet"); var dc = walDefault(s2.cards);
        var credit = { transit: Math.round((s2.transit + 20) * 100) / 100 };
        if (dc) walAddTx(api, dc.id, { id: "t" + Date.now(), m: "Transit reload", a: 20, d: 0, icon: "walBus" }, credit);
        else set(credit);
        api.toast("Added $20.00" + (dc ? " from " + dc.name : ""));
      },
      close: function () { set({ open: null }); }
    } : null;

    /* pay */
    var payable = walPayable(cards);
    var secure = !!api.secure;
    var payOn = st.pay || secure;
    var pc = payOn ? (walCard(payable, st.card) || walDefault(payable) || payable[0] || null) : null;
    var pay = null;
    var closePay = function () { api.stop(); set({ pay: false, stage: "auth", card: null }); if (secure) api.home(); };
    if (payOn) {
      var stage = st.stage || "auth";
      var mer = WAL_MERCH[(st.pays || 0) % WAL_MERCH.length];
      var cycle = function (dir) {
        if (!pc || payable.length < 2 || stage !== "auth" || secure) return;
        var i = payable.indexOf(pc); set({ card: payable[(i + dir + payable.length) % payable.length].id });
      };
      var sw = api.sw(function (dx) { cycle(dx < 0 ? 1 : -1); });
      pay = {
        has: !!pc, none: !pc,
        c: pc ? vis(pc) : null,
        isAuth: stage === "auth", isHold: stage === "hold", isDone: stage === "done",
        dots: payable.length > 1 && !secure ? payable.map(function (c) { var on = pc && c.id === pc.id; return { label: "Pay with " + c.name, css: on ? "background: #ffffff; width: 22px" : "background: #555555; width: 8px", go: function () { if (stage === "auth") set({ card: c.id }); } }; }) : [],
        swDown: function (e) { try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {} sw.down(e); }, swUp: sw.up,
        paid: st.paid ? walMoney(st.paid.a) : "", paidAt: st.paid ? st.paid.m : "",
        auth: function () {
          if (!pc) return;
          var cid = pc.id;
          set({ stage: "hold", card: cid });
          api.later(function () {
            var s2 = api.get("wallet"); if (!s2.pay && !secure) return;
            try {
            walAddTx(api, cid, { id: "p" + Date.now(), m: mer[0], a: mer[1], d: 0, icon: mer[2] }, { stage: "done", paid: { m: mer[0], a: mer[1] }, pays: (s2.pays || 0) + 1 });
            } catch (error) { api.stop(); set({ stage: "auth", paid: null }); api.toast("Simulated payment was not saved. Review and try again."); }
          }, 1900);
          api.later(function () { var s3 = api.get("wallet"); if (s3.stage === "done") closePay(); }, 5200);
        },
        done: closePay,
        cancel: closePay
      };
    }

    /* add card */
    var addStep = st.add === true ? "pick" : st.add;
    var f = Object.assign({ num: "", exp: "", name: "", cvv: "" }, st.form || {});
    var digits = f.num.replace(/\D/g, "");
    var expM = f.exp.match(/^(0[1-9]|1[0-2])\/(\d\d)$/);
    var nowYY = now.getFullYear() % 100, nowMM = now.getMonth() + 1;
    var expOk = !!expM && (+expM[2] > nowYY || (+expM[2] === nowYY && +expM[1] >= nowMM));
    var numOk = digits.length >= 15 && walLuhn(digits);
    var cvvOk = /^\d{3,4}$/.test(f.cvv);
    var formOk = numOk && expOk && cvvOk;
    var numErr = digits.length >= 15 && !numOk ? "Check the card number" : "";
    var expErr = f.exp.length === 5 && !expOk ? (expM ? "This card has expired" : "Use MM/YY") : "";
    var add = addStep ? {
      isPick: addStep === "pick", isScan: addStep === "scan", isForm: addStep === "form", isVerify: addStep === "verify",
      scan: function () {
        set({ add: "scan" });
        api.later(function () { if (api.get("wallet").add !== "scan") return; api.set({ add: "form", form: Object.assign({}, api.get("wallet").form, { num: "4000 1234 5678 9017", exp: "11/29" }) }); api.toast("Card scanned"); }, 2200);
      },
      manual: function () { api.stop(); set({ add: "form" }); },
      close: function () { api.stop(); set({ add: null, form: { num: "", exp: "", name: "", cvv: "" }, code: "" }); },
      back: function () { VIEWS.wallet.back(api.get("wallet"), api); },
      num: f.num, exp: f.exp, name: f.name,
      onNum: function (e) { set({ form: Object.assign({}, api.get("wallet").form, { num: walFmtNum(e.target.value) }) }); },
      onExp: function (e) { set({ form: Object.assign({}, api.get("wallet").form, { exp: walFmtExp(e.target.value) }) }); },
      onCvv: function (e) { set({ form: Object.assign({}, api.get("wallet").form, { cvv: e.target.value.replace(/\D/g, "").slice(0, 4) }) }); },
      cvv: f.cvv, numErr: numErr, hasNumErr: !!numErr, expErr: expErr, hasExpErr: !!expErr,
      onName: function (e) { set({ form: Object.assign({}, api.get("wallet").form, { name: e.target.value }) }); },
      prevNum: digits.length ? "•••• " + (digits.length >= 4 ? digits.slice(-4) : digits) : "•••• ••••",
      prevExp: f.exp || "MM/YY",
      ok: formOk, notOk: !formOk,
      nextCss: formOk ? "background: var(--acc); color: #fff" : "background: var(--s2); color: var(--mut)",
      next: function () {
        if (!formOk) return;
        set({ add: "verify", code: "" });
        api.later(function () { var s2 = api.get("wallet"); if (s2.add === "verify" && !s2.code) { api.set({ code: "482913", auto: true }); } }, 1500);
      },
      code: st.code || "", auto: !!st.auto && (st.code || "") === "482913",
      onCode: function (e) { set({ code: e.target.value.replace(/\D/g, "").slice(0, 6), auto: false }); },
      codeOk: (st.code || "").length === 6, codeBad: (st.code || "").length !== 6,
      verifyCss: (st.code || "").length === 6 ? "background: var(--acc); color: #fff" : "background: var(--s2); color: var(--mut)",
      verify: function () {
        var s2 = api.get("wallet");
        if ((s2.code || "").length !== 6) return;
        var d4 = s2.form.num.replace(/\D/g, "").slice(-4);
        var nid = "c" + Date.now();
        var nc = { id: nid, name: s2.form.name ? s2.form.name.split(" ")[0] + "'s card" : "Card " + d4, last4: d4, kind: "Credit", bg: WAL_NEW_BG[(s2.cards.length) % WAL_NEW_BG.length], fg: "#FFFFFF", def: s2.cards.length === 0, locked: false, tx: [] };
        api.stop();
        api.set({ cards: [nc].concat(s2.cards), add: null, code: "", auto: false, form: { num: "", exp: "", name: "", cvv: "" }, open: nid });
        api.toast("Card added");
      }
    } : null;

    return {
      stack: stack, passes: passes, hasCards: cards.length > 0, noCards: cards.length === 0,
      startPay: function () { if (!payable.length) { api.toast("No card to pay with"); return; } set({ pay: true, stage: "auth", card: null }); },
      startAdd: function () { set({ add: "pick" }); },
      det: secure ? null : det, isDet: !!det && !secure,
      ps: ps, isPass: !!ps && !secure,
      pay: pay, isPay: !!pay, secure: secure, notSecure: !secure,
      add: add, isAdd: !!add, addScan: !!add && add.isScan && !secure, addPage: !!add && !add.isScan && !secure
    };
  }
});

/* ===== module: workflows ===== */
/* Workflows: agent automations. List (name + sentence + toggle) → detail (summary, touched apps, step diagram,
   run now, recent runs) → run detail (what Alpha did at each step). Builder for create/edit.
   All markup holes are {{workflows.*}}. */
IC.wfRead = IC.wfRead || "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM15 12a3 3 0 1 1-6 0a3 3 0 1 1 6 0z";
IC.wfIf = IC.wfIf || "M12 3l9 9-9 9-9-9z";
IC.wfDo = IC.wfDo || "M13 3L5 14h6l-1 7 8-11h-6z";
IC.wfSkip = IC.wfSkip || "M7 12h10";
IC.wfUp = IC.wfUp || "M12 19V5M6 11l6-6 6 6";
IC.wfDown = IC.wfDown || "M12 5v14M6 13l6 6 6-6";

var WF_KINDS = {
  When: { icon: "clock" },
  Read: { icon: "wfRead", presets: [["Today's calendar", ["Calendar"]], ["Overnight inbox", ["Mail"]], ["New messages", ["Messages"]], ["Today's notes", ["Notes"]], ["Recent files", ["Files"]]] },
  If: { icon: "wfIf", presets: [["It's from a favorite", ["Contacts"]], ["It mentions money", []], ["I'm in a meeting", ["Calendar"]], ["I'm not at home", ["Location"]]] },
  Write: { icon: "edit", presets: [["A short summary", []], ["A draft reply", []], ["A note in Notes", ["Notes"]], ["Tomorrow's first three tasks", []]] },
  Send: { icon: "send", presets: [["A message to Maya", ["Messages"]], ["An email to me", ["Mail"]], ["A reply to the sender", ["Messages"]]] },
  Notify: { icon: "bell", presets: [["A notification", []], ["A notification, only if urgent", []]] },
  Speak: { icon: "wave", presets: [["Read it aloud", ["Speaker"]], ["Speak it when I pick up the phone", ["Speaker"]]] },
  Do: { icon: "wfDo", presets: [["Turn on Do Not Disturb", ["Settings"]], ["Turn off Do Not Disturb", ["Settings"]], ["Save the attachment to Files", ["Files"]], ["Add the amount to Wallet", ["Wallet"]]] }
};
var WF_PALETTE = ["Read", "If", "Write", "Send", "Notify", "Speak", "Do"];
var WF_APP_IC = { Mail: "mail", Calendar: "cal", Messages: "bubble", Notes: "notes", Files: "folder", Wallet: "wallet", Location: "pin", Contacts: "user", Speaker: "wave", Settings: "moon" };
var WF_TRIG = [
  ["time", "clock", "Time"], ["event", "cal", "Event"], ["message", "bubble", "Message"], ["location", "pin", "Place"], ["email", "mail", "Email"]
];
var WF_DAYS = ["Every day", "Weekdays", "Weekends", "Mondays", "Fridays"];
var WF_EVENTS = [["A deep-work event starts", ["Calendar"]], ["An event ends", ["Calendar"]], ["10 minutes before a meeting", ["Calendar"]]];
var WF_PLACES = ["I arrive home", "I leave home", "I arrive at work"];

var WF_SEED = [
  { id: 1, name: "Morning brief", on: true,
    short: "Spoken rundown of your day, weekdays at 7",
    summary: "Weekdays at 7, a spoken rundown of your inbox and day the first time you pick up the phone.",
    trig: { kind: "time", days: "Weekdays", t: 7 },
    steps: [{ k: "Read", t: "Overnight inbox and today's calendar", apps: ["Mail", "Calendar"] }, { k: "Write", t: "A brief under a minute long", apps: [] }, { k: "Speak", t: "Speak it when I pick up the phone", apps: ["Speaker"] }],
    runs: [
      { id: "r11", when: "Today, 7:02 AM", status: "ok", sum: "Spoke a 48-second brief", dur: "2 min",
        log: [["When", "Started at 7:00 AM, a weekday.", "ok"], ["Read", "14 new emails and 6 events today.", "ok"], ["Write", "Picked the three things that need you: Jordan's term sheet, Maya's prototype, the 3:00 design review.", "ok"], ["Speak", "You picked up the phone at 7:02. Spoke it in 48 seconds.", "ok"]],
        out: "Morning. Three things today: Jordan sent a revised term sheet, Maya's bringing the prototype to the 3:00 design review, and you've got lunch with Priya at 1." },
      { id: "r12", when: "Yesterday, 7:00 AM", status: "ok", sum: "Spoke a 41-second brief", dur: "1 min",
        log: [["When", "Started at 7:00 AM, a weekday.", "ok"], ["Read", "9 new emails and 4 events.", "ok"], ["Write", "Two things need you: roadmap review at 2, coffee with Lena at 8:30.", "ok"], ["Speak", "Spoke it at 7:00 while you were already on the phone.", "ok"]],
        out: "Morning. Coffee with Lena at 8:30 and the roadmap review at 2. Nothing urgent overnight." },
      { id: "r13", when: "Fri, 7:00 AM", status: "skip", sum: "You'd already read your inbox", dur: "",
        log: [["When", "Started at 7:00 AM, a weekday.", "ok"], ["Read", "You'd opened Mail at 6:41 and read everything.", "ok"], ["Write", "Nothing new to say, so I didn't write a brief.", "skip"], ["Speak", "Skipped.", "skip"]], out: "" }
    ] },
  { id: 2, name: "Protect focus", on: true,
    short: "Only Maya gets through during deep work",
    summary: "During deep work, everything but Maya waits, and you get what you missed when it ends.",
    trig: { kind: "event", ev: "A deep-work event starts" },
    steps: [{ k: "Do", t: "Turn on Do Not Disturb", apps: ["Settings"] }, { k: "If", t: "A message is from Maya, let it through", apps: ["Messages", "Contacts"] }, { k: "Write", t: "A summary of what I missed", apps: [] }, { k: "Notify", t: "A notification when the block ends", apps: [] }],
    runs: [
      { id: "r21", when: "Today, 11:00 AM", status: "ok", sum: "Held 5 notifications, let Maya through once", dur: "1 h 30 min",
        log: [["When", "Deep work started at 11:00 AM.", "ok"], ["Do", "Turned on Do Not Disturb.", "ok"], ["If", "Maya texted at 11:42. Let it through. Held 4 others.", "ok"], ["Write", "Summarized 5 held notifications.", "ok"], ["Notify", "Sent the summary at 12:30 PM.", "ok"]],
        out: "While you were focused: Jordan emailed the term sheet, Priya confirmed lunch, 3 newsletters." },
      { id: "r22", when: "Yesterday", status: "skip", sum: "No deep-work block", dur: "",
        log: [["When", "No deep-work event on your calendar yesterday.", "skip"]], out: "" }
    ] },
  { id: 3, name: "Receipts to Files", on: true,
    short: "Saves receipts from Mail and logs the amount",
    summary: "Receipts from Mail go to Files › Receipts, and the amount goes to Wallet.",
    trig: { kind: "email", match: "receipt" },
    steps: [{ k: "Do", t: "Save the attachment to Files", apps: ["Files"] }, { k: "Do", t: "Add the amount to Wallet", apps: ["Wallet"] }],
    runs: [
      { id: "r31", when: "Today, 9:14 AM", status: "fail", sum: "PDF was password-protected", dur: "",
        log: [["When", "An email from Delta matched “receipt”.", "ok"], ["Do", "Couldn't open the PDF. It's password-protected.", "fail"], ["Do", "Didn't add an amount, since there was nothing to read.", "skip"]],
        out: "", fix: "Ask me to open it with your Delta password, or forward the receipt without a password." },
      { id: "r32", when: "Yesterday, 6:05 PM", status: "ok", sum: "Saved Blue Bottle receipt · $6.50", dur: "4 s",
        log: [["When", "An email from Blue Bottle matched “receipt”.", "ok"], ["Do", "Saved receipt-0928.pdf to Files › Receipts.", "ok"], ["Do", "Added $6.50 to Wallet under Food.", "ok"]], out: "" }
    ] },
  { id: 4, name: "Weekly review", on: false,
    short: "One-page recap of your week, Fridays at 5",
    summary: "Fridays at 5, a one-page recap of your week's calendar, notes and sent mail, saved to Notes.",
    trig: { kind: "time", days: "Fridays", t: 17 },
    steps: [{ k: "Read", t: "This week's calendar, notes and sent mail", apps: ["Calendar", "Notes", "Mail"] }, { k: "Write", t: "A note in Notes", apps: ["Notes"] }],
    runs: [
      { id: "r41", when: "Sep 18, 5:00 PM", status: "ok", sum: "Wrote “Week of Sep 14” in Notes", dur: "40 s",
        log: [["When", "Friday, 5:00 PM.", "ok"], ["Read", "22 events, 6 notes, 31 sent emails.", "ok"], ["Write", "Saved a one-page review to Notes.", "ok"]], out: "" }
    ] }
];

function wfAmpm(t) { var h = Math.floor(t), m = Math.round((t - h) * 60); return (h % 12 || 12) + ":" + pad2(m) + " " + (h >= 12 ? "PM" : "AM"); }
function wfTrigText(tr, api) {
  if (!tr) return "";
  if (tr.kind === "time") return (tr.days || "Every day") + " at " + wfAmpm(tr.t == null ? 18 : tr.t);
  if (tr.kind === "event") return tr.ev || WF_EVENTS[0][0];
  if (tr.kind === "message") { var p = api.person(tr.person || "maya"); return (p ? p.name.split(" ")[0] : "Someone") + " texts me"; }
  if (tr.kind === "location") return tr.place || WF_PLACES[0];
  if (tr.kind === "email") return "An email mentions “" + (tr.match || "receipt") + "”";
  return tr.text || "";
}
function wfTrigApps(tr) {
  if (!tr) return [];
  if (tr.kind === "event") return ["Calendar"];
  if (tr.kind === "message") return ["Messages", "Contacts"];
  if (tr.kind === "location") return ["Location"];
  if (tr.kind === "email") return ["Mail"];
  return [];
}
function wfApps(f) {
  var all = wfTrigApps(f.trig); (f.steps || []).forEach(function (s) { all = all.concat(s.apps || []); });
  var out = []; all.forEach(function (a) { if (out.indexOf(a) < 0) out.push(a); });
  return out;
}
function wfLc(s) {
  if (!s) return "";
  var w = s.split(/[\s,.']/)[0];
  var keep = /^(I|Mon|Tue|Wed|Thu|Fri|Sat|Sun|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/.test(w) || /^[A-Z]{2,}/.test(w) || PEOPLE.some(function (p) { return p.name.split(" ")[0] === w; });
  return keep ? s : s.charAt(0).toLowerCase() + s.slice(1);
}
function wfClause(s) {
  var t = wfLc(s.t);
  if (s.k === "Read") return "reads " + t.replace(/^(the )?/, "");
  if (s.k === "If") return "checks whether " + t.replace(/^(if )/, "");
  if (s.k === "Write") return "writes " + t;
  if (s.k === "Send") return "sends " + t;
  if (s.k === "Notify") return "sends you " + t;
  if (s.k === "Speak") return /^read it aloud/.test(t) ? "reads it aloud" : "speaks it " + t.replace(/^speak it /, "");
  return t;
}
function wfSummary(f, api) {
  var tr = wfTrigText(f.trig, api);
  var cl = (f.steps || []).map(wfClause);
  var join = cl.length > 1 ? cl.slice(0, -1).join(", ") + " and " + cl[cl.length - 1] : (cl[0] || "does nothing yet");
  var lead = f.trig && f.trig.kind === "time" ? tr : "When " + wfLc(tr);
  return lead + ", " + api.name + " " + join + ".";
}
function wfShort(f, api) {
  var tr = wfTrigText(f.trig, api); var steps = f.steps || [];
  var main = steps.filter(function (s) { return /Write|Send|Speak|Do/.test(s.k); }).slice(-1)[0] || steps[steps.length - 1];
  var lead = f.trig && f.trig.kind === "time" ? tr : "When " + wfLc(tr);
  return main ? lead + ": " + wfLc(main.t).replace(/\.$/, "") + "." : lead + ".";
}
// MVP-DEFERRED: retain original fixtures, but do not offer or simulate flows
// that depend on Phone/SMS/Contacts/Wallet. Restore only with the product scope gate.
function wfAppAllowed(name) {
  var view = { Phone: "phone", Messages: "messages", Contacts: "contacts", Wallet: "wallet" }[name];
  return !view || isMvpView(view);
}
// Only explicit deferred requests are rejected here; mentions such as
// "summarize call notes" remain valid. Saved flow admission uses typed apps/triggers.
function wfDeferredRequest(text) {
  return /(?:^|,)\s*(?:call|dial|sms|text)\b|\b(?:add|log|save)\b[^,]{0,60}\b(?:to|in)\s+(?:my\s+)?wallet\b|\bsend\s+(?:an?\s+)?(?:sms|text message)\b/i.test(text);
}
function wfAllowed(f) {
  return !!f && !!f.trig && (f.trig.kind !== "message" || isMvpView("messages")) &&
    Array.isArray(f.steps) && f.steps.every(function (s) { return Array.isArray(s.apps) && s.apps.every(wfAppAllowed); });
}
function wfPresets(kind) { return (WF_KINDS[kind].presets || []).filter(function (p) { return p[1].every(wfAppAllowed); }); }
function wfRawFlows(api) { return api.get("workflows").flows || WF_SEED; }
function wfFlows(api) { return wfRawFlows(api).filter(wfAllowed); }
// Editing an enabled fixture must not erase retained out-of-scope user records.
function wfMerge(api, enabled) { return wfRawFlows(api).filter(function (f) { return !wfAllowed(f); }).concat(enabled.filter(wfAllowed)); }
function wfDeferred(api) { api.toast("This workflow is deferred from the MVP"); }
function wfFind(list, id) { for (var i = 0; i < list.length; i++) if (String(list[i].id) === String(id)) return list[i]; return null; }
function wfMatch(list, t) {
  var best = null, sc = 0;
  list.forEach(function (f) { var w = f.name.toLowerCase().split(/\s+/).filter(function (x) { return x.length > 2; }); var s = 0; w.forEach(function (x) { if (t.indexOf(x) >= 0) s++; }); if (s > sc) { sc = s; best = f; } });
  return best;
}
function wfFromText(t, raw, api) {
  // Turn "every weekday at 6, wrap up my day" / "whenever maya texts, check my calendar" into a flow.
  var trig = null, m;
  if ((m = t.match(/whenever\s+(\w+)\s+(texts|messages|writes|emails)/))) {
    var p = PEOPLE.filter(function (x) { return x.name.split(" ")[0].toLowerCase() === m[1]; })[0];
    trig = m[2] === "emails" ? { kind: "email", match: m[1] } : { kind: "message", person: p ? p.id : m[1] };
  } else if ((m = t.match(/when(?:ever)?\s+i\s+(get|arrive|leave)\s+(home|to work|work)/))) {
    trig = { kind: "location", place: m[1] === "leave" ? "I leave home" : (/work/.test(m[2]) ? "I arrive at work" : "I arrive home") };
  } else if ((m = t.match(/(?:email|mail).{0,20}(?:about|mentions|with|matching)\s+(\w+)/))) {
    trig = { kind: "email", match: m[1] };
  } else {
    var days = /weekday/.test(t) ? "Weekdays" : (/weekend/.test(t) ? "Weekends" : (/monday/.test(t) ? "Mondays" : (/friday/.test(t) ? "Fridays" : "Every day")));
    var h = 18, tm = t.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
    if (tm) { h = +tm[1] + (tm[2] ? +tm[2] / 60 : 0); if (tm[3] === "pm" && h < 12) h += 12; else if (!tm[3] && h < 7) h += 12; }
    else if (/morning/.test(t)) h = 8; else if (/evening|night/.test(t)) h = 18;
    trig = { kind: "time", days: days, t: h };
  }
  var rest = (raw.split(/,\s*/).slice(1).join(", ") || "").trim();
  var steps, name;
  if (/wrap up|wrap-up|end of (the )?day/.test(t)) {
    name = "Evening wrap-up";
    steps = [{ k: "Read", t: "Today's calendar, notes and sent mail", apps: ["Calendar", "Notes", "Mail"] }, { k: "Write", t: "A short wrap-up with tomorrow's first three tasks", apps: [] }, { k: "Notify", t: "A notification", apps: [] }];
  } else if (/calendar|free|availab/.test(t) && trig.kind === "message") {
    var sender = api.person(trig.person);
    name = (sender ? sender.name.split(" ")[0] : "Message") + "'s scheduling";
    steps = [{ k: "If", t: "The message asks about timing", apps: [] }, { k: "Read", t: "My calendar for the next 3 days", apps: ["Calendar"] }, { k: "Write", t: "A draft reply with two free slots", apps: [] }, { k: "Notify", t: "A notification with the draft", apps: [] }];
  } else if ((m = rest.match(/^remind me (?:to )?(.+)/i))) {
    var todo = m[1].replace(/[.!?]$/, "");
    name = cap(todo.split(/\s+/).slice(0, 3).join(" "));
    steps = [{ k: "Notify", t: "A reminder to " + todo, apps: [] }];
  } else {
    var what = rest || "a short summary";
    name = cap(what.split(/\s+/).slice(0, 3).join(" ").replace(/[.!?]$/, ""));
    steps = [{ k: "Read", t: /mail|inbox|email/.test(t) ? "Unread mail" : "Today's calendar", apps: [/mail|inbox|email/.test(t) ? "Mail" : "Calendar"] }, { k: "Write", t: cap(what.replace(/[.!?]$/, "")), apps: [] }, { k: "Notify", t: "A notification", apps: [] }];
  }
  var f = { name: name, trig: trig, steps: steps, on: true };
  f.summary = wfSummary(f, api);
  f.short = wfShort(f, api);
  return f;
}
function wfRunLog(f, api) {
  var tr = wfTrigText(f.trig, api);
  return [["When", "Started by you, now. (Normally: " + wfLc(tr) + ".)", "ok"]].concat(f.steps.map(function (s) {
    var t = wfLc(s.t), r;
    if (s.k === "Read") r = "Read " + t + ". Nothing unusual.";
    else if (s.k === "If") r = "Checked: " + t + ". Yes, continued.";
    else if (s.k === "Write") r = "Wrote " + t + ".";
    else if (s.k === "Send") r = "Sent " + t + ".";
    else if (s.k === "Notify") r = "Sent you " + t + ".";
    else if (s.k === "Speak") r = "Spoke it aloud (32 s).";
    else r = "Did it: " + t + ".";
    return [s.k, r, "ok"];
  }));
}
function wfNowLabel(api) { var d = api.now; return "Today, " + wfAmpm(d.getHours() + d.getMinutes() / 60); }
function wfBlank() { return { id: null, name: "", trig: { kind: "time", days: "Weekdays", t: 18 }, steps: [] }; }

registerView("workflows", {
  title: "Workflows", icon: "flow", aliases: ["automations", "routines", "flows"],
  state: { flows: WF_SEED, open: null, run: null, build: null, create: false, sheet: null, running: null },
  persist: ["flows"],
  jumps: [[null, "Workflows"], ["flow", "Workflow"], ["run", "Run log"], ["failed", "Failed run"], ["new", "Build workflow"]],
  preset: function (sub) {
    if (sub === "flow") return { open: 1 };
    if (sub === "run") return { open: 1, run: "latest" };
    if (sub === "failed") return { open: 3, run: "r31" };
    if (sub === "new") return { create: true };
  },
  immersive: function (st) { return (st.build || st.create) && st.sheet ? { noPill: true } : null; },
  badge: function (st) { return (st.flows || WF_SEED).filter(wfAllowed).some(function (f) { return f.on && f.runs && f.runs[0] && f.runs[0].status === "fail"; }); },
  suggestions: function (st) {
    if (st.build || st.create) return ["Every weekday at 6, wrap up my day"];
    var f = st.open != null ? wfFind((st.flows || WF_SEED).filter(wfAllowed), st.open) : null;
    if (f) return ["Run " + f.name + " now", "Why did " + f.name + " run?", "Turn off " + f.name];
    return ["Every weekday at 6, wrap up my day", "Why did Morning brief run?"];
  },
  voicePhrase: "Every weekday at 6, wrap up my day",
  back: function (st, api) {
    if (st.sheet) { api.set({ sheet: null }); return true; }
    if (st.build || st.create) { api.set({ build: null, create: false }); return true; }
    if (st.run) { api.set({ run: null }); return true; }
    if (st.open != null) { api.set({ open: null }); return true; }
    return false;
  },
  actions: {
    enable: function (card, api) {
      if (!wfAllowed(card.flow)) return wfDeferred(api);
      var f = Object.assign({}, card.flow, { id: Date.now(), on: true, runs: [] });
      api.set({ flows: wfMerge(api, wfFlows(api).concat([f])) });
      api.toast(f.name + " is on");
    }
  },
  reply: function (t, raw, api) {
    var list = wfFlows(api); var st = api.get("workflows");
    var cur = st.open != null ? wfFind(list, st.open) : null;
    var setFlows = function (l) { api.setView("workflows", { flows: wfMerge(api, l) }); };
    var pick = function (s) { return /\b(this|it)\b/.test(s) && cur ? cur : wfMatch(list, s); };

    // why did X run / fail / skip
    var why = t.match(/why did\s+(.+?)\s+(run|fail|skip|not run|stop)/) || t.match(/why (?:is|was)\s+(.+?)\s+(failing|failed|skipped)/);
    if (why) {
      var f = pick(why[1]); if (!f || !f.runs || !f.runs.length) return null;
      var want = /fail/.test(why[2]) ? "fail" : (/skip/.test(why[2]) ? "skip" : null);
      var r = (want && f.runs.filter(function (x) { return x.status === want; })[0]) || f.runs[0];
      var bad = r.log.filter(function (l) { return l[2] !== "ok"; })[0];
      var text = r.status === "fail" ? f.name + " failed " + wfLc(r.when) + ". " + bad[1] + (r.fix ? " " + r.fix : "")
        : (r.status === "skip" ? f.name + " was skipped " + wfLc(r.when) + ". " + (bad ? bad[1] : "") : f.name + " last ran " + wfLc(r.when) + ". " + r.log[0][1] + " " + r.sum + ".");
      return { text: text, card: { type: "generic", icon: r.status === "fail" ? "info" : "flow", title: f.name, sub: r.when + " · " + r.sum, go: { view: "workflows", patch: { open: f.id, run: r.id, build: null, sheet: null } } } };
    }
    // turn on / off
    var tg = t.match(/\b(turn|switch)\s+(on|off)\s+(?:the\s+|my\s+)?(.+)|\b(pause|disable|stop|enable|resume)\s+(?:the\s+|my\s+)?(.+)/);
    if (tg) {
      var target = pick(tg[3] || tg[5] || ""); if (!target) return null;
      var onNow = tg[2] ? tg[2] === "on" : /enable|resume/.test(tg[4]);
      return { text: target.name + " is " + (onNow ? "on." : "off. I won't run it until you turn it back on."), card: { type: "generic", icon: "flow", title: target.name, sub: onNow ? "On" : "Off", go: { view: "workflows", patch: { open: target.id, run: null } } },
        then: function () { setFlows(wfFlows(api).map(function (x) { return x.id === target.id ? Object.assign({}, x, { on: onNow }) : x; })); } };
    }
    // run now
    var rn = t.match(/^run\s+(.+?)(\s+now)?$/);
    if (rn) {
      var rf = pick(rn[1]); if (!rf) return null;
      var run = { id: "r" + Date.now(), when: wfNowLabel(api), status: "ok", sum: "Ran on request", dur: "3 s", log: wfRunLog(rf, api), out: "" };
      return { text: "Ran " + rf.name + ". Everything went through.", card: { type: "generic", icon: "check", title: rf.name, sub: run.when + " · Ran on request", go: { view: "workflows", patch: { open: rf.id, run: run.id } } },
        then: function () { setFlows(wfFlows(api).map(function (x) { return x.id === rf.id ? Object.assign({}, x, { runs: [run].concat(x.runs || []) }) : x; })); } };
    }
    // delete
    var dl = t.match(/\b(delete|remove)\s+(?:the\s+)?(.+?)\s+workflow|\b(delete|remove)\s+workflow\s+(.+)/);
    if (dl) {
      var df = pick(dl[2] || dl[4]); if (!df) return null;
      return { text: "Deleted " + df.name + ".", then: function () { setFlows(wfFlows(api).filter(function (x) { return x.id !== df.id; })); var s2 = api.get("workflows"); if (String(s2.open) === String(df.id)) api.setView("workflows", { open: null, run: null }); } };
    }
    // create
    if (/^(every|whenever|each)\b|\bevery (day|weekday|morning|evening|night|week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|\bwhenever\b|\bwhen i (get|arrive|leave)\b|automate|new workflow/.test(t)) {
      if (wfDeferredRequest(raw)) return { text: "This workflow is deferred from the MVP." };
      var nf = wfFromText(t, raw, api);
      if (!wfAllowed(nf)) return { text: "This workflow is deferred from the MVP." };
      return { text: "Here's the workflow. Turn it on?", card: { type: "flow", name: nf.name, short: nf.summary, flow: nf, act: { mod: "workflows", fn: "enable" } } };
    }
    return null;
  },
  render: function (st, api) {
    var list = (st.flows || WF_SEED).filter(wfAllowed);
    var set = function (p) { if (p.flows) p = Object.assign({}, p, { flows: wfMerge(api, p.flows) }); api.set(p); };
    var setFlow = function (id, p) { set({ flows: list.map(function (x) { return x.id === id ? Object.assign({}, x, p) : x; }) }); };
    var toggle = function (f) { return function () { if (!wfAllowed(f)) return wfDeferred(api); setFlow(f.id, { on: !f.on }); api.toast(f.name + (f.on ? " is off" : " is on")); }; };
    var chipsOf = function (f) { return wfApps(f).map(function (a) { return { name: a, d: IC[WF_APP_IC[a]] || IC.grid }; }); };

    var cards = list.map(function (f) {
      var last = f.runs && f.runs[0];
      var failed = f.on && last && last.status === "fail";
      return { name: f.name, short: failed ? "Failed · " + last.sum : f.short, failed: failed, on: f.on, track: api.track(f.on), kx: api.kx(f.on), dim: f.on ? "" : "opacity:.55",
        open: function () { set({ open: f.id, run: null }); }, toggle: toggle(f) };
    });

    var diagram = function (trig, steps, opts) {
      opts = opts || {};
      var tIcon = { time: "clock", event: "cal", message: "bubble", location: "pin", email: "mail" }[(trig || {}).kind] || "wfDo";
      var all = [{ k: "When", t: wfTrigText(trig, api), icon: tIcon }].concat(steps);
      return all.map(function (s, i) {
        var isTrig = i === 0; var last = i === all.length - 1 && !opts.more;
        var lit = opts.running != null && i <= opts.running;
        var active = opts.running === i;
        return { k: s.k, t: s.t, d: IC[s.icon || (WF_KINDS[s.k] || {}).icon] || IC.wfDo, label: s.k,
          dotCss: isTrig || lit ? "background:var(--acct);color:var(--bg)" : "background:var(--bg);color:var(--acct);box-shadow:inset 0 0 0 1.5px var(--line)",
          lineColor: last ? "transparent" : (lit && opts.running > i ? "var(--acct)" : "var(--line)"),
          boxCss: active ? "background:var(--s2);box-shadow:inset 0 0 0 2px var(--acct)" : "background:var(--s2)",
          kindColor: isTrig ? "rgba(255,255,255,.75)" : "var(--mut)",
          tap: opts.tap ? opts.tap(i) : function () {} };
      });
    };

    // detail
    var f = st.open != null ? wfFind(list, st.open) : null;
    var D = null;
    var undo = function (label, f0, idx) {
      api.toast(label, { undo: function () { var l = wfFlows(api).slice(); if (!wfFind(l, f0.id)) { l.splice(Math.min(idx, l.length), 0, f0); api.setView("workflows", { flows: wfMerge(api, l) }); } } });
    };
    if (f) {
      var running = st.running && st.running.id === f.id ? st.running.i : null;
      var runs = (f.runs || []).map(function (r) {
        return { when: r.when, sum: r.sum, d: r.status === "ok" ? IC.check : (r.status === "fail" ? IC.x : IC.wfSkip),
          css: r.status === "ok" ? "background:var(--acct);color:var(--bg)" : (r.status === "fail" ? "background:var(--fg);color:var(--bg)" : "background:var(--s3);color:var(--fg)"),
          label: r.when + ", " + (r.status === "ok" ? "succeeded" : r.status === "fail" ? "failed" : "skipped"),
          open: function () { set({ run: r.id }); } };
      });
      var last = f.runs && f.runs[0];
      D = {
        name: f.name, summary: f.summary, on: f.on, track: api.track(f.on), kx: api.kx(f.on), toggle: toggle(f),
        apps: chipsOf(f), hasApps: wfApps(f).length > 0,
        steps: diagram(f.trig, f.steps, { running: running }),
        isRunning: running != null, notRunning: running == null,
        last: running != null ? "Running…" : (!f.on ? "Off" : (last ? "Last run " + wfLc(last.when) : "Not run yet")),
        deleteLabel: 'Delete workflow', lifecycleReview: false,
        runs: runs, hasRuns: runs.length > 0,
        close: function () { set({ open: null }); },
        edit: function () { set({ build: { id: f.id, name: f.name, trig: Object.assign({}, f.trig), steps: f.steps.map(function (s) { return Object.assign({}, s); }) } }); },
        del: function () { var idx = list.indexOf(f); set({ flows: list.filter(function (x) { return x.id !== f.id; }), open: null, run: null }); undo(f.name + " deleted", f, idx); },
        run: function () {
          if (!wfAllowed(f)) return wfDeferred(api);
          if (st.running) return;
          var n = f.steps.length + 1;
          set({ running: { id: f.id, i: 0 } });
          for (var i = 1; i < n; i++) (function (i) { api.later(function () { api.setView("workflows", { running: { id: f.id, i: i } }); }, 550 * i); })(i);
          api.later(function () {
            if (!wfAllowed(f)) return wfDeferred(api);
            var cur = wfFlows(api); var run = { id: "r" + Date.now(), when: wfNowLabel(api), status: "ok", sum: "Ran on request", dur: (n * 0.6).toFixed(0) + " s", log: wfRunLog(f, api), out: "" };
            api.setView("workflows", { running: null, flows: wfMerge(api, cur.map(function (x) { return x.id === f.id ? Object.assign({}, x, { runs: [run].concat(x.runs || []) }) : x; })) });
            api.toast(f.name + " ran");
          }, 550 * n + 200);
        }
      };
    }

    // run detail
    var R = null;
    var rr = f && st.run ? (st.run === "latest" ? (f.runs || [])[0] : (f.runs || []).filter(function (r) { return r.id === st.run; })[0]) : null;
    if (rr) {
      R = {
        when: rr.when, flow: f.name, againLabel: "Run again", againAria: "Run again", againDisabled: false, askLabel: "Explain", askAria: "Ask " + api.name + " about this run",
        status: rr.status === "ok" ? "Succeeded" + (rr.dur ? " · " + rr.dur : "") : (rr.status === "fail" ? "Failed" : "Skipped"),
        sd: rr.status === "ok" ? IC.check : (rr.status === "fail" ? IC.x : IC.wfSkip),
        scss: rr.status === "ok" ? "background:var(--acct);color:var(--bg)" : (rr.status === "fail" ? "background:var(--fg);color:var(--bg)" : "background:var(--s3);color:var(--fg)"),
        log: rr.log.map(function (l, i) {
          return { k: l[0], t: l[1], kd: IC[(WF_KINDS[l[0]] || {}).icon] || IC.wfDo, d: l[2] === "ok" ? IC.check : (l[2] === "fail" ? IC.x : IC.wfSkip),
            css: l[2] === "ok" ? "background:var(--acct);color:var(--bg)" : (l[2] === "fail" ? "background:var(--fg);color:var(--bg)" : "background:var(--s3);color:var(--mut)"),
            line: i === rr.log.length - 1 ? "transparent" : "var(--line)", tcss: l[2] === "skip" ? "color:var(--mut)" : "" };
        }),
        hasOut: !!rr.out, out: rr.out, hasFix: !!rr.fix, fix: rr.fix || "",
        close: function () { set({ run: null }); },
        ask: function () { api.send("Why did " + f.name + " " + (rr.status === "fail" ? "fail" : (rr.status === "skip" ? "skip" : "run")) + "?"); },
        again: function () { set({ run: null }); if (D) D.run(); }
      };
    }

    // builder
    var b = st.build || (st.create ? wfBlank() : null); var B = null;
    if (b && !wfAllowed(b)) b = null; // Restored deferred drafts stay retained, never executable.
    if (b) {
      var set0 = set; set = function (p) { set0(Object.assign({ create: false }, p)); };
      var bp = function (p) { set({ build: Object.assign({}, b, p) }); };
      var sheet = st.sheet;
      B = {
        fullEditor: true, metadataOnly: false, isNew: !b.id, name: b.name, onName: function (e) { bp({ name: e.target.value }); },
        steps: diagram(b.trig, b.steps, { more: true, tap: function (i) { return function () { set({ sheet: i === 0 ? { type: "trig" } : { type: "step", i: i - 1 } }); }; } }),
        palette: WF_PALETTE.filter(function (k) { return wfPresets(k).length > 0; }).map(function (k) {
          return { k: k, d: IC[WF_KINDS[k].icon], label: "Add " + k + " step",
            add: function () { var p = wfPresets(k)[0]; if (!p) return wfDeferred(api); var steps = b.steps.concat([{ k: k, t: p[0], apps: p[1].slice() }]); set({ build: Object.assign({}, b, { steps: steps }), sheet: { type: "step", i: steps.length - 1 } }); } };
        }),
        apps: chipsOf(b), hasApps: wfApps(b).length > 0, empty: b.steps.length === 0,
        saveOff: b.steps.length === 0, saveCss: b.steps.length ? "background:var(--acc);color:#fff" : "background:var(--s2);color:var(--mut)",
        describe: function () { set({ build: null }); api.chat("Every weekday at 6, "); },
        cancel: function () { set({ build: null, sheet: null }); },
        save: function () {
          if (!wfAllowed(b)) return wfDeferred(api);
          if (!b.steps.length) return;
          var name = (b.name || "").trim() || (b.steps[b.steps.length - 1].k === "Write" ? cap(wfLc(b.steps[b.steps.length - 1].t)) : wfTrigText(b.trig, api));
          var nf = { name: name, trig: b.trig, steps: b.steps };
          nf.summary = wfSummary(nf, api); nf.short = wfShort(nf, api);
          if (b.id) { set({ flows: list.map(function (x) { return x.id === b.id ? Object.assign({}, x, nf) : x; }), build: null, sheet: null }); api.toast("Saved"); }
          else { var id = Date.now(); set({ flows: list.concat([Object.assign(nf, { id: id, on: true, runs: [] })]), build: null, sheet: null, open: id }); api.toast(name + " is on"); }
        },
        sheetOn: !!sheet, closeSheet: function () { set({ sheet: null }); },
        isTrig: !!sheet && sheet.type === "trig", isStep: !!sheet && sheet.type === "step"
      };
      if (sheet && sheet.type === "trig") {
        var tr = b.trig; var tp = function (p) { bp({ trig: Object.assign({}, tr, p) }); };
        var chip = function (on) { return on ? "background:var(--fg);color:var(--bg)" : "background:var(--s2)"; };
        B.tr = {
          kinds: WF_TRIG.filter(function (k) { return k[0] !== "message" || isMvpView("messages"); }).map(function (k) { var on = tr.kind === k[0]; return { d: IC[k[1]], label: k[2], css: on ? "background:var(--acc);color:#fff" : "background:var(--s2)", pressed: on, pick: function () { bp({ trig: { kind: k[0], days: "Weekdays", t: 18, ev: WF_EVENTS[0][0], person: "maya", place: WF_PLACES[0], match: "receipt" } }); } }; }),
          text: wfTrigText(tr, api),
          isTime: tr.kind === "time", isEvent: tr.kind === "event", isMsg: tr.kind === "message", isPlace: tr.kind === "location", isEmail: tr.kind === "email",
          days: WF_DAYS.map(function (d) { return { label: d, css: chip(tr.days === d), pick: function () { tp({ days: d }); } }; }),
          time: wfAmpm(tr.t == null ? 18 : tr.t), tMinus: function () { tp({ t: Math.max(0, (tr.t || 0) - 0.5) }); }, tPlus: function () { tp({ t: Math.min(23.5, (tr.t || 0) + 0.5) }); },
          evs: WF_EVENTS.map(function (e) { return { label: e[0], css: chip(tr.ev === e[0]), pick: function () { tp({ ev: e[0] }); } }; }),
          places: WF_PLACES.map(function (p) { return { label: p, css: chip(tr.place === p), pick: function () { tp({ place: p }); } }; }),
          people: PEOPLE.map(function (p) { var on = tr.person === p.id; return { ini: p.ini, first: p.name.split(" ")[0], css: on ? "background:var(--acc);color:#fff" : "background:var(--s2)", pick: function () { tp({ person: p.id }); } }; }),
          match: tr.match || "", onMatch: function (e) { tp({ match: e.target.value }); }
        };
      }
      if (sheet && sheet.type === "step" && b.steps[sheet.i]) {
        var i = sheet.i; var s = b.steps[i];
        var sp = function (p) { var steps = b.steps.slice(); steps[i] = Object.assign({}, s, p); bp({ steps: steps }); };
        var mv = function (dir) { return function () { var j = i + dir; if (j < 0 || j >= b.steps.length) return; var steps = b.steps.slice(); var tmp = steps[i]; steps[i] = steps[j]; steps[j] = tmp; set({ build: Object.assign({}, b, { steps: steps }), sheet: { type: "step", i: j } }); }; };
        B.sp = {
          k: s.k, d: IC[WF_KINDS[s.k].icon], text: s.t, onText: function (e) { sp({ t: e.target.value }); },
          presets: wfPresets(s.k).map(function (p) { var on = s.t === p[0]; return { label: p[0], on: on, css: on ? "background:var(--acc);color:#fff" : "background:var(--s2)", pick: function () { sp({ t: p[0], apps: p[1].slice() }); } }; }),
          canUp: i > 0, canDown: i < b.steps.length - 1, up: mv(-1), down: mv(1),
          upCss: i > 0 ? "" : "opacity:.3", downCss: i < b.steps.length - 1 ? "" : "opacity:.3",
          del: function () { set({ build: Object.assign({}, b, { steps: b.steps.filter(function (_, j) { return j !== i; }) }), sheet: null }); }
        };
      }
    }

    return {
      cards: cards,
      newFlow: function () { set({ build: wfBlank(), sheet: null }); },
      detail: !!D, fd: D,
      runOpen: !!R, r: R,
      builder: !!B, b: B,
      noop: function () {}
    };
  }
});

/* ===== module: settings ===== */
/* Settings. One stack renderer: stack[0] is the top level, stack[1..] are sub-pages; every page is data
   (hero + groups of typed rows) so every page gets the same back behaviour and the same row styles. */
IC.stDownload = IC.stDownload || "M12 4v11M7 10l5 5 5-5M5 20h14";
IC.stBattery = IC.stBattery || "M3 8h15v8H3zM21 11v2";
IC.stSignal = IC.stSignal || "M5 18v-3M10 18v-6M15 18v-9M20 18V6";
IC.stSpeaker = IC.stSpeaker || "M4 9h4l5-4v14l-5-4H4zM17 9a4 4 0 0 1 0 6";
IC.stText = IC.stText || "M5 6h14M12 6v13M9 19h6";
IC.stList = IC.stList || "M4 6h16M4 12h16M4 18h10";
IC.stHeadph = IC.stHeadph || "M4 15v-3a8 8 0 0 1 16 0v3M4 15h3v5H4zM17 15h3v5h-3z";
IC.stCar = IC.stCar || "M4 16v-4l2-5h12l2 5v4zM4 16v2M20 16v2M7 13h.01M17 13h.01";
IC.stUndo = IC.stUndo || "M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3";
IC.stAt = IC.stAt || "M16 12a4 4 0 1 1-8 0a4 4 0 1 1 8 0zM16 12v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-4 7.5";

var ST_PROV = [
  { id: "google", name: "Google", sub: isMvpView("contacts") ? "Gmail, Calendar, Contacts" : "Gmail, Calendar", dom: "gmail.example", web: "accounts.google.example", oauth: true },
  { id: "microsoft", name: "Microsoft", sub: "Outlook, Exchange", dom: "outlook.example", web: "login.microsoft.example", oauth: true },
  { id: "icloud", name: "iCloud", sub: isMvpView("contacts") ? "Mail, Calendar, Contacts" : "Mail, Calendar", dom: "icloud.example", web: "", oauth: false },
  { id: "other", name: "Other", sub: isMvpView("contacts") ? "IMAP · CalDAV · CardDAV" : "IMAP · CalDAV", dom: "mail.example", web: "", oauth: false }
];
// MVP-DEFERRED: Contacts account and permission controls follow the same profile
// as navigation. Restore only after the scope and native acceptance gates there.
var ST_TYPES = [["mail", "Mail", "mail"], ["calendar", "Calendar", "cal"], ["contacts", "Contacts", "user"]].filter(function (x) { return x[0] !== "contacts" || isMvpView("contacts"); });
var ST_CONNS = [
  { id: "slack", name: "Slack", scopes: ["Read channels you're in", "Send messages you approve"] },
  { id: "github", name: "GitHub", scopes: ["Read repositories and issues", "Open issues and comment"] },
  { id: "notion", name: "Notion", scopes: ["Read pages you share with Alpha", "Create pages in one workspace"] },
  { id: "linear", name: "Linear", scopes: ["Read your issues", "Create and update issues"] },
  { id: "figma", name: "Figma", scopes: ["Read files you open", "Leave comments you approve"] },
  { id: "spotify", name: "Spotify", scopes: ["See what's playing", "Control playback"] }
];
var ST_NETS = [
  { id: "home", name: "Alpha Home", lock: true, sig: "Strong" },
  { id: "studio", name: "Studio 5G", lock: true, sig: "Strong" },
  { id: "ritual", name: "Ritual Coffee", lock: false, sig: "Good" },
  { id: "n24", name: "Neighbors_2.4", lock: true, sig: "Weak" }
];
var ST_BT = [
  { id: "buds", name: "Pixel Buds Pro 2", d: "stHeadph", on: true },
  { id: "car", name: "Car", d: "stCar", on: false },
  { id: "kb", name: "Keyboard K3", d: "kbd", on: false }
];
var ST_VOICES = ["Warm", "Bright", "Low", "Neutral"];
var ST_PERMS = [["mic", "Microphone", "mic"], ["loc", "Location", "pin"], ["camera", "Camera", "camera"], ["contacts", "Contacts", "user"]].filter(function (x) { return x[0] !== "contacts" || isMvpView("contacts"); });
var ST_PERM0 = {
  mic: { alpha: true, phone: true, camera: true, notes: true, messages: true },
  loc: { alpha: true, maps: true, camera: true, photos: true },
  camera: { camera: true, messages: true, browser: false },
  contacts: { alpha: true, phone: true, messages: true, inbox: true }
};
var ST_MODELS = [
  { id: "vision", name: "Vision 2B", size: "1.6 GB", pct: -1 },
  { id: "speech", name: "Speech", size: "310 MB", pct: 100 },
  { id: "translate", name: "Translate", size: "900 MB", pct: -1 }
];
var ST_LOG = [
  ["2:15", "Drafted a reply to Maya", "bubble"], ["1:12", "Filed Jordan's term sheet", "mail"], ["12:40", "Moved Gym to 7:30 PM", "cal"],
  ["9:02", "Summarized 14 emails", "inbox"], ["7:10", "Ran Morning brief", "flow"], ["6:00", "Attestation passed", "shield"]
];
var ST_DEVLOG = [
  ["14:15:02", "agent  reply ok 412ms  tokens 188"], ["14:15:01", "memory recall  k=6  hits 4"], ["14:04:11", "npu  load core-7b-q4  1.9s"],
  ["13:12:40", "action calendar.move  signed"], ["06:00:00", "enclave attest  pass"]
];
var ST_TOP = { accounts: "Accounts", character: "Character", privacy: "Privacy & Enclave", notifications: "Notifications", wifi: "Wi-Fi", bluetooth: "Bluetooth", mobile: "Mobile data", display: "Display", sound: "Sound & vibration", battery: "Battery", about: "About", developer: "Developer", connections: "Connections", models: "Models" };

function stRow(kind, o) { var r = Object.assign({ label: "", sub: "", val: "" }, o); r[kind] = true; if (kind === 'kSlider') r.valueLabel = r.v; r.hasSub = !!r.sub; r.hasIcon = !!r.d; r.hasVal = !!r.val; return r; }
function stNav(o) { var r = stRow("kNav", o); if (o.bold) r.labCss0 = "font-weight:600"; r.hasTile = !!r.tile; r.hasTrail = !!r.trail; r.chev = !r.trail && !r.noChev; r.lbl = r.aria || r.label; r.labCss = r.danger ? "color:var(--fg);font-weight:600" : (r.accent ? "color:var(--acct);font-weight:600" : ""); return r; }
function stTog(o, on, fn) { var r = stRow("kTog", o); r.aria = o.aria || r.label; r.on = !!on; r.track = on ? "background:var(--acc)" : "background:var(--s3)"; r.kx = on ? 20 : 0; r.toggle = fn; return r; }
function stSeg(o, opts, cur, fn) {
  var r = stRow("kSeg", o);
  r.opts = opts.map(function (op) { var on = op[0] === cur; return { label: op[1], on: on, aria: (o.label ? o.label + ": " : "") + op[1], css: on ? "background:var(--acc);color:#fff" : "color:var(--mut)", pick: function () { fn(op[0]); } }; });
  return r;
}
function stRemoveAcct(api, id) {
  var s2 = api.get("settings"); var idx = s2.accounts.map(function (x) { return x.id; }).indexOf(id); var ra = s2.accounts[idx]; if (!ra) return;
  api.setView("settings", { acct: null, sheet: null, accounts: s2.accounts.filter(function (x) { return x.id !== id; }) });
  api.toast(ra.address + " removed", { undo: function () { var s3 = api.get("settings"); if (s3.accounts.some(function (x) { return x.id === id; })) return; var l = s3.accounts.slice(); l.splice(Math.min(idx, l.length), 0, ra); api.setView("settings", { accounts: l }); } });
}
function stPlane(api, on) {
  var q = Object.assign({}, api.S.q, { plane: on });
  if (on) { api.setView("settings", { prePlane: { wifi: q.wifi, bt: q.bt } }); q.wifi = false; q.bt = false; }
  else { var pp = api.get("settings").prePlane; if (pp) { q.wifi = pp.wifi; q.bt = pp.bt; } }
  api.shell({ q: q });
}
function stUnscroll() { try { var sc = document.querySelector("[data-screen]"); if (sc) { sc.scrollTop = 0; sc.scrollLeft = 0; } window.scrollTo(0, 0); } catch (e) {} }
/* the prototype page must never scroll (focus/scrollIntoView can nudge the stage); undo it on every commit */
function stNoScroll() { try { if (window.scrollX || window.scrollY) window.scrollTo(0, 0); var sc = document.querySelector("[data-screen]"); if (sc && (sc.scrollTop || sc.scrollLeft)) { sc.scrollTop = 0; sc.scrollLeft = 0; } } catch (e) {} }
function stEmailOk(s) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s || ""); }

registerView("settings", {
  title: "Settings", icon: "gear", aliases: ["preferences", "setting"],
  state: {
    page: null, acct: null, adding: false, addStep: null, addProv: null, addEmail: "", addPw: "", addServer: "", addLvl: null, busy: null,
    perm: null, log: false, sheet: null, pw: "", playing: null, btScan: false, dl: null,
    accounts: [
      { id: "a1", provider: "google", label: "Personal", address: "you@gmail.example", mail: true, calendar: true, contacts: true, access: { mail: "act", calendar: "act", contacts: "read" } },
      { id: "a2", provider: "microsoft", label: "Work", address: "you@alpha.example", mail: true, calendar: true, contacts: false, access: { mail: "read", calendar: "act", contacts: "read" } }
    ],
    conns: { slack: true, github: true },
    char: { voice: 0, brev: 30, tone: 60, init: 45, wake: true, speak: false, proactive: true },
    wifiCur: "home", wifiKnown: ["home", "studio"], btDev: ST_BT, textSize: 50, snd: { media: 60, ring: 80, alarm: 70, vib: true },
    notif: { summaries: true, off: { browser: true, files: true } }, cloud: false, models: ST_MODELS, perms: ST_PERM0,
    mobile: { data: true, roam: false }, memWiped: false, saver: false, cap80: true, verbose: false
  },
  persist: ["accounts", "conns", "char", "wifiCur", "wifiKnown", "btDev", "textSize", "snd", "notif", "cloud", "models", "perms", "mobile", "memWiped", "saver", "cap80", "verbose"],
  jumps: [[null, "Settings"], ["character", "Character"], ["accounts", "Accounts"], ["adding", "Add account"], ["privacy", "Privacy"], ["wifi", "Wi-Fi"]],
  preset: function (sub) {
    if (sub === "adding") return { page: "accounts", adding: true };
    if (sub) return { page: sub };
  },
  immersive: function (st) { return st.sheet ? { noPill: true } : null; },
  suggestions: function (st) {
    if (st.page === "accounts") return ["Connect my work email", "What can Alpha see?"];
    if (st.page === "privacy") return ["What can Alpha see?", "Wipe your memory"];
    if (st.page === "wifi") return ["Connect to Ritual Coffee", "Turn off Wi-Fi"];
    if (st.page === "character") return ["Make your replies shorter", "Call yourself Nova"];
    return ["Turn on dark mode", "Connect my work email", "What can Alpha see?"];
  },
  voicePhrase: "What can you see on my phone?",
  back: function (st, api) {
    if (st.sheet) { api.set({ sheet: null, pw: "" }); return true; }
    var acc = st.page === "accounts", prv = st.page === "privacy";
    if (acc && st.adding) {
      var prev = { signin: null, oauth: "signin", perms: "signin" }[st.addStep || "provider"];
      if (st.addStep && st.addStep !== "done" && prev !== undefined) { api.set({ addStep: prev, busy: null }); return true; }
      api.set({ adding: false, addStep: null, addProv: null, busy: null }); return true;
    }
    if (acc && st.acct) { api.set({ acct: null }); return true; }
    if (prv && st.perm) { api.set({ perm: null }); return true; }
    if (prv && st.log) { api.set({ log: false }); return true; }
    if (st.page) { api.set({ page: null, btScan: false, acct: null, adding: false, addStep: null, perm: null, log: false }); return true; }
    return false;
  },
  actions: {
    openAdd: function (card, api) { api.open("settings", { page: "accounts", adding: true }); }
  },
  reply: function (t, raw, api) {
    var st = api.st; var m;
    var q = function (patch) { var o = Object.assign({}, api.S.q, patch); api.shell({ q: o }); };
    if ((m = t.match(/\b(dark|light) (mode|theme)\b/)) || /\bgo dark\b/.test(t)) {
      var th = m ? m[1] : "dark";
      if (/\b(turn|switch) off\b|\bdisable\b/.test(t)) th = th === "dark" ? "light" : "dark";
      return { text: th === "dark" ? "Dark mode on." : "Light mode on.", card: { type: "generic", icon: th === "dark" ? "moon" : "sun", title: th === "dark" ? "Dark" : "Light", sub: "Display", go: { view: "settings", patch: { page: "display" } } },
        then: function () { api.shell({ theme: th }); } };
    }
    if ((m = raw.match(/\b(?:rename (?:you|yourself|alpha)|call (?:you|yourself)|change your name) (?:to )?([A-Za-z][\w-]{0,15})\b/i)) || (m = raw.match(/\byour name is ([A-Za-z][\w-]{0,15})\b/i))) {
      var nm = m[1].charAt(0).toUpperCase() + m[1].slice(1);
      return { text: "Call me " + nm + " from now on.", card: { type: "generic", icon: "user", title: nm, sub: "Character", go: { view: "settings", patch: { page: "character" } } }, then: function () { api.shell({ charName: nm }); } };
    }
    if (/what (can|do) (you|alpha|\w+) (see|access|read)|what (do )?you have access|what can you do with my/.test(t)) {
      var accs = st.accounts || [];
      var bl = accs.map(function (a) { var on = ST_TYPES.filter(function (x) { return a[x[0]]; }).map(function (x) { return x[1].toLowerCase(); }); return a.address + ": " + (on.length ? on.join(", ") : "nothing"); });
      var cs = ST_CONNS.filter(function (c) { return (st.conns || {})[c.id]; }).map(function (c) { return c.name; });
      bl.push(cs.length ? "Apps: " + cs.join(", ") : "No connected apps");
      bl.push(st.cloud ? "Cloud fallback on, per request" : "Nothing leaves this phone");
      return { text: "Here's everything I can reach. All of it stays in the enclave.", card: { type: "summary", bullets: bl, go: { view: "settings", patch: { page: "privacy" } } } };
    }
    if (/\b(remove|delete|disconnect) (my )?(work|personal) (email|account|mail)\b/.test(t)) {
      var wk = /work/.test(t) ? "Work" : "Personal";
      var ac = (st.accounts || []).filter(function (a) { return a.label === wk; })[0];
      if (!ac) return { text: "There's no " + wk.toLowerCase() + " account connected." };
      return { text: "Removed " + ac.address + ". Undo is at the bottom.", nav: { view: "settings", patch: { page: "accounts", acct: null } }, then: function () { stRemoveAcct(api, ac.id); } };
    }
    if (/\b(connect|add|link|set up|sign in to|sign into)\b.*\b(e-?mail|mail|account|calendar|gmail|outlook|icloud|exchange)\b/.test(t)) {
      if (/\bwork\b/.test(t)) {
        var w = (st.accounts || []).filter(function (a) { return a.label === "Work"; })[0];
        if (w) return { text: "Your work account is already connected: " + w.address + ".", card: { type: "generic", icon: "mail", title: w.address, sub: "Add a different account?", act: { mod: "settings", fn: "openAdd" } }, nav: { view: "settings", patch: { page: "accounts", acct: w.id } } };
      }
      var pv = /gmail|google/.test(t) ? "google" : (/outlook|microsoft|exchange|hotmail/.test(t) ? "microsoft" : (/icloud|apple/.test(t) ? "icloud" : null));
      return { text: pv ? "Sign in and I'll ask what I'm allowed to read." : "Pick your provider and sign in. I'll ask what I'm allowed to read.",
        nav: { view: "settings", patch: { page: "accounts", adding: true, addProv: pv, addStep: pv ? "signin" : null, addEmail: "", addPw: "" } } };
    }
    if ((m = t.match(/\b(turn|switch) (on|off) (the )?(wi-?fi|bluetooth)\b/)) || (m = t.match(/\b()()()(wi-?fi|bluetooth) (on|off)\b/))) {
      var on = (m[2] || m[5]) === "on"; var isW = /wi/.test(m[4]);
      return { text: (isW ? "Wi-Fi " : "Bluetooth ") + (on ? "on." : "off."), then: function () { q(isW ? { wifi: on } : { bt: on }); } };
    }
    if ((m = t.match(/\bairplane mode (on|off)\b|\b(?:turn|switch) (on|off) airplane mode\b/))) {
      var ap = (m[1] || m[2]) === "on";
      return { text: ap ? "Airplane mode on. Wi-Fi and Bluetooth are off." : "Airplane mode off.", then: function () { stPlane(api, ap); } };
    }
    if ((m = t.match(/\bconnect (?:me )?to (?:the )?(.+?)(?: wi-?fi| network)?[.!?]*$/))) {
      var want = m[1].replace(/\s+/g, " ").trim();
      var net = ST_NETS.filter(function (n) { return n.name.toLowerCase().indexOf(want) === 0 || want.indexOf(n.name.toLowerCase()) === 0; })[0];
      if (net) {
        if (!net.lock || (st.wifiKnown || []).indexOf(net.id) >= 0) return { text: "Connected to " + net.name + ".", then: function () { q({ wifi: true }); api.setView("settings", { wifiCur: net.id, wifiKnown: (api.get("settings").wifiKnown || []).concat([net.id]) }); } };
        return { text: net.name + " needs a password.", nav: { view: "settings", patch: { page: "wifi", sheet: { kind: "wifiPw", id: net.id }, pw: "" } }, then: function () { q({ wifi: true }); } };
      }
    }
    if (/\bbrightness\b|\bbrighter\b|\bdimmer\b|\bdim the screen\b/.test(t)) {
      var b = api.S.bright; var pm = t.match(/(\d{1,3})\s*%?/);
      var nb = pm ? Math.min(100, +pm[1]) : (/dim|lower|down|darker/.test(t) ? Math.max(5, b - 25) : Math.min(100, b + 25));
      return { text: "Brightness " + nb + "%.", then: function () { api.shell({ bright: nb }); } };
    }
    if (/\b(bigger|larger|smaller) (text|font)|\btext size\b/.test(t)) {
      var ts = /smaller/.test(t) ? 20 : 80;
      return { text: /smaller/.test(t) ? "Text is smaller." : "Text is bigger.", then: function () { api.setView("settings", { textSize: ts }); } };
    }
    if (/\b(shorter|briefer|more concise|less wordy|longer|more detail(ed)?|more casual|more formal|ask (me )?(first|before)|act first|just do it)\b/.test(t) && /\b(repl|answer|respon|you|casual|formal|ask|act|do it)/.test(t)) {
      var c = Object.assign({}, st.char); var what;
      if (/shorter|briefer|concise|less wordy/.test(t)) { c.brev = Math.max(0, c.brev - 30); what = "Shorter replies from now on."; }
      else if (/longer|more detail/.test(t)) { c.brev = Math.min(100, c.brev + 30); what = "I'll go into more detail."; }
      else if (/casual/.test(t)) { c.tone = Math.min(100, c.tone + 30); what = "Keeping it casual."; }
      else if (/formal/.test(t)) { c.tone = Math.max(0, c.tone - 30); what = "More formal from now on."; }
      else if (/ask/.test(t)) { c.init = Math.max(0, c.init - 35); what = "I'll ask before acting."; }
      else { c.init = Math.min(100, c.init + 35); what = "I'll act first and tell you after."; }
      return { text: what, card: { type: "generic", icon: "user", title: "Personality", sub: "Adjusted", go: { view: "settings", patch: { page: "character" } } }, then: function () { api.setView("settings", { char: c }); } };
    }
    if (/\b(change|switch|pick) (your|the agent'?s?) voice\b|\byour voice\b/.test(t)) return { text: "Tap a voice to hear it.", nav: { view: "settings", patch: { page: "character" } } };
    if (/\bwipe (your |my |the )?memory\b|\bforget everything\b|\bclear (your |the )?memory\b/.test(t)) return { text: "That can't be undone, so confirm on screen.", nav: { view: "settings", patch: { page: "privacy", sheet: { kind: "wipe" } } } };
    if (/\bcloud fallback\b|\buse the cloud\b/.test(t)) {
      var cl = !/\b(off|disable|stop|don't|never)\b/.test(t);
      return { text: cl ? "Cloud fallback on. I'll still ask before sending anything." : "Cloud fallback off. Nothing leaves this phone.", then: function () { api.setView("settings", { cloud: cl }); } };
    }
    if ((m = t.match(/\b(connect|disconnect)\b.*\b(slack|github|notion|linear|figma|spotify)\b/))) {
      var cn = ST_CONNS.filter(function (x) { return x.id === m[2]; })[0];
      if (m[1] === "disconnect") return { text: cn.name + " disconnected.", then: function () { var o = Object.assign({}, api.get("settings").conns); o[cn.id] = false; api.setView("settings", { conns: o }); } };
      return { text: "Review what " + cn.name + " will share, then connect.", nav: { view: "settings", patch: { page: "connections", sheet: { kind: "conn", id: cn.id } } } };
    }
    if (/\bnotification (summar|digest)|\bagent summar/.test(t)) {
      var so = !/\b(off|stop|disable)\b/.test(t);
      return { text: so ? "I'll bundle notifications into summaries." : "Summaries off. Notifications come through as they arrive.", then: function () { var n = Object.assign({}, api.get("settings").notif, { summaries: so }); api.setView("settings", { notif: n }); } };
    }
    if ((m = t.match(/\b(wi-?fi|bluetooth|display|privacy|accounts?|notifications?|battery|models?|developer|about|sound|connections?|mobile data)( settings| options)\b/))) {
      var key = { wifi: "wifi", "wi-fi": "wifi", bluetooth: "bluetooth", display: "display", privacy: "privacy", account: "accounts", accounts: "accounts", notification: "notifications", notifications: "notifications", battery: "battery", model: "models", models: "models", developer: "developer", about: "about", sound: "sound", connection: "connections", connections: "connections", "mobile data": "mobile" }[m[1]];
      return { text: "Here you go.", nav: { view: "settings", patch: { page: key } } };
    }
    if (/\bbattery\b/.test(t) && /\b(how much|left|level|life|status)\b/.test(t)) return { text: "82%. About a day and six hours left.", card: { type: "generic", icon: "stBattery", title: "82%", sub: "About 1 day 6 hr", go: { view: "settings", patch: { page: "battery" } } } };
    return null;
  },
  render: function (st, api) {
    var S = api.S; var set = api.set; var name = api.name;
    var accts = st.accounts || []; var ch = st.char;
    var provOf = function (id) { return ST_PROV.filter(function (p) { return p.id === id; })[0] || ST_PROV[3]; };
    var q = function (patch) { api.shell({ q: Object.assign({}, api.S.q, patch) }); };
    var go = function (p) { return function () { set({ page: p, btScan: false, acct: null, adding: false, addStep: null, perm: null, log: false }); }; };
    var nConn = ST_CONNS.filter(function (c) { return st.conns[c.id]; }).length;
    var btOnDev = (st.btDev || []).filter(function (d) { return d.on; })[0];
    var levelOf = function (a, k) { return a[k] ? ((a.access || {})[k] || "read") : "off"; };
    var setAcct = function (id, patch) { set({ accounts: api.get("settings").accounts.map(function (a) { return a.id === id ? Object.assign({}, a, patch) : a; }) }); };
    var lvlText = function (a) { var on = ST_TYPES.filter(function (x) { return a[x[0]]; }).map(function (x) { return x[1]; }); return on.length ? on.join(" · ") : "Not syncing"; };
    var persona = ST_VOICES[ch.voice] + " · " + (ch.brev < 40 ? "Brief" : (ch.brev > 65 ? "Detailed" : "Balanced")) + " · " + (ch.tone > 55 ? "Casual" : "Formal");

    /* ---------- top level ---------- */
    var top = {
      isTop: true, notTop: false, cls: "", z: 1, title: "Settings",
      groups: [
        { rows: [
          stNav({ d: IC.stAt, label: "Accounts", val: String(accts.length), go: go("accounts") }),
          stNav({ d: IC.link, label: "Connections", val: nConn ? String(nConn) : "", go: go("connections") }),
          stNav({ d: IC.shield, label: "Privacy & Enclave", val: st.cloud ? "Fallback on" : "Sealed", go: go("privacy") })
        ] },
        { rows: [
          stNav({ d: IC.wifi, label: "Wi-Fi", val: S.q.wifi ? (ST_NETS.filter(function (n) { return n.id === st.wifiCur; })[0] || { name: "On" }).name : "Off", go: go("wifi") }),
          stNav({ d: IC.bt, label: "Bluetooth", val: S.q.bt ? (btOnDev ? btOnDev.name : "On") : "Off", go: go("bluetooth") }),
          stNav({ d: IC.stSignal, label: "Mobile data", val: S.q.plane ? "Airplane" : (st.mobile.data ? "5G" : "Off"), go: go("mobile") })
        ] },
        { rows: [
          stNav({ d: IC.sun, label: "Display", val: cap(api.theme), go: go("display") }),
          stNav({ d: IC.stSpeaker, label: "Sound & vibration", val: S.q.dnd ? "Silent" : "", go: go("sound") }),
          stNav({ d: IC.bell, label: "Notifications", val: st.notif.summaries ? "Summaries" : "", go: go("notifications") }),
          stNav({ d: IC.stBattery, label: "Battery", val: "82%", go: go("battery") })
        ] },
        { rows: [
          stNav({ d: IC.chip, label: "Models", val: "On device", go: go("models") }),
          stNav({ d: IC.code, label: "Developer", go: go("developer") }),
          stNav({ d: IC.info, label: "About", val: "elizaOS 2.1", go: go("about") })
        ] }
      ]
    };
    var stack = [top];
    var page = function (title, extra) { return Object.assign({ isTop: false, notTop: true, cls: "enter", title: title, groups: [], back: function () { set({ page: null, btScan: false, acct: null, adding: false, addStep: null, perm: null, log: false }); } }, extra); };

    /* ---------- level 1 pages ---------- */
    var P = st.page; var p1 = null;
    if (P === "character") {
      p1 = page("", { hero: { kChar: true }, groups: [
        { rows: [stRow("kChips", { items: ST_VOICES.map(function (v, i) {
          var on = ch.voice === i; var pl = st.playing === i;
          return { label: v, on: on, playing: pl, notPlaying: !pl, aria: v + " voice", css: on ? "background:var(--acc);color:#fff" : "background:var(--bg)",
            pick: function () { set({ char: Object.assign({}, api.get("settings").char, { voice: i }), playing: i }); api.later(function () { if (api.get("settings").playing === i) set({ playing: null }); }, 1800); } };
        }) })] },
        { rows: [["Short", "Detailed", "brev"], ["Formal", "Casual", "tone"], ["Asks first", "Acts first", "init"]].map(function (s) {
          return stRow("kSlider", { a: s[0], b: s[1], hasAB: true, v: ch[s[2]], label: s[0] + " to " + s[1], set: function (e) { var c = Object.assign({}, api.get("settings").char); c[s[2]] = +e.target.value; set({ char: c }); } });
        }) },
        { rows: [["wake", "Hey " + name], ["speak", "Speak replies"], ["proactive", "Proactive briefings"]].map(function (x) {
          return stTog({ label: x[1] }, ch[x[0]], function () { var c = Object.assign({}, api.get("settings").char); c[x[0]] = !c[x[0]]; set({ char: c }); });
        }) }
      ] });
    } else if (P === "accounts") {
      p1 = page("Accounts", { groups: [
        { rows: accts.map(function (a) {
          var pv = provOf(a.provider);
          return stNav({ tile: pv.name.charAt(0), tileCss: a.label === "Personal" ? "background:var(--acc);color:#fff" : "background:var(--s3)", label: a.address, sub: (a.label ? a.label + " · " : "") + pv.name + " · " + lvlText(a), bold: true, go: function () { set({ acct: a.id }); } });
        }).concat([stNav({ d: IC.plus, label: "Add account", accent: true, noChev: true, go: function () { set({ adding: true, addStep: null, addProv: null, addEmail: "", addPw: "", addServer: "", addLvl: null, busy: null }); } })]) }
      ] });
    } else if (P === "connections") {
      p1 = page("Connections", { groups: [{ rows: ST_CONNS.map(function (c) {
        var on = !!st.conns[c.id];
        return stNav({ tile: c.name.charAt(0), tileCss: on ? "background:var(--acc);color:#fff" : "background:var(--s3)", label: c.name, sub: on ? c.scopes[0] : "", val: on ? "" : "Connect", valCss: "color:var(--acct);font-weight:600", trail: on ? IC.check : "", trailCss: "color:var(--acct)", go: function () { set({ sheet: { kind: "conn", id: c.id } }); } });
      }) }] });
    } else if (P === "privacy") {
      var logN = ST_LOG.length + (api.get("browser").booked ? 1 : 0);
      p1 = page("Privacy & Enclave", {
        hero: { kBig: true, hasIcon: true, d: IC.shield, iconCss: "background:var(--acc);color:#fff", big: "Sealed", sub: "Attested 6:00 AM · keys in hardware" },
        groups: [
          { rows: [
            stNav({ label: "Leaves this device", val: st.cloud ? "Hard questions" : "Nothing", go: go("models") }),
            stNav({ label: "On-device model", val: "Loaded", go: go("models") })
          ] },
          { rows: ST_PERMS.map(function (pm) { var n = Object.keys(st.perms[pm[0]] || {}).filter(function (k) { return st.perms[pm[0]][k] && (k === "alpha" || isMvpView(k)); }).length; return stNav({ d: IC[pm[2]], label: pm[1], val: n === 1 ? "1 app" : n + " apps", go: function () { set({ perm: pm[0] }); } }); }) },
          { rows: [
            stNav({ d: IC.stList, label: "Activity", val: logN + " today", go: function () { set({ log: true }); } }),
            stNav({ d: IC.flow, label: "Workflow runs", go: function () { api.open("workflows"); } })
          ] },
          { rows: [
            stRow("kInfo", { label: "Memory", val: st.memWiped ? "Empty" : "2,418 items · 38 MB" }),
            stNav({ d: IC.trash, label: "Wipe memory", danger: true, noChev: true, go: function () { set({ sheet: { kind: "wipe" } }); } })
          ] }
        ] });
    } else if (P === "wifi") {
      var wOn = !!S.q.wifi; var cur = ST_NETS.filter(function (n) { return n.id === st.wifiCur; })[0];
      p1 = page("Wi-Fi", { hdrTog: stTog({ label: "Wi-Fi", aria: "Use Wi-Fi" }, wOn, function () { q({ wifi: !api.S.q.wifi }); }),
        hero: wOn && cur ? { kBig: true, hasIcon: true, d: IC.wifi, iconCss: "background:var(--acc);color:#fff", big: cur.name, sub: "Connected · " + (cur.lock ? "Secure" : "Open") } : { kBig: true, hasIcon: true, d: IC.wifi, iconCss: "background:var(--s2);color:var(--mut)", big: wOn ? "Not connected" : "Off", sub: "" },
        groups: wOn ? [{ rows: ST_NETS.filter(function (n) { return !cur || n.id !== cur.id; }).map(function (n) {
          var known = (st.wifiKnown || []).indexOf(n.id) >= 0; var busy = st.busy === "w_" + n.id;
          return stNav({ d: IC.wifi, label: n.name, sub: busy ? "Connecting…" : (known ? "Saved" : n.sig), trail: n.lock ? IC.lock : "", trailCss: "color:var(--mut)", noChev: true, aria: n.name,
            go: function () {
              if (n.lock && !known) return set({ sheet: { kind: "wifiPw", id: n.id }, pw: "" });
              set({ busy: "w_" + n.id });
              api.later(function () { var s2 = api.get("settings"); set({ busy: null, wifiCur: n.id, wifiKnown: s2.wifiKnown.indexOf(n.id) >= 0 ? s2.wifiKnown : s2.wifiKnown.concat([n.id]) }); api.toast("Connected to " + n.name); }, 1100);
            } });
        }).concat(cur ? [stNav({ d: IC.trash, label: "Forget " + cur.name, danger: true, noChev: true, go: function () { set({ sheet: { kind: "forget", id: cur.id } }); } })] : []) }] : []
      });
    } else if (P === "bluetooth") {
      var bOn = !!S.q.bt;
      var found = st.btScan === "done" ? [stNav({ d: IC.stSpeaker, label: "Kitchen Speaker", sub: "Tap to pair", noChev: true, go: function () {
        set({ btScan: false, btDev: api.get("settings").btDev.concat([{ id: "spk", name: "Kitchen Speaker", d: "stSpeaker", on: true }]) }); api.toast("Paired Kitchen Speaker"); } })] : [];
      p1 = page("Bluetooth", { hdrTog: stTog({ label: "Bluetooth", aria: "Use Bluetooth" }, bOn, function () { q({ bt: !api.S.q.bt }); }),
        groups: bOn ? [
          { rows: (st.btDev || []).map(function (d) {
            var busy = st.busy === "b_" + d.id;
            return stNav({ d: IC[d.d] || IC.bt, label: d.name, sub: busy ? "Connecting…" : (d.on ? "Connected" : "Saved"), noChev: true, trail: d.on ? IC.check : "", trailCss: "color:var(--acct)",
              go: function () {
                if (d.on) { set({ btDev: api.get("settings").btDev.map(function (x) { return x.id === d.id ? Object.assign({}, x, { on: false }) : x; }) }); return; }
                set({ busy: "b_" + d.id });
                api.later(function () { set({ busy: null, btDev: api.get("settings").btDev.map(function (x) { return x.id === d.id ? Object.assign({}, x, { on: true }) : x; }) }); }, 900);
              } });
          }) },
          { rows: [stNav({ d: IC.plus, label: st.btScan === true ? "Searching…" : "Pair new device", accent: true, noChev: true, go: function () { set({ btScan: true }); api.later(function () { if (api.get("settings").btScan) set({ btScan: "done" }); }, 1300); } })].concat(found) }
        ] : [] });
    } else if (P === "mobile") {
      p1 = page("Mobile data", { groups: [
        { rows: [
          stTog({ d: IC.stSignal, label: "Mobile data", aria: "Use mobile data", sub: "Alpha Mobile · 5G" }, st.mobile.data && !S.q.plane, function () { set({ mobile: Object.assign({}, api.get("settings").mobile, { data: !api.get("settings").mobile.data }) }); }),
          stTog({ label: "Roaming" }, st.mobile.roam, function () { set({ mobile: Object.assign({}, api.get("settings").mobile, { roam: !api.get("settings").mobile.roam }) }); }),
          stTog({ d: IC.plane, label: "Airplane mode" }, S.q.plane, function () { stPlane(api, !api.S.q.plane); })
        ] },
        { rows: [stRow("kInfo", { label: "This month", val: "3.2 of 20 GB" })] }
      ] });
    } else if (P === "display") {
      p1 = page("Display", { hero: { kBig: true, big: "Aa", sub: "Replies, mail and pages", subCss: "font-size:" + Math.round(13 + st.textSize / 100 * 9) + "px;color:var(--fg)" }, groups: [
        { rows: [stSeg({ label: "Theme" }, [["light", "Light"], ["dark", "Dark"]], api.theme, function (v) { api.shell({ theme: v }); })] },
        { rows: [
          stRow("kSlider", { d: IC.sun, label: "Brightness", v: S.bright, set: function (e) { api.shell({ bright: +e.target.value }); } }),
          stRow("kSlider", { d: IC.stText, label: "Text size", v: st.textSize, set: function (e) { set({ textSize: +e.target.value }); } })
        ] }
      ] });
    } else if (P === "sound") {
      var snd = st.snd;
      var sv = function (k) { return function (e) { var o = Object.assign({}, api.get("settings").snd); o[k] = +e.target.value; set({ snd: o }); }; };
      p1 = page("Sound & vibration", { groups: [
        { rows: [stRow("kSlider", { d: IC.play, label: "Media", v: snd.media, set: sv("media") }), stRow("kSlider", { d: IC.phone, label: "Ring", v: snd.ring, set: sv("ring") }), stRow("kSlider", { d: IC.clock, label: "Alarm", v: snd.alarm, set: sv("alarm") })] },
        { rows: [
          stTog({ label: "Vibrate" }, snd.vib, function () { set({ snd: Object.assign({}, api.get("settings").snd, { vib: !api.get("settings").snd.vib }) }); }),
          stTog({ d: IC.moon, label: "Do not disturb" }, S.q.dnd, function () { q({ dnd: !api.S.q.dnd }); })
        ] }
      ] });
    } else if (P === "notifications") {
      var nf = st.notif;
      p1 = page("Notifications", { groups: [
        { rows: [stTog({ d: IC.bubble, label: "Agent summaries", sub: name + " bundles the rest into a digest" }, nf.summaries, function () { var n = api.get("settings").notif; set({ notif: Object.assign({}, n, { summaries: !n.summaries }) }); })] },
        { rows: ORDER.filter(function (k) { return k !== "settings" && !VIEWS[k].hidden; }).map(function (k) {
          var on = !(nf.off || {})[k];
          return stTog({ d: IC[VIEWS[k].icon] || IC.grid, label: VIEWS[k].title, aria: VIEWS[k].title + " notifications" }, on, function () { var n = api.get("settings").notif; var off = Object.assign({}, n.off); off[k] = on; set({ notif: Object.assign({}, n, { off: off }) }); });
        }) }
      ] });
    } else if (P === "battery") {
      p1 = page("Battery", { hero: { kBig: true, big: "82%", sub: "About 1 day 6 hr", hasMeter: true, meter: 82 }, groups: [
        { rows: [
          stTog({ label: "Battery saver" }, st.saver, function () { set({ saver: !api.get("settings").saver }); }),
          stTog({ label: "Charge to 80%" }, st.cap80, function () { set({ cap80: !api.get("settings").cap80 }); })
        ] },
        { rows: [stRow("kInfo", { d: IC.sun, label: "Screen", val: "31%" }), stRow("kInfo", { d: IC.chip, label: "On-device model", val: "9%" }), stRow("kInfo", { d: IC.bubble, label: "Messages", val: "6%" })] }
      ] });
    } else if (P === "models") {
      p1 = page("Models", { hero: { kBig: true, hasIcon: true, d: IC.chip, iconCss: "background:var(--acc);color:#fff", big: "Core 7B", sub: "On device · NPU · 4-bit" }, groups: [
        { rows: [stTog({ label: "Cloud fallback", sub: st.cloud ? "Asks each time, sends only the question" : "Off · nothing leaves this phone" }, st.cloud, function () { set({ cloud: !api.get("settings").cloud }); })] },
        { rows: (st.models || []).map(function (md) {
          var done = md.pct >= 100; var going = md.pct >= 0 && md.pct < 100;
          return stNav({ label: md.name, sub: md.size, val: going ? md.pct + "%" : "", trail: done ? IC.check : (going ? "" : IC.stDownload), trailCss: done ? "color:var(--acct)" : "color:var(--fg)", noChev: true, aria: (done ? "" : "Download ") + md.name,
            go: function () {
              if (done || going) return;
              var upd = function (pct) { set({ models: api.get("settings").models.map(function (x) { return x.id === md.id ? Object.assign({}, x, { pct: pct }) : x; }) }); };
              upd(0);
              [1, 2, 3, 4, 5].forEach(function (i) { api.later(function () { upd(i === 5 ? 100 : i * 20); if (i === 5) api.toast(md.name + " ready"); }, i * 450); });
            } });
        }) }
      ] });
    } else if (P === "developer") {
      p1 = page("Developer", { groups: [
        { rows: [stRow("kInfo", { label: "Runtime", val: "elizaOS 2.1 · running" }), stRow("kInfo", { label: "Uptime", val: "3 d 4 h" }), stRow("kInfo", { label: "NPU", val: "18%" }), stRow("kInfo", { label: "Memory", val: st.memWiped ? "0 items" : "2,418 items" })] },
        { rows: [stTog({ label: "Verbose logs" }, st.verbose, function () { set({ verbose: !api.get("settings").verbose }); })] },
        { rows: ST_DEVLOG.map(function (l) { return stRow("kLog", { time: l[0], text: l[1] }); }).concat([stNav({ d: IC.share, label: "Export logs", accent: true, noChev: true, go: function () { api.open("files", { folder: "Downloads" }); api.toast("Logs saved to Downloads"); } })]) }
      ] });
    } else if (P === "about") {
      p1 = page("About", { hero: { kBig: true, big: "Alpha Compute phone", sub: "Powered by elizaOS" }, groups: [
        { rows: [stRow("kInfo", { label: "elizaOS", val: "2.1.0" }), stRow("kInfo", { label: "Android", val: "17 · AOSP" }), stRow("kInfo", { label: "Build", val: "AC1.260915" }), stRow("kInfo", { label: "Enclave", val: "4.2 · attested" }), stRow("kInfo", { label: "Model", val: "Core 7B" })] },
        { rows: [stNav({ label: st.busy === "upd" ? "Checking…" : "Check for updates", accent: true, noChev: true, go: function () { set({ busy: "upd" }); api.later(function () { set({ busy: null }); api.toast("Up to date"); }, 1000); } })] }
      ] });
    }
    if (p1) { p1.z = 4; stack.push(p1); }

    /* ---------- level 2 ---------- */
    var p2 = null;
    var a = st.acct ? accts.filter(function (x) { return x.id === st.acct; })[0] : null;
    if (P === "accounts" && st.adding) {
      var step = st.addStep || "provider"; var pv = st.addProv ? provOf(st.addProv) : null;
      var back2 = function () { module_back(); };
      var closeAdd = function () { set({ adding: false, addStep: null, addProv: null, busy: null }); };
      var ok = stEmailOk(st.addEmail) && (st.addPw || "").length >= 4;
      var finish = function () {
        var s2 = api.get("settings"); var pv2 = provOf(s2.addProv); var lv = s2.addLvl || { mail: "act", calendar: "act", contacts: "read" };
        var addr = stEmailOk(s2.addEmail) ? s2.addEmail.trim().toLowerCase() : "me@" + pv2.dom;
        var nacc = { id: "a" + Date.now(), provider: pv2.id, label: "", address: addr, mail: lv.mail !== "off", calendar: lv.calendar !== "off", contacts: isMvpView("contacts") && lv.contacts !== "off",
          access: { mail: lv.mail === "off" ? "read" : lv.mail, calendar: lv.calendar === "off" ? "read" : lv.calendar, contacts: lv.contacts === "off" ? "read" : lv.contacts } };
        set({ accounts: s2.accounts.concat([nacc]), addStep: "done", busy: null, addEmail: addr });
        api.later(function () { var s3 = api.get("settings"); if (s3.adding && s3.addStep === "done") set({ adding: false, addStep: null, addProv: null }); }, 1600);
      };
      if (step === "provider") {
        p2 = page("Add account", { back: closeAdd, groups: [{ rows: ST_PROV.map(function (pp) { return stNav({ tile: pp.name.charAt(0), tileCss: "background:var(--s3)", label: pp.name, sub: pp.sub, go: function () { set({ addProv: pp.id, addStep: "signin", addEmail: "", addPw: "", busy: null }); } }); }) }] });
      } else if (step === "signin") {
        var busy = st.busy === "signin";
        var rows = [
          stRow("kInput", { d: IC.mail, label: "Email", ph: "Email", type: "email", value: st.addEmail, change: function (e) { set({ addEmail: e.target.value }); } }),
          stRow("kInput", { d: IC.lock, label: "Password", ph: "Password", type: "password", value: st.addPw, change: function (e) { set({ addPw: e.target.value }); } })
        ];
        if (pv.id === "other") rows.push(stRow("kInput", { d: IC.globe, label: "Server", ph: "Server (imap.example.com)", type: "text", value: st.addServer, change: function (e) { set({ addServer: e.target.value }); } }));
        var gr = [{ plain: true, rows: rows }, { plain: true, rows: [stRow("kBtn", { label: busy ? "Signing in…" : "Sign in", primary: true, dis: !ok || busy, css: ok ? "background:var(--acc);color:#fff" : "background:var(--s3);color:var(--mut)",
          go: function () { if (!ok) return; set({ busy: "signin" }); api.later(function () { set({ busy: null, addStep: "perms" }); }, 900); } })] }];
        if (pv.oauth) gr[1].rows.push(stRow("kBtn", { label: "Continue in browser", dis: false, css: "background:var(--s2)", d: IC.globe, hasIcon: true, go: function () { set({ addStep: "oauth" }); } }));
        p2 = page(pv.name, { back: back2, backLabel: "Back to providers", groups: gr });
      } else if (step === "oauth") {
        p2 = page(pv.name, { back: back2, backLabel: "Back to sign in", hero: { kWeb: true, host: pv.web, big: "Alpha wants to access your " + pv.name + " account", sub: stEmailOk(st.addEmail) ? st.addEmail : "Choose an account on " + pv.web },
          groups: [{ plain: true, rows: [
            stRow("kBtn", { label: st.busy === "oauth" ? "Allowing…" : "Allow", primary: true, dis: false, css: "background:var(--acc);color:#fff", go: function () { set({ busy: "oauth" }); api.later(function () { set({ busy: null, addStep: "perms" }); }, 800); } }),
            stRow("kBtn", { label: "Cancel", dis: false, css: "background:var(--s2)", go: function () { set({ addStep: "signin" }); } })
          ] }] });
      } else if (step === "perms") {
        var lv = st.addLvl || { mail: "act", calendar: "act", contacts: "read" };
        p2 = page(name + " can", { back: back2, backLabel: "Back to sign in", groups: [
          { rows: ST_TYPES.map(function (x) { return stSeg({ d: IC[x[2]], label: x[1] }, [["off", "Off"], ["read", "Read"], ["act", "Act"]], lv[x[0]], function (v) { var o = Object.assign({}, lv); o[x[0]] = v; set({ addLvl: o }); }); }) },
          { plain: true, cap: "Synced into the enclave. Act always asks before sending.", rows: [stRow("kBtn", { label: "Connect", primary: true, dis: false, css: "background:var(--acc);color:#fff", go: finish })] }
        ] });
      } else {
        p2 = page("", { back: closeAdd, hero: { kBig: true, hasIcon: true, d: IC.check, iconCss: "background:var(--acc);color:#fff", big: "Added", sub: st.addEmail }, groups: [{ plain: true, rows: [stRow("kBtn", { label: "Done", primary: true, dis: false, css: "background:var(--acc);color:#fff", go: closeAdd })] }] });
      }
    } else if (P === "accounts" && a) {
      var pva = provOf(a.provider);
      p2 = page("", { back: function () { set({ acct: null }); }, hero: { kBig: true, bigCss: "font-family:'Public Sans',system-ui,sans-serif;font-size:24px;font-weight:600;letter-spacing:0", ini: pva.name.charAt(0), hasIni: true, iconCss: a.label === "Personal" ? "background:var(--acc);color:#fff" : "background:var(--s3)", big: a.address, sub: (a.label ? a.label + " · " : "") + pva.name },
        groups: [
          { rows: ST_TYPES.map(function (x) { return stSeg({ d: IC[x[2]], label: x[1] }, [["off", "Off"], ["read", "Read"], ["act", "Act"]], levelOf(a, x[0]), function (v) {
            var cur = api.get("settings").accounts.filter(function (y) { return y.id === a.id; })[0]; var p = {}; p[x[0]] = v !== "off"; if (v !== "off") p.access = Object.assign({}, cur.access, (function () { var o = {}; o[x[0]] = v; return o; })()); setAcct(a.id, p);
          }); }) },
          { rows: [stRow("kInfo", { label: "Last sync", val: "2 min ago" })] },
          { rows: [stNav({ d: IC.trash, label: "Remove account", danger: true, noChev: true, go: function () { stRemoveAcct(api, a.id); } })] }
        ] });
    } else if (P === "privacy" && ST_PERMS.some(function (x) { return x[0] === st.perm; })) {
      var pm = ST_PERMS.filter(function (x) { return x[0] === st.perm; })[0];
      var apps = [["alpha", name, "user"]].concat(ORDER.filter(function (k) { return k !== "settings" && !VIEWS[k].hidden; }).map(function (k) { return [k, VIEWS[k].title, VIEWS[k].icon]; }));
      p2 = page(pm[1], { back: function () { set({ perm: null }); }, groups: [{ rows: apps.map(function (ap) {
        var on = !!(st.perms[pm[0]] || {})[ap[0]];
        return stTog({ d: IC[ap[2]] || IC.grid, label: ap[1], aria: ap[1] + " " + pm[1].toLowerCase() }, on, function () { var ps = Object.assign({}, api.get("settings").perms); var one = Object.assign({}, ps[pm[0]]); one[ap[0]] = !on; ps[pm[0]] = one; set({ perms: ps }); });
      }) }] });
    } else if (P === "privacy" && st.log) {
      var lg = ST_LOG.slice(); if (api.get("browser").booked) lg.unshift(["now", "Booked Nopa for you (confirmed)", "globe"]);
      p2 = page("Activity", { back: function () { set({ log: false }); }, groups: [
        { rows: lg.map(function (l) { return stNav({ d: IC[l[2]] || IC.check, label: l[1], val: l[0], noChev: true, go: function () {} }); }) },
        { rows: [stNav({ d: IC.flow, label: "Workflow runs", go: function () { api.open("workflows"); } })] }
      ] });
    }
    if (p2) { p2.z = 6; stack.push(p2); }
    function module_back() { VIEWS.settings.back(api.get("settings"), api); }

    /* ---------- sheet ---------- */
    var sh = null; var s = st.sheet;
    var closeSheet = function () { set({ sheet: null, pw: "" }); };
    if (s && s.kind === "wipe") {
      sh = { title: "Wipe " + name + "'s memory?", sub: "Everything " + name + " has learned about you is erased. This can't be undone.", primary: "Wipe", secondary: "Cancel",
        ok: function () { set({ sheet: null, memWiped: true }); api.toast("Memory wiped"); } };
    } else if (s && s.kind === "wifiPw") {
      var net = ST_NETS.filter(function (n) { return n.id === s.id; })[0]; var pwOk = (st.pw || "").length >= 8;
      sh = { title: net.name, sub: "", hasInput: true, pw: st.pw, onPw: function (e) { set({ pw: e.target.value }); }, onKey: function (e) { if (e.key === "Enter" && pwOk) sh.ok(); },
        primary: "Connect", dis: !pwOk, secondary: "Cancel",
        ok: function () {
          if ((api.get("settings").pw || "").length < 8) return;
          set({ sheet: null, pw: "", busy: "w_" + net.id });
          api.later(function () { var s2 = api.get("settings"); set({ busy: null, wifiCur: net.id, wifiKnown: s2.wifiKnown.indexOf(net.id) >= 0 ? s2.wifiKnown : s2.wifiKnown.concat([net.id]) }); api.toast("Connected to " + net.name); }, 1100);
        } };
    } else if (s && s.kind === "forget") {
      var fn = ST_NETS.filter(function (n) { return n.id === s.id; })[0];
      sh = { title: "Forget " + fn.name + "?", sub: "You'll need the password to rejoin.", primary: "Forget", secondary: "Cancel",
        ok: function () { var s2 = api.get("settings"); set({ sheet: null, wifiCur: null, wifiKnown: s2.wifiKnown.filter(function (k) { return k !== fn.id; }) }); } };
    } else if (s && s.kind === "conn") {
      var c = ST_CONNS.filter(function (x) { return x.id === s.id; })[0]; var con = !!st.conns[c.id];
      sh = { title: c.name, sub: con ? "Connected" : name + " will be able to", scopes: c.scopes.map(function (t) { return { t: t, d: IC.check }; }), hasScopes: true,
        primary: con ? "Disconnect" : (st.busy === "conn" ? "Connecting…" : "Connect"), secondary: "Close",
        ok: function () {
          var o = Object.assign({}, api.get("settings").conns);
          if (con) { o[c.id] = false; set({ conns: o, sheet: null }); api.toast(c.name + " disconnected"); return; }
          set({ busy: "conn" }); api.later(function () { var o2 = Object.assign({}, api.get("settings").conns); o2[c.id] = true; set({ conns: o2, sheet: null, busy: null }); api.toast(c.name + " connected"); }, 900);
        } };
    }
    if (sh) {
      api.later(stUnscroll, 30); api.later(stUnscroll, 400);
      sh.hasSub = !!sh.sub; sh.close = closeSheet; sh.hasInput = !!sh.hasInput; sh.hasScopes = !!sh.hasScopes;
      sh.okCss = sh.dis ? "background:var(--s3);color:var(--mut)" : "background:var(--acc);color:#fff";
      if (!sh.onKey) sh.onKey = function () {};
      if (!sh.onPw) sh.onPw = function () {};
    }

    stack.forEach(function (p, i) {
      p.hero = p.hero || {};
      if (!p.backLabel) p.backLabel = "Back to " + (i > 0 ? (stack[i - 1].title || "Settings") : "Settings");
      p.hdrTog = p.hdrTog || null; p.hasHdrTog = !!p.hdrTog; p.hasTitle = !!p.title;
      p.groups.forEach(function (g) {
        g.css = g.plain ? "display:flex;flex-direction:column;gap:10px" : "background:var(--s2);padding:4px 0";
        g.hasCap = !!g.cap;
        g.rows.forEach(function (r) { r.noAB = !r.hasAB; });
      });
    });
    return {
      rootRef: function () { stNoScroll(); },
      stack: stack,
      charVal: S.charName, onName: function (e) { api.shell({ charName: e.target.value }); },
      persona: persona, openChar: go("character"),
      sheet: sh, hasSheet: !!sh,
      scrollFix: !!sh
    };
  }
});

var BASE = {
  screen: "boot", bootStep: 0, view: null, shade: false, chat: "input",
  voice: "off", vtext: "", vcap: "", draft: "", editCard: null, typing: false, heads: false, toast: "", hint: false,
  q: { wifi: true, bt: true, dnd: false, mic: true, loc: true, plane: false, shield: true, torch: false },
  nGone: [], nSlide: null, bright: 70, theme: null, fs: null, now: Date.now(),
  charName: "Alpha", vs: {}, secure: false, stack: [], toastUndo: false,
  msgs: []
};

class Component extends DCLogic {
  componentDidMount() {
    this.G = {}; this.I = {};
    var self = this;
    this.clock = setInterval(function () { self.setState({ now: Date.now() }); }, 15000);
    this.preset(this.props.initial || "boot");
  }
  componentDidUpdate(prev) { if (prev && prev.initial !== this.props.initial) this.preset(this.props.initial || "boot"); }
  componentWillUnmount() {
    clearInterval(this.clock); clearInterval(this.vI);
    var G = this.G || {}; Object.keys(G).forEach(function (k) { G[k].forEach(clearTimeout); });
    var I = this.I || {}; Object.keys(I).forEach(function (k) { I[k].forEach(clearInterval); });
  }
  S() { var value = Object.assign({}, BASE, this.state || {}); if (DEFERRED_MVP_VIEWS.has(value.view)) value.view = null; value.stack = (value.stack || []).filter(isMvpView); value.heads = false; return value; }
  later(fn, ms, grp) { grp = grp || "g"; this.G = this.G || {}; var id = setTimeout(fn, ms); (this.G[grp] = this.G[grp] || []).push(id); return id; }
  clear(grp) { this.G = this.G || {}; (this.G[grp] || []).forEach(clearTimeout); this.G[grp] = []; }
  every(fn, ms, grp) { this.I = this.I || {}; var id = setInterval(fn, ms); (this.I[grp] = this.I[grp] || []).push(id); return id; }
  stopEvery(grp) { this.I = this.I || {}; (this.I[grp] || []).forEach(clearInterval); this.I[grp] = []; }
  toast(msg, opts) {
    opts = opts || {}; var self = this;
    this.undoFn = opts.undo || null;
    this.setState({ toast: msg, toastUndo: !!opts.undo }); this.clear("t");
    this.later(function () { self.undoFn = null; self.setState({ toast: "", toastUndo: false }); }, opts.undo ? 5000 : 1900, "t");
  }

  /* ---- per-app state ---- */
  vget(k) { var S = this.S(); return Object.assign({}, (VIEWS[k] && VIEWS[k].state) || {}, (S.vs || {})[k] || {}); }
  vset(k, p) {
    this.setState(function (prev) {
      var vs = Object.assign({}, (prev && prev.vs) || {});
      vs[k] = Object.assign({}, (VIEWS[k] && VIEWS[k].state) || {}, vs[k] || {}, p);
      return { vs: vs };
    });
  }
  vreset(k, p) {
    this.setState(function (prev) {
      var vs = Object.assign({}, (prev && prev.vs) || {});
      var keep = {}; var cur = vs[k] || {}; var persist = (VIEWS[k] && VIEWS[k].persist) || [];
      persist.forEach(function (key) { if (cur[key] !== undefined) keep[key] = cur[key]; });
      vs[k] = Object.assign({}, (VIEWS[k] && VIEWS[k].state) || {}, keep, p || {});
      return { vs: vs };
    });
  }
  api(k) {
    var self = this; var S = this.S();
    var theme = S.theme || (this.props || {}).theme || "light"; if (theme !== "dark") theme = "light";
    return {
      key: k, S: S, st: this.vget(k), ic: IC, people: PEOPLE, person: function (id) { var c = self.vget("contacts"); var l = (c && c.list) || []; for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return person(id); },
      isActive: function () { return self.S().view === k; }, now: new Date(S.now), theme: theme,
      name: S.charName || "Alpha", active: S.view === k,
      set: function (p) { self.vset(k, p); },
      get: function (other) { return self.vget(other); },
      setView: function (other, p) { self.vset(other, p); },
      shell: function (p) { self.setState(p); },
      open: function (view, p, chat) { self.openView(view, p, chat, { push: self.S().view === k && view !== k }); },
      home: function () { self.goHome(); },
      toast: function (m, opts) { self.toast(m, opts); },
      everyBg: function (fn, ms) { return self.every(fn, ms, "bg_" + k); },
      laterBg: function (fn, ms) { return self.later(fn, ms, "bg_" + k); },
      stopBg: function () { self.clear("bg_" + k); self.stopEvery("bg_" + k); },
      secure: !!S.secure,
      chat: function (draft) { self.setState({ chat: "sheet", draft: draft || "" }); },
      send: function (t) { self.send(t); },
      say: function (text, card) { self.agentSay(text, card); },
      sw: function (fn, opts) { return self.sw(fn, opts); },
      swallowed: function () { return self.swallowed(); },
      later: function (fn, ms) { return self.later(fn, ms, "m_" + k); },
      every: function (fn, ms) { return self.every(fn, ms, "m_" + k); },
      stop: function () { self.clear("m_" + k); self.stopEvery("m_" + k); },
      track: function (on) { return on ? "background:var(--acc)" : "background:var(--s3)"; },
      kx: function (on) { return on ? 20 : 0; }
    };
  }
  mod(k) { return VIEWS[k] || {}; }
  defaultChat(k) { return this.mod(k).chat === "input" ? "input" : "hidden"; }
  rest() { var v = this.S().view; return v ? this.defaultChat(v) : "input"; }
  leave() {
    var v = this.S().view;
    if (v) { this.clear("m_" + v); this.stopEvery("m_" + v); var m = this.mod(v); if (m.onLeave) m.onLeave(this.api(v)); }
  }

  preset(n) {
    if (DEFERRED_MVP_VIEWS.has(String(n).split(":")[0]) || n === "heads") n = "home";
    var self = this;
    this.clear("g"); this.clear("v"); clearInterval(this.vI); this.leave();
    var home = { screen: "home", view: null, shade: false, chat: "input", voice: "off", heads: false, typing: false, hint: false };
    if (n === "boot") return this.runBoot();
    this.headsDone = true; this.hintDone = true;
    if (n === "lock") return this.setState(Object.assign({}, home, { screen: "lock" }));
    if (n === "shade") return this.setState(Object.assign({}, home, { shade: true }));
    if (n === "sheet" || n === "full") return this.setState(Object.assign({}, home, { chat: n }));
    if (n === "voice") { this.setState(home); this.later(function () { self.startVoice(); }, 60); return; }
    if (n === "heads") { this.setState(home); this.later(function () { self.showHeads(); }, 60); return; }
    var parts = String(n).split(":"); var k = parts[0], sub = parts[1];
    if (VIEWS[k]) {
      this.setState(Object.assign({}, home, { view: k, chat: this.defaultChat(k) }));
      this.vreset(k);
      if (sub && VIEWS[k].preset) { var p = VIEWS[k].preset(sub, this.api(k)); if (p) this.vset(k, p); }
      return;
    }
    this.setState(home);
  }
  runBoot() {
    var self = this;
    this.headsDone = false; this.hintDone = false;
    this.setState({ screen: "boot", bootStep: 0, view: null, chat: "input", shade: false, voice: "off", heads: false });
    this.later(function () { self.setState({ bootStep: 1 }); }, 300);
    this.later(function () { self.setState({ bootStep: 2 }); }, 1300);
    this.later(function () { self.setState({ screen: "lock" }); }, 3400);
  }
  unlock() {
    var self = this;
    this.setState({ screen: "home", shade: false, secure: false });
    if (!this.headsDone) { this.headsDone = true; this.later(function () { self.showHeads(); }, 3500); }
  }
  power() {
    var S = this.S();
    if (S.screen === "boot") return;
    this.clear("v"); clearInterval(this.vI);
    if (S.screen === "off") return this.setState({ screen: "lock" });
    if (S.screen === "lock") return this.setState({ screen: "off", voice: "off" });
    this.setState({ screen: "lock", shade: false, heads: false, voice: "off" });
  }
  homeHint() {
    if (this.hintDone) return; this.hintDone = true; var self = this;
    this.later(function () { self.setState({ hint: true }); }, 700, "hint");
    this.later(function () { self.setState({ hint: false }); }, 3600, "hint");
  }
  goHome() {
    this.clear("hint"); this.leave();
    if (this.S().secure) return this.setState({ secure: false, screen: "lock", view: null, shade: false, chat: "input", hint: false, heads: false, stack: [] });
    this.setState({ view: null, shade: false, chat: "input", hint: false, heads: false, stack: [] });
  }
  openView(k, patch, chat, opts) {
    if (!isMvpView(k)) return this.toast("This app is deferred from the MVP");
    if (opts && opts.keepStack) { var S0 = this.S(); if (S0.view !== k) { this.leave(); } this.setState({ screen: "home", view: k, shade: false, heads: false, chat: chat || this.defaultChat(k) }); return; }
    if (!VIEWS[k]) return;
    var S = this.S(); opts = opts || {};
    if (S.secure && ["camera", "photos", "wallet"].indexOf(k) < 0) { this.leave(); this.setState({ secure: false, screen: "lock", view: null, shade: false, stack: [] }); return this.toast("Unlock to continue"); }
    var stack = S.stack || [];
    if (opts.push && S.view && S.view !== k) stack = stack.concat([S.view]).slice(-6);
    else if (!opts.keepStack) stack = [];
    if (S.view !== k) {
      this.leave();
      var m = this.mod(k), cur = this.vget(k);
      var busy = m.ongoing && m.ongoing(cur, this.api(k));
      if (busy || opts.restore) { if (patch) this.vset(k, patch); } else this.vreset(k, patch);
    } else if (patch) { this.vset(k, patch); }
    this.setState({ screen: "home", view: k, shade: false, heads: false, chat: chat || this.defaultChat(k), stack: stack });
    this.homeHint();
  }
  back() {
    var S = this.S();
    if (S.shade) return this.setState({ shade: false });
    if (S.voice !== "off") return this.stopVoice();
    if (S.chat === "full") return this.setState({ chat: "sheet" });
    if (S.chat === "sheet") return this.setState({ chat: this.rest() });
    if (S.view) {
      var m = this.mod(S.view);
      if (m.back && m.back(this.vget(S.view), this.api(S.view))) return;
      var stack = S.stack || [];
      if (stack.length) { var prev = stack[stack.length - 1]; this.setState({ stack: stack.slice(0, -1) }); return this.openView(prev, null, null, { restore: true, keepStack: true }); }
      return this.goHome();
    }
  }

  /* ---- gestures ---- */
  scale(el) { var sc = el && el.closest ? el.closest("[data-screen]") : null; var r = (sc || el).getBoundingClientRect(); return { r: r, s: r.width / 412 || 1 }; }
  gDown(e) { var o = this.scale(e.currentTarget); this.g = { x: (e.clientX - o.r.left) / o.s, y: (e.clientY - o.r.top) / o.s, cx: e.clientX, cy: e.clientY, s: o.s }; }
  gUp(e) { var g = this.g; this.g = null; if (!g) return; this.swipe(g, (e.clientX - g.cx) / g.s, (e.clientY - g.cy) / g.s); }
  swipe(g, dx, dy) {
    var S = this.S(); var T = 46; var ax = Math.abs(dx), ay = Math.abs(dy);
    if (ax < T && ay < T) return;
    if (S.screen === "lock") { if (dy < -T && ay > ax) this.unlock(); return; }
    if (S.screen !== "home") return;
    if (S.shade) { if (dy < -T && ay > ax) this.setState({ shade: false }); else if (ax > ay && ((g.x < 30 && dx > T) || (g.x > 382 && dx < -T))) this.back(); return; }
    if (ay > ax) {
      if (dy > T && g.y < 90) { if (S.secure) return this.toast("Unlock to see notifications"); return this.setState({ shade: true, heads: false }); }
      if (dy < -T && g.y > 872) return this.goHome();
      if (S.chat === "sheet" && dy > T) return this.setState({ chat: this.rest() });
      if (!S.view && S.chat !== "sheet" && S.chat !== "full") {
        if (dy < -T) return this.setState({ chat: "sheet" });
        if (dy > T) return this.setState({ shade: true, heads: false });
      }
    } else {
      if ((g.x < 30 && dx > T) || (g.x > 382 && dx < -T)) return this.back();
    }
  }
  sw(fn, opts) {
    var self = this; opts = opts || {};
    return {
      down: function (e) {
        var o = self.scale(e.currentTarget);
        var px = (e.clientX - o.r.left) / o.s, py = (e.clientY - o.r.top) / o.s;
        if (px < 30 || px > 382 || py < 90 || py > 872) { self.cg = null; return; }   // system gesture zones belong to the shell
        e.stopPropagation(); self.cg = { x: e.clientX, y: e.clientY, s: o.s, g: { x: px, y: py, cx: e.clientX, cy: e.clientY, s: o.s } };
      },
      up: function (e) {
        var c = self.cg; if (!c) return; e.stopPropagation(); self.cg = null;
        var dx = (e.clientX - c.x) / c.s, dy = (e.clientY - c.y) / c.s;
        if (Math.abs(dx) <= 40 && Math.abs(dy) <= 40) return;
        var vertical = Math.abs(dy) > Math.abs(dx);
        if ((opts.axis === "x" && vertical) || (opts.axis === "y" && !vertical)) return self.swipe(c.g, dx, dy);
        self.swallow = Date.now();
        if (fn(dx, dy) === false) self.swipe(c.g, dx, dy);
      }
    };
  }
  swallowed() { return Date.now() - (this.swallow || 0) < 350; }

  /* ---- agent ---- */
  reply(raw) {
    var t = raw.toLowerCase(); var S = this.S(); var self = this; var r = null;
    var m = t.match(/^(open|show|go to|launch)\s+(?:my\s+|the\s+)?(\w+)(?:\s+app)?\s*[.!]?$/);
    if (m) {
      var hit = ORDER.filter(function (k) { var d = VIEWS[k]; return k === m[2] || (d.title || "").toLowerCase() === m[2] || (d.aliases || []).indexOf(m[2]) >= 0; })[0];
      if (hit) return { text: "Opening " + VIEWS[hit].title + ".", nav: hit };
    }
    if (S.view && this.mod(S.view).reply) { r = this.mod(S.view).reply(t, raw, this.api(S.view)); if (r) return r; }
    for (var i = 0; i < ORDER.length; i++) {
      var k = ORDER[i]; if (k === S.view || !VIEWS[k].reply) continue;
      r = VIEWS[k].reply(t, raw, this.api(k)); if (r) return r;
    }
    if (/what needs|catch me up|triage|anything new|summar/.test(t)) {
      // MVP-DEFERRED: SMS digest cards stay out of mock and live discovery.
      // Keep the original fixture data available for a reviewed scope restoration.
      var rows = [
        { ini: "MC", who: "Maya Chen", text: "Still on for 3? I can bring the prototype.", icon: "bubble", go: { view: "messages", patch: { thread: "maya" } } },
        { ini: "JP", who: "Jordan Park", text: "Revised term sheet attached.", icon: "mail", go: { view: "inbox", patch: { open: 2 } } },
        { ini: "PN", who: "Priya Nair", text: "Sent you the photos from Saturday", icon: "bubble", go: { view: "messages", patch: { thread: "priya" } } }
      ].filter(function (row) { return isMvpView(row.go.view); });
      return { text: rows.length + (rows.length === 1 ? " item needs" : " items need") + " your attention.", card: { type: "digest", rows: rows } };
    }
    return { text: "I can't do that yet. Try opening " + ORDER.filter(isMvpView).map(function (key) { return VIEWS[key].title; }).join(", ") + "." };
  }
  send(textArg) {
    var S = this.S(); var text = String(textArg != null ? textArg : S.draft).trim(); if (!text) return;
    if (deferredMvpPrompt(text)) return this.toast("This action is deferred from the MVP");
    var id = Date.now(); var self = this;
    if (textArg == null && S.editCard) { // composer holds an edited draft card: send it as the draft, not as a question
      var em = S.msgs.filter(function (x) { return x.id === S.editCard; })[0];
      this.setState({ editCard: null, draft: "" });
      if (em && em.card && !em.card.done) {
        var c2 = Object.assign({}, em.card, { body: text });
        return this.cardAct(Object.assign({}, em, { card: c2 }));
      }
    }
    this.setState({ msgs: S.msgs.concat([{ id: id, from: "user", text: text }]), draft: "", typing: true, chat: S.chat === "full" ? "full" : "sheet", shade: false });
    this.later(function () {
      var r = self.reply(text); var S2 = self.S();
      self.setState({ typing: false, msgs: S2.msgs.concat([{ id: id + 1, from: "agent", text: r.text, card: r.card || null }]) });
      if (r.nav) self.later(function () { var n = typeof r.nav === "string" ? { view: r.nav } : r.nav; self.openView(n.view, n.patch, n.chat || self.defaultChat(n.view)); }, 1300);
      if (r.then) self.later(function () { r.then(); }, 700);
    }, 800);
  }
  agentSay(text, card) {
    var S = this.S();
    this.setState({ chat: S.chat === "full" ? "full" : "sheet", msgs: S.msgs.concat([{ id: Date.now(), from: "agent", text: text, card: card || null }]) });
  }
  cardAct(m) {
    var S = this.S(); var c = m.card || {}; var self = this;
    if ((c.act && DEFERRED_MVP_VIEWS.has(c.act.mod)) || (c.go && DEFERRED_MVP_VIEWS.has(c.go.view))) return this.toast("This action is deferred from the MVP");
    var markDone = function () { self.setState({ msgs: self.S().msgs.map(function (x) { return x.id === m.id ? Object.assign({}, x, { card: Object.assign({}, x.card, m.card, { done: true }) }) : x; }) }); };
    if (c.act && VIEWS[c.act.mod] && VIEWS[c.act.mod].actions && VIEWS[c.act.mod].actions[c.act.fn]) {
      if (c.done) { if (c.go) this.openView(c.go.view, c.go.patch, c.go.chat || "hidden"); return; }
      markDone(); VIEWS[c.act.mod].actions[c.act.fn](c, this.api(c.act.mod)); return;
    }
    if (c.go) return this.openView(c.go.view, c.go.patch, c.go.chat || "hidden");
  }

  startVoice() {
    var S = this.S(); var self = this;
    if (S.screen === "boot") return;
    if (!S.q.mic) return this.toast("Listening is off in quick settings");
    this.clear("v"); clearInterval(this.vI);
    var locked = S.screen === "off" || S.screen === "lock";
    var m = S.view ? this.mod(S.view) : null;
    var phrase = locked ? "What's next today?" : ((m && m.voicePhrase) || "What does my afternoon look like?");
    this.setState({ screen: S.screen === "off" ? "lock" : S.screen, voice: "listening", vtext: "", vcap: "", shade: false });
    var i = 0;
    this.vI = setInterval(function () {
      i++; self.setState({ vtext: phrase.slice(0, i) });
      if (i >= phrase.length) {
        clearInterval(self.vI);
        self.later(function () { self.setState({ voice: "thinking" }); }, 450, "v");
        self.later(function () {
          var S2 = self.S(); var lockedNow = S2.screen === "lock";
          var r = lockedNow ? { text: "Design review at 3. Unlock for details." } : self.reply(phrase);
          var patch = { voice: "speaking", vcap: r.text };
          if (!lockedNow) { var id = Date.now(); patch.msgs = S2.msgs.concat([{ id: id, from: "user", text: phrase }, { id: id + 1, from: "agent", text: r.text, card: r.card || null }]); }
          self.setState(patch);
          if (!lockedNow && r.then) r.then();
          if (!lockedNow && r.nav) self.later(function () { var n = typeof r.nav === "string" ? { view: r.nav } : r.nav; self.openView(n.view, n.patch, n.chat || self.defaultChat(n.view)); }, 2600, "v");
        }, 1500, "v");
        self.later(function () { var S3 = self.S(); self.setState({ voice: "off", chat: S3.screen === "home" && !S3.view ? (S3.chat === "full" ? "full" : "sheet") : S3.chat }); }, 4300, "v");
      }
    }, 45);
  }
  stopVoice() { this.clear("v"); clearInterval(this.vI); this.setState({ voice: "off" }); }
  showHeads() {
    // MVP-DEFERRED: SMS heads-up simulation; restore with approved SMS scope
    // and native notification/recipient acceptance (see mvp-features.ts).
  }

  renderVals() {
    var S = this.S(); var P = this.props || {}; var self = this;
    var fs = S.fs == null ? !!P.phoneOnly : S.fs;
    var theme = S.theme || P.theme || "light"; if (theme !== "dark") theme = "light";
    var th = theme === "light" ? LIGHT : DARK;
    var acc = P.accent || "#0000FF";
    var acct = theme === "light" ? acc : (acc.toUpperCase() === "#0000FF" ? th.acct : "#9DB4FF");
    var VM = { "--bg": th.bg, "--s1": th.s1, "--s2": th.s2, "--s3": th.s3, "--line": th.line, "--fg": th.fg, "--mut": th.mut, "--acc": acc, "--acct": acct, "--scrim": th.scrim, "--shc": th.shc };
    var vars = Object.keys(VM).map(function (k) { return k + ":" + VM[k]; }).join(";");
    var rootRef = function (el) {
      if (!el || !el.style) return;
      Object.keys(VM).forEach(function (k) { el.style.setProperty(k, VM[k]); });
      // Connection and digest dialogs are siblings of the phone. Share the
      // selected palette with their common root, including live theme changes.
      if (P.phoneSurface && el.parentElement) {
        var palette = { bg: th.bg, fg: th.fg, s2: th.s2, line: th.line, mut: th.mut, acc: acct };
        Object.keys(palette).forEach(function (k) { el.parentElement.style.setProperty("--connection-" + k, palette[k]); });
      }
    };
    var d = new Date(S.now); var hr = d.getHours();
    var clock = (hr % 12 || 12) + ":" + pad2(d.getMinutes());
    var dateStr = DAYS[d.getDay()] + ", " + MONS[d.getMonth()].slice(0, 3) + " " + d.getDate();
    var name = S.charName || "Alpha";
    var isOn = S.screen === "home"; var v = S.view; var isView = isOn && !!v;
    var voiceOn = S.voice !== "off";
    var panelOpen = isOn && (S.chat === "sheet" || S.chat === "full");
    var mod = v ? this.mod(v) : null;
    var st = v ? this.vget(v) : null;
    var imm = (mod && mod.immersive) ? (mod.immersive(st, this.api(v)) || {}) : {};

    var out = {};
    var is = {};
    ORDER.forEach(function (k) { is[k] = isView && v === k; });
    out.is = is;
    if (isView && mod && mod.render) out[v] = mod.render(st, this.api(v));

    var apps = ORDER.filter(function (k) { return !VIEWS[k].hidden; }).map(function (k) {
      var def = VIEWS[k];
      return { d: IC[def.icon] || IC.grid, label: def.title, open: function () { self.openView(k); }, badge: def.badge && ["phone", "messages", "inbox"].indexOf(k) >= 0 ? !!def.badge(self.vget(k)) : false };
    });

    var NOTIF = [
      { id: "n1", d: IC.bubble, who: "Maya Chen", text: "Still on for 3? I can bring the prototype.", time: "2:04", go: { view: "messages", patch: { thread: "maya" } } },
      { id: "n2", d: IC.mail, who: "Jordan Park", text: "Revised term sheet attached", time: "1:12", go: { view: "inbox", patch: { open: 2 } } },
      { id: "n3", d: IC.cal, who: "Design review", text: "3:00 PM", time: "2:15", go: { view: "calendar", patch: { open: "c4" } } },
      { id: "n4", d: IC.shield, who: "Attestation passed", text: "Keys never left the device.", time: "6:00", go: { view: "settings", patch: { page: "privacy" } } }
    ];
    var shadeN = NOTIF.filter(function (n) { return isMvpView(n.go.view) && S.nGone.indexOf(n.id) < 0; }).map(function (n) {
      var s = self.sw(function (dx, dy) { self.setState({ nSlide: n.id }); self.later(function () { var S2 = self.S(); self.setState({ nGone: S2.nGone.concat([n.id]), nSlide: null }); }, 250); }, { axis: "x" });
      var sliding = S.nSlide === n.id;
      return Object.assign({}, n, { down: s.down, up: s.up, tx: sliding ? -420 : 0, op: sliding ? 0 : 1, open: function () { if (self.swallowed()) return; self.setState({ nGone: self.S().nGone.concat([n.id]) }); self.openView(n.go.view, n.go.patch); } });
    });
    var tileDefs = [["wifi", IC.wifi, "Wi-Fi"], ["bt", IC.bt, "Bluetooth"], ["dnd", IC.moon, "Do not disturb"], ["mic", IC.mic, "Agent can listen"], ["loc", IC.pin, "Location"], ["plane", IC.plane, "Airplane mode"], ["shield", IC.shield, "Enclave lock"], ["torch", IC.torch, "Flashlight"]];
    var tiles = tileDefs.map(function (t) {
      var on = S.q[t[0]];
      return { d: t[1], label: t[2], on: on, css: on ? "background:var(--acc);color:#fff" : "background:var(--s2);color:var(--fg)", toggle: function () {
        var q = Object.assign({}, self.S().q); q[t[0]] = !q[t[0]];
        if (t[0] === "plane") { if (q.plane) { self.prePlane = { wifi: q.wifi, bt: q.bt }; q.wifi = false; q.bt = false; } else if (self.prePlane) { q.wifi = self.prePlane.wifi; q.bt = self.prePlane.bt; } }
        self.setState({ q: q });
      } };
    });

    var msgs = S.msgs.slice().reverse().map(function (m) {
      var c = m.card || {}; var t = c.type;
      return {
        text: m.text, isUser: m.from === "user", isAgent: m.from === "agent", c: c,
        cAgenda: t === "agenda", cEvent: t === "event", cDigest: t === "digest", cNote: t === "note", cFlow: t === "flow", cSummary: t === "summary", cDraft: t === "draft", cCall: t === "call", cGeneric: t === "generic",
        gIcon: IC[c.icon] || IC.spark, evIcon: c.act && !c.done ? IC.plus : IC.check, callIni: c.ini || ((c.who || "").split(" ").map(function (w) { return w.charAt(0); }).join("").slice(0, 2)),
        sumSave: t === "summary" && !c.done && !!c.act, sumOpen: t === "summary" && !c.act && !!c.go,
        draftActs: !c.done && S.editCard !== m.id,
        done: !!c.done || (t === "call" && typeof PN !== "undefined" && !PN.live), notDone: !(c.done || (t === "call" && typeof PN !== "undefined" && !PN.live)),
        rows: (c.rows || []).map(function (r) { return Object.assign({}, r, { dot: r.key ? "var(--acc)" : "var(--line)", icon: IC[r.icon] || IC.right, open: function () { if (r.go) self.openView(r.go.view, r.go.patch, r.go.chat); else self.cardAct(m); } }); }),
        bullets: c.bullets || [],
        act: function () { self.cardAct(m); },
        edit: function () { self.setState({ draft: c.body || "", editCard: m.id }); }
      };
    });
    var baseSug = ["Plan my afternoon", "What needs me?", "Take a note: call the landlord Friday", "Every weekday at 6, wrap up my day"];
    var sugList = (mod && mod.suggestions) ? mod.suggestions(st, this.api(v)) : baseSug;
    var sugg = sugList.filter(function (s) { return !deferredMvpPrompt(s); }).map(function (s) { return { label: s, go: function () { self.send(s); } }; });

    var bars = []; for (var b = 0; b < 28; b++) bars.push({ h: 10 + ((b * 37) % 30), dl: ((b * 0.137) % 1).toFixed(2) });
    var vShow = S.voice === "speaking" ? S.vcap : (S.vtext || "…");

    var cur = S.screen === "home" ? (v ? v : (S.shade ? "shade" : "home")) : S.screen;
    var jumpDefs = [["boot", "Power on"], ["lock", "Lock"], ["home", "Home"], ["shade", "Shade"]];
    ORDER.forEach(function (k) { jumpDefs.push([k, VIEWS[k].title]); });
    var jumps = jumpDefs.map(function (j) { return { label: j[1], go: function () { self.lastSub = null; self.preset(j[0]); }, css: cur === j[0] ? "background:#ffffff;color:#000000;border-color:#ffffff" : "" }; });
    var subJumps = (v && VIEWS[v].jumps ? VIEWS[v].jumps : []).filter(function (j) { return j[0]; }).map(function (j) {
      var key = v + ":" + j[0];
      return { label: j[1], go: function () { self.lastSub = key; self.preset(key); }, css: self.lastSub === key ? "background:#2a2a2a;color:#ffffff" : "" };
    });
    var modes = [["hidden", IC.pill, "Pill"], ["input", IC.kbd, "Input"], ["sheet", IC.half, "Overlay"], ["full", IC.expand, "Full"]].map(function (md) {
      var on = isOn && S.chat === md[0];
      return { d: md[1], label: md[2], on: on, css: on ? "background:#0000FF;border-color:#0000FF" : "", go: function () { var S2 = self.S(); if (S2.screen !== "home") self.unlock(); self.setState({ chat: md[0], shade: false }); } };
    });
    var legend = [
      [IC.up, "Swipe up from the bottom bar, or tap it · Home, from anywhere"],
      [IC.back, "Swipe in from either edge · back one step inside the app"],
      [IC.down, "Pull down from the top · notifications and quick settings"],
      [IC.half, "Swipe up on Home · chat. Drag its grabber to resize"],
      [IC.mic, "Side key: hold · talk, tap · lock"]
    ].map(function (l) { return { d: l[0], t: l[1] }; });

    var showPill = isOn && S.chat === "hidden" && !voiceOn && !imm.noPill;
    var showComposer = isOn && S.chat === "input" && !voiceOn && !imm.noPill;
    var sbColor = isView && imm.dark && !S.shade && S.chat !== "full" && S.chat !== "sheet" ? "#ffffff" : "var(--fg)";
    if (S.secure) { showPill = false; showComposer = false; }
    var ongoing = null;
    ORDER.forEach(function (k) {
      if (ongoing || k === v || !VIEWS[k].ongoing) return;
      var o = VIEWS[k].ongoing(self.vget(k), self.api(k));
      if (o) ongoing = { label: o.label, icon: IC[o.icon] || IC.dot, color: o.color || "var(--acc)", open: function () { self.openView(k, null, null, { restore: true }); } };
    });

    return Object.assign(out, {
      mvpMessages: isMvpView("messages"),
      ic: IC, vars: vars, rootRef: rootRef, frame: th.frame, clock: clock, dateStr: dateStr, name: name,
      isBoot: S.screen === "boot", isOff: S.screen === "off", isLock: S.screen === "lock", isOn: isOn, isView: isView,
      viewBg: imm.dark ? "#000000" : "var(--bg)", viewFg: imm.dark ? "#ffffff" : "var(--fg)", sbColor: sbColor,
      showStatus: S.screen !== "boot" && S.screen !== "off" && !imm.noStatus, micLive: S.voice === "listening",
      showIndicator: isOn || S.screen === "lock",
      toast: S.toast, toastOn: !!S.toast, toastUndo: !!S.toastUndo, toastPadR: S.toastUndo ? 5 : 18, doUndo: function () { var f = self.undoFn; self.undoFn = null; self.clear("t"); self.setState({ toast: "", toastUndo: false }); if (f) f(); },
      hasOngoing: !!ongoing && isOn, ongoing: ongoing || {}, sbWifi: S.q.wifi, sbPlane: S.q.plane, apps: apps, toastBottom: imm.toastBottom || ((isOn && (S.chat === "input" || (S.chat === "hidden" && !imm.noPill))) ? 104 : 40),
      goCalendar: function () { self.openView("calendar", { open: "c4" }); },
      goTriage: function () { self.send("What needs me?"); },
      goFlows: function () { self.openView("workflows", { open: 1, run: "latest" }); },
      goSettings: function () { self.openView("settings"); },
      tiles: tiles, bright: S.bright, onBright: function (e) { self.setState({ bright: +e.target.value }); }, shadeN: shadeN, shadeY: isOn && S.shade ? "0" : "-100%",
      closeShade: function () { self.setState({ shade: false }); }, clearAll: function () { self.setState({ nGone: NOTIF.map(function (n) { return n.id; }), shade: false }); },
      lockSum: [{ d: IC.bubble, c: S.nGone.indexOf("n1") < 0 ? 2 : 0 }, { d: IC.mail, c: S.nGone.indexOf("n2") < 0 ? 1 : 0 }, { d: IC.cal, c: S.nGone.indexOf("n3") < 0 ? 1 : 0 }].filter(function (x) { return x.c > 0; }),
      lockCamera: function () { self.setState({ screen: "home", secure: true }); self.openView("camera"); },
      msgs: msgs, typing: S.typing, sugg: sugg, showSugg: panelOpen && !S.draft && !S.typing && !voiceOn,
      panelComposer: panelOpen && !voiceOn,
      panelH: !isOn ? 0 : (S.chat === "full" ? 915 : (S.chat === "sheet" ? 560 : 0)), panelR: S.chat === "full" ? "0px" : "30px 30px 0 0",
      panelOp: panelOpen ? 1 : 0, panelPE: panelOpen ? "auto" : "none", panelTop: S.chat === "full" ? 40 : 4,
      scrimOp: isOn && S.chat === "sheet" ? 1 : 0, scrimPE: isOn && S.chat === "sheet" ? "auto" : "none",
      sizeIcon: S.chat === "full" ? IC.shrink : IC.expand, sizeLabel: S.chat === "full" ? "Shrink chat" : "Expand chat",
      showComposer: showComposer, showPill: showPill, cmpBottom: 28,
      cmpPlaceholder: (mod && mod.placeholder) ? mod.placeholder : "Ask " + name,
      draft: S.draft, hasDraft: !!S.draft, noDraft: !S.draft,
      onDraft: function (e) { self.setState(e.target.value ? { draft: e.target.value } : { draft: "", editCard: null }); },
      onKey: function (e) { if (e.key === "Enter") { e.preventDefault(); self.send(); } },
      sendNow: function () { self.send(); },
      openSheet: function () { if (self.swallowed()) return; self.setState({ chat: "sheet" }); },
      toInput: function () { self.setState({ chat: "input" }); },
      closeChat: function () { self.setState({ chat: self.rest() }); },
      scrimTap: function () { self.setState({ chat: self.rest() }); },
      grabTap: function () { if (self.swallowed()) return; self.setState({ chat: self.S().chat === "full" ? "sheet" : "full" }); },
      grabSw: this.sw(function (dx, dy) { var c = self.S().chat; if (dy < 0) self.setState({ chat: "full" }); else self.setState({ chat: c === "full" ? "sheet" : self.rest() }); }),
      cmpSw: this.sw(function (dx, dy) { if (dy < 0) self.setState({ chat: "sheet" }); else if (self.S().view && self.defaultChat(self.S().view) === "hidden") self.setState({ chat: "hidden" }); }),
      pillSw: this.sw(function (dx, dy) { if (dy < 0) self.setState({ chat: "sheet" }); }),
      voiceOn: voiceOn, vShow: vShow, vRing: S.voice === "listening" || S.voice === "speaking",
      vTextCss: S.voice === "thinking" ? "color:var(--mut)" : "", vBarColor: S.voice === "thinking" ? "var(--line)" : "var(--acc)", vPlay: S.voice === "thinking" ? "paused" : "running", bars: bars,
      startVoice: function () { self.startVoice(); }, stopVoice: function () { self.stopVoice(); },
      voiceToType: function () { var vt = self.S().vtext; self.stopVoice(); self.setState({ chat: self.S().screen === "home" ? "sheet" : self.S().chat, draft: vt }); },
      showHeads: isOn && S.heads && !S.shade,
      headsSw: this.sw(function () { self.setState({ heads: false }); }),
      headsOpen: function () { if (self.swallowed()) return; self.openView("messages", { thread: "maya" }); },
      headsOk: function () { self.setState({ heads: false }); self.toast("Confirmed with Maya"); },
      headsX: function () { self.setState({ heads: false }); },
      headsReply: function () { self.setState({ heads: false }); self.agentSay("Here's a reply to Maya.", { type: "draft", to: "Maya Chen", body: "Yes, see you at 3. Bring the prototype!", act: { mod: "messages", fn: "sendDraft" }, pid: "maya" }); },
      fireHeads: function () { var S2 = self.S(); if (S2.screen !== "home") self.unlock(); self.later(function () { self.showHeads(); }, 80); },
      unlock: function () { self.unlock(); }, wake: function () { self.setState({ screen: "lock" }); },
      pDown: function (e) { e.stopPropagation(); self.pLong = false; clearTimeout(self.pT); self.pT = setTimeout(function () { self.pLong = true; self.startVoice(); }, 550); },
      pUp: function (e) {
        e.stopPropagation(); clearTimeout(self.pT); if (self.pLong) return; self.pLong = true;
        var now = Date.now();
        if (self.lastTap && now - self.lastTap < 380 && isMvpView("wallet")) { self.lastTap = 0; clearTimeout(self.tapT); var S2 = self.S(); if (S2.screen !== "home") self.setState({ screen: "home", secure: true }); self.openView("wallet", { pay: true }); return; }
        self.lastTap = now; clearTimeout(self.tapT); self.tapT = setTimeout(function () { self.lastTap = 0; self.power(); }, 380);
      },
      pCancel: function () { clearTimeout(self.pT); },
      back: function () { self.back(); },
      gDown: function (e) { self.gDown(e); }, gUp: function (e) { self.gUp(e); }, gCancel: function () { self.g = null; },
      bootMark: S.bootStep >= 1 ? 1 : 0, bootMarkY: S.bootStep >= 1 ? 0 : 12, bootTag: S.bootStep >= 2 ? 1 : 0,
      jumps: jumps, subJumps: subJumps, hasSubJumps: subJumps.length > 0, modes: modes, legend: legend,
      fs: fs, notFs: !fs, rootJustify: fs ? "center" : "flex-start",
      showHint: isOn && S.hint && !S.shade && S.chat !== "sheet" && S.chat !== "full",
      homeBar: function () { if (self.swallowed()) return; var S2 = self.S(); if (S2.screen === "lock") return self.unlock(); if (S2.screen === "home") self.goHome(); },
      toggleFs: function () {
        var next = !fs; self.setState({ fs: next });
        try { if (window.top === window.self && document.fullscreenEnabled) { if (next && !document.fullscreenElement) document.documentElement.requestFullscreen(); if (!next && document.fullscreenElement) document.exitFullscreen(); } } catch (err) {}
      },
      themes: [["light", "Light", "#FFFFFF"], ["dark", "Dark", "#000000"]].map(function (t) { var on = theme === t[0]; return { label: t[1], sw: t[2], on: on, css: on ? "background:#ffffff;color:#000000;border-color:#ffffff" : "", go: function () { self.setState({ theme: t[0] }); } }; })
    });
  }
}



export { Component, VIEWS, ORDER };
