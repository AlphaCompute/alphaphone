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
  api.set({ list: s.list.map(function (n) { return n.id === id ? Object.assign({}, n, typeof patch === "function" ? patch(n) : patch) : n; }) });
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
function notesDelete(api, id) {
  var s = api.get("notes"); notesStopTimers();
  var idx = -1; s.list.forEach(function (n, i) { if (n.id === id) idx = i; });
  if (idx < 0) return;
  var note = s.list[idx];
  api.set({ list: s.list.filter(function (n) { return n.id !== id; }), open: null, sheet: null, playing: false, dict: false });
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
      pin: function () { notesUpd(api, n.id, { pinned: !n.pinned }); api.toast(n.pinned ? "Unpinned" : "Pinned"); },
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
