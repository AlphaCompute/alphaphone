/* ================= animated SVG export =================
   Samples the loop, keeps every sampled frame exact, and writes one SMIL
   path morph per visible line. Lines that are exact rotations or mirrors of
   another line (the kaleido quadrants) reuse its animation through <use>. */
var animSvgOpts = { kps: 24, eps: 0.25, bg: true, hold: false };
/* "Undulate only": extend, wave and bloom held at full for the whole loop, and the
   loop is exactly one wave cycle (1 / speed seconds), so it repeats seamlessly. */
var ANIM_HOLD = [-2, -1, 11, 12];
function animHoldT() { var sp = Math.abs(doc.motion.speed || 0); return sp > 1e-6 ? 1 / sp : loopT(doc); }
function animWithHold(hold, fn) {
  if (!hold) return fn();
  var m = doc.motion, keep = { tExtend: m.tExtend, tWave: m.tWave, tBloom: m.tBloom, duration: m.duration };
  m.tExtend = m.tWave = m.tBloom = ANIM_HOLD; m.duration = animHoldT(); derivedDirty = true;
  try { return fn(); } finally { for (var k in keep) { if (keep[k] === undefined) delete m[k]; else m[k] = keep[k]; } derivedDirty = true; }
}
function animSimplify(P, eps) {
  if (P.length <= 4 || eps <= 0) return P;
  function rdp(pts) {
    if (pts.length < 3) return pts;
    var A = pts[0], B = pts[pts.length - 1], L = Math.hypot(B[0] - A[0], B[1] - A[1]), md = -1, mi = 0;
    for (var i = 1; i < pts.length - 1; i++) { var p = pts[i], d = L > 1e-9 ? Math.abs((p[0] - A[0]) * (B[1] - A[1]) - (p[1] - A[1]) * (B[0] - A[0])) / L : Math.hypot(p[0] - A[0], p[1] - A[1]); if (d > md) { md = d; mi = i; } }
    if (md <= eps) return [A, B];
    var l = rdp(pts.slice(0, mi + 1)), r = rdp(pts.slice(mi)); return l.slice(0, -1).concat(r);
  }
  var far = 0, fd = 0; for (var i = 1; i < P.length; i++) { var d = Math.hypot(P[i][0] - P[0][0], P[i][1] - P[0][1]); if (d > fd) { fd = d; far = i; } }
  var a = rdp(P.slice(0, far + 1)), b = rdp(P.slice(far).concat([P[0]])), out = a.slice(0, -1).concat(b.slice(0, -1));
  return out.length >= 3 ? out : P;
}
/* N points on the outline that include every original vertex, the rest spread by edge length. */
function animResample(P, N) {
  var k = P.length, extra = N - k; if (extra <= 0) return P.slice();
  var len = [], tot = 0; for (var i = 0; i < k; i++) { var B = P[(i + 1) % k]; len.push(Math.hypot(B[0] - P[i][0], B[1] - P[i][1])); tot += len[i]; }
  var alloc = [], used = 0, fr = [];
  for (i = 0; i < k; i++) { var x = tot > 0 ? extra * len[i] / tot : extra / k; alloc.push(Math.floor(x)); used += alloc[i]; fr.push([x - alloc[i], i]); }
  fr.sort(function (u, v) { return v[0] - u[0]; }); for (i = 0; used < extra; i++, used++) alloc[fr[i % k][1]]++;
  var out = [];
  for (i = 0; i < k; i++) { var A = P[i], C = P[(i + 1) % k]; out.push(A); for (var j = 1; j <= alloc[i]; j++) { var s = j / (alloc[i] + 1); out.push([A[0] + (C[0] - A[0]) * s, A[1] + (C[1] - A[1]) * s]); } }
  return out;
}
function animAlign(Q, prev) {
  var N = Q.length, best = 0, bc = Infinity;
  for (var s = 0; s < N; s++) { var c = 0; for (var i = 0; i < N && c < bc; i++) { var a = Q[(i + s) % N], b = prev[i], dx = a[0] - b[0], dy = a[1] - b[1]; c += dx * dx + dy * dy; } if (c < bc) { bc = c; best = s; } }
  return best ? Q.slice(best).concat(Q.slice(0, best)) : Q;
}
/* Corner-tracked correspondence. A line is a thin strip; its end caps are a few px wide.
   Corners (sharp turns) are tracked from key to key by position, each span between two
   corners gets the same point count in every key, so cap corners always morph to cap
   corners and a line end never pinches while it moves. Returns null when the corners
   cannot be tracked consistently; the caller then falls back to plain resampling. */
