// glb-read.mjs — a minimal GLB reader for the asset gates (no three.js, no DOM): JSON chunk + BIN chunk,
// meshes with POSITION / NORMAL / COLOR_0 / indices (component types 5121/5123/5125 and 5126 only).
// Returns { json, meshes: [{ name, node, position: Float32Array, normal?, color?, index?: Uint32Array, triangles }] }.
import { readFileSync } from 'node:fs';

const CT = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const N = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

export function readGlb(path) {
  const buf = readFileSync(path);
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('not a GLB: ' + path);
  let off = 12, json = null, bin = null;
  while (off < buf.length) {
    const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true); off += 8;
    const chunk = buf.subarray(off, off + len); off += len;
    if (type === 0x4e4f534a) json = JSON.parse(chunk.toString('utf8'));
    else if (type === 0x004e4942) bin = chunk;
  }
  if (!json || !bin) throw new Error('GLB without JSON/BIN chunk: ' + path);
  function accessor(i) {
    const a = json.accessors[i], bv = json.bufferViews[a.bufferView], T = CT[a.componentType], n = N[a.type];
    const start = bin.byteOffset + (bv.byteOffset || 0) + (a.byteOffset || 0);
    if (bv.byteStride && bv.byteStride !== n * T.BYTES_PER_ELEMENT) throw new Error('interleaved accessor unsupported');
    const raw = new T(bin.buffer.slice(start, start + a.count * n * T.BYTES_PER_ELEMENT));
    return { data: raw, n, normalized: !!a.normalized, count: a.count };
  }
  const nodes = json.nodes || [], meshes = [];
  nodes.forEach((nd, ni) => {
    if (nd.mesh === undefined) return;
    const m = json.meshes[nd.mesh];
    m.primitives.forEach((p, pi) => {
      const pos = accessor(p.attributes.POSITION);
      const out = { name: nd.name || m.name || ('mesh' + nd.mesh), node: ni, primitive: pi, position: pos.data, translation: nd.translation || [0, 0, 0], scale: nd.scale || [1, 1, 1] };
      if (p.attributes.NORMAL !== undefined) out.normal = accessor(p.attributes.NORMAL).data;
      if (p.attributes.COLOR_0 !== undefined) { const c = accessor(p.attributes.COLOR_0); out.color = c.normalized ? Float32Array.from(c.data, (v) => v / (c.data.BYTES_PER_ELEMENT === 1 ? 255 : 65535)) : Float32Array.from(c.data); out.colorN = c.n; }
      if (p.indices !== undefined) out.index = Uint32Array.from(accessor(p.indices).data);
      out.triangles = (out.index ? out.index.length : pos.count) / 3;
      meshes.push(out);
    });
  });
  return { json, meshes };
}

export function bounds(mesh) {
  const p = mesh.position, b = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) { const v = p[i + k] * mesh.scale[k] + mesh.translation[k]; if (v < b.min[k]) b.min[k] = v; if (v > b.max[k]) b.max[k] = v; }
  return b;
}
