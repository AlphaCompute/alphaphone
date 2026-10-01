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
function walAddTx(api, cardId, tx) {
  var cards = api.get("wallet").cards.map(function (c) { return c.id === cardId ? Object.assign({}, c, { tx: [tx].concat(c.tx) }) : c; });
  api.set({ cards: cards });
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
        set({ transit: Math.round((s2.transit + 20) * 100) / 100 });
        if (dc) walAddTx(api, dc.id, { id: "t" + Date.now(), m: "Transit reload", a: 20, d: 0, icon: "walBus" });
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
            walAddTx(api, cid, { id: "p" + Date.now(), m: mer[0], a: mer[1], d: 0, icon: mer[2] });
            api.set({ stage: "done", paid: { m: mer[0], a: mer[1] }, pays: (s2.pays || 0) + 1 });
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
