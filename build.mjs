// ساخت یک فایل واحد www/index.html (همه‌چیز داخلش: CSS، فونت، JS)
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { build } from "esbuild";

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, "src");
const www = join(root, "www");

mkdirSync(www, { recursive: true });

console.log("1) Bundling JS...");
const js = await build({
  entryPoints: [join(src, "js", "main.js")],
  bundle: true,
  minify: true,
  format: "iife",
  target: ["es2020"],
  write: false,
  define: { "process.env.NODE_ENV": '"production"' },
});
const jsCode = js.outputFiles[0].text;

console.log("2) Reading CSS + HTML...");
let html = readFileSync(join(src, "index.html"), "utf8");
let css = readFileSync(join(src, "styles.css"), "utf8");

console.log("3) Inlining Vazirmatn font...");
const fontDir = join(root, "node_modules", "vazirmatn", "fonts", "webfonts");
let fontCss = "";
if (existsSync(fontDir)) {
  const files = readdirSync(fontDir);
  const woff2 = files.find((f) => f === "Vazirmatn-Regular.woff2") || files.find((f) => f.endsWith(".woff2"));
  const woff = files.find((f) => f === "Vazirmatn-Regular.woff") || files.find((f) => f.endsWith(".woff"));
  if (woff2) {
    const b64 = readFileSync(join(fontDir, woff2)).toString("base64");
    fontCss = `@font-face{font-family:"Vazirmatn";src:url(data:font/woff2;base64,${b64}) format("woff2");font-weight:100 900;font-display:swap;}`;
    console.log("   font inlined:", woff2);
  } else if (woff) {
    const b64 = readFileSync(join(fontDir, woff)).toString("base64");
    fontCss = `@font-face{font-family:"Vazirmatn";src:url(data:font/woff;base64,${b64}) format("woff");font-weight:100 900;font-display:swap;}`;
    console.log("   font inlined (woff):", woff);
  } else {
    console.warn("   font not found in vazirmatn package!");
  }
} else {
  console.warn("   vazirmatn not installed — install with npm i first");
}
css = fontCss + "\n" + css;

// نکته: باید از تابع جایگزین استفاده کنیم چون کاراکترهای $ در کد مینیفای‌شده
// باعث انبساط ناخواسته‌ی $& و $' می‌شوند
html = html.replace('<style id="app-css"></style>', () => `<style id="app-css">${css}</style>`);
html = html.replace('<script id="app-js"></script>', () => `<script>${jsCode}<\/script>`);

writeFileSync(join(www, "index.html"), html);
console.log(`4) Done → www/index.html (${(html.length / 1024).toFixed(0)} KB)`);
