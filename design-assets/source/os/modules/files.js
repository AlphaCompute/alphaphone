/* Files: locations, folders, preview, rename/move/share/delete, select mode, Ask Alpha. Holes are {{files.*}}. */
IC.filesDown = IC.filesDown || "M12 4v11M7 10l5 5 5-5M5 20h14";
IC.filesReceipt = IC.filesReceipt || "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3";
IC.filesPdf = IC.filesPdf || "M6 3h9l4 4v14H6zM14 3v5h5M9 12h6v5H9z";
IC.filesDoc = IC.filesDoc || "M6 3h9l4 4v14H6zM14 3v5h5";
IC.filesSort = IC.filesSort || "M7 4v16M4 17l3 3 3-3M13 6h8M13 12h6M13 18h4";
IC.filesRows = IC.filesRows || "M4 6h16M4 12h16M4 18h16";
IC.filesSelect = IC.filesSelect || "M21 12a9 9 0 1 1-18 0a9 9 0 1 1 18 0zM8 12l3 3 5-6";
IC.filesMove = IC.filesMove || "M3 6h6l2 2h10v11H3zM10 13.5h6M13.5 11l2.5 2.5-2.5 2.5";
IC.filesDisk = IC.filesDisk || "M4 5h16v14H4zM4 15h16M16 17.5h.01";
IC.filesZip = IC.filesZip || "M6 3h12v18H6zM12 3v2M12 7v2M12 11v2M10.5 15h3v3h-3z";

