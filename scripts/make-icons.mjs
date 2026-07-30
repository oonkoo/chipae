/**
 * Regenerates app/icon.png and app/apple-icon.png from public/chipae_logo.png.
 *
 * Next 16 file conventions: app/icon.png becomes <link rel="icon"> and
 * app/apple-icon.png becomes the iOS home-screen icon. Both are served as-is,
 * so they are generated at sane sizes rather than pointing at the 3MB source.
 *
 * `sharp` is NOT a project dependency — it is only needed when the logo
 * changes. Run:
 *
 *   npm i --no-save sharp && node scripts/make-icons.mjs
 *
 * Note: the logo is a wide wordmark, so at 16-32px browser-tab sizes it reads
 * as a purple badge rather than a legible name. That is inherent to the mark,
 * not to this script.
 */
import sharp from "sharp";

const SRC = "public/chipae_logo.png";

// Trim the transparent margin first, so the mark fills the tile instead of
// floating in dead space at favicon sizes.
const trimmed = await sharp(SRC).trim().toBuffer();
const { width, height } = await sharp(trimmed).metadata();
console.log(`trimmed content: ${width}x${height}`);

await sharp(trimmed)
  .resize(256, 256, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png({ compressionLevel: 9 })
  .toFile("app/icon.png");

// iOS composites transparency onto black, so sit the mark on the brand's own
// dark indigo (--background in .dark, oklch(0.19 0.045 290)).
const INDIGO = { r: 23, g: 19, b: 43 };
await sharp(trimmed)
  .resize(160, 160, { fit: "contain", background: { ...INDIGO, alpha: 0 } })
  .extend({ top: 10, bottom: 10, left: 10, right: 10, background: INDIGO })
  .flatten({ background: INDIGO })
  .png({ compressionLevel: 9 })
  .toFile("app/apple-icon.png");

for (const f of ["app/icon.png", "app/apple-icon.png"]) {
  const m = await sharp(f).metadata();
  console.log(`${f} ${m.width}x${m.height}`);
}
