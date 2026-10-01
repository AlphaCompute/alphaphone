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
  msgPush(api, pid, out);
  var st = api.get("messages");
  var bot = MSG_BOT[pid]; if (!bot) return;
  var n = (st.botI || {})[pid] || 0; if (n >= bot.length) return;
  var bi = Object.assign({}, st.botI); bi[pid] = n + 1; api.set({ botI: bi });
  api.later(function () { api.set({ typing: pid }); }, 900);
  api.later(function () { api.set({ typing: null }); msgPush(api, pid, { me: false, text: bot[n] }); }, 2600);
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
  immersive: function (st) { return (st.thread || typeof st.compose === "string") ? { noPill: true } : null; },
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
            var s2 = api.get("messages"); var snap = { threads: s2.threads, unread: s2.unread };
            var th = Object.assign({}, s2.threads); delete th[id]; var uu = Object.assign({}, s2.unread); delete uu[id];
            api.set({ slide: null, threads: th, unread: uu });
            api.toast("Conversation with " + msgFirst(w) + " deleted", { undo: function () { if (api.isActive()) api.set(snap); else api.open("messages", snap); } });
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
        api.set({ text: "", tray: false, attach: text != null ? s2.attach : null }); msgSend(api, tp, tx, null, fs);
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
        photos: MSG_PHOTOS.map(function (g, i) { return { css: "background:" + imgBg("msg" + i, g), label: "Send photo " + (i + 1), pick: function () { api.set({ tray: false }); msgSend(api, tp, null, i); } }; })
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
