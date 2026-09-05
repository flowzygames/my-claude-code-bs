/* ------------------------------------------------------------------ *
 *  mesh.js — procedural geometry.
 *
 *  A MeshBuilder with a transform stack; everything in the game (the
 *  house, the furniture, the items, granny herself) is assembled from
 *  boxes, cylinders, spheres and extruded shapes pushed into one of these.
 * ------------------------------------------------------------------ */
'use strict';

const FLOATS_PER_VERT = 12;   // pos3 normal3 uv2 colour4

class MeshBuilder {
  constructor() {
    this.verts = [];
    this.idx = [];
    this.stack = [];
    this.m = M4.create();
    this.col = [1, 1, 1];
    this.aoValue = 1;
    this._tmp = M4.create();
    this._prim = 0;
  }

  /* Every primitive gets a slightly different shade of its colour. Real
     furniture is never one flat tone, and without textures on these models
     it is the difference between "sofa" and "grey box". */
  _jitter() {
    const j = 0.88 + U.hash(this._prim++, 7, 23) * 0.24;
    const c = this.col;
    this.col = [c[0] * j, c[1] * j, c[2] * j];
    return c;
  }

  /* ---- transform stack ---------------------------------------- */
  push() { this.stack.push(new Float32Array(this.m)); return this; }
  pop() { this.m = this.stack.pop(); return this; }

  apply(mat) { M4.multiply(this.m, this.m, mat); return this; }
  translate(x, y, z) { return this.apply(M4.translation(this._tmp, x, y, z)); }
  rotateX(a) { return this.apply(M4.rotationX(this._tmp, a)); }
  rotateY(a) { return this.apply(M4.rotationY(this._tmp, a)); }
  rotateZ(a) { return this.apply(M4.rotationZ(this._tmp, a)); }
  scale(x, y, z) { return this.apply(M4.scaling(this._tmp, x, y === undefined ? x : y, z === undefined ? x : z)); }

  color(r, g, b) {
    if (typeof r === 'string') { const c = U.hex(r); this.col = [c.r / 255, c.g / 255, c.b / 255]; }
    else this.col = [r, g, b];
    return this;
  }
  ao(v) { this.aoValue = v; return this; }

  /* ---- raw vertex push ---------------------------------------- */
  vertex(x, y, z, nx, ny, nz, u, v, ao) {
    const m = this.m;
    const px = m[0] * x + m[4] * y + m[8] * z + m[12];
    const py = m[1] * x + m[5] * y + m[9] * z + m[13];
    const pz = m[2] * x + m[6] * y + m[10] * z + m[14];
    // normals: rotation part only (builders never use non-uniform scale)
    let tx = m[0] * nx + m[4] * ny + m[8] * nz;
    let ty = m[1] * nx + m[5] * ny + m[9] * nz;
    let tz = m[2] * nx + m[6] * ny + m[10] * nz;
    const len = Math.hypot(tx, ty, tz) || 1;
    this.verts.push(px, py, pz, tx / len, ty / len, tz / len, u, v,
                    this.col[0], this.col[1], this.col[2],
                    ao === undefined ? this.aoValue : ao);
    return (this.verts.length / FLOATS_PER_VERT) - 1;
  }

  /** Quad from four corners, wound counter-clockwise when seen from the front. */
  quad(a, b, c, d, n, uv, aos) {
    const uvs = uv || [[0, 0], [1, 0], [1, 1], [0, 1]];
    const i0 = this.vertex(a[0], a[1], a[2], n[0], n[1], n[2], uvs[0][0], uvs[0][1], aos && aos[0]);
    const i1 = this.vertex(b[0], b[1], b[2], n[0], n[1], n[2], uvs[1][0], uvs[1][1], aos && aos[1]);
    const i2 = this.vertex(c[0], c[1], c[2], n[0], n[1], n[2], uvs[2][0], uvs[2][1], aos && aos[2]);
    const i3 = this.vertex(d[0], d[1], d[2], n[0], n[1], n[2], uvs[3][0], uvs[3][1], aos && aos[3]);
    this.idx.push(i0, i1, i2, i0, i2, i3);
    return this;
  }

