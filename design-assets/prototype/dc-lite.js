/* Minimal renderer for the prototype's .dc.html template: {{holes}}, sc-if, sc-for, events, refs. */
(function () {
  var h = React.createElement;
  var EVENTS = { onclick: "onClick", onpointerdown: "onPointerDown", onpointerup: "onPointerUp", onpointerleave: "onPointerLeave", onpointercancel: "onPointerCancel", onchange: "onChange", onkeydown: "onKeyDown", oninput: "onInput" };
  var HOLE = /\{\{\s*([^}]+?)\s*\}\}/g;
  var WHOLE = /^\{\{\s*([^}]+?)\s*\}\}$/;

  function lookup(path, scope) {
    if (path === "true") return true;
    if (path === "false") return false;
    if (/^-?\d+(\.\d+)?$/.test(path)) return +path;
    var parts = path.split("."); var cur = scope;
    for (var i = 0; i < parts.length; i++) { if (cur == null) return undefined; cur = cur[parts[i]]; }
    return cur;
  }
  function interp(str, scope) { return str.replace(HOLE, function (_, p) { var v = lookup(p, scope); return v == null ? "" : String(v); }); }
  function camel(k) { if (k.indexOf("--") === 0) return k; return k.replace(/^-(webkit|moz|ms)-/, function (_, v) { return v.charAt(0).toUpperCase() + v.slice(1) + "-"; }).replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); }); }
  function parseStyle(s) {
    var o = {};
    s.split(";").forEach(function (decl) {
      var i = decl.indexOf(":"); if (i < 0) return;
      var k = decl.slice(0, i).trim(); var v = decl.slice(i + 1).trim();
      if (k && v) o[camel(k)] = v;
    });
    return o;
  }
  function props(el, scope, key) {
    var p = { key: key };
    for (var i = 0; i < el.attributes.length; i++) {
      var a = el.attributes[i]; var n = a.name; var raw = a.value;
      if (n.indexOf("hint-") === 0) continue;
      var m = raw.match(WHOLE);
      var val = m ? lookup(m[1], scope) : (raw.indexOf("{{") >= 0 ? interp(raw, scope) : raw);
      if (n === "class") n = "className";
      else if (n === "for") n = "htmlFor";
      else if (EVENTS[n]) n = EVENTS[n];
      else if (n === "viewbox") n = "viewBox";
      if (n === "style") { p.style = typeof val === "string" ? parseStyle(val) : val; continue; }
      if (n === "value" && el.tagName.toLowerCase() === "input") { p.value = val == null ? "" : val; continue; }
      p[n] = val;
    }
    return p;
  }
  function kids(nodes, scope) {
    var out = [];
    for (var i = 0; i < nodes.length; i++) {
      var r = node(nodes[i], scope, i);
      if (r == null) continue;
      if (Array.isArray(r)) out.push(h(React.Fragment, { key: "f" + i }, r)); else out.push(r);
    }
    return out;
  }
  function node(n, scope, key) {
    if (n.nodeType === 3) {
      var t = n.nodeValue;
      if (!t.trim() && /\n/.test(t)) return null;
      return t.indexOf("{{") >= 0 ? interp(t, scope) : t;
    }
    if (n.nodeType !== 1) return null;
    var tag = n.tagName.toLowerCase();
    if (tag === "sc-if") {
      var m = (n.getAttribute("value") || "").match(WHOLE);
      var ok = m ? lookup(m[1], scope) : false;
      return ok ? h(React.Fragment, { key: key }, kids(n.childNodes, scope)) : null;
    }
    if (tag === "sc-for") {
      var lm = (n.getAttribute("list") || "").match(WHOLE);
      var list = (lm ? lookup(lm[1], scope) : []) || [];
      var as = n.getAttribute("as") || "item";
      return h(React.Fragment, { key: key }, list.map(function (item, i) {
        var s = Object.create(scope); s[as] = item; s.$index = i;
        return h(React.Fragment, { key: i }, kids(n.childNodes, s));
      }));
    }
    var isSvg = n.namespaceURI === "http://www.w3.org/2000/svg";
    var tname = isSvg ? n.localName : tag;
    var c = kids(n.childNodes, scope);
    return h.apply(null, [tname, props(n, scope, key)].concat(c));
  }

  var tpl = document.getElementById("dc-template").content;
  window.DCLogic = class extends React.Component {
    constructor(p) { super(p); this.state = {}; }
    render() { var vals = this.renderVals(); var out = kids(tpl.childNodes, vals); return h(React.Fragment, null, out); }
  };
})();
