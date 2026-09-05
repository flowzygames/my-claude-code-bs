/* ------------------------------------------------------------------ *
 *  world3d.js — turns a level's tile grid into real geometry.
 *
 *  Grid cell (cx, cy) occupies world x ∈ [cx, cx+1], z ∈ [cy, cy+1];
 *  the y axis is up. Wall faces are only emitted where a solid cell meets
 *  an open one, and every vertex carries a baked ambient-occlusion value
 *  so corners and floor junctions sink into shadow for free.
 * ------------------------------------------------------------------ */
'use strict';

const WALL_H = 1.6;          // ceiling height, in cells (a cell ≈ 1.6 m)
const DOOR_H = 1.32;         // door leaf height; the rest is a header

/* how dark a vertex gets per occluding neighbour */
const AO_CORNER = 0.62;
const AO_FLOOR = 0.66;
const AO_CEIL = 0.80;

const World = {

  /** Is this cell something you can stand in? */
  open(L, x, y) {
    if (x < 0 || y < 0 || x >= L.w || y >= L.h) return false;
    const t = L.grid[y][x];
    return t === T.EMPTY || t === T.DOOR;
  },

  solid(L, x, y) { return !this.open(L, x, y); },

  /* --------------------------------------------------------------- *
   *  build every level's static geometry
   * --------------------------------------------------------------- */
  buildAll(gl, levels) {
    Object.values(levels).forEach(L => this.build(gl, L));
  },

  /** Release the GPU buffers of a previous house before building a new one. */
  disposeAll(gl, levels) {
    Object.values(levels).forEach(L => {
      (L.geo || []).forEach(g => {
        gl.deleteBuffer(g.mesh.vbo);
        gl.deleteBuffer(g.mesh.ibo);
      });
      L.geo = null;
    });
  },

  build(gl, L) {
    const groups = {};                 // tile id -> MeshBuilder
    const mb = (tile) => (groups[tile] || (groups[tile] = new MeshBuilder()));
    L.lights = [];

    for (let cy = 0; cy < L.h; cy++) {
      for (let cx = 0; cx < L.w; cx++) {
        if (this.open(L, cx, cy)) {
          this._floorAndCeiling(L, mb, cx, cy);
          if (L.grid[cy][cx] === T.DOOR) this._doorHeader(L, mb, cx, cy);
        } else {
          this._wallFaces(L, mb, cx, cy);
        }
      }
    }

    L.geo = Object.keys(groups).map(tile => ({
      tile: +tile,
      mesh: groups[tile].build(gl),
    }));
    (L.extraLights || []).forEach(l => L.lights.push(l));
    this._doorMeta(L);
  },

  /* --------------------------------------------------------------- *
   *  floor + ceiling for one open cell
   * --------------------------------------------------------------- */
  _floorAndCeiling(L, mb, cx, cy) {
    const room = L.roomGrid[cy][cx];
    const spec = room >= 0 ? L.roomStyles[room] : null;
    const floorTex = (spec && spec.floor) || L.floorTex;
    const ceilTex = (spec && spec.ceil) || L.ceilTex;

    /* corner occlusion: how boxed-in is each corner of this cell */
    const cao = (dx, dy) => {
      let n = 0;
      if (this.solid(L, cx + dx * 2 - 1, cy)) n++;
      if (this.solid(L, cx, cy + dy * 2 - 1)) n++;
      if (this.solid(L, cx + dx * 2 - 1, cy + dy * 2 - 1)) n++;
      return 1 - n * 0.13;
    };

    const a00 = cao(0, 0), a10 = cao(1, 0), a11 = cao(1, 1), a01 = cao(0, 1);
    const x0 = cx, x1 = cx + 1, z0 = cy, z1 = cy + 1;

    const f = mb(floorTex);
    f.color(1, 1, 1);
    f.quad([x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1], [0, 1, 0],
           [[x0, z0], [x1, z0], [x1, z1], [x0, z1]],
           [a00 * AO_FLOOR + 0.24, a10 * AO_FLOOR + 0.24, a11 * AO_FLOOR + 0.24, a01 * AO_FLOOR + 0.24]);

    const c = mb(ceilTex);
    c.color(1, 1, 1);
    c.quad([x0, WALL_H, z1], [x1, WALL_H, z1], [x1, WALL_H, z0], [x0, WALL_H, z0], [0, -1, 0],
           [[x0, z1], [x1, z1], [x1, z0], [x0, z0]],
           [a01 * AO_CEIL, a11 * AO_CEIL, a10 * AO_CEIL, a00 * AO_CEIL]);
  },

  /* --------------------------------------------------------------- *
   *  the four possible faces of a solid cell
   * --------------------------------------------------------------- */
  _wallFaces(L, mb, cx, cy) {
    const tile = L.grid[cy][cx];
    const b = mb(tile);
    b.color(1, 1, 1);

    // face definitions: [neighbour dx, dy, normal, corner a, corner b]
    // corners are given in world space, counter-clockwise seen from the room
    const faces = [
      [0, -1, [0, 0, -1], [cx + 1, cy], [cx, cy]],
      [0, 1, [0, 0, 1], [cx, cy + 1], [cx + 1, cy + 1]],
      [-1, 0, [-1, 0, 0], [cx, cy], [cx, cy + 1]],
      [1, 0, [1, 0, 0], [cx + 1, cy + 1], [cx + 1, cy]],
    ];

    for (const [dx, dy, n, p0, p1] of faces) {
      if (!this.open(L, cx + dx, cy + dy)) continue;

      /* darken the ends of the face that meet a perpendicular wall */
      const perp = dx !== 0 ? [[0, -1], [0, 1]] : [[-1, 0], [1, 0]];
      const endA = this.solid(L, cx + perp[0][0], cy + perp[0][1]) ? AO_CORNER : 1;
      const endB = this.solid(L, cx + perp[1][0], cy + perp[1][1]) ? AO_CORNER : 1;
      // p0..p1 runs along the wall; work out which end is which
      const aFirst = (dx !== 0) ? (p0[1] < p1[1] ? endA : endB) : (p0[0] < p1[0] ? endA : endB);
      const aSecond = (dx !== 0) ? (p0[1] < p1[1] ? endB : endA) : (p0[0] < p1[0] ? endB : endA);

      const u0 = (dx !== 0) ? p0[1] : p0[0];
      const u1 = (dx !== 0) ? p1[1] : p1[0];

      /* split vertically so the floor junction can fade without flattening
         the whole wall */
      const bands = [[0, 0.5, AO_FLOOR, 1.0], [0.5, WALL_H, 1.0, AO_CEIL]];
      for (const [ya, yb, aoA, aoB] of bands) {
        b.quad(
          [p0[0], ya, p0[1]], [p1[0], ya, p1[1]],
          [p1[0], yb, p1[1]], [p0[0], yb, p0[1]],
          n,
          [[u0, ya], [u1, ya], [u1, yb], [u0, yb]],
          [aFirst * aoA, aSecond * aoA, aSecond * aoB, aFirst * aoB]
        );
      }

      /* a boarded window spills a little moonlight into the room */
      if (tile === T.WINDOW) {
        L.lights.push({
          x: cx + 0.5 + dx * 0.55, y: 1.0, z: cy + 0.5 + dy * 0.55,
          r: 0.16, g: 0.20, b: 0.34, range: 5.2,
        });
      }
    }
  },

  /* --------------------------------------------------------------- *
   *  header above a doorway, so openings are not floor-to-ceiling holes
   * --------------------------------------------------------------- */
  _doorHeader(L, mb, cx, cy) {
    // `wallAlongZ`: the wall this door sits in runs north–south, so its solid
    // neighbours are above and below and you walk through it along x.
    const wallAlongZ = this.solid(L, cx, cy - 1) && this.solid(L, cx, cy + 1);
    const b = mb(wallAlongZ ? L.grid[cy - 1][cx] : L.grid[cy][cx - 1]);
    b.color(1, 1, 1).ao(0.78);
    b.push();
    b.translate(cx + 0.5, DOOR_H, cy + 0.5);
    if (wallAlongZ) b.box(0.16, WALL_H - DOOR_H, 1.0, { onFloor: true, uvScale: 1 });
    else b.box(1.0, WALL_H - DOOR_H, 0.16, { onFloor: true, uvScale: 1 });
    b.pop();
    b.ao(1);
  },

  /* --------------------------------------------------------------- *
   *  hinge placement for every door on the level
   *
   *  Yaws here are *model* yaws — the value handed to M4.trs, where the
   *  leaf's local +X maps to (cos yaw, 0, -sin yaw). The leaf hinges on one
   *  jamb and swings into the cell beside it, which is open by construction.
   * --------------------------------------------------------------- */
  _doorMeta(L) {
    L.doors.forEach(d => {
      const wallAlongZ = this.solid(L, d.x, d.y - 1) && this.solid(L, d.x, d.y + 1);
      if (wallAlongZ) {
        // shut leaf spans z, hinged at the z = d.y jamb, swings towards +x
        d.hingeX = d.x + 0.5; d.hingeZ = d.y + 0.04;
        d.baseYaw = -Math.PI / 2;
        d.swing = Math.PI * 0.52;
      } else {
        // shut leaf spans x, hinged at the x = d.x jamb, swings towards -z
        d.hingeX = d.x + 0.04; d.hingeZ = d.y + 0.5;
        d.baseYaw = 0;
        d.swing = Math.PI * 0.52;
      }
    });
  },

  /** Where the free edge of a leaf currently is, in world x/z. */
  leafTip(d, out) {
    const yaw = d.baseYaw + d.swing * d.anim;
    out[0] = d.hingeX + Math.cos(yaw) * 0.92;
    out[1] = d.hingeZ - Math.sin(yaw) * 0.92;
    return out;
  },

  /** Distance from a point to the swung door leaf, for player collision. */
  leafDistance(d, px, pz) {
    const tip = this.leafTip(d, this._tip || (this._tip = [0, 0]));
    const ex = tip[0], ez = tip[1];
    const vx = ex - d.hingeX, vz = ez - d.hingeZ;
    const wx = px - d.hingeX, wz = pz - d.hingeZ;
    const len2 = vx * vx + vz * vz;
    const t = U.clamp((wx * vx + wz * vz) / len2, 0, 1);
    return U.dist(px, pz, d.hingeX + vx * t, d.hingeZ + vz * t);
  },
};
