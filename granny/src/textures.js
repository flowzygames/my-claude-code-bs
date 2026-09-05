/* ------------------------------------------------------------------ *
 *  textures.js — every pixel in this game is generated at runtime.
 *  Wall textures are 64x64 RGBA buffers sampled by the raycaster;
 *  sprites are canvases (also exposed as raw buffers for the 3D pass).
 * ------------------------------------------------------------------ */
'use strict';

const TEX_SIZE = 64;

/* wall / tile ids ---------------------------------------------------- */
const T = {
  EMPTY: 0,
  BRICK: 1,
  WOOD: 2,
  PAPER: 3,       // patterned wallpaper
  STONE: 4,       // basement masonry
  DOOR: 5,        // dynamic — door objects live on these cells
  WINDOW: 6,      // boarded window
  SHELF: 7,
  EXIT: 8,        // the front door
  TILE: 9,        // bathroom
  GARAGE: 10,     // corrugated shutter
  DIRT: 11,
  PLASTER: 12,
  METAL: 13,
  BOARDS: 14,     // boarded-over opening
};

const TEX = [];          // TEX[tileId] = {w,h,data}
const SPR = {};          // SPR[name]   = {w,h,data,canvas}

/* ------------------------------------------------------------------ *
 *  helpers
 * ------------------------------------------------------------------ */

function bufFromPixelFn(size, fn) {
  const img = new Uint8ClampedArray(size * size * 4);
  const c = [0, 0, 0];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      fn(x, y, c);
      const i = (y * size + x) * 4;
      img[i] = c[0]; img[i + 1] = c[1]; img[i + 2] = c[2]; img[i + 3] = 255;
    }
  }
  return { w: size, h: size, data: img };
}

function canvasSprite(w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  draw(g, w, h);
  const id = g.getImageData(0, 0, w, h);
  return { w, h, data: id.data, canvas: cv };
}

/* grain shared by most surfaces */
function grain(x, y, seed, amount) {
  return (U.hash(x, y, seed) - 0.5) * amount;
}

/* ------------------------------------------------------------------ *
 *  wall textures
 * ------------------------------------------------------------------ */

