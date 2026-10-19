/**
 * AUDITORÍA (sin dependencias): SEO, accesibilidad, CSP, enlaces rotos
 * y el paquete estático real de dist/.
 *
 *   npm run audit
 *
 * Revisa las páginas de la raíz, el panel privado y el contenido generado
 * para Cloudflare Pages. Las Functions se validan en su ubicación de origen:
 * Cloudflare puede procesarlas fuera del paquete estático.
 */
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
/* ids que NO están en el HTML estático porque los crea JavaScript (Header/Footer) */
const JS_IDS = new Set(["contacto", "primary-nav"]);

const isFile = async (p) => {
  try { return (await stat(p)).isFile(); } catch { return false; }
};
const isDirectory = async (p) => {
  try { return (await stat(p)).isDirectory(); } catch { return false; }
};
const rel = (...parts) => path.posix.normalize(path.posix.join(...parts));
const BRAND_ICONS = [
  { src: "img/icon-192.png", sizes: "192x192" },
  { src: "img/icon-512.png", sizes: "512x512" }
];

const errors = [], warnings = [];
const err = (f, m) => errors.push(`${f}: ${m}`);
const warn = (f, m) => warnings.push(`${f}: ${m}`);
const grab = (html, re) => (html.match(re)?.[1] ?? "").trim();
const idsOf = (html) => new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));

const files = (await readdir(ROOT)).filter((f) => f.endsWith(".html")).sort();
if (await isFile(path.join(ROOT, "admin/index.html"))) files.push("admin/index.html");

function localTarget(page, href) {
  const [urlPath, hash = ""] = href.split("#", 2);
  const pathname = urlPath.split("?")[0];
  if (!pathname) return { relative: page, hash };

  const rootRelative = pathname.startsWith("/");
  let target = rootRelative ? pathname.replace(/^\/+/, "") : rel(path.posix.dirname(page), pathname);
  if (!target || pathname.endsWith("/")) target = rel(target, "index.html");
  target = path.posix.normalize(target);
  if (target === ".." || target.startsWith("../")) return { unsafe: true, hash };
  return { relative: target, hash };
}