  /**
   * Axis-aligned box centred on the origin (or resting on it with `onFloor`).
   * `uvScale` maps world size to texture repeats; leave it out for flat colour.
   */
  box(w, h, d, opts) {
    const o = opts || {};
    const restore = this._jitter();
    const x = w / 2, z = d / 2;
    const y0 = o.onFloor ? 0 : -h / 2, y1 = o.onFloor ? h : h / 2;
    const s = o.uvScale || 0;
    const uv = (uw, uh) => s ? [[0, 0], [uw * s, 0], [uw * s, uh * s], [0, uh * s]] : null;
    const skip = o.skip || '';

    if (!skip.includes('n')) this.quad([-x, y0, -z], [x, y0, -z], [x, y1, -z], [-x, y1, -z], [0, 0, -1], uv(w, h));
    if (!skip.includes('s')) this.quad([x, y0, z], [-x, y0, z], [-x, y1, z], [x, y1, z], [0, 0, 1], uv(w, h));
    if (!skip.includes('w')) this.quad([-x, y0, z], [-x, y0, -z], [-x, y1, -z], [-x, y1, z], [-1, 0, 0], uv(d, h));
    if (!skip.includes('e')) this.quad([x, y0, -z], [x, y0, z], [x, y1, z], [x, y1, -z], [1, 0, 0], uv(d, h));
    if (!skip.includes('u')) this.quad([-x, y1, -z], [x, y1, -z], [x, y1, z], [-x, y1, z], [0, 1, 0], uv(w, d));
    if (!skip.includes('d')) this.quad([-x, y0, z], [x, y0, z], [x, y0, -z], [-x, y0, -z], [0, -1, 0], uv(w, d));
    this.col = restore;
    return this;
  }

  /** Cylinder along +Y, base at the origin. `taper` shrinks the top. */
  cylinder(radius, height, segments, opts) {
    const o = opts || {};
    const restore = this._jitter();
    const seg = segments || 12;
    const rTop = radius * (o.taper === undefined ? 1 : o.taper);
    const ringB = [], ringT = [];
    for (let i = 0; i < seg; i++) {
      const a = i / seg * Math.PI * 2;
      const cx = Math.cos(a), sz = Math.sin(a);
      ringB.push(this.vertex(cx * radius, 0, sz * radius, cx, 0, sz, i / seg, 0));
      ringT.push(this.vertex(cx * rTop, height, sz * rTop, cx, 0, sz, i / seg, 1));
    }
    for (let i = 0; i < seg; i++) {
      const j = (i + 1) % seg;
      this.idx.push(ringB[i], ringB[j], ringT[j], ringB[i], ringT[j], ringT[i]);
    }
    if (!o.open) {
      const topC = this.vertex(0, height, 0, 0, 1, 0, 0.5, 0.5);
      const botC = this.vertex(0, 0, 0, 0, -1, 0, 0.5, 0.5);
      const tRing = [], bRing = [];
      for (let i = 0; i < seg; i++) {
        const a = i / seg * Math.PI * 2, cx = Math.cos(a), sz = Math.sin(a);
        tRing.push(this.vertex(cx * rTop, height, sz * rTop, 0, 1, 0, cx * .5 + .5, sz * .5 + .5));
        bRing.push(this.vertex(cx * radius, 0, sz * radius, 0, -1, 0, cx * .5 + .5, sz * .5 + .5));
      }
      for (let i = 0; i < seg; i++) {
        const j = (i + 1) % seg;
        this.idx.push(topC, tRing[i], tRing[j]);
        this.idx.push(botC, bRing[j], bRing[i]);
      }
    }
    this.col = restore;
    return this;
  }