function buildWallTextures() {

  /* --- brick ----------------------------------------------------- */
  TEX[T.BRICK] = bufFromPixelFn(TEX_SIZE, (x, y, o) => {
    const bh = 8, bw = 16;
    const row = Math.floor(y / bh);
    const off = (row & 1) ? bw / 2 : 0;
    const lx = (x + off) % bw, ly = y % bh;
    const mortar = lx < 1.4 || ly < 1.4;
    const id = U.hash(Math.floor((x + off) / bw), row, 7);
    if (mortar) {
      const v = 54 + grain(x, y, 3, 16);
      o[0] = v + 4; o[1] = v + 2; o[2] = v - 2;
    } else {
      const t = U.fbm(x * 0.4, y * 0.4, 11, 3);
      let r = 96 + id * 34 + t * 26, g = 52 + id * 16 + t * 18, b = 42 + id * 10 + t * 14;
      // soot creeping up the wall
      const soot = U.clamp(U.fbm(x * 0.08, y * 0.05, 21, 3) * 1.4 - 0.35, 0, 1) * (1 - y / 90);
      r -= soot * 60; g -= soot * 42; b -= soot * 34;
      o[0] = r; o[1] = g; o[2] = b;
    }
  });

  /* --- wooden planks --------------------------------------------- */
  TEX[T.WOOD] = bufFromPixelFn(TEX_SIZE, (x, y, o) => {
    const pw = 16;
    const plank = Math.floor(x / pw);
    const edge = (x % pw) < 1 || (x % pw) > pw - 2;
    const id = U.hash(plank, 0, 31);
    const grainv = U.fbm(x * 0.9, y * 0.09 + plank * 4, 5, 3);
    let r = 92 + id * 26 + grainv * 46;
    let g = 62 + id * 18 + grainv * 32;
    let b = 38 + id * 10 + grainv * 20;
    // dark ring knots
    const kx = plank * pw + 8, ky = 12 + id * 40;
    const kd = Math.hypot(x - kx, (y - ky) * 1.6);
    if (kd < 5) { const f = 1 - kd / 5; r -= f * 52; g -= f * 40; b -= f * 26; }
    if (edge) { r *= 0.55; g *= 0.55; b *= 0.55; }
    o[0] = r; o[1] = g; o[2] = b;
  });

  /* --- damp floral wallpaper ------------------------------------- */
  TEX[T.PAPER] = bufFromPixelFn(TEX_SIZE, (x, y, o) => {
    const stripe = Math.sin(x * 0.49) * 0.5 + 0.5;
    let r = 108 + stripe * 20, g = 96 + stripe * 18, b = 74 + stripe * 12;
    // repeating rosette motif
    const mx = ((x + 8) % 16) - 8, my = ((y + 8) % 16) - 8;
    const md = Math.hypot(mx, my);
    const petal = Math.abs(Math.sin(Math.atan2(my, mx) * 5)) * 2.2 + 1.4;
    if (md < petal) { r -= 13; g -= 11; b -= 3; }
    if (md > petal && md < petal + 1.2) { r += 5; g += 4; b += 2; }
    // water damage & peeling
    const damp = U.clamp(U.fbm(x * 0.06, y * 0.045, 44, 4) * 1.7 - 0.55, 0, 1);
    r = U.lerp(r, 62, damp); g = U.lerp(g, 52, damp); b = U.lerp(b, 36, damp);
    const peel = U.fbm(x * 0.13, y * 0.05, 66, 3);
    if (peel > 0.74 && y > 22) { r *= 0.6; g *= 0.58; b *= 0.55; }
    const n = grain(x, y, 9, 12);
    o[0] = r + n; o[1] = g + n; o[2] = b + n;
  });

  /* --- basement masonry ------------------------------------------ */
  TEX[T.STONE] = bufFromPixelFn(TEX_SIZE, (x, y, o) => {
    const cell = 16;
    const row = Math.floor(y / cell);
    const off = (row & 1) ? 8 : 0;
    const col = Math.floor((x + off) / cell);
    const wob = U.fbm(x * 0.3, y * 0.3, 3, 2) * 2.2;
    const lx = (x + off + wob) % cell, ly = (y + wob) % cell;
    const seam = lx < 2 || ly < 2;
    const id = U.hash(col, row, 13);
    if (seam) {
      const v = 40 + grain(x, y, 4, 14);
      o[0] = v; o[1] = v; o[2] = v - 2;
    } else {
      const t = U.fbm(x * 0.5, y * 0.5, 17, 3);
      const v = 66 + id * 26 + t * 30;
      const green = U.clamp(U.fbm(x * 0.07, y * 0.06, 51, 3) * 1.5 - 0.6, 0, 1);
      o[0] = v - green * 22; o[1] = v + green * 6; o[2] = v * 0.94 - green * 10;
    }
  });

  /* --- interior door --------------------------------------------- */
  TEX[T.DOOR] = bufFromPixelFn(TEX_SIZE, (x, y, o) => {
    const grainv = U.fbm(x * 0.7, y * 0.12, 23, 3);
    let r = 84 + grainv * 40, g = 54 + grainv * 26, b = 32 + grainv * 16;
    // two sunken panels
    const inPanel = (px, py, w, h) => x > px && x < px + w && y > py && y < py + h;
    const bevel = (px, py, w, h) => {
      if (!inPanel(px - 3, py - 3, w + 6, h + 6)) return 0;
      if (inPanel(px, py, w, h)) return -14;
      return (x < px || y < py) ? -24 : 16;
    };
    const b1 = bevel(12, 8, 40, 20), b2 = bevel(12, 36, 40, 20);
    const d = b1 + b2;
    r += d; g += d * 0.8; b += d * 0.6;
    // brass handle
    if (Math.hypot(x - 55, y - 33) < 3.2) { r = 168; g = 140; b = 62; }
    if (Math.hypot(x - 55, y - 33) < 1.4) { r = 40; g = 34; b = 20; }
    o[0] = r; o[1] = g; o[2] = b;
  });

  /* --- front door: chained, padlocked, winch socket --------------- */
  TEX[T.EXIT] = bufFromPixelFn(TEX_SIZE, (x, y, o) => {
    const grainv = U.fbm(x * 0.5, y * 0.1, 29, 3);
    let r = 66 + grainv * 30, g = 42 + grainv * 20, b = 26 + grainv * 12;
    if (x % 16 < 1) { r *= 0.5; g *= 0.5; b *= 0.5; }
    // iron bands
    if ((y > 12 && y < 17) || (y > 46 && y < 51)) {
      const v = 74 + grain(x, y, 8, 20);
      r = v; g = v; b = v * 1.02;
      if (x % 12 < 3) { r += 26; g += 26; b += 26; }   // rivets
    }
    // hasp + padlock in the middle
    if (x > 26 && x < 38 && y > 26 && y < 32) { r = 96; g = 96; b = 100; }
    if (x > 28 && x < 36 && y > 30 && y < 40) {
      const d = Math.hypot(x - 32, y - 35);
      const v = d < 5 ? 126 : 90;
      r = v; g = v; b = v * 1.05;
      if (d < 1.6) { r = 24; g = 22; b = 20; }          // keyhole
    }
    o[0] = r; o[1] = g; o[2] = b;
  });

  /* --- boarded window (moonlight leaking through) ---------------- */
  TEX[T.WINDOW] = bufFromPixelFn(TEX_SIZE, (x, y, o) => {
    const inFrame = x > 8 && x < 56 && y > 8 && y < 52;
    if (!inFrame) {
      const t = U.fbm(x * 0.4, y * 0.4, 11, 3);
      o[0] = 84 + t * 20; o[1] = 74 + t * 18; o[2] = 60 + t * 14;
      return;
    }
    // night sky behind
    let r = 22, g = 28, b = 40;
    const glow = U.clamp(1 - Math.hypot(x - 40, y - 20) / 26, 0, 1);
    r += glow * 70; g += glow * 78; b += glow * 96;
    // planks nailed across
    const band = ((y * 1.0 + x * 0.35) % 22);
    if (band < 11) {
      const gr = U.fbm(x * 0.8, y * 0.2, 35, 3);
      r = 74 + gr * 32; g = 50 + gr * 22; b = 32 + gr * 14;
      if (band < 1 || band > 10) { r *= 0.6; g *= 0.6; b *= 0.6; }
    }
    o[0] = r; o[1] = g; o[2] = b;
  });

  /* --- bookshelf -------------------------------------------------- */
  TEX[T.SHELF] = bufFromPixelFn(TEX_SIZE, (x, y, o) => {
    const shelfH = 16;
    const ly = y % shelfH;
    if (ly > 13) {                       // the shelf board itself
      const v = 62 + grain(x, y, 6, 12);
      o[0] = v + 14; o[1] = v; o[2] = v - 12;
      return;
    }
    const bookId = Math.floor(x / 4) + Math.floor(y / shelfH) * 16;
    const h = U.hash(bookId, 1, 77);
    const top = 2 + h * 5;
    if (ly < top) { o[0] = 16; o[1] = 13; o[2] = 11; return; }   // dark gap
    const hue = U.hash(bookId, 2, 91);
    let r = 60 + hue * 90, g = 40 + U.hash(bookId, 3, 5) * 60, b = 34 + U.hash(bookId, 4, 6) * 70;
    if (x % 4 === 0) { r *= 0.5; g *= 0.5; b *= 0.5; }
    if (ly > top + 2 && ly < top + 4) { r += 40; g += 36; b += 24; }   // title band
    o[0] = r; o[1] = g; o[2] = b;
  });

  /* --- bathroom tiles --------------------------------------------- */
  TEX[T.TILE] = bufFromPixelFn(TEX_SIZE, (x, y, o) => {
    const s = 8;
    const gx = x % s, gy = y % s;
    const id = U.hash(Math.floor(x / s), Math.floor(y / s), 19);
    if (gx < 1 || gy < 1) { const v = 52 + grain(x, y, 2, 10); o[0] = v; o[1] = v; o[2] = v - 4; return; }
    let v = 132 + id * 20;
    const stain = U.clamp(U.fbm(x * 0.09, y * 0.07, 61, 3) * 1.6 - 0.6, 0, 1);
    o[0] = v - stain * 66; o[1] = v - stain * 52 + 2; o[2] = v - stain * 60 - 4;
    if (id > 0.93 && gx > 3 && gy > 3) { o[0] *= .6; o[1] *= .6; o[2] *= .6; }  // cracked tile
  });

  /* --- corrugated garage shutter ---------------------------------- */
  TEX[T.GARAGE] = bufFromPixelFn(TEX_SIZE, (x, y, o) => {
    const wave = Math.sin(y * 0.9) * 0.5 + 0.5;
    let v = 62 + wave * 46;
    const rust = U.clamp(U.fbm(x * 0.08, y * 0.09, 71, 4) * 1.8 - 0.7, 0, 1);
    o[0] = U.lerp(v, 108, rust); o[1] = U.lerp(v, 56, rust); o[2] = U.lerp(v * 1.05, 30, rust);
  });

  /* --- packed dirt ------------------------------------------------ */
  TEX[T.DIRT] = bufFromPixelFn(TEX_SIZE, (x, y, o) => {
    const t = U.fbm(x * 0.16, y * 0.16, 83, 4);
    const s = U.fbm(x * 0.6, y * 0.6, 84, 2);
    const v = 40 + t * 44 + s * 14;
    o[0] = v; o[1] = v * 0.84; o[2] = v * 0.64;
  });

  /* --- plaster / concrete ----------------------------------------- */
  TEX[T.PLASTER] = bufFromPixelFn(TEX_SIZE, (x, y, o) => {
    const t = U.fbm(x * 0.13, y * 0.13, 97, 4);
    let v = 92 + t * 34 + grain(x, y, 1, 10);
    // hairline cracks
    const c = Math.abs(U.fbm(x * 0.05, y * 0.05, 101, 3) - 0.5);
    if (c < 0.015) v *= 0.55;
    o[0] = v; o[1] = v * 0.97; o[2] = v * 0.88;
  });

  /* --- riveted steel ---------------------------------------------- */
  TEX[T.METAL] = bufFromPixelFn(TEX_SIZE, (x, y, o) => {
    let v = 78 + U.fbm(x * 0.5, y * 0.5, 103, 3) * 26;
    if (x % 32 < 2 || y % 32 < 2) v *= 1.2;
    const rx = x % 16, ry = y % 16;
    if (Math.hypot(rx - 8, ry - 8) < 2) v += 34;      // rivet heads
    const rust = U.clamp(U.fbm(x * 0.07, y * 0.07, 107, 3) * 1.7 - 0.75, 0, 1);
    o[0] = U.lerp(v, 116, rust); o[1] = U.lerp(v, 58, rust); o[2] = U.lerp(v, 34, rust);
  });

  /* --- boarded-up opening ----------------------------------------- */
  TEX[T.BOARDS] = bufFromPixelFn(TEX_SIZE, (x, y, o) => {
    const band = (y + Math.sin(x * 0.1) * 2) % 14;
    if (band < 12) {
      const gr = U.fbm(x * 0.7, y * 0.2, 111, 3);
      let r = 78 + gr * 34, g = 52 + gr * 22, b = 32 + gr * 14;
      if (band < 1) { r *= .5; g *= .5; b *= .5; }
      if ((x % 24 < 2) && band > 4 && band < 7) { r = 120; g = 118; b = 116; }  // nails
      o[0] = r; o[1] = g; o[2] = b;
    } else { o[0] = 14; o[1] = 12; o[2] = 12; }
  });
}

