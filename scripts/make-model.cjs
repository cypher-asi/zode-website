// Converts the ZODE OBJ into the compact binary the assembly scene loads
// (public/zode_3D.bin), so the browser skips downloading and text-parsing 7 MB.
// Only vertex positions and polygon faces are kept; normals are recomputed
// per face at load time. Rerun whenever scripts/zode_3D.obj changes.
//
// Layout (little-endian):
//   Uint32 x3   vertexCount, faceCount, indexCount
//   Float32     positions, xyz per vertex   (vertexCount * 3)
//   Uint32      face vertex indices, 0-based (indexCount)
//   Uint8       vertices per face            (faceCount)
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "zode_3D.obj");
const out = path.join(__dirname, "..", "public", "zode_3D.bin");

const positions = [];
const indices = [];
const sizes = [];
for (const line of fs.readFileSync(src, "utf8").split("\n")) {
  if (line.startsWith("v ")) {
    const parts = line.slice(2).trim().split(/\s+/);
    positions.push(+parts[0], +parts[1], +parts[2]);
  } else if (line.startsWith("f ")) {
    const parts = line.slice(2).trim().split(/\s+/);
    if (parts.length > 255) throw new Error(`Face with ${parts.length} vertices does not fit in a Uint8`);
    for (const p of parts) indices.push(parseInt(p.split("/")[0], 10) - 1);
    sizes.push(parts.length);
  }
}

const header = new Uint32Array([positions.length / 3, sizes.length, indices.length]);
fs.writeFileSync(
  out,
  Buffer.concat([
    Buffer.from(header.buffer),
    Buffer.from(new Float32Array(positions).buffer),
    Buffer.from(new Uint32Array(indices).buffer),
    Buffer.from(new Uint8Array(sizes).buffer),
  ]),
);
console.log(`${path.relative(process.cwd(), out)}: ${header[0]} vertices, ${header[1]} faces, ${fs.statSync(out).size} bytes`);
