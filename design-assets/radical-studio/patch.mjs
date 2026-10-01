#!/usr/bin/env node
// Adds an "Animated SVG" export tab to Radical Studio.
// Usage: node patch.mjs <radical.html in> <radical.html out>
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const [, , input, output] = process.argv;
if (!input || !output) { console.error('usage: node patch.mjs <in.html> <out.html>'); process.exit(2); }
let html = readFileSync(input, 'utf8');
const addon = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'animated-svg.js'), 'utf8');

function swap(from, to) {
  const n = html.split(from).length - 1;
  if (n !== 1) throw new Error(`expected exactly one match, found ${n}: ${from.slice(0, 80)}`);
  html = html.replace(from, () => to);
}
if (html.includes('buildAnimatedSVG')) throw new Error('already patched');

// 1. buildSVG reports structured frame data to an optional sink.
swap('function buildSVG(t, withBg) {', 'function buildSVG(t, withBg, sink) {');
swap("var W = Dx.W, Hh = Dx.H, defs = [], layers = [],",
  "if (sink) { sink.paths = []; sink.marks = []; }\n    var W = Dx.W, Hh = Dx.H, defs = [], layers = [],");
swap("          paths++;\n          if (mr.mask) {",
  "          paths++;\n          if (sink) sink.paths.push({ id: id, mi: mi, pts: A, fill: fill, clip: mr.mask ? 'hole' + (masked + 1) : null });\n          if (mr.mask) {");
swap("      layers.push('<g' + attrs + '>\\n' + groups.join('\\n') + '\\n</g>');",
  "      if (sink) sink.marks.push({ mi: mi, name: slug(mk.name) + (mi ? '-' + mi : ''), opacity: mk.opacity, blend: SVG_BLEND[mk.blend] || '' });\n      layers.push('<g' + attrs + '>\\n' + groups.join('\\n') + '\\n</g>');");
swap("    var bg = withBg && !d.canvas.transparent ?",
  "    if (sink) { sink.W = W; sink.H = Hh; sink.defs = defs; sink.style = style; sink.title = d.name || 'Mark'; sink.bgColor = withBg && !d.canvas.transparent ? ST.toHex(ST.parseHex(d.canvas.bg)) : ''; sink.text = L ? layers[layers.length - 1] : ''; }\n    var bg = withBg && !d.canvas.transparent ?");

// 2. The exporter itself, next to the other exporters.
swap('function openExport(tab) {', addon + 'function openExport(tab) {');

// 3. The Export dialog tab.
swap("    preset: function (b) {", `    animated: function (b) {
      if (!timelineOn()) { b.appendChild(h('div', { class: 'hint', text: 'Motion is off. Turn it on in the Motion section, or set keys, to export a loop.' })); return; }
      b.appendChild(segH('Loop', [[false, 'Full cycle'], [true, 'Undulate only']], function () { return animSvgOpts.hold; }, function (v) { animSvgOpts.hold = v; }));
      var T = animSvgOpts.hold ? animHoldT() : loopT(doc);
      b.appendChild(segH('Smoothness', [[6, '6 keys/s'], [12, '12 keys/s'], [24, '24 keys/s']], function () { return animSvgOpts.kps; }, function (v) { animSvgOpts.kps = v; }));
      b.appendChild(segH('Detail', [[0.5, 'Light'], [0.25, 'Balanced'], [0.1, 'Fine']], function () { return animSvgOpts.eps; }, function (v) { animSvgOpts.eps = v; }));
      b.appendChild(segH('Background', [[true, 'Include'], [false, 'None']], function () { return animSvgOpts.bg; }, function (v) { animSvgOpts.bg = v; }));
      b.appendChild(h('div', { class: 'hint', text: (animSvgOpts.hold ? 'Lines held fully extended, one wave cycle. ' : '') + 'One seamless ' + T.toFixed(2) + ' s loop (' + Math.max(8, Math.round(T * animSvgOpts.kps)) + ' keys) as a single SVG with SMIL path morphs. It plays on its own in browsers, <img> tags and Android WebView, with no script. Every key is the exact frame; the browser interpolates between keys. Mirrored and rotated copies reuse one animation, so the file stays small.' }));
      var bar = h('div', { class: 'prog', style: { display: 'none' } }, [h('i')]); b.appendChild(bar);
      var info = h('div', { class: 'hint' }), pv = h('div', { style: { display: 'none', marginTop: '10px', textAlign: 'center' } }); b.appendChild(pv); b.appendChild(info);
      var last = null, url = null;
      var dl = h('button', { class: 'btn primary', text: 'Download SVG', onclick: function () { if (last) download(new Blob([last.svg], { type: 'image/svg+xml' }), slug(doc.name) + '_loop_' + last.W + 'x' + last.H + '.svg'); } });
      var cp = h('button', { class: 'btn', html: ICON.copy + '<span>Copy SVG</span>', onclick: function () { if (!last) return; (navigator.clipboard ? navigator.clipboard.writeText(last.svg) : Promise.reject()).then(function () { toast('Animated SVG copied'); }).catch(function () { toast('Copy is blocked here; use Download'); }); } });
      dl.disabled = cp.disabled = true;
      var go = h('button', { class: 'btn', text: 'Build animated SVG', onclick: function () {
        go.disabled = dl.disabled = cp.disabled = true; go.textContent = 'Building…'; bar.style.display = 'block'; info.textContent = '';
        buildAnimatedSVG(animSvgOpts, function (p) { bar.firstChild.style.width = Math.round(p * 100) + '%'; }, function (r, err) {
          go.disabled = false; go.textContent = 'Rebuild'; bar.style.display = 'none';
          if (!r) { toast('Could not build the animated SVG'); info.textContent = String(err && err.message || err); return; }
          r.W = D.W; r.H = D.H; last = r; dl.disabled = cp.disabled = false;
          if (url) URL.revokeObjectURL(url); url = URL.createObjectURL(new Blob([r.svg], { type: 'image/svg+xml' }));
          pv.innerHTML = ''; pv.style.display = 'block';
          pv.appendChild(h('img', { src: url, alt: 'Animated preview', style: { maxWidth: '100%', maxHeight: '260px', borderRadius: '6px', border: '1px solid var(--line-2)', background: 'repeating-conic-gradient(#8883 0 25%, transparent 0 50%) 0 0 / 16px 16px' } }));
          info.textContent = fmtBytes(new Blob([r.svg]).size) + ' · ' + r.frames + ' keys · ' + r.lines + ' lines (' + r.morphs + ' morphs, ' + r.reused + ' reused by symmetry)' + (r.gradients ? ' · gradients stay at their first-frame position' : '');
          toast('Animated SVG ready · ' + fmtBytes(new Blob([r.svg]).size));
        });
      } });
      b.appendChild(h('div', { class: 'mfoot', style: { padding: '14px 0 0', border: 0 } }, [go, cp, dl]));
    },
    preset: function (b) {`);
swap("['video', 'Video'], ['preset', 'Preset']]", "['video', 'Video'], ['animated', 'Animated SVG'], ['preset', 'Preset']]");
swap("toggleStopwatch: toggleStopwatch,", "buildAnimatedSVG: buildAnimatedSVG, assembleAnimatedSVG: assembleAnimatedSVG, toggleStopwatch: toggleStopwatch,");

writeFileSync(output, html);
console.log(`patched ${input} -> ${output}`);
