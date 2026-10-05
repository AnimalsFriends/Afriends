/**
 * AUDITORÍA (sin dependencias): SEO básico, accesibilidad, compatibilidad con la CSP
 * y ENLACES ROTOS internos. Termina con código 1 si hay errores (útil para CI).
 *
 *   node scripts/audit.mjs
 *
 * Revisa las páginas de la raíz y el panel privado (admin/index.html).
 */
import { readFile, readdir, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
/* ids que NO están en el HTML estático porque los crea JavaScript (Header/Footer) */
const JS_IDS = new Set(["contacto", "primary-nav"]);

const exists = (p) => access(p).then(() => true, () => false);
const rel = (...parts) => path.posix.normalize(path.posix.join(...parts));

const files = (await readdir(ROOT)).filter((f) => f.endsWith(".html")).sort();
if (await exists(path.join(ROOT, "admin/index.html"))) files.push("admin/index.html");

const errors = [], warnings = [];
const err = (f, m) => errors.push(`${f}: ${m}`);
const warn = (f, m) => warnings.push(`${f}: ${m}`);
const grab = (html, re) => (html.match(re)?.[1] ?? "").trim();
const idsOf = (html) => new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));

const pages = {};
for (const f of files) pages[f] = await readFile(path.join(ROOT, f), "utf8");
const robotsTxt = (await exists(path.join(ROOT, "robots.txt"))) ? await readFile(path.join(ROOT, "robots.txt"), "utf8") : "";
const hasSite = /^Sitemap:/m.test(robotsTxt);

for (const [f, html] of Object.entries(pages)) {
  const dir = path.posix.dirname(f);
  const noindex = /<meta name="robots" content="[^"]*noindex/.test(html);

  // --- SEO ---
  const title = grab(html, /<title>([\s\S]*?)<\/title>/);
  const desc = grab(html, /<meta name="description" content="([^"]*)"/);
  if (!title) err(f, "falta <title>");
  else if (title.length > 65) warn(f, `<title> largo (${title.length} caracteres, ideal ≤ 60)`);
  if (!desc) err(f, "falta meta description");
  else if (desc.length < 70 && !noindex) warn(f, `meta description de ${desc.length} caracteres (ideal 70–160)`);
  else if (desc.length > 160) warn(f, `meta description de ${desc.length} caracteres (ideal 70–160)`);
  if (!/<html lang="es"/.test(html)) err(f, 'falta lang="es"');
  const h1s = (html.replace(/<noscript>[\s\S]*?<\/noscript>/g, "").match(/<h1[\s>]/g) ?? []).length;
  if (h1s !== 1) err(f, `debe tener exactamente 1 <h1> (tiene ${h1s})`);
  if (f.startsWith("admin/") && !noindex) err(f, "el panel privado debe llevar <meta name=\"robots\" content=\"noindex\">");

  // Solo las páginas públicas e indexables necesitan canonical / Open Graph / preload
  if (!noindex) {
    if (hasSite && !/rel="canonical"/.test(html)) err(f, "falta canonical (corre node scripts/build.mjs)");
    if (!/property="og:title"/.test(html)) err(f, "faltan etiquetas Open Graph (corre node scripts/build.mjs)");
    if (!/rel="modulepreload"/.test(html)) warn(f, "sin modulepreload (corre node scripts/build.mjs)");
  }

  // --- JSON-LD válido ---
  for (const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(m[1]); } catch { err(f, "JSON-LD inválido"); }
  }

  // --- Imágenes ---
  for (const m of html.matchAll(/<img\b[^>]*>/g)) {
    const tag = m[0];
    if (!/\balt="/.test(tag)) err(f, `imagen sin alt: ${tag.slice(0, 60)}`);
    if (!/\bwidth="/.test(tag) || !/\bheight="/.test(tag)) warn(f, `imagen sin width/height: ${tag.slice(0, 60)}`);
  }

  // --- Compatibilidad con la CSP (sin código en línea) ---
  if (/\sstyle="/.test(html)) err(f, 'atributo style="" en línea (la CSP lo bloquea)');
  if (/<style[\s>]/.test(html)) err(f, "<style> en línea (la CSP lo bloquea)");
  if ([...html.matchAll(/<script\b([^>]*)>/g)].some(([, a]) => !/\bsrc=/.test(a) && !/application\/ld\+json/.test(a))) err(f, "<script> en línea (la CSP lo bloquea)");
  if (/\son[a-z]+="/.test(html)) err(f, "manejador de eventos en línea (onclick=...) no permitido por la CSP");

  // --- Enlaces externos seguros ---
  for (const m of html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)) if (!/rel="[^"]*noopener/.test(m[0])) err(f, "target=_blank sin rel=noopener");

  // --- Enlaces internos rotos (relativos a la carpeta de cada página) ---
  const own = idsOf(html);
  for (const m of html.matchAll(/<a\b[^>]*\shref="([^"]+)"/g)) {
    const href = m[1];
    if (/^(https?:|mailto:|tel:|javascript:)/i.test(href)) continue;
    const [target, hash] = href.split("#");
    const targetFile = target ? rel(dir, target) : f;
    if (!(await exists(path.join(ROOT, targetFile)))) { err(f, `enlace roto → ${href}`); continue; }
    if (hash) {
      const ids = targetFile === f ? own : idsOf(pages[targetFile] ?? (await readFile(path.join(ROOT, targetFile), "utf8")));
      if (!ids.has(hash) && !JS_IDS.has(hash)) err(f, `ancla inexistente → ${href}`);
    }
  }
  // Recursos locales (css, js, imágenes)
  for (const m of html.matchAll(/\b(?:src|href)="((?!https?:|mailto:|tel:|#|\/\/)[^"]+\.(?:css|js|webp|png|jpg|svg|ico))"/g)) {
    if (!(await exists(path.join(ROOT, rel(dir, m[1]))))) err(f, `recurso inexistente → ${m[1]}`);
  }
}

// --- sitemap ↔ archivos ---
if (await exists(path.join(ROOT, "sitemap.xml"))) {
  const sm = await readFile(path.join(ROOT, "sitemap.xml"), "utf8");
  const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  for (const p of locs) {
    const file = p === "/" ? "index.html" : `${p.replace(/^\//, "")}.html`;
    if (!(await exists(path.join(ROOT, file)))) err("sitemap.xml", `URL sin archivo → ${p}`);
  }
  if (locs.includes("/404") || locs.some((p) => p.startsWith("/admin"))) err("sitemap.xml", "no debe incluir la 404 ni el panel");
} else if (hasSite) err("sitemap.xml", "robots.txt lo menciona pero no existe");

// --- robots ---
if (!/^User-agent:/m.test(robotsTxt)) err("robots.txt", "falta o es inválido");

/* ---------- reporte ---------- */
console.log(`Páginas auditadas: ${files.length} (${files.join(", ")})\n`);
warnings.forEach((w) => console.log("⚠ ", w));
errors.forEach((e) => console.log("✖ ", e));
console.log(`\n${errors.length ? "✖" : "✔"} ${errors.length} errores · ${warnings.length} avisos`);
process.exit(errors.length ? 1 : 0);
