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
