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
import { ENV } from "../src/config/env.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const CONFIGURED_SITE_URL = (ENV.SITE_URL || "").trim().replace(/\/+$/, "");
const SITE_URL = (process.env.SITE_URL || CONFIGURED_SITE_URL).trim().replace(/\/+$/, "");
/* ids que NO están en el HTML estático porque los crea JavaScript (Header/Footer) */
const JS_IDS = new Set(["contacto", "primary-nav"]);

const isFile = async (p) => {
  try { return (await stat(p)).isFile(); } catch { return false; }
};
const isDirectory = async (p) => {
  try { return (await stat(p)).isDirectory(); } catch { return false; }
};
const rel = (...parts) => path.posix.normalize(path.posix.join(...parts));
const GOOGLE_SITE_VERIFICATION = "QwgC8mxuI7mi7kvHCMZFgxPDEuOYS2lY8Qc7eSUgscY";
const BRAND_ICONS = [
  { src: "img/icon-192.png", sizes: "192x192" },
  { src: "img/icon-512.png", sizes: "512x512" }
];

const errors = [], warnings = [];
const err = (f, m) => errors.push(`${f}: ${m}`);
const warn = (f, m) => warnings.push(`${f}: ${m}`);
const grab = (html, re) => (html.match(re)?.[1] ?? "").trim();
const idsOf = (html) => new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));

