/* گرفتن اسکرین‌شات از همهٔ تب‌ها — در GitHub Actions */
import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const www = join(root, "www");
const out = join(root, "screenshots");
mkdirSync(out, { recursive: true });

const server = createServer((req, res) => {
  let url = decodeURIComponent((req.url || "/").split("?")[0]);
  if (url === "/") url = "/index.html";
  const f = join(www, url);
  if (!existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": url.endsWith(".html") ? "text/html; charset=utf-8" : "application/octet-stream" });
  res.end(readFileSync(f));
}).listen(8080, "0.0.0.0");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (page, name) => { await page.screenshot({ path: join(out, name), fullPage: false }); console.log("📸 " + name); };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });
page.on("pageerror", (e) => console.log("pageerror:", e.message));

await page.goto("http://localhost:8080/", { waitUntil: "networkidle" });
await sleep(1500);

// ورود
await shot(page, "01-login.png");
await page.click('[data-authtab="register"]');
await sleep(400);
await shot(page, "02-register.png");
await page.click('[data-authtab="login"]');

// آفلاین برای نمایش کامل
await page.click("#auth-offline");
await sleep(1200);
await shot(page, "03-home.png");

// تمرین و سطح
for (let i = 0; i < 200; i++) await page.click("#btn-train", { delay: 8 });
await sleep(600);
await shot(page, "04-home-levelup.png");

// پنجره سیستم
await page.evaluate(() => window.__slsSysTest && window.__slsSysTest());
await sleep(400);
await shot(page, "05-system-window.png");
await page.click("#sys-close");

// تب‌ها
const tabs = [["missions", "06-missions"], ["gates", "07-gates"], ["battle", "08-bosses"], ["shop", "09-shop"], ["bag", "10-bag"], ["duel", "11-duel"], ["chat", "12-chat"], ["ranks", "13-ranks"]];
for (const [tab, name] of tabs) {
  await page.click(`.nav-btn[data-page="${tab}"]`);
  await sleep(900);
  await shot(page, name + ".png");
}

// نبرد باس (صفحهٔ مبارزه)
await page.click('.nav-btn[data-page="battle"]');
await sleep(600);
// اولین باس که قابل مبارزه باشد (سطح ۱)
await page.click('#boss-list .boss-card .gate-go');
await sleep(1400);
await shot(page, "14-boss-fight.png");
await page.click("#btn-flee");
await sleep(700);

// شوتر دوبعدی (حالت نمایشی برای اسکرین‌شات)
await page.evaluate(() => window.__slsShooterDemo && window.__slsShooterDemo());
await sleep(1500);
await shot(page, "15-shooter-duel.png");
await page.click("#btn-exit-duel");
await sleep(700);

// کیف — بخش مهارت‌ها
await page.click('.nav-btn[data-page="bag"]');
await sleep(600);
await shot(page, "16-bag-skills.png");

await browser.close();
server.close();
console.log("done → screenshots/");
