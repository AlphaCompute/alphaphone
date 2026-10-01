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
function inboxRecipName(api, r) { var p = inboxPerson(api, r); return p ? p.name : r; }
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
