// One-off: build a transparent wordmark PNG from the black-on-light source.
// Mirrors make-logo.cjs but inverted for a dark mark on a light background:
// alpha is taken from darkness (lettering opaque, light background transparent)
// and the color is forced white, so the wordmark matches the white-master
// convention and can be inverted to black via CSS for the light shell.
// Transparent padding is trimmed so the mark fills its box.
const path = require("path");
const sharp = require("sharp");

(async () => {
  const src = path.join(__dirname, "source-wordmark.png");
  const { data, info } = await sharp(src)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // The source background is a near-white light gray (luminance ~225+) and the
  // lettering is near black. Invert luminance to alpha so dark pixels become
  // opaque, and zero out everything above the ceiling so the light background
  // is fully transparent. A gamma > 1 fades the faint anti-aliased edge pixels
  // while keeping the solid letter cores, avoiding a gray halo when downscaled.
  const CEILING = 200;
  const GAMMA = 1.7;
  const px = info.width * info.height;
  const ch = info.channels;
  const out = Buffer.alloc(px * 4);
  for (let i = 0; i < px; i++) {
    const lum = data[i * ch];
    const inv = 255 - lum;
    out[i * 4] = 255;
    out[i * 4 + 1] = 255;
    out[i * 4 + 2] = 255;
    out[i * 4 + 3] = lum > CEILING ? 0 : Math.round(255 * (inv / 255) ** GAMMA);
  }

  const dest = path.join(__dirname, "..", "public", "wordmark.png");
  const result = await sharp(out, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .trim({ threshold: 12 })
    .png()
    .toFile(dest);

  console.log("wrote", dest, `${result.width}x${result.height}`);
})();
