// One-off: build the favicon from the white-on-black ZODE source mark.
// The source is a wide loop mark; crop a centered square around the bright
// central bowtie so the icon stays recognizable at small sizes, then emit a
// 512x512 PNG. Next.js serves src/app/icon.png as the favicon automatically.
const path = require("path");
const sharp = require("sharp");

(async () => {
  const src = path.join(__dirname, "source-logo.png");
  const meta = await sharp(src).metadata();
  const size = Math.min(meta.width, meta.height);
  const left = Math.round((meta.width - size) / 2);
  const top = Math.round((meta.height - size) / 2);

  const dest = path.join(__dirname, "..", "src", "app", "icon.png");
  const result = await sharp(src)
    .extract({ left, top, width: size, height: size })
    .resize(512, 512)
    .png()
    .toFile(dest);

  console.log("wrote", dest, `${result.width}x${result.height}`);
})();