var FILES_FOLDERS = [
  { id: "Downloads", icon: "filesDown" },
  { id: "Documents", icon: "folder" },
  { id: "Receipts", icon: "filesReceipt" },
  { id: "Recordings", icon: "wave" },
  { id: "Northpoint", icon: "folder", parent: "Documents" }
];
var FILES_TYPES = {
  pdf: { label: "PDF", icon: "filesPdf" },
  doc: { label: "Document", icon: "notes" },
  image: { label: "Image", icon: "photo" },
  audio: { label: "Audio", icon: "wave" },
  archive: { label: "Archive", icon: "filesZip" }
};
var FILES_SEED = [
  { id: "tartine", name: "Tartine receipt.jpg", type: "image", folder: "Receipts", size: "1.8 MB", when: "Today", scan: "receipt",
    receipt: { shop: "TARTINE", rows: [["Morning bun", "5.25"], ["Country loaf", "14.00"], ["Cappuccino x2", "11.50"], ["Tip", "7.75"]], total: "38.50" },
    sum: ["Tartine Bakery, today at 1:48 PM", "Total $38.50, paid with the Visa ending 4417", "Filed under Meals for the September report"] },
  { id: "termsheet", name: "Northpoint_TermSheet_v3.pdf", type: "pdf", folder: "Downloads", size: "212 KB", when: "Today", from: "jordan",
    heading: "Summary of Terms", rows: [["Issuer", "Alpha Compute, Inc."], ["Security", "Series A Preferred"], ["Amount", "$8,000,000"], ["Pre-money", "$32,000,000"], ["Liquidation", "1x, non-participating"], ["Board", "2 common · 1 investor · 1 independent"], ["No-shop", "30 days"]], pages: 4,
    sum: ["$8M Series A at a $32M pre-money, led by Northpoint", "1x non-participating liquidation preference", "Board of four: two common, one investor, one independent", "30-day no-shop; changed from v2: option pool now 12%"] },
  { id: "designnotes", name: "Design review notes.pdf", type: "pdf", folder: "Documents", size: "1.1 MB", when: "Today",
    heading: "Design review", rows: [["Date", "Today, 3:00 PM"], ["With", "Maya, Jordan, Sam, Lena"], ["Scope", "Lock screen, chat, Notes"]], pages: 2,
    sum: ["Review of lock screen, chat heights and the new Notes recorder", "Open question: how vague should locked voice answers be", "Maya to bring the prototype"] },
  { id: "memo", name: "Voice memo · landlord.m4a", type: "audio", folder: "Recordings", size: "2.4 MB", when: "Yesterday", dur: 72,
    sum: ["Reminder to call the landlord on Friday", "Bedroom radiator clanks at night", "Ask about the lease renewal date"] },
  { id: "equinox", name: "Equinox · September.pdf", type: "pdf", folder: "Receipts", size: "96 KB", when: "Sep 26",
    heading: "Equinox SoMa", rows: [["Membership", "September"], ["Amount", "$215.00"], ["Card", "Visa · 4417"]], pages: 1,
    sum: ["Equinox SoMa membership for September", "$215.00 charged to the Visa ending 4417", "Renews October 26"] },
  { id: "proto", name: "Prototype v7.zip", type: "archive", folder: "Downloads", size: "48 MB", when: "Sep 25",
    contents: ["Main.dc.html", "shell.js", "modules/", "assets/", "README.md"],
    sum: ["Prototype build 7 from Maya", "5 items, mostly the shell and app modules", "Newer than the build on your home screen"] },
  { id: "roadmap", name: "Q4 roadmap.docx", type: "doc", folder: "Documents", size: "220 KB", when: "Sep 24",
    heading: "Q4 roadmap", rows: [["October", "Notes, Files, Wallet"], ["November", "Workflows beta"], ["December", "Enclave launch"]], pages: 3,
    sum: ["Three launches: apps in October, Workflows in November, Enclave in December", "Hiring two on-device ML engineers", "Risk: model size on older phones"] },
  { id: "boarding", name: "Boarding pass SFO–JFK.pdf", type: "pdf", folder: "Downloads", size: "180 KB", when: "Sep 20",
    heading: "Boarding pass", rows: [["Flight", "UA 1542"], ["Date", "Oct 9 · 7:05 AM"], ["Seat", "14A"], ["Gate", "F12"]], pages: 1,
    sum: ["UA 1542, SFO to JFK, Oct 9 at 7:05 AM", "Seat 14A, gate F12, boarding 6:25", "Already in your calendar"] },
  { id: "deck", name: "Series A deck v12.pdf", type: "pdf", folder: "Northpoint", size: "6.2 MB", when: "Sep 18",
    heading: "Alpha Compute", rows: [["Slides", "18"], ["For", "Northpoint partners"]], pages: 18,
    sum: ["18 slides: problem, device, agent, traction, raise", "Ask: $8M Series A", "Traction slide still shows August numbers"] },
  { id: "sideletter", name: "Side letter draft.docx", type: "doc", folder: "Northpoint", size: "64 KB", when: "Sep 17",
    heading: "Side letter", rows: [["Parties", "Northpoint, Alpha Compute"], ["Status", "Draft"]], pages: 2,
    sum: ["Information rights for Northpoint", "Pro-rata in the next round", "Still a draft; not signed"] },
  { id: "img2041", name: "IMG_2041.jpg", type: "image", folder: "Downloads", size: "3.1 MB", when: "Sep 14", scan: "photo",
    sum: ["Photo of Ocean Beach at sunset", "Taken Sep 14 at 7:12 PM", "Also in Photos"] }
];
var FL = { undoT: null, playI: null };

