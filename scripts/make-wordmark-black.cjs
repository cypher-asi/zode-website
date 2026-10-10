// One-off: build a black-on-white wordmark PNG from the black-on-light source.
// Keeps lettering near-black, flattens the light background to pure white, and
// trims transparent/near-white padding so the mark fills its box.
const path = require("path");
const sharp = require("sharp");

(async () => {
  const src = path.join(__dirname, "source-wordmark.png");
  const { data, info } = await sharp(src)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Source background is near-white (luminance ~225+); lettering is near black.
  // Force background to pure white and letter cores to pure black. Soften
  // anti-aliased edges with a gamma so downscales stay crisp without a halo.
  const CEILING = 200;
  const GAMMA = 1.7;
  const px = info.width * info.height;
  const ch = info.channels;
  const out = Buffer.alloc(px * 4);
  for (let i = 0; i < px; i++) {
    const lum = data[i * ch];
    if (lum > CEILING) {
      out[i * 4] = 255;
      out[i * 4 + 1] = 255;
      out[i * 4 + 2] = 255;
      out[i * 4 + 3] = 255;
      continue;
    }
    const inv = 255 - lum;
    const ink = Math.round(255 * (1 - (inv / 255) ** GAMMA));
    out[i * 4] = ink;
    out[i * 4 + 1] = ink;
    out[i * 4 + 2] = ink;
    out[i * 4 + 3] = 255;
  }

  const dest = path.join(__dirname, "..", "public", "wordmark-black.png");
  // Trim near-white padding the same way the transparent wordmark trims alpha.
  const result = await sharp(out, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .trim({ threshold: 12 })
    .png()
    .toFile(dest);

  console.log("wrote", dest, `${result.width}x${result.height}`);
})();