async function hasNoindexHeader(baseDir, pagePath) {
  const headerFile = path.join(baseDir, "_headers");
  if (!(await isFile(headerFile))) return false;
  const lines = (await readFile(headerFile, "utf8")).split(/\r?\n/);
  let routePattern = "";
  let noindex = false;
  for (const line of lines) {
    if (!line.trim() || /^\s*#/.test(line)) continue;
    if (!/^\s/.test(line)) {
      routePattern = line.trim();
      continue;
    }
    const match = line.match(/^\s*X-Robots-Tag:\s*(.+)$/i);
    if (!match || !/\bnoindex\b/i.test(match[1])) continue;
    const regex = new RegExp(`^${routePattern.split("*").map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*")}$`);
    if (regex.test(pagePath)) noindex = true;
  }
  return noindex;
}

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

async function auditSitemap(baseDir, robotsTxt, pages, label) {
  const sitemapFile = path.join(baseDir, "sitemap.xml");
  const prefix = label === "dist" ? "dist/" : "";
  const hasSite = /^Sitemap:/m.test(robotsTxt);
  if (!(await isFile(sitemapFile))) {
    if (hasSite) err(`${prefix}sitemap.xml`, "robots.txt lo menciona pero no existe");
    return;
  }

  const sm = await readFile(sitemapFile, "utf8");
  if (SITE_URL !== CONFIGURED_SITE_URL) {
    err(`${prefix}robots.txt`, `SITE_URL del entorno debe coincidir con el dominio canónico ${CONFIGURED_SITE_URL}`);
  }
  const sitemapUrl = robotsTxt.match(/^Sitemap:\s*(\S+)\s*$/m)?.[1];
  const expectedSitemapUrl = SITE_URL ? `${SITE_URL}/sitemap.xml` : "";
  if (!sitemapUrl) err(`${prefix}robots.txt`, "falta la directiva Sitemap");
  else if (sitemapUrl !== expectedSitemapUrl) err(`${prefix}robots.txt`, `Sitemap debe ser ${expectedSitemapUrl} (recibido: ${sitemapUrl})`);
  if ((robotsTxt.match(/^Sitemap:/gm) ?? []).length !== 1) err(`${prefix}robots.txt`, "debe contener exactamente una directiva Sitemap");

  if (!sm.startsWith('<?xml version="1.0" encoding="UTF-8"?>') ||
      !/<urlset\s+xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">[\s\S]*<\/urlset>\s*$/.test(sm)) {
    err(`${prefix}sitemap.xml`, "declaración XML, namespace o raíz urlset inválidos");
  }
  const urls = [...sm.matchAll(/<url>\s*<loc>([^<]+)<\/loc>\s*<\/url>/g)].map((m) => m[1]);
  if (!urls.length || (sm.match(/<url>/g) ?? []).length !== urls.length ||
      (sm.match(/<loc>/g) ?? []).length !== urls.length) {
    err(`${prefix}sitemap.xml`, "estructura de url/loc incompleta o vacía");
  }

  let expectedOrigin = "";
  let sitePrefix = "";
  try {
    const site = new URL(SITE_URL);
    if (site.protocol !== "https:") err("src/config/env.js", "SITE_URL debe usar HTTPS");
    expectedOrigin = site.origin;
    sitePrefix = site.pathname.replace(/\/+$/, "");
  } catch {
    err("src/config/env.js", "SITE_URL no es una URL pública válida");
  }
  const seen = new Set();
  for (const loc of urls) {
    let parsed;
    try { parsed = new URL(loc); }
    catch { err(`${prefix}sitemap.xml`, `URL inválida → ${loc}`); continue; }
    if (parsed.protocol !== "https:" || parsed.origin !== expectedOrigin) {
      err(`${prefix}sitemap.xml`, `URL debe usar HTTPS y el dominio canónico ${expectedOrigin} → ${loc}`);
      continue;
    }
    if (sitePrefix && parsed.pathname !== sitePrefix && !parsed.pathname.startsWith(`${sitePrefix}/`)) {
      err(`${prefix}sitemap.xml`, `URL fuera de la ruta base del sitio → ${parsed.pathname}`);
      continue;
    }
    if (seen.has(loc)) err(`${prefix}sitemap.xml`, `URL duplicada → ${loc}`);
    seen.add(loc);

    const pagePath = parsed.pathname.slice(sitePrefix.length) || "/";
    const file = pagePath === "/" || pagePath.endsWith("/")
      ? `${pagePath.replace(/^\/+|\/+$/g, "")}${pagePath === "/" ? "" : "/"}index.html`
      : pagePath.replace(/^\//, "");
    const html = pages[file];
    if (!html) { err(`${prefix}sitemap.xml`, `URL sin página pública correspondiente → ${loc}`); continue; }
    const robotsMeta = html.match(/<meta\b[^>]*\bname=["']robots["'][^>]*>/i)?.[0] ?? "";
    const robotsContent = robotsMeta.match(/\bcontent=["']([^"']*)["']/i)?.[1] ?? "";
    if (/\bnoindex\b|\bnofollow\b/i.test(robotsContent) || await hasNoindexHeader(baseDir, parsed.pathname)) {
      err(`${prefix}sitemap.xml`, `incluye página no indexable → ${loc}`);
    }
    const canonical = [...html.matchAll(/<link\b[^>]*\brel=["']canonical["'][^>]*\bhref=["']([^"']+)["'][^>]*>/gi)];
    if (canonical.length !== 1 || canonical[0][1] !== loc) {
      err(`${prefix}sitemap.xml`, `URL no coincide con el canonical de ${file} → ${loc}`);
    }
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

    // La etiqueta debe permanecer exacta en la página principal y en el paquete publicado.
    if (f === "index.html") {
      const verificationTags = [...html.matchAll(/<meta\s+name=["']google-site-verification["']\s+content=["']([^"']+)["']\s*\/?\s*>/gi)];
      if (verificationTags.length !== 1) err(reportFile, `debe contener exactamente una etiqueta google-site-verification (tiene ${verificationTags.length})`);
      else if (verificationTags[0][1] !== GOOGLE_SITE_VERIFICATION) err(reportFile, "el token google-site-verification no coincide con el configurado para Search Console");
    }

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
  await auditSitemap(baseDir, robotsTxt, pages, label);
  return { pages, robotsTxt };
}

const source = await auditPages(ROOT, files, "source");
console.log(`Páginas auditadas: ${Object.keys(source.pages).length} (${Object.keys(source.pages).join(", ")})`);

if (!(await isDirectory(DIST))) {
  err("dist", "no existe el paquete; ejecuta npm run package o npm run audit para generarlo");
} else {
  for (const required of ["_headers", "robots.txt", "sitemap.xml"]) {
    if (!(await isFile(path.join(DIST, required)))) err("dist", `falta archivo requerido → ${required}`);
  }
  const dist = await auditPages(DIST, files, "dist");
  console.log(`Páginas auditadas en dist/: ${Object.keys(dist.pages).length}`);

  const envFile = path.join(DIST, "src/config/env.js");
  if (await isFile(envFile)) {
    const envSource = await readFile(envFile, "utf8");
    if (/CONTACT_ENDPOINT\s*:\s*["']\/api\/contact["']/.test(envSource)) {
      const handlerFile = path.join(ROOT, "functions/api/contact.js");
      const workerFile = path.join(ROOT, "worker.js");
      const configFile = path.join(ROOT, "wrangler.jsonc");
      if (!(await isFile(handlerFile))) {
        err("functions/api/contact.js", "src/config/env.js referencia /api/contact pero no existe el handler");
      }
      if (!(await isFile(workerFile))) err("worker.js", "/api/contact no tiene un Worker entrypoint");
      else {
        const workerSource = await readFile(workerFile, "utf8");
        if (!workerSource.includes('from "./functions/api/contact.js"') || !workerSource.includes('url.pathname === "/api/contact"')) {
          err("worker.js", "no enruta /api/contact al handler existente");
        }
      }
      if (!(await isFile(configFile))) err("wrangler.jsonc", "falta la configuración de despliegue del Worker");
      else {
        try {
          const config = JSON.parse(await readFile(configFile, "utf8"));
          if (config.main !== "./worker.js") err("wrangler.jsonc", "main debe apuntar a ./worker.js");
          if (config.assets?.directory !== "./dist") err("wrangler.jsonc", "assets.directory debe apuntar a ./dist");
          if (config.assets?.binding !== "ASSETS") err("wrangler.jsonc", "falta el binding ASSETS para los archivos estáticos");
          if (!config.assets?.run_worker_first?.includes("/api/*")) err("wrangler.jsonc", "run_worker_first debe incluir /api/*");
        } catch {
          err("wrangler.jsonc", "JSON inválido");
        }
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