function filesFind(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
function filesSplit(name) { var i = name.lastIndexOf("."); return i > 0 ? [name.slice(0, i), name.slice(i)] : [name, ""]; }
function filesUndoable(api, entries, label) {
  api.toast(label, { undo: function () {
    var l = api.get("files").files.slice();
    entries.slice().sort(function (a, b) { return a.idx - b.idx; }).forEach(function (e) { if (!filesFind(l, e.f.id)) l.splice(Math.min(e.idx, l.length), 0, e.f); });
    api.set({ files: l });
  } });
}
function filesNorm(x) { return String(x || "").toLowerCase().replace(/[^a-z0-9]+/g, ""); }
function filesRemove(api, ids) {
  var s = api.get("files"); var entries = [];
  s.files.forEach(function (f, i) { if (ids.indexOf(f.id) >= 0) entries.push({ f: f, idx: i }); });
  clearInterval(FL.playI);
  api.set({ files: s.files.filter(function (f) { return ids.indexOf(f.id) < 0; }), open: null, sel: null, sheet: null, renaming: false, playing: false });
  filesUndoable(api, entries, entries.length === 1 ? entries[0].f.name + " deleted" : entries.length + " files deleted");
}
function filesShare(api, ids, via) {
  var s = api.get("files"); var fs = s.files.filter(function (f) { return ids.indexOf(f.id) >= 0; });
  var names = fs.map(function (f) { return f.name; });
  var to = fs.length === 1 && fs[0].from ? fs[0].from : null;
  api.set({ sheet: null, sel: null });
  if (via === "mail" && VIEWS.inbox) return api.open("inbox", { compose: { to: to, subject: names.length === 1 ? filesSplit(names[0])[0] : names.length + " files", body: "Attached: " + names.join(", "), attach: ids } });
  if (via === "msg" && VIEWS.messages) return api.open("messages", { compose: to || true, text: names.join(", "), attach: ids });
  api.toast("Ready to share");
}
function filesCount(list, folder) { return list.filter(function (f) { return f.folder === folder; }).length + FILES_FOLDERS.filter(function (d) { return d.parent === folder; }).length; }

registerView("files", {
  title: "Files", icon: "folder", aliases: ["downloads", "documents", "file"],
  chat: "hidden",
  state: { files: FILES_SEED, folder: null, open: null, grid: false, sort: "recent", sel: null, sheet: null, renaming: false, rn: "", q: null, menu: false, asked: {}, asking: null, playing: false, pos: 0 },
  persist: ["files", "grid", "sort"],
  jumps: [[null, "Files"], ["folder", "Folder"], ["preview", "File preview"]],
  preset: function (sub) {
    if (sub === "folder") return { folder: "Downloads" };
    if (sub === "preview") return { folder: "Downloads", open: "termsheet" };
  },
  immersive: function (st) { return st.sheet ? { noPill: true } : null; },
  back: function (st, api) {
    if (st.sheet) { api.set({ sheet: null }); return true; }
    if (st.menu) { api.set({ menu: false }); return true; }
    if (st.renaming) { api.set({ renaming: false }); return true; }
    if (st.open) { clearInterval(FL.playI); api.set({ open: null, playing: false, pos: 0 }); return true; }
    if (st.sel) { api.set({ sel: null }); return true; }
    if (st.folder) { var d = null; FILES_FOLDERS.forEach(function (x) { if (x.id === st.folder) d = x; }); api.set({ folder: d && d.parent ? d.parent : null }); return true; }
    if (st.q !== null && st.q !== undefined) { api.set({ q: null }); return true; }
    return false;
  },
  onLeave: function () { clearInterval(FL.playI); },
  suggestions: function (st) {
    if (st.open) return ["Summarize this file", "Send this to Jordan"];
    if (st.folder === "Receipts") return ["Total my receipts this month", "Find the term sheet"];
    return ["Find the term sheet", "Show my receipts", "What's taking up space?"];
  },
  voicePhrase: "Find the term sheet",
  reply: function (t, raw, api) {
    var st = api.get("files");
    var cur = api.active && st.open ? filesFind(st.files, st.open) : null;
    if (/term ?sheet/.test(t) && /\b(find|where|open|show|pull up|get)\b/.test(t) && !/summar/.test(t)) {
      var ts = filesFind(st.files, "termsheet");
      if (ts) return { text: "In " + ts.folder + ", from Jordan's email this afternoon.", card: { type: "generic", icon: "filesDoc", title: ts.name, sub: ts.folder + " · " + ts.size, go: { view: "files", patch: { open: "termsheet" } } }, nav: { view: "files", patch: { open: "termsheet" } } };
    }
    var ff = raw.match(/^\s*(?:find|where(?:'s| is))\s+(?:the\s+|my\s+)?(?:file\s+)?(.+?)\s*(?:file)?\??$/i);
    if (ff && !/\bnotes?\b/i.test(raw)) {
      var nq = filesNorm(ff[1].replace(/^(named|called)\s+/i, ""));
      var hit = nq.length > 2 ? st.files.filter(function (x) { return filesNorm(x.name).indexOf(nq) >= 0 || nq.indexOf(filesNorm(filesSplit(x.name)[0])) >= 0; })[0] : null;
      if (hit) return { text: "In " + hit.folder + ".", card: { type: "generic", icon: "filesDoc", title: hit.name, sub: hit.folder + " · " + hit.size, go: { view: "files", patch: { open: hit.id } } }, nav: { view: "files", patch: { open: hit.id, q: null } } };
    }
    if (/receipts?/.test(t) && /\b(show|find|open|my|where|total)\b/.test(t)) {
      var rs = st.files.filter(function (f) { return f.folder === "Receipts"; });
      return { text: /total/.test(t) ? "$253.50 across " + rs.length + " receipts this month." : rs.length + " receipts: Tartine $38.50 and Equinox $215.00.", card: { type: "generic", icon: "filesReceipt", title: "Receipts", sub: rs.length + " files · $253.50", go: { view: "files", patch: { folder: "Receipts" } } }, nav: { view: "files", patch: { folder: "Receipts", open: null } } };
    }
    if (/summar|what'?s in|tl;?dr|key points/.test(t) && (cur || /\b(pdf|file|document|doc|term sheet|receipt)\b/.test(t))) {
      var f = cur || (/receipt/.test(t) ? filesFind(st.files, "tartine") : /term sheet/.test(t) || /pdf/.test(t) ? filesFind(st.files, "termsheet") : null);
      if (f && f.sum) return { text: f.name, card: { type: "summary", title: filesSplit(f.name)[0] + " · summary", bullets: f.sum, act: VIEWS.notes ? { mod: "notes", fn: "save" } : null },
        then: function () { var a = Object.assign({}, api.get("files").asked); a[f.id] = true; api.set({ asked: a }); } };
    }
    if (/taking up space|storage|free up/.test(t)) {
      return { text: "38 GB used of 256. Biggest: Prototype v7.zip at 48 MB and 12 GB of video in Photos.", card: { type: "generic", icon: "filesDisk", title: "218 GB free", sub: "Prototype v7.zip · 48 MB", go: { view: "files", patch: { folder: "Downloads" } } } };
    }
    if (cur && /send (this|it)|share (this|it)/.test(t)) {
      var pid = /jordan/.test(t) ? "jordan" : /maya/.test(t) ? "maya" : /priya/.test(t) ? "priya" : cur.from || "jordan";
      var p = api.person(pid);
      return { text: "Draft to " + p.name.split(" ")[0] + " with " + cur.name + " attached.", card: { type: "draft", to: p.name, pid: pid, body: "Here's " + filesSplit(cur.name)[0] + ". Let me know if anything's off.", act: VIEWS.messages && VIEWS.messages.actions && VIEWS.messages.actions.sendDraft ? { mod: "messages", fn: "sendDraft" } : null } };
    }
    return null;
  },

  render: function (st, api) {
    var files = st.files || [];
    var sel = st.sel;
    var isSel = !!sel;
    function row(f) {
      var ty = FILES_TYPES[f.type] || FILES_TYPES.pdf;
      var on = isSel && sel.indexOf(f.id) >= 0;
      return {
        id: f.id, name: f.name, sub: (f.type === "pdf" ? "PDF" : ty.label) + " · " + f.size + " · " + f.when,
        chip: "", d: IC[ty.icon], isFile: true, isFolder: false,
        selOn: on, selOff: isSel && !on, rowCss: on ? "background: var(--s2)" : "",
        label: isSel ? ((on ? "Deselect " : "Select ") + f.name) : "Open " + f.name,
        tap: function () {
          if (isSel) { var cur = api.get("files").sel || []; api.set({ sel: cur.indexOf(f.id) >= 0 ? cur.filter(function (x) { return x !== f.id; }) : cur.concat([f.id]) }); return; }
          clearInterval(FL.playI); api.set({ open: f.id, renaming: false, playing: false, pos: 0 });
        }
      };
    }
    function folderRow(d) {
      var n = filesCount(files, d.id);
      return { id: d.id, name: d.id, sub: n === 1 ? "1 item" : n + " items", chip: "", d: IC[d.icon] || IC.folder, isFile: false, isFolder: true, selOn: false, selOff: false, rowCss: isSel ? "opacity: .4" : "",
        label: "Open " + d.id, tap: function () { if (isSel) return; api.set({ folder: d.id }); } };
    }
    function sorted(arr) {
      if (st.sort === "name") return arr.slice().sort(function (a, b) { return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1; });
      return arr;
    }

    /* top level */
    var locs = FILES_FOLDERS.filter(function (d) { return !d.parent; }).map(function (d) {
      var n = filesCount(files, d.id);
      return { name: d.id, d: IC[d.icon], sub: n === 1 ? "1 item" : n + " items", go: function () { api.set({ folder: d.id, q: null }); } };
    });
    locs.push({ name: "Photos", d: IC.photo, sub: "2,184", go: function () { if (VIEWS.photos) api.open("photos"); else api.toast("Opening Photos"); } });
    var q = st.q == null ? null : String(st.q).toLowerCase().trim();
    var results = q ? files.filter(function (f) { return filesNorm(f.name + " " + f.folder + " " + (FILES_TYPES[f.type] || {}).label).indexOf(filesNorm(q)) >= 0; }).map(row) : [];

    /* folder */
    var fd = null;
    if (st.folder) {
      var subs = FILES_FOLDERS.filter(function (d) { return d.parent === st.folder; }).map(folderRow);
      var items = subs.concat(sorted(files.filter(function (f) { return f.folder === st.folder; })).map(row));
      fd = {
        name: st.folder, items: items, empty: items.length === 0,
        close: function () { var d = null; FILES_FOLDERS.forEach(function (x) { if (x.id === st.folder) d = x; }); api.set({ folder: d && d.parent ? d.parent : null, sel: null }); },
        viewIcon: st.grid ? IC.filesRows : IC.grid, viewLabel: st.grid ? "Show as list" : "Show as grid",
        toggleView: function () { api.set({ grid: !st.grid }); },
        openMenu: function () { api.set({ menu: true }); },
        menuRows: [["list", IC.filesRows, "List", !st.grid, { grid: false }], ["grid", IC.grid, "Grid", !!st.grid, { grid: true }], ["recent", IC.clock, "Newest first", st.sort !== "name", { sort: "recent" }], ["name", IC.filesSort, "Name", st.sort === "name", { sort: "name" }]].map(function (m) {
          return { label: m[2], d: m[1], on: m[3], go: function () { api.set(Object.assign({ menu: false }, m[4])); } };
        }),
        sortLabel: st.sort === "name" ? "Sort by date" : "Sort by name", sortCss: st.sort === "name" ? "color: var(--acct)" : "",
        toggleSort: function () { var nx = st.sort === "name" ? "recent" : "name"; api.set({ sort: nx }); api.toast(nx === "name" ? "Sorted by name" : "Sorted by date"); },
        select: function () { api.set({ sel: [] }); }
      };
    }
    var selCount = isSel ? sel.length : 0;

    /* preview */
    var f = st.open ? filesFind(files, st.open) : null;
    var pv = null;
    if (f) {
      var ty = FILES_TYPES[f.type] || FILES_TYPES.pdf;
      var parts = filesSplit(f.name);
      var paper = api.theme === "dark" ? "#E9E9E9" : "#FFFFFF";
      var pages = [];
      if (f.type === "pdf" || f.type === "doc") {
        for (var p = 0; p < Math.min(f.pages || 1, 2); p++) {
          var lines = []; for (var l = 0; l < (p === 0 ? 8 : 14); l++) lines.push({ w: (l * 37 % 35) + 60 });
          pages.push({ first: p === 0, rest: p > 0, heading: f.heading || parts[0], rows: (f.rows || []).map(function (r) { return { k: r[0], v: r[1] }; }), lines: lines, num: (p + 1) + " / " + (f.pages || 1) });
        }
      }
      var fromP = f.from ? api.person(f.from) : null;
      var asked = !!(st.asked || {})[f.id];
      var wave = []; for (var w = 0; w < 48; w++) wave.push({ h: Math.round(8 + 40 * Math.abs(Math.sin(w * 0.7) * Math.cos(w * 0.29))), c: f.dur && w / 48 < (st.pos || 0) / f.dur ? "var(--acct)" : "var(--s3)" });
      pv = {
        name: f.name, base: parts[0], ext: parts[1],
        meta: (f.type === "pdf" ? "PDF" : ty.label) + " · " + f.size + (fromP ? " · from " + fromP.name.split(" ")[0] : "") + " · " + f.folder,
        d: IC[ty.icon],
        isPages: pages.length > 0, pages: pages, paper: paper,
        isReceipt: f.scan === "receipt", isPhoto: f.scan === "photo", photoBg: imgBg("p10", "linear-gradient(180deg, #F4B26B 0%, #E57A5A 45%, #6D5A8C 62%, #2F4A6B 63%, #1E3550 100%)"), photoSun: IMG.p10 ? "none" : "block", isAudio: f.type === "audio", isArchive: f.type === "archive",
        receipt: f.receipt ? { shop: f.receipt.shop, rows: f.receipt.rows.map(function (r) { return { k: r[0], v: r[1] }; }), total: f.receipt.total } : null,
        contents: (f.contents || []).map(function (c) { return { name: c, d: /\/$/.test(c) ? IC.folder : IC.filesDoc }; }),
        wave: wave, time: Math.floor((st.pos || 0) / 60) + ":" + pad2(Math.floor(st.pos || 0) % 60) + " / " + Math.floor((f.dur || 0) / 60) + ":" + pad2((f.dur || 0) % 60),
        playIcon: st.playing ? IC.pause : IC.play, playLabel: st.playing ? "Pause" : "Play", playCss: st.playing ? "" : "fill: currentColor",
        play: function () {
          if (api.get("files").playing) { clearInterval(FL.playI); api.set({ playing: false }); return; }
          api.set({ playing: true, pos: (st.pos || 0) >= f.dur ? 0 : (st.pos || 0) });
          clearInterval(FL.playI);
          FL.playI = api.every(function () { var s = api.get("files"); var np = (s.pos || 0) + 1; if (np >= f.dur) { clearInterval(FL.playI); api.set({ pos: f.dur, playing: false }); return; } api.set({ pos: np }); }, 250);
        },
        transcribe: function () {
          if (!VIEWS.notes) return api.toast("Transcribing");
          var id = "memo-" + f.id;
          if (notesFind((api.get("notes").list || []), id)) return api.open("notes", { open: id });
          var note = { id: id, kind: "voice", title: "Landlord", when: "Yesterday · 6:20 PM", dur: f.dur, pinned: false,
            lines: [{ s: "me", t: "Note to self: call the landlord Friday.", at: 0 }, { s: "me", t: "The bedroom radiator clanks all night, and ask when the lease renewal is due.", at: 6 }],
            summary: f.sum.slice(0, 2), actions: [{ t: "Call the landlord Friday", done: false }, { t: "Ask about the lease renewal date", done: false }] };
          api.setView("notes", { list: [note].concat(api.get("notes").list || []) });
          api.open("notes", { open: id });
        },
        renaming: !!st.renaming, notRenaming: !st.renaming,
        rn: st.rn,
        startRename: function () { api.set({ renaming: true, rn: parts[0] }); },
        onRn: function (e) { api.set({ rn: e.target.value }); },
        saveRn: function () {
          var v = String(api.get("files").rn || "").trim();
          if (v) api.set({ files: api.get("files").files.map(function (x) { return x.id === f.id ? Object.assign({}, x, { name: v + parts[1] }) : x; }), renaming: false });
          else api.set({ renaming: false });
        },
        rnKey: function (e) {
          if (e.key === "Enter") { e.preventDefault(); var v = String(api.get("files").rn || "").trim(); if (v) api.set({ files: api.get("files").files.map(function (x) { return x.id === f.id ? Object.assign({}, x, { name: v + parts[1] }) : x; }), renaming: false }); else api.set({ renaming: false }); }
          if (e.key === "Escape") api.set({ renaming: false });
        },
        close: function () { clearInterval(FL.playI); api.set({ open: null, renaming: false, playing: false, pos: 0 }); },
        share: function () { api.set({ sheet: "share", renaming: false }); },
        move: function () { api.set({ sheet: "move", renaming: false }); },
        del: function () { filesRemove(api, [f.id]); },
        asked: asked, asking: st.asking === f.id, canAsk: !asked && st.asking !== f.id,
        sum: f.sum || [],
        askLabel: "Summarize",
        ask: function () { api.set({ asking: f.id }); api.later(function () { var a = Object.assign({}, api.get("files").asked); a[f.id] = true; api.set({ asked: a, asking: null }); }, 1100); },
        saveSum: function () { if (VIEWS.notes && VIEWS.notes.actions) VIEWS.notes.actions.save({ title: parts[0] + " · summary", bullets: f.sum }, api); else api.toast("Saved to Notes"); }
      };
    }

    /* sheets */
    var targetIds = f ? [f.id] : (sel || []);
    var curFolder = f ? f.folder : st.folder;
    var moveTo = FILES_FOLDERS.map(function (d) {
      var here = d.id === curFolder;
      return { name: d.id, d: IC[d.icon] || IC.folder, here: here, notHere: !here, sub: d.parent ? d.parent : "",
        go: function () {
          if (here) { api.set({ sheet: null }); return; }
          var ids = targetIds.slice();
          api.set({ files: api.get("files").files.map(function (x) { return ids.indexOf(x.id) >= 0 ? Object.assign({}, x, { folder: d.id }) : x; }), sheet: null, sel: null });
          api.toast((ids.length === 1 ? "Moved" : ids.length + " files moved") + " to " + d.id);
        } };
    });

    return {
      top: !st.folder, searching: st.q !== null && st.q !== undefined, notSearching: st.q === null || st.q === undefined,
      q: st.q || "", onQ: function (e) { api.set({ q: e.target.value }); }, search: function () { api.set({ q: "" }); }, endSearch: function () { api.set({ q: null }); },
      hasQuery: !!q, noQuery: !q, results: results, noResults: !!q && results.length === 0,
      locs: locs, recent: files.slice(0, 5).map(row),
      storageW: "15%",
      inFolder: !!fd, fd: fd,
      isList: !st.grid, isGrid: !!st.grid,
      isSel: isSel, notSel: !isSel, selCount: selCount === 0 ? "Select" : String(selCount), hasSel: selCount > 0, selOp: selCount > 0 ? "1" : ".35",
      exitSel: function () { api.set({ sel: null }); },
      selAll: function () { api.set({ sel: files.filter(function (x) { return x.folder === st.folder; }).map(function (x) { return x.id; }) }); },
      selShare: function () { if (selCount) api.set({ sheet: "share" }); },
      selMove: function () { if (selCount) api.set({ sheet: "move" }); },
      selDel: function () { if (selCount) filesRemove(api, sel.slice()); },
      isPreview: !!pv, pv: pv,
      moveSheet: st.sheet === "move", shareSheet: st.sheet === "share", moveTo: moveTo,
      closeSheet: function () { api.set({ sheet: null }); },
      shareMsg: function () { filesShare(api, targetIds, "msg"); },
      shareMail: function () { filesShare(api, targetIds, "mail"); },
      menuOpen: !!st.menu && !!fd, closeMenu: function () { api.set({ menu: false }); },
      askQ: "Ask " + api.name + ": \u201c" + String(st.q || "").trim() + "\u201d",
      askSearch: function () { var qq = String(api.get("files").q || "").trim(); api.set({ q: null }); api.send("Find the file " + qq); }
    };
  }
});
