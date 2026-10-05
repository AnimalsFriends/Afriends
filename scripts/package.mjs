/**
 * EMPAQUETADO (sin dependencias): copia a ./dist SOLO lo que debe publicarse.
 *
 *   node scripts/package.mjs
 *
 * Se publica: páginas .html, robots.txt, sitemap.xml, _headers, assets/, src/ y admin/.
 * NO se publica: scripts/, tests/, functions/ (se despliega aparte), docs, SQL, .github, package.json.
 */
import { cp, rm, mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const exists = (p) => stat(p).then(() => true, () => false);

await rm(DIST, { recursive: true, force: true });
await mkdir(DIST, { recursive: true });

const rootFiles = (await readdir(ROOT)).filter((f) => f.endsWith(".html") || ["robots.txt", "sitemap.xml", "_headers"].includes(f));
for (const file of rootFiles) await cp(path.join(ROOT, file), path.join(DIST, file));
for (const dir of ["assets", "src", "admin"]) {
  if (await exists(path.join(ROOT, dir))) await cp(path.join(ROOT, dir), path.join(DIST, dir), { recursive: true, filter: (src) => !src.endsWith(".DS_Store") });
}
console.log(`✔ dist/ listo: ${rootFiles.length} archivos en la raíz + assets/ + src/ + admin/`);