/* ------------------------------------------------------------------ *
 *  sprites
 * ------------------------------------------------------------------ */

/* ---- the old woman ------------------------------------------------ */
function drawGranny(g, w, h, phase, mode) {
  g.clearRect(0, 0, w, h);
  const cx = w / 2;
  const swing = Math.sin(phase) * (mode === 'chase' ? 10 : 5);
  const bob = Math.abs(Math.cos(phase)) * (mode === 'chase' ? 3 : 1.5);
  const lean = mode === 'chase' ? 6 : 2;

  const dress = '#6d6a63', dressDark = '#4a4842', skin = '#c9ab8c';

  // legs
  g.strokeStyle = '#3b3934'; g.lineWidth = 6; g.lineCap = 'round';
  g.beginPath();
  g.moveTo(cx - 5, h - 30); g.lineTo(cx - 6 - swing * .5, h - 4);
  g.moveTo(cx + 5, h - 30); g.lineTo(cx + 6 + swing * .5, h - 4);
  g.stroke();
  // slippers
  g.fillStyle = '#2a2825';
  g.fillRect(cx - 12 - swing * .5, h - 6, 13, 5);
  g.fillRect(cx + 1 + swing * .5, h - 6, 13, 5);

  // hunched body
  g.fillStyle = dress;
  g.beginPath();
  g.moveTo(cx - 15, h - 26 + bob);
  g.quadraticCurveTo(cx - 20, h - 58 + bob, cx - 9 - lean, h - 66 + bob);
  g.lineTo(cx + 9 - lean, h - 66 + bob);
  g.quadraticCurveTo(cx + 20, h - 58 + bob, cx + 15, h - 26 + bob);
  g.closePath(); g.fill();
  // apron shadow
  g.fillStyle = dressDark;
  g.beginPath();
  g.moveTo(cx - 8, h - 26 + bob); g.lineTo(cx + 8, h - 26 + bob);
  g.lineTo(cx + 5, h - 52 + bob); g.lineTo(cx - 5, h - 52 + bob);
  g.closePath(); g.fill();

  // arms — one reaching, one holding the bat
  g.strokeStyle = skin; g.lineWidth = 5;
  g.beginPath();
  g.moveTo(cx - 12, h - 60 + bob);
  g.lineTo(cx - 19 - lean, h - 44 + bob + swing * .4);
  g.moveTo(cx + 12, h - 60 + bob);
  g.lineTo(cx + 20 + lean, h - 46 + bob - swing * .4);
  g.stroke();

  // baseball bat
  g.save();
  g.translate(cx + 20 + lean, h - 46 + bob - swing * .4);
  g.rotate(mode === 'chase' ? -0.9 + Math.sin(phase * 2) * .35 : 0.5);
  const bg = g.createLinearGradient(0, 0, 0, -34);
  bg.addColorStop(0, '#6b4a28'); bg.addColorStop(1, '#8d6636');
  g.fillStyle = bg;
  g.beginPath(); g.moveTo(-2, 2); g.lineTo(2, 2); g.lineTo(4, -32); g.lineTo(-4, -32); g.closePath(); g.fill();
  g.restore();

  // head
  const hy = h - 72 + bob;
  g.fillStyle = skin;
  g.beginPath(); g.ellipse(cx - lean, hy, 9, 10.5, 0, 0, 7); g.fill();
  // hair bun
  g.fillStyle = '#d9d4c8';
  g.beginPath(); g.ellipse(cx - lean, hy - 7, 10, 6, 0, Math.PI, 0); g.fill();
  g.beginPath(); g.arc(cx - lean, hy - 12, 5, 0, 7); g.fill();
  // face
  g.fillStyle = '#241d18';
  g.beginPath(); g.ellipse(cx - lean - 3.4, hy - 1, 1.8, 2.1, 0, 0, 7); g.fill();
  g.beginPath(); g.ellipse(cx - lean + 3.4, hy - 1, 1.8, 2.1, 0, 0, 7); g.fill();
  if (mode === 'chase') {                      // open, shrieking mouth
    g.fillStyle = '#3a0f0d';
    g.beginPath(); g.ellipse(cx - lean, hy + 5, 3.4, 4.2, 0, 0, 7); g.fill();
  } else {
    g.fillStyle = '#5a3a33';
    g.fillRect(cx - lean - 3, hy + 4, 6, 1.6);
  }
  if (mode === 'stunned') {                    // dart sticking out
    g.strokeStyle = '#c9c2b0'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(cx - lean + 6, hy + 2); g.lineTo(cx - lean + 16, hy - 4); g.stroke();
    g.fillStyle = '#a3231c';
    g.beginPath(); g.arc(cx - lean + 16, hy - 4, 2.4, 0, 7); g.fill();
  }
}

