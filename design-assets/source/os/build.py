#!/usr/bin/env python3
"""Assemble Main.dc.html from shell.html + shell.js + modules/<key>.{html,js}, then build the standalone site.

usage: python3 build.py                 -> out/Main.dc.html and ../site/dist
       python3 build.py --out DIR       -> DIR/Main.dc.html and DIR/site (use this when testing in parallel)
"""
import json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ORDER = ["phone", "messages", "inbox", "calendar", "browser", "camera", "photos", "maps",
         "notes", "contacts", "files", "wallet", "workflows", "settings"]

def read(p):
    with open(os.path.join(HERE, p)) as f:
        return f.read()

OUT = os.path.join(HERE, "out")
SITE_DIST = os.path.join(HERE, "..", "site", "dist")
if "--out" in sys.argv:
    OUT = os.path.abspath(sys.argv[sys.argv.index("--out") + 1]); SITE_DIST = os.path.join(OUT, "site")
shell = read("shell.html")
js = read("shell.js")
IMGMAP = json.load(open(os.path.join(HERE, "img.json"))) if os.path.exists(os.path.join(HERE, "img.json")) else {}
js = js.replace("/*IMG*/{}/*IMG*/", json.dumps(IMGMAP, separators=(",", ":")))
present = [k for k in ORDER if os.path.exists(os.path.join(HERE, "modules", k + ".js"))]

markup = []
mods = []
for k in present:
    html_path = os.path.join("modules", k + ".html")
    body = read(html_path) if os.path.exists(os.path.join(HERE, html_path)) else ""
    markup.append('<!-- APP: %s -->\n<sc-if value="{{is.%s}}" hint-placeholder-val="{{false}}">\n%s\n</sc-if>' % (k, k, body.strip()))
    mods.append("/* ===== module: %s ===== */\n%s" % (k, read(os.path.join("modules", k + ".js")).strip()))

seen = {}
dups = []
for k in present:
    src = read(os.path.join("modules", k + ".js"))
    for name in re.findall(r"^(?:var|function|let|const)\s+([A-Za-z_$][\w$]*)", src, re.M):
        if name in seen and seen[name] != k: dups.append("%s (%s, %s)" % (name, seen[name], k))
        seen[name] = k
if dups:
    sys.exit("duplicate globals across modules: " + ", ".join(dups))
js = js.replace("/*@MODULES@*/", "\n\n".join(mods))
assert "</script" not in js.lower(), "a module contains </script"

# collect jump presets by evaluating the module registry in node
head = js.split("var BASE = {")[0]
probe = head + "\nconsole.log(JSON.stringify(ORDER.map(function(k){return [k,(VIEWS[k].jumps||[[null,VIEWS[k].title]]).map(function(j){return j[0]?k+':'+j[0]:k;})];})));"
res = subprocess.run(["node"], input=probe, capture_output=True, text=True)
if res.returncode != 0:
    sys.stderr.write(res.stderr)
    sys.exit("module registry failed to evaluate")
opts = ["boot", "lock", "home", "shade", "sheet", "full", "voice", "heads"]
for k, js_ in json.loads(res.stdout.strip().splitlines()[-1]):
    opts += js_

props = {
    "initial": {"editor": "enum", "default": "boot", "options": opts, "section": "Prototype"},
    "phoneOnly": {"editor": "boolean", "default": False, "section": "Prototype"},
    "theme": {"editor": "enum", "default": "light", "options": ["light", "dark"], "section": "Look"},
    "accent": {"editor": "color", "default": "#0000FF", "options": ["#0000FF", "#2563EB", "#0C0C61"], "section": "Look"},
    "$preview": {"width": 960, "height": 1020},
}
props_attr = json.dumps(props, ensure_ascii=False).replace("&", "&amp;").replace("'", "&#39;")
script = "<script type=\"text/x-dc\" data-dc-script data-props='%s'>\n%s\n</script>\n</body>\n</html>\n" % (props_attr, js)

out = shell.replace("<!--@VIEWS@-->", "\n\n".join(markup)).replace("<!--@SCRIPT@-->", script)
os.makedirs(OUT, exist_ok=True)
with open(os.path.join(OUT, "Main.dc.html"), "w") as f:
    f.write(out)

# tag balance check on the template
tpl = re.search(r"<x-dc>(.*)</x-dc>", out, re.S).group(1)
tpl = re.sub(r"<!--.*?-->", "", tpl, flags=re.S)
bad = []
for t in ["sc-if", "sc-for", "div", "button", "span", "svg", "p", "h1", "h2", "label", "select", "textarea"]:
    o = len(re.findall(r"<" + t + r"[\s>]", tpl)); c = len(re.findall(r"</" + t + ">", tpl))
    if o != c: bad.append("%s %d/%d" % (t, o, c))
if bad:
    sys.exit("tag imbalance: " + ", ".join(bad))

site = os.path.join(HERE, "..", "site")
r = subprocess.run(["python3", os.path.join(site, "build.py"), os.path.join(OUT, "Main.dc.html"), SITE_DIST], capture_output=True, text=True)
if r.returncode != 0:
    sys.stderr.write(r.stderr); sys.exit("site build failed")
with open(os.path.join(SITE_DIST, "presets.json"), "w") as f:
    json.dump(opts, f)
print("built modules:", ",".join(present), "| presets:", len(opts), "| bytes:", len(out))
