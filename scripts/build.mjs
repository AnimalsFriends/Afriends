/**
 * BUILD (sin dependencias, solo Node >= 18)
 *
 *   node scripts/build.mjs
 *
 * Qué hace (es idempotente: puedes correrlo las veces que quieras):
 *   1. Genera sitemap.xml y robots.txt.
 *   2. En el <head> de cada página inyecta (entre marcadores):
 *        - <link rel="canonical">, Open Graph y Twitter Cards
 *        - JSON-LD (datos estructurados)
 *        - <link rel="modulepreload"> de todos los módulos JS (evita la "cascada" de peticiones)
 *        - precarga del logo (mejora LCP)
 *
 * Dirección del sitio (SITE_URL): variable de entorno SITE_URL > ENV.SITE_URL en src/config/env.js.
 * Si está vacía NO se inventa ningún dominio: se omiten sitemap, canonical y og:url / og:image.
 * La ruta pública conserva el .html porque GitHub Pages no aplica las rutas limpias de Cloudflare Pages.
 */
import { readFile, writeFile, readdir, stat, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const url = (p) => pathToFileURL(path.join(ROOT, p)).href;

const { ENV } = await import(url("src/config/env.js"));
const { SITE_DEFAULTS } = await import(url("src/config/site.defaults.js"));
const { SiteConfigModel } = await import(url("src/models/SiteConfigModel.js"));
const { buildBusinessSchema, buildPageSchema } = await import(url("src/seo/structuredData.js"));

const SITE_URL = (process.env.SITE_URL || ENV.SITE_URL || "").trim().replace(/\/+$/, "");
if (SITE_URL && !/^https:\/\//.test(SITE_URL)) {
  console.error(`✖ SITE_URL debe empezar por https:// (recibido: "${SITE_URL}")`);
  process.exit(1);
}

/* Usamos las rutas de archivo reales para que también funcionen bajo GitHub Pages. */
const PAGES = [
  { file: "index.html",               path: "/",                        kind: "home",   index: true },
  { file: "aviso-legal.html",         path: "/aviso-legal.html",         kind: "legal",  index: true },
  { file: "politica-privacidad.html", path: "/politica-privacidad.html", kind: "legal",  index: true },
  { file: "politica-cookies.html",    path: "/politica-cookies.html",    kind: "legal",  index: true },
  { file: "404.html",                 path: null,                       kind: "error",  index: false }
];

const OG_IMAGE = "/assets/img/og-cover.jpg";
const PRELOAD_IMAGES = [{ href: "assets/img/logo-horizontal.webp", type: "image/webp" }];

/* ---------- utilidades ---------- */
const attr = (s) => String(s).replace(/"/g, "&quot;");
const grab = (html, re) => (html.match(re)?.[1] ?? "").trim();
const replaceBlock = (html, name, content) => {
  const start = `<!-- ${name}:start`;
  const end = `<!-- ${name}:end -->`;
  const block = `${start} (generado por scripts/build.mjs: no editar a mano) -->\n${content}\n  ${end}`;
  const re = new RegExp(`<!-- ${name}:start[\\s\\S]*?${end.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}`);
  return re.test(html) ? html.replace(re, block) : html.replace("</head>", `  ${block}\n</head>`);
};
const jsonLd = (id, obj) => `  <script type="application/ld+json" id="${id}">${JSON.stringify(obj)}</script>`;

/* ---------- grafo de módulos JS (para modulepreload) ---------- */
async function moduleGraph(entry) {
  const seen = new Set();
  const visit = async (rel) => {
    if (seen.has(rel)) return;
    seen.add(rel);
    const src = await readFile(path.join(ROOT, rel), "utf8");
    for (const m of src.matchAll(/\bimport\s+(?:[^'"]*?\bfrom\s+)?["'](\.{1,2}\/[^"']+)["']/g)) {
      await visit(path.posix.normalize(path.posix.join(path.posix.dirname(rel), m[1])));
    }
  };
  await visit(entry);
  return [...seen];
}

/* ---------- construcción ---------- */
const modules = await moduleGraph("src/main.js");
const state = SiteConfigModel.fromDefaults();
const buildMeta = [];

for (const page of PAGES) {
  const file = path.join(ROOT, page.file);
  let html = await readFile(file, "utf8");
  const title = grab(html, /<title>([\s\S]*?)<\/title>/);
  const description = grab(html, /<meta name="description" content="([^"]*)"/);
  const pageUrl = SITE_URL && page.path != null ? `${SITE_URL}${page.path === "/" ? "/" : page.path}` : "";

  // --- SEO: canonical, Open Graph, Twitter, JSON-LD ---
  const seo = [];
  if (pageUrl && page.index) seo.push(`  <link rel="canonical" href="${pageUrl}">`);
  seo.push(
    `  <meta property="og:type" content="website">`,
    `  <meta property="og:locale" content="es_CO">`,
    `  <meta property="og:site_name" content="${attr(state.negocio.nombre ?? "Animal Friends")}">`,
    `  <meta property="og:title" content="${title}">`,
    `  <meta property="og:description" content="${description}">`
  );
  if (pageUrl && page.index) seo.push(`  <meta property="og:url" content="${pageUrl}">`);
  if (SITE_URL) {
    seo.push(
      `  <meta property="og:image" content="${SITE_URL}${OG_IMAGE}">`,
      `  <meta property="og:image:width" content="1200">`,
      `  <meta property="og:image:height" content="630">`,
      `  <meta property="og:image:alt" content="Animal Friends: cuidamos a tu peludito con amor, respeto y alegría">`
    );
  }
  seo.push(`  <meta name="twitter:card" content="${SITE_URL ? "summary_large_image" : "summary"}">`,
           `  <meta name="twitter:title" content="${title}">`,
           `  <meta name="twitter:description" content="${description}">`);
  if (SITE_URL) seo.push(`  <meta name="twitter:image" content="${SITE_URL}${OG_IMAGE}">`);

  if (page.kind === "home") {
    seo.push(jsonLd("ld-business", buildBusinessSchema({ negocio: state.negocio, categorias: state.categorias, siteUrl: SITE_URL })));
  } else if (page.kind === "legal" && SITE_URL) {
    const name = title.split("|")[0].trim();
    seo.push(jsonLd("ld-page", buildPageSchema({ siteUrl: SITE_URL, path: page.path, name, description })));
  }
  html = replaceBlock(html, "seo", seo.join("\n"));

  // --- Rendimiento: modulepreload + precarga del logo ---
  const pre = [
    ...PRELOAD_IMAGES.map((i) => `  <link rel="preload" as="image" href="${i.href}" type="${i.type}" fetchpriority="high">`),
    ...modules.map((m) => `  <link rel="modulepreload" href="${m}">`)
  ];
  html = replaceBlock(html, "preload", pre.join("\n"));

  await writeFile(file, html);
  buildMeta.push({ ...page, pageUrl });
}

/* ---------- robots.txt ---------- */
const robots = ["User-agent: *", "Allow: /", ""];
if (SITE_URL) robots.push(`Sitemap: ${SITE_URL}/sitemap.xml`, "");
await writeFile(path.join(ROOT, "robots.txt"), robots.join("\n"));

/* ---------- sitemap.xml ---------- */
const sitemapFile = path.join(ROOT, "sitemap.xml");
if (SITE_URL) {
  const entries = [];
  for (const p of buildMeta.filter((p) => p.index)) {
    const { mtime } = await stat(path.join(ROOT, p.file));
    entries.push(`  <url>\n    <loc>${p.pageUrl}</loc>\n    <lastmod>${mtime.toISOString().slice(0, 10)}</lastmod>\n  </url>`);
  }
  await writeFile(sitemapFile, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>\n`);
} else {
  await rm(sitemapFile, { force: true });
}

/* ---------- resumen ---------- */
console.log(`✔ Build listo · ${PAGES.length} páginas · ${modules.length} módulos precargados`);
if (SITE_URL) {
  console.log(`✔ SITE_URL = ${SITE_URL}\n✔ sitemap.xml y robots.txt generados`);
} else {
  console.warn("⚠ SITE_URL vacío: no se generó sitemap.xml ni canonical / og:url / og:image.\n  Define la variable SITE_URL (o ENV.SITE_URL en src/config/env.js) cuando tengas el dominio.");
}
