/* تکسچر برداری ۴K برای آیتم، باس، دروازه و پروفایل — بدون فایل بیت‌مپ سنگین */
import { mulberry32, seedOf } from "./util.js";

export const TEX_PX = 4096;

function hsl(h, s, l, a) {
  return a == null ? `hsl(${h % 360},${s}%,${l}%)` : `hsla(${h % 360},${s}%,${l}%,${a})`;
}

export function texUrl(kind, i, extra) {
  const rng = mulberry32(seedOf("tex4k", kind, i, extra || 0));
  const h1 = Math.floor(rng() * 360);
  const h2 = (h1 + 28 + Math.floor(rng() * 70)) % 360;
  const h3 = (h1 + 190) % 360;
  const parts = [];
  parts.push(`<radialGradient id="a" cx="${20 + rng() * 40}%" cy="${18 + rng() * 30}%"><stop offset="0%" stop-color="${hsl(h1, 82, 72)}"/><stop offset="55%" stop-color="${hsl(h2, 70, 32)}"/><stop offset="100%" stop-color="${hsl(h3, 62, 10)}"/></radialGradient>`);
  parts.push(`<linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${hsl(h2, 50, 80, 0.18)}"/><stop offset="100%" stop-color="${hsl(h1, 40, 8, 0.35)}"/></linearGradient>`);
  const shapes = [];
  const n = kind === "boss" ? 22 : 14;
  for (let k = 0; k < n; k++) {
    const x = Math.floor(rng() * 4096), y = Math.floor(rng() * 4096);
    const r = 70 + Math.floor(rng() * (kind === "boss" ? 1100 : 720));
    shapes.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${hsl(h1 + k * 13, 68, 48, (0.1 + rng() * 0.32).toFixed(3))}"/>`);
  }
  for (let k = 0; k < 7; k++) {
    const y = Math.floor(rng() * 4096);
    shapes.push(`<rect x="0" y="${y}" width="4096" height="${6 + Math.floor(rng() * 28)}" fill="${hsl(h2, 40, 88, 0.08)}"/>`);
  }
  if (kind === "weapon" || kind === "item") {
    shapes.push(`<polygon points="2048,220 2480,1680 2048,1480 1616,1680" fill="${hsl(h1, 20, 92, 0.55)}"/>`);
    shapes.push(`<rect x="1988" y="1480" width="120" height="2100" rx="40" fill="${hsl(h3, 30, 70, 0.45)}"/>`);
  }
  if (kind === "armor") {
    shapes.push(`<path d="M900 900 L2048 520 L3196 900 L3000 3000 L1096 3000 Z" fill="${hsl(h2, 40, 40, 0.35)}" stroke="${hsl(h1, 70, 80, 0.5)}" stroke-width="36"/>`);
  }
  if (kind === "boss" || kind === "dungeon") {
    shapes.push(`<ellipse cx="2048" cy="1680" rx="980" ry="720" fill="${hsl(h3, 70, 12, 0.45)}"/>`);
    shapes.push(`<circle cx="1700" cy="1500" r="140" fill="${hsl(h1, 90, 62, 0.85)}"/>`);
    shapes.push(`<circle cx="2390" cy="1500" r="140" fill="${hsl(h1, 90, 62, 0.85)}"/>`);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4096 4096" width="4096" height="4096"><defs>${parts.join("")}</defs><rect width="4096" height="4096" fill="url(#a)"/>${shapes.join("")}<rect width="4096" height="4096" fill="url(#b)"/><rect x="48" y="48" width="4000" height="4000" fill="none" stroke="${hsl(h2, 80, 72, 0.4)}" stroke-width="40"/></svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

export function makeItemStory(rng, cat, name, tier, desc) {
  const opens = [
    `در بایگانی انجمن شکارچیان، «${name}» با مهر خون ثبت شده است.`,
    `افسانه می‌گوید «${name}» از قلب یک دروازهٔ شکسته بیرون آمده.`,
    `اولین کسی که «${name}» را لمس کرد، دیگر سایه نداشت.`,
    `سیستم این وسیله را از غنیمت جنگ سایه‌ها جدا کرده: «${name}».`,
  ];
  const mids = [
    `قدرت واقعی‌اش فقط وقتی بیدار می‌شود که صاحبش گرایند کرده باشد.`,
    `روی فلز، خط‌هایی به زبان مردگان کنده شده که هنوز خوانده نشده.`,
    `هر بار استفاده، بوی گوگرد و باران شب به هوا می‌زند.`,
    `شکارچی‌های رده‌پایین حتی جرأت نگاه کردن به آن را ندارند.`,
  ];
  const ends = [
    `اثر: ${desc}. رتبهٔ ساخت: ${tier + 1}.`,
    `اگر در نبرد بشکند، روحش به کاتالوگ سیستم برمی‌گردد.`,
    `مالک فعلی باید ثابت کند لایق این غنیمت است.`,
  ];
  const catLine = {
    weapon: "این یک سلاح جنگی است؛ آسیب واقعی به دشمن می‌زند.",
    armor: "این زره جلوی ضربه را می‌گیرد و جان را نگه می‌دارد.",
    potion: "معجون را در نبرد یا بیرون از نبرد بنوش تا اثرش کار کند.",
    scroll: "طومار یک‌بار مصرف است و فوراً روی حسابت اعمال می‌شود.",
    stone: "سنگ سایه شانس برخاستن روح دشمن را بالا می‌برد.",
    title: "عنوان روی قدرت کل شکارچی اثر می‌گذارد.",
    special: "آیتم ویژهٔ سیستم؛ فقط یک‌بار یا با اثر خاص.",
  };
  return `${opens[Math.floor(rng() * opens.length)]} ${mids[Math.floor(rng() * mids.length)]} ${catLine[cat] || ""} ${ends[Math.floor(rng() * ends.length)]}`;
}

export function portraitUrl(i) {
  const rng = mulberry32(seedOf("avatar", i));
  const h = Math.floor(rng() * 360);
  const skin = hsl(28 + Math.floor(rng() * 20), 45, 62 + Math.floor(rng() * 18));
  const hair = hsl(h, 55, 22 + Math.floor(rng() * 30));
  const cloak = hsl((h + 200) % 360, 70, 28);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><radialGradient id="bg" cx="40%" cy="30%"><stop offset="0%" stop-color="${hsl(h, 70, 40)}"/><stop offset="100%" stop-color="#0a0d18"/></radialGradient></defs><rect width="512" height="512" fill="url(#bg)"/><circle cx="256" cy="430" r="180" fill="${cloak}"/><circle cx="256" cy="210" r="92" fill="${skin}"/><ellipse cx="256" cy="150" rx="110" ry="70" fill="${hair}"/><rect x="210" y="228" width="28" height="10" rx="4" fill="#1a1220"/><rect x="274" y="228" width="28" height="10" rx="4" fill="#1a1220"/><path d="M232 268 Q256 286 280 268" stroke="#6a3040" stroke-width="6" fill="none"/><text x="256" y="470" text-anchor="middle" font-size="42" fill="#e8ecf8" font-family="sans-serif" font-weight="700">${i + 1}</text></svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

export const PRESET_AVATARS = Array.from({ length: 12 }, (_, i) => portraitUrl(i));

export function readAvatarFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error("no file"));
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = 256; c.height = 256;
        const g = c.getContext("2d");
        if (!g || typeof g.drawImage !== "function") {
          URL.revokeObjectURL(url);
          const r = new FileReader();
          r.onload = () => resolve(String(r.result || ""));
          r.onerror = () => reject(new Error("read"));
          r.readAsDataURL(file);
          return;
        }
        const s = Math.max(256 / img.width, 256 / img.height);
        const w = img.width * s, h = img.height * s;
        g.drawImage(img, (256 - w) / 2, (256 - h) / 2, w, h);
        const out = c.toDataURL("image/jpeg", 0.84);
        URL.revokeObjectURL(url);
        resolve(out);
      } catch (e) { URL.revokeObjectURL(url); reject(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("img")); };
    img.src = url;
  });
}

export function avatarMarkup(src, letter) {
  if (src) return `<img class="avatar-img" alt="" src="${src}">`;
  return `<span id="avatar-letter">${letter || "?"}</span>`;
}
