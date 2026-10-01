import re, shutil, os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = sys.argv[1]
DIST = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, "dist")
os.makedirs(DIST, exist_ok=True)
s = open(SRC).read()
helmet = re.search(r"<helmet>(.*?)</helmet>", s, re.S).group(1)
body = re.search(r"<x-dc>(.*)</x-dc>", s, re.S).group(1)
body = re.sub(r"<helmet>.*?</helmet>", "", body, flags=re.S)
body = re.sub(r"<!--.*?-->", "", body, flags=re.S)
IMGJ = os.path.join(HERE, "..", "os", "img.json")
IMGMAP = json.load(open(IMGJ)) if os.path.exists(IMGJ) else {}
BLOB2 = {v: "./img/%s.webp" % k for k, v in IMGMAP.items()}
BLOB2["/_blob/2ee0beaef4465f209d65735d3ca35aa5"] = "./denton-300.woff2"
def blob(m): return BLOB2.get(m.group(0), "./logo.svg")
body = re.sub(r"/_blob/[0-9a-f]{32}", blob, body)
helmet = re.sub(r"/_blob/[0-9a-f]{32}", blob, helmet)
logic = re.search(r"data-dc-script[^>]*>(.*)</script>", s, re.S).group(1)
logic = re.sub(r"/_blob/[0-9a-f]{32}", blob, logic)
os.makedirs(os.path.join(DIST, "img"), exist_ok=True)
for k in IMGMAP: shutil.copyfile(os.path.join(HERE, "..", "os", "img", k + ".webp"), os.path.join(DIST, "img", k + ".webp"))
assert "</script" not in logic

page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#050505">
<title>Alpha Compute phone · powered by elizaOS</title>
<meta name="description" content="Interactive prototype of an agentic Android phone, powered by elizaOS.">
<link rel="icon" href="./logo-mark.svg" type="image/svg+xml">
{helmet}
<style>
html,body{{margin:0;height:100%;background:#050505;overflow:clip;overscroll-behavior:none}}
#stage{{position:absolute;left:50%;top:50%;width:960px;height:1020px;transform-origin:center center}}
</style>
</head>
<body>
<div id="stage"></div>
<template id="dc-template">{body}</template>
<script src="./vendor/react.production.min.js"></script>
<script src="./vendor/react-dom.production.min.js"></script>
<script src="./dc-lite.js"></script>
<script>
{logic}
</script>
<script>
(function () {{
  var q = new URLSearchParams(location.search);
  var small = Math.min(innerWidth, innerHeight) < 700;
  var props = {{
    initial: q.get("start") || "boot",
    theme: q.get("theme") || "light",
    phoneOnly: q.has("phone") && q.get("phone") !== "0"
  }};
  var stage = document.getElementById("stage");
  props.ref = function (c) {{ window.__phone = c; }};
  ReactDOM.createRoot(stage).render(React.createElement(Component, props));
  function fit() {{
    var os = stage.querySelector(".os");
    var phoneOnly = os && os.style.justifyContent === "center";
    var w = phoneOnly ? 600 : 960, hgt = phoneOnly ? 960 : 1020;
    var s = Math.min(innerWidth / w, innerHeight / hgt);
    stage.style.transform = "translate(-50%, -50%) scale(" + s + ")";
  }}
  addEventListener("resize", fit);
  new MutationObserver(fit).observe(stage, {{ subtree: true, attributes: true, attributeFilter: ["style"], childList: true }});
  fit();
}})();
</script>
</body>
</html>
"""
open(os.path.join(DIST, "index.html"), "w").write(page)
os.makedirs(os.path.join(DIST, "vendor"), exist_ok=True)
for f in ["react/umd/react.production.min.js", "react-dom/umd/react-dom.production.min.js"]:
    shutil.copy(os.path.join(HERE, "node_modules", f), os.path.join(DIST, "vendor", os.path.basename(f)))
shutil.copy(os.path.join(HERE, "dc-lite.js"), os.path.join(DIST, "dc-lite.js"))
shutil.copyfile(os.path.join(HERE, "..", "os", "fonts", "denton-300.woff2"), os.path.join(DIST, "denton-300.woff2"))
for f in ["logo.svg", "logo-mark.svg"]:
    src = os.path.join(HERE, "dist", f)
    if os.path.realpath(DIST) != os.path.realpath(os.path.join(HERE, "dist")) and os.path.exists(src): shutil.copy(src, os.path.join(DIST, f))
print("built", len(page))
