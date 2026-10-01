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
      month: monthOpen ? MONS[mBase.getMonth()] + (mBase.getFullYear() !== today.getFullYear() ? " " + mBase.getFullYear() : "") : MONS[selDate.getMonth()] + (selDate.getFullYear() !== today.getFullYear() ? " " + selDate.getFullYear() : ""),
      dayMode: !monthOpen,
      dayName: calDayName(api, sel),
      week: week, events: events, hours: hours, empty: evs.length === 0 && sel !== 0,
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
