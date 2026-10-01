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
    var np = ctMake(Object.assign({ id: (clean.first || clean.last || "c").toLowerCase().replace(/\W/g, "") + (Date.now() % 100000), fav: false }, clean));
    api.set({ list: l.concat([np]), edit: null, add: null, form: null, open: np.id, q: "" });
  }
  api.toast("Saved");
  return true;
}
function ctDeleted(api, p, idx) {
  api.toast(p.name + " deleted", { undo: function () {
    var l = ctList(api).slice(); l.splice(idx < 0 ? l.length : Math.min(idx, l.length), 0, p);
    api.setView("contacts", { list: l });
    if (api.isActive()) api.setView("contacts", { open: p.id });
  } });
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
      var np = ctMake({ id: (parts[0] || "c").toLowerCase().replace(/\W/g, "") + (Date.now() % 100000), first: parts[0] || "", last: parts.slice(1).join(" "), phone: ph && typeof pnFmt === "function" ? pnFmt(ph) : ph.trim(), email: em, address: "", birthday: "", note: "", fav: false });
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
