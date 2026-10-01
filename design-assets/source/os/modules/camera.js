/* Camera: photo / video / scan. Immersive. Captures are prepended to Photos' shared list.
   Scenes come from phScene()/phLook() in the Photos module (CSS compositions, no images). All holes are {{camera.*}}. */
IC.camFlash = IC.camFlash || "M13 3L5 14h6l-1 7 8-11h-6l1-7z";
IC.camFlashOff = IC.camFlashOff || "M13 3L9.5 8M8 10l-3 4h6l-1 7 3.2-4.4M15 13.6L18 10h-6l1-7M3 3l18 18";
IC.camFlip = IC.camFlip || "M4 12a8 8 0 0 1 13.7-5.6L20 9M20 4v5h-5M20 12a8 8 0 0 1-13.7 5.6L4 15M4 20v-5h5";
IC.camScan = IC.camScan || "M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M7 12h10";

var CAM = { live: false, scan: false, lp: null, long: false, g: null };
var CAM_ZOOM = [[".5", 1], ["1×", 1.35], ["2", 2], ["5", 3.4]];
var CAM_MODES = [["video", "Video"], ["photo", "Photo"], ["scan", "Scan"]];
var CAM_DRIFT = [[0, 0], [-5, 3], [3, -4], [-2, -6], [4, 2]];
function camScene(st) { return st.mode === "scan" ? "poster" : (st.front ? "selfie" : "park"); }
function camFigs(st) { return st.mode !== "scan" && st.front ? [[50, 2.2]] : null; }
function camPoster(now) {
  var d = new Date(now); var add = (5 - d.getDay() + 7) % 7 || 7; d.setDate(d.getDate() + add);
  return { day: DAYS[d.getDay()].slice(0, 3) + ", " + MONS[d.getMonth()].slice(0, 3) + " " + d.getDate(), short: DAYS[d.getDay()].slice(0, 3) + " 6 PM" };
}
function camSave(api, item) {
  var ph = api.get("photos");
  api.setView("photos", { list: [item].concat(ph.list || []) });
  api.set({ session: [item.id].concat(api.get("camera").session || []) });   // this session's captures (all secure mode may show)
}
function camFlashFx(api) { api.set({ fl: 1 }); api.later(function () { api.set({ fl: 0 }); }, 90); }
function camStopRec(api) {
  var s = api.get("camera"); if (!s.rec) return;
  var sec = Math.max(1, Math.floor((Date.now() - s.recAt) / 1000));
  camSave(api, { id: "c" + Date.now(), ts: Date.now(), kind: "video", dur: Math.floor(sec / 60) + ":" + pad2(sec % 60), scene: camScene(s), figs: camFigs(s), place: "Dolores Park", people: [], tags: s.front ? ["selfie"] : [], fav: false, z: s.front ? 1 : CAM_ZOOM[s.zoom][1] });
  api.set({ rec: false, recAt: 0 }); api.stopBg();
}
function camAsk(api) {
  var s = api.get("camera");
  if (api.secure) { var k = Date.now(); api.set({ said: camDescribe(s, Date.now()), saidK: k }); api.later(function () { if (api.get("camera").saidK === k) api.set({ said: "" }); }, 7000); return; }
  api.send(s.mode === "scan" ? "What does it say?" : "What am I looking at?");
}
function camRecLabel(st) { var sec = Math.max(0, Math.floor((Date.now() - st.recAt) / 1000)); return Math.floor(sec / 60) + ":" + pad2(sec % 60); }
function camSaveScan(api, quiet) {
  var s = api.get("camera");
  camSave(api, { id: "c" + Date.now(), ts: Date.now(), kind: "doc", scene: "poster", figs: null, place: "Lumen HQ", people: [], tags: ["open studio", "lumen"], fav: false, z: 1 });
  if (!quiet) camFlashFx(api);
  return s;
}
function camDescribe(st, now) {
  if (st.mode === "scan") { var p = camPoster(now); return "A poster: Open Studio at Lumen, " + p.day + " at 6 PM, 1 Market St. The QR code goes to the RSVP page."; }
  if (st.front) return "That's you, with soft window light from the left. Good light for a selfie.";
  return "A park on a clear afternoon: lawn, two trees and a path up the hill. Plenty of light, no flash needed.";
}

