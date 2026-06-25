// One-off: build a transparent logo PNG from the white-on-black source.
// Alpha is taken from luminance (lines opaque, background transparent) and the
// color is forced white, so the mark blends on any background and can be
// inverted to black via CSS for the light theme. Transparent padding is
// trimmed so the mark fills its box.
const path = require("path");
const sharp = require("sharp");

(async () => {
  const src = path.join(__dirname, "source-logo.png");
  const { data, info } = await sharp(src)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // The source background is not pure black (luminance ~0-32 with a faint
  // vignette); the lines start around 48. Zero out everything below the floor
  // so the background is fully transparent. A gamma > 1 then fades the faint
  // anti-aliased pixels while keeping the bright line cores, which keeps the
  // mark from averaging into a gray "fog" box when downscaled to the small
  // top-bar / rail sizes.
  const FLOOR = 40;
  const GAMMA = 1.7;
  const px = info.width * info.height;
  const ch = info.channels;
  const out = Buffer.alloc(px * 4);
  for (let i = 0; i < px; i++) {
    const lum = data[i * ch];
    out[i * 4] = 255;
    out[i * 4 + 1] = 255;
    out[i * 4 + 2] = 255;
    out[i * 4 + 3] = lum < FLOOR ? 0 : Math.round(255 * (lum / 255) ** GAMMA);
  }

  const dest = path.join(__dirname, "..", "public", "logo.png");
  const result = await sharp(out, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .trim({ threshold: 12 })
    .png()
    .toFile(dest);

  console.log("wrote", dest, `${result.width}x${result.height}`);
})();
