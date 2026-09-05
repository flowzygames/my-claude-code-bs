/* ------------------------------------------------------------------ *
 *  raycast.js — the 3D view.
 *
 *  Classic DDA raycaster: one ray per column for the walls, a distance
 *  table for floor/ceiling shading, then z-buffered billboard sprites.
 *  Everything is written into a small ImageData and upscaled, which is
 *  both fast and gives the game a pleasantly grubby low-res look.
 * ------------------------------------------------------------------ */
'use strict';

/* World scale: one grid cell is roughly 1.6 m across, walls are WALL_H
 * units tall and the camera sits EYE of the way up them. Everything the
 * renderer projects — walls, floor rows, sprites — uses these two numbers,
 * so they are the single knob for "how tall does this house feel". */
const WALL_H = 1.55;
const EYE = 0.62;
const EYE_H = WALL_H * EYE;          // camera height in world units
const CEIL_H = WALL_H - EYE_H;       // distance from the eye to the ceiling

const R = {
  canvas: null, ctx: null,
  img: null, data: null,
  W: 0, H: 0,
  scale: 1,
  zbuf: null,
  fov: 1.05,               // ~60° horizontal, widened while sprinting

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.off = document.createElement('canvas');
    this.offCtx = this.off.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
  },

  resize() {
    const dw = Math.max(320, window.innerWidth);
    const dh = Math.max(240, window.innerHeight);
    this.canvas.width = dw;
    this.canvas.height = dh;
    // internal render width — kept low on purpose
    const target = 460;
    this.scale = Math.max(1, Math.round(dw / target));
    this.W = Math.ceil(dw / this.scale);
    this.H = Math.ceil(dh / this.scale);
    this.off.width = this.W;
    this.off.height = this.H;
    this.img = this.offCtx.createImageData(this.W, this.H);
    this.data = this.img.data;
    this.zbuf = new Float32Array(this.W);
    this.colLight = new Float32Array(this.W);
    this.ctx.imageSmoothingEnabled = false;
    this._rowDist = new Float32Array(this.H);
  },

  /* --------------------------------------------------------------- *
   *  main entry
   * --------------------------------------------------------------- */
  render(cam, level, sprites, light) {
    const { W, H, data } = this;
    const horizon = Math.floor(H * 0.5 + cam.pitch);

    const dirX = Math.cos(cam.ang), dirY = Math.sin(cam.ang);
    // camera plane perpendicular to the direction, length = tan(fov/2)*aspect
    const aspect = W / H;
    const plen = Math.tan(this.fov / 2) * aspect;
    const planeX = -dirY * plen, planeY = dirX * plen;

    /* ---- per-column flashlight cone ---- */
    for (let x = 0; x < W; x++) {
      const camX = 2 * x / W - 1;
      const off = Math.abs(camX);
      this.colLight[x] = light.on ? Math.max(0, 1 - off * off * 1.55) : 0;
    }

    /* ---- floor & ceiling ---- */
    this._background(level, horizon, light);

    /* ---- walls ---- */
    const grid = level.grid, gw = level.w, gh = level.h;
    for (let x = 0; x < W; x++) {
      const camX = 2 * x / W - 1;
      const rdx = dirX + planeX * camX;
      const rdy = dirY + planeY * camX;

      let mapX = Math.floor(cam.x), mapY = Math.floor(cam.y);
      const ddx = Math.abs(1 / (rdx || 1e-9));
      const ddy = Math.abs(1 / (rdy || 1e-9));
      let stepX, stepY, sideX, sideY;

      if (rdx < 0) { stepX = -1; sideX = (cam.x - mapX) * ddx; }
      else { stepX = 1; sideX = (mapX + 1 - cam.x) * ddx; }
      if (rdy < 0) { stepY = -1; sideY = (cam.y - mapY) * ddy; }
      else { stepY = 1; sideY = (mapY + 1 - cam.y) * ddy; }

      let side = 0, tile = 0, door = null, guard = 0;
      while (guard++ < 128) {
        if (sideX < sideY) { sideX += ddx; mapX += stepX; side = 0; }
        else { sideY += ddy; mapY += stepY; side = 1; }
        if (mapX < 0 || mapY < 0 || mapX >= gw || mapY >= gh) { tile = T.BRICK; break; }
        const t = grid[mapY][mapX];
        if (t === T.DOOR) {
          const d = level.doorGrid[mapY][mapX];
          if (d && d.anim < 0.92) { tile = T.DOOR; door = d; break; }
        } else if (t !== T.EMPTY) { tile = t; break; }
      }

      const dist = side === 0 ? (sideX - ddx) : (sideY - ddy);
      const perp = Math.max(0.02, dist);
      this.zbuf[x] = perp;

      const lineH = ((H * WALL_H) / perp) | 0;
      const y1 = (horizon + lineH * EYE) | 0;      // where the wall meets the floor
      const y0 = y1 - lineH;
      const drawStart = Math.max(0, y0), drawEnd = Math.min(H - 1, y1);

      // texture column
      let wallX = side === 0 ? cam.y + perp * rdy : cam.x + perp * rdx;
      wallX -= Math.floor(wallX);
      if (door) wallX = Math.min(0.999, wallX + door.anim);   // door slides aside
      const tex = TEX[tile] || TEX[T.BRICK];
      let tx = (wallX * TEX_SIZE) | 0;
      if ((side === 0 && rdx > 0) || (side === 1 && rdy < 0)) tx = TEX_SIZE - tx - 1;

      // lighting for this column
      const fog = 1 / (1 + perp * perp / (level.fog * level.fog));
      const flash = this.colLight[x] * light.power * (1 / (1 + perp * perp * 0.052));
      let shade = (level.ambient * light.ambientMul + flash) * fog;
      if (side === 1) shade *= 0.74;                      // fake directional light
      shade *= light.flicker;
      // a boarded window is the only thing in this house giving off light
      if (tile === T.WINDOW) shade = Math.max(shade, 0.42 * fog);
      shade = U.clamp(shade, 0, 1.9);

      const step = TEX_SIZE / lineH;
      let texPos = (drawStart - y0) * step;
      const texBase = tx * 4;
      let idx = (drawStart * W + x) * 4;
      const rowStride = W * 4;
      const td = tex.data;

      for (let y = drawStart; y <= drawEnd; y++) {
        const ty = texPos & (TEX_SIZE - 1);
        texPos += step;
        const t4 = (ty * TEX_SIZE) * 4 + texBase;
        data[idx] = td[t4] * shade;
        data[idx + 1] = td[t4 + 1] * shade;
        data[idx + 2] = td[t4 + 2] * shade;
        idx += rowStride;
      }
    }

    /* ---- sprites ---- */
    this._sprites(cam, sprites, dirX, dirY, planeX, planeY, horizon, level, light);

    /* ---- present ---- */
    this.offCtx.putImageData(this.img, 0, 0);
    this.ctx.drawImage(this.off, 0, 0, this.W, this.H, 0, 0, this.canvas.width, this.canvas.height);
  },

  /* --------------------------------------------------------------- *
   *  floor + ceiling: shaded by row distance, no texture lookup
   * --------------------------------------------------------------- */
  _background(level, horizon, light) {
    const { W, H, data } = this;
    const fc = U.hex(level.floor), cc = U.hex(level.ceil);

    // distance to the floor (or ceiling) plane for each screen row
    for (let y = 0; y < H; y++) {
      const dy = y - horizon;
      this._rowDist[y] = dy === 0 ? 999
                       : (dy > 0 ? EYE_H : CEIL_H) * H / Math.abs(dy);
    }

    for (let y = 0; y < H; y++) {
      const d = this._rowDist[y];
      const below = y > horizon;
      const base = below ? fc : cc;
      const fog = 1 / (1 + d * d / (level.fog * level.fog));
      // vertical falloff for the torch beam
      const vert = below ? U.clamp(1 - d / 7.5, 0, 1) : U.clamp(1 - d / 5.5, 0, 1) * 0.75;
      let idx = (y * W) * 4;
      for (let x = 0; x < W; x++) {
        const flash = this.colLight[x] * light.power * vert;
        let s = (level.ambient * light.ambientMul * fog + flash) * light.flicker;
        if (s > 1.6) s = 1.6;
        data[idx] = base.r * s;
        data[idx + 1] = base.g * s;
        data[idx + 2] = base.b * s;
        data[idx + 3] = 255;
        idx += 4;
      }
    }
  },

  /* --------------------------------------------------------------- *
   *  billboard sprites
   * --------------------------------------------------------------- */
  _sprites(cam, sprites, dirX, dirY, planeX, planeY, horizon, level, light) {
    const { W, H, data } = this;
    const list = [];
    for (const s of sprites) {
      const dx = s.x - cam.x, dy = s.y - cam.y;
      list.push({ s, d: dx * dx + dy * dy, dx, dy });
    }
    list.sort((a, b) => b.d - a.d);

    const inv = 1 / (planeX * dirY - dirX * planeY);

    for (const item of list) {
      const { s, dx, dy } = item;
      const tex = SPR[s.sprite];
      if (!tex) continue;

      const tX = inv * (dirY * dx - dirX * dy);
      const tY = inv * (-planeY * dx + planeX * dy);
      if (tY < 0.12) continue;

      const screenX = ((W / 2) * (1 + tX / tY)) | 0;
      const unit = H / tY;                      // pixels per world unit of height
      const spriteH = Math.max(1, (unit * s.scale) | 0);
      const spriteW = Math.max(1, (spriteH * (tex.w / tex.h)) | 0);

      const floorY = horizon + unit * EYE_H;    // where this column meets the floor
      const bottom = floorY - unit * (s.yOff || 0);
      const top = bottom - spriteH;

      const x0 = Math.max(0, (screenX - spriteW / 2) | 0);
      const x1 = Math.min(W - 1, (screenX + spriteW / 2) | 0);
      const y0 = Math.max(0, top | 0);
      const y1 = Math.min(H - 1, bottom | 0);
      if (x1 < 0 || x0 >= W || y1 < 0 || y0 >= H) continue;

      const dist = Math.sqrt(item.d);
      const fog = 1 / (1 + dist * dist / (level.fog * level.fog));
      const td = tex.data;

      for (let x = x0; x <= x1; x++) {
        if (tY >= this.zbuf[x]) continue;
        const texX = (((x - (screenX - spriteW / 2)) * tex.w / spriteW) | 0);
        if (texX < 0 || texX >= tex.w) continue;

        const flash = this.colLight[x] * light.power * (1 / (1 + dist * dist * 0.052));
        let shade = (level.ambient * light.ambientMul + flash) * fog * light.flicker;
        if (s.glow) shade = Math.max(shade, s.glow);
        shade = U.clamp(shade, 0.02, 1.7);

        for (let y = y0; y <= y1; y++) {
          const texY = (((y - top) * tex.h / spriteH) | 0);
          if (texY < 0 || texY >= tex.h) continue;
          const t4 = (texY * tex.w + texX) * 4;
          const a = td[t4 + 3];
          if (a < 24) continue;
          const i = (y * W + x) * 4;
          if (a > 235) {
            data[i] = td[t4] * shade;
            data[i + 1] = td[t4 + 1] * shade;
            data[i + 2] = td[t4 + 2] * shade;
          } else {
            const al = a / 255;
            data[i] = data[i] * (1 - al) + td[t4] * shade * al;
            data[i + 1] = data[i + 1] * (1 - al) + td[t4 + 1] * shade * al;
            data[i + 2] = data[i + 2] * (1 - al) + td[t4 + 2] * shade * al;
          }
        }
      }
    }
  },

  /* --------------------------------------------------------------- *
   *  the item in your hands, drawn on top at full resolution
   * --------------------------------------------------------------- */
  drawHeld(spriteName, bob, firing) {
    if (!spriteName) return;
    const tex = SPR[spriteName];
    if (!tex) return;
    const c = this.canvas, g = this.ctx;
    const size = Math.min(c.width, c.height) * (spriteName === 'item_tranq' ? 0.42 : 0.3);
    const x = c.width - size * 1.25 + Math.sin(bob) * size * 0.05;
    const y = c.height - size * 0.92 + Math.abs(Math.cos(bob)) * size * 0.06 + (firing ? size * 0.18 : 0);
    g.save();
    g.globalAlpha = 0.96;
    g.shadowColor = 'rgba(0,0,0,.9)';
    g.shadowBlur = 18;
    g.drawImage(tex.canvas, x, y, size, size);
    g.restore();
  },
};