/* ---- items --------------------------------------------------------- */
const ITEM_ART = {
  key(g, s) {
    g.strokeStyle = '#c8a13d'; g.fillStyle = '#c8a13d'; g.lineWidth = 3;
    g.beginPath(); g.arc(s * .32, s * .34, s * .16, 0, 7); g.stroke();
    g.beginPath(); g.moveTo(s * .42, s * .45); g.lineTo(s * .76, s * .78); g.stroke();
    g.fillRect(s * .60, s * .60, s * .12, s * .06);
    g.fillRect(s * .68, s * .70, s * .12, s * .06);
  },
  masterkey(g, s) {
    g.strokeStyle = '#9fa7ad'; g.fillStyle = '#9fa7ad'; g.lineWidth = 3.4;
    g.beginPath(); g.arc(s * .3, s * .3, s * .15, 0, 7); g.stroke();
    g.beginPath(); g.moveTo(s * .40, s * .41); g.lineTo(s * .78, s * .8); g.stroke();
    g.fillRect(s * .62, s * .56, s * .14, s * .07);
  },
  cogwheel(g, s) {
    g.fillStyle = '#8d8478';
    const cx = s / 2, cy = s / 2, r = s * .34;
    g.beginPath();
    for (let i = 0; i < 40; i++) {
      const a = i / 40 * Math.PI * 2;
      const rr = r * (1 + 0.22 * Math.sign(Math.cos(a * 8)));
      g[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    g.closePath(); g.fill();
    g.globalCompositeOperation = 'destination-out';
    g.beginPath(); g.arc(cx, cy, r * .34, 0, 7); g.fill();
    g.globalCompositeOperation = 'source-over';
  },
  hammer(g, s) {
    g.fillStyle = '#6b4a2a'; g.fillRect(s * .44, s * .3, s * .1, s * .58);
    g.fillStyle = '#8a8f94';
    g.fillRect(s * .26, s * .16, s * .46, s * .16);
    g.beginPath(); g.moveTo(s * .26, s * .16); g.lineTo(s * .18, s * .22); g.lineTo(s * .26, s * .32); g.fill();
  },
  crowbar(g, s) {
    g.strokeStyle = '#93413a'; g.lineWidth = s * .1; g.lineCap = 'round';
    g.beginPath(); g.moveTo(s * .24, s * .84); g.lineTo(s * .66, s * .26);
    g.stroke();
    g.beginPath(); g.moveTo(s * .66, s * .26); g.quadraticCurveTo(s * .84, s * .16, s * .8, s * .38); g.stroke();
  },
  boltcutters(g, s) {
    g.strokeStyle = '#9b3a33'; g.lineWidth = s * .09; g.lineCap = 'round';
    g.beginPath(); g.moveTo(s * .16, s * .84); g.lineTo(s * .5, s * .46); g.stroke();
    g.beginPath(); g.moveTo(s * .34, s * .88); g.lineTo(s * .6, s * .5); g.stroke();
    g.strokeStyle = '#aab0b4'; g.lineWidth = s * .07;
    g.beginPath(); g.moveTo(s * .5, s * .46); g.lineTo(s * .78, s * .2); g.stroke();
    g.beginPath(); g.moveTo(s * .6, s * .5); g.lineTo(s * .84, s * .3); g.stroke();
    g.fillStyle = '#5d6367';
    g.beginPath(); g.arc(s * .55, s * .48, s * .07, 0, 7); g.fill();
  },
  screwdriver(g, s) {
    g.fillStyle = '#a3231c';
    g.beginPath(); g.roundRect(s * .2, s * .62, s * .26, s * .24, 4); g.fill();
    g.strokeStyle = '#b9bec2'; g.lineWidth = s * .07;
    g.beginPath(); g.moveTo(s * .44, s * .68); g.lineTo(s * .78, s * .3); g.stroke();
    g.lineWidth = s * .12;
    g.beginPath(); g.moveTo(s * .74, s * .34); g.lineTo(s * .82, s * .26); g.stroke();
  },
  note(g, s) {
    g.fillStyle = '#ded6bd';
    g.beginPath(); g.moveTo(s * .22, s * .16); g.lineTo(s * .78, s * .2);
    g.lineTo(s * .74, s * .84); g.lineTo(s * .2, s * .8); g.closePath(); g.fill();
    g.strokeStyle = '#7d7460'; g.lineWidth = 1.6;
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.moveTo(s * .3, s * (.34 + i * .12)); g.lineTo(s * .66, s * (.36 + i * .12));
      g.stroke();
    }
    g.fillStyle = '#a3231c'; g.font = `bold ${s * .2}px monospace`;
    g.fillText('?', s * .42, s * .74);
  },
  tranq(g, s) {
    g.fillStyle = '#3f463c';
    g.fillRect(s * .16, s * .42, s * .58, s * .12);          // barrel
    g.fillRect(s * .2, s * .54, s * .16, s * .26);           // grip
    g.fillStyle = '#5b6455';
    g.fillRect(s * .34, s * .3, s * .3, s * .12);            // scope
    g.fillStyle = '#c9c2b0';
    g.fillRect(s * .72, s * .45, s * .16, s * .05);          // dart tip
  },
  dart(g, s) {
    g.strokeStyle = '#c9c2b0'; g.lineWidth = s * .07;
    g.beginPath(); g.moveTo(s * .22, s * .78); g.lineTo(s * .74, s * .26); g.stroke();
    g.fillStyle = '#a3231c';
    g.beginPath(); g.arc(s * .78, s * .22, s * .1, 0, 7); g.fill();
    g.fillStyle = '#d8d2c4';
    g.beginPath(); g.moveTo(s * .18, s * .82); g.lineTo(s * .3, s * .78); g.lineTo(s * .22, s * .68); g.fill();
  },
  beartrap(g, s) {
    g.strokeStyle = '#7b736a'; g.lineWidth = s * .08;
    g.beginPath(); g.arc(s / 2, s / 2, s * .3, 0, 7); g.stroke();
    g.fillStyle = '#9aa0a4';
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2;
      const x = s / 2 + Math.cos(a) * s * .3, y = s / 2 + Math.sin(a) * s * .3;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a + .3) * s * .12, y + Math.sin(a + .3) * s * .12);
      g.lineTo(x + Math.cos(a - .3) * s * .12, y + Math.sin(a - .3) * s * .12);
      g.fill();
    }
    g.fillStyle = '#4c4741';
    g.beginPath(); g.arc(s / 2, s / 2, s * .17, 0, 7); g.fill();
  },
  battery(g, s) {
    g.fillStyle = '#2f3a2c'; g.fillRect(s * .26, s * .22, s * .48, s * .58);
    g.fillStyle = '#c8a13d'; g.fillRect(s * .26, s * .22, s * .48, s * .12);
    g.fillRect(s * .38, s * .14, s * .1, s * .09);
    g.fillRect(s * .54, s * .14, s * .1, s * .09);
  },
};

