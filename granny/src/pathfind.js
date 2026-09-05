/* ------------------------------------------------------------------ *
 *  pathfind.js — grid BFS + line of sight.
 *  The maps are 28x28, so a plain breadth-first flood is cheaper than
 *  the bookkeeping A* would need, and it never picks a silly route.
 * ------------------------------------------------------------------ */
'use strict';

const Path = {
  /** Can a walker occupy this cell? Doors count — granny opens them. */
  walkable(level, x, y, forPlayer) {
    if (x < 0 || y < 0 || x >= level.w || y >= level.h) return false;
    const t = level.grid[y][x];
    if (t === T.EMPTY) return true;
    if (t === T.DOOR) {
      if (!forPlayer) return true;                 // she has keys to everything
      const d = level.doorGrid[y][x];
      return !d || !d.locked;
    }
    return false;
  },

  /**
   * Breadth-first search from (sx,sy) to (tx,ty).
   * Returns an array of {x,y} cell centres, or null when unreachable.
   */
  find(level, sx, sy, tx, ty) {
    sx |= 0; sy |= 0; tx |= 0; ty |= 0;
    if (sx === tx && sy === ty) return [];
    const w = level.w, h = level.h;
    if (!this.walkable(level, tx, ty)) return null;

    const prev = new Int32Array(w * h).fill(-1);
    const seen = new Uint8Array(w * h);
    const q = new Int32Array(w * h);
    let head = 0, tail = 0;

    const start = sy * w + sx;
    q[tail++] = start; seen[start] = 1;
    const goal = ty * w + tx;

    while (head < tail) {
      const cur = q[head++];
      if (cur === goal) break;
      const cx = cur % w, cy = (cur / w) | 0;
      for (let i = 0; i < 4; i++) {
        const nx = cx + (i === 0 ? 1 : i === 1 ? -1 : 0);
        const ny = cy + (i === 2 ? 1 : i === 3 ? -1 : 0);
        if (!this.walkable(level, nx, ny)) continue;
        const ni = ny * w + nx;
        if (seen[ni]) continue;
        seen[ni] = 1;
        prev[ni] = cur;
        q[tail++] = ni;
      }
    }

    if (!seen[goal]) return null;
    const out = [];
    let cur = goal;
    while (cur !== start && cur !== -1) {
      out.push({ x: (cur % w) + 0.5, y: ((cur / w) | 0) + 0.5 });
      cur = prev[cur];
    }
    out.reverse();
    return out;
  },

  /** Unobstructed straight line between two world points? */
  lineOfSight(level, x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    if (len < 0.001) return true;
    const steps = Math.ceil(len * 6);
    const sx = dx / steps, sy = dy / steps;
    let x = x0, y = y0;
    for (let i = 0; i < steps; i++) {
      x += sx; y += sy;
      const cx = x | 0, cy = y | 0;
      if (cx < 0 || cy < 0 || cx >= level.w || cy >= level.h) return false;
      const t = level.grid[cy][cx];
      if (t === T.EMPTY) continue;
      if (t === T.DOOR) {
        const d = level.doorGrid[cy][cx];
        if (d && d.anim > 0.8) continue;           // an open doorway sees through
        return false;
      }
      return false;
    }
    return true;
  },

  /** Random reachable floor cell, used for patrol goals. */
  randomCell(level, awayFrom, minDist) {
    for (let tries = 0; tries < 200; tries++) {
      const x = U.randInt(1, level.w - 2), y = U.randInt(1, level.h - 2);
      if (level.grid[y][x] !== T.EMPTY) continue;
      if (awayFrom && U.dist(x + .5, y + .5, awayFrom.x, awayFrom.y) < (minDist || 0)) continue;
      return { x: x + 0.5, y: y + 0.5 };
    }
    return null;
  },
};
