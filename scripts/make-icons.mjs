// تولید آیکون‌های اندروید از assets/icon-src.png
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "assets", "icon-src.png");
const resBase = join(root, "android", "app", "src", "main", "res");

const launchers = [
  ["mdpi", 48], ["hdpi", 72], ["xhdpi", 96], ["xxhdpi", 144], ["xxxhdpi", 192],
];
const fgSizes = [["mdpi", 108], ["hdpi", 162], ["xhdpi", 216], ["xxhdpi", 324], ["xxxhdpi", 432]];

const base = sharp(src).resize(1024, 1024, { fit: "cover", position: "centre" });

for (const [dpi, size] of launchers) {
  const dir = join(resBase, `mipmap-${dpi}`);
  mkdirSync(dir, { recursive: true });
  await base.clone().resize(size, size).png().toFile(join(dir, "ic_launcher.png"));
  await base.clone().resize(size, size).png().toFile(join(dir, "ic_launcher_round.png"));
}
for (const [dpi, size] of fgSizes) {
  const dir = join(resBase, `mipmap-${dpi}`);
  mkdirSync(dir, { recursive: true });
  await base.clone().resize(size, size).png().toFile(join(dir, "ic_launcher_foreground.png"));
}
// آیکون کوچک اعلان: شمشیر سفید
const swordSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <path fill="#ffffff" d="M48 8 L57 40 L84 46 L57 52 L48 88 L39 52 L12 46 L39 40 Z"/>
</svg>`;
for (const [dpi] of launchers) {
  const dir = join(resBase, `drawable-${dpi}`);
  mkdirSync(dir, { recursive: true });
  await sharp(Buffer.from(swordSvg)).png().toFile(join(dir, "ic_stat_solo.png"));
}
console.log("icons done");