async function auditSitemap(baseDir, robotsTxt, label) {
  const sitemapFile = path.join(baseDir, "sitemap.xml");
  const prefix = label === "dist" ? "dist/" : "";
  const hasSite = /^Sitemap:/m.test(robotsTxt);
  if (!(await isFile(sitemapFile))) {
    if (hasSite) err(`${prefix}sitemap.xml`, "robots.txt lo menciona pero no existe");
    return;
  }

  const sm = await readFile(sitemapFile, "utf8");
  const locs = [];
  for (const match of sm.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    try { locs.push(new URL(match[1]).pathname); }
    catch { err(`${prefix}sitemap.xml`, `URL inválida → ${match[1]}`); }
  }
  const sitemapUrl = robotsTxt.match(/^Sitemap:\s*(\S+)/m)?.[1];
  let sitePrefix = "";
  if (sitemapUrl) {
    try { sitePrefix = new URL(sitemapUrl).pathname.replace(/\/sitemap\.xml$/, "").replace(/\/+$/, ""); }
    catch { err(`${prefix}robots.txt`, `URL de sitemap inválida → ${sitemapUrl}`); }
  }

  for (const urlPath of locs) {
    if (sitePrefix && !urlPath.startsWith(`${sitePrefix}/`)) {
      err(`${prefix}sitemap.xml`, `URL fuera de la ruta base del sitio → ${urlPath}`);
      continue;
    }
    const localPath = sitePrefix ? urlPath.slice(sitePrefix.length) || "/" : urlPath;
    const trimmedPath = localPath.replace(/^\/+|\/+$/g, "");
    const file = localPath === "/" || localPath.endsWith("/")
      ? `${trimmedPath ? `${trimmedPath}/` : ""}index.html`
      : localPath.replace(/^\//, "");
    if (!(await isFile(path.join(baseDir, file)))) err(`${prefix}sitemap.xml`, `URL sin archivo → ${urlPath}`);
  }
  if (locs.includes("/404") || locs.some((p) => p.startsWith("/admin"))) {
    err(`${prefix}sitemap.xml`, "no debe incluir la 404 ni el panel");
  }
}

async function auditManifest(baseDir, label) {
  const prefix = label === "dist" ? "dist/" : "";
  const manifestPath = path.join(baseDir, "site.webmanifest");
  if (!(await isFile(manifestPath))) {
    err(`${prefix}site.webmanifest`, "falta el manifiesto de iconos");
    return;
  }

  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch {
    err(`${prefix}site.webmanifest`, "JSON inválido");
    return;
  }

  for (const required of BRAND_ICONS) {
    const icon = manifest.icons?.find((item) => item.src === required.src && item.sizes === required.sizes && item.type === "image/png");
    if (!icon) {
      err(`${prefix}site.webmanifest`, `falta el icono ${required.sizes} → ${required.src}`);
      continue;
    }
    if (!(await isFile(path.join(baseDir, required.src)))) {
      err(`${prefix}site.webmanifest`, `icono inexistente → ${required.src}`);
    }
  }
}

async function auditPages(baseDir, pageNames, label) {
  const prefix = label === "dist" ? "dist/" : "";
  const pages = {};
  for (const f of pageNames) {
    const file = path.join(baseDir, f);
    if (!(await isFile(file))) {
      if (label === "dist") err("dist", `falta la página requerida → ${f}`);
      continue;
    }
    pages[f] = await readFile(file, "utf8");
  }

  const robotsFile = path.join(baseDir, "robots.txt");
  const robotsTxt = await isFile(robotsFile) ? await readFile(robotsFile, "utf8") : "";
  const hasSite = /^Sitemap:/m.test(robotsTxt);

  for (const [f, html] of Object.entries(pages)) {
    const reportFile = `${prefix}${f}`;
    const noindex = /<meta name="robots" content="[^"]*noindex/.test(html);

    // --- SEO ---
    const title = grab(html, /<title>([\s\S]*?)<\/title>/);
    const desc = grab(html, /<meta name="description" content="([^"]*)"/);
    if (!title) err(reportFile, "falta <title>");
    else if (title.length > 65) warn(reportFile, `<title> largo (${title.length} caracteres, ideal ≤ 60)`);
    if (!desc) err(reportFile, "falta meta description");
    else if (desc.length < 70 && !noindex) warn(reportFile, `meta description de ${desc.length} caracteres (ideal 70–160)`);
    else if (desc.length > 160) warn(reportFile, `meta description de ${desc.length} caracteres (ideal 70–160)`);
    if (!/<html lang="es"/.test(html)) err(reportFile, 'falta lang="es"');
    const h1s = (html.replace(/<noscript>[\s\S]*?<\/noscript>/g, "").match(/<h1[\s>]/g) ?? []).length;
    if (h1s !== 1) err(reportFile, `debe tener exactamente 1 <h1> (tiene ${h1s})`);
    if (f.startsWith("admin/") && !noindex) err(reportFile, 'el panel privado debe llevar <meta name="robots" content="noindex">');

    // Solo las páginas públicas e indexables necesitan canonical / Open Graph / preload
    if (!noindex) {
      if (hasSite && !/rel="canonical"/.test(html)) err(reportFile, "falta canonical (corre npm run build)");
      if (!/property="og:title"/.test(html)) err(reportFile, "faltan etiquetas Open Graph (corre npm run build)");
      if (!/rel="modulepreload"/.test(html)) warn(reportFile, "sin modulepreload (corre npm run build)");
    }

    // --- JSON-LD válido ---
    for (const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
      try { JSON.parse(m[1]); } catch { err(reportFile, "JSON-LD inválido"); }
    }

    // --- Imágenes ---
    for (const m of html.matchAll(/<img\b[^>]*>/g)) {
      const tag = m[0];
      if (!/\balt="/.test(tag)) err(reportFile, `imagen sin alt: ${tag.slice(0, 60)}`);
      if (!/\bwidth="/.test(tag) || !/\bheight="/.test(tag)) warn(reportFile, `imagen sin width/height: ${tag.slice(0, 60)}`);
    }

    // --- Compatibilidad con la CSP (sin código en línea) ---
    if (/\sstyle="/.test(html)) err(reportFile, 'atributo style="" en línea (la CSP lo bloquea)');
    if (/<style[\s>]/.test(html)) err(reportFile, "<style> en línea (la CSP lo bloquea)");
    if ([...html.matchAll(/<script\b([^>]*)>/g)].some(([, a]) => !/\bsrc=/.test(a) && !/application\/ld\+json/.test(a))) err(reportFile, "<script> en línea (la CSP lo bloquea)");
    if (/\son[a-z]+="/.test(html)) err(reportFile, "manejador de eventos en línea (onclick=...) no permitido por la CSP");

    // --- Enlaces externos seguros ---
    for (const m of html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)) if (!/rel="[^"]*noopener/.test(m[0])) err(reportFile, "target=_blank sin rel=noopener");

    // --- Enlaces internos rotos (relativos a la carpeta de cada página) ---
    const own = idsOf(html);
    for (const m of html.matchAll(/<a\b[^>]*\shref="([^"]+)"/g)) {
      const href = m[1];
      if (/^(https?:|mailto:|tel:|javascript:|data:|blob:)/i.test(href) || href.startsWith("//")) continue;
      const target = localTarget(f, href);
      if (target.unsafe) { err(reportFile, `enlace fuera del paquete → ${href}`); continue; }
      const targetFile = path.join(baseDir, ...target.relative.split("/"));
      if (!(await isFile(targetFile))) { err(reportFile, `enlace roto → ${href}`); continue; }
      if (target.hash) {
        const ids = pages[target.relative]
          ? idsOf(pages[target.relative])
          : target.relative.endsWith(".html")
            ? idsOf(await readFile(targetFile, "utf8"))
            : new Set();
        if (target.relative === f ? !own.has(target.hash) && !JS_IDS.has(target.hash) : !ids.has(target.hash) && !JS_IDS.has(target.hash)) {
          err(reportFile, `ancla inexistente → ${href}`);
        }
      }
    }

    // Recursos locales: las rutas externas y las Functions no son parte de dist/.
    for (const m of html.matchAll(/\b(?:src|href)="((?!https?:|mailto:|tel:|#|\/\/)[^"]+\.(?:css|js|webp|png|jpg|jpeg|svg|ico|avif|gif|woff2?|ttf|otf|json|webmanifest))"/gi)) {
      const resource = m[1];
      if (/^(?:data:|blob:|javascript:)/i.test(resource)) continue;
      const target = localTarget(f, resource);
      if (target.unsafe || !(await isFile(path.join(baseDir, ...target.relative.split("/"))))) {
        err(reportFile, `recurso inexistente → ${resource}`);
      }
    }
  }

  await auditManifest(baseDir, label);
  if (!/^User-agent:/m.test(robotsTxt)) err(`${prefix}robots.txt`, "falta o es inválido");
  await auditSitemap(baseDir, robotsTxt, label);
  return { pages, robotsTxt };
}

