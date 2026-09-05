/* ------------------------------------------------------------------ *
 *  util.js — small helpers shared by every module
 * ------------------------------------------------------------------ */
'use strict';

const U = {
  clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; },

  lerp(a, b, t) { return a + (b - a) * t; },

  /** Shortest signed difference between two angles, in (-PI, PI]. */
  angleDiff(a, b) {
    let d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  },

  dist(ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); },

  rand(a, b) { return a + Math.random() * (b - a); },
  randInt(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); },
  pick(arr) { return arr[(Math.random() * arr.length) | 0]; },

  /** Deterministic 0..1 hash — used so procedural textures look the same
   *  every run instead of shimmering between reloads. */
  hash(x, y, seed) {
    let h = (x * 374761393 + y * 668265263 + (seed | 0) * 1442695040) | 0;
    h = (h ^ (h >> 13)) * 1274126177;
    return ((h ^ (h >> 16)) >>> 0) / 4294967296;
  },

  /** Smooth value noise on an integer lattice, decent enough for grain. */
  noise2(x, y, seed) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = U.hash(xi, yi, seed), b = U.hash(xi + 1, yi, seed);
    const c = U.hash(xi, yi + 1, seed), d = U.hash(xi + 1, yi + 1, seed);
    return U.lerp(U.lerp(a, b, u), U.lerp(c, d, u), v);
  },

  /** Fractal noise, `oct` octaves. */
  fbm(x, y, seed, oct) {
    let amp = 0.5, f = 1, sum = 0, norm = 0;
    for (let i = 0; i < (oct || 4); i++) {
      sum += U.noise2(x * f, y * f, seed + i * 17) * amp;
      norm += amp;
      amp *= 0.5; f *= 2;
    }
    return sum / norm;
  },

  /** #rrggbb -> {r,g,b} */
  hex(str) {
    const n = parseInt(str.slice(1), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  },

  el(id) { return document.getElementById(id); },
};
