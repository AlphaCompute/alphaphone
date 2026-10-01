// Smoke + flow test harness.
// usage: NODE_PATH=$(npm root -g) node test.js <siteDir> <port> <shotsDir> [preset ...] [--flow flowFile.js]
//  - opens ?start=<preset>&phone=1 for every preset (default: every preset in the build), screenshots the phone,
//    and reports page errors. With --flow, runs module.exports = async (page, h) => {...} after loading.
//  h.go(preset), h.shot(name), h.tap(ariaLabel), h.tapText(text), h.type(placeholder, text), h.enter(), h.wait(ms),
//  h.swipe(fromX, fromY, toX, toY) in phone coordinates (412x915), h.back(), h.home()
const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), path = require("path");
const args = process.argv.slice(2);
const flowIdx = args.indexOf("--flow");
const flowFile = flowIdx >= 0 ? path.resolve(args[flowIdx + 1]) : null;
const pos = flowIdx >= 0 ? args.slice(0, flowIdx).concat(args.slice(flowIdx + 2)) : args;
const [siteDir, portStr, shotsDir, ...presets] = pos;
const port = +portStr;
fs.mkdirSync(shotsDir, { recursive: true });
const types = { ".html": "text/html", ".js": "text/javascript", ".svg": "image/svg+xml" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]); if (p === "/") p = "/index.html";
  const f = path.join(siteDir, p);
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
}).listen(port);

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 700, height: 1000 } });
  const errs = [];
  page.on("pageerror", e => errs.push("PAGEERROR " + e.message));
  page.on("console", m => { if (m.type() === "error" && !/fonts\.g/.test(m.text())) errs.push("CONSOLE " + m.text()); });
  let list = presets;
  if (!list.length) list = JSON.parse(fs.readFileSync(path.join(siteDir, "presets.json"), "utf8")).filter(p => p !== "boot");
  // phone screen geometry in page coordinates
  async function geo() { return await page.evaluate(() => { const r = document.querySelector("[data-screen]").getBoundingClientRect(); return { x: r.left, y: r.top, s: r.width / 412 }; }); }
  const h = {
    async go(preset, theme) { await page.goto(`http://localhost:${port}/?start=${encodeURIComponent(preset)}&phone=1&theme=${theme || "light"}`); await page.waitForTimeout(700); },
    async shot(name) { const g = await geo(); await page.screenshot({ path: path.join(shotsDir, name + ".png"), clip: { x: g.x - 4, y: g.y - 4, width: 412 * g.s + 8, height: 915 * g.s + 8 } }); },
    async tap(label) { await page.click(`[aria-label="${label}"] >> visible=true`); await page.waitForTimeout(350); },
    async tapText(text) { await page.click(`text=${text} >> visible=true`); await page.waitForTimeout(350); },
    async type(ph, text) { await page.fill(`[placeholder="${ph}"] >> visible=true`, text); },
    async enter() { await page.keyboard.press("Enter"); await page.waitForTimeout(1600); },
    async wait(ms) { await page.waitForTimeout(ms); },
    async swipe(x1, y1, x2, y2) { const g = await geo(); await page.mouse.move(g.x + x1 * g.s, g.y + y1 * g.s); await page.mouse.down(); await page.mouse.move(g.x + x2 * g.s, g.y + y2 * g.s, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(500); },
    async back() { await h.swipe(4, 450, 200, 450); },
    async home() { await h.tap("Home"); },
    async visible(label) { return await page.isVisible(`[aria-label="${label}"]`); },
    page, errs
  };
  for (const p of list) {
    const before = errs.length;
    await h.go(p); await h.shot(p.replace(/[:/]/g, "_"));
    console.log((errs.length > before ? "FAIL " : "ok   ") + p + (errs.length > before ? "  " + errs.slice(before).join(" | ") : ""));
  }
  if (flowFile) {
    const before = errs.length;
    try { await require(flowFile)(page, h); console.log("flow done"); } catch (e) { console.log("FLOW ERROR " + e.message); }
    if (errs.length > before) console.log("flow errors: " + errs.slice(before).join(" | "));
  }
  await b.close(); server.close();
})();
