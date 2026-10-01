// Records the walkthrough: phone on the left, captions on the right, 1920x1080, CDP screencast frames.
const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), path = require("path");
const SITE = process.argv[2], OUT = "/tmp/vid/frames";
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const scenes = JSON.parse(fs.readFileSync("/tmp/vid/scenes.json", "utf8"));
const dur = {}; for (const s of scenes) dur[s.id] = parseFloat(require("child_process").execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 /tmp/vid/audio/${s.id}.wav`).toString());
const types = { ".html": "text/html", ".js": "text/javascript", ".svg": "image/svg+xml", ".json": "application/json", ".webp": "image/webp", ".woff2": "font/woff2" };
const server = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split("?")[0]); if (u === "/") u = "/index.html"; const f = path.join(SITE, u); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); }).listen(8977);
const logo = fs.readFileSync(path.join(SITE, "logo.svg"), "utf8");

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errs = []; page.on("pageerror", e => errs.push(e.message));
  await page.goto("http://localhost:8977/?start=boot&phone=1&theme=light");
  await page.waitForFunction(() => !!window.__phone);
  await page.evaluate(({ logo }) => {
    window.__phone.headsDone = true; // heads-up is shown explicitly in its scene
    const css = document.createElement("style");
    css.textContent = `
      [aria-label="Show controls"]{display:none!important}
      #stage{left:0!important;top:0!important;transform:translate(150px,30px) scale(1.035)!important;transform-origin:center center!important}
      #cap{position:fixed;left:1030px;top:0;bottom:0;width:780px;display:flex;flex-direction:column;justify-content:center;color:#fff;font-family:'Public Sans',system-ui,sans-serif}
      #cap .logo{position:fixed;left:1030px;top:70px;width:230px}
      #cap .logo svg{width:100%;height:auto;display:block}
      #cap .by{position:fixed;left:1030px;top:140px;font-size:17px;color:#8f8f8f}
      #cap .n{font-family:'Public Sans',system-ui,sans-serif;font-variant-numeric:tabular-nums;font-size:15px;letter-spacing:.2em;color:#8A93FF;margin-bottom:22px}
      #cap .t{font-family:'Denton',Georgia,serif;font-weight:300;font-size:84px;line-height:1.02;letter-spacing:-.02em}
      #cap .b{font-size:30px;line-height:1.4;color:#bdbdbd;margin-top:26px;max-width:720px;white-space:pre-line}
      #cap .in{animation:capIn .7s cubic-bezier(.19,1,.22,1) both}
      @keyframes capIn{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
      .tapdot{position:fixed;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:23px;background:rgba(0,0,255,.28);box-shadow:0 0 0 2px rgba(255,255,255,.9);pointer-events:none;z-index:99999;animation:tap .6s ease-out forwards}
      @keyframes tap{from{transform:scale(.5);opacity:1}to{transform:scale(1.4);opacity:0}}`;
    document.head.appendChild(css);
    const cap = document.createElement("div"); cap.id = "cap";
    cap.innerHTML = `<div class="logo">${logo}</div><div class="by">Powered by elizaOS</div><div class="box"></div>`;
    document.body.appendChild(cap);
    addEventListener("pointerdown", e => { const d = document.createElement("div"); d.className = "tapdot"; d.style.left = e.clientX + "px"; d.style.top = e.clientY + "px"; document.body.appendChild(d); setTimeout(() => d.remove(), 700); }, true);
    window.__cap = (n, total, t, bd) => {
      const box = document.querySelector("#cap .box");
      box.innerHTML = `<div class="in"><div class="n">${String(n).padStart(2, "0")} / ${String(total).padStart(2, "0")}</div><div class="t">${t}</div><div class="b">${bd}</div></div>`;
    };
  }, { logo });
  await page.waitForTimeout(300);

  // phone coordinates → page coordinates
  const geo = async () => page.evaluate(() => { const r = document.querySelector("[data-screen]").getBoundingClientRect(); return { x: r.left, y: r.top, s: r.width / 412 }; });
  const P = (fn, arg) => page.evaluate(fn, arg);
  const wait = ms => page.waitForTimeout(ms);
  const tap = async (label, opts = {}) => { try { await page.click(`[aria-label="${label}"] >> visible=true`, { timeout: 2500, ...opts }); } catch (e) { console.log("  miss tap", label); } await wait(250); };
  const tapText = async (text) => { try { await page.click(`[data-screen] >> text=${text} >> visible=true`, { timeout: 2500 }); } catch (e) { console.log("  miss text", text); } await wait(250); };
  const swipe = async (x1, y1, x2, y2, steps = 14) => { const g = await geo(); await page.mouse.move(g.x + x1 * g.s, g.y + y1 * g.s); await page.mouse.down(); await page.mouse.move(g.x + x2 * g.s, g.y + y2 * g.s, { steps }); await page.mouse.up(); await wait(400); };
  const typeIn = async (ph, text) => { try { const l = page.locator(`[placeholder="${ph}"] >> visible=true`).first(); await l.click({ timeout: 2500 }); await l.pressSequentially(text, { delay: 38 }); } catch (e) { console.log("  miss type", ph); } };
  const say = async (text) => { await P(() => window.__phone.setState({ chat: "input" })); await wait(350); await typeIn("Ask Alpha", text); await page.keyboard.press("Enter"); };
  const home = async () => { await tap("Home"); await wait(400); };

  const acts = {
    boot: async () => { await P(() => { window.__phone.preset("boot"); window.__phone.headsDone = true; }); await wait(3800); },
    lock: async () => { await wait(2600); await tap("Unlock with fingerprint"); },
    home: async () => { await wait(2200); await wait(2500); },
    heads: async () => { await P(() => window.__phone.showHeads()); await wait(1800); await tap("Reply with Alpha"); await wait(1500); try { await page.click(`[data-screen] [aria-label="Send"] >> visible=true`, { timeout: 2500 }); } catch (e) { console.log("  miss send"); } await wait(1200); await tap("Minimize chat"); },
    ask: async () => { await say("What needs me?"); await wait(2300); try { await page.waitForSelector(`[data-screen] button:has-text("Revised term sheet attached.")`, { timeout: 4000 }); await page.click(`[data-screen] button:has-text("Revised term sheet attached.") >> visible=true`, { timeout: 2500 }); } catch (e) { console.log("  miss jordan"); } },
    mail: async () => { try { await page.waitForSelector(`[data-screen] [aria-label^="Open"][aria-label$=".pdf"] >> visible=true`, { timeout: 5000 }); await wait(900); await page.click(`[data-screen] [aria-label^="Open"][aria-label$=".pdf"] >> visible=true`, { timeout: 2500 }); } catch (e) { console.log("  miss attach"); } await wait(2400); await swipe(4, 450, 230, 450); },
    voice: async () => { await home(); await P(() => window.__phone.startVoice()); },
    calendar: async () => { await wait(1600); await P(() => { window.__phone.setState({ voice: "off", chat: "input" }); window.__phone.openView("calendar", { open: "c4" }); }); await wait(1400); await tap("Ask Alpha to prep me"); },
    shade: async () => { await P(() => window.__phone.goHome()); await wait(500); await swipe(206, 20, 206, 520); await wait(1200); await tap("Do not disturb"); await wait(900); await tap("Do not disturb"); await wait(500); await swipe(206, 700, 206, 150); },
    phone: async () => { await P(() => window.__phone.openView("phone", { call: "maya" })); await wait(2600); await home(); await wait(1500); try { await page.click(`[aria-label^="Return to"] >> visible=true`, { timeout: 2500 }); } catch (e) { console.log("  miss chip"); } await wait(1300); await tap("End call"); },
    camera: async () => { await P(() => window.__phone.openView("camera")); await wait(1500); await tap("Take photo"); await wait(1200); await tap("Scan mode"); await wait(2200); await P(() => window.__phone.openView("photos")); },
    maps: async () => { await P(() => window.__phone.preset("maps:route")); await wait(1800); await tapText("Start"); },
    wallet: async () => { await P(() => window.__phone.preset("wallet:pay")); await wait(1100); await tap("Confirm with fingerprint"); },
    browser: async () => { await P(() => window.__phone.openView("browser")); await wait(800); await typeIn("Ask about this page", "Book a table for 2 at 7:30"); await page.keyboard.press("Enter"); try { await page.waitForSelector(`[aria-label="Confirm booking"] >> visible=true`, { timeout: 12000 }); await wait(700); } catch (e) { console.log("  no confirm"); } await tap("Confirm booking"); },
    notes: async () => { await P(() => window.__phone.preset("notes:rec")); await wait(4200); await tap("Stop and save"); },
    flows: async () => { await P(() => window.__phone.openView("workflows")); await wait(900); await say("Every weekday at 6, wrap up my day"); await wait(2600); try { await page.click(`[data-screen] button >> text=Turn on >> visible=true`, { timeout: 2500 }); } catch (e) { console.log("  miss turn on"); } await wait(700); await P(() => window.__phone.preset("workflows:run")); },
    settings: async () => { await P(() => window.__phone.preset("settings")); await wait(2600); await P(() => window.__phone.preset("settings:adding")); },
    outro: async () => { await P(() => { window.__phone.goHome(); }); await wait(1300); await P(() => window.__phone.setState({ theme: "dark" })); }
  };

  // screencast
  const cdp = await page.context().newCDPSession(page);
  let n = 0; const stamps = [];
  cdp.on("Page.screencastFrame", async (f) => {
    const name = `${OUT}/f${String(n).padStart(6, "0")}.jpg`; fs.writeFileSync(name, Buffer.from(f.data, "base64"));
    stamps.push([name, f.metadata.timestamp]); n++;
    try { await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }); } catch (e) {}
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
  const t0 = Date.now() / 1000; const starts = [];
  await wait(400);
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i]; const st = Date.now() / 1000;
    starts.push({ id: s.id, t: st - t0 });
    await P(({ i, total, t, bd }) => window.__cap(i, total, t, bd), { i: i + 1, total: scenes.length, t: s.title, bd: s.body });
    console.log(`scene ${s.id} @ ${(st - t0).toFixed(2)}s (audio ${dur[s.id].toFixed(2)}s)`);
    await acts[s.id]();
    const target = dur[s.id] + (s.id === "outro" ? 2.0 : 0.9);
    const left = target - (Date.now() / 1000 - st);
    if (left > 0) await wait(left * 1000);
  }
  await wait(600);
  await cdp.send("Page.stopScreencast");
  const tEnd = Date.now() / 1000 - t0;
  fs.writeFileSync("/tmp/vid/timeline.json", JSON.stringify({ t0, starts, stamps, tEnd }));
  console.log("frames", n, "errors", JSON.stringify(errs.slice(0, 5)));
  await b.close(); server.close();
})();
