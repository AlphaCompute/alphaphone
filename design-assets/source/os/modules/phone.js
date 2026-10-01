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
  PN.live = null; api.stopBg();
  var s = api.get("phone");
  var dur = s.liveAt ? Math.round((Date.now() - s.liveAt) / 1000) : 0;
  var sc = PN_SCRIPT[s.call] || PN_SCRIPT._;
  var note = s.ai && s.aiN > 0 ? sc.sum : "";
  var e = { id: "r" + Date.now(), pid: s.call || null, num: s.num || "", dir: s.dir || "out", at: Date.now(), dur: dur, note: note };
  api.set({ recents: [e].concat(s.recents || []), call: null, num: "", callWho: null, callAt: null, liveAt: null, ai: false, aiN: 0, kp: false, min: false, hold: false, mute: false, spk: false, ret: null, tab: PN.lastTab || s.tab });
  if (opt.quiet) return;
  if (note) api.toast(api.name + " saved notes from the call");
  /* started from another app's detail (e.g. a contact): hang up returns there, and drop it from the back stack */
  if (s.ret && api.isActive()) { var stack = (api.S.stack || []).slice(); if (stack[stack.length - 1] === s.ret.view) stack.pop(); api.open(s.ret.view, s.ret.patch); api.shell({ stack: stack }); }
}
function pnRingEnd(api, entry) {
  api.stopBg();
  var s = api.get("phone");
  api.set({ incoming: null, ring: null, rs: false, scrN: 0, recents: [Object.assign({ id: "r" + Date.now(), pid: s.incoming, at: Date.now(), dur: 0 }, entry)].concat(s.recents || []) });
}
function pnDecline(api, why) {
  var s = api.get("phone"); var pid = s.incoming;
  pnRingEnd(api, { dir: "missed", note: why || "" });
  if (!why) api.laterBg(function () {
    var s2 = api.get("phone");
    api.set({ vms: [{ id: "v" + Date.now(), pid: pid, at: Date.now(), dur: 12, heard: false, gist: "she's running ten minutes late", text: "Hey, it's Maya. Running ten minutes late for three. See you soon!" }].concat(s2.vms || []) });
    api.toast("New voicemail from " + pnFirst(pnWho(api, pid)));
  }, 2600);
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
          api.toast("Voicemail from " + (p ? pnFirst(p) : (v.label || v.num)) + " deleted", { undo: function () { var s2 = api.get("phone"); var l = (s2.vms || []).slice(); l.splice(Math.min(i, l.length), 0, v); api.set({ vms: l }); } });
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