function animTurns(P) {
  var n = P.length, out = [];
  for (var i = 0; i < n; i++) { var a = P[(i - 1 + n) % n], b = P[i], c = P[(i + 1) % n], d = Math.abs(Math.atan2(c[1] - b[1], c[0] - b[0]) - Math.atan2(b[1] - a[1], b[0] - a[0])); if (d > Math.PI) d = 2 * Math.PI - d; out.push(d); }
  return out;
}
function animCornerMorph(polys, eps) {
  var TH = 0.35, K = 0, cs = polys.map(function (P) { var t = animTurns(P), c = []; t.forEach(function (v, i) { if (v > TH) c.push(i); }); if (c.length > K) K = c.length; return c; });
  if (K < 2) return null;
  var ref = -1; for (var i = 0; i < polys.length; i++) if (cs[i].length === K) { ref = i; break; }
  if (ref < 0) return null;
  var slots = new Array(polys.length), order = [];
  for (i = ref; i < polys.length; i++) order.push(i); for (i = 0; i < ref; i++) order.push(i); order.push(ref);
  var prevPts = null, closeSlots = null;
  for (var oi = 0; oi < order.length; oi++) {
    var fi = order[oi], P = polys[fi], c = cs[fi], n = P.length, pick;
    if (!prevPts) pick = c.slice();
    else if (c.length === K) {
      var best = Infinity; for (var sh = 0; sh < K; sh++) { var cost = 0; for (var j = 0; j < K; j++) { var q = P[c[(j + sh) % K]], r = prevPts[j]; cost += (q[0] - r[0]) * (q[0] - r[0]) + (q[1] - r[1]) * (q[1] - r[1]); } if (cost < best) { best = cost; pick = []; for (j = 0; j < K; j++) pick.push(c[(j + sh) % K]); } }
    } else {
      if (!c.length) return null;
      pick = prevPts.map(function (r) { var bi = c[0], bd = Infinity; c.forEach(function (ci) { var q = P[ci], d = (q[0] - r[0]) * (q[0] - r[0]) + (q[1] - r[1]) * (q[1] - r[1]); if (d < bd) { bd = d; bi = ci; } }); return bi; });
    }
    var tot = 0; for (j = 0; j < K; j++) tot += ((pick[(j + 1) % K] - pick[j]) % n + n) % n;
    if (tot !== n) return null;
    prevPts = pick.map(function (k) { return P[k]; });
    if (oi === order.length - 1) closeSlots = pick; else slots[fi] = pick;
  }
  /* span j runs from slot j to slot j+1. Each span is sampled at even arc length on the
     full-detail outline, so every point sits on the true curve in every key and slides
     smoothly between keys. The count per span covers the most detail it needs in any key. */
  function spans(P, pick) { var n = P.length, out = []; for (var j = 0; j < K; j++) { var a = pick[j], len = ((pick[(j + 1) % K] - a) % n + n) % n, seg = []; for (var k = 0; k <= len; k++) seg.push(P[(a + k) % n]); out.push(seg); } return out; }
  function dpCount(seg) {
    if (seg.length < 3) return seg.length - 1;
    var A = seg[0], B = seg[seg.length - 1], L = Math.hypot(B[0] - A[0], B[1] - A[1]), md = -1, mi = 0;
    for (var i = 1; i < seg.length - 1; i++) { var p = seg[i], d = L > 1e-9 ? Math.abs((p[0] - A[0]) * (B[1] - A[1]) - (p[1] - A[1]) * (B[0] - A[0])) / L : Math.hypot(p[0] - A[0], p[1] - A[1]); if (d > md) { md = d; mi = i; } }
    return md <= eps ? 1 : dpCount(seg.slice(0, mi + 1)) + dpCount(seg.slice(mi));
  }
  var all = polys.map(function (P, fi) { return spans(P, slots[fi]); }), cnt = [];
  for (var j = 0; j < K; j++) { var mx = 0; all.forEach(function (sp) { var seg = sp[j]; mx = Math.max(mx, seg.length < 2 ? 0 : dpCount(seg)); }); cnt[j] = mx ? Math.ceil(mx * 1.5) + 1 : 0; }
  function build(sp) {
    var out = [];
    for (var j = 0; j < K; j++) {
      var seg = sp[j], m = cnt[j]; if (!m) continue;
      var cum = [0]; for (var k = 1; k < seg.length; k++) cum.push(cum[k - 1] + Math.hypot(seg[k][0] - seg[k - 1][0], seg[k][1] - seg[k - 1][1]));
      var L = cum[cum.length - 1], e = 0;
      for (k = 0; k < m; k++) {
        var s = L * k / m; while (e < seg.length - 2 && cum[e + 1] < s) e++;
        if (seg.length === 1 || L <= 0) { out.push(seg[0]); continue; }
        var A = seg[e], B = seg[e + 1], w = cum[e + 1] > cum[e] ? (s - cum[e]) / (cum[e + 1] - cum[e]) : 0;
        out.push([A[0] + (B[0] - A[0]) * w, A[1] + (B[1] - A[1]) * w]);
      }
    }
    return out;
  }
  var Q = all.map(build); return { Q: Q, closing: Q[0] };
}
function animCentroid(P) { var x = 0, y = 0; P.forEach(function (p) { x += p[0]; y += p[1]; }); return [x / P.length, y / P.length]; }
var ANIM_D4 = [[1, 0, 0, 1], [0, -1, 1, 0], [-1, 0, 0, -1], [0, 1, -1, 0], [-1, 0, 0, 1], [1, 0, 0, -1], [0, 1, 1, 0], [0, -1, -1, 0]];
/* Is B, in every frame, L·A + c for one fixed D4 map L and offset c?
   Compared as outlines (every vertex of each lies on the other), so copies
   that were simplified to slightly different vertex lists still match. */