function buildSprites() {
  /* granny walk cycle in three moods */
  ['walk', 'chase', 'stunned'].forEach(mode => {
    for (let f = 0; f < 4; f++) {
      SPR[`granny_${mode}_${f}`] = canvasSprite(72, 108, (g, w, h) =>
        drawGranny(g, w, h, f / 4 * Math.PI * 2, mode));
    }
  });

  /* items — 48px world sprite doubles as the inventory icon */
  Object.keys(ITEM_ART).forEach(name => {
    SPR[`item_${name}`] = canvasSprite(48, 48, (g, w) => {
      g.save();
      g.shadowColor = 'rgba(0,0,0,.8)'; g.shadowBlur = 6;
      ITEM_ART[name](g, w);
      g.restore();
    });
  });

  /* world props */
  SPR.crate = canvasSprite(64, 64, (g, w, h) => {
    g.fillStyle = '#6d4e2c'; g.fillRect(2, 12, w - 4, h - 14);
    g.strokeStyle = '#4a3520'; g.lineWidth = 3;
    g.strokeRect(2, 12, w - 4, h - 14);
    g.beginPath(); g.moveTo(2, 12); g.lineTo(w - 2, h - 2); g.moveTo(w - 2, 12); g.lineTo(2, h - 2); g.stroke();
  });
  SPR.crate_broken = canvasSprite(64, 64, (g, w, h) => {
    g.fillStyle = '#5a4025';
    g.fillRect(4, h - 20, w - 8, 18);
    g.strokeStyle = '#3d2c19'; g.lineWidth = 3;
    g.beginPath();
    g.moveTo(6, h - 20); g.lineTo(20, h - 34); g.moveTo(26, h - 20); g.lineTo(40, h - 30);
    g.moveTo(48, h - 20); g.lineTo(56, h - 32); g.stroke();
  });
  SPR.safe = canvasSprite(64, 72, (g, w, h) => {
    g.fillStyle = '#3c4045'; g.fillRect(4, 8, w - 8, h - 10);
    g.fillStyle = '#2b2f33'; g.fillRect(9, 13, w - 18, h - 20);
    g.strokeStyle = '#8f979c'; g.lineWidth = 3;
    g.beginPath(); g.arc(w / 2, h / 2, 9, 0, 7); g.stroke();
    g.fillStyle = '#c8a13d';
    g.beginPath(); g.arc(w / 2, h / 2, 3, 0, 7); g.fill();
  });
  SPR.hatch = canvasSprite(72, 40, (g, w, h) => {
    g.fillStyle = '#4a4d50'; g.fillRect(2, 6, w - 4, h - 10);
    g.strokeStyle = '#22252a'; g.lineWidth = 3; g.strokeRect(2, 6, w - 4, h - 10);
    g.strokeStyle = '#8f979c'; g.lineWidth = 4;
    g.beginPath(); g.arc(w / 2, h / 2, 8, Math.PI, 0); g.stroke();
  });
  SPR.vent = canvasSprite(48, 48, (g, w, h) => {
    g.fillStyle = '#6d7276'; g.fillRect(2, 2, w - 4, h - 4);
    g.fillStyle = '#23262a';
    for (let i = 0; i < 5; i++) g.fillRect(6, 8 + i * 7, w - 12, 4);
    g.fillStyle = '#b9bec2';
    [[5, 5], [w - 6, 5], [5, h - 6], [w - 6, h - 6]].forEach(p => {
      g.beginPath(); g.arc(p[0], p[1], 2, 0, 7); g.fill();
    });
  });
  SPR.wardrobe = canvasSprite(72, 108, (g, w, h) => {
    g.fillStyle = '#4e3820'; g.fillRect(2, 2, w - 4, h - 2);
    g.strokeStyle = '#33240f'; g.lineWidth = 3;
    g.strokeRect(6, 8, w / 2 - 8, h - 16);
    g.strokeRect(w / 2 + 2, 8, w / 2 - 8, h - 16);
    g.fillStyle = '#c8a13d';
    g.beginPath(); g.arc(w / 2 - 5, h / 2, 3, 0, 7); g.fill();
    g.beginPath(); g.arc(w / 2 + 5, h / 2, 3, 0, 7); g.fill();
  });
  SPR.bed = canvasSprite(96, 56, (g, w, h) => {
    g.fillStyle = '#5b4a3c'; g.fillRect(2, h - 22, w - 4, 20);
    g.fillStyle = '#7d8a86'; g.fillRect(6, h - 34, w - 12, 14);
    g.fillStyle = '#cfc7b4'; g.fillRect(w - 30, h - 40, 24, 10);
    g.fillStyle = '#3d332a'; g.fillRect(2, h - 46, 6, 44); g.fillRect(w - 8, h - 40, 6, 38);
  });
  SPR.winch = canvasSprite(48, 56, (g, w, h) => {
    g.fillStyle = '#4a4d50'; g.fillRect(8, 10, w - 16, h - 16);
    g.fillStyle = '#23262a';
    g.beginPath(); g.arc(w / 2, h / 2, 8, 0, 7); g.fill();
    g.strokeStyle = '#8f979c'; g.lineWidth = 2;
    g.beginPath(); g.arc(w / 2, h / 2, 12, 0, 7); g.stroke();
  });
  SPR.blood = canvasSprite(64, 64, (g, w, h) => {
    g.fillStyle = 'rgba(96,12,10,.85)';
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * Math.PI * 2, r = 10 + U.hash(i, 3, 5) * 16;
      g.beginPath();
      g.ellipse(w / 2 + Math.cos(a) * r * .6, h / 2 + Math.sin(a) * r * .5,
                4 + U.hash(i, 7, 9) * 8, 3 + U.hash(i, 11, 4) * 6, a, 0, 7);
      g.fill();
    }
  });
}

function buildAllTextures() {
  buildWallTextures();
  buildSprites();
}