registerView("camera", {
  title: "Camera", icon: "camera", aliases: ["cam"],
  chat: "hidden",
  state: { mode: "photo", front: false, flash: false, zoom: 1, rec: false, recAt: 0, tick: 0, fl: 0, focus: null, found: false, flip: false, session: [], said: "" },
  ongoing: function (st) { return st.rec ? { label: camRecLabel(st), icon: "video", color: "#E53935" } : null; },
  jumps: [[null, "Camera"], ["video", "Video"], ["scan", "Scan"]],
  preset: function (sub) { if (sub) return { mode: sub }; },
  immersive: function () { return { dark: true, noPill: true }; },
  back: function (st, api) { if (st.rec) { camStopRec(api); return true; } return false; },
  onLeave: function (api) { if (api.secure && api.get("camera").rec) camStopRec(api); CAM.live = false; CAM.scan = false; clearTimeout(CAM.lp); },  // recording keeps going in the background (ongoing chip) except from the lock screen
  suggestions: function (st) {
    if (st.mode === "scan") return ["What does it say?", "Add it to my calendar", "Save it to Files"];
    return ["What am I looking at?", "Take a selfie", "Scan a document"];
  },
  voicePhrase: "What am I looking at?",
  actions: {
    addEvent: function (card, api) { api.toast("Added to Calendar"); }
  },
  reply: function (t, raw, api) {
    var st = api.st; var now = api.now.getTime();
    if (api.active) {
      if (/what (am i|do you|is (this|that)|'s (this|that))|what.*(see|looking)|read (this|it)|what does it say|describe/.test(t)) {
        if (st.mode === "scan") { var p = camPoster(now); return { text: camDescribe(st, now), card: { type: "event", time: p.day + " · 6:00 PM", title: "Open Studio · Lumen", act: { mod: "camera", fn: "addEvent" } } }; }
        return { text: camDescribe(st, now) };
      }
      if (st.mode === "scan" && /calendar|add (it|the event|event)/.test(t)) return { text: "Added Open Studio to your calendar.", then: function () { api.toast("Added to Calendar"); } };
      if (st.mode === "scan" && /files|save (it|this)/.test(t)) return { text: "Saved to Files, under Scans.", then: function () { camSaveScan(api, true); api.toast("Saved to Files"); } };
      if (/\b(take|snap|shoot)\b.*\bselfie\b/.test(t)) return { text: "Smile.", then: function () { api.set({ mode: "photo", front: true }); api.later(function () { api.set({ fl: 1 }); var s = api.get("camera"); camSave(api, { id: "c" + Date.now(), ts: Date.now(), kind: "photo", scene: "selfie", figs: [[50, 2.2]], place: "Dolores Park", people: [], tags: ["selfie"], fav: false, z: 1 }); api.later(function () { api.set({ fl: 0 }); }, 90); }, 900); } };
      if (/\b(take|snap|shoot)\b.*\b(photo|picture|pic|shot)\b/.test(t)) return { text: "Got it.", then: function () { var s = api.get("camera"); camFlashFx(api); camSave(api, { id: "c" + Date.now(), ts: Date.now(), kind: "photo", scene: camScene(s), figs: camFigs(s), place: "Dolores Park", people: [], tags: s.front ? ["selfie"] : [], fav: false, z: s.front ? 1 : CAM_ZOOM[s.zoom][1] }); } };
    }
    if (/\b(take|snap)\b.*\bselfie\b/.test(t)) return { text: "Front camera's ready.", nav: { view: "camera", patch: { mode: "photo", front: true } } };
    if (/\b(take|snap|shoot)\b.*\b(photo|picture|pic)\b|\bopen (the )?camera\b/.test(t)) return { text: "Camera's ready.", nav: { view: "camera", patch: { mode: "photo" } } };
    if (/\b(record|film|shoot)\b.*\bvideo\b/.test(t)) return { text: "Tap the red button to start.", nav: { view: "camera", patch: { mode: "video" } } };
    if (/\bscan\b.*\b(document|doc|receipt|qr|code|poster|page|this|a|it)\b/.test(t)) return { text: "Point it at the page. I'll read it.", nav: { view: "camera", patch: { mode: "scan", found: false } } };
    return null;
  },
  render: function (st, api) {
    var now = api.now.getTime();
    if (!CAM.live) { CAM.live = true; api.every(function () { var s = api.get("camera"); if (!s.rec) api.set({ tick: (s.tick || 0) + 1 }); }, 1000); }
    if (st.mode === "scan" && !st.found && !CAM.scan) { CAM.scan = true; api.later(function () { CAM.scan = false; if (api.get("camera").mode === "scan") api.set({ found: true }); }, 1100); }
    var isScan = st.mode === "scan", isVideo = st.mode === "video";
    var front = st.front && !isScan;
    var zs = isScan ? 0.8 : (front ? 1.05 : CAM_ZOOM[st.zoom][1]);
    var dr = CAM_DRIFT[Math.floor((st.tick || 0) / 2) % CAM_DRIFT.length];
    var bg = phScene(camScene(st), camFigs(st), 0, PH_SCENE_IMG[camScene(st)]);
    var setMode = function (m) { var s = api.get("camera"); if (s.rec) camStopRec(api); if (s.mode !== m) api.set({ mode: m, found: false }); };
    var modeIdx = CAM_MODES.map(function (m) { return m[0]; }).indexOf(st.mode);

    var ph = api.get("photos"); var sess = st.session || [];
    var last = (ph.list || []).filter(function (it) { return !api.secure || sess.indexOf(it.id) >= 0; })[0] || null;
    var lastLook = last ? phLook(last, "thumb") : null;
    var poster = camPoster(now);

    function pt(e) { var sc = e.currentTarget.closest("[data-screen]"); var r = sc.getBoundingClientRect(); var s = r.width / 412 || 1; return { x: (e.clientX - r.left) / s, y: (e.clientY - r.top) / s }; }
    return {
      bg: bg, vfBg: isScan ? "linear-gradient(135deg, #6B5A4A, #4E4036)" : "#111111",
      drift: "transform: translate(" + dr[0] + "px, calc(-50% + " + dr[1] + "px))",
      zoomCss: "transform: scale(" + zs + ")" + (front ? " scaleX(-1)" : "") + "; filter: " + (st.flip ? "blur(14px) brightness(.7)" : "none"),
      flOp: st.fl ? (st.flash ? 1 : 0.85) : 0, flTr: st.fl ? "none" : "opacity .45s",
      hasFocus: !!st.focus, focus: st.focus ? "left: " + (st.focus.x - 34) + "px; top: " + (st.focus.y - 34) + "px" : "",
      flashIcon: st.flash ? IC.camFlash : IC.camFlashOff, flashLabel: st.flash ? "Flash on" : "Flash off",
      toggleFlash: function () { api.set({ flash: !api.get("camera").flash }); },
      rec: st.rec, recTime: st.rec ? camRecLabel(st) : "",
      said: st.said || "", hasSaid: !!st.said, clearSaid: function () { api.set({ said: "" }); },
      showZoom: !isScan && !front,
      zooms: CAM_ZOOM.map(function (z, i) {
        var on = st.zoom === i;
        return { label: z[0], aria: "Zoom " + z[0].replace("×", "") + "x", css: on ? "background:#ffffff;color:#000000;width:40px;height:40px;font-size:13px" : "background:rgba(0,0,0,.4);color:#ffffff;width:34px;height:34px;font-size:12px", pick: function () { api.set({ zoom: i }); } };
      }),
      scanFound: isScan && st.found, scanning: isScan && !st.found,
      posterDay: poster.short,
      addEvent: function () { api.toast("Added to Calendar · " + poster.short); },
      saveFiles: function () { camSaveScan(api); api.toast("Saved to Files"); },
      openLink: function () { api.open("browser", { url: "lumen.example/open-studio" }); },
      modes: CAM_MODES.map(function (m) {
        var on = st.mode === m[0];
        return { label: m[1], css: on ? "color:#ffffff" : "color:rgba(255,255,255,.55)", dot: on ? 1 : 0, pick: function () { setMode(m[0]); } };
      }),
      innerCss: isVideo ? (st.rec ? "width:30px;height:30px;border-radius:8px;background:#E53935" : "width:62px;height:62px;border-radius:31px;background:#E53935") : "width:62px;height:62px;border-radius:31px;background:#ffffff",
      scanGlyph: isScan,
      shutterLabel: isVideo ? (st.rec ? "Stop recording" : "Start recording") : (isScan ? "Save scan" : "Take photo"),
      shutter: function () {
        var s = api.get("camera");
        if (s.mode === "video") { if (s.rec) camStopRec(api); else { api.set({ rec: true, recAt: Date.now() }); api.everyBg(function () { var c = api.get("camera"); api.set({ tick: (c.tick || 0) + 1 }); }, 1000); } return; }
        if (s.mode === "scan") { camSaveScan(api); api.toast("Scan saved"); return; }
        camFlashFx(api);
        camSave(api, { id: "c" + Date.now(), ts: Date.now(), kind: "photo", scene: camScene(s), figs: camFigs(s), place: "Dolores Park", people: [], tags: s.front ? ["selfie"] : [], fav: false, z: s.front ? 1 : CAM_ZOOM[s.zoom][1] });
      },
      hasLast: !!last, lastBg: lastLook ? lastLook.bg : "", lastTf: lastLook ? lastLook.tf : "", lastFlt: lastLook ? lastLook.flt : "none",
      openLast: function () { if (last) api.open("photos", { open: last.id, from: "camera", seq: api.secure ? sess.slice() : null, chrome: true, sheet: null, edit: null, sel: null, searching: false }); },
      showFlip: !isScan && !st.rec, noFlip: isScan || !!st.rec, noLast: !last,
      flip: function () { api.set({ front: !api.get("camera").front, flip: true }); api.later(function () { api.set({ flip: false }); }, 260); },
      ask: function () { camAsk(api); },
      vfDown: function (e) {
        CAM.g = pt(e); CAM.long = false; clearTimeout(CAM.lp); try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
        CAM.lp = setTimeout(function () { CAM.long = true; camAsk(api); }, 650);
      },
      vfUp: function (e) {
        clearTimeout(CAM.lp); var g = CAM.g; CAM.g = null; if (!g || CAM.long) return;
        var p = pt(e); var dx = p.x - g.x, dy = p.y - g.y;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) && g.x > 30 && g.x < 382) {
          var ni = modeIdx + (dx < 0 ? 1 : -1); if (ni >= 0 && ni < CAM_MODES.length) setMode(CAM_MODES[ni][0]); return;
        }
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
          var k = Date.now(); api.set({ focus: { x: g.x, y: g.y - 96, k: k } });
          api.later(function () { var s = api.get("camera"); if (s.focus && s.focus.k === k) api.set({ focus: null }); }, 1100);
        }
      },
      vfLeave: function () { clearTimeout(CAM.lp); CAM.g = null; }
    };
  }
});