function animBox(P) { var b = [Infinity, Infinity, -Infinity, -Infinity]; P.forEach(function (p) { if (p[0] < b[0]) b[0] = p[0]; if (p[1] < b[1]) b[1] = p[1]; if (p[0] > b[2]) b[2] = p[0]; if (p[1] > b[3]) b[3] = p[1]; }); return b; }
function animOnOutline(pts, poly, tol) {
  var n = poly.length, t2 = tol * tol;
  for (var i = 0; i < pts.length; i++) {
    var p = pts[i], hit = false;
    for (var j = 0; j < n && !hit; j++) {
      var a = poly[j], b = poly[(j + 1) % n], vx = b[0] - a[0], vy = b[1] - a[1], wx = p[0] - a[0], wy = p[1] - a[1], ll = vx * vx + vy * vy, u = ll > 0 ? Math.max(0, Math.min(1, (wx * vx + wy * vy) / ll)) : 0, dx = wx - u * vx, dy = wy - u * vy;
      hit = dx * dx + dy * dy <= t2;
    }
    if (!hit) return false;
  }
  return true;
}
function animSymmetry(A, B) {
  var TOL = 0.08, f0 = -1;
  for (var f = 0; f < A.length; f++) { if (!A[f] !== !B[f]) return null; if (A[f] && f0 < 0) f0 = f; }
  if (f0 < 0) return null;
  var boxes = A.map(function (P) { return P && animBox(P); }), bboxes = B.map(function (P) { return P && animBox(P); });
  for (var m = 0; m < ANIM_D4.length; m++) {
    var L = ANIM_D4[m], map = function (p) { return [L[0] * p[0] + L[1] * p[1] + c[0], L[2] * p[0] + L[3] * p[1] + c[1]]; };
    var ba = boxes[f0], ca = [(ba[0] + ba[2]) / 2, (ba[1] + ba[3]) / 2], bb = bboxes[f0], c = [0, 0], ok = true;
    c = [(bb[0] + bb[2]) / 2 - (L[0] * ca[0] + L[1] * ca[1]), (bb[1] + bb[3]) / 2 - (L[2] * ca[0] + L[3] * ca[1])];
    for (f = f0; f < A.length && ok; f++) {
      if (!A[f]) continue;
      var q = animBox(A[f].map(map)), r = bboxes[f];
      ok = Math.abs(q[0] - r[0]) <= TOL && Math.abs(q[1] - r[1]) <= TOL && Math.abs(q[2] - r[2]) <= TOL && Math.abs(q[3] - r[3]) <= TOL;
    }
    for (f = f0; f < A.length && ok; f++) { if (!A[f]) continue; var Am = A[f].map(map); ok = animOnOutline(B[f], Am, TOL) && animOnOutline(Am, B[f], TOL); }
    if (ok) return 'matrix(' + [L[0], L[2], L[1], L[3], f2(c[0]), f2(c[1])].join(' ') + ')';
  }
  return null;
}
function animNum(v, dp) { var m = Math.pow(10, dp), r = Math.round(v * m) / m; return (r === 0 ? 0 : r).toString(); }
/* Relative after the first point: shorter, and deltas of rounded absolutes never drift. */
function animD(Q, dp) {
  var z = function (v) { return animNum(v, dp).replace(/^(-?)0\./, '$1.'); };
  var m = Math.pow(10, dp), R = Q.map(function (p) { return [Math.round(p[0] * m), Math.round(p[1] * m)]; }), out = 'M' + animNum(R[0][0] / m, dp) + ' ' + animNum(R[0][1] / m, dp) + 'l';
  for (var i = 1; i < R.length; i++) { var dx = z((R[i][0] - R[i - 1][0]) / m), dy = z((R[i][1] - R[i - 1][1]) / m); out += (i > 1 && dx[0] !== '-' ? ' ' : '') + dx + (dy[0] !== '-' ? ' ' : '') + dy; }
  return out + 'z';
}
function animValues(list) { for (var i = 1; i < list.length; i++) if (list[i] !== list[0]) return list; return null; }
function animTag(attr, vals, dur, discrete) { return '<animate attributeName="' + attr + '" dur="' + dur + 's" repeatCount="indefinite"' + (discrete ? ' calcMode="discrete"' : '') + ' values="' + vals.join(';') + '"/>'; }
function animFillParts(fill) { var m = /fill="(#[0-9A-Fa-f]{6})"(?: fill-opacity="([\d.]+)")?/.exec(fill); return m && fill.indexOf('url(') < 0 ? { c: m[1], o: m[2] === undefined ? '1' : m[2] } : null; }
/* Yields to the page without the timer clamping background tabs get. */
function animYield(fn) { var ch = new MessageChannel(); ch.port1.onmessage = function () { ch.port1.close(); fn(); }; ch.port2.postMessage(0); }
/* Renders the frames in small batches so the page stays responsive. */
function buildAnimatedSVG(o, prog, done) {
  var T = o.hold ? animHoldT() : loopT(doc), F = Math.max(8, Math.min(900, Math.round(T * o.kps))), frames = [], f = 0;
  (function batch() {
    var until = performance.now() + 40;
    animWithHold(o.hold, function () { while (f < F && performance.now() < until) { var sink = {}; buildSVG(f * T / F, o.bg, sink); frames.push(sink); f++; } });
    prog(f / F * 0.8);
    if (f < F) { animYield(batch); return; }
    animYield(function () { try { done(assembleAnimatedSVG(frames, T, o)); } catch (e) { console.error(e); done(null, e); } });
  })();
}
function assembleAnimatedSVG(frames, T, o) {
  var F = frames.length, dp = o.eps >= 0.2 ? 1 : 2, dur = animNum(T, 3), fr0 = frames[0], W = fr0.W, Hh = fr0.H;
  /* collect every line across frames, keyed by its stable id */
  var byId = {}, order = [], defs = [], defSeen = {};
  frames.forEach(function (fr, fi) {
    var ren = function (s) { return s.replace(/url\(#(g\d+|hole\d+)\)/g, function (_, id) { return 'url(#f' + fi + '-' + id + ')'; }); };
    fr.paths.forEach(function (p) {
      var e = byId[p.id]; if (!e) { e = byId[p.id] = { id: p.id, mi: p.mi, raw: new Array(F), fill: new Array(F), clip: null }; order.push(e); }
      e.raw[fi] = p.pts; e.fill[fi] = ren(p.fill);
      if (p.clip && !e.clip) e.clip = 'f' + fi + '-' + p.clip;
    });
  });
  order.forEach(function (e) {
    for (var fi = 0; fi < F; fi++) if (e.fill[fi]) { e.fill0 = e.fill[fi]; break; }
    e.fillParts = e.fill.map(function (s) { return s ? animFillParts(s) : null; });
    e.solid = e.fillParts.every(function (x, i) { return x || !e.raw[i]; });
    if (!e.solid) e.fill = null;
  });
  /* keep the defs (gradients, holes) that the chosen fills and clips point at */
  var need = {}; order.forEach(function (e) { var m = /url\(#([^)]+)\)/.exec(e.fill0 || ''); if (m) need[m[1]] = 1; if (e.clip) need[e.clip] = 1; });
  frames.forEach(function (fr, fi) { fr.defs.forEach(function (d) { var m = /id="([^"]+)"/.exec(d), id = m && 'f' + fi + '-' + m[1]; if (id && need[id] && !defSeen[id]) { defSeen[id] = 1; defs.push(d.replace('id="' + m[1] + '"', 'id="' + id + '"')); } }); });
  /* reuse exact rotations and mirrors of solid lines */
  var masters = [];
  order.forEach(function (e) {
    if (e.solid) for (var i = 0; i < masters.length; i++) { var m = masters[i]; if (m.mi !== e.mi || e.clip || m.clip) continue; var tr = animSymmetry(m.raw, e.raw); if (tr) { e.master = m; e.transform = tr; return; } }
    masters.push(e);
  });
  /* one morph per master: simplify, resample to a shared count, align, close the loop */
  var symbols = [], pointsOut = 0, cornerTracked = 0;
  masters.forEach(function (m, n) {
    var simp = m.raw.map(function (P) { return P ? animSimplify(P, o.eps) : null; }), N = 3;
    simp.forEach(function (P) { if (P && P.length > N) N = P.length; });
    var Q = new Array(F), prev = null, closing = null, cm = m.raw.every(Boolean) ? animCornerMorph(m.raw, o.eps) : null;
    if (cm) { Q = cm.Q; closing = cm.closing; N = Q[0].length; }
    else for (var fi = 0; fi < F; fi++) if (simp[fi]) { Q[fi] = animResample(simp[fi], N); if (prev) Q[fi] = animAlign(Q[fi], prev); prev = Q[fi]; }
    for (var fi = 0; fi < F; fi++) if (!Q[fi]) { var near = null, best = Infinity; for (var j = 0; j < F; j++) if (Q[j]) { var dd = Math.min(Math.abs(j - fi), F - Math.abs(j - fi)); if (dd < best) { best = dd; near = j; } } var c = animCentroid(simp[near]); Q[fi] = Q[near].map(function () { return c; }); }
    if (!closing) closing = animAlign(Q[0], Q[F - 1]);
    var vals = Q.map(function (q) { return animD(q, dp); }).concat([animD(closing, dp)]);
    m.sym = 'l' + (n + 1); m.d0 = vals[0]; m.dvals = animValues(vals); pointsOut += N; if (cm) cornerTracked++;
  });
  function fillAttrs(e) {
    if (!e.solid) return ' ' + e.fill0;
    var cs = [], os = [], lastC = null, lastO = null;
    for (var fi = 0; fi < F; fi++) { var p = e.fillParts[fi]; if (p) { lastC = p.c; lastO = p.o; } cs.push(lastC); os.push(lastO); }
    var fb = cs.filter(Boolean)[0], ob = os.filter(Boolean)[0]; cs = cs.map(function (v) { return v || fb; }); os = os.map(function (v) { return v || ob; });
    return ' fill="' + cs[0] + '"' + (os[0] !== '1' ? ' fill-opacity="' + os[0] + '"' : '');
  }
  function fillAnims(e) {
    if (!e.solid) return '';
    var cs = e.fillParts.map(function (p) { return p && p.c; }), os = e.fillParts.map(function (p) { return p && p.o; });
    var fb = cs.filter(Boolean)[0], ob = os.filter(Boolean)[0]; cs = cs.map(function (v) { return v || fb; }); os = os.map(function (v) { return v || ob; });
    var a = animValues(cs.concat([cs[0]])), b = animValues(os.concat([os[0]]));
    return (a ? animTag('fill', a, dur) : '') + (b ? animTag('fill-opacity', b, dur) : '');
  }
  var shared = {}; order.forEach(function (e) { if (e.master) shared[e.master.id] = 1; });
  var symDefs = [], layers = {};
  masters.forEach(function (m) { if (shared[m.id]) symDefs.push('<path id="' + m.sym + '" d="' + m.d0 + '">' + (m.dvals ? animTag('d', m.dvals, dur) : '') + '</path>'); });
  order.forEach(function (e) {
    var L = layers[e.mi] || (layers[e.mi] = []), clip = e.clip ? ' clip-path="url(#' + e.clip + ')"' : '', fa = fillAnims(e), el;
    if (e.master) el = '<use id="' + xmlEsc(e.id) + '" xlink:href="#' + e.master.sym + '" transform="' + e.transform + '"' + fillAttrs(e) + clip + (fa ? '>' + fa + '</use>' : '/>');
    else if (shared[e.id]) el = '<use id="' + xmlEsc(e.id) + '" xlink:href="#' + e.sym + '"' + fillAttrs(e) + clip + (fa ? '>' + fa + '</use>' : '/>');
    else el = '<path id="' + xmlEsc(e.id) + '"' + fillAttrs(e) + clip + ' d="' + e.d0 + '">' + (e.dvals ? animTag('d', e.dvals, dur) : '') + fa + '</path>';
    L.push(el);
  });
  var groups = fr0.marks.map(function (mk) {
    var op = animValues(frames.map(function (fr) { var x = fr.marks.filter(function (y) { return y.mi === mk.mi; })[0]; return animNum(x ? x.opacity : 0, 3); }).concat([animNum(mk.opacity, 3)]));
    return '<g id="' + xmlEsc(mk.name) + '"' + (mk.opacity < 0.999 ? ' opacity="' + animNum(mk.opacity, 3) + '"' : '') + (mk.blend ? ' style="mix-blend-mode:' + mk.blend + '"' : '') + '>\n' + (op ? animTag('opacity', op, dur) + '\n' : '') + (layers[mk.mi] || []).join('\n') + '\n</g>';
  });
  var bgVals = animValues(frames.map(function (fr) { return fr.bgColor || ''; }).concat([fr0.bgColor || '']));
  var bg = o.bg && fr0.bgColor ? '<rect width="' + W + '" height="' + Hh + '" fill="' + fr0.bgColor + '">' + (bgVals && bgVals.every(Boolean) ? animTag('fill', bgVals, dur) : '') + '</rect>' : '';
  var text = '';
  if (fr0.text) {
    text = fr0.text.replace(/\/?>([^<]*)<\/text>$/, '>');
    ['x', 'y', 'font-size', 'letter-spacing', 'fill'].forEach(function (a) {
      var re = new RegExp(' ' + a + '="([^"]*)"'), v = animValues(frames.map(function (fr) { var m = fr.text && re.exec(fr.text); return m ? m[1] : ''; }).concat([(re.exec(fr0.text) || [])[1] || '']));
      if (v && v.every(function (x) { return x !== ''; })) text += animTag(a, v, dur, a === 'fill');
    });
    text += (/>([^<]*)<\/text>$/.exec(fr0.text) || [])[1] + '</text>';
  }
  var svg = '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ' + W + ' ' + Hh + '" width="' + W + '" height="' + Hh + '">\n<title>' + xmlEsc(fr0.title) + '</title>\n' +
    '<desc>Seamless ' + dur + ' s loop sampled at ' + F + ' frames. Radical Studio animated SVG export.</desc>\n' +
    (defs.length || symDefs.length || fr0.style ? '<defs>' + fr0.style + defs.join('') + '\n' + symDefs.join('\n') + '\n</defs>\n' : '') + bg + '\n' + groups.join('\n') + (text ? '\n' + text : '') + '\n</svg>\n';
  return { svg: svg, frames: F, lines: order.length, morphs: masters.length, reused: order.length - masters.length, points: pointsOut, cornerTracked: cornerTracked, gradients: order.some(function (e) { return !e.solid; }) };
}
function fmtBytes(n) { return n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(0) + ' KB' : (n / 1048576).toFixed(2) + ' MB'; }
