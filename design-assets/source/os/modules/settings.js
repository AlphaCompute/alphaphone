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
  { id: "google", name: "Google", sub: "Gmail, Calendar, Contacts", dom: "gmail.example", web: "accounts.google.example", oauth: true },
  { id: "microsoft", name: "Microsoft", sub: "Outlook, Exchange", dom: "outlook.example", web: "login.microsoft.example", oauth: true },
  { id: "icloud", name: "iCloud", sub: "Mail, Calendar, Contacts", dom: "icloud.example", web: "", oauth: false },
  { id: "other", name: "Other", sub: "IMAP · CalDAV · CardDAV", dom: "mail.example", web: "", oauth: false }
];
var ST_TYPES = [["mail", "Mail", "mail"], ["calendar", "Calendar", "cal"], ["contacts", "Contacts", "user"]];
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
var ST_PERMS = [["mic", "Microphone", "mic"], ["loc", "Location", "pin"], ["camera", "Camera", "camera"], ["contacts", "Contacts", "user"]];
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

function stRow(kind, o) { var r = Object.assign({ label: "", sub: "", val: "" }, o); r[kind] = true; r.hasSub = !!r.sub; r.hasIcon = !!r.d; r.hasVal = !!r.val; return r; }
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
          { rows: ST_PERMS.map(function (pm) { var n = Object.keys(st.perms[pm[0]] || {}).filter(function (k) { return st.perms[pm[0]][k] && (k === "alpha" || VIEWS[k]); }).length; return stNav({ d: IC[pm[2]], label: pm[1], val: n === 1 ? "1 app" : n + " apps", go: function () { set({ perm: pm[0] }); } }); }) },
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
        var nacc = { id: "a" + Date.now(), provider: pv2.id, label: "", address: addr, mail: lv.mail !== "off", calendar: lv.calendar !== "off", contacts: lv.contacts !== "off",
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
    } else if (P === "privacy" && st.perm) {
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
