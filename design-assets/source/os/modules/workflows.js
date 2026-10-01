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
function wfFlows(api) { var st = api.get("workflows"); return st.flows || WF_SEED; }
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
    trig = p ? { kind: "message", person: p.id } : { kind: "email", match: m[1] };
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
    name = api.person(trig.person).name.split(" ")[0] + "'s scheduling";
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
  badge: function (st) { return (st.flows || WF_SEED).some(function (f) { return f.on && f.runs && f.runs[0] && f.runs[0].status === "fail"; }); },
  suggestions: function (st) {
    if (st.build || st.create) return ["Every weekday at 6, wrap up my day", "Whenever Maya texts, check my calendar"];
    var f = st.open != null ? wfFind(st.flows || WF_SEED, st.open) : null;
    if (f) return ["Run " + f.name + " now", "Why did " + f.name + " run?", "Turn off " + f.name];
    return ["Every weekday at 6, wrap up my day", "Whenever Maya texts, check my calendar", "Why did Receipts to Files fail?"];
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
      var f = Object.assign({}, card.flow, { id: Date.now(), on: true, runs: [] });
      api.set({ flows: wfFlows(api).concat([f]) });
      api.toast(f.name + " is on");
    }
  },
  reply: function (t, raw, api) {
    var list = wfFlows(api); var st = api.get("workflows");
    var cur = st.open != null ? wfFind(list, st.open) : null;
    var setFlows = function (l) { api.setView("workflows", { flows: l }); };
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
      var nf = wfFromText(t, raw, api);
      return { text: "Here's the workflow. Turn it on?", card: { type: "flow", name: nf.name, short: nf.summary, flow: nf, act: { mod: "workflows", fn: "enable" } } };
    }
    return null;
  },
  render: function (st, api) {
    var list = st.flows || WF_SEED;
    var set = function (p) { api.set(p); };
    var setFlow = function (id, p) { set({ flows: list.map(function (x) { return x.id === id ? Object.assign({}, x, p) : x; }) }); };
    var toggle = function (f) { return function () { setFlow(f.id, { on: !f.on }); api.toast(f.name + (f.on ? " is off" : " is on")); }; };
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
      api.toast(label, { undo: function () { var l = wfFlows(api).slice(); if (!wfFind(l, f0.id)) { l.splice(Math.min(idx, l.length), 0, f0); api.setView("workflows", { flows: l }); } } });
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
        runs: runs, hasRuns: runs.length > 0,
        close: function () { set({ open: null }); },
        edit: function () { set({ build: { id: f.id, name: f.name, trig: Object.assign({}, f.trig), steps: f.steps.map(function (s) { return Object.assign({}, s); }) } }); },
        del: function () { var idx = list.indexOf(f); set({ flows: list.filter(function (x) { return x.id !== f.id; }), open: null, run: null }); undo(f.name + " deleted", f, idx); },
        run: function () {
          if (st.running) return;
          var n = f.steps.length + 1;
          set({ running: { id: f.id, i: 0 } });
          for (var i = 1; i < n; i++) (function (i) { api.later(function () { api.setView("workflows", { running: { id: f.id, i: i } }); }, 550 * i); })(i);
          api.later(function () {
            var cur = wfFlows(api); var run = { id: "r" + Date.now(), when: wfNowLabel(api), status: "ok", sum: "Ran on request", dur: (n * 0.6).toFixed(0) + " s", log: wfRunLog(f, api), out: "" };
            api.setView("workflows", { running: null, flows: cur.map(function (x) { return x.id === f.id ? Object.assign({}, x, { runs: [run].concat(x.runs || []) }) : x; }) });
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
        when: rr.when, flow: f.name,
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
    if (b) {
      var set0 = set; set = function (p) { set0(Object.assign({ create: false }, p)); };
      var bp = function (p) { set({ build: Object.assign({}, b, p) }); };
      var sheet = st.sheet;
      B = {
        isNew: !b.id, name: b.name, onName: function (e) { bp({ name: e.target.value }); },
        steps: diagram(b.trig, b.steps, { more: true, tap: function (i) { return function () { set({ sheet: i === 0 ? { type: "trig" } : { type: "step", i: i - 1 } }); }; } }),
        palette: WF_PALETTE.map(function (k) {
          return { k: k, d: IC[WF_KINDS[k].icon], label: "Add " + k + " step",
            add: function () { var p = WF_KINDS[k].presets[0]; var steps = b.steps.concat([{ k: k, t: p[0], apps: p[1].slice() }]); set({ build: Object.assign({}, b, { steps: steps }), sheet: { type: "step", i: steps.length - 1 } }); } };
        }),
        apps: chipsOf(b), hasApps: wfApps(b).length > 0, empty: b.steps.length === 0,
        saveOff: b.steps.length === 0, saveCss: b.steps.length ? "background:var(--acc);color:#fff" : "background:var(--s2);color:var(--mut)",
        describe: function () { set({ build: null }); api.chat("Every weekday at 6, "); },
        cancel: function () { set({ build: null, sheet: null }); },
        save: function () {
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
          kinds: WF_TRIG.map(function (k) { var on = tr.kind === k[0]; return { d: IC[k[1]], label: k[2], css: on ? "background:var(--acc);color:#fff" : "background:var(--s2)", pressed: on, pick: function () { bp({ trig: { kind: k[0], days: "Weekdays", t: 18, ev: WF_EVENTS[0][0], person: "maya", place: WF_PLACES[0], match: "receipt" } }); } }; }),
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
          presets: (WF_KINDS[s.k].presets || []).map(function (p) { var on = s.t === p[0]; return { label: p[0], on: on, css: on ? "background:var(--acc);color:#fff" : "background:var(--s2)", pick: function () { sp({ t: p[0], apps: p[1].slice() }); } }; }),
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
