/* ------------------------------------------------------------------ *
 *  player.js — movement, collision, stamina, noise, hiding.
 * ------------------------------------------------------------------ */
'use strict';

const RADIUS = 0.24;

const Player = {
  x: 0, y: 0, ang: 0, pitch: 0,
  level: 'upper',
  vx: 0, vy: 0,
  bob: 0, stepAcc: 0,
  stamina: 1, exhausted: false,
  crouching: false, sprinting: false,
  hiding: null,               // hide-spot entity while tucked away
  torchOn: true,
  battery: 1,
  noise: 0,                   // 0..1, drives the HUD meter
  firing: 0,
  alive: true,
  eyeY: 1.05,                 // current camera height, smoothed
  hideEye: 0,                 // >0 while tucked into a hiding place

  reset(spawn) {
    this.x = spawn.x; this.y = spawn.y; this.ang = spawn.ang || 0;
    this.level = spawn.level;
    this.pitch = 0; this.vx = this.vy = 0;
    this.stamina = 1; this.exhausted = false;
    this.hiding = null;
    this.noise = 0; this.stepAcc = 0;
    this.alive = true;
  },

  /** Where the camera sits, in world units above the floor. */
  targetEye() {
    if (this.hiding) return this.hideEye;
    return this.crouching ? 0.62 : 1.05;
  },

  /* --------------------------------------------------------------- */
  update(dt, input, level, game) {
    this.firing = Math.max(0, this.firing - dt);

    /* --- hiding freezes movement ------------------------------- */
    if (this.hiding) {
      this.noise = 0;
      // you can still turn your head a little, peeking out
      const limit = 0.8;
      const rel = U.angleDiff(this.hiding.face || 0, this.ang);
      if (Math.abs(rel) > limit) {
        this.ang = (this.hiding.face || 0) + Math.sign(rel) * limit;
      }
      this.stamina = Math.min(1, this.stamina + dt * 0.22);
      return;
    }

    /* --- intent ------------------------------------------------- */
    let fwd = 0, strafe = 0;
    if (input.keys['KeyW'] || input.keys['ArrowUp']) fwd += 1;
    if (input.keys['KeyS'] || input.keys['ArrowDown']) fwd -= 1;
    if (input.keys['KeyD'] || input.keys['ArrowRight']) strafe += 1;
    if (input.keys['KeyA'] || input.keys['ArrowLeft']) strafe -= 1;

    this.crouching = !!(input.keys['ControlLeft'] || input.keys['ControlRight'] || input.keys['KeyC']);
    const wantsSprint = !!(input.keys['ShiftLeft'] || input.keys['ShiftRight']);
    const moving = (fwd !== 0 || strafe !== 0);
    this.sprinting = wantsSprint && moving && !this.crouching && !this.exhausted && this.stamina > 0.02;

    /* --- stamina ------------------------------------------------ */
    if (this.sprinting) {
      this.stamina -= dt * 0.28;
      if (this.stamina <= 0) { this.stamina = 0; this.exhausted = true; this.sprinting = false; }
    } else {
      this.stamina = Math.min(1, this.stamina + dt * (this.crouching ? 0.34 : 0.19));
      if (this.exhausted && this.stamina > 0.35) this.exhausted = false;
    }

    /* --- velocity ----------------------------------------------- */
    const speed = this.sprinting ? 4.1 : this.crouching ? 1.25 : 2.45;
    const len = Math.hypot(fwd, strafe) || 1;
    const nf = fwd / len, ns = strafe / len;
    const cos = Math.cos(this.ang), sin = Math.sin(this.ang);
    const tx = (cos * nf - sin * ns) * speed;
    const ty = (sin * nf + cos * ns) * speed;

    // a little inertia so stopping isn't instant
    const accel = 14;
    this.vx += (tx - this.vx) * Math.min(1, dt * accel);
    this.vy += (ty - this.vy) * Math.min(1, dt * accel);

    this._move(this.vx * dt, this.vy * dt, level);

    /* --- footsteps & noise -------------------------------------- */
    const spd = Math.hypot(this.vx, this.vy);
    if (moving && spd > 0.15) {
      this.bob += dt * spd * 2.4;
      const stride = this.sprinting ? 1.35 : this.crouching ? 2.4 : 1.75;
      this.stepAcc += spd * dt;
      if (this.stepAcc > stride) {
        this.stepAcc = 0;
        const vol = this.sprinting ? 0.85 : this.crouching ? 0.16 : 0.42;
        Sound.step(vol, level.id !== 'basement');
        game.makeNoise(this.x, this.y, this.level,
                       this.sprinting ? 11 : this.crouching ? 2.2 : 6, 'steps');
      }
      // creaky boards betray you no matter how carefully you walk
      const cx = this.x | 0, cy = this.y | 0;
      const creak = level.creaks.some(c => c[0] === cx && c[1] === cy);
      if (creak && !this._lastCreak) {
        Sound.creak();
        game.makeNoise(this.x, this.y, this.level, this.crouching ? 6 : 13, 'creak');
        game.toast('The floorboard groans under you.');
      }
      this._lastCreak = creak;
      this.noise = U.clamp(this.sprinting ? 0.95 : this.crouching ? 0.12 : 0.45, 0, 1);
    } else {
      this.noise += (0 - this.noise) * Math.min(1, dt * 3);
      this._lastCreak = false;
    }

    /* --- torch drain -------------------------------------------- */
    if (this.torchOn) {
      this.battery = Math.max(0, this.battery - dt / 260);
      if (this.battery <= 0) {
        this.torchOn = false;
        game.toast('The torch dies. Find a battery.');
      }
    }
  },

  /* --- axis-separated collision against the tile grid ------------- */
  _move(dx, dy, level) {
    const solid = (x, y) => {
      if (x < 0 || y < 0 || x >= level.w || y >= level.h) return true;
      const t = level.grid[y | 0][x | 0];
      if (t === T.EMPTY) return false;
      if (t === T.DOOR) {
        const d = level.doorGrid[y | 0][x | 0];
        return !d || d.anim < 0.62;
      }
      return true;
    };
    const hits = (nx, ny) => {
      for (let ox = -1; ox <= 1; ox += 2) {
        for (let oy = -1; oy <= 1; oy += 2) {
          if (solid(nx + ox * RADIUS, ny + oy * RADIUS)) return true;
        }
      }
      // furniture. Only blocks moves that would take you *into* it, so a
      // spawn or a scramble out of a wardrobe can never wedge you inside one.
      for (const e of level.entities) {
        if (e.taken || !e.model) continue;
        const r = PROP_BLOCK[e.model];
        if (!r) continue;
        if (U.dist(nx, ny, e.x, e.y) < r && U.dist(this.x, this.y, e.x, e.y) >= r) return true;
      }
      // a swung door leaf is a solid plank, not a suggestion
      for (const d of level.doors) {
        if (d.anim < 0.02) continue;
        if (World.leafDistance(d, nx, ny) < 0.2 &&
            World.leafDistance(d, this.x, this.y) >= 0.2) return true;
      }
      return false;
    };
    if (!hits(this.x + dx, this.y)) this.x += dx; else this.vx = 0;
    if (!hits(this.x, this.y + dy)) this.y += dy; else this.vy = 0;
  },

  look(dx, dy, sens) {
    this.ang += dx * sens;
    this.pitch = U.clamp(this.pitch - dy * sens, -1.2, 1.2);
    if (this.ang > Math.PI) this.ang -= Math.PI * 2;
    if (this.ang < -Math.PI) this.ang += Math.PI * 2;
  },

  /**
   * Camera state for the renderer. The grid's y axis is the world's z axis;
   * everything above the floor is world y.
   */
  camera(dt) {
    const want = this.targetEye();
    this.eyeY += (want - this.eyeY) * Math.min(1, (dt || 0.016) * 9);
    const speed = Math.hypot(this.vx, this.vy);
    const bobY = this.hiding ? 0 : Math.sin(this.bob * 2) * speed * 0.008;
    const bobX = this.hiding ? 0 : Math.cos(this.bob) * speed * 0.004;
    return {
      x: this.x + bobX * Math.cos(this.ang + Math.PI / 2),
      y: this.eyeY + bobY,
      z: this.y + bobX * Math.sin(this.ang + Math.PI / 2),
      yaw: this.ang,
      pitch: this.pitch,
    };
  },
};
