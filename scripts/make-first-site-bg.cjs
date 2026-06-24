// One-off: build the terrain-only background for the "first site" section.
// The provided mockup bakes the Key Facts list (right) and the Progress bar
// (bottom-center) into the artwork; those are rebuilt as live HTML in the
// section, so here we paint near-black over both regions to leave just the
// contour-map terrain. The fill matches the dark panel so the seams blend.
const path = require("path");
const sharp = require("sharp");

const SRC = path.join(__dirname, "first-site-source.png");
const DEST = path.join(__dirname, "..", "public", "images", "first-site.png");

// Regions to erase, in source pixels (image is 1024x461).
const COVERS = [
  // Right-hand Key Facts column (labels + values + leader dots), on black.
  { left: 740, top: 175, width: 284, height: 235 },
  // Bottom-center Progress heading, segmented bar, and stage labels.
  { left: 300, top: 368, width: 410, height: 93 },
  // Dotted leader line that pointed from the coast to the facts column.
  { left: 555, top: 216, width: 200, height: 22 },
];

const FILL = { r: 10, g: 10, b: 10, alpha: 1 }; // #0a0a0a

(async () => {
  const overlays = await Promise.all(
    COVERS.map(async (c) => ({
      input: await sharp({
        create: {
          width: c.width,
          height: c.height,
          channels: 4,
          background: FILL,
        },
      })
        .png()
        .toBuffer(),
      left: c.left,
      top: c.top,
    })),
  );

  const result = await sharp(SRC).composite(overlays).png().toFile(DEST);
  console.log("wrote", DEST, `${result.width}x${result.height}`);
})();
