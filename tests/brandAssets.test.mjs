import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const pages = [
  "index.html",
  "404.html",
  "aviso-legal.html",
  "politica-cookies.html",
  "politica-privacidad.html",
  "admin/index.html"
];
const iconFiles = [
  ["img/favicon-16x16.png", 16],
  ["img/favicon-32x32.png", 32],
  ["img/apple-touch-icon.png", 180],
  ["img/icon-192.png", 192],
  ["img/icon-512.png", 512]
];

function pngDimensions(file) {
  const image = readFileSync(file);
  assert.equal(image.toString("hex", 0, 8), "89504e470d0a1a0a", `${file} is a PNG`);
  return [image.readUInt32BE(16), image.readUInt32BE(20)];
}

test("las páginas publican variantes favicon adecuadas para navegadores y móviles", () => {
  for (const page of pages) {
    const html = readFileSync(page, "utf8");
    const prefix = page.startsWith("admin/") ? "../" : "";
    for (const href of [
      `${prefix}favicon.ico`,
      `${prefix}img/favicon-16x16.png`,
      `${prefix}img/favicon-32x32.png`,
      `${prefix}img/apple-touch-icon.png`,
      `${prefix}site.webmanifest`
    ]) {
      assert.ok(html.includes(`href="${href}"`), `${page} links ${href}`);
      assert.ok(existsSync(path.join(path.dirname(page), href)), `${href} exists for ${page}`);
    }
  }
});

test("las imágenes de marca tienen dimensiones y manifiesto coherentes", () => {
  for (const [file, size] of iconFiles) {
    assert.deepEqual(pngDimensions(file), [size, size], `${file} dimensions`);
  }

  const socialImage = "img/animalsfriends-social-preview.png";
  assert.deepEqual(pngDimensions(socialImage), [1200, 630]);

  const manifest = JSON.parse(readFileSync("site.webmanifest", "utf8"));
  assert.deepEqual(manifest.icons.map(({ src, sizes, type }) => [src, sizes, type]), [
    ["img/icon-192.png", "192x192", "image/png"],
    ["img/icon-512.png", "512x512", "image/png"]
  ]);

  const build = readFileSync("scripts/build.mjs", "utf8");
  assert.match(build, /const OG_IMAGE = "\/img\/animalsfriends-social-preview\.png"/);
  const structuredData = readFileSync("src/seo/structuredData.js", "utf8");
  assert.match(structuredData, /image: abs\(siteUrl, "\/img\/animalsfriends-social-preview\.png"\)/);
});