  /** UV sphere centred on the origin. */
  sphere(radius, segments, rings) {
    const seg = segments || 12, rng = rings || 8;
    const grid = [];
    for (let r = 0; r <= rng; r++) {
      const phi = r / rng * Math.PI;
      const row = [];
      for (let s = 0; s <= seg; s++) {
        const th = s / seg * Math.PI * 2;
        const nx = Math.sin(phi) * Math.cos(th), ny = Math.cos(phi), nz = Math.sin(phi) * Math.sin(th);
        row.push(this.vertex(nx * radius, ny * radius, nz * radius, nx, ny, nz, s / seg, r / rng));
      }
      grid.push(row);
    }
    for (let r = 0; r < rng; r++) {
      for (let s = 0; s < seg; s++) {
        const a = grid[r][s], b = grid[r][s + 1], c = grid[r + 1][s + 1], d = grid[r + 1][s];
        this.idx.push(a, d, c, a, c, b);
      }
    }
    return this;
  }

  /** Extrude a closed 2D outline (XZ) along Y — used for gears and blades. */
  extrude(points, thickness) {
    const n = points.length;
    const h = thickness / 2;
    const top = [], bot = [];
    for (const p of points) {
      top.push(this.vertex(p[0], h, p[1], 0, 1, 0, p[0] * .5 + .5, p[1] * .5 + .5));
      bot.push(this.vertex(p[0], -h, p[1], 0, -1, 0, p[0] * .5 + .5, p[1] * .5 + .5));
    }
    for (let i = 1; i < n - 1; i++) {
      this.idx.push(top[0], top[i], top[i + 1]);
      this.idx.push(bot[0], bot[i + 1], bot[i]);
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const dx = points[j][0] - points[i][0], dz = points[j][1] - points[i][1];
      const l = Math.hypot(dx, dz) || 1;
      const nx = dz / l, nz = -dx / l;
      this.quad([points[i][0], -h, points[i][1]], [points[j][0], -h, points[j][1]],
                [points[j][0], h, points[j][1]], [points[i][0], h, points[i][1]], [nx, 0, nz]);
    }
    return this;
  }

  /** Ring of teeth — bear traps and cogs. */
  gear(radius, teeth, depth, thickness) {
    const pts = [];
    const steps = teeth * 4;
    for (let i = 0; i < steps; i++) {
      const a = i / steps * Math.PI * 2;
      const phase = (i % 4);
      const r = (phase === 1 || phase === 2) ? radius : radius - depth;
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    return this.extrude(pts, thickness);
  }

  get vertexCount() { return this.verts.length / FLOATS_PER_VERT; }

  /** Hand the accumulated geometry to the GPU. */
  build(gl) {
    const verts = new Float32Array(this.verts);
    const use32 = this.vertexCount > 65535;
    const idx = use32 ? new Uint32Array(this.idx) : new Uint16Array(this.idx);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    return {
      vbo, ibo,
      count: this.idx.length,
      type: use32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT,
    };
  }
}

/** Bind a built mesh's attributes and draw it. */
function drawMesh(gl, mesh) {
  if (!mesh || !mesh.count) return;
  const a = GL.attr;
  const stride = FLOATS_PER_VERT * 4;
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ibo);
  gl.enableVertexAttribArray(a.pos);
  gl.vertexAttribPointer(a.pos, 3, gl.FLOAT, false, stride, 0);
  gl.enableVertexAttribArray(a.normal);
  gl.vertexAttribPointer(a.normal, 3, gl.FLOAT, false, stride, 12);
  gl.enableVertexAttribArray(a.uv);
  gl.vertexAttribPointer(a.uv, 2, gl.FLOAT, false, stride, 24);
  gl.enableVertexAttribArray(a.color);
  gl.vertexAttribPointer(a.color, 4, gl.FLOAT, false, stride, 32);
  gl.drawElements(gl.TRIANGLES, mesh.count, mesh.type, 0);
}
