/* ------------------------------------------------------------------ *
 *  granny.js — the reason you are whispering.
 *
 *  She is a small state machine on top of the grid pathfinder:
 *      patrol -> investigate -> chase -> search -> patrol
 *  plus stunned / trapped interruptions. She hears far better than she
 *  sees, she opens every door in the house, and she follows you between
 *  floors by walking to the stairs like anyone else.
 * ------------------------------------------------------------------ */
'use strict';

/* which floors connect to which */
const LEVEL_LINKS = {
  ground: ['upper', 'basement'],
  upper: ['ground', 'attic'],
  basement: ['ground'],
  attic: ['upper'],
};

const Granny = {
  x: 0, y: 0, ang: 0,
  level: 'ground',
  state: 'patrol',
  speed: 2.0,
  path: null, pathAge: 0, pathGoal: null,
  target: null,              // {x,y,level} she is heading for
  timer: 0,                  // state countdown
  stunTime: 0,
  frame: 0, anim: 0,
  lastSeen: null,            // last confirmed player position
  seenTimer: 0,
  stepAcc: 0,
  transition: 0,             // >0 while she is on the stairs
  knowsHideSpot: null,
  mutterCd: 6,

  reset(day) {
    this.x = GRANNY_START.x; this.y = GRANNY_START.y;
    this.level = GRANNY_START.level;
    this.state = 'patrol';
    this.path = null; this.target = null; this.timer = 0;
    this.stunTime = 0; this.lastSeen = null; this.seenTimer = 0;
    this.transition = 0; this.knowsHideSpot = null;
    this.setDay(day);
  },

  setDay(day) {
    const d = U.clamp(day - 1, 0, 4);
    this.chaseSpeed = 2.05 + d * 0.22;      // day 5 she is faster than your jog
    this.patrolSpeed = 1.15 + d * 0.1;
    this.hearing = 1.0 + d * 0.16;          // multiplies every noise radius
    this.sight = 9 + d * 1.1;
  },

  /* --------------------------------------------------------------- *
   *  perception
   * --------------------------------------------------------------- */
  canSee(player, level) {
    if (player.level !== this.level) return false;
    if (player.hiding) return false;
    const d = U.dist(this.x, this.y, player.x, player.y);
    let range = this.sight;
    if (player.torchOn) range *= 1.35;          // the beam gives you away
    if (player.crouching) range *= 0.7;
    if (d > range) return false;
    const toPlayer = Math.atan2(player.y - this.y, player.x - this.x);
    const off = Math.abs(U.angleDiff(this.ang, toPlayer));
    // wide-ish cone, but she notices anything close regardless of facing
    if (off > 1.05 && d > 2.2) return false;
    return Path.lineOfSight(level, this.x, this.y, player.x, player.y);
  },

  hear(noise) {
    if (this.state === 'stunned' || this.state === 'trapped') return;
    if (this.state === 'chase') return;              // already busy with you
    let radius = noise.power * this.hearing;
    // the floors are stacked, so comparing plan distances between them is a
    // decent stand-in for "how far away that bang sounded"
    if (noise.level !== this.level) radius *= 0.5;
    if (U.dist(this.x, this.y, noise.x, noise.y) > radius) return;

    this.target = { x: noise.x, y: noise.y, level: noise.level };
    this.state = 'investigate';
    this.timer = 22;
    this.path = null;
  },

  /* --------------------------------------------------------------- *
   *  per-frame update
   * --------------------------------------------------------------- */
  update(dt, game) {
    const level = game.levels[this.level];
    const player = Player;

    this.mutterCd -= dt;
    if (this.mutterCd <= 0) {
      this.mutterCd = U.rand(14, 30);
      if (this.level === player.level && U.dist(this.x, this.y, player.x, player.y) < 14) Sound.creak();
    }

    /* --- interrupted states ------------------------------------- */
    if (this.state === 'stunned' || this.state === 'trapped') {
      this.stunTime -= dt;
      this.anim += dt * 2;
      if (this.stunTime <= 0) {
        this.state = this.lastSeen ? 'search' : 'patrol';
        this.timer = 6;
        this.path = null;
      }
      return;
    }

    /* --- stair transition --------------------------------------- */
    if (this.transition > 0) {
      this.transition -= dt;
      return;
    }

    /* --- sight -------------------------------------------------- */
    const sees = this.canSee(player, level);
    if (sees) {
      if (this.state !== 'chase') {
        Sound.scream();
        game.onSpotted();
      }
      this.state = 'chase';
      this.lastSeen = { x: player.x, y: player.y, level: player.level };
      this.seenTimer = 3.2;
      this.knowsHideSpot = null;
    } else if (this.seenTimer > 0) {
      this.seenTimer -= dt;
      // if you vanish into a wardrobe while she has eyes on you, she knows
      if (player.hiding && this.state === 'chase' && this.seenTimer > 1.4 &&
          player.level === this.level &&
          U.dist(this.x, this.y, player.x, player.y) < 9 &&
          Path.lineOfSight(level, this.x, this.y, player.x, player.y)) {
        this.knowsHideSpot = player.hiding;
      }
      if (this.seenTimer <= 0 && this.state === 'chase') {
        this.state = 'search';
        this.timer = 12;
        this.target = this.lastSeen;
        this.path = null;
      }
    }

    /* --- pick a destination for the current state ---------------- */
    switch (this.state) {
      case 'chase':
        this.target = { x: player.x, y: player.y, level: player.level };
        this.speed = this.chaseSpeed;
        break;

      case 'search':
        this.speed = this.chaseSpeed * 0.8;
        this.timer -= dt;
        if (!this.target || this._atTarget(1.0)) {
          const spot = Path.randomCell(level, { x: this.x, y: this.y }, 3);
          if (spot) { this.target = { x: spot.x, y: spot.y, level: this.level }; this.path = null; }
        }
        if (this.timer <= 0) { this.state = 'patrol'; this.target = null; this.lastSeen = null; }
        break;

      case 'investigate':
        this.speed = this.patrolSpeed * 1.5;
        this.timer -= dt;
        if (this._atTarget(0.9) || this.timer <= 0) {
          this.state = 'search';
          this.timer = 8;
        }
        break;

      default: {                                   // patrol
        this.speed = this.patrolSpeed;
        if (!this.target || this._atTarget(0.8)) {
          // most of the time she shuffles around this floor; sometimes she
          // decides to check another one
          if (Math.random() < 0.28) {
            const opts = LEVEL_LINKS[this.level];
            const dest = U.pick(opts);
            this.target = { x: this.x, y: this.y, level: dest };
          } else {
            const spot = Path.randomCell(level, { x: this.x, y: this.y }, 4);
            if (spot) this.target = { x: spot.x, y: spot.y, level: this.level };
          }
          this.path = null;
        }
      }
    }

    if (!this.target) return;

    /* --- different floor? head for the stairs -------------------- */
    let goal = this.target;
    if (this.target.level !== this.level) {
      const hop = this._nextLevel(this.level, this.target.level);
      const stair = game.stairsFrom(this.level, hop);
      if (!stair) { this.target = null; return; }
      goal = { x: stair.x, y: stair.y, level: this.level, stair };
      if (U.dist(this.x, this.y, stair.x, stair.y) < 0.7) {
        this._useStairs(stair, game);
        return;
      }
    }

    /* --- follow the path ---------------------------------------- */
    this.pathAge -= dt;
    const goalCell = ((goal.x | 0) + ',' + (goal.y | 0));
    if (!this.path || this.pathAge <= 0 || this.pathGoal !== goalCell) {
      this.path = Path.find(level, this.x, this.y, goal.x, goal.y);
      this.pathGoal = goalCell;
      this.pathAge = this.state === 'chase' ? 0.35 : 0.9;
      if (!this.path) { this.target = null; return; }
    }

    let step = this.path[0];
    if (!step) step = { x: goal.x, y: goal.y };
    const dx = step.x - this.x, dy = step.y - this.y;
    const dlen = Math.hypot(dx, dy);
    if (dlen < 0.22) {
      this.path.shift();
    } else {
      const nx = dx / dlen, ny = dy / dlen;
      const move = this.speed * dt;
      this.x += nx * move;
      this.y += ny * move;
      const want = Math.atan2(ny, nx);
      this.ang += U.angleDiff(this.ang, want) * Math.min(1, dt * 7);
      this.anim += move * 2.4;

      // her own footsteps, so you can hear her coming
      this.stepAcc += move;
      if (this.stepAcc > 1.5) {
        this.stepAcc = 0;
        if (this.level === player.level) {
          const d = U.dist(this.x, this.y, player.x, player.y);
          if (d < 16) Sound.step(U.clamp(0.55 - d * 0.03, 0.03, 0.5), true);
        }
      }
    }

    /* --- open doors in her way ---------------------------------- */
    const ahead = { x: this.x + Math.cos(this.ang) * 0.6, y: this.y + Math.sin(this.ang) * 0.6 };
    const cx = ahead.x | 0, cy = ahead.y | 0;
    if (cx >= 0 && cy >= 0 && cx < level.w && cy < level.h &&
        level.grid[cy][cx] === T.DOOR) {
      const d = level.doorGrid[cy][cx];
      if (d && !d.open) game.openDoor(d, true);
    }

    /* --- bear traps --------------------------------------------- */
    for (const trap of game.traps) {
      if (trap.level !== this.level || trap.used) continue;
      if (U.dist(this.x, this.y, trap.x, trap.y) < 0.55) {
        trap.used = true;
        this.state = 'trapped';
        this.stunTime = 13;
        Sound.trapSnap();
        game.toast('The trap snaps shut on her ankle.');
      }
    }
  },

  /* --------------------------------------------------------------- */
  _atTarget(r) {
    return this.target && this.target.level === this.level &&
           U.dist(this.x, this.y, this.target.x, this.target.y) < r;
  },

  /** BFS across the four floors for the next one to walk to. */
  _nextLevel(from, to) {
    if (from === to) return to;
    const prev = { [from]: null };
    const q = [from];
    while (q.length) {
      const cur = q.shift();
      for (const nb of LEVEL_LINKS[cur]) {
        if (nb in prev) continue;
        prev[nb] = cur;
        if (nb === to) {
          let step = nb;
          while (prev[step] !== from) step = prev[step];
          return step;
        }
        q.push(nb);
      }
    }
    return to;
  },

  _useStairs(stair, game) {
    this.level = stair.to;
    this.x = stair.tx; this.y = stair.ty;
    this.path = null;
    this.transition = 0.7;
    if (this.target && this.target.level === this.level) {
      // arrived on the right floor — keep going
    } else if (this.state === 'patrol') {
      this.target = null;
    }
    if (Player.level === this.level) Sound.creak();
  },

  stun(seconds) {
    this.state = 'stunned';
    this.stunTime = seconds;
    this.path = null;
  },

  /** Sprite for the current mood, four-frame shuffle. */
  sprite() {
    const mode = (this.state === 'stunned' || this.state === 'trapped') ? 'stunned'
               : this.state === 'chase' ? 'chase' : 'walk';
    const f = Math.floor(this.anim) & 3;
    return `granny_${mode}_${f}`;
  },
};