const source = await auditPages(ROOT, files, "source");
console.log(`Páginas auditadas: ${Object.keys(source.pages).length} (${Object.keys(source.pages).join(", ")})`);

if (!(await isDirectory(DIST))) {
  err("dist", "no existe el paquete; ejecuta npm run package o npm run audit para generarlo");
} else {
  for (const required of ["_headers", "robots.txt"]) {
    if (!(await isFile(path.join(DIST, required)))) err("dist", `falta archivo requerido → ${required}`);
  }
  const dist = await auditPages(DIST, files, "dist");
  console.log(`Páginas auditadas en dist/: ${Object.keys(dist.pages).length}`);

  const envFile = path.join(DIST, "src/config/env.js");
  if (await isFile(envFile)) {
    const envSource = await readFile(envFile, "utf8");
    if (/CONTACT_ENDPOINT\s*:\s*["']\/api\/contact["']/.test(envSource)) {
      if (!(await isFile(path.join(ROOT, "functions/api/contact.js")))) {
        err("functions/api/contact.js", "src/config/env.js referencia /api/contact pero no existe el handler");
      } else {
        warn("dist", "/api/contact requiere la Cloudflare Pages Function en functions/api/contact.js; el handler no forma parte del paquete estático y su inclusión en el despliegue debe verificarse.");
      }
    }
  } else {
    err("dist", "falta src/config/env.js para comprobar las rutas de la aplicación");
  }
}

/* ---------- reporte ---------- */
warnings.forEach((w) => console.log("⚠ ", w));
errors.forEach((e) => console.log("✖ ", e));
console.log(`\n${errors.length ? "✖" : "✔"} ${errors.length} errores · ${warnings.length} avisos`);
process.exit(errors.length ? 1 : 0);
